'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingDown, Calendar, Check, Loader } from 'lucide-react';
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

interface DealOption {
  id: string;
  name: string;
  stage: string;
  value: number;
  health_score: number;
  is_stalled: boolean;
}

const STAGE_COLOR: Record<string, string> = {
  prospecting: '#8e8e93', qualification: '#ff9500', proposal: '#5e5ce6',
  negotiation: '#ff6b00', closed_won: '#34c759', closed_lost: '#ff3b30',
};

export default function PipelinePage() {
  const [result, setResult]               = useState<SalesPipelineResult | null>(null);
  const [isComplete, setIsComplete]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [checkedActions, setCheckedActions] = useState<Set<number>>(new Set());

  // Deal list from CRM DB
  const [deals, setDeals]         = useState<DealOption[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<DealOption | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/deals/list')
      .then(r => r.ok ? r.json() : [])
      .then((data: DealOption[]) => {
        setDeals(data);
        // Removed auto-selection to force user choice
      })
      .catch(() => {})
      .finally(() => setDealsLoading(false));
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedDeal) return;
    setError(null);
    setIsComplete(false);
    setCheckedActions(new Set());

    const res = await fetch(`http://localhost:8000/api/agents/analyze-deal/${selectedDeal.id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (res) {
      setResult({
        deal_id: selectedDeal.id,
        deal_name: selectedDeal.name,
        health_score: res.health_score ?? selectedDeal.health_score,
        close_probability: res.close_probability ?? 50,
        is_stalled: res.is_stalled ?? selectedDeal.is_stalled,
        risk_factors: res.risk_factors ?? [],
        next_actions: res.next_actions ?? [],
        forecast_close_date: res.forecast_close_date ?? '—',
        recommendations: res.recommendations ?? [],
      });
    } else {
      setError('Agent did not return a result — check backend logs');
      setResult({
        deal_id: selectedDeal.id,
        deal_name: selectedDeal.name,
        health_score: selectedDeal.health_score,
        close_probability: 50,
        is_stalled: selectedDeal.is_stalled,
        risk_factors: [],
        next_actions: ['Connect backend and re-run agent'],
        forecast_close_date: '—',
        recommendations: [],
      });
    }
    setIsComplete(true);
  }, [selectedDeal]);

  const toggleAction = (i: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // Wrap handleRun for AgentPageLayout (which passes formData but we ignore it)
  const handleRunWrapped = useCallback(async (_fd: Record<string, string>) => {
    await handleRun();
  }, [handleRun]);

  const dealSelector = (
    <div className="apple-card mb-4">
      <h3 className="font-700 text-sm mb-3" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
        Select Deal from CRM
      </h3>
      {dealsLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader size={14} color={COLOR} className="animate-spin" />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading deals from CRM…</span>
        </div>
      ) : deals.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No deals found in CRM database. Run the seed script.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {deals.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDeal(d)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
              style={{
                background: selectedDeal?.id === d.id ? `${COLOR}15` : 'var(--bg-input)',
                border: `1px solid ${selectedDeal?.id === d.id ? `${COLOR}40` : 'var(--border-secondary)'}`,
              }}>
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: STAGE_COLOR[d.stage] || '#8e8e93' }} />
                <span className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                  {d.name}
                </span>
                {d.is_stalled && (
                  <span className="badge badge-red text-xs flex-shrink-0">Stalled</span>
                )}
              </div>
              <div className="flex gap-2 mt-1 ml-4">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{d.stage}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  ${(d.value ?? 0).toLocaleString()}
                </span>
                <span className="text-xs" style={{ color: d.health_score >= 70 ? '#34c759' : d.health_score >= 40 ? '#ff9500' : '#ff3b30' }}>
                  Health {d.health_score}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <AgentPageLayout
      agentName="Sales Pipeline"
      agentDescription="Analyzes deal health, predicts close probability, detects stall conditions, and generates actionable recommendations — using live CRM deal data."
      agentColor={COLOR}
      agentEmoji="💰"
      formFields={[]}
      defaultValues={{}}
      examples={[]}
      steps={STEPS}
      onRun={handleRunWrapped}
      isComplete={isComplete}
      isReady={!!selectedDeal}
      headerExtra={dealSelector}
      resultNode={result && (
        <div className="space-y-4">
          {/* Deal title */}
          <div className="apple-card py-2 px-3" style={{ borderColor: `${COLOR}30` }}>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Analyzing</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{result.deal_name}</p>
          </div>

          {/* Stalled Banner */}
          {result.is_stalled && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)' }}>
              <AlertTriangle size={16} color="#ff3b30" />
              <span className="font-semibold text-sm" style={{ color: '#ff3b30' }}>Deal Stalled — No Recent Activity</span>
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
          {result.risk_factors?.length > 0 && (
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
          )}

          {/* Next Actions */}
          {result.next_actions?.length > 0 && (
            <div className="apple-card">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Next Actions</p>
              <div className="space-y-2">
                {result.next_actions.map((a, i) => (
                  <button key={i}
                    className="flex items-center gap-3 w-full text-left p-3 rounded-xl transition-all"
                    onClick={() => toggleAction(i)}
                    style={{
                      background: checkedActions.has(i) ? 'rgba(52,199,89,0.08)' : 'var(--bg-input)',
                      border: `1px solid ${checkedActions.has(i) ? 'rgba(52,199,89,0.25)' : 'var(--border-secondary)'}`,
                    }}>
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
                <button className="btn-secondary w-full"><Calendar size={14} /> Schedule Follow-up Meeting</button>
              </Link>
            </div>
          )}
        </div>
      )}
    />
  );
}
