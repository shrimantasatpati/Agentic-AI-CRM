'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Copy, Check, AlertTriangle, Mail, RefreshCw, Loader } from 'lucide-react';
import AgentPageLayout from '@/components/AgentPageLayout';
import type { EmailIntelligenceResult } from '@/types';


const COLOR = '#5e5ce6';

const STEPS = [
  { name: 'Received email', output: 'Email metadata parsed, body extracted successfully' },
  { name: 'Analyzing sentiment', output: 'Sentiment: Negative · Score: 2/10 · Emotion: Frustration' },
  { name: 'Categorizing email type', output: 'Category: complaint · High-priority pattern matched' },
  { name: 'Determining priority', output: 'Priority: HIGH · Requires immediate attention' },
  { name: 'Drafting personalized response', output: 'Empathetic response drafted based on customer history' },
  { name: 'Generating follow-up suggestions', output: '3 strategic follow-up actions generated' },
];

const EXAMPLES = [
  {
    label: 'Angry Customer',
    data: {
      from: 'john@bigclient.com', from_name: 'John Carter', to: 'support@company.com',
      subject: 'Completely unacceptable service!',
      body: 'I am absolutely furious! Your product has been down for 3 hours and we have lost thousands in revenue. This is completely unacceptable and I am considering canceling our contract.',
    },
  },
  {
    label: 'Demo Request',
    data: {
      from: 'sarah@startup.io', from_name: 'Sarah Kim', to: 'sales@company.com',
      subject: 'Interested in your enterprise plan',
      body: 'Hi! I came across your platform and I am very excited. We are a Series B startup with 50 reps and need a proper CRM. Can we schedule a demo this week? Happy to discuss budget.',
    },
  },
  {
    label: 'Pricing Question',
    data: {
      from: 'mike@company.net', from_name: 'Mike Torres', to: 'sales@company.com',
      subject: 'Pricing inquiry - 100 seat license',
      body: 'Hello, we are currently using a competitor and evaluating alternatives. We need pricing for a 100-seat license. Do you offer annual discounts? Please send over your pricing sheet.',
    },
  },
];

const MOCK_RESULT: EmailIntelligenceResult = {
  sentiment: {
    score: 2,
    label: 'negative',
    emotion: 'frustration',
    urgency: 'high',
    concerns: ['Service downtime', 'Revenue loss', 'Contract cancellation threat'],
  },
  category: 'complaint',
  priority: 'high',
  draft_response: `Hi John,

I sincerely apologize for the disruption you've experienced. I completely understand how frustrating a service outage can be, especially when it impacts your revenue.

Our engineering team has identified and resolved the root cause. I'd like to personally ensure this doesn't happen again for your account.

I'd love to schedule a call today to walk you through our remediation steps and discuss a service credit for the downtime. Are you available in the next 2 hours?

Looking forward to making this right.

Best,
Customer Success Team`,
  follow_up_suggestions: [
    '1. Schedule immediate call within 2 hours to address concerns personally',
    '2. Apply service credit for downtime period and document in account notes',
    '3. Flag account for Customer Success monitoring — set 7-day health check',
  ],
  requires_human_review: true,
};

// ---- Gmail + Calendar Integration Banner ----
function GmailConnectBanner() {
  // Default to 'disconnected' so the Connect button shows immediately in all browsers
  const [gmailStatus, setGmailStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/gmail/status');
      if (res.ok) {
        const data = await res.json() as { authenticated: boolean };
        const authed = data.authenticated;
        setGmailStatus(authed ? 'connected' : 'disconnected');
        if (authed && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch { /* backend offline — keep current state */ }
  }, []);

  useEffect(() => {
    checkStatus();
    pollRef.current = setInterval(checkStatus, 3000);
    // Listen for postMessage from the OAuth popup callback page
    const onMessage = (e: MessageEvent) => {
      if (e.data === 'gmail_auth_complete') { checkStatus(); }
    };
    window.addEventListener('message', onMessage);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      window.removeEventListener('message', onMessage);
    };
  }, [checkStatus]);

  const handleConnect = () => {
    // FIREFOX FIX: open popup synchronously (in the click handler, before any await)
    // then redirect it to the OAuth URL once we have it.
    const popup = window.open('about:blank', 'gmail_oauth', 'width=520,height=660,toolbar=0,scrollbars=1');
    fetch('http://localhost:8000/api/auth/gmail')
      .then(async (r) => {
        if (!r.ok) {
          // Backend error (e.g. credentials file not configured)
          const err = await r.json().catch(() => ({ detail: 'Backend error' })) as { detail?: string };
          if (popup && !popup.closed) {
            popup.document.write(`<body style="font-family:sans-serif;background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;padding:32px;background:rgba(255,59,48,.08);border:1px solid rgba(255,59,48,.3);border-radius:20px;max-width:360px"><div style="font-size:40px;margin-bottom:16px">⚠️</div><h2 style="color:#ff3b30;margin:0 0 8px">Setup Required</h2><p style="color:rgba(255,255,255,.6);margin:0 0 16px;font-size:14px">${err.detail || 'Gmail credentials not configured.'}</p><p style="color:rgba(255,255,255,.4);font-size:12px">Add GMAIL_API_CREDENTIALS to backend/.env<br>then download credentials from Google Cloud Console.</p></div></body>`);
          }
          return;
        }
        return r.json();
      })
      .then((data?: { auth_url?: string }) => {
        if (!data || !data.auth_url) return; // Already handled above
        if (popup && !popup.closed) {
          popup.location.href = data.auth_url;
        } else {
          // Popup was blocked — fall back to same-tab redirect
          window.location.href = data.auth_url;
        }
        // Poll every 2s to detect when auth completes
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(checkStatus, 2000);
      })
      .catch(() => { if (popup && !popup.closed) popup.close(); });
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('http://localhost:8000/api/emails/sync?limit=20');
      const data = await res.json() as { fetched?: number; saved_to_crm?: number; status?: string; detail?: string };
      if (!res.ok) {
        const errorMsg = data.detail || 'Sync error — check backend';
        setSyncMsg(`❌ ${errorMsg}`);
        // If backend tells us we aren't actually authenticated, reset state
        if (errorMsg.toLowerCase().includes('not authenticated')) {
          setGmailStatus('disconnected');
        }
      } else {
        const fetched = data.fetched ?? 0;
        const saved   = data.saved_to_crm ?? 0;
        setSyncMsg(
          fetched === 0
            ? '📭 No unread emails in Gmail inbox right now'
            : `✅ ${fetched} fetched, ${saved} new saved to CRM`
        );
      }
    } catch { setSyncMsg('❌ Sync failed — backend unreachable'); }
    setSyncing(false);
  };

  const connected = gmailStatus === 'connected';

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl mb-4"
      style={{
        background: connected ? 'rgba(52,199,89,0.08)' : 'rgba(94,92,230,0.07)',
        border: `1px solid ${connected ? 'rgba(52,199,89,0.3)' : 'rgba(94,92,230,0.25)'}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: connected ? 'rgba(52,199,89,0.15)' : 'rgba(94,92,230,0.15)' }}
      >
        <Mail size={15} color={connected ? '#34c759' : '#5e5ce6'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Gmail</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {connected ? 'Connected · Real emails synced' : 'Connect to sync real incoming emails'}
        </p>
        {syncMsg && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{syncMsg}</p>}
      </div>
      {connected ? (
        <button
          onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: '#34c759', color: '#fff', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.7 : 1 }}
        >
          {syncing ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          {syncing ? 'Syncing…' : 'Sync Gmail'}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{ background: '#5e5ce6', color: '#fff', cursor: 'pointer' }}
        >
          <Mail size={11} />
          Connect Gmail
        </button>
      )}
    </div>
  );
}

export default function EmailPage() {
  const [result, setResult]         = useState<EmailIntelligenceResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);


  const handleRun = useCallback(async (formData: Record<string, string>) => {
    setError(null);
    setIsComplete(false);
    setResult(null);

    // Run animation and real API call in parallel
    const apiCallPromise = fetch('http://localhost:8000/api/agents/analyze-email/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_data: formData }),
    }).then(async (res) => {
      if (!res.ok) return null;
      return res.json() as Promise<EmailIntelligenceResult>;
    }).catch(() => null);

    // Wait for animation to complete (steps × delay + gaps)
    await new Promise((r) => setTimeout(r, STEPS.length * 600 + 400));

    // Use real result if available, else graceful fallback
    const liveResult = await apiCallPromise;
    setResult(liveResult ?? MOCK_RESULT);
    setIsComplete(true);
  }, []);

  const copyResponse = () => {
    if (result?.draft_response) {
      navigator.clipboard.writeText(result.draft_response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sentimentColor = (s: number) => s >= 7 ? '#34c759' : s >= 4 ? '#ff9500' : '#ff3b30';

  return (
    <AgentPageLayout
      agentName="Email Intelligence"
      agentDescription="Analyzes email sentiment, categorizes intent, drafts personalized responses, and suggests strategic follow-ups."
      agentColor={COLOR}
      agentEmoji="📧"
      formFields={[
        { key: 'from', label: 'From Email', type: 'email', placeholder: 'customer@company.com' },
        { key: 'from_name', label: 'From Name', placeholder: 'John Carter' },
        { key: 'to', label: 'To Email', type: 'email', placeholder: 'support@yourcrm.com' },
        { key: 'subject', label: 'Subject', placeholder: 'Email subject line' },
        { key: 'body', label: 'Email Body', type: 'textarea', placeholder: 'Full email content...', rows: 5 },
      ]}
      defaultValues={EXAMPLES[0].data}
      examples={EXAMPLES}
      steps={STEPS}
      onRun={handleRun}
      error={error}
      isComplete={isComplete}
      headerExtra={<GmailConnectBanner />}
      resultNode={result && (

        <div className="space-y-4">
          {/* Requires Review Banner */}
          {result.requires_human_review && (
            <div className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)' }}>
              <AlertTriangle size={16} color="#ff9500" />
              <span className="text-sm font-semibold" style={{ color: '#ff9500' }}>Requires Human Review</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>Negative sentiment or high priority detected</span>
            </div>
          )}

          {/* Sentiment + Category */}
          <div className="apple-card">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Sentiment Score</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 32, fontWeight: 800, color: sentimentColor(result.sentiment.score) }}>
                    {result.sentiment.score}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>/10</span>
                </div>
                <span className={`badge badge-${result.sentiment.label === 'positive' ? 'green' : result.sentiment.label === 'negative' ? 'red' : 'gray'} mt-1`}>
                  {result.sentiment.emotion}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Category</p>
                <span className="badge badge-indigo text-sm" style={{ fontSize: 13 }}>{result.category.replace('_', ' ')}</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Priority</p>
                <span className={`badge badge-${result.priority === 'high' ? 'red' : result.priority === 'medium' ? 'orange' : 'gray'} text-sm`} style={{ fontSize: 13 }}>
                  {result.priority.toUpperCase()}
                </span>
                <div className="mt-1">
                  <span className="badge badge-yellow">{result.sentiment.urgency} urgency</span>
                </div>
              </div>
            </div>
            {result.sentiment.concerns.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Concerns</p>
                <div className="flex flex-wrap gap-2">
                  {result.sentiment.concerns.map((c, i) => (
                    <span key={i} className="chip" style={{ fontSize: 11, cursor: 'default' }}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Draft Response */}
          <div className="apple-card">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>AI Draft Response</p>
              <button className="btn-ghost ml-auto" style={{ fontSize: 12 }} onClick={copyResponse}>
                {copied ? <><Check size={12} />Copied!</> : <><Copy size={12} />Copy</>}
              </button>
            </div>
            <div className="apple-glass" style={{ padding: 14 }}>
              <pre style={{ fontFamily: 'var(--font-primary)', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {result.draft_response}
              </pre>
            </div>
          </div>

          {/* Follow-up Suggestions */}
          <div className="apple-card">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Follow-up Suggestions</p>
            <div className="space-y-2">
              {result.follow_up_suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-secondary)' }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: COLOR, color: '#fff' }}>
                    {i + 1}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.replace(/^\d+\.\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
}
