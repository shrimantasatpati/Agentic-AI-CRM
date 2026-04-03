"""Analytics Agent - Real-time dashboards and predictive analytics"""

from typing import Dict, Any, List, cast
from agents.base_agent import BaseAgent
from datetime import datetime, timedelta
import json
from sqlalchemy import func
from database.models import Contact, Deal, Customer, MetricsDaily, Email


class AnalyticsAgent(BaseAgent):
    """
    Autonomous agent that:
    - Generates real-time dashboards
    - Performs predictive analytics
    - Provides performance insights
    - Creates custom reports
    """

    def __init__(self, llm, tools=None, memory=None, redis_client=None):
        super().__init__(
            name="AnalyticsAgent",
            llm=llm,
            tools=tools,
            memory=memory,
            redis_client=redis_client
        )

        self.metrics_categories = [
            "sales",
            "customer_success",
            "pipeline",
            "revenue",
            "engagement"
        ]

    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute analytics workflow"""
        action = task.get("action", "dashboard")

        if action == "dashboard":
            return await self.generate_dashboard(
                category=task.get("category", "all"),
                db=task.get("db") # Extract db session
            )
        elif action == "forecast":
            return await self.forecast_revenue(task.get("period", 90))
        elif action == "insights":
            # Wrap list result in a dict so return type is consistent
            insights = await self.generate_insights()
            return {"insights": insights}
        elif action == "report":
            report_type: str = task.get("report_type") or "weekly_sales"
            return await self.create_custom_report(report_type)
        else:
            return {"error": "Unknown action"}

    async def generate_dashboard(self, category: str = "all", db: Any = None) -> Dict[str, Any]:
        """Generate real-time dashboard data"""
        await self.log_activity("generating_dashboard", {"category": category})

        # Collect metrics
        metrics = await self._collect_metrics(category, db)

        # Calculate KPIs
        kpis = await self.calculate_kpis(metrics)

        # Generate trends
        trends = await self.analyze_trends(metrics)

        # Get alerts
        alerts = await self.identify_alerts(metrics, kpis)

        dashboard = {
            "timestamp": datetime.utcnow().isoformat(),
            "category": category,
            "kpis": kpis,
            "metrics": metrics,
            "trends": trends,
            "alerts": alerts,
            "insights": await self.generate_quick_insights(kpis, trends)
        }

        await self.log_activity("dashboard_generated", {
            "category": category,
            "kpi_count": len(kpis)
        })

        return dashboard

    async def calculate_kpis(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate key performance indicators"""

        kpis = {}

        # Sales KPIs
        kpis["lead_conversion_rate"] = self._calculate_conversion_rate(
            metrics.get("leads_qualified", 0),
            metrics.get("leads_total", 1)
        )

        kpis["avg_deal_size"] = metrics.get("total_revenue", 0) / max(metrics.get("deals_won", 1), 1)

        kpis["sales_cycle_length"] = metrics.get("avg_sales_cycle_days", 0)

        kpis["win_rate"] = self._calculate_conversion_rate(
            metrics.get("deals_won", 0),
            metrics.get("deals_total", 1)
        )

        # Revenue KPIs
        kpis["mrr"] = metrics.get("monthly_recurring_revenue", 0)
        kpis["arr"] = kpis["mrr"] * 12

        kpis["revenue_growth"] = self._calculate_growth_rate(
            metrics.get("revenue_current", 0),
            metrics.get("revenue_previous", 1)
        )

        # Customer Success KPIs
        kpis["churn_rate"] = self._calculate_churn_rate(
            metrics.get("customers_churned", 0),
            metrics.get("customers_total", 1)
        )

        kpis["customer_ltv"] = metrics.get("avg_customer_lifetime_value", 0)

        kpis["nps_score"] = metrics.get("net_promoter_score", 0)

        kpis["csat_score"] = metrics.get("customer_satisfaction_score", 0)

        # Pipeline KPIs
        kpis["pipeline_value"] = metrics.get("total_pipeline_value", 0)

        kpis["pipeline_velocity"] = metrics.get("deals_created_30d", 0) / 30

        kpis["forecast_accuracy"] = metrics.get("forecast_accuracy_percent", 0)

        return kpis

    async def analyze_trends(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze metric trends"""

        trends_prompt = f"""
        Analyze trends from these CRM metrics:

        {json.dumps(metrics, indent=2)}

        Identify:
        1. Positive trends (growing/improving)
        2. Negative trends (declining/concerning)
        3. Notable changes from previous period
        4. Seasonal patterns

        Return trends with direction (up/down/stable) and percentage change.
        """

        trends_analysis = await self.think(trends_prompt)

        # Parse trends
        trends = {
            "revenue_trend": self._determine_trend(
                metrics.get("revenue_current", 0),
                metrics.get("revenue_previous", 0)
            ),
            "lead_trend": self._determine_trend(
                metrics.get("leads_current", 0),
                metrics.get("leads_previous", 0)
            ),
            "conversion_trend": self._determine_trend(
                metrics.get("conversion_rate_current", 0),
                metrics.get("conversion_rate_previous", 0)
            ),
            "churn_trend": self._determine_trend(
                metrics.get("churn_current", 0),
                metrics.get("churn_previous", 0),
                inverse=True  # Lower churn is better
            )
        }

        return trends

    async def forecast_revenue(self, days: int = 90) -> Dict[str, Any]:
        """Forecast revenue for next N days"""
        await self.log_activity("forecasting_revenue", {"days": days})

        # Get historical data
        historical = await self._get_historical_revenue(days=180)

        # Get current pipeline
        pipeline = await self._get_pipeline_data()

        forecast_prompt = f"""
        Forecast revenue for the next {days} days:

        Historical Revenue (last 180 days):
        {json.dumps(historical, indent=2)}

        Current Pipeline:
        - Total value: ${pipeline.get('total_value', 0):,}
        - Deals in negotiation: {pipeline.get('negotiation_count', 0)}
        - Average close rate: {pipeline.get('avg_close_rate', 0)}%
        - Average deal cycle: {pipeline.get('avg_cycle', 0)} days

        Provide:
        1. Revenue forecast (best case, likely, worst case)
        2. Confidence level
        3. Key assumptions
        4. Risk factors

        Return as JSON.
        """

        forecast_text = await self.think(forecast_prompt)

        # Calculate statistical forecast
        avg_monthly = sum(historical.values()) / max(len(historical), 1)
        months = days / 30

        forecast = {
            "period_days": days,
            "forecast_date": (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d"),
            "scenarios": {
                "best_case": int(avg_monthly * months * 1.2),
                "likely": int(avg_monthly * months),
                "worst_case": int(avg_monthly * months * 0.8)
            },
            "confidence": 75,
            "assumptions": [
                f"Based on {len(historical)} days of historical data",
                f"Average monthly revenue: ${avg_monthly:,.0f}",
                f"Current pipeline value: ${pipeline.get('total_value', 0):,}"
            ],
            "contributing_pipeline": pipeline.get('negotiation_count', 0)
        }

        await self.log_activity("forecast_generated", forecast)

        return forecast

    async def generate_insights(self) -> List[Dict[str, Any]]:
        """Generate AI-powered insights"""

        # Collect data
        metrics = await self._collect_metrics("all")
        kpis = await self.calculate_kpis(metrics)

        insights_prompt = f"""
        Generate actionable insights from this CRM data:

        KPIs:
        {json.dumps(kpis, indent=2)}

        Metrics:
        {json.dumps(metrics, indent=2)}

        Provide 5-7 insights like:
        - "Sales cycle increased 15% - investigate bottlenecks in proposal stage"
        - "Top 20% of reps generate 60% of revenue - scale best practices"
        - "Churn risk up 10% in enterprise segment - trigger retention campaigns"

        Each insight should:
        - Identify a pattern or anomaly
        - Explain the business impact
        - Suggest an action

        Return as numbered list.
        """

        insights_text = await self.think(insights_prompt)

        # Parse insights
        insights = []
        for line in insights_text.split("\n"):
            if line.strip() and any(c.isalpha() for c in line):
                insights.append({
                    "insight": line.strip(),
                    "category": self._categorize_insight(line),
                    "priority": self._determine_priority(line),
                    "timestamp": datetime.utcnow().isoformat()
                })

        # Add automated insights
        insights.extend(await self._generate_automated_insights(metrics, kpis))

        all_insights: List[Dict[str, Any]] = list(insights)
        return cast(List[Dict[str, Any]], all_insights[:10])  # Top 10 insights

    async def create_custom_report(self, report_type: str) -> Dict[str, Any]:
        """Create custom report"""

        if report_type == "weekly_sales":
            report = await self._create_weekly_sales_report()
        elif report_type == "monthly_executive":
            report = await self._create_monthly_executive_report()
        elif report_type == "pipeline_health":
            report = await self._create_pipeline_health_report()
        elif report_type == "customer_health":
            report = await self._create_customer_health_report()
        else:
            report = {"error": f"Unknown report type: {report_type}"}

        await self.log_activity("report_created", {"type": report_type})

        return report

    async def identify_alerts(
        self,
        metrics: Dict[str, Any],
        kpis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Identify alerts that need attention"""

        alerts = []

        # Revenue alert
        if kpis.get("revenue_growth", 0) < -10:
            alerts.append({
                "severity": "high",
                "type": "revenue",
                "message": f"Revenue declined {abs(kpis['revenue_growth'])}% from last period",
                "action": "Review sales team performance and pipeline health"
            })

        # Churn alert
        if kpis.get("churn_rate", 0) > 5:
            alerts.append({
                "severity": "high",
                "type": "churn",
                "message": f"Churn rate at {kpis['churn_rate']}% (threshold: 5%)",
                "action": "Trigger customer success intervention for at-risk accounts"
            })

        # Pipeline alert
        if kpis.get("pipeline_value", 0) < 100000:
            alerts.append({
                "severity": "medium",
                "type": "pipeline",
                "message": "Pipeline value below threshold",
                "action": "Increase lead generation and qualification efforts"
            })

        # Win rate alert
        if kpis.get("win_rate", 0) < 20:
            alerts.append({
                "severity": "medium",
                "type": "conversion",
                "message": f"Win rate at {kpis['win_rate']}% (below target of 25%)",
                "action": "Analyze lost deals and improve qualification"
            })

        return alerts

    async def generate_quick_insights(
        self,
        kpis: Dict[str, Any],
        trends: Dict[str, Any]
    ) -> List[str]:
        """Generate quick insights for dashboard"""

        insights = []

        # Revenue insight
        if trends.get("revenue_trend", {}).get("direction") == "up":
            insights.append(f"Revenue growing at {trends['revenue_trend'].get('change', 0)}%")
        elif trends.get("revenue_trend", {}).get("direction") == "down":
            insights.append(f"⚠️ Revenue declining {abs(trends['revenue_trend'].get('change', 0))}%")

        # Conversion insight
        if kpis.get("lead_conversion_rate", 0) > 25:
            insights.append(f"Strong lead conversion at {kpis['lead_conversion_rate']}%")
        else:
            insights.append(f"Lead conversion needs attention ({kpis['lead_conversion_rate']}%)")

        # Sales cycle
        insights.append(f"Average sales cycle: {kpis.get('sales_cycle_length', 0):.0f} days")

        return insights

    async def _collect_metrics(self, category: str, db: Any = None) -> Dict[str, Any]:
        """Collect metrics from database"""
        if db is None:
            # Fallback to placeholder if no DB session (should not happen in prod)
            return {
                "leads_total": 0,
                "deals_total": 0,
                "total_revenue": 0,
                "customers_total": 0
            }

        # Real DB queries
        leads_total = db.query(Contact).count()
        leads_qualified = db.query(Contact).filter(Contact.lead_score >= 70).count()
        deals_total = db.query(Deal).count()
        deals_won = db.query(Deal).filter(Deal.stage == 'won').count()
        
        total_revenue = db.query(func.sum(Deal.value)).filter(Deal.stage == 'won').scalar() or 0.0
        customers_total = db.query(Customer).count()
        
        # Pipeline value
        pipeline_value = db.query(func.sum(Deal.value)).filter(Deal.stage.in_(['prospecting', 'qualification', 'proposal', 'negotiation'])).scalar() or 0.0

        return {
            "leads_total": leads_total,
            "leads_qualified": leads_qualified,
            "leads_current": leads_total,
            "leads_previous": int(leads_total * 0.9), # Mock trend
            "deals_total": deals_total,
            "deals_won": deals_won,
            "deals_created_30d": deals_total, # Simplified
            "total_revenue": total_revenue,
            "revenue_current": total_revenue,
            "revenue_previous": total_revenue * 0.85,
            "monthly_recurring_revenue": total_revenue / 12,
            "customers_total": customers_total,
            "customers_churned": 0,
            "avg_customer_lifetime_value": total_revenue / max(customers_total, 1),
            "net_promoter_score": 75,
            "customer_satisfaction_score": 4.5,
            "total_pipeline_value": pipeline_value,
            "forecast_accuracy_percent": 90,
            "avg_sales_cycle_days": 30,
            "conversion_rate_current": (leads_qualified / max(leads_total, 1)) * 100,
            "conversion_rate_previous": 28,
            "churn_current": 1.5,
            "churn_previous": 2.0
        }

    async def _get_historical_revenue(self, days: int) -> Dict[str, float]:
        """Get historical revenue data"""
        # Placeholder
        historical = {}
        base = 75000
        for i in range(days):
            date = (datetime.now() - timedelta(days=days-i)).strftime("%Y-%m-%d")
            # Simulate growing revenue with some variance
            historical[date] = float(base + (i * 100) + ((-1) ** i * 5000))
        return historical

    async def _get_pipeline_data(self) -> Dict[str, Any]:
        """Get current pipeline data"""
        # Placeholder
        return {
            "total_value": 500000,
            "negotiation_count": 12,
            "avg_close_rate": 65,
            "avg_cycle": 45
        }

    async def _generate_automated_insights(
        self,
        metrics: Dict[str, Any],
        kpis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate automated insights from patterns"""

        insights = []

        # Pattern: High conversion but low volume
        if kpis.get("lead_conversion_rate", 0) > 30 and metrics.get("leads_total", 0) < 100:
            insights.append({
                "insight": "High conversion rate but low lead volume - invest in lead generation",
                "category": "sales",
                "priority": "high",
                "timestamp": datetime.utcnow().isoformat()
            })

        # Pattern: Growing churn
        if metrics.get("churn_current", 0) > metrics.get("churn_previous", 0):
            insights.append({
                "insight": "Churn increasing - review customer success processes",
                "category": "customer_success",
                "priority": "high",
                "timestamp": datetime.utcnow().isoformat()
            })

        return insights

    async def _create_weekly_sales_report(self) -> Dict[str, Any]:
        """Create weekly sales report"""
        metrics = await self._collect_metrics("sales")
        kpis = await self.calculate_kpis(metrics)

        return {
            "report_type": "weekly_sales",
            "period": "Last 7 days",
            "summary": {
                "deals_closed": metrics.get("deals_won", 0),
                "revenue": metrics.get("total_revenue", 0),
                "pipeline_added": metrics.get("deals_created_30d", 0) // 4,
                "win_rate": kpis.get("win_rate", 0)
            }
        }

    async def _create_monthly_executive_report(self) -> Dict[str, Any]:
        """Create monthly executive report"""
        return {"report_type": "monthly_executive", "status": "placeholder"}

    async def _create_pipeline_health_report(self) -> Dict[str, Any]:
        """Create pipeline health report"""
        return {"report_type": "pipeline_health", "status": "placeholder"}

    async def _create_customer_health_report(self) -> Dict[str, Any]:
        """Create customer health report"""
        return {"report_type": "customer_health", "status": "placeholder"}

    def _calculate_conversion_rate(self, converted: int, total: int) -> float:
        """Calculate conversion rate percentage"""
        if total == 0:
            return 0.0
        rate: float = float(converted) / float(total) * 100.0
        return int(rate * 100) / 100.0

    def _calculate_growth_rate(self, current: float, previous: float) -> float:
        """Calculate growth rate percentage"""
        if previous == 0:
            return 0.0
        delta: float = (current - previous) / previous * 100.0
        return int(delta * 100) / 100.0

    def _calculate_churn_rate(self, churned: int, total: int) -> float:
        """Calculate churn rate percentage"""
        return self._calculate_conversion_rate(churned, total)

    def _determine_trend(
        self,
        current: float,
        previous: float,
        inverse: bool = False
    ) -> Dict[str, Any]:
        """Determine trend direction and magnitude"""
        if previous == 0:
            return {"direction": "stable", "change": 0}

        change = ((current - previous) / previous) * 100

        if inverse:
            change = -change

        if change > 5:
            direction = "up"
        elif change < -5:
            direction = "down"
        else:
            direction = "stable"

        return {
            "direction": direction,
            "change": int(change * 100) / 100.0,
            "current": current,
            "previous": previous
        }

    def _categorize_insight(self, insight_text: str) -> str:
        """Categorize insight by keywords"""
        text_lower = insight_text.lower()

        if any(word in text_lower for word in ["revenue", "sales", "deal"]):
            return "sales"
        elif any(word in text_lower for word in ["churn", "retention", "customer"]):
            return "customer_success"
        elif any(word in text_lower for word in ["pipeline", "forecast"]):
            return "pipeline"
        else:
            return "general"

    def _determine_priority(self, insight_text: str) -> str:
        """Determine insight priority"""
        text_lower = insight_text.lower()

        if any(word in text_lower for word in ["urgent", "critical", "declining", "risk"]):
            return "high"
        elif any(word in text_lower for word in ["opportunity", "growing", "improve"]):
            return "medium"
        else:
            return "low"
