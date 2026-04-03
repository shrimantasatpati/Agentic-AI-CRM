"""AI CRM Agents - Multi-agent system for intelligent CRM workflows"""

from .base_agent import BaseAgent
from .lead_qualification_agent import LeadQualificationAgent
from .email_intelligence_agent import EmailIntelligenceAgent
from .sales_pipeline_agent import SalesPipelineAgent
from .customer_success_agent import CustomerSuccessAgent
from .meeting_scheduler_agent import MeetingSchedulerAgent
from .analytics_agent import AnalyticsAgent

__all__ = [
    'BaseAgent',
    'LeadQualificationAgent',
    'EmailIntelligenceAgent',
    'SalesPipelineAgent',
    'CustomerSuccessAgent',
    'MeetingSchedulerAgent',
    'AnalyticsAgent',
]
