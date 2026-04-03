'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import ChartGrid from '@/components/ChartGrid';
import { Users, Heart, AlertCircle, Search, Filter, ShieldCheck, Activity } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/customers`)
      .then(res => res.json())
      .then(data => {
        setCustomers(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch customers:', err);
        setIsLoading(false);
      });
  }, []);

  const atRisk = customers.filter((c: any) => c.health_score < 50).length;
  const avgHealth = customers.length > 0 
    ? (customers.reduce((acc: number, c: any) => acc + (c.health_score || 0), 0) / customers.length).toFixed(1)
    : '0';

  return (
    <div className="p-10 space-y-8 animate-in zoom-in duration-700">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-pink-500 font-semibold text-sm uppercase tracking-wider">
          <Heart size={16} />
          <span>Success Intelligence</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">Customer Portfolio</h1>
          <div className="flex gap-3">
             <button className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)]">
                <ShieldCheck size={18} className="text-green-500" />
                <span>Health Audit</span>
             </button>
             <button className="btn-primary px-6 py-2 rounded-xl bg-pink-600 text-white font-medium shadow-lg shadow-pink-500/30">
                New Account
             </button>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Partners', value: customers.length, icon: Users, color: 'text-blue-500' },
          { label: 'Avg Health Score', value: `${avgHealth}/100`, icon: Heart, color: 'text-pink-500' },
          { label: 'At Risk Accounts', value: atRisk, icon: AlertCircle, color: 'text-orange-500' },
        ].map((stat, i) => (
          <div key={i} className="apple-card p-8 border border-[var(--border-medium)] rounded-[2rem] bg-[var(--bg-surface)] shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl bg-[var(--bg-glass)] ${stat.color}`}>
                <stat.icon size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-tight">{stat.label}</p>
                <h3 className="text-4xl font-black mt-1 text-[var(--text-primary)] tracking-tighter">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Success Analytics */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
           <Activity size={20} className="text-[var(--text-muted)]" />
           <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Relationship Health Metrics</h2>
        </div>
        <div className="apple-glass rounded-[2rem] p-6 border border-[var(--border-medium)]">
          {!isLoading && (
            <ChartGrid 
              data={customers}
              charts={[
                { 
                  type: 'bar', 
                  xAxis: 'name', 
                  yAxis: 'health_score', 
                  title: 'Customer Health Index',
                  description: 'Evaluating individual account stability and usage depth.'
                },
                { 
                  type: 'pie', 
                  xAxis: 'churn_risk', 
                  yAxis: 'id', 
                  title: 'Churn Risk Segmentation',
                  description: 'AI-driven classification of account retention confidence.'
                }
              ]}
            />
          )}
        </div>
      </section>

      {/* Main Table */}
      <section className="apple-card border border-[var(--border-medium)] rounded-[2rem] bg-[var(--bg-surface)] overflow-hidden">
        <div className="p-8 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Relationship Index</h2>
              <span className="badge badge-gray px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-gray-100/50">Verified Records</span>
           </div>
           <div className="flex gap-4">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                 <input type="text" placeholder="Search partners..." className="pl-10 pr-4 py-2 text-sm rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)]" />
              </div>
              <button className="p-2 rounded-xl hover:bg-[var(--bg-glass)] border border-[var(--border-medium)]"><Filter size={18} /></button>
           </div>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-32 gap-6">
               <div className="spinner w-10 h-10 border-pink-500"></div>
               <p className="animate-pulse text-lg text-[var(--text-secondary)] font-bold">Mapping Success Metrics...</p>
            </div>
          ) : (
            <DataTable data={customers} />
          )}
        </div>
      </section>
    </div>
  );
}
