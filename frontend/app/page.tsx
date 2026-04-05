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

// ---- Helpers ----
function makeId() { return Math.random().toString(36).slice(2); }

// Map backend agent name to display label
const AGENT_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  LeadQualificationAgent: { label: 'Lead Qualification', emoji: '🎯', color: '#0066cc' },
  EmailIntelligenceAgent: { label: 'Email Intelligence', emoji: '📧', color: '#5e5ce6' },
  SalesPipelineAgent:     { label: 'Sales Pipeline',     emoji: '💼', color: '#34c759' },
  CustomerSuccessAgent:   { label: 'Customer Success',   emoji: '🤝', color: '#ff9500' },
  MeetingSchedulerAgent:  { label: 'Meeting Scheduler',  emoji: '📅', color: '#bf5af2' },
  AnalyticsAgent:         { label: 'Analytics',          emoji: '📊', color: '#ff3b30' },
  AskCRMAgent:            { label: 'Query Agent',         emoji: '🔍', color: '#30b0c7' },
};

// Map activity type to event type label
function eventType(actType: string): 'info' | 'success' | 'warning' | 'error' {
  if (actType.includes('error') || actType.includes('failed')) return 'error';
  if (actType.includes('warn')  || actType.includes('risk'))   return 'warning';
  if (actType.includes('done')  || actType.includes('success') || actType.includes('processed') || actType.includes('generated')) return 'success';
  return 'info';
}


function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60)        return `${sec}s ago`;
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
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
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline]         = useState<PipelineData | null>(null);
  const [events, setEvents]             = useState<AgentEvent[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

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

  // Poll real agent events from DB every 5s
  const fetchAgentActivity = useCallback(async () => {
    try {
      const [evtRes, statusRes] = await Promise.all([
        fetch('http://localhost:8000/api/agents/events?limit=20'),
        fetch('http://localhost:8000/api/agents/status'),
      ]);
      if (evtRes.ok) {
        const raw = await evtRes.json() as Array<{
          id: string; agent: string; type: string;
          details: Record<string, unknown>; timestamp: string;
        }>;
        const mapped: AgentEvent[] = raw.map((r) => {
          const disp = AGENT_DISPLAY[r.agent] || { label: r.agent, emoji: '🤖', color: '#8e8e93' };
          // Build human-readable description from type + details
          const detailStr = Object.entries(r.details || {})
            .filter(([k]) => !['id', 'agent'].includes(k))
            .map(([k, v]) => {
              const label = k.replace(/_/g, ' ');
              if (k === 'processing_time_ms') return `${v}ms`;
              if (k === 'status') return String(v);
              if (typeof v === 'number') return `${label}: ${v}`;
              return `${label}: ${String(v).slice(0, 40)}`;
            })
            .join(' · ');
          const eventLabel = r.type.replace(/_/g, ' ');
          return {
            id: r.id,
            agent: disp.label,
            agentColor: disp.color,
            description: detailStr ? `${eventLabel} — ${detailStr}` : eventLabel,
            type: eventType(r.type),
            timestamp: r.timestamp,
          };
        });
        if (mapped.length > 0) setEvents(mapped);
      }
      if (statusRes.ok) {
        const raw = await statusRes.json() as Array<{
          name: string; emoji: string; color: string; route: string;
          status: string; runs_today: number; last_run: string | null;
        }>;
        const statuses: AgentStatus[] = raw.map((r) => ({
          name: AGENT_DISPLAY[r.name]?.label || r.name,
          id: r.name,
          color: r.color,
          emoji: r.emoji,
          route: r.route,
          status: r.status as 'active' | 'standby',
          runsToday: r.runs_today,
          lastRun: fmtRelative(r.last_run),
        }));
        setAgentStatuses(statuses);
      }
    } catch { /* backend offline — keep showing last known state */ }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAgentActivity();
    // Poll every 5 seconds for real agent activity
    const interval = setInterval(fetchAgentActivity, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchAgentActivity]);


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
              hoverDetails={[
                { label: 'Total leads',  value: stats.leads.total.toLocaleString() },
                { label: 'Qualified',    value: stats.leads.qualified.toLocaleString() },
                { label: 'Unqualified', value: (stats.leads.total - stats.leads.qualified).toLocaleString() },
              ]}
            />
            <StatCard
              label="Pipeline Value"
              value={fmtMoney(stats.deals.pipeline_value)}
              icon={<DollarSign size={20} />}
              color="#34c759"
              subtitle={`${stats.deals.total} active deals`}
              trend={{ value: 8, direction: 'up' }}
              hoverDetails={[
                { label: 'Total deals',    value: stats.deals.total.toLocaleString() },
                { label: 'Pipeline value', value: fmtMoney(stats.deals.pipeline_value) },
                { label: 'Avg deal size',  value: stats.deals.total > 0 ? fmtMoney(Math.round(stats.deals.pipeline_value / stats.deals.total)) : '—' },
              ]}
            />
            <StatCard
              label="Active Customers"
              value={stats.customers.total.toLocaleString()}
              icon={<Heart size={20} />}
              color="#ff9500"
              trend={{ value: 3, direction: 'up' }}
              hoverDetails={[
                { label: 'Active customers', value: stats.customers.total.toLocaleString() },
                { label: 'Avg MRR/customer', value: stats.customers.total > 0 ? fmtMoney(Math.round(stats.customers.mrr / stats.customers.total)) : '—' },
              ]}
            />
            <StatCard
              label="MRR"
              value={fmtMoney(stats.customers.mrr)}
              icon={<TrendingUp size={20} />}
              color="#bf5af2"
              subtitle={`ARR: ${fmtMoney(stats.customers.arr)}`}
              trend={{ value: 5, direction: 'up' }}
              hoverDetails={[
                { label: 'MRR',   value: fmtMoney(stats.customers.mrr) },
                { label: 'ARR',   value: fmtMoney(stats.customers.arr) },
                { label: 'Avg MRR per customer', value: stats.customers.total > 0 ? fmtMoney(Math.round(stats.customers.mrr / stats.customers.total)) : '—' },
              ]}
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
            {agentStatuses.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading agent status...</p>
              </div>
            ) : agentStatuses.map((agent) => (
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
