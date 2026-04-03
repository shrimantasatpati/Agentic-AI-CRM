import React, { useEffect, useState } from 'react';
import { Briefcase, CalendarDays, DollarSign } from 'lucide-react';
import { CRMService } from '../api';

export default function Deals() {
  const [pipeline, setPipeline] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await CRMService.getPipeline();
        setPipeline(data);
      } catch {
        setError('Unable to load deal pipeline metrics.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Briefcase className="text-blue-600" />
        <h1 className="text-3xl font-bold text-slate-900">Deals</h1>
      </div>
      <p className="text-slate-500">Track current deal stages and pipeline coverage from backend data.</p>

      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-3">{error}</div>}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">Loading deals...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pipeline ? Object.entries(pipeline).map(([stage, metrics]) => (
            <article key={stage} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <h2 className="text-base font-semibold text-slate-800 capitalize">{stage.replace('_', ' ')}</h2>
                <DollarSign className="text-emerald-500" />
              </div>
              <div className="mt-3 text-lg font-bold text-slate-900">{metrics.count} deals</div>
              <p className="text-sm text-slate-500 mt-1">${Number(metrics.value).toLocaleString()}</p>
              <div className="mt-3 flex items-center text-xs text-slate-500">
                <CalendarDays className="mr-1" size={14} />
                Stage contributions to pipeline
              </div>
            </article>
          )) : <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-500">No data</div>}
        </div>
      )}
    </div>
  );
}
