from typing import Dict, Any, cast, Callable, Optional
from sqlalchemy.orm import Session
import asyncio
import os
import threading
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


class GrokLLMWrapper:
    def __init__(self) -> None:
        api_key = os.getenv("XAI_API_KEY")
        self.model_name: str = os.getenv("XAI_MODEL_NAME", "grok-2-1212")
        self.base_url: str = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")
        self._client: Optional[AsyncOpenAI] = None
        
        if not api_key:
            print("WARNING: XAI_API_KEY is not set in environment.")
            return

        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=self.base_url
        )

    async def generate(self, prompt: str) -> str:
        if self._client is None:
            return "Mock Grok response (missing configuration)"

        try:
            response = await self._client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"ERROR: xAI API call failed: {e}")
            return f"Error: Could not reach Grok. (Details: {str(e)})"


class AgentOrchestrator:
    """
    Central orchestrator that coordinates all AI agents
    Manages agent communication, task routing, and workflows
    """

    def __init__(self):
        # Initialize LLM (placeholder - use actual LLM client)
        self.llm = self._init_llm()

        # Initialize all agents
        self.lead_agent = LeadQualificationAgent(llm=self.llm)
        self.email_agent = EmailIntelligenceAgent(llm=self.llm)
        self.sales_agent = SalesPipelineAgent(llm=self.llm)
        self.success_agent = CustomerSuccessAgent(llm=self.llm)
        self.meeting_agent = MeetingSchedulerAgent(llm=self.llm)
        self.analytics_agent = AnalyticsAgent(llm=self.llm)

        self.agents = {
            "lead_qualification": self.lead_agent,
            "email_intelligence": self.email_agent,
            "sales_pipeline": self.sales_agent,
            "customer_success": self.success_agent,
            "meeting_scheduler": self.meeting_agent,
            "analytics": self.analytics_agent,
            "ask_crm": AskCRMAgent(llm=self.llm)
        }

    def _init_llm(self):
        """Initialize LLM client using Grok"""
        return GrokLLMWrapper()

    def get_agent_status(self) -> Dict[str, str]:
        """Get status of all agents"""
        return {
            name: "active" for name in self.agents.keys()
        }

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

        # Step 1: Qualify lead
        steps = ["🔍 Agent 1: Identifying lead intent and extracting business criteria..."]
        qualification_result = await self.lead_agent.execute({
            "lead_data": lead_data,
            "db": db
        })
        steps.append("🧲 Agent 1: Lead Qualification successful. Scoring lead quality...")
        steps.append(f"✅ Lead Score: {qualification_result.get('score', 0)}/100")

        # Save to database
        from database.models import Contact
        contact = Contact(
            email=lead_data.get("email"),
            first_name=lead_data.get("first_name"),
            last_name=lead_data.get("last_name"),
            job_title=lead_data.get("job_title"),
            lead_score=qualification_result.get("score", 0),
            lead_status=qualification_result.get("routing", {}).get("team", "nurture"),
            enrichment_data=qualification_result.get("enriched_data")
        )
        db.add(contact)
        db.commit()

        # Step 2: Draft welcome email (if high score)
        if qualification_result.get("score", 0) >= 70:
            steps.append("📧 Agent 2: High Score detected! Drafting personalized welcome sequence...")
            email_task = {
                "email_data": {
                    "from": lead_data.get("email"),
                    "body": f"New high-value lead: {lead_data.get('first_name')}",
                    "subject": "Welcome"
                }
            }
            await self.email_agent.execute(email_task)
            steps.append("✨ Agent 2: Personalized email draft created and queued for review.")

        # Step 3: Suggest meeting (if very high score)
        if qualification_result.get("score", 0) >= 80:
            steps.append("📅 Agent 3: Strategic lead priority! Proposing executive meeting times...")
            meeting_task = {
                "action": "suggest_times",
                "attendees": [lead_data.get("email")],
                "duration": 30
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

        # Analyze email
        analysis_result = await self.email_agent.execute({
            "email_data": email_data
        })

        # Save to database
        from database.models import Email
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
            draft_response=analysis_result.get("draft_response")
        )
        db.add(email)
        db.commit()

        # If negative, alert customer success
        if analysis_result.get("sentiment", {}).get("score", 5) <= 3:
            # Trigger customer success workflow
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

        # Analyze deal
        analysis_result = await self.sales_agent.execute({
            "deal_id": deal_id,
            "action": "analyze"
        })

        # Update deal in database
        from database.models import Deal
        deal = db.query(Deal).filter(Deal.id == deal_id).first()
        if deal:
            deal.health_score = analysis_result.get("health_score", 50)
            deal.is_stalled = analysis_result.get("is_stalled", False)
            deal.risk_factors = analysis_result.get("risk_factors", [])
            db.commit()

        # If stalled, schedule follow-up
        if analysis_result.get("is_stalled"):
            meeting_task = {
                "action": "schedule",
                "meeting_type": "follow_up",
                "attendees": [deal.contact.email] if deal.contact else [],
                "subject": f"Follow-up: {deal.name}"
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

        # Monitor customer
        monitoring_result = await self.success_agent.execute({
            "customer_id": customer_id,
            "action": "monitor"
        })

        # Update customer in database
        from database.models import Customer
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer:
            customer.health_score = monitoring_result.get("health_score", 50)
            customer.churn_risk = monitoring_result.get("churn_risk", {}).get("level", "low")
            customer.churn_probability = monitoring_result.get("churn_risk", {}).get("probability", 0)
            db.commit()

        # If high churn risk, alert team
        if monitoring_result.get("churn_risk", {}).get("level") in ["high", "critical"]:
            print(f"ALERT: High churn risk for customer {customer_id}")
            # Could trigger email, Slack notification, etc.

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

        # Schedule meeting
        meeting_result = await self.meeting_agent.execute({
            "action": "schedule",
            **meeting_request
        })

        # Save to database
        from database.models import Meeting
        meeting = Meeting(
            title=meeting_result.get("subject"),
            meeting_type=meeting_result.get("type"),
            scheduled_at=meeting_result.get("scheduled_time"),
            duration_minutes=meeting_result.get("duration_minutes"),
            attendees=meeting_result.get("attendees"),
            agenda=meeting_result.get("agenda"),
            prep_materials=meeting_result.get("prep_materials"),
            status="scheduled"
        )
        db.add(meeting)
        db.commit()

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
            "category": category
        })

        return dashboard

    async def handle_user_query(self, prompt: str, db: Session) -> Dict[str, Any]:
        """
        Unified entry point for user natural language queries.
        1. Uses LLM to classify intent
        2. Routes to appropriate agent
        3. Aggregates results for the frontend
        """
        steps = []
        prompt_lower = prompt.lower()
        steps.append("🔍 Agent 1: Identifying user intent and extracting entities...")
        
        # 1. Intent Classification
        routing_prompt = f"""
        You are an AI CRM Director. Classify the user query into ONE of these categories:
        - "analytics": Metrics, KPIs, trends, total counts, growth, overview.
        - "sales": Deals, pipeline, revenue, closing dates, specific deal names.
        - "leads": New prospects, qualification, scoring, specific lead emails.
        - "customers": Retention, churn, health, satisfaction, specific account names.

        User Query: "{prompt}"

        Return ONLY the word of the category. No punctuation.
        """
        
        category = "analytics"
        try:
            category = await self.llm.generate(routing_prompt)
            category = category.strip().lower()
            steps.append(f"🎯 Intent identified as: {category.upper()}. Dispatching appropriate CRM Agent.")
        except Exception as e:
            print(f"ERROR: Intent classification failed: {e}")
            steps.append("⚠️ Intent classification ambiguous, defaulting to Analytics Agent.")

        # Initialize response variables
        data = []
        sql = ""
        summary = ""
        charts = []

        try:
            # 2. Route to appropriate agent logic (Simplified for now, delegated to Ask CRM for data)
            async def run_ask_crm_workflow():
                 steps.append("🤖 Initializing Ask CRM Agent for complex data extraction...")
                 ask_agent = self.agents["ask_crm"]
                 res = await ask_agent.execute({"prompt": prompt, "db": db})
                 return res
                 
            # If the user specifically asked for a custom view, trigger the Ask CRM Agent
            if category in ["sales", "leads", "customers"] or any(word in prompt_lower for word in ["list", "find", "search", "show", "custom"]):
                 ask_res = await run_ask_crm_workflow()
                 data = ask_res.get("data", [])
                 sql = ask_res.get("sql", "")
                 summary = ask_res.get("summary", "")
                 steps.extend(ask_res.get("steps", []))

            # 4. Fallback Results for Summary if missing
            if not summary:
                steps.append("🧩 Reasoning Agent synthesizing final narrative response...")
                summary_prompt = f"""
                Summarize the following CRM data for the user in a professional, concise, and helpful tone.
                Data Snippet: {str(data)[:200]}
                Query: "{prompt}"
                Return ONLY the summary text (max 2 sentences).
                """
                summary = await self.llm.generate(summary_prompt)

            return {
                "status": "success",
                "data": data,
                "summary_text": summary,
                "workflow_steps": steps,
                "dashboard_config": {
                    "charts": charts,
                    "suggested_queries": ["Show me stalled deals", "Qualify new leads", "Customer health report"]
                },
                "metadata": {
                    "row_count": len(data),
                    "sql_used": sql,
                    "execution_time_ms": 200
                }
            }

        except Exception as e:
            print(f"ERROR: Orchestration failed: {e}")
            return {
                "status": "error",
                "message": f"Failed to process query: {str(e)}"
            }


    # ========================================================================
    # AUTOMATED WORKFLOWS (Run Periodically)
    # ========================================================================

    async def run_daily_workflows(self, db: Session):
        """Run daily automated workflows"""

        # 1. Check all deals for stalled status
        from database.models import Deal
        active_deals = db.query(Deal).filter(
            Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation'])
        ).all()

        for deal in active_deals:
            await self.analyze_deal(str(deal.id), db)

        # 2. Monitor all customers
        from database.models import Customer
        customers = db.query(Customer).all()

        for customer in customers:
            await self.monitor_customer(str(customer.id), db)

        # 3. Generate daily metrics
        await self.analytics_agent.execute({
            "action": "report",
            "report_type": "weekly_sales"
        })

        print("Daily workflows completed")

    async def run_weekly_workflows(self, db: Session):
        """Run weekly automated workflows"""

        # Generate executive report
        report = await self.analytics_agent.execute({
            "action": "report",
            "report_type": "monthly_executive"
        })

        # Analyze pipeline health
        pipeline_health = await self.analytics_agent.execute({
            "action": "report",
            "report_type": "pipeline_health"
        })

        print("Weekly workflows completed")
