import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, User, Mail, Phone, Briefcase } from 'lucide-react';
import { CRMService } from '../api';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeads() {
      const data = await CRMService.getLeads();
      setLeads(data || []);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lead Intelligence</h1>
          <p className="text-slate-500 mt-2 text-sm">Manage and review your AI-qualified leads.</p>
        </div>
        <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)] hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.8)] hover:-translate-y-0.5">
          Import Leads
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 w-96 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search size={18} className="text-slate-400 mr-2" />
            <input 
              type="text" 
              placeholder="Search leads by name, email, or company..." 
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder-slate-400"
            />
          </div>
          <button className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-transparent">
            <Filter size={16} className="mr-2" />
            Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Lead Contact</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">AI Score</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                       <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                       Loading lead intelligence...
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="bg-slate-50 rounded-xl p-8 max-w-md mx-auto border border-slate-100 border-dashed">
                      <User size={48} className="mx-auto text-slate-300 mb-4" />
                      <p className="font-medium text-slate-900 mb-1">No leads found</p>
                      <p className="text-sm">Connect your inbox or run the setup script to populate synthetic leads via the AnalyticsAgent.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{lead.first_name} {lead.last_name}</span>
                        <span className="text-slate-500 flex items-center text-xs mt-1">
                          <Mail size={12} className="mr-1" /> {lead.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mr-3">
                          <Briefcase size={16} />
                        </div>
                        {lead.company || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                        {lead.status || 'New'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mr-3 max-w-[64px]">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${lead.ai_score || 0}%` }}></div>
                        </div>
                        <span className="font-medium text-slate-700">{lead.ai_score || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
