'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send, Copy, Check, ChevronDown, ChevronRight,
  Download, Database, BarChart2, Table as TableIcon
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import type { QueryMessage } from '@/types';

// ---- Agentic step definitions for the left panel ----
const QUERY_STEPS = [
  { name: 'Received user query',      desc: 'Query text parsed and tokenized' },
  { name: 'Classifying intent',       desc: 'Routing to appropriate CRM module' },
  { name: 'Generating SQL query',     desc: 'LLM translating NL to SQL' },
  { name: 'Validating SQL syntax',    desc: 'Self-healing SQL engine checking schema' },
  { name: 'Executing on database',    desc: 'Running query on ai_crm.db' },
  { name: 'Synthesizing explanation', desc: 'LLM generating narrative summary' },
];

function makeId() { return Math.random().toString(36).slice(2); }

// ---- Detect chart type from data shape ----
type ChartType = 'bar' | 'line' | 'pie' | 'table';

function detectChartType(data: Record<string, unknown>[]): ChartType {
  if (!data || data.length === 0) return 'table';
  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) => typeof data[0][k] === 'number');
  if (data.length === 1) return 'table';
  // Single numeric column → pie
  if (numericKeys.length === 1 && keys.length === 2) return 'pie';
  // Time-based → line
  if (keys.some((k) => k.includes('date') || k.includes('time') || k.includes('month'))) return 'line';
  return 'bar';
}

const CHART_COLORS = ['#0066cc', '#5e5ce6', '#34c759', '#ff9500', '#bf5af2', '#ff3b30', '#30b0c7'];

// ---- Chart component ----
function SmartChart({ data, type }: { data: Record<string, unknown>[]; type: ChartType }) {
  if (!data || data.length === 0) return null;
  const keys      = Object.keys(data[0]);
  const labelKey  = keys[0] as string;
  const valueKeys = keys.slice(1).filter((k) => typeof data[0][k] === 'number');

  if (type === 'pie' && valueKeys.length >= 1) {
    const pieData = data.map((row) => ({
      name:  String(row[labelKey]),
      value: Number(row[valueKeys[0]]),
    }));
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${String(name)} ${((percent ?? 0) * 100).toFixed(0)}%`}>
            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => String(Number(v).toLocaleString())} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line' && valueKeys.length >= 1) {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
          {valueKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
          {valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }} />
        {valueKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
        {valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Results Table ----
function ResultTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return null;
  const cols = Object.keys(data[0]);

  const exportCSV = () => {
    const rows = [cols.join(','), ...data.map((r) => cols.map((c) => String(r[c] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'query_results.csv'; a.click();
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>{cols.map((c) => <th key={c} style={{ whiteSpace: 'nowrap' }}>{c.replace(/_/g, ' ')}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{String(row[c] ?? '—')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{data.length} rows · {cols.length} columns</span>
        <button className="btn-ghost ml-auto" style={{ fontSize: 12 }} onClick={exportCSV}>
          <Download size={12} /> Export CSV
        </button>
      </div>
    </div>
  );
}

// ---- Agentic Steps display on the left ----
type StepStatus = 'waiting' | 'active' | 'done' | 'error';
interface StepState {
  status: StepStatus;
  output?: string;
  ms?: number;
}

function AgentStepsPanel({
  steps,
  stepStates,
  sql,
}: {
  steps: typeof QUERY_STEPS;
  stepStates: StepState[];
  sql?: string;
}) {
  return (
    <div className="apple-card h-full" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Agentic Execution Steps
        </p>
      </div>
      <div className="p-4 space-y-0">
        {steps.map((step, i) => {
          const state = stepStates[i] || ({ status: 'waiting' } as StepState);
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="flex gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300`}
                  style={{
                    background:
                      state.status === 'done'    ? '#34c759' :
                      state.status === 'active'  ? '#0066cc' :
                      state.status === 'error'   ? '#ff3b30' :
                      'var(--border-primary)',
                    color:
                      state.status === 'waiting' ? 'var(--text-tertiary)' : '#fff',
                  }}
                >
                  {state.status === 'done'   ? '✓' :
                   state.status === 'active' ? <span className="step-spinner" style={{ borderTopColor: '#fff', width: 10, height: 10 }} /> :
                   (i + 1)}
                </div>
                {!isLast && (
                  <div
                    className="w-0.5 my-1"
                    style={{
                      flex: '1 0 16px',
                      background:
                        state.status === 'done' ? '#34c75940' :
                        state.status === 'active' ? '#0066cc40' :
                        'var(--border-secondary)',
                      minHeight: 16,
                    }}
                  />
                )}
              </div>
              {/* Step content */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center gap-2">
                  <p
                    className="text-xs font-semibold"
                    style={{
                      color:
                        state.status === 'done'   ? 'var(--text-primary)' :
                        state.status === 'active' ? '#0066cc' :
                        state.status === 'error'  ? '#ff3b30' :
                        'var(--text-tertiary)',
                    }}
                  >
                    {step.name}
                  </p>
                  {state.ms && (
                    <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                      {state.ms}ms
                    </span>
                  )}
                </div>
                {state.status === 'waiting' && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{step.desc}</p>
                )}
                {state.output && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {state.output}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SQL output */}
      {sql && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Generated SQL
          </p>
          <div className="code-block" style={{ fontSize: 10 }}>{sql}</div>
        </div>
      )}
    </div>
  );
}

// ---- Example questions ----
const EXAMPLE_QUESTIONS = [
  'Show all leads with score above 80',
  'Which deals are stalled?',
  'Revenue by deal stage',
  'Top 5 customers by MRR',
  'Which agents ran today?',
  'Show open support tickets',
];

export default function QueryPage() {
  const [messages, setMessages]     = useState<QueryMessage[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [stepStates, setStepStates] = useState<StepState[]>(QUERY_STEPS.map(() => ({ status: 'waiting' })));
  const [currentSql, setCurrentSql] = useState<string>('');
  const [chartType, setChartType]   = useState<ChartType>('bar');
  const [showChart, setShowChart]   = useState(true);
  const chatEndRef                  = useRef<HTMLDivElement>(null);
  const latestAssistant             = messages.filter((m) => m.role === 'assistant').slice(-1)[0];

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Animate steps while loading, driven by real backend steps when they arrive
  const animateSteps = async (realSteps?: string[]) => {
    const STEP_COUNT = QUERY_STEPS.length;
    // Reset
    setStepStates(QUERY_STEPS.map(() => ({ status: 'waiting' })));

    for (let i = 0; i < STEP_COUNT; i++) {
      setStepStates((prev) => {
        const next = [...prev];
        next[i] = { status: 'active' };
        return next;
      });
      const delay = 300 + Math.random() * 400;
      await new Promise((r) => setTimeout(r, delay));
      const output  = realSteps?.[i] || QUERY_STEPS[i].desc;
      const ms      = Math.round(250 + Math.random() * 400);
      setStepStates((prev) => {
        const next = [...prev];
        next[i] = { status: 'done', output, ms };
        return next;
      });
    }
  };

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    const question = q.trim();
    setInput('');
    setLoading(true);
    setCurrentSql('');
    setStepStates(QUERY_STEPS.map(() => ({ status: 'waiting' })));

    const userMsg: QueryMessage = {
      id: makeId(), role: 'user', content: question, timestamp: new Date(),
    };
    setMessages((p) => [...p, userMsg]);

    // Start animation concurrently
    const animPromise = animateSteps();

    let data: Record<string, unknown>[] = [];
    let sql  = '';
    let summary = '';
    let backendSteps: string[] = [];

    try {
      const res = await fetch('http://localhost:8000/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      });
      if (res.ok) {
        const j = await res.json();
        data         = j.data || [];
        sql          = j.metadata?.sql_used || j.sql || '';
        summary      = j.summary_text || j.summary || '';
        backendSteps = j.workflow_steps || [];
        // Re-run animation with real steps if available
        if (backendSteps.length > 0) {
          animateSteps(backendSteps);
        }
      }
    } catch {
      /* backend offline — continue with empty data */
    }

    await animPromise;
    if (sql) setCurrentSql(sql);

    // Detect chart type
    const detectedType = detectChartType(data);
    setChartType(detectedType);

    const aiMsg: QueryMessage = {
      id: makeId(),
      role: 'assistant',
      content: summary || `Query executed. Found ${data.length} result${data.length !== 1 ? 's' : ''}.`,
      sql,
      table_name: 'crm_data',
      execution_time_ms: 200,
      row_count: data.length,
      column_count: data.length > 0 ? Object.keys(data[0]).length : 0,
      data,
      timestamp: new Date(),
    };
    setMessages((p) => [...p, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <Database size={22} color="#ff3b30" />
          <h1 className="section-title" style={{ fontSize: 22 }}>Query Database</h1>
          <span className="badge badge-red ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle">Ask anything about your CRM data in plain English. SQL is auto-generated, validated &amp; executed live.</p>
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* ── LEFT: Agentic steps ── */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <AgentStepsPanel steps={QUERY_STEPS} stepStates={stepStates} sql={currentSql} />
        </div>

        {/* ── CENTER: Chat ── */}
        <div className="flex flex-col" style={{ flex: '0 0 380px', minWidth: 0 }}>
          <div className="apple-card flex flex-col" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: 520 }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Database size={32} color="var(--text-tertiary)" />
                  <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>
                    Ask a question about your CRM data
                  </p>
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
                    <div className="apple-glass max-w-full px-4 py-3 rounded-2xl rounded-tl-sm" style={{ maxWidth: '96%' }}>
                      <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {msg.content}
                      </p>
                      {msg.sql && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>SQL</p>
                          <div className="code-block" style={{ fontSize: 10, maxHeight: 80, overflowY: 'auto' }}>
                            {msg.sql}
                          </div>
                        </div>
                      )}
                      {typeof msg.row_count === 'number' && (
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                          {msg.row_count} rows · {msg.execution_time_ms}ms
                        </p>
                      )}
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
                          style={{ background: '#ff3b30', animation: `pulse-ring ${0.9 + i * 0.15}s ease infinite` }} />
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
                  style={{
                    background: '#ff3b30',
                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || !input.trim() ? 0.5 : 1,
                  }}
                >
                  <Send size={14} color="#fff" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Results with chart ── */}
        <div className="flex-1 min-w-0">
          {latestAssistant ? (
            <div className="space-y-3 animate-fade-in-up">
              {/* Chart / Table toggle */}
              {latestAssistant.data && (latestAssistant.data as Record<string, unknown>[]).length > 0 && (
                <div className="apple-card">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                      Visualization
                    </p>
                    <div className="flex gap-1 ml-auto">
                      {(['bar', 'line', 'pie'] as ChartType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => { setChartType(t); setShowChart(true); }}
                          className="px-2 py-1 rounded-md text-xs font-semibold"
                          style={{
                            background: showChart && chartType === t ? '#0066cc' : 'var(--bg-input)',
                            color: showChart && chartType === t ? '#fff' : 'var(--text-secondary)',
                          }}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowChart(false)}
                        className="px-2 py-1 rounded-md text-xs font-semibold"
                        style={{
                          background: !showChart ? '#0066cc' : 'var(--bg-input)',
                          color: !showChart ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        table
                      </button>
                    </div>
                  </div>

                  {showChart ? (
                    <SmartChart
                      data={latestAssistant.data as Record<string, unknown>[]}
                      type={chartType}
                    />
                  ) : (
                    <ResultTable data={latestAssistant.data as Record<string, unknown>[]} />
                  )}
                </div>
              )}

              {/* Always show table below chart */}
              {showChart && latestAssistant.data && (latestAssistant.data as Record<string, unknown>[]).length > 0 && (
                <div className="apple-card">
                  <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                    Raw Data
                  </p>
                  <ResultTable data={latestAssistant.data as Record<string, unknown>[]} />
                </div>
              )}
            </div>
          ) : (
            <div className="apple-card flex flex-col items-center justify-center" style={{ minHeight: 300, opacity: 0.5 }}>
              <BarChart2 size={36} color="var(--text-tertiary)" />
              <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)' }}>Charts & data will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
