'use client';

import { useState, useEffect } from 'react';
import {
  Cloud, Database, FileSpreadsheet, Zap,
  CheckCircle2, AlertCircle, Loader, ArrowRight, Link2, Key, Globe, Play
} from 'lucide-react';

interface DbSnapshot {
  total_contacts: number;
  total_companies: number;
  total_deals: number;
  sample: Array<{ name: string; email: string; company: string }>;
}

export default function SourceSystemsPage() {
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dbSnapshot, setDbSnapshot] = useState<DbSnapshot | null>(null);

  // REST API card state
  const [apiEndpoint, setApiEndpoint] = useState('https://api.yourcrm.com/v1/contacts');
  const [apiKey, setApiKey]           = useState('');
  const [apiMethod, setApiMethod]     = useState<'GET' | 'POST'>('GET');
  const [apiBody, setApiBody]         = useState('{\n  "limit": 100\n}');
  const [apiResult, setApiResult]     = useState<string | null>(null);
  const [apiLoading, setApiLoading]   = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(true);

  // ── Fetch DB snapshot after import ────────────────────────────────────────
  const fetchSnapshot = async () => {
    try {
      const lRes = await fetch('http://localhost:8000/api/leads/?limit=100');
      const leads = lRes.ok ? await lRes.json() : [];
      const sample = leads.slice(0, 3).map((l: any) => ({
        name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.email,
        email: l.email || '—',
        company: l.company_name || l.lead_status || 'Individual',
      }));
      setDbSnapshot({
        total_contacts: leads.length,
        total_companies: leads.filter((l: any) => l.company_name).length,
        total_deals: 0,
        sample,
      });
    } catch { /* ignore, snapshot is optional */ }
  };

  // Fetch on mount
  useEffect(() => { fetchSnapshot(); }, []);

  const runSalesforceSync = async () => {
    setLoading(true); setStatus(null); setDbSnapshot(null);
    try {
      const mockSFData = [
        { Id: 'SF-001', AccountName: 'Tesla Inc', Website: 'tesla.com', Industry: 'Automotive', BillingCity: 'Austin', FirstName: 'Elon', LastName: 'Musk', Title: 'Technoking', Amount: 500000 },
        { Id: 'SF-002', AccountName: 'SpaceX', Website: 'spacex.com', Industry: 'Aerospace', BillingCity: 'Starbase', FirstName: 'Gwynne', LastName: 'Shotwell', Title: 'President', Amount: 1200000 },
      ];
      const res  = await fetch('http://localhost:8000/api/sources/import/salesforce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mockSFData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sync failed');
      setStatus({ type: 'success', message: `✓ Imported ${data.imported} records from Salesforce Simulation.` });
      await fetchSnapshot();
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally { setLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setStatus(null); setDbSnapshot(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res  = await fetch('http://localhost:8000/api/sources/import/excel', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setStatus({ type: 'success', message: `✓ ${data.rows_processed} rows imported from ${file.name}.` });
      await fetchSnapshot();
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally { setLoading(false); }
  };

  const runFullSeed = async () => {
    setLoading(true); setStatus(null); setDbSnapshot(null);
    try {
      const res  = await fetch('http://localhost:8000/api/sources/seed', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Seeding failed');
      setStatus({ type: 'success', message: data.message });
      await fetchSnapshot();
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as any).detail || (e as Error).message;
      setStatus({ type: 'error', message: String(msg) });
    } finally { setLoading(false); }
  };

  const testApiConnection = async () => {
    if (!apiEndpoint.trim()) return;
    setApiLoading(true); setApiResult(null); setStatus(null);
    try {
      const payload = {
        endpoint: apiEndpoint,
        method: apiMethod,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        body: apiMethod === 'POST' ? apiBody : null,
      };
      
      const res = await fetch('http://localhost:8000/api/sources/import/rest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'REST import failed');
      
      const display = JSON.stringify(data.data, null, 2);
      setApiResult(`HTTP ${data.http_status} · ${data.imported} records imported\n\n${display.slice(0, 1000)}${display.length > 1000 ? '\n…(truncated)' : ''}`);
      
      if (data.imported > 0) {
        setStatus({ type: 'success', message: `✓ Successfully imported ${data.imported} records from REST API.` });
        await fetchSnapshot();
      }
    } catch (e) {
      setApiResult(`Error: ${(e as Error).message}`);
    } finally { setApiLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="section-title flex items-center gap-2" style={{ fontSize: 24 }}>
          <Cloud className="text-[var(--blue-primary)]" /> Source Systems
        </h1>
        <p className="section-subtitle">Connect your data sources to populate the AI CRM with production-grade data.</p>
      </div>

      {/* Status banner */}
      {status && (
        <div className={`p-4 rounded-xl flex items-start gap-3 animate-fade-in ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-500' : 'bg-red-500/10 border border-red-500/20 text-red-500'}`}>
          {status.type === 'success' ? <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {/* DB Snapshot — collapsible, shown after any successful import */}
      {dbSnapshot && (
        <div className="apple-card animate-fade-in-up" style={{ border: '1px solid rgba(52,199,89,0.3)' }}>
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setSnapshotOpen(o => !o)}
          >
            <Database size={14} color="#34c759" />
            <p className="text-xs font-semibold uppercase tracking-wide flex-1" style={{ color: '#34c759', letterSpacing: '0.06em' }}>
              Live Database Snapshot
            </p>
            <span className="badge badge-green" style={{ fontSize: 9 }}>Updated just now</span>
            <span className="text-[10px] text-[var(--text-tertiary)] ml-2">{snapshotOpen ? '▲' : '▼'}</span>
          </button>
          {snapshotOpen && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4 mt-3">
                {[
                  { label: 'Contacts', value: dbSnapshot.total_contacts },
                  { label: 'With Company', value: dbSnapshot.total_companies },
                  { label: 'Imported', value: dbSnapshot.sample.length },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-xl text-center" style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.15)' }}>
                    <p className="text-xl font-bold" style={{ color: '#34c759' }}>{value}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {dbSnapshot.sample.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Sample Records</p>
                  <div className="space-y-1.5">
                    {dbSnapshot.sample.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'rgba(52,199,89,0.15)', color: '#34c759' }}>{s.name[0]?.toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{s.email}</p>
                        </div>
                        <span className="badge badge-gray" style={{ fontSize: 9 }}>{s.company}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Salesforce */}
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
            {loading ? <Loader size={16} className="animate-spin" /> : <Play size={14} />}
            {loading ? 'Syncing…' : 'Run Sync Simulation'}
          </button>
        </div>

        {/* Excel/CSV */}
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
            {loading ? <Loader size={16} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {loading ? 'Uploading…' : 'Choose CSV File'}
          </label>
        </div>

        {/* Custom REST API */}
        <div className="apple-card">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl" style={{ border: '1px solid #5e5ce630', background: '#5e5ce610' }}>
              <Globe size={24} color="#5e5ce6" />
            </div>
            <span className="badge badge-gray">REST API</span>
          </div>
          <h3 className="text-lg font-bold mb-3">Custom REST API</h3>

          {/* Method + Endpoint */}
          <div className="flex gap-2 mb-2">
            <select
              value={apiMethod}
              onChange={e => setApiMethod(e.target.value as 'GET' | 'POST')}
              className="form-input"
              style={{ width: 72, padding: '6px 8px', fontSize: 12 }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <input
              type="url"
              className="form-input flex-1"
              style={{ fontSize: 12, padding: '6px 10px' }}
              placeholder="https://api.example.com/contacts"
              value={apiEndpoint}
              onChange={e => setApiEndpoint(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="flex items-center gap-2 mb-2">
            <Key size={12} color="var(--text-tertiary)" className="flex-shrink-0" />
            <input
              type="password"
              className="form-input flex-1"
              style={{ fontSize: 12, padding: '6px 10px' }}
              placeholder="Bearer token / API key (optional)"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>

          {/* Body (POST only) */}
          {apiMethod === 'POST' && (
            <textarea
              className="form-input form-textarea w-full mb-2"
              rows={3}
              style={{ fontSize: 11, fontFamily: 'monospace', padding: '6px 10px' }}
              placeholder="Request body (JSON)"
              value={apiBody}
              onChange={e => setApiBody(e.target.value)}
            />
          )}

          <button
            onClick={testApiConnection}
            disabled={apiLoading || !apiEndpoint.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2"
            style={{ background: apiLoading || !apiEndpoint.trim() ? 'rgba(94,92,230,0.4)' : '#5e5ce6' }}
          >
            {apiLoading ? <Loader size={14} className="animate-spin" /> : <Link2 size={14} />}
            {apiLoading ? 'Testing…' : 'Test Connection'}
          </button>

          {/* API Result */}
          {apiResult && (
            <div className="mt-3 rounded-lg overflow-hidden animate-fade-in-up" style={{ border: '1px solid var(--border-primary)' }}>
              <pre className="text-[10px] p-3 overflow-auto max-h-40" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {apiResult}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Seed section */}
      <div className="apple-card border-none bg-gradient-to-br from-[var(--blue-primary-10)] to-transparent">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-1">Generate Full Dataset</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Wipes the existing database and repopulates it with fresh production data from <code className="text-xs bg-[var(--bg-tertiary)] px-1 py-0.5 rounded">seed_data.py</code>.
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
