"""Customer Success Agent - Monitors health scores and detects churn risk"""

from typing import Dict, Any, List
from .base_agent import BaseAgent
from datetime import datetime, timedelta


class CustomerSuccessAgent(BaseAgent):
    """
    Autonomous agent that:
    - Monitors customer health scores
    - Detects churn risk early
    - Triggers retention workflows automatically
    - Identifies upsell/cross-sell opportunities
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="CustomerSuccessAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        self.health_score_weights = {
            "product_usage": 0.30,
            "engagement": 0.25,
            "support_tickets": 0.20,
            "payment_history": 0.15,
            "sentiment": 0.10
        }

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute customer success workflow"""
        customer_id = task.get("customer_id")
        action = task.get("action", "monitor")
        db = task.get("db") # Extract db session

        if action == "monitor":
            return await self.monitor_customer(customer_id, db)
        elif action == "check_churn_risk":
            return await self.check_churn_risk(customer_id, db)
        elif action == "identify_opportunities":
            return await self.identify_opportunities(customer_id, db)
        else:
            return {"error": "Unknown action"}

    async def monitor_customer(self, customer_id: str, db: Any = None) -> Dict[str, Any]:
        """Comprehensive customer health monitoring"""
        await self.log_activity("monitoring_customer", {"customer_id": customer_id})

        # Get customer data
        customer_data = await self._get_customer_data(customer_id, db)
        
        if "error" in customer_data:
            return customer_data

        # OPTIMIZED: Single LLM call returns health_score + recommended_actions together
        health_score, actions = await self._monitor_customer_single_call(customer_data)

        # Rule-based churn risk (no LLM needed — uses threshold logic)
        churn_risk = await self.assess_churn_risk(customer_data, health_score)

        # Get engagement metrics (rule-based — no LLM needed)
        engagement = await self.analyze_engagement(customer_data)

        # Identify opportunities (uses LLM, called separately only when needed)
        opportunities = await self.identify_opportunities(customer_id, db)

        result = {
            "customer_id": customer_id,
            "name": customer_data.get("name"),
            "health_score": health_score,
            "churn_risk": churn_risk,
            "engagement": engagement,
            "opportunities": opportunities,
            "recommended_actions": actions,
            "status": self._get_customer_status(health_score, churn_risk)
        }

        # Update DB if available
        if db:
            from database.models import Customer
            customer = db.query(Customer).filter(Customer.id == customer_id).first()
            if customer:
                # Health score is now dynamic, not stored in DB
                customer.churn_risk = churn_risk.get("level", "low")
                db.commit()

        # Alert if at-risk
        if churn_risk["level"] in ["high", "critical"]:
            await self.publish_event("churn_risk_detected", {
                "customer_id": customer_id,
                "risk_level": churn_risk["level"],
                "health_score": health_score
            })

        await self.log_activity("customer_monitored", result)

        return result

    async def _monitor_customer_single_call(self, customer_data: Dict[str, Any]):
        """Single optimized LLM call: health_score + recommended_actions in one JSON response"""
        import json, re

        combined_prompt = f"""Analyze this CRM customer and return ONLY a valid JSON object:

Customer:
- Plan: {customer_data.get('plan', 'unknown')}
- Logins/week: {customer_data.get('logins_per_week', 0)}
- Features used: {customer_data.get('features_used', 0)}/{customer_data.get('total_features', 10)}
- Days since login: {customer_data.get('days_since_login', 0)}
- Support tickets (30d): {customer_data.get('support_tickets_30d', 0)}
- Critical tickets: {customer_data.get('critical_tickets', 0)}
- CSAT score: {customer_data.get('csat_score', 0)}/5
- Payment delays: {customer_data.get('payment_delays', 0)}
- Usage trend: {customer_data.get('usage_trend', 'stable')}
- Days to renewal: {customer_data.get('days_to_renewal', 999)}

Return exactly:
{{
  "health_score": <integer 0-100>,
  "recommended_actions": ["action1", "action2", "action3"]
}}"""

        raw = await self.think(combined_prompt)

        try:
            json_match = re.search(r'\{{.*\}}', raw, re.DOTALL)
            parsed = json.loads(json_match.group() if json_match else raw)
        except Exception:
            parsed = {}

        health_score = min(100, max(0, int(parsed.get("health_score", 50))))
        actions = parsed.get("recommended_actions", [])
        if isinstance(actions, str):
            actions = [s.strip() for s in actions.split("\n") if s.strip()]

        return health_score, actions


    async def calculate_health_score(self, customer_data: Dict[str, Any]) -> int:
        """Calculate customer health score (0-100)"""

        health_prompt = f"""
        Calculate a health score (0-100) for this customer:

        Product Usage:
        - Login frequency: {customer_data.get('logins_per_week', 0)} per week
        - Feature adoption: {customer_data.get('features_used', 0)}/{customer_data.get('total_features', 10)} features used
        - Daily active users: {customer_data.get('daily_active_users', 0)}
        - License utilization: {customer_data.get('license_usage_percent', 0)}%

        Engagement:
        - Last login: {customer_data.get('days_since_login', 0)} days ago
        - Support interactions: {customer_data.get('support_tickets_30d', 0)} in last 30 days
        - Training sessions attended: {customer_data.get('training_attended', 0)}
        - Community participation: {customer_data.get('community_posts', 0)} posts

        Support Tickets:
        - Open critical tickets: {customer_data.get('critical_tickets', 0)}
        - Average resolution time: {customer_data.get('avg_resolution_hours', 0)} hours
        - Customer satisfaction (CSAT): {customer_data.get('csat_score', 0)}/5

        Payment History:
        - Days since payment: {customer_data.get('days_since_payment', 0)}
        - Payment delays: {customer_data.get('payment_delays', 0)}
        - Account value: ${customer_data.get('mrr', 0)}/month

        Scoring weights:
        - Product usage (30%)
        - Engagement (25%)
        - Support experience (20%)
        - Payment health (15%)
        - Sentiment (10%)

        Return ONLY the numeric score (0-100).
        """

        score_text = await self.think(health_prompt)
        score = self._extract_number(score_text, default=50)

        return min(100, max(0, score))

    async def assess_churn_risk(
        self,
        customer_data: Dict[str, Any],
        health_score: int
    ) -> Dict[str, Any]:
        """Assess churn risk and identify factors"""

        risk_factors = []

        # Low health score
        if health_score < 50:
            risk_factors.append("Low health score")

        # Declining usage
        if customer_data.get('usage_trend') == 'declining':
            risk_factors.append("Declining product usage")

        # No recent login
        if customer_data.get('days_since_login', 0) > 14:
            risk_factors.append("No login in 14+ days")

        # High support volume
        if customer_data.get('support_tickets_30d', 0) > 5:
            risk_factors.append("High support ticket volume")

        # Critical tickets open
        if customer_data.get('critical_tickets', 0) > 0:
            risk_factors.append("Unresolved critical issues")

        # Payment issues
        if customer_data.get('payment_delays', 0) > 0:
            risk_factors.append("Payment delays")

        # Low engagement
        if customer_data.get('engagement_score', 0) < 30:
            risk_factors.append("Low engagement")

        # Contract near expiry
        days_to_renewal = customer_data.get('days_to_renewal', 999)
        if days_to_renewal < 60:
            risk_factors.append(f"Contract renewal in {days_to_renewal} days")

        # Determine risk level
        risk_level = self._calculate_risk_level(health_score, len(risk_factors))

        return {
            "level": risk_level,
            "factors": risk_factors,
            "probability": self._estimate_churn_probability(health_score, risk_factors)
        }

    async def analyze_engagement(self, customer_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze customer engagement patterns"""

        return {
            "login_frequency": customer_data.get('logins_per_week', 0),
            "feature_adoption_rate": customer_data.get('features_used', 0) / max(customer_data.get('total_features', 1), 1),
            "last_activity": customer_data.get('days_since_login', 0),
            "trend": customer_data.get('usage_trend', 'stable'),
            "engagement_score": customer_data.get('engagement_score', 50)
        }

    async def identify_opportunities(self, customer_id: str, db: Any = None) -> List[Dict[str, Any]]:
        """Identify upsell/cross-sell opportunities"""

        customer_data = await self._get_customer_data(customer_id, db)

        opportunities = []

        # High usage = upsell opportunity
        if customer_data.get('license_usage_percent', 0) > 80:
            opportunities.append({
                "type": "upsell",
                "product": "Additional licenses",
                "reason": "High license utilization (80%+)",
                "confidence": "high"
            })

        # Feature adoption = cross-sell
        if customer_data.get('features_used', 0) > 7:
            opportunities.append({
                "type": "cross-sell",
                "product": "Premium features",
                "reason": "Power user - using 7+ features",
                "confidence": "medium"
            })

        # Growth indicators
        if customer_data.get('user_growth_30d', 0) > 10:
            opportunities.append({
                "type": "upsell",
                "product": "Enterprise plan",
                "reason": "Rapid team growth (+10 users in 30 days)",
                "confidence": "high"
            })

        # Use LLM for additional insights
        opportunities_prompt = f"""
        Identify upsell/cross-sell opportunities for this customer:

        Current Plan: {customer_data.get('plan')}
        MRR: ${customer_data.get('mrr', 0)}
        Features Used: {customer_data.get('features_used', 0)}/{customer_data.get('total_features', 10)}
        Team Size: {customer_data.get('team_size', 0)} users
        Industry: {customer_data.get('industry')}

        Suggest specific product/service opportunities.
        Return as list.
        """

        llm_opportunities = await self.think(opportunities_prompt)

        # Parse and add LLM suggestions
        for line in llm_opportunities.split("\n"):
            if line.strip() and any(c.isalpha() for c in line):
                opportunities.append({
                    "type": "opportunity",
                    "suggestion": line.strip(),
                    "confidence": "medium"
                })

        return opportunities[:5]  # Top 5 opportunities

    async def recommend_success_actions(
        self,
        customer_data: Dict[str, Any],
        health_score: int,
        churn_risk: Dict[str, Any]
    ) -> List[str]:
        """Recommend actions for customer success team"""

        recommendations = []

        # Critical health
        if health_score < 40:
            recommendations.append("URGENT: Schedule executive business review")
            recommendations.append("Assign dedicated success manager")

        # Churn risk
        if churn_risk["level"] in ["high", "critical"]:
            recommendations.append("Trigger retention workflow")
            recommendations.append("Offer personalized training session")

        # Low engagement
        if customer_data.get('days_since_login', 0) > 14:
            recommendations.append("Send re-engagement email campaign")

        # Open critical tickets
        if customer_data.get('critical_tickets', 0) > 0:
            recommendations.append("Escalate critical support tickets")

        # Contract renewal approaching
        if customer_data.get('days_to_renewal', 999) < 60:
            recommendations.append("Initiate renewal conversation")

        # Low feature adoption
        if customer_data.get('features_used', 0) < 3:
            recommendations.append("Schedule product training")

        # Use LLM for personalized recommendations
        rec_prompt = f"""
        Recommend 3 specific actions for this customer:

        Health Score: {health_score}/100
        Churn Risk: {churn_risk['level']}
        Issues: {', '.join(churn_risk['factors'])}
        Plan: {customer_data.get('plan')}

        Provide actionable, personalized recommendations.
        """

        llm_recommendations = await self.think(rec_prompt)

        for line in llm_recommendations.split("\n"):
            if line.strip() and any(c.isalpha() for c in line):
                recommendations.append(line.strip())

        return recommendations[:7]  # Top 7 actions

    async def check_churn_risk(self, customer_id: str) -> Dict[str, Any]:
        """Quick churn risk check"""
        customer_data = await self._get_customer_data(customer_id)
        health_score = await self.calculate_health_score(customer_data)
        churn_risk = await self.assess_churn_risk(customer_data, health_score)

        return {
            "customer_id": customer_id,
            "churn_risk": churn_risk,
            "health_score": health_score
        }

    async def _get_customer_data(self, customer_id: str, db: Any = None) -> Dict[str, Any]:
        """Get customer data from database"""
        if db:
            from database.models import Customer
            customer = db.query(Customer).filter(Customer.id == customer_id).first()
            if customer:
                    age_days_since_join = (datetime.now() - customer.created_at).days if hasattr(customer, 'created_at') and customer.created_at else 0
                    return {
                        "id": customer.id,
                        "name": customer.company.name if customer.company else "Unknown Customer",
                        "email": getattr(customer, "email", ""),
                        "industry": customer.company.industry if customer.company else "Unknown Industry",
                        "total_spend": getattr(customer, "arr", 0), # Using ARR as total spend proxy
                        "status": "active",
                        "churn_risk": customer.churn_risk or "low",
                        "plan": getattr(customer, "plan", "Unknown"),
                        "mrr": (customer.total_spend or 0) / max(1, age_days_since_join // 30),
                        "logins_per_week": getattr(customer, "logins_per_week", 0),
                        "features_used": getattr(customer, "features_used", 0),
                        "total_features": getattr(customer, "total_features", 10),
                        "daily_active_users": getattr(customer, "daily_active_users", 0),
                        "license_usage_percent": getattr(customer, "license_usage_percent", 0),
                        "days_since_login": getattr(customer, "days_since_login", 0),
                        "support_tickets_30d": getattr(customer, "support_tickets_30d", 0),
                        "training_attended": getattr(customer, "training_attended", 0),
                        "community_posts": getattr(customer, "community_posts", 0),
                        "critical_tickets": getattr(customer, "critical_tickets", 0),
                        "avg_resolution_hours": getattr(customer, "avg_resolution_hours", 0),
                        "csat_score": getattr(customer, "csat_score", 0),
                        "payment_delays": getattr(customer, "payment_delays", 0),
                        "usage_trend": getattr(customer, "usage_trend", "unknown"),
                        "engagement_score": getattr(customer, "engagement_score", 0),
                        "days_to_renewal": getattr(customer, "days_to_renewal", 0),
                        "team_size": getattr(customer, "team_size", 0),
                        "user_growth_30d": getattr(customer, "user_growth_30d", 0),
                    }
            return {"error": "Customer not found"}

        return {"error": "No database session provided"}

    def _calculate_risk_level(self, health_score: int, factor_count: int) -> str:
        """Calculate risk level from score and factors"""
        if health_score < 30 or factor_count >= 5:
            return "critical"
        elif health_score < 50 or factor_count >= 3:
            return "high"
        elif health_score < 70 or factor_count >= 2:
            return "medium"
        else:
            return "low"

    def _estimate_churn_probability(self, health_score: int, risk_factors: List[str]) -> int:
        """Estimate churn probability percentage"""
        # Base probability from health score
        base_prob = 100 - health_score

        # Add 10% for each risk factor
        factor_prob = len(risk_factors) * 10

        total_prob = min(95, base_prob + factor_prob)

        return total_prob

    def _get_customer_status(self, health_score: int, churn_risk: Dict[str, Any]) -> str:
        """Get overall customer status"""
        if churn_risk["level"] == "critical":
            return "critical"
        elif churn_risk["level"] == "high":
            return "at_risk"
        elif health_score > 75:
            return "healthy"
        else:
            return "needs_attention"

    def _extract_number(self, text: str, default: int = 0) -> int:
        """Extract first number from text"""
        import re
        match = re.search(r'\b(\d+)\b', text)
        if match:
            return int(match.group(1))
        return default
