import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity, Users, DollarSign, Target, TrendingUp } from 'lucide-react';
import { CRMService } from '../api';

function MetricCard({ title, value, change, isPositive, icon: Icon, prefix = '' }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col transition-all duration-300 hover:shadow-lg hover:border-slate-200 hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${
          title === 'Total Pipeline' ? 'bg-green-50 text-green-600' :
          title === 'Active Deals' ? 'bg-blue-50 text-blue-600' :
          title === 'New Leads' ? 'bg-purple-50 text-purple-600' :
          'bg-orange-50 text-orange-600'
        }`}>
          <Icon size={24} />
        </div>
        <div className={`flex items-center text-sm font-semibold px-3 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isPositive ? <ArrowUpRight size={16} className="mr-1" /> : <ArrowDownRight size={16} className="mr-1" />}
          {change}%
        </div>
      </div>
      <h3 className="text-slate-500 text-sm font-medium mb-2">{title}</h3>
      <p className="text-3xl font-bold text-slate-900 tracking-tight">{prefix}{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const dashboardData = await CRMService.getDashboardData();
        setData(dashboardData?.insights || []);
      } catch (error) {
        console.log('Dashboard data not available yet');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-600 mt-2 text-base">Welcome back. Here's what's happening with your pipeline today.</p>
        </div>
        <div className="flex items-center text-sm text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200">
          <Activity size={16} className="mr-2 text-blue-500" />
          Live Dashboard
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Pipeline" value="2.4M" change={12.5} isPositive={true} icon={DollarSign} prefix="$" />
        <MetricCard title="Active Deals" value="48" change={8.2} isPositive={true} icon={Target} />
        <MetricCard title="New Leads" value="124" change={3.1} isPositive={false} icon={Users} />
        <MetricCard title="Win Rate" value="64%" change={5.4} isPositive={true} icon={TrendingUp} />
      </div>

      {/* AI Insights & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">AI Insights</h2>
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 text-sm">Loading AI insights...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {data && data.length > 0 ? data.map((insight, i) => (
                <div key={i} className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 to-transparent border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                    <p className="text-slate-700 text-sm leading-relaxed group-hover:text-slate-900 transition-colors">{insight.text || insight}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  <Activity className="mx-auto text-slate-300 mb-3" size={32} />
                  <p className="font-medium text-slate-600 mb-1">No AI Insights Available</p>
                  <p className="text-sm text-slate-500">Make sure Gemini API is configured in .env</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Health Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-[64px] group-hover:bg-white/10 transition-colors duration-300"></div>
          <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none"></div>
          
          <h2 className="text-lg font-bold mb-8 flex items-center relative z-10">
            <div className="w-3 h-3 rounded-full bg-emerald-400 mr-3 animate-pulse"></div>
            System Health
          </h2>
          
          <div className="space-y-8 relative z-10">
            {/* Agents Status */}
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-400 font-medium">AI Agents</span>
                <span className="font-semibold text-emerald-300">6 / 6</span>
              </div>
              <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div className="w-full h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.4)]"></div>
              </div>
            </div>

            {/* Database Status */}
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-400 font-medium">Database</span>
                <span className="font-semibold text-emerald-300">Stable</span>
              </div>
              <div className="flex items-center text-sm text-slate-300">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></div>
                SQLite Connected
              </div>
            </div>

            {/* API Status */}
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-400 font-medium">API Server</span>
                <span className="font-semibold text-emerald-300">Online</span>
              </div>
              <div className="text-xs text-slate-400">
                Running on port 8000
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Recommended Actions</h2>
        <div className="space-y-3">
          {[
            'Review 5 leads with score > 80 - ready for outreach',
            'Follow up on 3 stalled deals in negotiation stage',
            'Schedule demos with 2 qualified leads from this week',
            'Update customer health scores for 12 active accounts'
          ].map((action, i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors border border-slate-100 hover:border-blue-200 group cursor-pointer flex items-center justify-between">
              <p className="text-slate-700 text-sm group-hover:text-slate-900">{action}</p>
              <ArrowUpRight size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
