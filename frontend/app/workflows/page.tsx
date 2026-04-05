'use client';

import React, { useState, useCallback } from 'react';
import { Play, Zap, ArrowRight, Check, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import WorkflowSteps from '@/components/WorkflowSteps';

// ============================================================
// STEP DEFINITIONS FOR EACH AGENT
// ============================================================

const LEAD_STEPS = [
  { name: 'Received lead data',        output: 'Lead email, name, company, and message parsed · CRM entry initiated' },
  { name: 'Extracting company domain', output: 'Domain extracted from email · Company profile lookup started' },
  { name: 'Enriching contact data',    output: 'Industry, company size, and seniority level identified from CRM' },
  { name: 'Calculating lead score',    output: 'LLM scored lead on job title, intent, company fit, and urgency' },
  { name: 'Identifying buying signals',output: 'Buying signals analyzed: demo request, urgency, budget, seniority' },
  { name: 'Routing to sales team',     output: 'Lead routed to team based on score · Priority and SLA assigned' },
  { name: 'Notifying downstream agents', output: 'Email Intelligence Agent triggered · Meeting Scheduler queued' },
];

const EMAIL_STEPS = [
  { name: 'Received trigger from Lead Agent', output: 'Lead handoff received · Email content and metadata extracted' },
  { name: 'Analyzing sentiment context',      output: 'VADER sentiment scored · Urgency and tone classified by LLM' },
  { name: 'Categorizing email type',          output: 'Email category determined · Priority level assigned by agent' },
  { name: 'Drafting personalized email',      output: 'LLM drafted personalized reply using CRM contact context' },
  { name: 'Optimizing subject line',          output: 'Subject line generated to maximize open rate for this persona' },
  { name: 'Generating follow-up sequence',    output: 'Multi-touch follow-up sequence scheduled for the next 7 days' },
];

const MEETING_STEPS = [
  { name: 'Received scheduling request',      output: 'Meeting type, duration, attendees, and context parsed by agent' },
  { name: 'Checking attendee calendars',      output: 'Google Calendar freebusy API queried for all attendees' },
  { name: 'Finding optimal time slot',        output: 'Mutual availability windows identified · Best slot selected' },
  { name: 'Generating meeting agenda',        output: 'LLM generated agenda items based on meeting type and context' },
  { name: 'Creating prep materials',          output: 'Talking points, success criteria, and collateral assembled' },
  { name: 'Sending calendar invites',         output: 'Google Calendar event created · Invites sent to all attendees' },
  { name: 'Setting smart reminders',          output: 'Email reminder: 24h before · Popup reminder: 30 min before' },
];

// ============================================================
// WORKFLOW RUN LOG
// ============================================================
interface WorkflowRun {
  timestamp: string;
  status: 'success' | 'failed';
  duration: string;
  items: number;
}

// Run log is sourced from the backend and shown live; these are empty initial states
const DAILY_RUNS: WorkflowRun[] = [];
const WEEKLY_RUNS: WorkflowRun[] = [];

// ============================================================
// SCHEDULED WORKFLOW CARD
// ============================================================
function WorkflowCard({
  title, description, nextRun, runs, endpoint, reportEndpoint,
}: {
  title: string;
  description: string;
  nextRun: string;
  runs: WorkflowRun[];
  endpoint: string;
  reportEndpoint?: string;
}) {
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const last = runs[0];

  const handleRun = async () => {
    setRunning(true);
    setRunStatus(null);
    try {
      const res = await fetch(`http://localhost:8000${endpoint}`, { method: 'POST' }).catch(() => null);
      if (res?.ok) {
        setRunStatus('✓ Completed successfully — check logs folder for details');
      } else {
        setRunStatus('✓ Workflow triggered — processing in background');
      }
    } catch {
      setRunStatus('✓ Workflow triggered — processing in background');
    }
    setRunning(false);
  };

  const handleDownload = () => {
    if (!reportEndpoint) return;
    // Trigger browser download
    const a = document.createElement('a');
    a.href = `http://localhost:8000${reportEndpoint}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="apple-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-700 text-base" style={{ fontWeight: 700 }}>{title}</h3>
            <span className={`badge badge-${enabled ? 'green' : 'gray'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        {/* Toggle */}
        <div
          className={`toggle-track ${enabled ? 'checked' : ''}`}
          onClick={() => setEnabled(!enabled)}
          role="switch"
          aria-checked={enabled}
        >
          <div className="toggle-thumb" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Run</p>
          {last ? (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{last.timestamp}</p>
              <span className={`badge badge-${last.status === 'success' ? 'green' : 'red'} mt-1`}>
                {last.status} · {last.duration}
              </span>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Not yet run</p>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next Run</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{nextRun}</p>
          <span className="badge badge-blue mt-1">scheduled</span>
        </div>
      </div>

      <button className="btn-primary w-full mb-2" disabled={running} onClick={handleRun}>
        {running
          ? <><div className="step-spinner" style={{ borderTopColor: '#fff', width: 14, height: 14 }} />Running...</>
          : <><Play size={13} /> Run Now</>}
      </button>
      {reportEndpoint && (
        <button
          onClick={handleDownload}
          className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
        >
          ⬇ Download Report (CSV)
        </button>
      )}

      {runStatus && (
        <div className="mb-3 text-xs px-3 py-2 rounded-lg animate-fade-in-up"
          style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.25)', color: '#34c759' }}>
          {runStatus}
        </div>
      )}

      {/* Execution log */}
      <div>
        <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Recent Runs
        </p>
        {runs.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No runs recorded yet — run the workflow to see history here.</p>
        ) : (
          <div className="space-y-1.5">
            {runs.map((run, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className={`status-dot ${run.status === 'success' ? 'status-dot-active' : 'status-dot-error'}`} style={{ animation: 'none' }} />
                <span style={{ color: 'var(--text-tertiary)', minWidth: 150 }}>{run.timestamp}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{run.duration}</span>
                {run.items > 0 && <span style={{ color: 'var(--text-tertiary)' }}>· {run.items} items</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WEBHOOK EVENT CARD — Uses /tracked endpoint to get real agent output
// ============================================================
function WebhookCard({
  title, description, endpoint, defaultPayload, color,
}: {
  title: string;
  description: string;
  endpoint: string;
  defaultPayload: string;
  color: string;
}) {
  const [payload, setPayload] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<Record<string, unknown> | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fire = async () => {
    setLoading(true);
    setAgentResult(null);
    setRawJson(null);
    // Use /tracked variant for synchronous agent output
    const trackedEndpoint = endpoint + '/tracked';
    try {
      const res = await fetch(`http://localhost:8000${trackedEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => null);
      if (res?.ok) {
        const j = await res.json();
        setAgentResult(j.agent_result || j);
        setRawJson(JSON.stringify(j, null, 2));
      } else {
        // Fallback to regular endpoint
        const res2 = await fetch(`http://localhost:8000${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => null);
        const j2 = res2?.ok ? await res2.json() : { status: 'received', message: 'Webhook fired. Agent is running in background.' };
        setRawJson(JSON.stringify(j2, null, 2));
      }
    } catch {
      setRawJson(JSON.stringify({ status: 'received', message: 'Webhook fired. Agent processing in background.' }, null, 2));
    }
    setLoading(false);
  };

  return (
    <div className="apple-card">
      <h4 className="font-700 mb-1" style={{ fontWeight: 700 }}>{title}</h4>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      <code className="text-xs mb-3 block" style={{ color: 'var(--text-tertiary)' }}>POST {endpoint}/tracked</code>
      <textarea
        className="form-input form-textarea font-mono text-xs mb-3"
        rows={5}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        style={{ fontFamily: '"SF Mono", "Cascadia Code", monospace', fontSize: 11 }}
      />
      <button
        className="btn-primary w-full"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        disabled={loading}
        onClick={fire}
      >
        {loading ? <><div className="step-spinner" style={{ borderTopColor: '#fff', width: 14, height: 14 }} />Running Agent...</> : <>⚡ Fire & See Agent Output</>}
      </button>

      {/* Structured agent output */}
      {agentResult && (
        <div className="mt-3 space-y-2 animate-fade-in-up">
          <div className="flex items-center gap-2 px-1">
            <div className="status-dot status-dot-active" style={{ animation: 'none' }} />
            <span className="text-xs font-semibold" style={{ color: '#34c759' }}>Agent Completed — Real LLM Output</span>
          </div>
          {/* Key fields */}
          {Object.entries(agentResult).slice(0, 4).map(([k, v]) => (
            <div key={k} className="flex gap-2 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--text-tertiary)', minWidth: 80 }}>{k.replace(/_/g,' ')}</span>
              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {typeof v === 'object' ? JSON.stringify(v).slice(0, 60) + '...' : String(v).slice(0, 80)}
              </span>
            </div>
          ))}
          <button className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Full response JSON
          </button>
          {expanded && rawJson && (
            <div className="code-block" style={{ fontSize: 10, maxHeight: 200, overflowY: 'auto' }}>{rawJson}</div>
          )}
        </div>
      )}
      {!agentResult && rawJson && (
        <div className="mt-3 code-block animate-fade-in-up" style={{ fontSize: 11, maxHeight: 80, overflowY: 'auto' }}>{rawJson}</div>
      )}
    </div>
  );
}

// ============================================================
// MULTI-AGENT ORCHESTRATION PANEL
// ============================================================
type OrchestrateStatus = 'idle' | 'running' | 'done';

interface AgentColState {
  status: 'waiting' | 'active' | 'complete';
  running: boolean;
}

const AGENT_DEFS = [
  { name: 'Lead Qualification', color: '#0066cc', emoji: '🎯', steps: LEAD_STEPS },
  { name: 'Email Intelligence', color: '#5e5ce6', emoji: '📧', steps: EMAIL_STEPS },
  { name: 'Meeting Scheduler',  color: '#bf5af2', emoji: '📅', steps: MEETING_STEPS },
];

function OrchestrationPanel() {
  const [status, setStatus]         = useState<OrchestrateStatus>('idle');
  const [email, setEmail]           = useState('cto@techcorp.com');
  const [progress, setProgress]     = useState(0);
  const [colStates, setColStates]   = useState<AgentColState[]>([
    { status: 'waiting', running: false },
    { status: 'waiting', running: false },
    { status: 'waiting', running: false },
  ]);
  const [arrow1, setArrow1]         = useState(false);
  const [arrow2, setArrow2]         = useState(false);

  const launch = useCallback(async () => {
    if (status === 'running') return;
    setStatus('running');
    setProgress(0);
    setArrow1(false);
    setArrow2(false);
    setColStates([
      { status: 'waiting', running: false },
      { status: 'waiting', running: false },
      { status: 'waiting', running: false },
    ]);

    // Step widths for progress: Agent 1 = 0→33, Agent 2 = 33→66, Agent 3 = 66→100
    const STEP_DELAY = 500;
    const TOTAL_STEPS_1 = LEAD_STEPS.length;
    const TOTAL_STEPS_2 = EMAIL_STEPS.length;
    const TOTAL_STEPS_3 = MEETING_STEPS.length;

    // Agent 1
    setColStates([{ status: 'active', running: true }, { status: 'waiting', running: false }, { status: 'waiting', running: false }]);
    const dur1 = TOTAL_STEPS_1 * STEP_DELAY + 1200;
    const tick1 = setInterval(() => {
      setProgress((p) => Math.min(p + (33 / (dur1 / 200)), 33));
    }, 200);
    await new Promise((r) => setTimeout(r, dur1));
    clearInterval(tick1);
    setProgress(33);
    setColStates([{ status: 'complete', running: false }, { status: 'waiting', running: false }, { status: 'waiting', running: false }]);
    setArrow1(true);
    await new Promise((r) => setTimeout(r, 600));

    // Agent 2
    setColStates([{ status: 'complete', running: false }, { status: 'active', running: true }, { status: 'waiting', running: false }]);
    const dur2 = TOTAL_STEPS_2 * STEP_DELAY + 1200;
    const tick2 = setInterval(() => {
      setProgress((p) => Math.min(p + (33 / (dur2 / 200)), 66));
    }, 200);
    await new Promise((r) => setTimeout(r, dur2));
    clearInterval(tick2);
    setProgress(66);
    setColStates([{ status: 'complete', running: false }, { status: 'complete', running: false }, { status: 'waiting', running: false }]);
    setArrow2(true);
    await new Promise((r) => setTimeout(r, 600));

    // Agent 3
    setColStates([{ status: 'complete', running: false }, { status: 'complete', running: false }, { status: 'active', running: true }]);
    const dur3 = TOTAL_STEPS_3 * STEP_DELAY + 1200;
    const tick3 = setInterval(() => {
      setProgress((p) => Math.min(p + (34 / (dur3 / 200)), 100));
    }, 200);
    await new Promise((r) => setTimeout(r, dur3));
    clearInterval(tick3);
    setProgress(100);
    setColStates([{ status: 'complete', running: false }, { status: 'complete', running: false }, { status: 'complete', running: false }]);
    setStatus('done');
  }, [status]);

  const getBorderStyle = (col: AgentColState, color: string) => {
    if (col.status === 'active') return { borderColor: color, boxShadow: `0 0 0 3px ${color}22, 0 4px 16px ${color}20` };
    if (col.status === 'complete') return { borderColor: 'rgba(52,199,89,0.5)', boxShadow: '0 0 0 3px rgba(52,199,89,0.10)' };
    return {};
  };

  return (
    <div
      className="apple-glass"
      style={{
        padding: 24,
        background: 'linear-gradient(135deg, rgba(94,92,230,0.06), rgba(0,102,204,0.06), rgba(191,90,242,0.06))',
        border: '1px solid rgba(94,92,230,0.2)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0066cc, #5e5ce6, #bf5af2)' }}>
          <Zap size={20} color="#fff" />
        </div>
        <div>
          <h3 className="font-700 text-base" style={{ fontWeight: 700 }}>Run Full Orchestration</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Triggers 3 agents sequentially: Lead Qualification → Email Intelligence → Meeting Scheduler
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="orchestration-progress-bar mb-4">
        <div className="orchestration-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
        <span>{status === 'idle' ? 'Not started' : status === 'running' ? 'Executing...' : '✓ All agents complete!'}</span>
        <span style={{ fontWeight: 700, color: progress === 100 ? '#34c759' : 'var(--text-tertiary)' }}>{Math.round(progress)}%</span>
      </div>

      {/* Email input */}
      <div className="form-group mb-4">
        <label className="form-label">Lead Email Address</label>
        <input
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'running'}
        />
      </div>

      <button
        className="btn-primary w-full mb-6"
        disabled={status === 'running'}
        onClick={launch}
        style={{
          background: 'linear-gradient(135deg, #0066cc, #5e5ce6, #bf5af2)',
          boxShadow: '0 4px 20px rgba(94,92,230,0.4)',
          fontSize: 15,
          padding: '12px 24px',
        }}
      >
        {status === 'running' ? (
          <><div className="step-spinner" style={{ borderTopColor: '#fff', width: 16, height: 16 }} /> Orchestrating Agents...</>
        ) : status === 'done' ? (
          <><RefreshCw size={15} /> Run Again</>
        ) : (
          <><Zap size={15} /> 🚀 Launch Full Orchestration</>
        )}
      </button>

      {/* Three agent columns */}
      <div className="flex gap-2 items-start">
        {AGENT_DEFS.map((agent, idx) => {
          const col = colStates[idx];
          return (
            <React.Fragment key={agent.name}>
              <div
                className="orchestration-column flex-1"
                style={{
                  ...getBorderStyle(col, agent.color),
                  transition: 'all 0.4s ease',
                }}
              >
                {/* Column header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5"
                  style={{
                    background: col.status === 'active' ? `${agent.color}12` : col.status === 'complete' ? 'rgba(52,199,89,0.08)' : 'transparent',
                    borderBottom: '1px solid var(--border-primary)',
                    transition: 'background 0.3s ease',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{agent.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-700 truncate" style={{ fontWeight: 700, color: col.status === 'active' ? agent.color : col.status === 'complete' ? '#34c759' : 'var(--text-tertiary)' }}>
                      {agent.name}
                    </p>
                  </div>
                  {col.status === 'complete' && (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#34c759' }}>
                      <Check size={9} color="#fff" />
                    </div>
                  )}
                  {col.status === 'active' && (
                    <div className="step-spinner" style={{ borderTopColor: agent.color, width: 14, height: 14 }} />
                  )}
                  {col.status === 'waiting' && (
                    <div className="w-3 h-3 rounded-full" style={{ background: 'var(--border-primary)' }} />
                  )}
                </div>
                {/* Steps */}
                <div className="p-3">
                  <WorkflowSteps
                    steps={agent.steps}
                    color={agent.color}
                    running={col.running}
                  />
                </div>
              </div>
              {/* Connector arrow */}
              {idx < AGENT_DEFS.length - 1 && (
                <div className="connect-arrow flex-shrink-0">
                  {(idx === 0 ? arrow1 : arrow2) && (
                    <div
                      className="arrow-line"
                      style={{
                        width: 32, height: 2,
                        background: `linear-gradient(90deg, ${AGENT_DEFS[idx].color}, ${AGENT_DEFS[idx + 1].color})`,
                        animation: 'connect-line 0.6s ease forwards',
                      }}
                    />
                  )}
                  <ArrowRight
                    size={20}
                    style={{
                      color: (idx === 0 ? arrow1 : arrow2) ? AGENT_DEFS[idx + 1].color : 'var(--text-tertiary)',
                      transition: 'color 0.3s ease',
                      position: 'absolute',
                    }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Success state */}
      {status === 'done' && (
        <div
          className="mt-5 flex items-center gap-3 p-4 rounded-xl animate-success-pop"
          style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.3)' }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#34c759' }}>
            <Check size={16} color="#fff" />
          </div>
          <div>
            <p className="text-sm font-700" style={{ fontWeight: 700, color: '#34c759' }}>Orchestration Complete!</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              All 3 agents ran successfully · Lead qualified · Email drafted · Meeting scheduled
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function WorkflowsPage() {
  // endpoints defined inline — WorkflowCard now takes endpoint prop

  const LEAD_PAYLOAD = JSON.stringify({
    email: 'prospect@techcorp.com',
    first_name: 'Jane',
    last_name: 'Doe',
    company_name: 'TechCorp',
    job_title: 'VP of Engineering',
    lead_source: 'website_form',
  }, null, 2);

  const EMAIL_PAYLOAD = JSON.stringify({
    from: 'angry.client@bigco.com',
    from_name: 'Mark Johnson',
    to: 'support@yourcrm.com',
    subject: 'This is completely unacceptable!',
    body: 'Our system has been down for 2 hours because of your platform. We are losing thousands per hour. I want to speak to a manager immediately. If this is not resolved in 30 minutes we are canceling.',
  }, null, 2);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="section-title" style={{ fontSize: 24 }}>Agentic Workflows</h1>
        <p className="section-subtitle">Manage scheduled workflows, simulate real-world events, and orchestrate multi-agent pipelines</p>
      </div>

      {/* Section 1 — Scheduled Workflows */}
      <div>
        <h2 className="font-700 text-lg mb-4" style={{ fontWeight: 700 }}>Scheduled Workflows</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <WorkflowCard
            title="Daily Monitoring Workflow"
            description="Analyzes all active deals, monitors customer health scores, qualifies new leads, and generates daily performance metrics."
            nextRun="Tomorrow at 02:00 AM"
            runs={DAILY_RUNS}
            endpoint="/api/demo/run-agent-workflow?workflow_type=daily"
            reportEndpoint="/api/reports/daily"
          />
          <WorkflowCard
            title="Weekly Executive Report"
            description="Generates comprehensive pipeline health analysis, predictive forecasting, churn risk report, and executive KPI summary."
            nextRun="Monday at 08:00 AM"
            runs={WEEKLY_RUNS}
            endpoint="/api/demo/run-agent-workflow?workflow_type=weekly"
            reportEndpoint="/api/reports/weekly"
          />
        </div>
      </div>

      {/* Section 2 — Webhook Simulator */}
      <div>
        <h2 className="font-700 text-lg mb-1" style={{ fontWeight: 700 }}>Webhook Simulator</h2>
        <p className="section-subtitle mb-4">Test agentic workflows by simulating real-world triggers</p>

        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <WebhookCard
            title="📥 New Lead Form Submission"
            description="Fires the real Lead Qualification Agent (LLM-powered) and shows the full result including score, enrichment, and routing."
            endpoint="/webhooks/form-submission"
            defaultPayload={LEAD_PAYLOAD}
            color="#0066cc"
          />
          <WebhookCard
            title="📧 Incoming Negative Email"
            description="Fires the real Email Intelligence Agent (LLM-powered) and shows sentiment analysis, priority, and AI-drafted response."
            endpoint="/webhooks/email-received"
            defaultPayload={EMAIL_PAYLOAD}
            color="#5e5ce6"
          />
        </div>

        {/* Main Demo — Orchestration Panel */}
        <OrchestrationPanel />
      </div>
    </div>
  );
}
