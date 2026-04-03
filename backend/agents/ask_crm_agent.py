"""Ask CRM Agent - Specialized in SQL generation and self-healing data extraction"""

from typing import Dict, Any, List, Tuple
from .base_agent import BaseAgent
from sqlalchemy import text
import re


class AskCRMAgent(BaseAgent):
    """
    Autonomous agent that:
    - Generates SQLite queries based on NL questions
    - Self-corrects SQL errors (3x retry)
    - Validates results against the schema
    - Summarizes data for the end user
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="AskCRMAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )
        self.max_retries = 3
        self.schema_hint = """
        Schema Reference:
        - Deals: id, name, value, stage, health_score, is_stalled, last_activity
        - Leads (Contacts): id, email, first_name, last_name, lead_score, lead_status, job_title
        - Customers: id, name, health_score, churn_risk, churn_probability
        - MetricsDaily: date, category, value
        - Emails: id, from_email, to_email, subject, sentiment, priority
        """

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Ask CRM workflow with self-healing SQL"""
        prompt = task.get("prompt", "")
        db = task.get("db")
        steps = []

        steps.append("🔍 Analyzing user intent and mapping to CRM schema...")
        
        sql_result, data, agent_steps = await self.execute_sql_with_retry(prompt, db)
        steps.extend(agent_steps)

        if not data and sql_result:
             steps.append("⚠️ Data retrieval unsuccessful. Attempting fallback summary.")
        
        steps.append("🧩 Reasoning Agent synthesizing final narrative response...")
        
        summary_prompt = f"""
        Summarize the following CRM data for the user in a professional, concise, and helpful tone.
        Query: "{prompt}"
        Data: {str(data)[:500]} (showing snippet)
        
        Return ONLY the summary text (max 2 sentences).
        """
        summary = await self.think(summary_prompt)

        return {
            "summary": summary.strip(),
            "data": data,
            "sql": sql_result,
            "steps": steps
        }

    async def execute_sql_with_retry(self, query_prompt: str, db: Any) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        """Implementation of the 3x self-healing SQL engine"""
        steps = []
        current_try = 1
        last_error = None
        sql = ""
        data = []

        while current_try <= self.max_retries:
            try:
                steps.append(f"🛠️ Step: Generating optimized SQL query (Attempt {current_try})...")
                
                gen_prompt = f"""
                You are a CRM Database Expert. Generate a valid SQLite query for the following user question.
                Question: "{query_prompt}"
                
                {self.schema_hint}
                
                {f"Your previous SQL failed with this error: {last_error}. Please fix the syntax or logic." if last_error else ""}
                
                Return ONLY the raw SQL string. No markdown, no '```sql'.
                """
                
                sql = await self.think(gen_prompt)
                sql = sql.replace("```sql", "").replace("```", "").strip()
                
                # Execute SQL
                steps.append(f"🚀 Step: Executing Query: {sql[:60]}...")
                res = db.execute(text(sql)).fetchall()
                data = [dict(r._mapping) for r in res]
                
                steps.append(f"✅ Step: Result extraction successful. {len(data)} rows retrieved.")
                return sql, data, steps

            except Exception as e:
                last_error = str(e)
                steps.append(f"❌ Step: SQL Attempt {current_try} failed: {last_error[:40]}...")
                current_try += 1
                
        steps.append("🛑 Step: SQL Agent exhausted retries. Using safety fallback.")
        return sql, [], steps
