'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, DollarSign, TrendingUp, Activity, Target, Mail,
  BarChart2, Heart, Calendar, Database, Settings, Play, Zap
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import StatCard, { StatCardSkeleton } from '@/components/StatCard';
import ErrorBanner from '@/components/ErrorBanner';
import { getDashboard, getPipeline } from '@/lib/api';
import type { DashboardStats, PipelineData, AgentEvent, AgentStatus } from '@/types';

// ---- Agent definitions ----
const AGENTS: AgentStatus[] = [
  { name: 'Lead Qualification', id: 'lead', color: '#0066cc', emoji: '🎯', route: '/leads',     status: 'active',  runsToday: 12, lastRun: '2 min ago' },
  { name: 'Email Intelligence', id: 'email', color: '#5e5ce6', emoji: '📧', route: '/email',     status: 'active',  runsToday: 8,  lastRun: '5 min ago' },
  { name: 'Sales Pipeline',     id: 'sales', color: '#34c759', emoji: '💰', route: '/pipeline',  status: 'standby', runsToday: 3,  lastRun: '1 hr ago'  },
  { name: 'Customer Success',   id: 'cs',    color: '#ff9500', emoji: '🎉', route: '/customers', status: 'active',  runsToday: 15, lastRun: '30 sec ago'},
  { name: 'Meeting Scheduler',  id: 'meet',  color: '#bf5af2', emoji: '📅', route: '/meetings',  status: 'standby', runsToday: 2,  lastRun: '3 hr ago'  },
  { name: 'Analytics',          id: 'ana',   color: '#30b0c7', emoji: '📊', route: '/analytics', status: 'active',  runsToday: 6,  lastRun: '10 min ago'},
];

// ---- Live event seed data ----
const SEED_EVENTS: Omit<AgentEvent, 'id' | 'timestamp'>[] = [
  { agent: 'Lead Qualification', agentColor: '#0066cc', description: 'Scored lead john@techcorp.com — 87/100 → Enterprise Sales', type: 'success' },
  { agent: 'Email Intelligence', agentColor: '#5e5ce6', description: 'Analyzed negative email from sarah@example.com — escalated to Priority queue', type: 'warning' },
  { agent: 'Customer Success',   agentColor: '#ff9500', description: 'High churn risk detected for Acme Corp — health score dropped to 34', type: 'error'   },
  { agent: 'Analytics',          agentColor: '#30b0c7', description: 'Pipeline report generated — $485K in active deals identified', type: 'info'    },
  { agent: 'Lead Qualification', agentColor: '#0066cc', description: 'New lead enriched: Maya Patel, CTO @StartupXYZ — score: 72', type: 'success' },
  { agent: 'Meeting Scheduler',  agentColor: '#bf5af2', description: 'Executive demo scheduled with Globex Corp — Apr 8, 2:00 PM', type: 'success' },
  { agent: 'Sales Pipeline',     agentColor: '#34c759', description: 'Deal "Globex Enterprise License" marked as stalled — 14 days inactive', type: 'warning' },
  { agent: 'Email Intelligence', agentColor: '#5e5ce6', description: 'Personalized reply drafted for pricing inquiry — sentiment: positive', type: 'success' },
  { agent: 'Customer Success',   agentColor: '#ff9500', description: 'Upsell opportunity identified for TechVentures — $1,200 MRR potential', type: 'info' },
  { agent: 'Analytics',          agentColor: '#30b0c7', description: 'Weekly pipeline health report sent to leadership team', type: 'info' },
];

function makeEvent(seed: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent {
  return {
    ...seed,
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
  };
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

// ---- Pipeline chart colors ----
const STAGE_COLORS: Record<string, string> = {
  prospecting:   '#0066cc',
  qualification: '#5e5ce6',
  proposal:      '#bf5af2',
  negotiation:   '#ff9500',
  closed_won:    '#34c759',
  closed_lost:   '#ff3b30',
};

export default function MissionControlPage() {
  const [stats, setStats]         = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline]   = useState<PipelineData | null>(null);
  const [events, setEvents]       = useState<AgentEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [d, p] = await Promise.all([getDashboard(), getPipeline()]);
      setStats(d);
      setPipeline(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Seed initial events
    const initial = SEED_EVENTS.slice(0, 6).map(makeEvent).reverse();
    setEvents(initial);

    // Live event stream
    const interval = setInterval(() => {
      const seed = SEED_EVENTS[Math.floor(Math.random() * SEED_EVENTS.length)];
      setEvents((prev) => [makeEvent(seed), ...prev].slice(0, 20));
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Transform pipeline data for Recharts
  const chartData = pipeline
    ? Object.entries(pipeline).map(([stage, d]) => ({
        stage: stage.replace('_', ' '),
        count: d.count,
        value: Math.round(d.value / 1000),
        color: STAGE_COLORS[stage] || '#8e8e93',
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="section-title" style={{ fontSize: 24 }}>Mission Control</h1>
        <p className="section-subtitle">Real-time AI agent activity and CRM overview</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchData} />}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {loading ? (
          [1,2,3,4].map(i => <StatCardSkeleton key={i} />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Leads"
              value={stats.leads.total.toLocaleString()}
              icon={<Users size={20} />}
              color="#0066cc"
              subtitle={`${stats.leads.qualified} qualified`}
              trend={{ value: 12, direction: 'up' }}
            />
            <StatCard
              label="Pipeline Value"
              value={fmtMoney(stats.deals.pipeline_value)}
              icon={<DollarSign size={20} />}
              color="#34c759"
              subtitle={`${stats.deals.total} active deals`}
              trend={{ value: 8, direction: 'up' }}
            />
            <StatCard
              label="Active Customers"
              value={stats.customers.total.toLocaleString()}
              icon={<Heart size={20} />}
              color="#ff9500"
              trend={{ value: 3, direction: 'up' }}
            />
            <StatCard
              label="MRR"
              value={fmtMoney(stats.customers.mrr)}
              icon={<TrendingUp size={20} />}
              color="#bf5af2"
              subtitle={`ARR: ${fmtMoney(stats.customers.arr)}`}
              trend={{ value: 5, direction: 'up' }}
            />
          </>
        ) : null}
      </div>

      {/* Two-column section */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* LEFT — Live Agent Activity Feed */}
        <div className="apple-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div className="status-dot status-dot-active" />
            <h2 className="font-700 text-base" style={{ fontWeight: 700 }}>Live Agent Activity</h2>
            <span className="badge badge-green ml-auto">Live</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex gap-3 px-5 py-3 animate-fade-in-up"
                style={{ borderBottom: '1px solid var(--border-secondary)' }}
              >
                <div
                  className="status-dot flex-shrink-0 mt-1.5"
                  style={{ background: ev.agentColor, boxShadow: 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span
                      className="badge"
                      style={{ background: `${ev.agentColor}18`, color: ev.agentColor, fontSize: 10, padding: '2px 8px' }}
                    >
                      {ev.agent}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {fmt(ev.timestamp)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {ev.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Agent Status Panel */}
        <div className="apple-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <h2 className="font-700 text-base" style={{ fontWeight: 700 }}>Agent Status</h2>
          </div>
          <div className="divide-y" style={{ borderTop: 'none' }}>
            {AGENTS.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 px-4 py-3">
                <span style={{ fontSize: 18 }}>{agent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: agent.status === 'active' ? 'rgba(52,199,89,0.15)' : 'rgba(142,142,147,0.15)',
                        color: agent.status === 'active' ? '#34c759' : '#6e6e73',
                        fontSize: 9, padding: '1px 6px',
                      }}
                    >
                      {agent.status === 'active' ? '● Active' : 'Standby'}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {agent.runsToday} runs today · {agent.lastRun}
                  </p>
                </div>
                <Link href={agent.route}>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: `${agent.color}15`,
                      color: agent.color,
                      border: `1px solid ${agent.color}30`,
                      cursor: 'pointer',
                    }}
                  >
                    <Play size={10} />
                    Run
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Funnel Chart */}
      <div className="apple-card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={18} color="#30b0c7" />
          <h2 className="font-700 text-base" style={{ fontWeight: 700 }}>Pipeline Funnel</h2>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>Deal value (K) by stage</span>
        </div>
        {loading ? (
          <div className="skeleton h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="stage"
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v}K`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(v, name) =>
                  name === 'value' ? [`$${Number(v)}K`, 'Value'] : [v, 'Deals']
                }
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
