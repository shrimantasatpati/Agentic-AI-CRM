"""Sales Pipeline Agent - Tracks deals and predicts close probability"""

from typing import Dict, Any, List
from .base_agent import BaseAgent
from datetime import datetime, timedelta


class SalesPipelineAgent(BaseAgent):
    """
    Autonomous agent that:
    - Tracks deal progress through pipeline
    - Predicts close probability
    - Identifies stalled deals
    - Recommends next actions to move deals forward
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="SalesPipelineAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        self.pipeline_stages = [
            "prospecting",
            "qualification",
            "proposal",
            "negotiation",
            "closed_won",
            "closed_lost"
        ]

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute sales pipeline analysis"""
        deal_id = task.get("deal_id")
        action = task.get("action", "analyze")
        db = task.get("db") # Extract db session

        if action == "analyze":
            return await self.analyze_deal(deal_id, db)
        elif action == "update_stage":
            return await self.update_deal_stage(deal_id, task.get("new_stage"), db)
        elif action == "check_stalled":
            return await self.check_stalled_deals(db)
        else:
            return {"error": "Unknown action"}

    async def analyze_deal(self, deal_id: str, db: Any = None) -> Dict[str, Any]:
        """Comprehensive deal analysis"""
        await self.log_activity("analyzing_deal", {"deal_id": deal_id})

        # Get deal data
        deal_data = await self._get_deal_data(deal_id, db)

        if "error" in deal_data:
            return deal_data

        # OPTIMIZED: Single LLM call returns health_score + close_probability + next_actions
        health_score, close_probability, next_actions = await self._analyze_deal_single_call(deal_data)

        # Check if stalled (rule-based — no LLM needed)
        is_stalled = await self.is_deal_stalled(deal_data)

        # Forecast close date (rule-based — no LLM needed)
        forecast_date = await self.forecast_close_date(deal_data, close_probability)

        result = {
            "deal_id": deal_id,
            "name": deal_data.get("name"),
            "health_score": health_score,
            "close_probability": close_probability,
            "is_stalled": is_stalled,
            "next_actions": next_actions,
            "forecast_close_date": forecast_date,
            "risk_factors": await self.identify_risk_factors(deal_data)
        }

        # Update DB if available
        if db:
            from database.models import Deal
            deal = db.query(Deal).filter(Deal.id == deal_id).first()
            if deal:
                deal.is_stalled = is_stalled
                # Health score is now dynamic, not stored in DB
                db.commit()

        # Publish event for alerts
        if health_score < 50 or is_stalled:
            await self.publish_event("deal_at_risk", {
                "deal_id": deal_id,
                "health_score": health_score,
                "stalled": is_stalled
            })

        await self.log_activity("deal_analyzed", result)

        return result

    async def _analyze_deal_single_call(self, deal_data: Dict[str, Any]):
        """Single optimized LLM call: health_score + close_probability + actions in one JSON response"""
        import json, re

        combined_prompt = f"""Analyze this sales deal and return ONLY a valid JSON object:

Deal:
- Value: ${deal_data.get('value', 0):,}
- Stage: {deal_data.get('stage')}
- Days in stage: {deal_data.get('days_in_stage', 0)}
- Last contact: {deal_data.get('last_contact_days_ago', 0)} days ago
- Decision maker engaged: {deal_data.get('decision_maker_engaged', False)}
- Budget confirmed: {deal_data.get('budget_confirmed', False)}
- Stage close rate: {self._get_stage_close_rate(deal_data.get('stage'))}%

Return exactly:
{{
  "health_score": <integer 0-100>,
  "close_probability": <integer 0-100>,
  "next_actions": ["action1", "action2", "action3"]
}}"""

        raw = await self.think(combined_prompt)

        try:
            json_match = re.search(r'\{{.*\}}', raw, re.DOTALL)
            parsed = json.loads(json_match.group() if json_match else raw)
        except Exception:
            parsed = {}

        health_score    = min(100, max(0, int(parsed.get("health_score", 50))))
        close_probability = min(100, max(0, int(parsed.get("close_probability", 50))))
        next_actions    = parsed.get("next_actions", [])
        if isinstance(next_actions, str):
            next_actions = [s.strip() for s in next_actions.split("\n") if s.strip()]

        return health_score, close_probability, next_actions


    async def calculate_health_score(self, deal_data: Dict[str, Any]) -> int:
        """Calculate deal health score (0-100)"""

        health_prompt = f"""
        Calculate a health score (0-100) for this sales deal:

        Deal Information:
        - Value: ${deal_data.get('value', 0):,}
        - Stage: {deal_data.get('stage')}
        - Days in current stage: {deal_data.get('days_in_stage', 0)}
        - Last contact: {deal_data.get('last_contact_days_ago', 0)} days ago
        - Engagement level: {deal_data.get('engagement_level', 'unknown')}
        - Decision maker engaged: {deal_data.get('decision_maker_engaged', False)}
        - Competitor activity: {deal_data.get('competitor_activity', 'unknown')}
        - Budget confirmed: {deal_data.get('budget_confirmed', False)}

        Scoring criteria:
        - Recent engagement (30%)
        - Stage progression (25%)
        - Decision maker involvement (20%)
        - Budget/timeline clarity (15%)
        - Competitor risk (10%)

        Return ONLY the numeric score (0-100).
        """

        score_text = await self.think(health_prompt)
        score = self._extract_number(score_text, default=50)

        return min(100, max(0, score))

    async def predict_close_probability(self, deal_data: Dict[str, Any]) -> int:
        """Predict probability of closing (0-100%)"""

        prediction_prompt = f"""
        Predict the close probability (0-100%) for this deal:

        Current Stage: {deal_data.get('stage')}
        Deal Value: ${deal_data.get('value', 0):,}
        Age: {deal_data.get('age_days', 0)} days
        Activities completed: {deal_data.get('activities_count', 0)}
        Decision maker engaged: {deal_data.get('decision_maker_engaged', False)}
        Proposal sent: {deal_data.get('proposal_sent', False)}
        Budget confirmed: {deal_data.get('budget_confirmed', False)}
        Timeline confirmed: {deal_data.get('timeline_confirmed', False)}

        Historical data:
        - Average close rate for this stage: {self._get_stage_close_rate(deal_data.get('stage'))}%
        - Average deal cycle: {self._get_avg_deal_cycle()} days

        Return ONLY the probability percentage (0-100).
        """

        probability_text = await self.think(prediction_prompt)
        probability = self._extract_number(probability_text, default=50)

        return min(100, max(0, probability))

    async def is_deal_stalled(self, deal_data: Dict[str, Any]) -> bool:
        """Check if deal is stalled"""

        days_in_stage = deal_data.get('days_in_stage', 0)
        last_contact_days = deal_data.get('last_contact_days_ago', 0)
        stage = deal_data.get('stage')

        # Stalled criteria
        if last_contact_days > 14:  # No contact in 2 weeks
            return True

        # Stage-specific stall thresholds
        stage_thresholds = {
            "prospecting": 30,
            "qualification": 21,
            "proposal": 14,
            "negotiation": 14
        }

        threshold = stage_thresholds.get(stage, 30)

        if days_in_stage > threshold:
            return True

        return False

    async def recommend_actions(
        self,
        deal_data: Dict[str, Any],
        health_score: int,
        is_stalled: bool
    ) -> List[str]:
        """Recommend next actions to move deal forward"""

        recommendations_prompt = f"""
        Recommend 3-5 specific actions to move this deal forward:

        Deal Status:
        - Stage: {deal_data.get('stage')}
        - Health Score: {health_score}/100
        - Stalled: {is_stalled}
        - Last Contact: {deal_data.get('last_contact_days_ago', 0)} days ago
        - Decision Maker Engaged: {deal_data.get('decision_maker_engaged', False)}
        - Blockers: {deal_data.get('blockers', [])}

        Provide specific, actionable recommendations like:
        - Schedule call with [specific role]
        - Send [specific content]
        - Address [specific concern]
        - Engage [specific stakeholder]

        Return as numbered list.
        """

        actions_text = await self.think(recommendations_prompt)

        # Parse actions
        actions = [
            line.strip() for line in actions_text.split("\n")
            if line.strip() and any(c.isalpha() for c in line)
        ][:5]

        return actions

    async def forecast_close_date(
        self,
        deal_data: Dict[str, Any],
        close_probability: int
    ) -> str:
        """Forecast expected close date"""

        stage = deal_data.get('stage')
        days_in_stage = deal_data.get('days_in_stage', 0)
        avg_cycle = self._get_avg_deal_cycle()

        # Calculate remaining stages
        current_stage_idx = self.pipeline_stages.index(stage) if stage in self.pipeline_stages else 0
        remaining_stages = len(self.pipeline_stages) - current_stage_idx - 1

        # Estimate days to close
        days_per_stage = avg_cycle // len(self.pipeline_stages)
        estimated_days = remaining_stages * days_per_stage

        # Adjust based on health score
        if close_probability < 50:
            estimated_days = int(estimated_days * 1.5)  # Add delay
        elif close_probability > 75:
            estimated_days = int(estimated_days * 0.8)  # Accelerate

        forecast_date = datetime.now() + timedelta(days=estimated_days)

        return forecast_date.strftime("%Y-%m-%d")

    async def identify_risk_factors(self, deal_data: Dict[str, Any]) -> List[str]:
        """Identify risk factors that could prevent close"""

        risks = []

        # No decision maker engagement
        if not deal_data.get('decision_maker_engaged', False):
            risks.append("Decision maker not engaged")

        # Budget not confirmed
        if not deal_data.get('budget_confirmed', False):
            risks.append("Budget not confirmed")

        # Competitor activity
        if deal_data.get('competitor_activity') == 'high':
            risks.append("High competitor activity")

        # Long cycle
        if deal_data.get('age_days', 0) > self._get_avg_deal_cycle() * 1.5:
            risks.append("Deal cycle 50% longer than average")

        # Low engagement
        if deal_data.get('engagement_level') == 'low':
            risks.append("Low customer engagement")

        # No timeline
        if not deal_data.get('timeline_confirmed', False):
            risks.append("No confirmed timeline")

        return risks

    async def update_deal_stage(self, deal_id: str, new_stage: str) -> Dict[str, Any]:
        """Update deal stage and log activity"""

        if new_stage not in self.pipeline_stages:
            return {"error": f"Invalid stage: {new_stage}"}

        await self.log_activity("stage_updated", {
            "deal_id": deal_id,
            "new_stage": new_stage
        })

        # Publish event
        await self.publish_event("deal_stage_changed", {
            "deal_id": deal_id,
            "new_stage": new_stage
        })

        return {"deal_id": deal_id, "stage": new_stage, "updated": True}

    async def check_stalled_deals(self) -> List[Dict[str, Any]]:
        """Check all deals for stalled status"""

        # Get all active deals
        deals = await self._get_active_deals()

        stalled_deals = []

        for deal in deals:
            if await self.is_deal_stalled(deal):
                stalled_deals.append({
                    "deal_id": deal.get("id"),
                    "stage": deal.get("stage"),
                    "days_stalled": deal.get("days_in_stage"),
                    "value": deal.get("value")
                })

        return stalled_deals

    async def _get_deal_data(self, deal_id: str, db: Any = None) -> Dict[str, Any]:
        """Get deal data from database"""
        if db:
            from database.models import Deal, Activity
            from datetime import datetime
            deal = db.query(Deal).filter(Deal.id == deal_id).first()
            if deal:
                age_days = (datetime.now() - deal.created_at).days if deal.created_at else 0

                # Real activity lookup — query activities linked to this deal
                activities = db.query(Activity).filter(Activity.deal_id == deal_id).all()
                activities_count = len(activities)

                # Last contact: most recent activity created_at
                if activities:
                    last_activity_dt = max((a.created_at for a in activities if a.created_at), default=None)
                    last_contact_days_ago = (datetime.now() - last_activity_dt).days if last_activity_dt else age_days
                else:
                    # Fall back to contact's last_contact_at if no activities for this deal
                    if deal.contact_id:
                        from database.models import Contact
                        contact = db.query(Contact).filter(Contact.id == deal.contact_id).first()
                        if contact and contact.last_contact_at:
                            last_contact_days_ago = (datetime.now() - contact.last_contact_at).days
                        else:
                            last_contact_days_ago = age_days
                    else:
                        last_contact_days_ago = age_days

                # Engagement level derived from last contact recency
                if last_contact_days_ago <= 3:
                    engagement_level = "high"
                elif last_contact_days_ago <= 10:
                    engagement_level = "medium"
                else:
                    engagement_level = "low"

                return {
                    "id": deal.id,
                    "name": deal.name,
                    "value": deal.value,
                    "stage": deal.stage,
                    "days_in_stage": age_days,
                    "last_contact_days_ago": last_contact_days_ago,
                    "engagement_level": engagement_level,
                    "decision_maker_engaged": last_contact_days_ago <= 7,
                    "competitor_activity": "unknown",
                    "budget_confirmed": deal.stage in ["proposal", "negotiation", "closed_won"],
                    "timeline_confirmed": deal.stage in ["negotiation", "closed_won"],
                    "age_days": age_days,
                    "activities_count": activities_count,
                    "proposal_sent": deal.stage in ["proposal", "negotiation", "closed_won"],
                    "blockers": deal.risk_factors or []
                }
            return {"error": "Deal not found"}

        # No db session provided — cannot fabricate deal data
        return {"error": "No database session provided"}

    async def _get_active_deals(self) -> List[Dict[str, Any]]:
        """Get all active deals"""
        # Placeholder
        return []

    def _get_stage_close_rate(self, stage: str) -> int:
        """Get historical close rate for stage"""
        rates = {
            "prospecting": 10,
            "qualification": 25,
            "proposal": 50,
            "negotiation": 75,
            "closed_won": 100,
            "closed_lost": 0
        }
        return rates.get(stage, 30)

    def _get_avg_deal_cycle(self) -> int:
        """Get average deal cycle in days"""
        return 90  # 90-day average sales cycle

    def _extract_number(self, text: str, default: int = 0) -> int:
        """Extract first number from text"""
        import re
        match = re.search(r'\b(\d+)\b', text)
        if match:
            return int(match.group(1))
        return default
