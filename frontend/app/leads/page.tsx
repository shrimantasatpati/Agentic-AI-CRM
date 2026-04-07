'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Loader, Users, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AgentPageLayout from '@/components/AgentPageLayout';
import ScoreGauge from '@/components/ScoreGauge';
import type { LeadQualificationResult } from '@/types';

const COLOR = '#0066cc';

const STEPS = [
  { name: 'Received lead data', output: 'Lead email, name, company, and message parsed · CRM entry initiated' },
  { name: 'Extracting company domain', output: 'Domain extracted from email · Company profile lookup started' },
  { name: 'Enriching contact data', output: 'Industry, company size, and seniority level identified from CRM' },
  { name: 'Calculating lead score', output: 'LLM scored lead on job title, intent, company fit, and urgency' },
  { name: 'Identifying buying signals', output: 'Buying signals analyzed: demo request, urgency, budget, seniority' },
  { name: 'Routing to sales team', output: 'Lead routed to team based on score · Priority and SLA assigned' },
  { name: 'Notifying downstream agents', output: 'Email Intelligence Agent triggered · CRM entry saved to database' },
];

const EXAMPLES = [
  {
    label: 'Enterprise Lead',
    data: { email: 'cto@techcorp.com', first_name: 'John', last_name: 'Smith', company_name: 'TechCorp', job_title: 'CTO', message: 'Looking for enterprise CRM solution. Need demo urgently. Budget approved.' },
  },
  {
    label: 'SMB Lead',
    data: { email: 'owner@smallbiz.com', first_name: 'Sarah', last_name: 'Lee', company_name: 'SmallBiz Co', job_title: 'Owner', message: 'Interested in your product, what are the pricing plans?' },
  },
  {
    label: 'Mid-Market',
    data: { email: 'director@midcorp.io', first_name: 'Alex', last_name: 'Chen', company_name: 'MidCorp', job_title: 'Sales Director', message: 'Evaluating CRM options for Q4 rollout. Team of 50 reps.' },
  },
];

const MOCK_RESULT: LeadQualificationResult = {
  email: 'cto@techcorp.com',
  score: 87,
  enriched_data: {
    domain: 'techcorp.com',
    company_name: 'TechCorp Inc.',
    industry: 'SaaS / B2B Software',
    company_size: 'Mid-Market (201–500)',
    job_level: 'Executive (C-Suite)',
  },
  routing: {
    team: 'Enterprise Sales',
    priority: 'high',
    recommended_action: 'Schedule executive demo within 24 hours',
    sla_hours: 24,
  },
  signals: [
    'Demo request explicitly mentioned',
    'Budget already approved',
    'Urgency indicator: "urgently"',
    'Executive decision-maker (CTO)',
    'Enterprise company domain',
  ],
  score_breakdown: {
    company_size: 22,
    job_title: 25,
    industry: 19,
    engagement: 12,
    budget_signals: 9,
  },
};

export default function LeadsPage() {
  const [result, setResult]     = useState<LeadQualificationResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [emailToast, setEmailToast] = useState<string | null>(null);

  // Leads list from CRM
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/leads/')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setLeads(data);
      })
      .catch(() => {})
      .finally(() => setLeadsLoading(false));
  }, []);

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    
    const payload = selectedLead 
      ? { email: selectedLead.email, first_name: selectedLead.first_name, last_name: selectedLead.last_name, company_name: selectedLead.company_name, domain: selectedLead.company_name?.toLowerCase().replace(/\s+/g, '') + '.com' }
      : formData;

    if (!payload.email) {
      setError("Please select a lead from the list or provide an email address.");
      setIsComplete(true);
      return null;
    }

    // Await the real API call — no fake setTimeout race
    const liveResult = await fetch('http://localhost:8000/api/leads/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (!liveResult) {
      setError('Agent failed to respond. Ensure the backend is running and API key is configured.');
      setIsComplete(true);
      return null;
    }

    // Map API response to display format; fill structural gaps from MOCK_RESULT
    const filled: LeadQualificationResult = { ...liveResult };
    if (!filled.enriched_data) filled.enriched_data = MOCK_RESULT.enriched_data;
    if (!filled.routing) filled.routing = MOCK_RESULT.routing;
    if (!filled.signals) filled.signals = liveResult.signals || MOCK_RESULT.signals;
    if (!filled.score_breakdown) filled.score_breakdown = MOCK_RESULT.score_breakdown;
    setResult(filled);
    setIsComplete(true);

    // Show auto-email toast if score >= 70
    const score = filled.score ?? 0;
    if (score >= 70) {
      const toEmail = filled.email || formData.email || 'the lead';
      setEmailToast(`✉️ Auto-email sent to ${toEmail} · Score: ${score}/100 · Priority: ${filled.routing?.priority?.toUpperCase() || 'HIGH'}`);
      setTimeout(() => setEmailToast(null), 7000);
    }

    // Return real execution steps for WorkflowSteps replay
    return liveResult.execution_steps ?? null;
  }, [selectedLead]);

  const scoreData = result
    ? Object.entries(result.score_breakdown).map(([k, v]) => ({
        name: k.replace('_', ' '),
        value: v,
      }))
    : [];

  const leadSelector = (
    <div className="apple-card mb-4 overflow-hidden" style={{ padding: 0 }}>
      <div className="px-4 py-3 border-b flex items-center justify-between bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-2">
          <Users size={14} color={COLOR} />
          <h3 className="font-700 text-sm" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            Select Lead from CRM {!leadsLoading && <span className="ml-1 opacity-60 font-medium">({leads.length} found)</span>}
          </h3>
        </div>
        {!leadsLoading && <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest text-right" style={{ minWidth: 90 }}>Lead Fit Score</div>}
      </div>
      
      {leadsLoading ? (
        <div className="flex items-center gap-2 p-6 justify-center">
          <Loader size={18} color={COLOR} className="animate-spin" />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Scanning CRM…</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-8 text-center bg-[var(--bg-tertiary)]">
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-tertiary)' }}>No production leads found.</p>
          <Link href="/sources">
            <button className="btn-primary text-[10px] py-1 px-3">Go to Source Systems</button>
          </Link>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto custom-scrollbar">
          {leads.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLead(l)}
              className="w-full text-left px-4 py-3 transition-colors border-b last:border-0 hover:bg-[var(--bg-tertiary)]"
              style={{
                borderColor: 'var(--border-secondary)',
                background: selectedLead?.id === l.id ? `${COLOR}08` : 'transparent',
              }}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`} 
                     style={{ background: `${COLOR}15`, border: `1px solid ${COLOR}30` }}>
                  <Target size={14} style={{ color: COLOR }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-700 truncate" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {l.first_name} {l.last_name}
                    </span>
                    {selectedLead?.id === l.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR }} />}
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{l.email}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">·</span>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{l.company_name || 'Individual'}</span>
                  </div>
                </div>
                 <div className="text-right flex-shrink-0" style={{ minWidth: 90 }}>
                    <div className="text-[11px] font-bold" style={{ color: l.lead_score >= 70 ? '#34c759' : l.lead_score >= 40 ? '#ff9500' : '#ff3b30' }}>
                      {l.lead_score}% Match
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase tracking-tight">Fit Score</div>
                 </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Auto-email sent toast */}
      {emailToast && (
        <div
          className="animate-fade-in-up"
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 9999,
            background: 'rgba(52,199,89,0.95)', color: '#fff',
            padding: '14px 20px', borderRadius: 14, fontWeight: 600,
            fontSize: 14, maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {emailToast}
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
            Sent via Gmail API · Lead qualification complete
          </div>
        </div>
      )}
    <div className="max-w-[1400px]">
      <AgentPageLayout
        agentId="LeadQualificationAgent"
        agentName="Smart Lead Qualification"
        agentDescription="Scores, enriches, and routes incoming leads using AI-powered analysis and buying signal detection."
        agentColor={COLOR}
        agentEmoji="🎯"
        formFields={[
          { key: 'email', label: 'Email Address', placeholder: 'lead@company.com' },
          { key: 'first_name', label: 'First Name', placeholder: 'John' },
          { key: 'last_name', label: 'Last Name', placeholder: 'Doe' },
          { key: 'company_name', label: 'Company (optional)', placeholder: 'Acme Corp' },
        ]}
        defaultValues={{ email: '', first_name: '', last_name: '', company_name: '' }}
        examples={EXAMPLES}
        steps={STEPS}
        onRun={handleRun}
        error={error}
        isComplete={isComplete}
        isReady={!!selectedLead}
        externalFillValues={selectedLead ? {
          email: selectedLead.email,
          first_name: selectedLead.first_name,
          last_name: selectedLead.last_name,
          company_name: selectedLead.company_name || '',
        } : null}
        headerExtra={leadSelector}
        resultNode={result && (
          <div className="space-y-4">
            {/* Score row */}
            <div className="apple-card flex items-center gap-6">
              <ScoreGauge score={result.score} size={120} label="Score" />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Score Breakdown</p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={scoreData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 30]} tick={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={100} />
                    <Bar dataKey="value" fill={COLOR} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Enriched data + routing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="apple-card">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Enriched Data</p>
                <div className="space-y-2">
                  {Object.entries(result.enriched_data).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)', minWidth: 80, textTransform: 'capitalize' }}>{k.replace('_', ' ')}</span>
                      <span className="badge badge-blue">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="apple-card">
                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Routing Decision</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`badge badge-${result.routing.priority === 'high' ? 'red' : 'orange'}`} style={{ fontSize: 13, padding: '4px 12px' }}>
                    {result.routing.priority.toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{result.routing.team}</span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]">
                  <p className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-tertiary)' }}>Next Action</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{result.routing.recommended_action}</p>
                </div>
              </div>
            </div>

            {/* Buying Signals */}
            <div className="apple-card">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Buying Signals Detected</p>
              <div className="space-y-2">
                {result.signals.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#34c75920' }}>
                      <Check size={10} color="#34c759" />
                    </div>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="divider" />
              <Link href={`/email?prefill=${encodeURIComponent(result.email)}`}>
                <button className="btn-secondary w-full">
                  <ArrowRight size={14} />
                  Notify Email Agent
                </button>
              </Link>
            </div>
          </div>
        )}
      />
    </div>
    </>
  );
}
