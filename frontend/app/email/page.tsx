'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Loader, AlertTriangle, Check, Inbox, ChevronRight } from 'lucide-react';

const COLOR = '#5e5ce6';

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ff3b30', medium: '#ff9500', low: '#34c759',
};
const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#34c759', neutral: '#8e8e93', negative: '#ff3b30',
};
const CATEGORY_LABEL: Record<string, string> = {
  support_request: 'Support', sales_inquiry: 'Sales', demo_request: 'Demo',
  pricing_question: 'Pricing', complaint: 'Complaint', feature_request: 'Feature',
  general_inquiry: 'General',
};

interface AnalyzedEmail {
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

// ─── Gmail Banner ────────────────────────────────────────────────────────────
function GmailBanner({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/gmail/status');
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean };
        setStatus(data.authenticated ? 'connected' : 'disconnected');
        if (data.authenticated && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
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
    const popup = window.open('about:blank', 'gmail_oauth', 'width=520,height=660,toolbar=0,scrollbars=1');
    fetch('http://localhost:8000/api/auth/gmail').then(async r => {
      if (!r.ok) { popup?.close(); return; }
      const data = await r.json() as { auth_url?: string };
      if (data?.auth_url && popup && !popup.closed) popup.location.href = data.auth_url;
      pollRef.current = setInterval(checkStatus, 2000);
    }).catch(() => popup?.close());
  };

  const handleSync = async (limit: number) => {
    setSyncing(true);
    try { await fetch(`http://localhost:8000/api/emails/sync?limit=${limit}`); setTimeout(onSynced, 1500); }
    catch { /* ignore */ } finally { setSyncing(false); }
  };

  const connected = status === 'connected';
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4"
      style={{ background: connected ? 'rgba(52,199,89,0.07)' : 'rgba(94,92,230,0.07)', border: `1px solid ${connected ? 'rgba(52,199,89,0.25)' : 'rgba(94,92,230,0.2)'}` }}>
      <Mail size={14} color={connected ? '#34c759' : COLOR} />
      <p className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
        Gmail {connected ? '— Connected · Sync to fetch emails from your CRM contacts & companies' : '— Connect to sync inbox emails'}
      </p>
      {connected
        ? <span className="badge badge-green">Active</span>
        : <button onClick={handleConnect} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Mail size={11} /> Connect
          </button>}
      {connected && (
        <button onClick={() => handleSync(30)} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: syncing ? 'rgba(94,92,230,0.4)' : COLOR, color: '#fff', border: 'none', cursor: 'pointer', opacity: syncing ? 0.7 : 1 }}>
          {syncing ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {syncing ? 'Syncing…' : 'Sync Gmail'}
        </button>
      )}
    </div>
  );
}

// ─── Left column: single email row ──────────────────────────────────────────
function EmailRow({ email, selected, onClick }: { email: AnalyzedEmail; selected: boolean; onClick: () => void }) {
  const priorityColor = PRIORITY_COLOR[email.priority] || '#8e8e93';
  const sentimentColor = SENTIMENT_COLOR[email.sentiment_label] || '#8e8e93';
  const senderInitial = (email.from_email?.[0] || '?').toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-3 transition-all flex items-start gap-3 rounded-xl mb-1"
      style={{
        background: selected ? `${COLOR}12` : 'transparent',
        border: `1px solid ${selected ? `${COLOR}35` : 'transparent'}`,
      }}>
      {/* Priority dot */}
      <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
        style={{ background: email.analyzed ? priorityColor : '#8e8e93' }} />
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: `${COLOR}20`, color: COLOR }}>
        {senderInitial}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {email.from_email.split('<')[0].trim() || email.from_email}
          </span>
          {email.received_at && (
            <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
              {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <p className="text-xs truncate mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          {email.subject}
        </p>
        {/* Tags */}
        {email.analyzed && (
          <div className="flex gap-1 flex-wrap">
            <span className="badge text-xs" style={{ background: `${priorityColor}15`, color: priorityColor, fontSize: 9, padding: '1px 6px' }}>
              {email.priority}
            </span>
            <span className="badge text-xs" style={{ background: `${sentimentColor}15`, color: sentimentColor, fontSize: 9, padding: '1px 6px' }}>
              {email.sentiment_label}
            </span>
            <span className="badge text-xs" style={{ background: 'rgba(142,142,147,0.12)', color: 'var(--text-tertiary)', fontSize: 9, padding: '1px 6px' }}>
              {CATEGORY_LABEL[email.category] || email.category}
            </span>
          </div>
        )}
        {!email.analyzed && (
          <span className="badge text-xs" style={{ background: 'rgba(255,149,0,0.12)', color: '#ff9500', fontSize: 9, padding: '1px 6px' }}>
            Pending AI
          </span>
        )}
      </div>
      {selected && <ChevronRight size={12} color={COLOR} className="flex-shrink-0 mt-1" />}
    </button>
  );
}

// ─── Right column: detail panel ──────────────────────────────────────────────
function EmailDetailPanel({ email }: { email: AnalyzedEmail | null }) {
  const [copied, setCopied] = useState(false);

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: 400 }}>
        <Inbox size={44} color="var(--text-tertiary)" style={{ marginBottom: 12, opacity: 0.5 }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Select an email to see AI analysis</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>Sentiment · Category · Draft Response · Follow-ups</p>
      </div>
    );
  }

  const priorityColor = PRIORITY_COLOR[email.priority] || '#8e8e93';
  const sentimentColor = SENTIMENT_COLOR[email.sentiment_label] || '#8e8e93';

  const copyDraft = () => {
    if (!email.draft_response) return;
    navigator.clipboard.writeText(email.draft_response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-1">
      {/* Email header */}
      <div className="apple-card" style={{ borderColor: `${priorityColor}25` }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>From</p>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{email.from_email}</p>
          </div>
          {email.company && (
            <span className="badge flex-shrink-0" style={{ background: `${COLOR}12`, color: COLOR }}>{email.company}</span>
          )}
        </div>
        <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Subject</p>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{email.subject}</p>
        <div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{email.body_preview}{email.body_preview?.length >= 200 ? '…' : ''}</p>
        </div>
      </div>

      {/* AI Analysis */}
      {email.analyzed ? (
        <>
          {/* Sentiment + Category + Priority */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}>AI Analysis</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Priority', value: email.priority, color: priorityColor },
                { label: 'Sentiment', value: email.sentiment_label, color: sentimentColor },
                { label: 'Category', value: CATEGORY_LABEL[email.category] || email.category, color: COLOR },
                { label: 'Urgency', value: email.sentiment_urgency, color: email.sentiment_urgency === 'high' ? '#ff3b30' : 'var(--text-secondary)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                  <p className="text-xs font-semibold capitalize" style={{ color }}>{value || '—'}</p>
                </div>
              ))}
            </div>
            {/* Sentiment score bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sentiment Score</span>
                <span className="text-xs font-bold" style={{ color: sentimentColor }}>{email.sentiment_score}/10</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(email.sentiment_score / 10) * 100}%`, background: sentimentColor }} />
              </div>
            </div>
          </div>

          {/* AI Draft Response */}
          {email.draft_response && (
            <div className="apple-card" style={{ borderColor: `${COLOR}20` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase" style={{ color: COLOR, letterSpacing: '0.07em' }}>AI Draft Response</p>
                <button onClick={copyDraft}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                  style={{ background: `${COLOR}15`, color: COLOR, border: 'none', cursor: 'pointer' }}>
                  {copied ? <Check size={10} /> : null}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', lineHeight: 1.65, maxHeight: 240, overflowY: 'auto' }}>
                {email.draft_response}
              </pre>
            </div>
          )}

          {/* Follow-up suggestions */}
          {email.follow_up_suggestions?.length > 0 && (
            <div className="apple-card">
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.07em' }}>Follow-up Actions</p>
              <div className="space-y-1.5">
                {email.follow_up_suggestions.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                      style={{ background: `${COLOR}20`, color: COLOR, fontSize: 9 }}>{i + 1}</span>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="apple-card flex flex-col items-center py-6 text-center" style={{ opacity: 0.7 }}>
          <Loader size={20} color="#ff9500" className="animate-spin mb-2" />
          <p className="text-xs font-medium" style={{ color: '#ff9500' }}>AI analysis pending</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Sync Gmail again to trigger analysis</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [emails, setEmails] = useState<AnalyzedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLimit, setFetchLimit] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnalyzedEmail | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadEmails = useCallback(async (limit: number = fetchLimit) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/emails/analyzed?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AnalyzedEmail[];
      setEmails(data);
      setLastRefresh(new Date());
      // Auto-select first if nothing selected
      if (!selected && data.length > 0) setSelected(data[0]);
    } catch (e) {
      setError(`Failed to load: ${e}`);
    } finally { setLoading(false); }
  }, [fetchLimit, selected]);

  useEffect(() => { loadEmails(); }, []);   // only on mount

  const analyzed   = emails.filter(e => e.analyzed);
  const unanalyzed = emails.filter(e => !e.analyzed);
  const highPri    = analyzed.filter(e => e.priority === 'high');
  const other      = analyzed.filter(e => e.priority !== 'high');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 20 }}>📧</span>
          <h1 className="section-title" style={{ fontSize: 20 }}>Email Intelligence</h1>
          <span className="badge badge-blue ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle" style={{ fontSize: 12 }}>
          Fetches Gmail emails from CRM companies &amp; contacts · VADER sentiment + LLM categorization · AI draft responses
        </p>
      </div>

      {/* Gmail banner */}
      <GmailBanner onSynced={() => loadEmails()} />

      {/* Controls */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Show last</label>
          <select className="form-input" style={{ width: 72, padding: '5px 8px', fontSize: 12 }}
            value={fetchLimit}
            onChange={e => { const v = parseInt(e.target.value); setFetchLimit(v); loadEmails(v); }}>
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>emails</label>
        </div>
        <button onClick={() => loadEmails()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: loading ? 'rgba(94,92,230,0.3)' : COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          {loading ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {lastRefresh && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}

        {/* Stats inline */}
        {emails.length > 0 && (
          <div className="flex gap-2 ml-auto">
            {[
              { label: 'Total', v: emails.length, c: COLOR },
              { label: 'Analyzed', v: analyzed.length, c: '#34c759' },
              { label: 'High Pri', v: highPri.length, c: '#ff3b30' },
              { label: 'Pending', v: unanalyzed.length, c: '#ff9500' },
            ].map(({ label, v, c }) => (
              <div key={label} className="text-center px-2">
                <p className="text-base font-bold" style={{ color: c, lineHeight: 1 }}>{v}</p>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-3"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
          <AlertTriangle size={13} color="#ff3b30" />
          <p className="text-xs" style={{ color: '#ff3b30' }}>{error}</p>
        </div>
      )}

      {/* Split layout: LEFT list | RIGHT detail */}
      {loading && emails.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center flex-1" style={{ minHeight: 300 }}>
          <Loader size={24} color={COLOR} className="animate-spin mb-2" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading emails from CRM…</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center flex-1" style={{ minHeight: 300, opacity: 0.7 }}>
          <Inbox size={40} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No emails in CRM yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Connect Gmail and click Sync Gmail to fetch &amp; analyze your inbox</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* LEFT — email list */}
          <div style={{ width: 340, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border-primary)', paddingRight: 12 }}>
            {highPri.length > 0 && (
              <p className="text-xs font-semibold mb-1.5 uppercase" style={{ color: '#ff3b30', letterSpacing: '0.08em', fontSize: 9 }}>
                🔴 HIGH PRIORITY ({highPri.length})
              </p>
            )}
            {highPri.map(e => <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />)}

            {other.length > 0 && (
              <p className="text-xs font-semibold mt-3 mb-1.5 uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontSize: 9 }}>
                ANALYZED ({other.length})
              </p>
            )}
            {other.map(e => <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />)}

            {unanalyzed.length > 0 && (
              <p className="text-xs font-semibold mt-3 mb-1.5 uppercase" style={{ color: '#ff9500', letterSpacing: '0.08em', fontSize: 9 }}>
                ⏳ PENDING ({unanalyzed.length})
              </p>
            )}
            {unanalyzed.map(e => <EmailRow key={e.id} email={e} selected={selected?.id === e.id} onClick={() => setSelected(e)} />)}
          </div>

          {/* RIGHT — detail panel */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <EmailDetailPanel email={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
