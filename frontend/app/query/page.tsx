'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Copy, Check, ChevronDown, ChevronRight, Download, Database } from 'lucide-react';
import type { QueryMessage } from '@/types';

const COLOR = '#ff3b30';

const EXAMPLE_QUESTIONS = [
  'Show all leads with AI score above 80',
  'Which deals are stalled?',
  'Revenue this month by deal stage',
  'Top 5 customers by MRR',
  'Which agents ran today and how many times?',
  'Show open critical support tickets',
];

// ---- Mock responses for each example ----
const MOCK_RESPONSES: Record<string, Omit<QueryMessage, 'id' | 'timestamp' | 'role'>> = {
  'Show all leads with AI score above 80': {
    content: 'Found 7 leads with an AI qualification score above 80. These are high-value prospects currently being tracked by the Lead Qualification Agent.',
    sql: `SELECT email, first_name, last_name, company_name, lead_score, lead_status
FROM contacts
WHERE lead_score > 80
ORDER BY lead_score DESC;`,
    table_name: 'contacts',
    execution_time_ms: 47,
    row_count: 7,
    column_count: 6,
    data: [
      { email: 'cto@techcorp.com',    first_name: 'John',    last_name: 'Smith',   company_name: 'TechCorp',    lead_score: 94, lead_status: 'Enterprise Sales' },
      { email: 'vp@innovate.io',      first_name: 'Sarah',   last_name: 'Kim',     company_name: 'Innovate.io', lead_score: 90, lead_status: 'Enterprise Sales' },
      { email: 'cso@globalco.com',    first_name: 'Alex',    last_name: 'Reeves',  company_name: 'GlobalCo',    lead_score: 88, lead_status: 'Enterprise Sales' },
      { email: 'dir@midmarket.net',   first_name: 'Maya',    last_name: 'Patel',   company_name: 'MidMarket',   lead_score: 85, lead_status: 'Mid-Market Sales' },
      { email: 'head@fintech.ai',     first_name: 'Carlos',  last_name: 'Torres',  company_name: 'FintechAI',   lead_score: 83, lead_status: 'Mid-Market Sales' },
      { email: 'mgr@cloudbase.dev',   first_name: 'Priya',   last_name: 'Shah',    company_name: 'CloudBase',   lead_score: 82, lead_status: 'Mid-Market Sales' },
      { email: 'ops@growthco.com',    first_name: 'James',   last_name: 'Li',      company_name: 'GrowthCo',    lead_score: 81, lead_status: 'SMB Sales' },
    ],
  },
  'Which deals are stalled?': {
    content: 'Identified 4 stalled deals — these are deals with no recorded activity for more than 14 days. Total at-risk pipeline value: $487,000.',
    sql: `SELECT name, stage, value, last_activity_date,
  JULIANDAY('now') - JULIANDAY(last_activity_date) AS days_inactive
FROM deals
WHERE stage NOT IN ('closed_won', 'closed_lost')
  AND JULIANDAY('now') - JULIANDAY(last_activity_date) > 14
ORDER BY days_inactive DESC;`,
    table_name: 'deals',
    execution_time_ms: 63,
    row_count: 4,
    column_count: 5,
    data: [
      { name: 'RetailCo CRM Rollout',      stage: 'qualification', value: 45000,  last_activity_date: '2026-03-10', days_inactive: 25 },
      { name: 'Globex Enterprise License', stage: 'negotiation',   value: 125000, last_activity_date: '2026-03-17', days_inactive: 18 },
      { name: 'HealthGroup Analytics',     stage: 'proposal',      value: 183000, last_activity_date: '2026-03-20', days_inactive: 15 },
      { name: 'StartupAI Seed Package',    stage: 'prospecting',   value: 134000, last_activity_date: '2026-03-21', days_inactive: 14 },
    ],
  },
  'Revenue this month by deal stage': {
    content: 'Here is the deal value breakdown by pipeline stage for April 2026. Total active pipeline: $1.2M with negotiation stage holding the highest value.',
    sql: `SELECT stage, COUNT(*) as deal_count, SUM(value) as total_value
FROM deals
WHERE created_at >= date('now', 'start of month')
GROUP BY stage
ORDER BY total_value DESC;`,
    table_name: 'deals',
    execution_time_ms: 38,
    row_count: 5,
    column_count: 3,
    data: [
      { stage: 'negotiation',   deal_count: 3, total_value: 487000 },
      { stage: 'proposal',      deal_count: 5, total_value: 342000 },
      { stage: 'qualification', deal_count: 8, total_value: 218000 },
      { stage: 'prospecting',   deal_count: 12, total_value: 184000 },
      { stage: 'closed_won',    deal_count: 4, total_value: 156000 },
    ],
  },
  'Top 5 customers by MRR': {
    content: 'Here are your top 5 customers ranked by Monthly Recurring Revenue. These accounts represent $43,200/mo or 33% of total MRR.',
    sql: `SELECT company_name, mrr, health_score, churn_risk
FROM customers
ORDER BY mrr DESC
LIMIT 5;`,
    table_name: 'customers',
    execution_time_ms: 29,
    row_count: 5,
    column_count: 4,
    data: [
      { company_name: 'Globex Corporation', mrr: 12400, health_score: 88, churn_risk: 'low'    },
      { company_name: 'TechVista Inc.',     mrr: 9800,  health_score: 74, churn_risk: 'medium' },
      { company_name: 'InnovateCo',         mrr: 8200,  health_score: 91, churn_risk: 'low'    },
      { company_name: 'CloudBase Ltd.',     mrr: 6700,  health_score: 62, churn_risk: 'medium' },
      { company_name: 'DataDriven AI',      mrr: 6100,  health_score: 55, churn_risk: 'high'   },
    ],
  },
  'Which agents ran today and how many times?': {
    content: 'All 6 AI agents ran today. Lead Qualification and Customer Success were most active with 12+ runs each, processing incoming leads and monitoring customer health.',
    sql: `SELECT agent_name, COUNT(*) as runs_today,
  MAX(created_at) as last_run
FROM agent_activity_log
WHERE DATE(created_at) = DATE('now')
GROUP BY agent_name
ORDER BY runs_today DESC;`,
    table_name: 'agent_activity_log',
    execution_time_ms: 55,
    row_count: 6,
    column_count: 3,
    data: [
      { agent_name: 'LeadQualificationAgent', runs_today: 12, last_run: '2026-04-04 15:47:22' },
      { agent_name: 'CustomerSuccessAgent',   runs_today: 15, last_run: '2026-04-04 15:52:01' },
      { agent_name: 'EmailIntelligenceAgent', runs_today: 8,  last_run: '2026-04-04 15:49:30' },
      { agent_name: 'AnalyticsAgent',         runs_today: 6,  last_run: '2026-04-04 15:43:17' },
      { agent_name: 'SalesPipelineAgent',     runs_today: 3,  last_run: '2026-04-04 14:30:55' },
      { agent_name: 'MeetingSchedulerAgent',  runs_today: 2,  last_run: '2026-04-04 12:15:44' },
    ],
  },
  'Show open critical support tickets': {
    content: 'Found 3 open critical support tickets. These require immediate attention — 2 are overdue and 1 is within SLA.',
    sql: `SELECT ticket_id, customer_name, subject, priority, status, created_at,
  JULIANDAY('now') - JULIANDAY(created_at) as age_days
FROM support_tickets
WHERE priority = 'critical' AND status = 'open'
ORDER BY created_at ASC;`,
    table_name: 'support_tickets',
    execution_time_ms: 42,
    row_count: 3,
    column_count: 7,
    data: [
      { ticket_id: 'TKT-2941', customer_name: 'Acme Corp',   subject: 'Data sync failure — production down', priority: 'critical', status: 'open', created_at: '2026-04-02', age_days: 2 },
      { ticket_id: 'TKT-2987', customer_name: 'Globex Corp', subject: 'API authentication broken for all users', priority: 'critical', status: 'open', created_at: '2026-04-03', age_days: 1 },
      { ticket_id: 'TKT-3010', customer_name: 'TechVista',   subject: 'Dashboard not loading — white screen', priority: 'critical', status: 'open', created_at: '2026-04-04', age_days: 0 },
    ],
  },
};

function getResponse(question: string): Omit<QueryMessage, 'id' | 'timestamp' | 'role'> {
  // Match exact or fuzzy
  for (const key of Object.keys(MOCK_RESPONSES)) {
    if (question.toLowerCase().includes(key.toLowerCase().substring(0, 20))) {
      return MOCK_RESPONSES[key];
    }
  }
  // Fallback generic response
  return {
    content: `Query executed successfully. Here are the results based on your question: "${question}"`,
    sql: `SELECT * FROM contacts WHERE lead_score > 50 LIMIT 10;`,
    table_name: 'contacts',
    execution_time_ms: 45,
    row_count: 10,
    column_count: 4,
    data: [
      { email: 'demo@example.com', first_name: 'Demo', last_name: 'User', lead_score: 75 },
    ],
  };
}

function makeId() { return Math.random().toString(36).slice(2); }

// ---- Collapsible Detail ----
function QueryDetail({ msg }: { msg: QueryMessage }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.sql || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 space-y-2">
      {/* SQL block */}
      {msg.sql && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>SQL Query</span>
            <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={copy}>
              {copied ? <><Check size={10} />Copied!</> : <><Copy size={10} />Copy</>}
            </button>
          </div>
          <div className="code-block" style={{ fontSize: 11, maxHeight: 120 }}>
            {msg.sql}
          </div>
        </div>
      )}
      {/* Collapsible query details */}
      <button className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Query Details
      </button>
      {open && (
        <div className="flex gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span>Table: <strong style={{ color: 'var(--text-secondary)' }}>{msg.table_name}</strong></span>
          <span>Time: <strong style={{ color: 'var(--text-secondary)' }}>{msg.execution_time_ms}ms</strong></span>
          <span>Rows: <strong style={{ color: 'var(--text-secondary)' }}>{msg.row_count}</strong></span>
        </div>
      )}
    </div>
  );
}

// ---- Data Table ----
function ResultTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null;
  const cols = Object.keys(data[0]);

  const exportCSV = () => {
    const rows = [cols.join(','), ...data.map((r) => cols.map((c) => String(r[c] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'query_results.csv'; a.click();
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} style={{ whiteSpace: 'nowrap' }}>{c.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c}>{String(row[c] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.length} rows · {cols.length} columns</span>
        <button className="btn-ghost ml-auto" style={{ fontSize: 12 }} onClick={exportCSV}>
          <Download size={12} />
          Export CSV
        </button>
      </div>
    </div>
  );
}

export default function QueryPage() {
  const [messages, setMessages] = useState<QueryMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const chatEndRef              = useRef<HTMLDivElement>(null);
  const latestAssistant         = messages.filter((m) => m.role === 'assistant').slice(-1)[0];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    const question = q.trim();
    setInput('');
    setLoading(true);

    // Add user message
    const userMsg: QueryMessage = { id: makeId(), role: 'user', content: question, timestamp: new Date() };
    setMessages((p) => [...p, userMsg]);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    const resp = getResponse(question);
    // Also try real API
    try {
      await fetch('http://localhost:8000/api/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      }).catch(() => null);
    } catch { /* ignore */ }

    const aiMsg: QueryMessage = {
      id: makeId(),
      role: 'assistant',
      timestamp: new Date(),
      ...resp,
    };
    setMessages((p) => [...p, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Database size={22} color={COLOR} />
          <h1 className="section-title" style={{ fontSize: 22 }}>Query Database</h1>
          <span className="badge badge-red ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle">Ask anything about your CRM data in plain English</p>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>
        ))}
      </div>

      <div className="flex gap-4" style={{ minHeight: 500 }}>
        {/* LEFT — Chat */}
        <div className="flex flex-col" style={{ flex: '0 0 55%', minWidth: 0 }}>
          <div
            className="apple-card flex-1 flex flex-col"
            style={{ padding: 0, overflow: 'hidden', minHeight: 400 }}
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 500 }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Database size={32} color="var(--text-tertiary)" />
                  <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>Ask a question about your CRM data above</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                  {msg.role === 'user' ? (
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs"
                      style={{ background: '#0066cc', color: '#fff', fontSize: 14 }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div className="apple-card max-w-full" style={{ padding: 14 }}>
                      <p className="text-sm mb-2" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {msg.content}
                      </p>
                      <QueryDetail msg={msg} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="apple-glass px-4 py-2.5 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full"
                          style={{ background: COLOR, animation: `pulse-ring ${0.9 + i * 0.15}s ease infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            <div className="p-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="apple-glass flex items-center gap-2 px-4 py-2">
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="Ask anything about your data..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ask(input)}
                />
                <button
                  onClick={() => ask(input)}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: COLOR, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}
                >
                  <Send size={14} color="#fff" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Results Table */}
        <div className="flex-1 min-w-0">
          {latestAssistant ? (
            <div className="apple-card animate-fade-in-up" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>Query Results</p>
              </div>
              <div className="p-4">
                {latestAssistant.data && <ResultTable data={latestAssistant.data as Record<string, unknown>[]} />}
              </div>
            </div>
          ) : (
            <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 300, opacity: 0.5 }}>
              <Database size={36} color="var(--text-tertiary)" />
              <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>Results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
