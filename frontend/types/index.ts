// ============================================================
// API Response Types for AI CRM
// ============================================================

// ---- Dashboard & Analytics ----
export interface DashboardStats {
  leads: { total: number; qualified: number; trend: { value: number; direction: 'up' | 'down' | 'neutral' } };
  deals: { total: number; pipeline_value: number; trend: { value: number; direction: 'up' | 'down' | 'neutral' } };
  customers: { total: number; mrr: number; arr: number; trend: { value: number; direction: 'up' | 'down' | 'neutral' } };
}

export interface PipelineStage {
  count: number;
  value: number;
}

export type PipelineData = Record<string, PipelineStage>;

// ---- Core Entities ----
export interface Lead {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  lead_score: number;
  lead_status: string;
}

export interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  close_date?: string;
  health_score?: number;
  is_stalled?: boolean;
}

export interface Customer {
  id: string;
  company_name: string;
  mrr: number;
  health_score: number;
  churn_risk: string;
  churn_probability?: number;
}

// ---- Agent Events ----
export interface AgentEvent {
  id: string;
  timestamp: string;
  agent: string;
  agentColor: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AgentStatus {
  name: string;
  id: string;
  color: string;
  emoji: string;
  route: string;
  status: 'active' | 'standby';
  runsToday: number;
  lastRun: string;
}

// ---- Execution Step ----
export interface ExecutionStep {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  output?: string;
  durationMs?: number;
}

// ---- Lead Qualification ----
export interface LeadQualificationResult {
  email: string;
  score: number;
  enriched_data: {
    domain?: string;
    company_name?: string;
    industry?: string;
    company_size?: string;
    job_level?: string;
  };
  routing: {
    team: string;
    priority: string;
    recommended_action: string;
    sla_hours: number;
  };
  signals: string[];
  score_breakdown: {
    company_size: number;
    job_title: number;
    industry: number;
    engagement: number;
    budget_signals: number;
  };
}

// ---- Email Intelligence ----
export interface EmailIntelligenceResult {
  sentiment: {
    score: number;
    label: string;
    emotion: string;
    urgency: string;
    concerns: string[];
  };
  category: string;
  priority: string;
  draft_response: string;
  follow_up_suggestions: string[];
  requires_human_review: boolean;
}

// ---- Sales Pipeline ----
export interface SalesPipelineResult {
  deal_id: string;
  deal_name: string;
  health_score: number;
  close_probability: number;
  is_stalled: boolean;
  risk_factors: string[];
  next_actions: string[];
  forecast_close_date: string;
  recommendations: string[];
}

// ---- Customer Success ----
export interface CustomerSuccessResult {
  customer_id: string;
  company_name: string;
  health_score: number;
  churn_risk: {
    level: 'low' | 'medium' | 'high' | 'critical';
    probability: number;
    factors: string[];
  };
  engagement: {
    logins_per_week: number;
    feature_adoption_pct: number;
    last_login: string;
  };
  upsell_opportunities: Array<{
    type: string;
    description: string;
    confidence: number;
    estimated_value: number;
  }>;
  recommended_actions: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    due_date?: string;
  }>;
}

// ---- Meeting Scheduler ----
export interface MeetingSchedulerResult {
  scheduled_time: string;
  duration_minutes: number;
  meeting_type: string;
  attendees: string[];
  agenda: Array<{ item: string; duration_minutes: number }>;
  prep_materials: {
    talking_points: string[];
    success_criteria: string[];
    collateral: string[];
  };
  follow_up_tasks: string[];
}

// ---- Analytics ----
export interface AnalyticsResult {
  kpis: {
    conversion_rate: number;
    avg_deal_size: number;
    win_rate: number;
    churn_rate: number;
    mrr: number;
    arr: number;
  };
  trends: Record<string, { value: number; change_pct: number; direction: 'up' | 'down' }>;
  insights: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    text: string;
  }>;
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    message: string;
    action?: string;
  }>;
  quick_insights: string[];
}

// ---- Query Database ----
export interface QueryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  table_name?: string;
  execution_time_ms?: number;
  row_count?: number;
  column_count?: number;
  data?: Record<string, unknown>[];
  is_single_value?: boolean;
  single_value_label?: string;
  timestamp: Date;
}
