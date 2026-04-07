"""Lead Qualification Agent - Scores and routes incoming leads"""

from typing import Dict, Any
from .base_agent import BaseAgent
import re
import json


class LeadQualificationAgent(BaseAgent):
    """
    Autonomous agent that:
    - Scores incoming leads automatically
    - Routes high-value prospects to sales
    - Enriches contact data from public sources
    - Identifies buying signals
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="LeadQualificationAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        # Scoring criteria weights
        self.scoring_weights = {
            "company_size": 0.25,
            "job_title": 0.25,
            "industry": 0.20,
            "engagement": 0.15,
            "budget_signals": 0.15
        }

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute lead qualification workflow"""
        lead_data = task.get("lead_data", {})
        db = task.get("db") # Extract db session
        
        email = lead_data.get("email")
        await self.log_activity("lead_received", {"email": email})

        # Step 1: Enrich lead data (if it already exists in DB, fetch it)
        if db:
            from database.models import Contact
            existing_contact = db.query(Contact).filter(Contact.email == email).first()
            if existing_contact:
                lead_data.update({
                    "email": existing_contact.email,
                    "first_name": existing_contact.first_name,
                    "last_name": existing_contact.last_name,
                    "job_title": existing_contact.job_title,
                    "lead_status": existing_contact.lead_status
                })

        # Step 2: Web enrichment via use_tool() — search for company context
        domain = lead_data.get("email", "").split("@")[-1] if "@" in lead_data.get("email", "") else ""
        company_name = lead_data.get("company") or lead_data.get("company_name") or domain
        web_context = {}
        if company_name or domain:
            try:
                web_context = await self.use_tool(
                    "web_search",
                    company=company_name or domain,
                    query=f"{company_name or domain} company industry CRM"
                )
                await self.log_activity("web_enrichment", {
                    "query": company_name or domain,
                    "found": bool(web_context.get("summary"))
                })
            except Exception as _e:
                pass   # Never block lead qualification due to search failure

        # OPTIMIZED: Single LLM call returns enrichment + score + signals together
        enriched_data, score, signals = await self._qualify_lead_single_call(lead_data, web_context)

        # Step 4: Route to appropriate team (rule-based — no LLM needed)
        routing = await self.route_lead(score, signals)

        # Step 5: Update DB if available
        if db:
            from database.models import Contact
            contact = db.query(Contact).filter(Contact.email == email).first()
            if contact:
                contact.lead_status = routing.get("team", "unqualified")
                db.commit()

        # Step 6: Publish event for other agents
        await self.publish_event("lead_qualified", {
            "email": email,
            "score": score,
            "routing": routing,
            "signals": signals
        })

        result = {
            "email": email,
            "original_data": lead_data,
            "enriched_data": enriched_data,
            "score": score,
            "signals": signals,
            "routing": routing
        }

        await self.log_activity("lead_qualified", result)

        return result

    async def _qualify_lead_single_call(self, lead_data: Dict[str, Any], web_context: Dict[str, Any] = {}):
        """Single optimized LLM call: enrichment + score + signals in one structured JSON response"""
        email = lead_data.get("email", "")
        domain = email.split("@")[-1] if "@" in email else ""

        # Build web context section for the prompt (from use_tool result)
        web_summary = web_context.get("summary", "") if web_context else ""
        web_topics  = web_context.get("related_topics", []) if web_context else []
        web_section = ""
        if web_summary and "[LLM" not in web_summary and "unavailable" not in web_summary:
            web_section = f"\nWeb Research Context (from live search):\n{web_summary}"
            if web_topics:
                web_section += f"\nRelated: {'; '.join(web_topics[:3])}"

        combined_prompt = f"""Analyze this lead and return a single JSON object with exactly these fields:

Lead Data:
Email: {email}
Name: {lead_data.get('name', lead_data.get('first_name', 'Unknown'))}
Company Domain: {domain}
Job Title: {lead_data.get('job_title', 'Unknown')}
{web_section}

Return ONLY valid JSON in this exact format:
{{
  "company_size": "small|medium|large|enterprise",
  "industry": "Technology|Finance|Healthcare|Retail|Other",
  "seniority": "entry|mid|senior|executive",
  "budget_likelihood": "low|medium|high",
  "score": <integer 0-100>,
  "signals": ["signal1", "signal2", "signal3"]
}}

Scoring guide: Enterprise+Executive+Tech = 80-100, Mid-market = 50-79, SMB = 30-49, Low-value = 0-29.
Use the web research context to improve accuracy if available.
Signals: identify buying intent indicators from email domain, job title, and web context."""

        raw = await self.think(combined_prompt)

        # Parse JSON result
        try:
            # Extract JSON block even if wrapped in markdown
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            parsed = json.loads(json_match.group() if json_match else raw)
        except Exception:
            parsed = {}

        enriched = {
            **lead_data,
            "domain": domain,
            "company_size": parsed.get("company_size", "unknown"),
            "industry": parsed.get("industry", "unknown"),
            "seniority": parsed.get("seniority", "unknown"),
            "budget_likelihood": parsed.get("budget_likelihood", "unknown"),
            "enriched_at": self._get_timestamp(),
        }
        score = min(100, max(0, int(parsed.get("score", 50))))
        signals = parsed.get("signals", [])
        if isinstance(signals, str):
            signals = [s.strip() for s in signals.split("\n") if s.strip()]

        return enriched, score, signals

    async def enrich_lead(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich lead data from public sources"""
        email = lead_data.get("email", "")

        # Extract company domain from email
        domain = email.split("@")[-1] if "@" in email else ""

        # Use LLM to enrich data
        enrichment_prompt = f"""
        Analyze this lead and provide enrichment data:

        Email: {email}
        Name: {lead_data.get('name', 'Unknown')}
        Company Domain: {domain}

        Provide:
        1. Likely company size (small/medium/large/enterprise)
        2. Industry classification
        3. Job title seniority (entry/mid/senior/executive)
        4. Budget likelihood (low/medium/high)

        Return as JSON.
        """

        enrichment = await self.think(enrichment_prompt)

        # Merge original + enriched data
        enriched = {**lead_data}
        enriched["domain"] = domain
        enriched["enrichment"] = enrichment
        enriched["enriched_at"] = self._get_timestamp()

        return enriched

    async def score_lead(self, lead_data: Dict[str, Any]) -> int:
        """Score lead from 0-100"""

        scoring_prompt = f"""
        Score this lead from 0-100 based on qualification criteria:

        Lead Data:
        {lead_data}

        Scoring Criteria:
        - Company size (25%): Enterprise > Large > Medium > Small
        - Job title (25%): Executive > Director > Manager > Individual Contributor
        - Industry (20%): Tech, Finance, Healthcare = high value
        - Engagement (15%): Multiple touchpoints, content downloads
        - Budget signals (15%): Mentions pricing, demo requests, timeline questions

        Return ONLY the numeric score (0-100).
        """

        score_text = await self.think(scoring_prompt)

        # Extract numeric score
        score = self._extract_score(score_text)

        return score

    async def identify_buying_signals(self, lead_data: Dict[str, Any]) -> list:
        """Identify signals that indicate buying intent"""

        signals_prompt = f"""
        Identify buying signals from this lead data:

        {lead_data}

        Look for:
        - Timeline mentions ("need by Q4", "urgent")
        - Budget questions ("pricing", "cost")
        - Demo/trial requests
        - Comparison shopping
        - Decision-maker involvement
        - Pain point mentions

        Return list of identified signals.
        """

        signals_text = await self.think(signals_prompt)

        # Parse signals
        signals = [s.strip() for s in signals_text.split("\n") if s.strip()]

        return signals

    async def route_lead(self, score: int, signals: list) -> Dict[str, Any]:
        """Route lead to appropriate sales team"""

        if score >= 80:
            team = "Enterprise Sales"
            priority = "high"
        elif score >= 60:
            team = "Mid-Market Sales"
            priority = "medium"
        elif score >= 40:
            team = "SMB Sales"
            priority = "medium"
        else:
            team = "Marketing Nurture"
            priority = "low"

        # High priority if urgent signals
        urgent_keywords = ["urgent", "asap", "immediately", "this week"]
        if any(keyword in " ".join(signals).lower() for keyword in urgent_keywords):
            priority = "high"

        routing = {
            "team": team,
            "priority": priority,
            "recommended_action": self._get_recommended_action(score, signals),
            "sla_hours": 24 if priority == "high" else 48 if priority == "medium" else 72
        }

        return routing

    def _extract_score(self, text: str) -> int:
        """Extract numeric score from LLM response"""
        # Look for number 0-100
        import re
        match = re.search(r'\b(\d{1,3})\b', text)
        if match:
            score = int(match.group(1))
            return min(100, max(0, score))
        return 50  # Default medium score

    def _get_recommended_action(self, score: int, signals: list) -> str:
        """Get recommended next action"""
        if score >= 80:
            return "Schedule executive demo within 24 hours"
        elif score >= 60:
            return "Send personalized email with case studies"
        elif score >= 40:
            return "Add to nurture campaign"
        else:
            return "Add to monthly newsletter"

    def _get_timestamp(self) -> str:
        """Get current timestamp"""
        from datetime import datetime
        return datetime.utcnow().isoformat() + "Z"
