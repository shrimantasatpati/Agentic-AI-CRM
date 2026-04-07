'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingDown, Calendar, Check, Loader, DollarSign, Search } from 'lucide-react';
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

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    // Use selected deal ID if available, otherwise fallback to form input
    const targetId = selectedDeal?.id || formData.deal_id;
    const targetName = selectedDeal?.name || formData.deal_name || 'Unknown Deal';

    setError(null);
    setIsComplete(false);
    setCheckedActions(new Set());

    if (!targetId) {
      setError('Please select a deal from the list above or enter a Deal ID.');
      setIsComplete(true);
      return null;
    }

    const res = await fetch(`http://localhost:8000/api/agents/analyze-deal/${targetId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (res) {
      setResult({
        deal_id: targetId,
        deal_name: targetName,
        health_score: res.health_score ?? (selectedDeal?.health_score || 50),
        close_probability: res.close_probability ?? 50,
        is_stalled: res.is_stalled ?? false,
        risk_factors: res.risk_factors ?? [],
        next_actions: res.next_actions ?? [],
        forecast_close_date: res.forecast_close_date ?? '—',
        recommendations: res.recommendations ?? [],
      });
      setIsComplete(true);
      // Return real execution steps so WorkflowSteps can replay them
      return res.execution_steps ?? null;
    } else {
      setError('Agent did not return a result. Ensure the backend is running.');
      setIsComplete(true);
      return null;
    }
  }, [selectedDeal]);

  const toggleAction = (i: number) => {
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const dealSelector = (

    <div className="apple-card mb-4 overflow-hidden" style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-2">
          <DollarSign size={14} color={COLOR} />
          <h3 className="font-700 text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Select Active Deal
          </h3>
        </div>
        {!dealsLoading && (
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{deals.length} found</span>
            <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest text-right" style={{ minWidth: 90 }}>DB Score</div>
          </div>
        )}
      </div>
      
      {dealsLoading ? (
        <div className="flex items-center gap-2 p-6 justify-center">
          <Loader size={18} color={COLOR} className="animate-spin" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Retrieving from CRM…</span>
        </div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center bg-[var(--bg-tertiary)]">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-tertiary)' }}>No production deals found.</p>
          <Link href="/sources">
            <button className="btn-primary text-[10px] py-1 px-3">Go to Source Systems</button>
          </Link>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto custom-scrollbar">
          {deals.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDeal(d)}
              className="w-full text-left px-4 py-3 transition-colors border-b last:border-0 hover:bg-[var(--bg-tertiary)]"
              style={{
                borderColor: 'var(--border-secondary)',
                background: selectedDeal?.id === d.id ? `${COLOR}08` : 'transparent',
              }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`} 
                     style={{ background: `${STAGE_COLOR[d.stage]}15`, border: `1px solid ${STAGE_COLOR[d.stage]}30` }}>
                  <DollarSign size={14} style={{ color: STAGE_COLOR[d.stage] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-700 truncate" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {d.name.replace(/([a-f0-9]{4})[a-f0-9-]{28,}/gi, '$1')}
                    </span>
                    {selectedDeal?.id === d.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR }} />}
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: STAGE_COLOR[d.stage] }}>{d.stage.replace('_', ' ')}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">·</span>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>${(d.value ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0" style={{ minWidth: 90 }}>
                   <div className="text-[11px] font-bold" style={{ color: d.health_score >= 70 ? '#34c759' : d.health_score >= 40 ? '#ff9500' : '#ff3b30' }}>
                     {d.health_score}/100
                   </div>
                   <div className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase tracking-tight">DB Score</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-[1400px]">
      <AgentPageLayout
        agentId="SalesPipelineAgent"
        agentName="Sales Pipeline"
        agentDescription="Analyzes deal health, predicts close probability, detects stall conditions, and generates actionable recommendations — using live CRM deal data."
        agentColor={COLOR}
        agentEmoji="💰"
        formFields={[
          { key: 'deal_id', label: 'Deal ID (Optional)', placeholder: '12345...' },
          { key: 'deal_name', label: 'Deal Name', placeholder: 'Enterprise Expansion' }
        ]}
        defaultValues={{ deal_id: '', deal_name: '' }}
        examples={[]}
        steps={STEPS}
        onRun={handleRun}
        isComplete={isComplete}
        isReady={!!selectedDeal}
        externalFillValues={selectedDeal ? {
          deal_id: selectedDeal.id,
          deal_name: selectedDeal.name,
        } : null}
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
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)' }}>
                      <AlertTriangle size={14} color="#ff9500" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="apple-card">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>AI Recommendations</p>
              <div className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#34c75920' }}>
                      <Check size={10} color="#34c759" />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Actions */}
            {result.next_actions?.length > 0 && (
              <div className="apple-card">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Suggested Next Actions</p>
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
    </div>
  );
}
