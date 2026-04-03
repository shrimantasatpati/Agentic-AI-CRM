import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreHorizontal, User, Mail, Phone, Briefcase, PlusCircle } from 'lucide-react';
import { CRMService } from '../api';

const initialForm = {
  email: '',
  first_name: '',
  last_name: '',
  company_name: '',
  job_title: '',
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await CRMService.getLeads();
      setLeads(data);
    } catch (err) {
      setError('Unable to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter((lead) => {
    const term = query.toLowerCase();
    return (
      lead.email.toLowerCase().includes(term) ||
      `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(term) ||
      lead.lead_status.toLowerCase().includes(term)
    );
  });

  const handleChange = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
  };

  const submitLead = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.email) {
      setError('Email is required.');
      return;
    }

    setSubmitting(true);
    try {
      await CRMService.createLead({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        company_name: form.company_name,
        job_title: form.job_title,
      });
      setForm(initialForm);
      await fetchLeads();
    } catch (err) {
      setError('Failed to create lead.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLead = async (id) => {
    setError('');
    try {
      await CRMService.deleteLead(id);
      await fetchLeads();
    } catch {
      setError('Failed to delete lead.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lead Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">Track and manage AI-qualified prospects from the backend API.</p>
        </div>

        <form onSubmit={submitLead} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input value={form.first_name} onChange={handleChange('first_name')} placeholder="First Name" className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
            <input value={form.last_name} onChange={handleChange('last_name')} placeholder="Last Name" className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
            <input value={form.email} onChange={handleChange('email')} placeholder="Email*" className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" type="email" required />
            <input value={form.company_name} onChange={handleChange('company_name')} placeholder="Company" className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
            <input value={form.job_title} onChange={handleChange('job_title')} placeholder="Job title" className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <button type="submit" disabled={submitting} className="flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:bg-slate-300">
            <PlusCircle size={16} /> {submitting ? 'Adding...' : 'Add Lead'}
          </button>
        </form>
      </div>

      {error && <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 p-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-full sm:max-w-xs">
            <Search size={16} className="text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads"
              className="w-full bg-transparent outline-none text-sm text-slate-600"
            />
          </div>
          <button className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <Filter size={16} /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">Loading leads...</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">No matching leads found.</td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{lead.first_name} {lead.last_name}</td>
                    <td className="px-4 py-3">{lead.email}</td>
                    <td className="px-4 py-3">{lead.company_name || '—'}</td>
                    <td className="px-4 py-3">{lead.lead_score ?? '-'}</td>
                    <td className="px-4 py-3 capitalize">{lead.lead_status || 'new'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="px-2 py-1 text-xs text-rose-600 bg-rose-50 rounded-md hover:bg-rose-100"
                      >
                        Delete
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

