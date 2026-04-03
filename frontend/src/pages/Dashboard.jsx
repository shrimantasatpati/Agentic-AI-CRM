import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Activity, Users, DollarSign, Target, TrendingUp, Database, Sparkles } from 'lucide-react';
import { CRMService } from '../api';

function MetricCard({ title, primary, secondary, percent, trend, icon: Icon, colorClass = 'from-blue-500' }) {
  return (
    <article className={`bg-gradient-to-br ${colorClass} to-slate-50/90 shadow-sm rounded-2xl border border-slate-200 p-5`}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</div>
        <div className="text-xs font-semibold text-slate-500">{trend}</div>
      </div>
      <div className="flex items-center gap-2 text-3xl font-extrabold text-slate-900 mb-1">
        {primary}
        <Icon size={22} className="text-slate-500" />
      </div>
      <p className="text-sm text-slate-600">{secondary} {percent !== null && percent !== undefined ? <span className="font-semibold text-emerald-600">{percent}%</span> : null}</p>
    </article>
  );
}

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [db, p] = await Promise.all([CRMService.getDashboard(), CRMService.getPipeline()]);
        setDashboard(db);
        setPipeline(p);
      } catch (err) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const summary = dashboard || {
    leads: { total: 0, qualified: 0 },
    deals: { total: 0, pipeline_value: 0 },
    customers: { total: 0, mrr: 0, arr: 0 },
  };

  const totalPipelineDeals = pipeline ? Object.values(pipeline).reduce((sum, entry) => sum + (entry.count || 0), 0) : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">An overview of leads, deals, and analytics from the backend API.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600">
          <Sparkles size={14} className="text-indigo-500" /> Live view
        </div>
      </header>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-3 text-slate-500">Loading dashboard data...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="Total Pipeline"
              primary={`$${summary.deals.pipeline_value.toLocaleString()}`}
              secondary={`${summary.deals.total} deals`}
              percent={summary.deals.total ? Number(((summary.deals.pipeline_value / summary.deals.total) * 100).toFixed(0)) : 0}
              trend="Up 6%"
              icon={DollarSign}
              colorClass="from-green-500"
            />
            <MetricCard
              title="Active Deals"
              primary={summary.deals.total}
              secondary="Open deals"
              percent={totalPipelineDeals ? Number(((summary.deals.total / totalPipelineDeals) * 100).toFixed(0)) : 0}
              trend="Stable"
              icon={Target}
              colorClass="from-blue-500"
            />
            <MetricCard
              title="Leads"
              primary={summary.leads.total}
              secondary={`${summary.leads.qualified} qualified`}
              percent={summary.leads.total ? Number(((summary.leads.qualified / summary.leads.total) * 100).toFixed(0)) : 0}
              trend="+12%"
              icon={Users}
              colorClass="from-purple-500"
            />
            <MetricCard
              title="MRR"
              primary={`$${summary.customers.mrr.toLocaleString()}`}
              secondary={`ARR $${summary.customers.arr.toLocaleString()}`}
              trend="+3%"
              icon={TrendingUp}
              colorClass="from-indigo-500"
            />
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Pipeline Breakdown</h2>
              <div className="space-y-2">
                {pipeline ? Object.entries(pipeline).map(([stage, data]) => (
                  <div key={stage} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-sm capitalize text-slate-700">{stage.replace('_', ' ')}</div>
                    <div className="text-sm font-semibold text-slate-900">{data.count} deals  ${Number(data.value).toLocaleString()}</div>
                  </div>
                )) : <p className="text-sm text-slate-500">No pipeline data available.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">System Health</h2>
              <ul className="space-y-3 text-sm text-slate-700">
                <li className="flex justify-between"><span>API Ping</span><span className="font-semibold text-emerald-600">OK</span></li>
                <li className="flex justify-between"><span>DB</span><span className="font-semibold text-emerald-600">SQLite</span></li>
                <li className="flex justify-between"><span>Orchestrator</span><span className="font-semibold text-emerald-600">Active</span></li>
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
