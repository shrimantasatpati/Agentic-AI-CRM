'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, TrendingDown, Calendar, Check } from 'lucide-react';
import AgentPageLayout from '@/components/AgentPageLayout';
import ScoreGauge from '@/components/ScoreGauge';
import type { SalesPipelineResult } from '@/types';

const COLOR = '#34c759';

const STEPS = [
  { name: 'Loading deal data', output: 'Deal record, stage, value, and activity log retrieved from CRM' },
  { name: 'Calculating health score', output: 'LLM computed health score from engagement, activity, and stage data' },
  { name: 'Predicting close probability', output: 'Close probability predicted from stage, engagement, and signals' },
  { name: 'Checking for stall conditions', output: 'Last activity date checked · Stall threshold evaluated by agent' },
  { name: 'Identifying risk factors', output: 'Risk factors extracted: timeline gap, champion engagement, competition' },
  { name: 'Generating recommendations', output: 'LLM generated action items to unblock and accelerate the deal' },
  { name: 'Forecasting close date', output: 'Projected close date computed from pipeline velocity and stage rates' },
];

const EXAMPLES = [
  {
    label: 'Stalled Deal',
    data: { deal_id: 'deal_001', deal_name: 'Globex Enterprise License', stage: 'negotiation', value: '125000', days_since_activity: '14' },
  },
  {
    label: 'Hot Deal',
    data: { deal_id: 'deal_002', deal_name: 'TechVista Cloud Suite', stage: 'proposal', value: '87000', days_since_activity: '2' },
  },
  {
    label: 'At Risk',
    data: { deal_id: 'deal_003', deal_name: 'RetailCo CRM Rollout', stage: 'qualification', value: '45000', days_since_activity: '21' },
  },
];

const MOCK_RESULT: SalesPipelineResult = {
  deal_id: 'deal_001',
  deal_name: 'Globex Enterprise License',
  health_score: 62,
  close_probability: 71,
  is_stalled: true,
  risk_factors: [
    'No activity for 14 days — champion may have gone dark',
    'Budget approval cycle approaching end of quarter',
    'Competitor pitch suspected based on LinkedIn activity',
  ],
  next_actions: [
    'Send executive-to-executive video message from CEO',
    'Share new ROI case study from similar company',
    'Offer extended trial or proof-of-concept period',
    'Schedule technical deep-dive to re-engage IT team',
  ],
  forecast_close_date: 'May 2, 2026',
  recommendations: [
    'Re-engage immediately — deal shows warning signs but is recoverable',
    'Involve executive sponsor to restore deal momentum',
  ],
};

export default function PipelinePage() {
  const [result, setResult]         = useState<SalesPipelineResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    setCheckedActions(new Set());
    const [liveResult] = await Promise.all([
      fetch(`http://localhost:8000/api/agents/analyze-deal/${formData.deal_id || 'deal_001'}`, {
        method: 'POST',
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      new Promise((r) => setTimeout(r, STEPS.length * 500 + 600)),
    ]);
    const filled: SalesPipelineResult = liveResult ?? { ...MOCK_RESULT, deal_name: formData.deal_name || MOCK_RESULT.deal_name };
    if (!filled.risk_factors) filled.risk_factors = MOCK_RESULT.risk_factors;
    if (!filled.next_actions) filled.next_actions = MOCK_RESULT.next_actions;
    if (!filled.recommendations) filled.recommendations = MOCK_RESULT.recommendations;
    setResult(filled);
    setIsComplete(true);
  }, []);

  const toggleAction = (i: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <AgentPageLayout
      agentName="Sales Pipeline"
      agentDescription="Analyzes deal health, predicts close probability, detects stall conditions, and generates actionable recommendations."
      agentColor={COLOR}
      agentEmoji="💰"
      formFields={[
        { key: 'deal_name', label: 'Deal Name', placeholder: 'Globex Enterprise License' },
        { key: 'deal_id', label: 'Deal ID', placeholder: 'deal_001' },
        { key: 'stage', label: 'Current Stage', type: 'select', options: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won'] },
        { key: 'value', label: 'Deal Value ($)', placeholder: '125000' },
        { key: 'days_since_activity', label: 'Days Since Last Activity', placeholder: '14' },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
      resultNode={result && (
        <div className="space-y-4">
          {/* Stalled Banner */}
          {result.is_stalled && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)' }}>
              <AlertTriangle size={16} color="#ff3b30" />
              <span className="font-semibold text-sm" style={{ color: '#ff3b30' }}>Deal Stalled</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>No activity detected in {EXAMPLES[0].data.days_since_activity} days</span>
            </div>
          )}

          {/* Health + Close probability */}
          <div className="apple-card flex gap-6 items-center">
            <div className="text-center">
              <ScoreGauge score={result.health_score} size={110} label="Health" />
            </div>
            <div className="flex-1">
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Close Probability</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>{result.close_probability}%</span>
                  <TrendingDown size={20} color="#ff3b30" />
                  <span className="text-sm" style={{ color: '#ff3b30' }}>↓ 13% this week</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Forecast Close Date</p>
                <div className="flex items-center gap-2">
                  <Calendar size={14} color={COLOR} />
                  <span className="badge badge-green">{result.forecast_close_date}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Factors */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Risk Factors</p>
            <div className="space-y-2">
              {result.risk_factors.map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg"
                  style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
                  <AlertTriangle size={14} color="#ff3b30" className="flex-shrink-0 mt-0.5" />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Actions */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Next Actions</p>
            <div className="space-y-2">
              {result.next_actions.map((a, i) => (
                <button
                  key={i}
                  className="flex items-center gap-3 w-full text-left p-3 rounded-xl transition-all"
                  onClick={() => toggleAction(i)}
                  style={{
                    background: checkedActions.has(i) ? 'rgba(52,199,89,0.08)' : 'var(--bg-input)',
                    border: `1px solid ${checkedActions.has(i) ? 'rgba(52,199,89,0.25)' : 'var(--border-secondary)'}`,
                  }}
                >
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: checkedActions.has(i) ? COLOR : 'transparent', border: `1.5px solid ${checkedActions.has(i) ? COLOR : 'var(--text-tertiary)'}` }}>
                    {checkedActions.has(i) && <Check size={10} color="#fff" />}
                  </div>
                  <span className="text-sm" style={{ color: checkedActions.has(i) ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: checkedActions.has(i) ? 'line-through' : 'none' }}>
                    {a}
                  </span>
                </button>
              ))}
            </div>
            <div className="divider" />
            <Link href="/meetings">
              <button className="btn-secondary w-full">
                <Calendar size={14} />
                Schedule Follow-up Meeting
              </button>
            </Link>
          </div>
        </div>
      )}
    />
  );
}
