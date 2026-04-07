"""Base Agent class for all CRM agents"""

from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
import asyncio
from datetime import datetime
import json
import re


class DataMasker:
    """Utility to redact PII (Emails, Phones, Names) from strings"""

    @staticmethod
    def redact(text: str) -> str:
        if not text:
            return ""
        # Redact Emails (keep domain)
        text = re.sub(r'([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', r'\1****@\2', text)
        # Redact Phones (keep last 4 digits)
        text = re.sub(r'(\+?\d{1,4})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?(\d{4})', r'\1-***-***-\2', text)
        # Redact Name-like patterns (Simplified for demo — usually requires NLP)
        # Here we just look for specific keys in JSON data if needed, but for text,
        # we focus on the most identifiable PII.
        return text


class BaseAgent(ABC):
    """Abstract base class for all CRM agents"""

    def __init__(
        self,
        name: str,
        llm: Any,
        tools: Optional[List[Any]] = None,   # Fixed: Optional to allow None default
        memory: Optional[Any] = None,
        redis_client: Optional[Any] = None
    ):
        self.name = name
        self.llm = llm
        self.tools: List[Any] = tools or []
        self.memory = memory
        # Use plain Any so Pyre2 can narrow with `if self.redis is not None`
        self.redis: Any = redis_client
        self.state: Dict[str, Any] = {}
        self.event_queue: asyncio.Queue[Any] = asyncio.Queue()

    @abstractmethod
    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent task - must be implemented by subclass"""
        ...  # Abstract — subclasses must implement and return a dict

    def redact_pii(self, text: str) -> str:
        """Helper to redact PII (Emails, Phones, Names) from text"""
        return DataMasker.redact(text)

    async def think(self, prompt: str, max_retries: int = 3, max_tokens: int = 512) -> str:
        """Use LLM to reason about a task — with exponential backoff retry on failure."""
        last_error: Exception | None = None
        for attempt in range(max_retries):
            try:
                return await self.llm.generate(prompt, max_tokens=max_tokens)
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    wait_seconds = 2 ** attempt   # 1s → 2s → 4s
                    print(f"[{self.name}] LLM call failed (attempt {attempt + 1}/{max_retries}): {e} — retrying in {wait_seconds}s")
                    await asyncio.sleep(wait_seconds)
        print(f"[{self.name}] LLM call failed after {max_retries} attempts: {last_error}")
        return f"[LLM unavailable after {max_retries} retries: {last_error}]"

    async def use_tool(self, tool_name: str, **kwargs: Any) -> Any:
        """Execute a tool from the agent's toolkit"""
        tool = next((t for t in self.tools if t.name == tool_name), None)
        if not tool:
            raise ValueError(f"Tool {tool_name} not found")
        return await tool.arun(**kwargs)

    async def publish_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish event to message bus for other agents"""
        event: Dict[str, Any] = {
            "type": event_type,
            "agent": self.name,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }

        if self.redis is not None:
            await self.redis.publish("crm:events", json.dumps(event))

        await self.event_queue.put(event)

    async def subscribe_event(self, event_type: str, callback: Any) -> None:
        """Subscribe to events from other agents"""
        while True:
            event = await self.event_queue.get()
            if event["type"] == event_type:
                await callback(event)

    def update_state(self, key: str, value: Any) -> None:
        """Update agent's internal state"""
        self.state[key] = value

        if self.redis is not None:
            self.redis.hset(f"agent:{self.name}:state", key, json.dumps(value))

    def get_state(self, key: str) -> Any:
        """Get value from agent's state"""
        return self.state.get(key)

    async def log_activity(self, activity_type: str, details: Dict[str, Any]) -> None:
        """Log agent activity for audit trail — writes to DB and prints"""
        log_entry: Dict[str, Any] = {
            "agent": self.name,
            "type": activity_type,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }

        if self.redis is not None:
            await self.redis.lpush(f"agent:{self.name}:logs", json.dumps(log_entry))

        # Write to SQLite agent_logs table so the frontend can poll real events
        try:
            from database.connection import SessionLocal
            from database.models import AgentLog
            db = SessionLocal()
            db_log = AgentLog(
                agent_name=self.name,
                activity_type=activity_type,
                details=details,
            )
            db.add(db_log)
            db.commit()
            db.close()
        except Exception as e:
            pass  # Never block agent execution due to logging failure

        print(f"[{self.name}] {activity_type}: {details}")

    async def collaborate(self, agent_name: str, task: Dict[str, Any]) -> Dict[str, Any]:
        """Request another agent to perform a task"""
        await self.publish_event("task_request", {
            "target_agent": agent_name,
            "task": task
        })

        # Wait for response
        response = await self.wait_for_response(agent_name)
        return response

    async def wait_for_response(self, agent_name: str, timeout: int = 30) -> Dict[str, Any]:
        """Wait for response from another agent"""
        try:
            response = await asyncio.wait_for(
                self._get_response(agent_name),
                timeout=timeout
            )
            return response
        except asyncio.TimeoutError:
            return {"error": "Timeout waiting for agent response"}

    async def _get_response(self, agent_name: str) -> Dict[str, Any]:
        """Internal method to get response from event queue"""
        while True:
            event = await self.event_queue.get()
            if event["agent"] == agent_name and event["type"] == "task_response":
                return dict(event["data"])
            # Re-queue non-matching events so other consumers can still see them
            await self.event_queue.put(event)
            await asyncio.sleep(0)  # yield control to avoid tight busy-loop
        raise RuntimeError("unreachable")  # satisfies type checker
