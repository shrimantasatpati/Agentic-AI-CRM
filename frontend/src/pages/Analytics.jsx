import React, { useEffect, useState } from 'react';
import { PieChart, BarChart, Activity } from 'lucide-react';
import { CRMService } from '../api';

export default function Analytics() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await CRMService.getDashboard();
        setDashboard(data);
      } catch (err) {
        setError('Unable to load analytics data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <PieChart className="text-indigo-500" />
        <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
      </div>
      <p className="text-slate-500">Business insights and conversion analytics from the backend.</p>

      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-3">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">Loading analytics...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 mb-3"><BarChart /> Leads</div>
            <p className="text-5xl font-bold text-slate-900">{dashboard?.leads?.total ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">Qualified: {dashboard?.leads?.qualified ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-700 mb-3"><Activity /> Deals</div>
            <p className="text-5xl font-bold text-slate-900">{dashboard?.deals?.total ?? 0}</p>
            <p className="text-sm text-slate-500 mt-1">Pipeline: ${dashboard?.deals?.pipeline_value?.toLocaleString() ?? '0'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Customer Revenue</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Total</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">{dashboard?.customers?.total ?? 0}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">MRR</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">${dashboard?.customers?.mrr?.toLocaleString() ?? 0}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-xs text-slate-500">ARR</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">${dashboard?.customers?.arr?.toLocaleString() ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
