'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Calendar, Clock, Users, Check, RefreshCw, ExternalLink } from 'lucide-react';
import AgentPageLayout from '@/components/AgentPageLayout';
import type { MeetingSchedulerResult } from '@/types';

const COLOR = '#bf5af2';

const STEPS = [
  { name: 'Parsing meeting request', output: 'Request parsed · Type: Executive Demo · Duration: 60 min' },
  { name: 'Checking attendee calendars', output: '3 attendees found · 2 calendars fetched · 1 external' },
  { name: 'Finding available slots', output: '8 mutual availability windows identified this week' },
  { name: 'Selecting optimal time', output: 'Optimal slot: Tue Apr 8, 2:00 PM — score: 94/100' },
  { name: 'Generating meeting agenda', output: '5-point agenda created based on meeting type and context' },
  { name: 'Creating prep materials', output: 'Talking points, success criteria, and collateral assembled' },
  { name: 'Setting reminders', output: 'Reminders set: 24h, 1h before · Calendar invites queued' },
];

const EXAMPLES = [
  {
    label: 'Executive Demo',
    data: { title: 'Enterprise CRM Demo', meeting_type: 'demo', duration: '60', attendees: 'cto@techcorp.com, sales@yourcrm.com', notes: 'Prospect is evaluating 3 CRMs. Focus on AI features and ROI.' },
  },
  {
    label: 'QBR Meeting',
    data: { title: 'Q1 Business Review', meeting_type: 'qbr', duration: '90', attendees: 'cso@acmecorp.com, csm@yourcrm.com', notes: 'Account is at churn risk. Needs to see value before renewal.' },
  },
  {
    label: 'Deal Follow-up',
    data: { title: 'Proposal Follow-up Call', meeting_type: 'follow_up', duration: '30', attendees: 'vp@globex.com, ae@yourcrm.com', notes: 'Deal stalled 14 days. Re-engage with new ROI calculator.' },
  },
];

const MOCK_RESULT: MeetingSchedulerResult = {
  scheduled_time: 'Tuesday, April 8, 2026 · 2:00 PM EST',
  duration_minutes: 60,
  meeting_type: 'Executive Demo',
  attendees: ['john.smith@techcorp.com', 'sales@yourcrm.com', 'se@yourcrm.com'],
  agenda: [
    { item: 'Introductions and agenda overview', duration_minutes: 5 },
    { item: 'Company overview & pain point discovery', duration_minutes: 10 },
    { item: 'AI-powered CRM product demo', duration_minutes: 25 },
    { item: 'ROI analysis and competitive positioning', duration_minutes: 12 },
    { item: 'Q&A and next steps', duration_minutes: 8 },
  ],
  prep_materials: {
    talking_points: [
      `Lead scoring reduces manual effort by 70% — mention TechCorp's current process`,
      'Reference case study: SaaSCo increased pipeline velocity by 35%',
      'Emphasize AI email intelligence — 3hr faster response times',
    ],
    success_criteria: [
      'Prospect agrees to a POC or pilot program',
      'Identify budget authority and timeline',
      'Get commitment for next meeting with full team',
    ],
    collateral: ['Enterprise pitch deck (v5)', 'ROI calculator spreadsheet', 'Security & compliance whitepaper'],
  },
  follow_up_tasks: [
    'Send meeting confirmation with calendar invite',
    'Share pre-read materials 24 hours before',
    'Prepare live demo environment with TechCorp branding',
    'Brief Solutions Engineer on technical requirements',
  ],
};

function getInitials(email: string): string {
  const name = email.split('@')[0].replace(/[._]/g, ' ');
  return name.split(' ').map((w) => w[0]?.toUpperCase() || '').slice(0, 2).join('');
}

// ---- Google Calendar Connect Banner ----
function CalendarConnectBanner() {
  const [calStatus, setCalStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/gmail/status');
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean };
        setCalStatus(data.authenticated ? 'connected' : 'disconnected');
        if (data.authenticated && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch { /* backend offline */ }
  }, []);

  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, 4000);
    const onMessage = (e: MessageEvent) => { if (e.data === 'gmail_auth_complete') checkStatus(); };
    window.addEventListener('message', onMessage);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('message', onMessage);
    };
  }, [checkStatus]);

  const handleConnect = () => {
    // Open popup synchronously (Firefox-safe), then redirect to OAuth URL
    const popup = window.open('about:blank', 'gmail_oauth', 'width=520,height=660,toolbar=0,scrollbars=1');
    fetch('http://localhost:8000/api/auth/gmail')
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: 'Backend error' })) as { detail?: string };
          if (popup && !popup.closed) {
            popup.document.write(`<body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;padding:32px;background:rgba(255,59,48,.08);border:1px solid rgba(255,59,48,.3);border-radius:20px;max-width:360px"><div style="font-size:40px;margin-bottom:16px">⚠️</div><h2 style="color:#ff3b30;margin:0 0 8px">Setup Required</h2><p style="color:rgba(255,255,255,.6);margin:0 0 16px;font-size:14px">${err.detail || 'Gmail credentials not configured.'}</p><p style="color:rgba(255,255,255,.4);font-size:12px">Add GMAIL_API_CREDENTIALS to backend/.env</p></div></body>`);
          }
          return;
        }
        return r.json();
      })
      .then((data?: { auth_url?: string }) => {
        if (!data || !data.auth_url) return;
        if (popup && !popup.closed) { popup.location.href = data.auth_url; }
        else { window.location.href = data.auth_url; }
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(checkStatus, 2000);
      })
      .catch(() => { if (popup && !popup.closed) popup.close(); });
  };

  const connected = calStatus === 'connected';

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl mb-4"
      style={{
        background: connected ? 'rgba(52,199,89,0.08)' : 'rgba(191,90,242,0.07)',
        border: `1px solid ${connected ? 'rgba(52,199,89,0.3)' : 'rgba(191,90,242,0.25)'}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: connected ? 'rgba(52,199,89,0.15)' : 'rgba(191,90,242,0.15)' }}
      >
        <Calendar size={15} color={connected ? '#34c759' : '#bf5af2'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Google Calendar</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {connected
            ? 'Connected · Will create real events + Google Meet links'
            : 'Connect to book real calendar events and send invites'}
        </p>
      </div>
      {connected ? (
        <span className="badge badge-green text-xs flex-shrink-0">Active</span>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: '#bf5af2', color: '#fff', cursor: 'pointer' }}
        >
          <Calendar size={11} />
          Connect
        </button>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const [result, setResult]         = useState<MeetingSchedulerResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [doneItems, setDoneItems]   = useState<Set<number>>(new Set());
  const [calBooked, setCalBooked]   = useState<{ success: boolean; event_link?: string; meeting_link?: string; error?: string } | null>(null);

  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    setDoneItems(new Set());
    setCalBooked(null);
    setResult(null);

    // Fire API call — WorkflowSteps animation runs concurrently and is self-timed.
    // Minimum wait = max possible animation time (7 steps × 920ms max) so the cleanup
    // in WorkflowSteps never fires before all steps visually complete.
    const apiCallPromise = fetch('http://localhost:8000/api/agents/schedule-meeting/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    }).then(async (res) => {
      if (!res.ok) return null;
      return res.json();
    }).catch(() => null);

    const MIN_ANIM_MS = STEPS.length * 650; // 7 × 650 ≈ 4.5s — covers max step timing
    const [liveResult] = await Promise.all([
      apiCallPromise,
      new Promise((r) => setTimeout(r, MIN_ANIM_MS)),
    ]);

    try {
      if (liveResult) {
        // Normalize: agent may return attendees/tasks as strings or arrays
        const normalizeToArray = (val: unknown, fallback: string[] = []): string[] => {
          if (Array.isArray(val)) return val.map(String);
          if (typeof val === 'string' && val.trim()) return val.split(',').map((s) => s.trim()).filter(Boolean);
          return fallback;
        };
        const normalizeAgenda = (val: unknown): { item: string; duration_minutes: number }[] => {
          if (!Array.isArray(val)) return MOCK_RESULT.agenda;
          return val.map((a) => typeof a === 'string' ? { item: a, duration_minutes: 10 } : a as { item: string; duration_minutes: number });
        };

        // Normalize prep_materials: agent returns { prep_notes, success_criteria, recommended_collateral }
        // but UI expects { talking_points, success_criteria, collateral }
        const normalizePrepMaterials = (raw: unknown): MeetingSchedulerResult['prep_materials'] => {
          if (!raw || typeof raw !== 'object') return MOCK_RESULT.prep_materials;
          const r = raw as Record<string, unknown>;
          // talking_points: from prep_notes (may be string or array)
          const talkingPoints: string[] = Array.isArray(r.talking_points)
            ? r.talking_points.map(String)
            : Array.isArray(r.prep_notes)
              ? r.prep_notes.map(String)
              : typeof r.prep_notes === 'string' && r.prep_notes.trim()
                ? r.prep_notes.split('\n').map((s: string) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
                : MOCK_RESULT.prep_materials.talking_points;
          // success_criteria
          const successCriteria: string[] = Array.isArray(r.success_criteria)
            ? r.success_criteria.map(String)
            : MOCK_RESULT.prep_materials.success_criteria;
          // collateral: from collateral or recommended_collateral
          const collateral: string[] = Array.isArray(r.collateral)
            ? r.collateral.map(String)
            : Array.isArray(r.recommended_collateral)
              ? r.recommended_collateral.map(String)
              : MOCK_RESULT.prep_materials.collateral;
          return { talking_points: talkingPoints, success_criteria: successCriteria, collateral };
        };

        // Map agent result to display format
        const display: MeetingSchedulerResult = {
          scheduled_time: liveResult.scheduled_time || liveResult.context?.scheduled_time || 'Time selected by AI agent',
          duration_minutes: parseInt(formData.duration || '30', 10),
          meeting_type: formData.meeting_type || liveResult.type || 'Meeting',
          attendees: normalizeToArray(liveResult.attendees, formData.attendees?.split(',').map((s: string) => s.trim()) || []),
          agenda: normalizeAgenda(liveResult.agenda),
          prep_materials: normalizePrepMaterials(liveResult.prep_materials),
          follow_up_tasks: normalizeToArray(liveResult.follow_up_tasks, MOCK_RESULT.follow_up_tasks),
        };
        setResult(display);
        setCalBooked(liveResult.calendar_booked || null);
      } else {
        // API failed — show mock result so user sees the UI
        setResult({ ...MOCK_RESULT, meeting_type: formData.meeting_type || MOCK_RESULT.meeting_type });
        setError('Agent did not return a result — showing preview data');
      }
    } catch (normErr) {
      console.error('[MeetingsPage] Normalization error:', normErr);
      setResult({ ...MOCK_RESULT, meeting_type: formData.meeting_type || MOCK_RESULT.meeting_type });
      setError(`Result processing error: ${normErr}`);
    } finally {
      setIsComplete(true);
    }

  }, []);

  const toggleItem = (i: number) => {
    setDoneItems((prev) => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  };

  return (
    <AgentPageLayout
      agentName="Meeting Scheduler"
      agentDescription="Intelligently schedules meetings, generates agendas, assembles prep materials, and creates Google Calendar events."
      agentColor={COLOR}
      agentEmoji="📅"
      formFields={[
        { key: 'title', label: 'Meeting Title', placeholder: 'Enterprise CRM Demo' },
        { key: 'meeting_type', label: 'Meeting Type', type: 'select', options: ['demo', 'follow_up', 'qbr', 'onboarding', 'discovery'] },
        { key: 'duration', label: 'Duration (minutes)', placeholder: '60' },
        { key: 'attendees', label: 'Attendees (email, comma separated)', type: 'textarea', placeholder: 'john@company.com, sarah@yourcrm.com', rows: 2 },
        { key: 'notes', label: 'Context & Notes', type: 'textarea', placeholder: 'Relevant context for preparing this meeting...', rows: 3 },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
      headerExtra={<CalendarConnectBanner />}
      resultNode={result && (
        <div className="space-y-4">
          {/* Google Calendar Booking Status */}
          {calBooked && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: calBooked.success ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)',
                border: `1px solid ${calBooked.success ? 'rgba(52,199,89,0.3)' : 'rgba(255,149,0,0.3)'}`,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: calBooked.success ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.15)' }}
              >
                <Calendar size={15} color={calBooked.success ? '#34c759' : '#ff9500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {calBooked.success ? 'Google Calendar Event Created ✅' : 'Calendar Booking Pending'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {calBooked.success
                    ? 'Invites sent to all attendees'
                    : calBooked.error || 'Connect Google Calendar to auto-book events'}
                </p>
              </div>
              {calBooked.success && calBooked.event_link && (
                <a
                  href={calBooked.event_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{ background: '#34c759', color: '#fff' }}
                >
                  <ExternalLink size={11} />
                  Open Event
                </a>
              )}
              {calBooked.success && calBooked.meeting_link && (
                <a
                  href={calBooked.meeting_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 ml-2"
                  style={{ background: '#0066cc', color: '#fff' }}
                >
                  <RefreshCw size={11} />
                  Join Meet
                </a>
              )}
            </div>
          )}

          {/* Scheduled Time */}
          <div className="apple-card" style={{ background: `linear-gradient(135deg, ${COLOR}10, ${COLOR}05)`, borderColor: `${COLOR}30` }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: COLOR }}>
                <Calendar size={20} color="#fff" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Scheduled Meeting</p>
                <p className="font-700 text-base" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{result.scheduled_time}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-3">
              <span className="badge badge-purple"><Clock size={10} /> {result.duration_minutes} minutes</span>
              <span className="badge badge-purple">{result.meeting_type}</span>
            </div>
          </div>

          {/* Attendees */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              <Users size={12} className="inline mr-1" />Attendees
            </p>
            <div className="flex flex-wrap gap-2">
              {result.attendees.map((a) => (
                <div key={a} className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{ background: `${COLOR}12`, border: `1px solid ${COLOR}25` }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: COLOR, fontSize: 10 }}>
                    {getInitials(a)}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agenda */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Meeting Agenda</p>
            <div className="space-y-2">
              {result.agenda.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: COLOR }}>
                    {i + 1}
                  </div>
                  <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{item.item}</span>
                  <span className="badge badge-purple" style={{ fontSize: 10, padding: '2px 8px' }}>{item.duration_minutes}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prep Materials */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Prep Materials</p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Talking Points</p>
                {result.prep_materials.talking_points.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: COLOR }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Success Criteria</p>
                {result.prep_materials.success_criteria.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1.5">
                    <Check size={13} color="#34c759" className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Collateral</p>
                <div className="flex flex-wrap gap-2">
                  {result.prep_materials.collateral.map((c, i) => (
                    <span key={i} className="chip" style={{ fontSize: 12, cursor: 'default' }}>📎 {c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Follow-up Tasks */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Follow-up Tasks</p>
            <div className="space-y-2">
              {result.follow_up_tasks.map((t, i) => (
                <button key={i} className="flex items-center gap-3 w-full text-left p-2 rounded-lg transition-all"
                  onClick={() => toggleItem(i)}
                  style={{ background: doneItems.has(i) ? 'rgba(52,199,89,0.06)' : 'var(--bg-input)', border: `1px solid ${doneItems.has(i) ? 'rgba(52,199,89,0.2)' : 'transparent'}` }}>
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: doneItems.has(i) ? '#34c759' : 'transparent', border: `1.5px solid ${doneItems.has(i) ? '#34c759' : 'var(--text-tertiary)'}` }}>
                    {doneItems.has(i) && <Check size={10} color="#fff" />}
                  </div>
                  <span className="text-sm" style={{ color: doneItems.has(i) ? 'var(--text-tertiary)' : 'var(--text-secondary)', textDecoration: doneItems.has(i) ? 'line-through' : 'none' }}>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
}
