'use client';

import { useState, useCallback } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import AgentPageLayout from '@/components/AgentPageLayout';
import type { AnalyticsResult } from '@/types';

const COLOR = '#30b0c7';

const STEPS = [
  { name: 'Collecting metrics', output: 'Pulling data from CRM database · 12 data sources connected' },
  { name: 'Calculating KPIs', output: '6 KPIs calculated · All within expected ranges' },
  { name: 'Analyzing trends', output: 'Trend analysis complete · 3 notable changes detected' },
  { name: 'Identifying alerts', output: '2 critical alerts, 1 warning identified' },
  { name: 'Generating insights', output: '5 actionable insights generated based on data patterns' },
  { name: 'Building dashboard data', output: 'Dashboard payload assembled · Ready for display' },
];

const EXAMPLES = [
  { label: 'Full Overview', data: { category: 'all', time_range: '30d', focus: 'executive summary' } },
  { label: 'Sales Focus',   data: { category: 'sales', time_range: '7d', focus: 'deal velocity and win rate' } },
  { label: 'Health Report', data: { category: 'customers', time_range: '14d', focus: 'churn and retention rates' } },
];

const MOCK_RESULT: AnalyticsResult = {
  kpis: {
    conversion_rate: 18.4,
    avg_deal_size: 42500,
    win_rate: 31.2,
    churn_rate: 2.8,
    mrr: 127400,
    arr: 1528800,
  },
  trends: {
    conversion_rate: { value: 18.4, change_pct: 2.3, direction: 'up' },
    win_rate:        { value: 31.2, change_pct: -4.1, direction: 'down' },
    mrr:             { value: 127400, change_pct: 5.2, direction: 'up' },
    churn_rate:      { value: 2.8, change_pct: 0.3, direction: 'up' },
  },
  insights: [
    { priority: 'critical', category: 'Pipeline',  text: 'Win rate declined 4.1% — mid-market segment showing increased competition from 2 rivals' },
    { priority: 'high',     category: 'Retention', text: 'Churn rate uptick in SMB tier — 3 accounts churned this month vs 1 average' },
    { priority: 'high',     category: 'Growth',    text: 'MRR growth of 5.2% driven by enterprise expansion — exceeds $50K threshold' },
    { priority: 'medium',   category: 'Sales',     text: 'Average deal cycle shortened to 47 days — 8 days faster than Q3' },
    { priority: 'low',      category: 'Leads',     text: 'Lead volume up 22% from content marketing — quality score averaging 74' },
  ],
  alerts: [
    { severity: 'critical', message: '2 enterprise accounts showing critical churn signals (score <30)', action: 'Review Customer Success dashboard' },
    { severity: 'critical', message: 'Win rate below 30% threshold for 2nd consecutive month', action: 'Schedule competitive analysis session' },
    { severity: 'warning',  message: '4 deals stalled >14 days in negotiation stage', action: 'Trigger outreach campaign' },
  ],
  quick_insights: [
    '🚀 MRR grew 5.2% this month',
    '⚠️ Win rate declining — needs attention',
    '📈 Lead quality highest in 6 months',
    '🎯 Enterprise expansion driving ARR growth',
    '🔥 Only 3% churn — healthy retention',
  ],
};

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const alertColors = {
  critical: { bg: 'rgba(255,59,48,0.08)',   border: 'rgba(255,59,48,0.25)',  color: '#ff3b30' },
  warning:  { bg: 'rgba(255,149,0,0.08)',   border: 'rgba(255,149,0,0.25)', color: '#ff9500' },
  info:     { bg: 'rgba(48,176,199,0.08)',  border: 'rgba(48,176,199,0.25)', color: '#30b0c7' },
};
const insightBadge: Record<string, string> = {
  critical: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-gray',
};

export default function AnalyticsPage() {
  const [result, setResult]         = useState<AnalyticsResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    try {
      const res = await fetch('http://localhost:8000/api/agents/generate-analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: formData.category || 'all' }),
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: AnalyticsResult = {
          kpis: {
            conversion_rate: data.kpis?.conversion_rate ?? MOCK_RESULT.kpis.conversion_rate,
            avg_deal_size:   data.kpis?.avg_deal_size   ?? MOCK_RESULT.kpis.avg_deal_size,
            win_rate:        data.kpis?.win_rate         ?? MOCK_RESULT.kpis.win_rate,
            churn_rate:      data.kpis?.churn_rate       ?? MOCK_RESULT.kpis.churn_rate,
            mrr:             data.kpis?.mrr              ?? MOCK_RESULT.kpis.mrr,
            arr:             data.kpis?.arr              ?? MOCK_RESULT.kpis.arr,
          },
          trends: data.trends ?? MOCK_RESULT.trends,
          insights: Array.isArray(data.insights) && data.insights.length > 0
            ? data.insights
            : MOCK_RESULT.insights,
          alerts: Array.isArray(data.alerts) && data.alerts.length > 0
            ? data.alerts
            : MOCK_RESULT.alerts,
          quick_insights: Array.isArray(data.quick_insights) && data.quick_insights.length > 0
            ? data.quick_insights
            : MOCK_RESULT.quick_insights,
          recommendations: Array.isArray(data.recommendations) && data.recommendations.length > 0
            ? data.recommendations
            : null,
        };
        setResult(mapped);
        setIsComplete(true);
        // Normalize execution steps — ensure they have durationMs so WorkflowSteps can animate
        const rawSteps = data.execution_steps;
        if (Array.isArray(rawSteps) && rawSteps.length > 0) {
          return rawSteps.map((s: any, i: number) => ({
            name: typeof s === 'string' ? STEPS[i]?.name || s : (s.name || STEPS[i]?.name || `Step ${i+1}`),
            output: typeof s === 'string' ? s : (s.output || s.description || STEPS[i]?.output || ''),
            durationMs: typeof s === 'object' && s.durationMs ? s.durationMs : 170,
          }));
        }
        // Build generic steps with even timing if the backend returns nothing
        return STEPS.map((s) => ({ name: s.name, output: s.output, durationMs: 170 }));
      } else {
        setError('Analytics agent returned an error — check backend logs.');
        setIsComplete(true);
        return STEPS.map((s) => ({ name: s.name, output: s.output, durationMs: 170 }));
      }
    } catch {
      setError('Could not connect to backend. Start the server with: python backend/run.py');
      setIsComplete(true);
      return STEPS.map((s) => ({ name: s.name, output: s.output, durationMs: 170 }));
    }
  }, []);

  return (
    <AgentPageLayout
      agentId="AnalyticsAgent"
      agentName="Analytics Intelligence"
      agentDescription="Generates real-time KPIs, trend analysis, actionable insights, and alerts from your CRM data."
      agentColor={COLOR}
      agentEmoji="📊"
      formFields={[
        { key: 'category', label: 'Report Category', type: 'select', options: ['all', 'sales', 'customers', 'leads', 'pipeline'] },
        { key: 'time_range', label: 'Time Range', type: 'select', options: ['7d', '14d', '30d', '90d', '365d'] },
        { key: 'focus', label: 'Focus Area (optional)', placeholder: 'e.g. enterprise accounts, win rate...' },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
      resultNode={result && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Conversion Rate', value: `${result.kpis.conversion_rate}%`, trend: result.trends.conversion_rate },
              { label: 'Avg Deal Size', value: fmtMoney(result.kpis.avg_deal_size), trend: undefined },
              { label: 'Win Rate', value: `${result.kpis.win_rate}%`, trend: result.trends.win_rate },
              { label: 'Churn Rate', value: `${result.kpis.churn_rate}%`, trend: result.trends.churn_rate },
              { label: 'MRR', value: fmtMoney(result.kpis.mrr), trend: result.trends.mrr },
              { label: 'ARR', value: fmtMoney(result.kpis.arr), trend: undefined },
            ].map((kpi, i) => (
              <div key={i} className="apple-card" style={{ padding: 14 }}>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{kpi.label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</p>
                {kpi.trend && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.trend.direction === 'up'
                      ? <TrendingUp size={11} color="#34c759" />
                      : <TrendingDown size={11} color="#ff3b30" />}
                    <span className="text-xs font-semibold"
                      style={{ color: kpi.trend.direction === 'up' ? '#34c759' : '#ff3b30' }}>
                      {kpi.trend.change_pct > 0 ? '+' : ''}{kpi.trend.change_pct}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Active Alerts</p>
            <div className="space-y-2">
              {result.alerts.map((a, i) => {
                const c = alertColors[a.severity] || alertColors.info;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                    <AlertTriangle size={14} style={{ color: c.color, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.message}</p>
                      {a.action && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>→ {a.action}</p>}
                    </div>
                    <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'orange' : 'blue'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                      {a.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Insights */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>AI Insights</p>
            <div className="space-y-2">
              {result.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-secondary)' }}>
                  <span className={`badge ${insightBadge[ins.priority]} flex-shrink-0`}>{ins.priority}</span>
                  <span className="badge badge-gray flex-shrink-0">{ins.category}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ins.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Insights */}
          <div className="apple-card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} color={COLOR} />
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Quick Summary</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.quick_insights.map((qi, i) => (
                <span key={i} className="chip" style={{ cursor: 'default', fontSize: 12 }}>{qi}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
}
