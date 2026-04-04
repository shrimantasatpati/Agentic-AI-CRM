'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, TrendingUp, Check } from 'lucide-react';
import AgentPageLayout from '@/components/AgentPageLayout';
import ScoreGauge from '@/components/ScoreGauge';
import type { CustomerSuccessResult } from '@/types';

const COLOR = '#ff9500';

const STEPS = [
  { name: 'Loading customer profile', output: 'Customer record loaded · Acme Corp · MRR: $3,200' },
  { name: 'Calculating health score', output: 'Health score: 34/100 · Trend: declining for 3 weeks' },
  { name: 'Assessing churn risk', output: 'Churn risk: CRITICAL · Probability: 78% · Red flags: 3' },
  { name: 'Analyzing engagement patterns', output: 'Logins: ↓ 80% · Feature adoption: 22% · Last login: 8 days ago' },
  { name: 'Identifying upsell opportunities', output: '2 upsell opportunities identified despite churn risk' },
  { name: 'Generating action recommendations', output: '5 priority actions generated · Retention playbook triggered' },
  { name: 'Publishing alerts if at-risk', output: 'Critical churn alert published → Customer Success team notified' },
];

const EXAMPLES = [
  {
    label: 'Critical Churn Risk',
    data: { customer_id: 'cust_001', company_name: 'Acme Corp', mrr: '3200', health_score: '34', last_login_days: '8' },
  },
  {
    label: 'Healthy Customer',
    data: { customer_id: 'cust_002', company_name: 'TechVista Inc', mrr: '8500', health_score: '88', last_login_days: '1' },
  },
  {
    label: 'Medium Risk',
    data: { customer_id: 'cust_003', company_name: 'RetailCo', mrr: '1800', health_score: '55', last_login_days: '4' },
  },
];

const MOCK_RESULT: CustomerSuccessResult = {
  customer_id: 'cust_001',
  company_name: 'Acme Corp',
  health_score: 34,
  churn_risk: {
    level: 'critical',
    probability: 78,
    factors: [
      'Login frequency dropped 80% in last 30 days',
      'Support tickets unresolved for 12+ days',
      'No responses to last 3 outreach attempts',
      'Champion contact left the company',
    ],
  },
  engagement: {
    logins_per_week: 0.8,
    feature_adoption_pct: 22,
    last_login: '8 days ago',
  },
  upsell_opportunities: [
    { type: 'Expansion', description: 'Analytics Pro add-on matches their use case', confidence: 0.45, estimated_value: 800 },
    { type: 'Seats', description: 'Marketing team not yet onboarded (15 seats available)', confidence: 0.30, estimated_value: 600 },
  ],
  recommended_actions: [
    { priority: 'high', action: 'Emergency executive call — CEO to CEO outreach within 24 hours', due_date: 'Today' },
    { priority: 'high', action: 'Assign dedicated CSM for white-glove support intervention', due_date: 'Today' },
    { priority: 'high', action: 'Resolve all open support tickets immediately and issue SLA credit', due_date: 'Today' },
    { priority: 'medium', action: 'Identify new champion — schedule onboarding for incoming contact', due_date: 'This week' },
    { priority: 'low', action: 'Send updated product roadmap — aligns with their key requests', due_date: 'Next week' },
  ],
};

const churnColors: Record<string, string> = {
  low: '#34c759', medium: '#ff9500', high: '#ff6b00', critical: '#ff3b30',
};
const churnBadge: Record<string, string> = {
  low: 'badge-green', medium: 'badge-orange', high: 'badge-red', critical: 'badge-red',
};

export default function CustomersPage() {
  const [result, setResult]         = useState<CustomerSuccessResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    try {
      await fetch(`http://localhost:8000/api/agents/monitor-customer/${formData.customer_id || 'cust_001'}`, {
        method: 'POST',
      }).catch(() => null);
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, STEPS.length * 500 + 600));
    setResult({ ...MOCK_RESULT, company_name: formData.company_name || MOCK_RESULT.company_name });
    setIsComplete(true);
  }, []);

  return (
    <AgentPageLayout
      agentName="Customer Success"
      agentDescription="Monitors customer health scores, detects churn risk, analyzes engagement, and identifies upsell opportunities."
      agentColor={COLOR}
      agentEmoji="🎉"
      formFields={[
        { key: 'company_name', label: 'Company Name', placeholder: 'Acme Corp' },
        { key: 'customer_id', label: 'Customer ID', placeholder: 'cust_001' },
        { key: 'mrr', label: 'Monthly Recurring Revenue ($)', placeholder: '3200' },
        { key: 'health_score', label: 'Current Health Score (0–100)', placeholder: '34' },
        { key: 'last_login_days', label: 'Days Since Last Login', placeholder: '8' },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
      resultNode={result && (
        <div className="space-y-4">
          {/* Health + Churn Risk */}
          <div className="apple-card flex gap-6 items-center">
            <ScoreGauge score={result.health_score} size={110} label="Health" />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Churn Risk</p>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`badge ${churnBadge[result.churn_risk.level]}`}
                  style={{ fontSize: 16, padding: '6px 16px', fontWeight: 700, letterSpacing: '0.05em' }}
                >
                  {result.churn_risk.level.toUpperCase()}
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: churnColors[result.churn_risk.level] }}>
                  {result.churn_risk.probability}%
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Churn probability this quarter</p>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Engagement Metrics</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#ff3b30' }}>{result.engagement.logins_per_week}/wk</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Logins</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#ff9500' }}>{result.engagement.feature_adoption_pct}%</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Feature Adoption</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{result.engagement.last_login}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Last Login</p>
              </div>
            </div>
          </div>

          {/* Churn Risk Factors */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Risk Factors</p>
            <div className="space-y-2">
              {result.churn_risk.factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg"
                  style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
                  <AlertTriangle size={13} color="#ff3b30" className="flex-shrink-0 mt-0.5" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upsell Opportunities */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Upsell Opportunities</p>
            <div className="space-y-3">
              {result.upsell_opportunities.map((u, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-secondary)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-teal">{u.type}</span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                      Confidence: {Math.round(u.confidence * 100)}%
                    </span>
                    <span className="text-xs font-semibold" style={{ color: COLOR }}>+${u.estimated_value}/mo</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{u.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Recommended Actions</p>
            <div className="space-y-2">
              {result.recommended_actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{
                    background: a.priority === 'high' ? 'rgba(255,59,48,0.05)' : 'var(--bg-input)',
                    border: `1px solid ${a.priority === 'high' ? 'rgba(255,59,48,0.15)' : 'var(--border-secondary)'}`,
                  }}>
                  <span className={`badge badge-${a.priority === 'high' ? 'red' : a.priority === 'medium' ? 'orange' : 'gray'} flex-shrink-0`}>
                    {a.priority}
                  </span>
                  <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{a.action}</span>
                  {a.due_date && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{a.due_date}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
}
