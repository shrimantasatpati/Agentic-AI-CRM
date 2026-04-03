'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/DataTable';
import ChartGrid from '@/components/ChartGrid';
import { Target, TrendingUp, Users, Filter, BarChart2, Plus, X, Loader2 } from 'lucide-react';
import WorkflowSteps from '@/components/WorkflowSteps';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLead, setNewLead] = useState({ first_name: '', last_name: '', email: '', job_title: '' });
  const [workflowSteps, setWorkflowSteps] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLeads = () => {
    setIsLoading(true);
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
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setWorkflowSteps([]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/leads/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead)
      });
      const data = await res.json();
      
      if (data.workflow_steps) {
        setWorkflowSteps(data.workflow_steps);
      }
      
      // Wait for process to simulate completion
      setTimeout(() => {
        setIsSubmitting(false);
        fetchLeads();
        setTimeout(() => {
           setIsModalOpen(false);
           setNewLead({ first_name: '', last_name: '', email: '', job_title: '' });
           setWorkflowSteps([]);
        }, 3000);
      }, 2000);

    } catch (err) {
      console.error('Lead workflow failed:', err);
      setIsSubmitting(false);
    }
  };

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
                onClick={() => setIsModalOpen(true)}
                className="btn-primary px-6 py-2 rounded-xl bg-[var(--accent-primary)] text-white font-medium shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center gap-2"
              >
                <Plus size={18} />
                Add Lead
              </button>
          </div>
        </div>
      </header>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-[var(--bg-surface)] w-full max-w-lg rounded-[2.5rem] border border-[var(--border-medium)] shadow-2xl overflow-hidden flex flex-col p-8 gap-6 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                       <Users size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)]">New Prospect Intent</h3>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <X size={20} className="text-[var(--text-muted)]" />
                 </button>
              </div>

              {!isSubmitting && workflowSteps.length === 0 ? (
                <form onSubmit={handleAddLead} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:text-blue-500 transition-colors">
                       <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">First Name</label>
                       <input 
                         required
                         type="text" 
                         placeholder="e.g. Jane"
                         className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-subtle)] focus:border-blue-500 outline-none transition-all text-[var(--text-primary)]"
                         value={newLead.first_name}
                         onChange={e => setNewLead({...newLead, first_name: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1.5 focus-within:text-blue-500 transition-colors">
                       <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">Last Name</label>
                       <input 
                         required
                         type="text" 
                         placeholder="e.g. Smith"
                         className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-subtle)] focus:border-blue-500 outline-none transition-all text-[var(--text-primary)]"
                         value={newLead.last_name}
                         onChange={e => setNewLead({...newLead, last_name: e.target.value})}
                       />
                    </div>
                  </div>
                  <div className="space-y-1.5 focus-within:text-blue-500 transition-colors">
                     <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">Corporate Email</label>
                     <input 
                       required
                       type="email" 
                       placeholder="jane.smith@enterprise.com"
                       className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-subtle)] focus:border-blue-500 outline-none transition-all text-[var(--text-primary)]"
                       value={newLead.email}
                       onChange={e => setNewLead({...newLead, email: e.target.value})}
                     />
                  </div>
                  <div className="space-y-1.5 focus-within:text-blue-500 transition-colors">
                     <label className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">Job Title</label>
                     <input 
                       required
                       type="text" 
                       placeholder="e.g. VP of Sales"
                       className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-glass)] border border-[var(--border-subtle)] focus:border-blue-500 outline-none transition-all text-[var(--text-primary)]"
                       value={newLead.job_title}
                       onChange={e => setNewLead({...newLead, job_title: e.target.value})}
                     />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 mt-4 bg-[var(--accent-primary)] text-white font-bold rounded-2xl shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                  >
                    Trigger Lead Agents
                  </button>
                </form>
              ) : (
                <div className="py-6">
                   <WorkflowSteps steps={workflowSteps.length > 0 ? workflowSteps : ['Initializing Agentic Pipeline...', 'Connecting to CRM database...', 'Spinning up Lead Agents...']} />
                   {workflowSteps.length === 0 && (
                      <div className="flex items-center justify-center mt-6">
                         <Loader2 className="animate-spin text-blue-500" size={24} />
                      </div>
                   )}
                </div>
              )}
           </div>
        </div>
      )}

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
