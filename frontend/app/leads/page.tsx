'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import ChartGrid from '@/components/ChartGrid';
import { Target, TrendingUp, Users, Filter, BarChart2 } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/leads`)
      .then(res => res.json())
      .then(data => {
        setLeads(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch leads:', err);
        setIsLoading(false);
      });
  }, []);

  const filteredLeads = leads.filter((l: any) => 
    l.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.lead_status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-10 space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-sm uppercase tracking-wider">
          <Target size={16} />
          <span>Growth Engine</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Lead Management</h1>
          <div className="flex gap-3">
             <div className="relative flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)] focus-within:ring-2 ring-blue-500/50">
                <Filter size={18} className="text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  placeholder="Filter prospects..."
                  className="bg-transparent border-none outline-none text-sm text-[var(--text-primary)] w-32 focus:w-48 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <button 
                onClick={() => alert('Add Lead logic coming in next build! Database schema check complete.')}
                className="btn-primary px-6 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-medium shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
             >
                Add Lead
             </button>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Total Leads', value: leads.length, icon: Users, color: 'text-blue-500' },
          { label: 'Qualified', value: filteredLeads.filter((l: any) => l.lead_score > 70).length, icon: Target, color: 'text-green-500' },
          { label: 'Avg Fit Score', value: leads.length > 0 ? (leads.reduce((a, b:any) => a + b.lead_score, 0) / leads.length).toFixed(0) : '0', icon: TrendingUp, color: 'text-purple-500' },
        ].map((stat, i) => (
          <div key={i} className="apple-card p-6 border border-[var(--border-medium)] rounded-3xl bg-[var(--bg-surface)] hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)]">{stat.label}</p>
                <h3 className="text-3xl font-bold mt-1 text-[var(--text-primary)]">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-2xl bg-[var(--bg-glass)] ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
           <BarChart2 size={20} className="text-[var(--text-muted)]" />
           <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Lead Performance Analytics</h2>
        </div>
        <div className="apple-glass rounded-[2rem] p-4 border border-[var(--border-medium)]">
          {!isLoading && (
            <ChartGrid 
              data={leads}
              charts={[
                { 
                  type: 'pie', 
                  xAxis: 'lead_status', 
                  yAxis: 'id', 
                  title: 'Lead Status Distribution',
                  description: 'Categorizing all prospects by their current qualification journey stage.'
                },
                { 
                  type: 'bar', 
                  xAxis: 'first_name', 
                  yAxis: 'lead_score', 
                  title: 'Lead Quality Scores',
                  description: 'AI-calculated scoring metrics based on engagement and fit.'
                }
              ]}
            />
          )}
        </div>
      </section>

      {/* Table Section */}
      <section className="apple-card border border-[var(--border-medium)] rounded-3xl bg-[var(--bg-surface)] overflow-hidden">
        <div className="p-6 border-bottom border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-glass)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Prospects</h2>
        </div>
        <div className="p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
               <div className="spinner w-8 h-8"></div>
               <p className="text-[var(--text-secondary)]">Analyzing leads...</p>
            </div>
          ) : (
            <DataTable data={filteredLeads} />
          )}
        </div>
      </section>
    </div>
  );
}
