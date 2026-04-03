-- AI-Powered CRM Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CONTACTS & COMPANIES
-- ============================================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    industry VARCHAR(100),
    company_size VARCHAR(50), -- small, medium, large, enterprise
    revenue_range VARCHAR(50),
    location VARCHAR(255),
    timezone VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enrichment_data JSONB, -- External data from LinkedIn, Clearbit, etc.
    metadata JSONB
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    job_title VARCHAR(255),
    job_level VARCHAR(50), -- entry, mid, senior, executive
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),

    -- Lead Qualification Data
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    lead_status VARCHAR(50) DEFAULT 'new', -- new, qualified, nurture, unqualified
    lead_source VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contact_at TIMESTAMP,

    -- Enrichment
    enrichment_data JSONB,
    metadata JSONB
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX idx_contacts_lead_status ON contacts(lead_status);

-- ============================================================================
-- DEALS & PIPELINE
-- ============================================================================

CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

    -- Deal Information
    name VARCHAR(255) NOT NULL,
    value DECIMAL(12, 2) DEFAULT 0,
    stage VARCHAR(50) NOT NULL, -- prospecting, qualification, proposal, negotiation, closed_won, closed_lost
    probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),

    -- Health & Risk
    health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
    is_stalled BOOLEAN DEFAULT false,
    risk_factors JSONB,

    -- Dates
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stage_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_close_date DATE,
    actual_close_date DATE,

    -- Assignment
    owner_id UUID, -- User/sales rep

    -- Additional
    notes TEXT,
    metadata JSONB
);

CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_health_score ON deals(health_score DESC);
CREATE INDEX idx_deals_close_date ON deals(expected_close_date);

-- ============================================================================
-- CUSTOMER SUCCESS
-- ============================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Subscription
    plan VARCHAR(100),
    mrr DECIMAL(12, 2) DEFAULT 0, -- Monthly Recurring Revenue
    arr DECIMAL(12, 2) DEFAULT 0, -- Annual Recurring Revenue
    contract_start_date DATE,
    contract_end_date DATE,

    -- Health Metrics
    health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
    churn_risk VARCHAR(50) DEFAULT 'low', -- low, medium, high, critical
    churn_probability INTEGER DEFAULT 0,

    -- Engagement
    last_login_at TIMESTAMP,
    logins_per_week INTEGER DEFAULT 0,
    features_used INTEGER DEFAULT 0,
    total_features INTEGER DEFAULT 10,
    license_usage_percent INTEGER DEFAULT 0,
    daily_active_users INTEGER DEFAULT 0,

    -- Support
    support_tickets_30d INTEGER DEFAULT 0,
    critical_tickets_open INTEGER DEFAULT 0,
    avg_resolution_hours INTEGER DEFAULT 24,
    csat_score DECIMAL(3, 2) DEFAULT 0, -- Customer Satisfaction Score
    nps_score INTEGER DEFAULT 0, -- Net Promoter Score

    -- Payments
    last_payment_at TIMESTAMP,
    payment_delays INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
);

CREATE INDEX idx_customers_health_score ON customers(health_score DESC);
CREATE INDEX idx_customers_churn_risk ON customers(churn_risk);
CREATE INDEX idx_customers_contract_end ON customers(contract_end_date);

-- ============================================================================
-- COMMUNICATIONS
-- ============================================================================

CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,

    -- Email Data
    from_email VARCHAR(255),
    to_email VARCHAR(255),
    subject TEXT,
    body TEXT,
    direction VARCHAR(20), -- inbound, outbound

    -- AI Analysis
    sentiment VARCHAR(50), -- positive, neutral, negative
    sentiment_score INTEGER, -- 1-10
    emotion VARCHAR(50),
    category VARCHAR(100),
    priority VARCHAR(20), -- low, medium, high

    -- Response
    draft_response TEXT,
    response_sent BOOLEAN DEFAULT false,

    -- Timestamps
    received_at TIMESTAMP,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
);

CREATE INDEX idx_emails_contact ON emails(contact_id);
CREATE INDEX idx_emails_category ON emails(category);
CREATE INDEX idx_emails_priority ON emails(priority);

-- ============================================================================
-- MEETINGS
-- ============================================================================

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,

    -- Meeting Info
    title VARCHAR(255) NOT NULL,
    meeting_type VARCHAR(50), -- discovery, demo, follow_up, executive_review, training
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    location VARCHAR(500),

    -- Attendees (JSONB array)
    attendees JSONB,

    -- Preparation
    agenda JSONB,
    prep_materials JSONB,
    context JSONB,

    -- Follow-up
    notes TEXT,
    followup_tasks JSONB,
    recording_url VARCHAR(500),

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
);

CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_at);
CREATE INDEX idx_meetings_deal ON meetings(deal_id);
CREATE INDEX idx_meetings_status ON meetings(status);

-- ============================================================================
-- ACTIVITIES & TASKS
-- ============================================================================

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,

    -- Activity Info
    activity_type VARCHAR(100), -- call, email, meeting, note, task
    subject VARCHAR(255),
    description TEXT,
    outcome VARCHAR(100),

    -- Assignment
    assigned_to UUID, -- User ID
    completed BOOLEAN DEFAULT false,

    -- Dates
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    metadata JSONB
);

CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_due_date ON activities(due_date);

-- ============================================================================
-- AGENT LOGS & EVENTS
-- ============================================================================

CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100) NOT NULL,
    activity_type VARCHAR(100),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_name);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);

CREATE TABLE agent_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    source_agent VARCHAR(100),
    target_agent VARCHAR(100),
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_events_type ON agent_events(event_type);
CREATE INDEX idx_agent_events_processed ON agent_events(processed);

-- ============================================================================
-- ANALYTICS & METRICS
-- ============================================================================

CREATE TABLE metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,

    -- Sales Metrics
    leads_total INTEGER DEFAULT 0,
    leads_qualified INTEGER DEFAULT 0,
    deals_created INTEGER DEFAULT 0,
    deals_won INTEGER DEFAULT 0,
    deals_lost INTEGER DEFAULT 0,
    revenue_won DECIMAL(12, 2) DEFAULT 0,

    -- Customer Metrics
    customers_total INTEGER DEFAULT 0,
    customers_churned INTEGER DEFAULT 0,
    mrr_total DECIMAL(12, 2) DEFAULT 0,
    arr_total DECIMAL(12, 2) DEFAULT 0,

    -- Pipeline Metrics
    pipeline_value DECIMAL(12, 2) DEFAULT 0,
    avg_deal_size DECIMAL(12, 2) DEFAULT 0,
    avg_sales_cycle_days INTEGER DEFAULT 0,

    -- Success Metrics
    avg_health_score INTEGER DEFAULT 0,
    avg_nps_score INTEGER DEFAULT 0,
    avg_csat_score DECIMAL(3, 2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(metric_date)
);

CREATE INDEX idx_metrics_date ON metrics_daily(metric_date DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample company
INSERT INTO companies (name, domain, industry, company_size) VALUES
    ('Acme Corporation', 'acme.com', 'Technology', 'enterprise'),
    ('TechStart Inc', 'techstart.io', 'SaaS', 'medium');

-- Insert sample contacts
INSERT INTO contacts (company_id, email, first_name, last_name, job_title, job_level, lead_score, lead_status)
SELECT
    id,
    'john.doe@acme.com',
    'John',
    'Doe',
    'VP of Engineering',
    'executive',
    85,
    'qualified'
FROM companies WHERE domain = 'acme.com';
