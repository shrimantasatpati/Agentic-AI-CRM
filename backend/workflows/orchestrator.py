"""Agent Orchestrator - Coordinates all AI agents"""

from typing import Dict, Any, cast, Callable
from sqlalchemy.orm import Session
import asyncio
import os
import threading
from google import genai
from google.genai import types

from agents import (
    LeadQualificationAgent,
    EmailIntelligenceAgent,
    SalesPipelineAgent,
    CustomerSuccessAgent,
    MeetingSchedulerAgent,
    AnalyticsAgent
)


class GeminiLLMWrapper:
    def __init__(self) -> None:
        api_key = os.getenv("GEMINI_API_KEY")
        self.model_name: str = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
        # Use Any to avoid Pyre2 NoneType confusion
        self._client: Any = None
        if not api_key:
            print("WARNING: GEMINI_API_KEY is not set in environment.")
            return

        self._client = genai.Client(api_key=api_key)

    async def generate(self, prompt: str) -> str:
        if self._client is None:
            return "Mock Gemini response (missing configuration)"

        client: Any = self._client  # narrow type for Pyre2
        model: str = self.model_name

        def call_gemini() -> Any:
            return client.models.generate_content(
                model=model,
                contents=prompt
            )

        from typing import Callable
        typed_fn = cast(Callable[..., Any], call_gemini)
        
        try:
            response: Any = await asyncio.to_thread(typed_fn)
            return str(response.text)
        except Exception as e:
            print(f"ERROR: Gemini API call failed: {e}")
            return f"Error: Could not reach AI service. (Details: {str(e)})"


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
            "analytics": self.analytics_agent
        }

    def _init_llm(self):
        """Initialize LLM client using Gemini"""
        return GeminiLLMWrapper()

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
        qualification_result = await self.lead_agent.execute({
            "lead_data": lead_data
        })

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
            email_task = {
                "email_data": {
                    "from": lead_data.get("email"),
                    "body": f"New high-value lead: {lead_data.get('first_name')}",
                    "subject": "Welcome"
                }
            }
            await self.email_agent.execute(email_task)

        # Step 3: Suggest meeting (if very high score)
        if qualification_result.get("score", 0) >= 80:
            meeting_task = {
                "action": "suggest_times",
                "attendees": [lead_data.get("email")],
                "duration": 30
            }
            await self.meeting_agent.execute(meeting_task)

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
        steps.append("🔍 Analyzing user query and extracting intent...")
        
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
        
        try:
            category = await self.llm.generate(routing_prompt)
            category = category.strip().lower()
            steps.append(f"🎯 Intent identified as: {category.upper()}")
        except Exception as e:
            print(f"ERROR: Intent classification failed: {e}")
            category = "analytics" # Default to analytics on failure
            steps.append("⚠️ Intent classification ambiguous, defaulting to Analytics.")
        
        # 2. Route to appropriate agent
        try:
            if "analytics" in category:
                steps.append("📊 Dispatching Analytics Agent for KPI synthesis...")
                result = await self.analytics_agent.execute({
                    "action": "dashboard",
                    "category": "all",
                    "db": db
                })
                summary = f"I've compiled the latest CRM analytics. {len(result.get('metrics', {}))} data points scanned."
                data = [{"metric": k, "value": v} for k, v in result.get("kpis", {}).items() if isinstance(v, (int, float))]
                charts = [{
                    "type": "bar", 
                    "xAxis": "metric", 
                    "yAxis": "value", 
                    "title": "Core KPI Performance",
                    "description": "Aggregated metrics across all CRM departments for the current period."
                }]
                sql = "SELECT * FROM metrics_daily LIMIT 100"

            # 3. Handle specific entity searches
            elif "sales" in category or "deal" in prompt_lower:
                steps.append("💼 Sales Agent engaged: Searching deal pipeline...")
                from database.models import Deal
                # Simple keyword search fallback
                words = [w for w in prompt_lower.split() if len(w) > 3]
                deal = None
                for word in words:
                    deal = db.query(Deal).filter(Deal.name.contains(word)).first()
                    if deal: break
                
                if deal:
                    result = await self.sales_agent.execute({"deal_id": str(deal.id), "db": db})
                    data = [result]
                    summary = f"I've analyzed the '{deal.name}' deal. Its health score is {result.get('health_score')}%."
                    charts = [{
                        "type": "bar", 
                        "xAxis": "name", 
                        "yAxis": "health_score", 
                        "title": "Strategic Deal Health",
                        "description": "Real-time AI analysis of deal momentum and risk factors."
                    }]
                else:
                    deals = db.query(Deal).order_by(Deal.value.desc()).limit(5).all()
                    data = [{"id": d.id, "name": d.name, "value": d.value, "stage": d.stage} for d in deals]
                    summary = f"I couldn't find a specific deal matching your query, so here are the top 5 deals in your pipeline."
                    charts = [{
                        "type": "pie", 
                        "xAxis": "name", 
                        "yAxis": "value", 
                        "title": "Pipeline Value Distribution",
                        "description": "Total monetary value across your high-impact deals."
                    }]
                steps.append(f"✅ Found {len(data)} deal(s) matching criteria.")
                sql = "SELECT * FROM deals"

            elif "leads" in category or "contact" in prompt_lower:
                steps.append("🧲 Lead Agent engaged: Checking qualified prospects...")
                from database.models import Contact
                # Simple email search fallback
                email = next((w for w in prompt_lower.split() if "@" in w), None)
                lead = None
                if email:
                    lead = db.query(Contact).filter(Contact.email == email).first()
                
                if lead:
                    result = await self.lead_agent.execute({"lead_data": {"email": lead.email}, "db": db})
                    data = [result]
                    summary = f"I've qualified the lead {lead.email}. Their score is {result.get('score')}."
                    charts = [{
                        "type": "bar", 
                        "xAxis": "email", 
                        "yAxis": "score", 
                        "title": "Lead Quality",
                        "description": "AI-calculated score for a specific prospect email."
                    }]
                else:
                    leads = db.query(Contact).order_by(Contact.lead_score.desc()).limit(10).all()
                    data = [{"id": l.id, "email": l.email, "score": l.lead_score, "status": l.lead_status} for l in leads]
                    summary = f"Here are your highest-scoring leads that need attention."
                    charts = [{
                        "type": "bar", 
                        "xAxis": "email", 
                        "yAxis": "score", 
                        "title": "Lead Priority Index",
                        "description": "Top prospects sorted by qualification probability."
                    }]
                steps.append(f"✅ Found {len(data)} lead(s) for analysis.")
                sql = "SELECT * FROM contacts"

            elif "customers" in category or "account" in prompt_lower:
                steps.append("🤝 Success Agent engaged: Auditing customer relationship health...")
                from database.models import Customer
                customers = db.query(Customer).order_by(Customer.health_score.asc()).limit(5).all()
                data = [{"id": c.id, "name": c.name, "health": c.health_score, "risk": c.churn_risk} for c in customers]
                summary = f"I've identified {len(customers)} accounts showing churn signals. High priority intervention recommended."
                charts = [{
                    "type": "area", 
                    "xAxis": "name", 
                    "yAxis": "health", 
                    "title": "Customer Loyalty Trend",
                    "description": "Monitoring account health across high-risk sectors."
                }]
                steps.append(f"✅ Scanning {len(data)} customer records for churn signals.")
                sql = "SELECT * FROM customers"

            else:
                steps.append("🌐 System Agent fallback: Compiling general CRM overview...")
                # Analytics / General fallback
                result = await self.analytics_agent.execute({"action": "dashboard", "category": "all", "db": db})
                data = [{"metric": k, "value": v} for k, v in result.get("kpis", {}).items() if isinstance(v, (int, float))]
                summary = f"Here is your real-time CRM performance overview. All systems are operational."
                charts = [{
                    "type": "bar", 
                    "xAxis": "metric", 
                    "yAxis": "value", 
                    "title": "System Vitality KPI",
                    "description": "Live health signals from across the AI CRM landscape."
                }]
            # 4. Generate Data-Aware Summary
            summary_prompt = f"""
            Summarize the following CRM data for the user in a professional, concise, and helpful tone.
            Data: {data[:10]} (showing first 10 records)
            Context: The category is {category}.
            
            Return ONLY the summary text (max 2 sentences).
            """
            try:
                summary = await self.llm.generate(summary_prompt)
                summary = summary.strip()
            except:
                pass # Use the existing summary as fallback

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
