'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Loader, AlertTriangle, ChevronDown, ChevronUp, Check, Inbox } from 'lucide-react';

// ─── Colour constants ───────────────────────────────────────────────────────
const COLOR = '#5e5ce6';
const PRIORITY_COLORS: Record<string, string> = { high: '#ff3b30', medium: '#ff9500', low: '#34c759' };
const SENTIMENT_COLORS: Record<string, string> = { positive: '#34c759', neutral: '#8e8e93', negative: '#ff3b30', mixed: '#ff9500' };
const CATEGORY_LABELS: Record<string, string> = {
  support_request: 'Support', sales_inquiry: 'Sales', demo_request: 'Demo',
  pricing_question: 'Pricing', complaint: 'Complaint', feature_request: 'Feature', general_inquiry: 'General',
};

interface EmailRow {
  id: string;
  from_email: string;
  subject: string;
  body_preview: string;
  company: string;
  received_at: string | null;
  analyzed: boolean;
  sentiment_label: string;
  sentiment_score: number;
  sentiment_emotion: string;
  sentiment_urgency: string;
  category: string;
  priority: string;
  draft_response: string;
  follow_up_suggestions: string[];
}

// ─── Gmail sync banner ──────────────────────────────────────────────────────
function GmailBanner({ onSynced }: { onSynced: () => void }) {
  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:8000/api/auth/gmail/status');
      if (r.ok) { const d = await r.json() as { authenticated: boolean }; setConnected(d.authenticated); }
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, 4000);
    const onMsg = (e: MessageEvent) => { if (e.data === 'gmail_auth_complete') checkStatus(); };
    window.addEventListener('message', onMsg);
    return () => { if (pollRef.current) clearInterval(pollRef.current); window.removeEventListener('message', onMsg); };
  }, [checkStatus]);

  const handleConnect = () => {
    const popup = window.open('about:blank', 'gmail_oauth', 'width=520,height=660');
    fetch('http://localhost:8000/api/auth/gmail').then(async r => {
      if (!r.ok) { popup?.close(); return; }
      const d = await r.json() as { auth_url?: string };
      if (d?.auth_url && popup && !popup.closed) popup.location.href = d.auth_url;
      pollRef.current = setInterval(checkStatus, 2000);
    }).catch(() => popup?.close());
  };

  const handleSync = async () => {
    setSyncing(true);
    try { await fetch('http://localhost:8000/api/emails/sync?limit=50'); setTimeout(onSynced, 1800); }
    catch { /* ignore */ } finally { setSyncing(false); }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4"
      style={{ background: connected ? 'rgba(52,199,89,0.07)' : 'rgba(94,92,230,0.07)', border: `1px solid ${connected ? 'rgba(52,199,89,0.22)' : 'rgba(94,92,230,0.2)'}` }}>
      <Mail size={14} color={connected ? '#34c759' : COLOR} />
      <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
        Gmail {connected ? '— Connected · Sync fetches inbox → matches CRM companies/contacts → AI analyzes each email' : '— Connect Gmail to fetch and intelligently analyze your business emails'}
      </p>
      {connected ? <span className="badge badge-green flex-shrink-0">Connected</span> : (
        <button onClick={handleConnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Mail size={11} /> Connect Gmail
        </button>
      )}
      {connected && (
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: syncing ? 'rgba(94,92,230,0.35)' : COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          {syncing ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {syncing ? 'Syncing…' : 'Sync Gmail'}
        </button>
      )}
    </div>
  );
}

// ─── Single email card — 4-column layout ───────────────────────────────────
function EmailCard({ email }: { email: EmailRow }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const pc = PRIORITY_COLORS[email.priority] || '#8e8e93';
  const sc = SENTIMENT_COLORS[email.sentiment_label] || '#8e8e93';
  const catLabel = CATEGORY_LABELS[email.category] || email.category || '—';
  const initial = (email.from_email?.[0] || '?').toUpperCase();
  const senderName = email.from_email.includes('<') ? email.from_email.split('<')[0].trim() : email.from_email.split('@')[0];

  const copyDraft = () => {
    navigator.clipboard.writeText(email.draft_response || '');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="apple-card mb-2 transition-all" style={{ padding: '12px 16px', borderLeft: `3px solid ${email.analyzed ? pc : '#8e8e93'}` }}>
      {/* ── 4-column row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 12, alignItems: 'start' }}>

        {/* COL 1 — Sender */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: `${COLOR}20`, color: COLOR }}>{initial}</div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{senderName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{email.company || email.from_email.split('@')[1]}</p>
            </div>
          </div>
          {email.received_at && (
            <p className="text-xs ml-9" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
              {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* COL 2 — Subject + preview */}
        <div className="min-w-0">
          <p className="text-xs font-semibold mb-0.5 truncate" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {email.body_preview}
          </p>
        </div>

        {/* COL 3 — AI tags */}
        <div className="flex flex-wrap gap-1">
          {email.analyzed ? (
            <>
              <span className="badge" style={{ background: `${pc}15`, color: pc, fontSize: 9, padding: '2px 7px' }}>{email.priority}</span>
              <span className="badge" style={{ background: `${sc}15`, color: sc, fontSize: 9, padding: '2px 7px' }}>{email.sentiment_label}</span>
              <span className="badge" style={{ background: `${COLOR}10`, color: COLOR, fontSize: 9, padding: '2px 7px' }}>{catLabel}</span>
              {email.sentiment_urgency === 'high' && (
                <span className="badge" style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', fontSize: 9, padding: '2px 7px' }}>urgent</span>
              )}
            </>
          ) : (
            <span className="badge" style={{ background: 'rgba(255,149,0,0.1)', color: '#ff9500', fontSize: 9, padding: '2px 7px' }}>⏳ Pending AI</span>
          )}
        </div>

        {/* COL 4 — Expand toggle */}
        <div className="flex-shrink-0">
          {email.analyzed && (
            <button onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
              style={{ background: `${COLOR}10`, color: COLOR, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? 'Hide' : 'AI Draft'}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded AI analysis ──────────────────────────────────────── */}
      {expanded && email.analyzed && (
        <div className="mt-3 pt-3 space-y-3 animate-fade-in-up" style={{ borderTop: '1px solid var(--border-primary)' }}>
          {/* Metrics row */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Sentiment Score', value: `${email.sentiment_score}/10`, color: sc },
              { label: 'Emotion', value: email.sentiment_emotion || '—', color: 'var(--text-secondary)' },
              { label: 'Urgency', value: email.sentiment_urgency || '—', color: email.sentiment_urgency === 'high' ? '#ff3b30' : 'var(--text-secondary)' },
              { label: 'Category', value: catLabel, color: COLOR },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</p>
                <p className="text-xs font-semibold capitalize" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* AI Draft Response */}
          {email.draft_response && (
            <div className="rounded-xl p-3" style={{ background: `${COLOR}07`, border: `1px solid ${COLOR}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: COLOR }}>✦ AI Draft Response — 1 LLM call</p>
                <button onClick={copyDraft}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                  style={{ background: `${COLOR}15`, color: COLOR, border: 'none', cursor: 'pointer' }}>
                  {copied ? <Check size={10} /> : null}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', lineHeight: 1.65, maxHeight: 200, overflowY: 'auto' }}>
                {email.draft_response}
              </pre>
            </div>
          )}

          {/* Follow-ups */}
          {email.follow_up_suggestions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Suggested Follow-up Actions</p>
              <div className="space-y-1">
                {email.follow_up_suggestions.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center font-bold mt-0.5"
                      style={{ background: `${COLOR}20`, color: COLOR, fontSize: 9 }}>{i + 1}</span>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const loadEmails = useCallback(async (n: number = limit) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`http://localhost:8000/api/emails/analyzed?limit=${n}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as EmailRow[];
      setEmails(data);
      setLastRefresh(new Date());
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { loadEmails(); }, []);

  const analyzed   = emails.filter(e => e.analyzed);
  const unanalyzed = emails.filter(e => !e.analyzed);
  const filtered   = filterPriority === 'all' ? emails : emails.filter(e => e.priority === filterPriority || (!e.analyzed && filterPriority === 'pending'));

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 20 }}>📧</span>
          <h1 className="section-title" style={{ fontSize: 20 }}>Email Intelligence</h1>
          <span className="badge badge-blue ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle" style={{ fontSize: 12 }}>
          Syncs Gmail → filters to CRM companies &amp; contacts → VADER + LLM analysis → AI draft response per email (1 LLM call each)
        </p>
      </div>

      {/* Gmail banner */}
      <GmailBanner onSynced={() => loadEmails()} />

      {/* Controls + stats row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Limit selector */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Show</label>
          <select className="form-input" style={{ width: 64, padding: '4px 8px', fontSize: 12 }}
            value={limit}
            onChange={e => { const v = parseInt(e.target.value); setLimit(v); loadEmails(v); }}>
            {[10, 20, 30, 50].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1">
          {['all', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize"
              style={{
                background: filterPriority === p ? (PRIORITY_COLORS[p] || COLOR) : 'var(--bg-input)',
                color: filterPriority === p ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer',
              }}>{p}</button>
          ))}
        </div>

        {/* Refresh */}
        <button onClick={() => loadEmails()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: loading ? 'rgba(94,92,230,0.3)' : COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          {loading ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {lastRefresh && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}

        {/* Stats inline */}
        {emails.length > 0 && (
          <div className="flex gap-3 ml-auto">
            {[
              { label: 'CRM Emails', v: emails.length, c: COLOR },
              { label: 'AI Analyzed', v: analyzed.length, c: '#34c759' },
              { label: 'High Priority', v: analyzed.filter(e => e.priority === 'high').length, c: '#ff3b30' },
              { label: 'Pending AI', v: unanalyzed.length, c: '#ff9500' },
            ].map(({ label, v, c }) => (
              <div key={label} className="text-center">
                <p className="text-base font-bold" style={{ color: c, lineHeight: 1 }}>{v}</p>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column headers */}
      {emails.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr auto', gap: 12, padding: '0 16px', marginBottom: 6 }}>
          {['Sender', 'Subject + Preview', 'AI Tags', ''].map(h => (
            <p key={h} style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</p>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-3"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
          <AlertTriangle size={12} color="#ff3b30" />
          <p className="text-xs" style={{ color: '#ff3b30' }}>{error}</p>
        </div>
      )}

      {/* Email list */}
      {loading && emails.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
          <Loader size={24} color={COLOR} className="animate-spin mb-2" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading emails from CRM…</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Fetching only company-matched emails from your database</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 260, opacity: 0.7 }}>
          <Inbox size={38} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {emails.length === 0 ? 'No emails in CRM yet' : `No ${filterPriority} priority emails`}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {emails.length === 0 ? 'Connect Gmail → Sync Gmail to fetch emails from your CRM companies' : 'Change the priority filter above'}
          </p>
        </div>
      ) : (
        <div>
          {/* High priority section */}
          {filterPriority === 'all' && analyzed.filter(e => e.priority === 'high').length > 0 && (
            <p className="text-xs font-bold uppercase mb-2" style={{ color: '#ff3b30', letterSpacing: '0.08em', fontSize: 9 }}>
              🔴 HIGH PRIORITY — {analyzed.filter(e => e.priority === 'high').length} emails
            </p>
          )}
          {filtered.filter(e => e.priority === 'high' && e.analyzed).map(e => <EmailCard key={e.id} email={e} />)}

          {/* Other analyzed */}
          {filterPriority === 'all' && analyzed.filter(e => e.priority !== 'high').length > 0 && (
            <p className="text-xs font-bold uppercase mb-2 mt-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontSize: 9 }}>
              ANALYZED — {analyzed.filter(e => e.priority !== 'high').length} emails
            </p>
          )}
          {filtered.filter(e => e.priority !== 'high' && e.analyzed).map(e => <EmailCard key={e.id} email={e} />)}

          {/* Pending */}
          {filterPriority === 'all' && unanalyzed.length > 0 && (
            <p className="text-xs font-bold uppercase mb-2 mt-3" style={{ color: '#ff9500', letterSpacing: '0.08em', fontSize: 9 }}>
              ⏳ PENDING AI ANALYSIS — {unanalyzed.length} emails
            </p>
          )}
          {filtered.filter(e => !e.analyzed).map(e => <EmailCard key={e.id} email={e} />)}
        </div>
      )}
    </div>
  );
}
