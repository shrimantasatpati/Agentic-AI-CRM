'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mail, RefreshCw, ChevronDown, ChevronUp, Loader, AlertTriangle, Check, Inbox } from 'lucide-react';

const COLOR = '#5e5ce6';

const PRIORITY_COLOR: Record<string, string> = {
  high: '#ff3b30', medium: '#ff9500', low: '#34c759',
};
const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#34c759', neutral: '#8e8e93', negative: '#ff3b30',
};
const CATEGORY_LABEL: Record<string, string> = {
  support_request: 'Support', sales_inquiry: 'Sales', demo_request: 'Demo',
  pricing_question: 'Pricing', complaint: 'Complaint', feature_request: 'Feature Req.',
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

// ---- Gmail Connect Banner ----
function GmailConnectBanner({ onSynced }: { onSynced: () => void }) {
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
    } catch { /* backend offline */ }
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
    fetch('http://localhost:8000/api/auth/gmail')
      .then(async (r) => {
        if (!r.ok) { if (popup && !popup.closed) popup.close(); return; }
        return r.json();
      })
      .then((data?: { auth_url?: string }) => {
        if (!data?.auth_url) return;
        if (popup && !popup.closed) popup.location.href = data.auth_url;
        pollRef.current = setInterval(checkStatus, 2000);
      })
      .catch(() => { if (popup && !popup.closed) popup.close(); });
  };

  const handleSync = async (limit: number) => {
    setSyncing(true);
    try {
      await fetch(`http://localhost:8000/api/emails/sync?limit=${limit}`);
      setTimeout(onSynced, 1500);   // wait 1.5s for background analysis to start
    } catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  const connected = status === 'connected';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl mb-5" style={{
      background: connected ? 'rgba(52,199,89,0.08)' : 'rgba(94,92,230,0.07)',
      border: `1px solid ${connected ? 'rgba(52,199,89,0.3)' : 'rgba(94,92,230,0.25)'}`,
    }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: connected ? 'rgba(52,199,89,0.15)' : 'rgba(94,92,230,0.15)' }}>
        <Mail size={15} color={connected ? '#34c759' : COLOR} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Gmail</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {connected ? 'Connected · Sync to fetch and analyze real inbox emails' : 'Connect Gmail to sync and analyze real emails'}
        </p>
      </div>
      {connected ? (
        <span className="badge badge-green text-xs flex-shrink-0">Active</span>
      ) : (
        <button onClick={handleConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: COLOR, color: '#fff', cursor: 'pointer' }}>
          <Mail size={11} /> Connect
        </button>
      )}
      {connected && (
        <button onClick={() => handleSync(20)} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: syncing ? 'rgba(94,92,230,0.4)' : COLOR, color: '#fff', cursor: 'pointer', opacity: syncing ? 0.7 : 1 }}>
          {syncing ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {syncing ? 'Syncing...' : 'Sync Gmail'}
        </button>
      )}
    </div>
  );
}

// ---- Single Email Card ----
function EmailCard({ email }: { email: AnalyzedEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyDraft = () => {
    if (!email.draft_response) return;
    navigator.clipboard.writeText(email.draft_response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const priorityColor = PRIORITY_COLOR[email.priority] || '#8e8e93';
  const sentimentColor = SENTIMENT_COLOR[email.sentiment_label] || '#8e8e93';

  return (
    <div className="apple-card mb-3 transition-all" style={{ borderColor: !email.analyzed ? 'var(--border-primary)' : `${priorityColor}22` }}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: `${COLOR}20`, color: COLOR }}>
          {(email.from_email[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {email.from_email}
            </span>
            {email.company && (
              <span className="badge" style={{ background: 'rgba(94,92,230,0.12)', color: COLOR }}>
                {email.company}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--text-secondary)' }}>
            {email.subject}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            {email.body_preview}{email.body_preview.length >= 200 ? '…' : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {email.received_at && (
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {email.analyzed ? (
            <div className="flex gap-1.5 flex-wrap justify-end">
              <span className="badge" style={{ background: `${priorityColor}18`, color: priorityColor }}>
                {email.priority}
              </span>
              <span className="badge" style={{ background: `${sentimentColor}18`, color: sentimentColor }}>
                {email.sentiment_label}
              </span>
              <span className="badge" style={{ background: 'rgba(142,142,147,0.12)', color: 'var(--text-secondary)' }}>
                {CATEGORY_LABEL[email.category] || email.category}
              </span>
            </div>
          ) : (
            <span className="badge" style={{ background: 'rgba(255,149,0,0.12)', color: '#ff9500' }}>
              Pending analysis
            </span>
          )}
        </div>
      </div>

      {/* Expand / collapse */}
      {email.analyzed && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-xs font-medium"
            style={{ color: COLOR, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Hide' : 'Show'} AI Analysis & Draft
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 animate-fade-in-up">
              {/* Sentiment row */}
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'Score', value: `${email.sentiment_score}/10` },
                  { label: 'Emotion', value: email.sentiment_emotion },
                  { label: 'Urgency', value: email.sentiment_urgency },
                ].map(({ label, value }) => (
                  <div key={label} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* AI Draft */}
              {email.draft_response && (
                <div className="rounded-xl p-3" style={{ background: `${COLOR}08`, border: `1px solid ${COLOR}22` }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold" style={{ color: COLOR }}>AI Draft Response</p>
                    <button onClick={copyDraft}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                      style={{ background: `${COLOR}18`, color: COLOR, border: 'none', cursor: 'pointer' }}>
                      {copied ? <Check size={11} /> : null}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', lineHeight: 1.6 }}>
                    {email.draft_response}
                  </pre>
                </div>
              )}

              {/* Follow-ups */}
              {email.follow_up_suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Follow-up Actions</p>
                  <div className="space-y-1">
                    {email.follow_up_suggestions.map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                          style={{ background: `${COLOR}20`, color: COLOR }}>{i + 1}</span>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Main Page ----
export default function EmailPage() {
  const [emails, setEmails] = useState<AnalyzedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLimit, setFetchLimit] = useState(20);
  const [error, setError] = useState<string | null>(null);
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
    } catch (e) {
      setError(`Failed to load emails: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [fetchLimit]);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const analyzed   = emails.filter(e => e.analyzed);
  const unanalyzed = emails.filter(e => !e.analyzed);
  const highPri    = analyzed.filter(e => e.priority === 'high');

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 22 }}>📧</span>
          <h1 className="section-title" style={{ fontSize: 22 }}>Email Intelligence</h1>
          <span className="badge badge-blue ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle">
          Fetches real Gmail emails, runs AI analysis (VADER sentiment + LLM categorization), and drafts personalized responses — all stored in CRM.
        </p>
      </div>

      {/* Gmail connect + sync banner */}
      <GmailConnectBanner onSynced={() => loadEmails()} />

      {/* Controls row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Show last</label>
          <select
            className="form-input"
            style={{ width: 80, padding: '6px 10px', fontSize: 13 }}
            value={fetchLimit}
            onChange={(e) => { const v = parseInt(e.target.value); setFetchLimit(v); loadEmails(v); }}>
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>emails</label>
        </div>
        <button
          onClick={() => loadEmails()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: loading ? 'rgba(94,92,230,0.3)' : COLOR, color: '#fff', cursor: 'pointer', border: 'none' }}>
          {loading ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        {lastRefresh && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Last refreshed {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Stats row */}
      {emails.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { label: 'Total in CRM', value: emails.length, color: COLOR },
            { label: 'AI Analyzed', value: analyzed.length, color: '#34c759' },
            { label: 'High Priority', value: highPri.length, color: '#ff3b30' },
            { label: 'Pending', value: unanalyzed.length, color: '#ff9500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="apple-card flex-1 min-w-0 py-2 px-3" style={{ borderColor: `${color}22` }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.3)' }}>
          <AlertTriangle size={14} color="#ff3b30" />
          <p className="text-xs" style={{ color: '#ff3b30' }}>{error}</p>
        </div>
      )}

      {/* Email list */}
      {loading && emails.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 200 }}>
          <Loader size={28} color={COLOR} className="animate-spin mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading emails from CRM…</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 240, opacity: 0.7 }}>
          <Inbox size={40} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No emails in CRM yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Connect Gmail and click "Sync Gmail" to fetch and analyze your inbox
          </p>
        </div>
      ) : (
        <div>
          {highPri.length > 0 && (
            <p className="text-xs font-semibold mb-2 uppercase" style={{ color: '#ff3b30', letterSpacing: '0.08em' }}>
              🔴 High Priority ({highPri.length})
            </p>
          )}
          {highPri.map(e => <EmailCard key={e.id} email={e} />)}

          {analyzed.filter(e => e.priority !== 'high').length > 0 && (
            <p className="text-xs font-semibold mb-2 mt-4 uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
              Other Analyzed ({analyzed.filter(e => e.priority !== 'high').length})
            </p>
          )}
          {analyzed.filter(e => e.priority !== 'high').map(e => <EmailCard key={e.id} email={e} />)}

          {unanalyzed.length > 0 && (
            <>
              <p className="text-xs font-semibold mb-2 mt-4 uppercase" style={{ color: '#ff9500', letterSpacing: '0.08em' }}>
                ⏳ Pending AI Analysis ({unanalyzed.length})
              </p>
              {unanalyzed.map(e => <EmailCard key={e.id} email={e} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
