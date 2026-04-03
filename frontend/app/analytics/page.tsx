'use client';

import { useState, useEffect } from 'react';
import ChartGrid from '@/components/ChartGrid';
import { BarChart3, TrendingUp, PieChart, Activity, Info } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'analytics report' }),
    })
      .then(res => res.json())
      .then(data => {
        setAnalyticsData(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch analytics:', err);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="p-10 space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm uppercase tracking-widest">
          <BarChart3 size={18} />
          <span>Intelligent Insights</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-5xl font-black tracking-tighter text-[var(--text-primary)]">Executive Dashboard</h1>
          <div className="flex items-center gap-4 bg-indigo-50/50 dark:bg-indigo-900/10 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
             <Activity size={20} className="text-indigo-500 animate-pulse" />
             <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Live Agent Analytics</span>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {[
          { label: 'Platform Utilization', value: '94.2%', icon: BarChart3, trend: '+4.1%', trendUp: true },
          { label: 'Conversion Efficiency', value: '28.5%', icon: TrendingUp, trend: '+2.3%', trendUp: true },
          { label: 'Customer Retention', value: '98.1%', icon: PieChart, trend: '-0.2%', trendUp: false },
          { label: 'Agent Response Time', value: '1.2s', icon: Activity, trend: '-150ms', trendUp: true },
        ].map((stat, i) => (
          <div key={i} className="apple-card p-6 border border-[var(--border-medium)] rounded-[2rem] bg-[var(--bg-surface)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">{stat.label}</p>
                <h3 className="text-3xl font-black mt-2 text-[var(--text-primary)] tracking-tight">{stat.value}</h3>
                <div className={`mt-2 flex items-center gap-1 text-[11px] font-black ${stat.trendUp ? 'text-green-500' : 'text-red-500'}`}>
                  <span>{stat.trend}</span>
                  <span>{stat.trendUp ? '↑' : '↓'}</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
                <stat.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI-Generated Visualizations */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
           <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Agentic Visualizations</h2>
           <div className="p-1.5 rounded-full bg-[var(--bg-glass)] text-[var(--text-muted)] hover:text-indigo-500 cursor-help transition-colors">
              <Info size={16} />
           </div>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-40 gap-8">
             <div className="spinner w-12 h-12 border-[var(--accent-primary)] border-t-white brightness-125"></div>
             <p className="text-xl font-bold text-[var(--text-muted)] tracking-widest uppercase">Synthesizing Neural Data...</p>
          </div>
        ) : (
          <div className="apple-card border border-[var(--border-medium)] rounded-[2.5rem] bg-[var(--bg-surface)] p-2 shadow-2xl">
            <ChartGrid 
               charts={analyticsData?.dashboard_config?.charts || []} 
               data={analyticsData?.data || []} 
            />
          </div>
        )}
      </section>
      
      <footer className="flex justify-center pb-10">
         <div className="px-6 py-3 rounded-full bg-[var(--bg-glass)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-muted)] tracking-wide">
            Powered by Multi-Agent Agentic Workflow v1.0.4
         </div>
      </footer>
    </div>
  );
}
