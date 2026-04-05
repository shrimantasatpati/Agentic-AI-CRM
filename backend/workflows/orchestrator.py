from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
import os
from openai import AsyncOpenAI

from agents import (
    LeadQualificationAgent,
    EmailIntelligenceAgent,
    SalesPipelineAgent,
    CustomerSuccessAgent,
    MeetingSchedulerAgent,
    AnalyticsAgent,
    AskCRMAgent
)


# ============================================================
# MULTI-LLM WRAPPER — Supports Gemini, Groq, and xAI/Grok
# Auto-detects available API key and selects the provider.
# Gemini and Groq both expose OpenAI-compatible endpoints.
# ============================================================

class MultiLLMWrapper:
    """
    Unified LLM wrapper that supports:
    - Google Gemini (via OpenAI-compatible endpoint)
    - Groq (via OpenAI-compatible endpoint)
    - xAI/Grok (via OpenAI-compatible endpoint)
    Priority: Gemini → Groq → xAI → Mock
    """

    # Registry of supported providers
    PROVIDERS = {
        "groq": {
            "env_key":  "GROQ_API_KEY",
            "base_url": "https://api.groq.com/openai/v1",
            "default_model": "llama-3.1-8b-instant",
        },
        "gemini": {
            "env_key":  "GEMINI_API_KEY",
            "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
            "default_model": "gemini-2.0-flash",
        },
        "xai": {
            "env_key":  "XAI_API_KEY",
            "base_url": "https://api.x.ai/v1",
            "default_model": "grok-2-1212",
        },
    }

    def __init__(self, preferred_model: Optional[str] = None) -> None:
        self._client: Optional[AsyncOpenAI] = None
        self.provider: str = "mock"
        self.model_name: str = "mock"
        self._init_client(preferred_model)

    def _init_client(self, preferred_model: Optional[str] = None) -> None:
        """Detect available API key and initialize the appropriate client."""
        # Allow explicit override via MODEL_PROVIDER env var
        force_provider = os.getenv("MODEL_PROVIDER", "").lower()

        provider_order = [force_provider] if force_provider in self.PROVIDERS else []
        # Groq is first — it has the most generous free-tier rate limits
        provider_order += [p for p in ["groq", "gemini", "xai"] if p not in provider_order]

        for provider in provider_order:
            cfg = self.PROVIDERS[provider]
            api_key = os.getenv(cfg["env_key"])
            if not api_key:
                continue

            # Use preferred_model if supplied and it belongs to this provider,
            # otherwise fall back to the provider default.
            # NOTE: parentheses are required — without them Python parses
            # 'a or b if c else d' as '(a or b) if c else d', not the intent.
            model = (preferred_model or os.getenv("GEMINI_MODEL_NAME")) if provider == "gemini" else None
            model = model or cfg["default_model"]

            try:
                self._client = AsyncOpenAI(
                    api_key=api_key,
                    base_url=cfg["base_url"],
                )
                self.provider   = provider
                self.model_name = model
                print(f"[LLM] Initialized {provider.upper()} → model: {model}")
                return
            except Exception as e:
                print(f"[LLM] Failed to init {provider}: {e}")
                continue

        print("[LLM] WARNING: No valid API key found. Running in MOCK mode.")

    def switch_model(self, model_name: str) -> None:
        """
        Switch to a different model at runtime.
        Determines the provider from the model name prefix.
        """
        normalized = model_name.lower()
        if "gemini" in normalized:
            target_provider = "gemini"
        elif "llama" in normalized or "mixtral" in normalized or "groq" in normalized:
            target_provider = "groq"
        elif "grok" in normalized:
            target_provider = "xai"
        else:
            target_provider = self.provider  # keep current provider

        cfg = self.PROVIDERS.get(target_provider, {})
        api_key = os.getenv(cfg.get("env_key", ""), "")
        if not api_key:
            print(f"[LLM] Cannot switch to {target_provider}: no API key.")
            return

        try:
            self._client = AsyncOpenAI(
                api_key=api_key,
                base_url=cfg["base_url"],
            )
            self.provider   = target_provider
            self.model_name = model_name
            print(f"[LLM] Switched to {target_provider.upper()} → model: {model_name}")
        except Exception as e:
            print(f"[LLM] Switch to {model_name} failed: {e}")

    async def generate(self, prompt: str, max_tokens: int = 512) -> str:
        if self._client is None:
            return f"[MOCK — no LLM configured] Prompt received: {prompt[:80]}..."

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.1,  # Low temperature reduces hallucination
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"[LLM] API call failed ({self.provider}/{self.model_name}): {e}")
            return f"[LLM ERROR] {str(e)}"


# Keep the old class name as an alias for backward compatibility
class GrokLLMWrapper(MultiLLMWrapper):
    """Backward-compatible alias. Now routes through MultiLLMWrapper."""
    def __init__(self) -> None:
        super().__init__()


# ============================================================
# AGENT ORCHESTRATOR
# ============================================================

class AgentOrchestrator:
    """
    Central orchestrator that coordinates all AI agents.
    Manages agent communication, task routing, and workflows.
    """

    def __init__(self):
        self.llm = self._init_llm()

        self.lead_agent    = LeadQualificationAgent(llm=self.llm)
        self.email_agent   = EmailIntelligenceAgent(llm=self.llm)
        self.sales_agent   = SalesPipelineAgent(llm=self.llm)
        self.success_agent = CustomerSuccessAgent(llm=self.llm)
        self.meeting_agent = MeetingSchedulerAgent(llm=self.llm)
        self.analytics_agent = AnalyticsAgent(llm=self.llm)

        self.agents = {
            "lead_qualification": self.lead_agent,
            "email_intelligence": self.email_agent,
            "sales_pipeline":     self.sales_agent,
            "customer_success":   self.success_agent,
            "meeting_scheduler":  self.meeting_agent,
            "analytics":          self.analytics_agent,
            "ask_crm":            AskCRMAgent(llm=self.llm),
        }

    def _init_llm(self) -> MultiLLMWrapper:
        return MultiLLMWrapper()

    def get_agent_status(self) -> Dict[str, Any]:
        return {
            name: {
                "status": "active",
                "provider": self.llm.provider,
                "model": self.llm.model_name,
            }
            for name in self.agents.keys()
        }

    def get_llm_info(self) -> Dict[str, str]:
        return {
            "provider": self.llm.provider,
            "model": self.llm.model_name,
        }

    def switch_model(self, model_name: str) -> Dict[str, str]:
        self.llm.switch_model(model_name)
        # Propagate the new LLM instance to all agents
        for agent in self.agents.values():
            agent.llm = self.llm
        return self.get_llm_info()

    # ========================================================================
    # WORKFLOW: New Lead Processing
    # ========================================================================

    async def process_new_lead(self, lead_data: Dict[str, Any], db: Session):
        """
        Complete workflow for processing a new lead:
        1. Lead Qualification Agent scores and enriches
        2. Email Intelligence Agent drafts welcome email
        3. Meeting Scheduler Agent proposes meeting times
        """

        steps = ["🔍 Agent 1: Identifying lead intent and extracting business criteria..."]
        qualification_result = await self.lead_agent.execute({
            "lead_data": lead_data,
            "db": db
        })
        steps.append("🧲 Agent 1: Lead Qualification successful. Scoring lead quality...")
        steps.append(f"✅ Lead Score: {qualification_result.get('score', 0)}/100")

        # Save to database
        from database.models import Contact
        existing = None
        try:
            if db:
                existing = db.query(Contact).filter(
                    Contact.email == lead_data.get("email")
                ).first()
        except Exception:
            pass

        if not existing:
            try:
                contact = Contact(
                    email=lead_data.get("email"),
                    first_name=lead_data.get("first_name"),
                    last_name=lead_data.get("last_name"),
                    job_title=lead_data.get("job_title"),
                    lead_score=qualification_result.get("score", 0),
                    lead_status=qualification_result.get("routing", {}).get("team", "nurture"),
                    enrichment_data=qualification_result.get("enriched_data"),
                )
                db.add(contact)
                db.commit()
            except Exception as e:
                print(f"[Orchestrator] Could not save contact: {e}")

        if qualification_result.get("score", 0) >= 70:
            steps.append("📧 Agent 2: High Score detected! Drafting personalized welcome sequence...")
            email_task = {
                "email_data": {
                    "from": lead_data.get("email"),
                    "body": f"New high-value lead: {lead_data.get('first_name')} from {lead_data.get('domain', 'unknown company')}",
                    "subject": "Welcome",
                }
            }
            email_result = await self.email_agent.execute(email_task)
            draft = email_result.get("draft_response", "")
            steps.append("✨ Agent 2: Personalized email draft created.")

            # Auto-send via Gmail if authenticated
            try:
                from services.gmail_service import is_authenticated, send_reply
                if is_authenticated() and draft and lead_data.get("email"):
                    send_result = send_reply(
                        to_email=lead_data["email"],
                        subject=f"Welcome to AI CRM, {lead_data.get('first_name', 'there')}!",
                        body=draft,
                    )
                    if send_result.get("success"):
                        steps.append(f"📨 Auto-email SENT to {lead_data['email']} ✅")
                        print(f"[LEAD AUTO-EMAIL] ✅ Sent to {lead_data['email']}")
                    else:
                        steps.append(f"⚠️ Auto-email draft ready but send failed: {send_result.get('error', 'unknown')}")
                        print(f"[LEAD AUTO-EMAIL] ⚠️ Send failed: {send_result}")
                else:
                    steps.append("ℹ️ Gmail not connected — email draft queued for manual review")
            except Exception as e:
                steps.append(f"⚠️ Auto-email error: {e}")
                print(f"[LEAD AUTO-EMAIL] ⚠️ Exception: {e}")

        if qualification_result.get("score", 0) >= 80:
            steps.append("📅 Agent 3: Strategic lead priority! Proposing executive meeting times...")
            meeting_task = {
                "action": "suggest_times",
                "attendees": [lead_data.get("email")],
                "duration": 30,
            }
            await self.meeting_agent.execute(meeting_task)
            steps.append("🎯 Agent 3: Optimal meeting windows identified and shared.")

        qualification_result["workflow_steps"] = steps
        return qualification_result

    # ========================================================================
    # WORKFLOW: Email Processing
    # ========================================================================

    async def process_email(self, email_data: Dict[str, Any], db: Session):
        """
        Process incoming email:
        1. Email Intelligence Agent analyzes sentiment and drafts response
        2. If negative sentiment, alert Customer Success
        3. Create activity record
        """

        analysis_result = await self.email_agent.execute({
            "email_data": email_data
        })

        from database.models import Email
        try:
            email = Email(
                from_email=email_data.get("from"),
                to_email=email_data.get("to"),
                subject=email_data.get("subject"),
                body=email_data.get("body"),
                direction="inbound",
                sentiment=analysis_result.get("sentiment", {}).get("label"),
                sentiment_score=analysis_result.get("sentiment", {}).get("score"),
                category=analysis_result.get("category"),
                priority=analysis_result.get("priority"),
                draft_response=analysis_result.get("draft_response"),
            )
            db.add(email)
            db.commit()
        except Exception as e:
            print(f"[Orchestrator] Could not save email: {e}")

        if analysis_result.get("sentiment", {}).get("score", 5) <= 3:
            print(f"ALERT: Negative email from {email_data.get('from')}")

        return analysis_result

    # ========================================================================
    # WORKFLOW: Deal Analysis
    # ========================================================================

    async def analyze_deal(self, deal_id: str, db: Session):
        """
        Analyze deal health:
        1. Sales Pipeline Agent assesses health and risk
        2. If stalled, Meeting Scheduler suggests follow-up
        3. Update deal record with insights
        """

        analysis_result = await self.sales_agent.execute({
            "deal_id": deal_id,
            "action": "analyze",
            "db": db,
        })

        from database.models import Deal
        try:
            deal = db.query(Deal).filter(Deal.id == deal_id).first()
            if deal:
                deal.health_score = analysis_result.get("health_score", 50)
                deal.is_stalled   = analysis_result.get("is_stalled", False)
                deal.risk_factors = analysis_result.get("risk_factors", [])
                db.commit()
        except Exception as e:
            print(f"[Orchestrator] Could not update deal: {e}")

        if analysis_result.get("is_stalled"):
            meeting_task = {
                "action": "schedule",
                "meeting_type": "follow_up",
                "attendees": [],
                "subject": f"Follow-up: {analysis_result.get('name', deal_id)}",
            }
            await self.meeting_agent.execute(meeting_task)

        return analysis_result

    # ========================================================================
    # WORKFLOW: Customer Health Monitoring
    # ========================================================================

    async def monitor_customer(self, customer_id: str, db: Session):
        """
        Monitor customer health:
        1. Customer Success Agent calculates health score
        2. If churn risk, trigger retention workflow
        3. Identify upsell opportunities
        """

        monitoring_result = await self.success_agent.execute({
            "customer_id": customer_id,
            "action": "monitor",
        })

        from database.models import Customer
        try:
            customer = db.query(Customer).filter(Customer.id == customer_id).first()
            if customer:
                customer.health_score      = monitoring_result.get("health_score", 50)
                customer.churn_risk        = monitoring_result.get("churn_risk", {}).get("level", "low")
                customer.churn_probability = monitoring_result.get("churn_risk", {}).get("probability", 0)
                db.commit()
        except Exception as e:
            print(f"[Orchestrator] Could not update customer: {e}")

        if monitoring_result.get("churn_risk", {}).get("level") in ["high", "critical"]:
            print(f"ALERT: High churn risk for customer {customer_id}")

        return monitoring_result

    # ========================================================================
    # WORKFLOW: Meeting Scheduling
    # ========================================================================

    async def schedule_meeting(self, meeting_request: Dict[str, Any], db: Session):
        """
        Schedule meeting:
        1. Meeting Scheduler finds available times
        2. Creates meeting record
        3. Generates prep materials
        """

        meeting_result = await self.meeting_agent.execute({
            "action": "schedule",
            **meeting_request,
        })

        from database.models import Meeting
        try:
            meeting = Meeting(
                title=meeting_result.get("subject") or meeting_request.get("title"),
                meeting_type=meeting_result.get("type"),
                scheduled_at=meeting_result.get("scheduled_time"),
                duration_minutes=meeting_result.get("duration_minutes"),
                attendees=meeting_result.get("attendees"),
                agenda=meeting_result.get("agenda"),
                prep_materials=meeting_result.get("prep_materials"),
                status="scheduled",
            )
            db.add(meeting)
            db.commit()
        except Exception as e:
            print(f"[Orchestrator] Could not save meeting: {e}")

        return meeting_result

    # ========================================================================
    # WORKFLOW: Analytics Dashboard
    # ========================================================================

    async def generate_dashboard(self, category: str, db: Session):
        """
        Generate analytics dashboard:
        1. Analytics Agent collects metrics
        2. Calculates KPIs
        3. Generates insights
        """

        dashboard = await self.analytics_agent.execute({
            "action": "dashboard",
            "category": category,
            "db": db,
        })

        return dashboard

    # ========================================================================
    # UNIFIED QUERY HANDLER
    # ========================================================================

    # ---- Fast keyword-based intent router (no LLM call needed) ----
    @staticmethod
    def _classify_intent_keywords(prompt: str) -> str:
        """Classify query intent using keywords — avoids spending an LLM call on routing."""
        p = prompt.lower()
        if any(w in p for w in ['deal', 'pipeline', 'revenue', 'stage', 'closing', 'won', 'lost', 'stalled']):
            return 'sales'
        if any(w in p for w in ['lead', 'prospect', 'score', 'qualify', 'qualification', 'contact']):
            return 'leads'
        if any(w in p for w in ['customer', 'churn', 'health', 'mrr', 'arr', 'retention', 'upsell', 'account']):
            return 'customers'
        return 'analytics'  # default

    async def handle_user_query(self, prompt: str, db: Session) -> Dict[str, Any]:
        """
        Unified entry point for user natural language queries.
        1. Keyword-based intent classification (NO LLM call — saves rate limit quota)
        2. Routes to AskCRMAgent for SQL generation + execution (1 LLM call)
        3. Returns data, SQL, steps, and summary (1 LLM call for summary)
        """
        steps: List[str] = []
        steps.append("🔍 Classifying user intent and extracting entities...")

        # Fast keyword routing — no LLM call, zero latency, zero tokens consumed
        category = self._classify_intent_keywords(prompt)
        steps.append(f"🎯 Intent identified as: {category.upper()} (keyword match). Dispatching CRM SQL Agent.")

        data: List[Any] = []
        sql  = ""
        summary = ""
        charts: List[Any] = []

        try:
            steps.append("🤖 Initializing Ask CRM Agent for SQL generation & execution...")
            ask_agent = self.agents["ask_crm"]
            ask_agent.llm = self.llm          # ensure latest LLM
            res = await ask_agent.execute({"prompt": prompt, "db": db})
            data    = res.get("data", [])
            sql     = res.get("sql", "")
            summary = res.get("summary", "")
            steps.extend(res.get("steps", []))

            if not summary:
                steps.append("🧩 Synthesizing narrative response...")
                # Trim data to reduce token usage
                data_snippet = str(data[:10])[:300]
                summary_prompt = (
                    f'CRM query: "{prompt[:120]}". '
                    f'Result ({len(data)} rows): {data_snippet}. '
                    f'Write a 1–2 sentence professional summary of the results.'
                )
                summary = await self.llm.generate(summary_prompt, max_tokens=200)

            return {
                "status": "success",
                "data": data,
                "summary_text": summary,
                "workflow_steps": steps,
                "dashboard_config": {
                    "charts": charts,
                    "suggested_queries": [
                        "Show me stalled deals",
                        "Top customers by MRR",
                        "Which agents ran today?"
                    ],
                },
                "metadata": {
                    "row_count": len(data),
                    "sql_used": sql,
                    "execution_time_ms": 200,
                },
            }

        except Exception as e:
            print(f"[Orchestrator] Query failed: {e}")
            return {
                "status": "error",
                "message": f"Failed to process query: {str(e)}",
            }

    # ========================================================================
    # AUTOMATED WORKFLOWS (Run Periodically)
    # ========================================================================

    async def run_daily_workflows(self, db: Session):
        """Run daily automated workflows"""

        from database.models import Deal
        active_deals = db.query(Deal).filter(
            Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation'])
        ).all()

        for deal in active_deals:
            await self.analyze_deal(str(deal.id), db)

        from database.models import Customer
        customers = db.query(Customer).all()

        for customer in customers:
            await self.monitor_customer(str(customer.id), db)

        await self.analytics_agent.execute({
            "action": "report",
            "report_type": "weekly_sales",
        })

        print("Daily workflows completed")

    async def run_weekly_workflows(self, db: Session):
        """Run weekly automated workflows"""

        await self.analytics_agent.execute({
            "action": "report",
            "report_type": "monthly_executive",
        })

        await self.analytics_agent.execute({
            "action": "report",
            "report_type": "pipeline_health",
        })

        print("Weekly workflows completed")
