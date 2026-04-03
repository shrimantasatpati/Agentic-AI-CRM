import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Users, DollarSign, Target } from 'lucide-react';
import { CRMService } from '../api';

function MetricCard({ title, value, change, isPositive, icon: Icon }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col transition-all duration-300 hover:shadow-md hover:border-slate-200">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <Icon size={24} />
        </div>
        <div className={`flex items-center text-sm font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
          {change}%
        </div>
      </div>
      <h3 className="text-slate-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const dashboardData = await CRMService.getDashboardData();
      setData(dashboardData?.insights || []);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h1>
        <p className="text-slate-500 mt-2 text-sm">Welcome back. Here's what's happening with your pipeline today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Pipeline" value="$2.4M" change={12.5} isPositive={true} icon={DollarSign} />
        <MetricCard title="Active Deals" value="48" change={8.2} isPositive={true} icon={Target} />
        <MetricCard title="New Leads" value="124" change={3.1} isPositive={false} icon={Users} />
        <MetricCard title="Win Rate" value="64%" change={5.4} isPositive={true} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">AI Insights</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {data && data.length > 0 ? data.map((insight, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50/50 hover:border-blue-100 transition-colors cursor-pointer group">
                  <div className="flex items-start">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 mr-4 group-hover:scale-150 transition-transform"></div>
                    <p className="text-slate-700 text-sm leading-relaxed">{insight.text}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <p>AI Insights are currently disabled or unavailable.</p>
                  <p className="mt-1 opacity-70">Check if the backend orchestrator is running and Gemini API is connected.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-[64px] group-hover:bg-white/10 transition-colors"></div>
          <h2 className="text-lg font-semibold mb-6 flex items-center">
            <Activity className="mr-2 text-blue-400" size={20} />
            System Health
          </h2>
          <div className="space-y-6 relative z-10">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Agents Active</span>
                <span className="font-semibold">6 / 6</span>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="w-full h-full bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">Database connection</span>
                <span className="font-semibold text-emerald-400">Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
