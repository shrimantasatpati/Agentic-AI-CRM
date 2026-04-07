'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Loader, AlertTriangle, Inbox, Check, Zap, Trash2 } from 'lucide-react';

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
        Gmail {connected ? '— Successfully connected to your inbox.' : '— Connect your Gmail account to enable batch email analysis.'}
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
          {syncing ? 'Syncing & Analyzing Batch…' : 'Sync Gmail'}
        </button>
      )}
    </div>
  );
}


// ─── Main Page ───────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [emails, setEmails]             = useState<EmailRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [isAnalyzing, setIsAnalyzing]   = useState(false);
  const [limit, setLimit]               = useState(20);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  // Track selected email for right pane
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState<Record<string, string>>({});

  const autoAnalysisFiredRef = useRef(false); // Prevents infinite loop

  const loadEmails = useCallback(async (n: number = limit) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`http://localhost:8000/api/emails/analyzed?limit=${n}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as EmailRow[];
      setEmails(data);
      // Preserve selection if email still exists; else auto-select first
      setSelectedId(prev => {
        if (prev && data.some(e => e.id === prev)) return prev;
        return data.length > 0 ? data[0].id : null;
      });
      setLastRefresh(new Date());
      return data;
    } catch (e) { setError(String(e)); return []; }
    finally { setLoading(false); }
  }, [limit]);

  const triggerAutoAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      await fetch(`http://localhost:8000/api/emails/analyze-inbox?limit=10`, { method: 'POST' });
      // Poll until all emails are analyzed (max 30s)
      let polls = 0;
      const poll = async () => {
        const data = await loadEmails();
        if (Array.isArray(data) && data.some((e: any) => !e.analyzed) && polls++ < 10) {
          setTimeout(poll, 3000);
        } else {
          setIsAnalyzing(false);
        }
      };
      setTimeout(poll, 2500);
    } catch (err) {
      console.error('Auto-analysis failed:', err);
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, loadEmails]);

  // On initial mount: load emails then trigger analysis ONCE if there are pending emails
  useEffect(() => {
    const init = async () => {
      const data = await loadEmails();
      if (!autoAnalysisFiredRef.current && Array.isArray(data)) {
        const hasUnanalyzed = data.some((e: any) => !e.analyzed);
        if (hasUnanalyzed) {
          autoAnalysisFiredRef.current = true;
          triggerAutoAnalysis();
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzed   = emails.filter(e => e.analyzed);
  const unanalyzed = emails.filter(e => !e.analyzed);
  const filtered   = filterPriority === 'all' ? emails : emails.filter(e => e.priority === filterPriority || (!e.analyzed && filterPriority === 'pending'));

  const selectedEmail = emails.find(e => e.id === selectedId);

  const copyDraft = () => {
    const draft = draftEdit[selectedId!] ?? selectedEmail?.draft_response ?? '';
    if (draft) {
      navigator.clipboard.writeText(draft);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendDraft = async () => {
    if (!selectedEmail) return;
    const body = draftEdit[selectedEmail.id] ?? selectedEmail.draft_response ?? '';
    if (!body.trim()) return;
    try {
      await fetch('http://localhost:8000/api/emails/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selectedEmail.from_email, subject: `Re: ${selectedEmail.subject}`, body }),
      });
      alert(`Reply sent to ${selectedEmail.from_email}`);
    } catch {
      alert('Failed to send — check Gmail connection.');
    }
  };

  const deleteEmail = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/emails/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEmails(prev => prev.filter(e => e.id !== id));
        if (selectedId === id) setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to delete email:', err);
    }
  };

  const clearInbox = async () => {
    if (!confirm('Are you sure you want to PURGE the entire inbox? This cannot be undone.')) return;
    try {
      const res = await fetch('http://localhost:8000/api/emails/', { method: 'DELETE' });
      if (res.ok) {
        setEmails([]);
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to clear inbox:', err);
    }
  };

  return (
    <div className="flex flex-col h-[85vh]">
      {/* Header */}
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 20 }}>📧</span>
          <h1 className="section-title" style={{ fontSize: 20 }}>Email Intelligence</h1>
          <span className="badge badge-blue ml-2">AI Batch Agent</span>
        </div>
        <p className="section-subtitle">
          Gmail — Connected · Sync fetches inbox → matches CRM companies/contacts → AI analyzes emails in BATCH
        </p>
      </div>

      {/* Gmail banner */}
      <div className="flex-shrink-0">
          <GmailBanner onSynced={() => loadEmails()} />
      </div>

      {/* Controls + stats row */}
      <div className="flex items-center gap-3 mb-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <label className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Show</label>
          <select className="form-input transition-all hover:border-[var(--blue-primary)] focus:ring-2 focus:ring-[var(--blue-primary)]/20" 
            style={{ width: 80, padding: '4px 10px', fontSize: 12, borderRadius: 8 }}
            value={limit}
            onChange={e => { const v = parseInt(e.target.value); setLimit(v); loadEmails(v); }}>
            <option value={5}>5 Recs</option>
            <option value={10}>10 Recs</option>
            <option value={20}>20 Recs</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          {['all', 'high', 'medium', 'low', 'pending'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize"
              style={{
                background: filterPriority === p ? (p === 'pending' ? '#ff9500' : PRIORITY_COLORS[p] || COLOR) : 'var(--bg-input)',
                color: filterPriority === p ? '#fff' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer',
              }}>{p}</button>
          ))}
        </div>

        <button onClick={() => loadEmails()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: loading ? 'rgba(94,92,230,0.3)' : COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
          {loading ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {loading ? 'Refreshing List…' : 'Refresh'}
        </button>

        <button 
          onClick={async () => {
            setLoading(true);
            try { 
              await fetch('http://localhost:8000/api/emails/analyze-inbox', { method: 'POST' });
              setTimeout(loadEmails, 1200);
            } catch { /* ignore */ }
            finally { setLoading(false); }
          }}
          disabled={loading || unanalyzed.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: loading || unanalyzed.length === 0 ? 'rgba(52,199,89,0.3)' : '#34c759', color: '#fff', border: 'none', cursor: 'pointer' }}>
          {loading ? <Loader size={11} className="animate-spin" /> : <Zap size={11} fill="#fff" />}
          {unanalyzed.length > 0 ? `Analyze ${unanalyzed.length} Pending` : 'All Analyzed'}
        </button>

        {lastRefresh && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Updated {lastRefresh.toLocaleTimeString()}</span>}

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

      {error && (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-3 flex-shrink-0"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)' }}>
          <AlertTriangle size={12} color="#ff3b30" />
          <p className="text-xs" style={{ color: '#ff3b30' }}>{error}</p>
        </div>
      )}

      {/* Split Pane Layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden mt-1">
        
        {/* LEFT PANE: Email List */}
        <div className="w-5/12 flex flex-col apple-card min-h-0">
            <div className="px-4 py-3 border-b border-[var(--border-primary)] flex-shrink-0 bg-[var(--bg-secondary)] rounded-t-xl z-10 sticky top-0 flex justify-between items-center">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Inbox ({filtered.length})</p>
                <button 
                  onClick={clearInbox}
                  disabled={emails.length === 0}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                  title="Clear Inbox">
                  <Trash2 size={14} />
                </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {loading && emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40">
                        <Loader size={20} color={COLOR} className="animate-spin mb-2" />
                        <p className="text-xs text-[var(--text-tertiary)]">Loading...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 opacity-70">
                        <Inbox size={28} color="var(--text-tertiary)" className="mb-2" />
                        <p className="text-xs text-[var(--text-secondary)]">No emails found.</p>
                    </div>
                ) : (
                    filtered.map((e) => {
                        const isSelected = selectedId === e.id;
                        const pc = PRIORITY_COLORS[e.priority] || '#8e8e93';
                        const sc = SENTIMENT_COLORS[e.sentiment_label] || '#8e8e93';
                        const catLabel = CATEGORY_LABELS[e.category] || e.category || '—';
                        const senderName = e.from_email.includes('<') ? e.from_email.split('<')[0].trim() : e.from_email.split('@')[0];
                        
                        return (
                            <div 
                                key={e.id}
                                onClick={() => setSelectedId(e.id)}
                                className={`p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-[var(--bg-hover)] ring-1 ring-[var(--border-primary)]' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                style={{ borderLeft: `3px solid ${e.analyzed ? pc : '#ff9500'}` }}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                        {senderName}
                                    </p>
                                    {e.received_at && (
                                        <p className="text-[10px] text-[var(--text-tertiary)] ml-2 flex-shrink-0">
                                            {new Date(e.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                                <p className="text-xs font-medium text-[var(--text-primary)] mb-1 truncate">{e.subject}</p>
                                <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-2 leading-relaxed mb-2">
                                    {e.body_preview}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {e.analyzed ? (
                                        <>
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${pc}15`, color: pc }}>{e.priority}</span>
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${sc}15`, color: sc }}>{e.sentiment_label}</span>
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${COLOR}10`, color: COLOR }}>{catLabel}</span>
                                        </>
                                    ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/10 text-orange-500 flex items-center gap-1">
                                            ⏳ Pending AI Analysis
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

        {/* RIGHT PANE: Detailed Analysis */}
        <div className="w-7/12 flex flex-col apple-card min-h-0 overflow-y-auto">
            {selectedEmail ? (
                <div className="p-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{selectedEmail.subject}</h2>
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                            From: <span className="font-semibold">{selectedEmail.from_email}</span>
                        </p>
                        
                        {/* Original Body - Always Visible */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Original Message</p>
                                {!selectedEmail.analyzed && (
                                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-orange-500/10 text-orange-600 text-[10px] font-bold animate-pulse">
                                        <Loader size={10} className="animate-spin" />
                                        AI Analysis in Progress...
                                    </div>
                                )}
                            </div>
                            <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
                                {selectedEmail.body_preview}
                                {selectedEmail.body_preview.length >= 250 && "..."}
                                <br/><br/>
                                <span className="italic opacity-60 text-xs">(Full body preview truncated for demo)</span>
                            </div>
                        </div>

                        {/* Analysis Metrics */}
                        {selectedEmail.analyzed ? (
                            <div className="flex gap-3 flex-wrap mb-6 p-4 rounded-xl bg-[var(--bg-tertiary)]">
                                {[
                                    { label: 'Priority', value: selectedEmail.priority, color: PRIORITY_COLORS[selectedEmail.priority] },
                                    { label: 'Category', value: CATEGORY_LABELS[selectedEmail.category] || selectedEmail.category, color: COLOR },
                                    { label: 'Sentiment', value: `${selectedEmail.sentiment_score}/10 (${selectedEmail.sentiment_label})`, color: SENTIMENT_COLORS[selectedEmail.sentiment_label] },
                                    { label: 'Emotion', value: selectedEmail.sentiment_emotion || '—', color: 'var(--text-secondary)' },
                                    { label: 'Urgency', value: selectedEmail.sentiment_urgency || '—', color: selectedEmail.sentiment_urgency === 'high' ? '#ff3b30' : 'var(--text-secondary)' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="min-w-fit">
                                        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                        <p className="text-sm font-semibold capitalize mt-0.5" style={{ color }}>{value}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mb-6 rounded-xl border border-dashed border-orange-500/20 bg-orange-500/5 p-4 flex items-center justify-center gap-3">
                                <Loader size={16} color="#ff9500" className="animate-spin" />
                                <p className="text-xs font-semibold text-orange-600">Our agent is building your AI response and analysis...</p>
                            </div>
                        )}

                        {/* AI Draft */}
                        {selectedEmail.analyzed && selectedEmail.draft_response && (
                            <div className="mb-6 rounded-xl overflow-hidden" style={{ border: `1px solid ${COLOR}30` }}>
                                <div className="flex justify-between items-center p-3" style={{ background: `${COLOR}10` }}>
                                    <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                                        <span style={{ color: COLOR }}>✦</span> AI Draft Response
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={copyDraft}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                            style={{ background: 'var(--bg-primary)', color: COLOR, border: `1px solid ${COLOR}30` }}>
                                            {copied ? <Check size={12} /> : null}
                                            {copied ? 'Copied' : 'Copy'}
                                        </button>
                                        <button onClick={sendDraft}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold"
                                            style={{ background: COLOR, color: '#fff', border: 'none', cursor: 'pointer' }}>
                                            ✉ Send Reply
                                        </button>
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--bg-primary)]">
                                    <textarea
                                        className="w-full text-sm bg-transparent resize-y outline-none"
                                        style={{ color: 'var(--text-secondary)', lineHeight: 1.6, minHeight: 140, fontFamily: 'inherit', border: 'none' }}
                                        value={draftEdit[selectedEmail.id] ?? selectedEmail.draft_response}
                                        onChange={e => setDraftEdit(prev => ({ ...prev, [selectedEmail.id]: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Follow-ups */}
                        {selectedEmail.analyzed && selectedEmail.follow_up_suggestions?.length > 0 && (
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Suggested Actions</p>
                                <div className="space-y-2">
                                    {selectedEmail.follow_up_suggestions.map((f, i) => (
                                        <div key={i} className="flex gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] items-center">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${COLOR}20`, color: COLOR }}>
                                                {i + 1}
                                            </div>
                                            <p className="text-sm text-[var(--text-secondary)]">{f}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <Mail size={48} color="var(--text-tertiary)" className="mb-4 opacity-50" />
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Select an email to view details</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
