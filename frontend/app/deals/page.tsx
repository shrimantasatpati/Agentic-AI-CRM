'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import ChartGrid from '@/components/ChartGrid';
import { Briefcase, TrendingUp, DollarSign, Filter, Search, PieChart } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/deals`)
      .then(res => res.json())
      .then(data => {
        setDeals(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch deals:', err);
        setIsLoading(false);
      });
  }, []);

  const filteredDeads = deals.filter((d: any) => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.stage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = deals.reduce((acc: number, d: any) => acc + (d.value || 0), 0);
  const wonDeals = deals.filter((d: any) => d.stage === 'won');
  const winRate = deals.length > 0 ? (wonDeals.length / deals.length * 100).toFixed(1) : '0.0';

  return (
    <div className="p-10 space-y-8 animate-in slide-in-from-bottom duration-700">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-blue-500 font-semibold text-sm uppercase tracking-wider">
          <Briefcase size={16} />
          <span>Revenue Engine</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Sales Pipeline</h1>
          <div className="flex gap-3">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input 
                  type="text" 
                  placeholder="Find a deal..." 
                  className="pl-10 pr-4 py-2 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)] focus:ring-2 focus:ring-blue-500 outline-none transition-all w-48 focus:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <button 
                onClick={() => alert('New Deal workflow triggered. Syncing with Sales Agent...')}
                className="btn-primary px-6 py-2 rounded-xl bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all"
             >
                New Deal
             </button>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Pipeline Value', value: `$${(totalValue / 1000).toFixed(1)}k`, icon: DollarSign, color: 'text-green-500' },
          { label: 'Active Deals', value: deals.length, icon: Briefcase, color: 'text-blue-500' },
          { label: 'Win Rate', value: `${winRate}%`, icon: TrendingUp, color: 'text-purple-500' },
          { label: 'Forecast', value: '+$14k', icon: TrendingUp, color: 'text-orange-500' },
        ].map((stat, i) => (
          <div key={i} className="apple-card p-6 border border-[var(--border-medium)] rounded-3xl bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">{stat.label}</p>
                <h3 className="text-2xl font-bold mt-1 text-[var(--text-primary)]">{stat.value}</h3>
              </div>
              <div className={`p-4 rounded-full bg-[var(--bg-glass)] ${stat.color}`}>
                <stat.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Analytics */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
           <PieChart size={20} className="text-[var(--text-muted)]" />
           <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Revenue Pipeline Analysis</h2>
        </div>
        <div className="apple-glass rounded-3xl p-6 border border-[var(--border-medium)]">
          {!isLoading && (
            <ChartGrid 
              data={filteredDeads}
              charts={[
                { 
                  type: 'pie', 
                  xAxis: 'stage', 
                  yAxis: 'value', 
                  title: 'Pipeline by Stage',
                  description: 'Total monetary value distributed across sales stages.'
                },
                { 
                  type: 'bar', 
                  xAxis: 'name', 
                  yAxis: 'value', 
                  title: 'Top Strategic Deals',
                  description: 'Evaluating individual high-impact deals currently in negotiation.'
                }
              ]}
            />
          )}
        </div>
      </section>

      {/* Main Table Container */}
      <section className="apple-card border border-[var(--border-medium)] rounded-3xl bg-[var(--bg-surface)] overflow-hidden shadow-2xl shadow-black/5">
        <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] flex items-center justify-between">
           <h2 className="text-xl font-bold text-[var(--text-primary)]">Open Pipeline Items</h2>
           <Filter className="text-[var(--text-muted)] cursor-pointer" size={20} />
        </div>
        <div className="p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-32 gap-6">
               <div className="spinner w-10 h-10 border-blue-500"></div>
               <p className="text-lg text-[var(--text-secondary)] font-medium">Syncing with Sales Agent...</p>
            </div>
          ) : (
            <DataTable data={filteredDeads} />
          )}
        </div>
      </section>
    </div>
  );
}
