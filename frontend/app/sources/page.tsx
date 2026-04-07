'use client';

import { useState } from 'react';
import { 
  Cloud, Database, FileSpreadsheet, Zap, 
  CheckCircle2, AlertCircle, Loader, ArrowRight 
} from 'lucide-react';

export default function SourceSystemsPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const runSalesforceSync = async () => {
    setLoading(true);
    setStatus(null);
    try {
      // Mock Salesforce-style payload
      const mockSFData = [
        { Id: 'SF-001', AccountName: 'Tesla Inc', Website: 'tesla.com', Industry: 'Automotive', BillingCity: 'Austin', FirstName: 'Elon', LastName: 'Musk', Title: 'Technoking', Amount: 500000 },
        { Id: 'SF-002', AccountName: 'SpaceX', Website: 'spacex.com', Industry: 'Aerospace', BillingCity: 'Starbase', FirstName: 'Gwynne', LastName: 'Shotwell', Title: 'President', Amount: 1200000 }
      ];

      const res = await fetch('http://localhost:8000/api/sources/import/salesforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockSFData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sync failed');
      setStatus({ type: 'success', message: `Successfully imported ${data.imported} records from Salesforce Simulation.` });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/api/sources/import/excel', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setStatus({ type: 'success', message: `Data Ingestion Complete: ${data.rows_processed} rows processed from ${file.name}.` });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const runFullSeed = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch('http://localhost:8000/api/sources/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Seeding failed');
      setStatus({ type: 'success', message: data.message });
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="section-title flex items-center gap-2" style={{ fontSize: 24 }}>
          <Cloud className="text-[var(--blue-primary)]" /> Source Systems
        </h1>
        <p className="section-subtitle">Connect your data sources to populate the AI CRM with production-grade data.</p>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-fade-in ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-500' : 'bg-red-500/10 border border-red-500/20 text-red-500'}`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Salesforce Card */}
        <div className="apple-card group relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl" style={{ border: '1px solid #1798c130', background: '#1798c110' }}>
              <Zap size={24} color="#1798c1" />
            </div>
            <span className="badge badge-blue">Enterprise</span>
          </div>
          <h3 className="text-lg font-bold mb-2">Salesforce Sync</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Import Accounts, Contacts, and Opportunities directly from your Salesforce instance.
          </p>
          <button 
            onClick={runSalesforceSync}
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
            style={{ background: '#1798c1' }}
          >
            {loading ? <Loader size={16} className="animate-spin" /> : 'Run Sync Simulation'}
          </button>
        </div>

        {/* Excel/CSV Card */}
        <div className="apple-card group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl" style={{ border: '1px solid #34c75930', background: '#34c75910' }}>
              <FileSpreadsheet size={24} color="#34c759" />
            </div>
          </div>
          <h3 className="text-lg font-bold mb-2">Excel / CSV Import</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
            Bulk upload CRM data from structured spreadsheets using our intelligent mapping.
          </p>
          <label className="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02]" style={{ background: '#34c759' }}>
            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={loading} />
            {loading ? <Loader size={16} className="animate-spin" /> : 'Choose File'}
          </label>
        </div>

        {/* REST API Card */}
       <div className="apple-card opacity-80">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl" style={{ border: '1px solid #5e5ce630', background: '#5e5ce610' }}>
              <Database size={24} color="#5e5ce6" />
            </div>
            <span className="badge badge-gray">Internal</span>
          </div>
          <h3 className="text-lg font-bold mb-2">Custom REST API</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            Programmatically push data into the AI CRM via secure authenticated endpoints.
          </p>
          <div className="bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--border-primary)]">
            <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Contact your administrator to obtain API credentials and endpoint documentation.</p>
          </div>
        </div>
      </div>

      {/* Manual Data Seeding (No Emails) */}
      <div className="apple-card border-none bg-gradient-to-br from-[var(--blue-primary-10)] to-transparent">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">Populate with Synthetic Production Data</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Automatically generate a full set of realistic Companies, Deals, and Customers to test your agent workflows.
            </p>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={runFullSeed}
               disabled={loading}
               className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[var(--text-primary)] text-[var(--bg-primary)] transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
             >
                {loading ? <Loader size={18} className="animate-spin" /> : <>Generate Full Dataset <ArrowRight size={18} /></>}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
