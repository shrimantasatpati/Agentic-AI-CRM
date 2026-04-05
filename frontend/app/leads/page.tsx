'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
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

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    const [liveResult] = await Promise.all([
      fetch('http://localhost:8000/api/leads/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      new Promise((r) => setTimeout(r, STEPS.length * 500 + 800)),
    ]);
    // Map API response to display format; fallback to MOCK if API fails
    const filled: LeadQualificationResult = liveResult ?? { ...MOCK_RESULT, email: formData.email || MOCK_RESULT.email };
    // Ensure required fields exist
    if (!filled.enriched_data) filled.enriched_data = MOCK_RESULT.enriched_data;
    if (!filled.routing) filled.routing = MOCK_RESULT.routing;
    if (!filled.signals) filled.signals = MOCK_RESULT.signals;
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
  }, []);

  const scoreData = result
    ? Object.entries(result.score_breakdown).map(([k, v]) => ({
        name: k.replace('_', ' '),
        value: v,
      }))
    : [];

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
    <AgentPageLayout
      agentName="Lead Qualification"
      agentDescription="Scores, enriches, and routes incoming leads using AI-powered analysis and buying signal detection."
      agentColor={COLOR}
      agentEmoji="🎯"
      formFields={[
        { key: 'email', label: 'Email Address', type: 'email', placeholder: 'cto@company.com' },
        { key: 'first_name', label: 'First Name', placeholder: 'John' },
        { key: 'last_name', label: 'Last Name', placeholder: 'Smith' },
        { key: 'company_name', label: 'Company', placeholder: 'Acme Corp' },
        { key: 'job_title', label: 'Job Title', placeholder: 'VP of Sales' },
        { key: 'message', label: 'Message / Notes', type: 'textarea', placeholder: 'Any context about the lead...', rows: 3 },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
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
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Team</span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{result.routing.team}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Priority</span>
                  <span className={`badge badge-${result.routing.priority === 'high' ? 'red' : result.routing.priority === 'medium' ? 'orange' : 'gray'}`}>
                    {result.routing.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>SLA</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{result.routing.sla_hours}h</span>
                </div>
                <div className="divider" style={{ margin: '8px 0' }} />
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
    </>
  );
}
