import React from 'react';
import { Cpu, Feather, Layers } from 'lucide-react';

const agentConfig = [
  { name: 'Lead Qualification', active: true, description: 'Scores and qualifies incoming leads automatically.' },
  { name: 'Email Intelligence', active: true, description: 'Analyzes email sentiment and draft responses.' },
  { name: 'Sales Pipeline', active: true, description: 'Forecasts and updates deal status.' },
  { name: 'Customer Success', active: true, description: 'Detects churn risk and health metrics.' },
  { name: 'Meeting Scheduler', active: false, description: 'Automates meeting booking with customers.' },
  { name: 'Analytics', active: true, description: 'Generates dashboard metrics and reporting.' },
];

export default function Agents() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Cpu className="text-purple-500" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Agents</h1>
          <p className="text-sm text-slate-500">Enable or disable engine workflows and view agent statuses.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agentConfig.map((agent) => (
          <article key={agent.name} className={`rounded-xl border p-4 ${agent.active ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <Layers className="text-slate-600" />
              <div>
                <h2 className="font-semibold text-slate-900">{agent.name}</h2>
                <p className="text-sm text-slate-600">{agent.description}</p>
              </div>
            </div>
            <div className={`mt-3 inline-flex items-center gap-2 text-xs font-semibold rounded-full px-2.5 py-1 ${agent.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {agent.active ? 'Active' : 'Paused'}
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p>Agent orchestration is handled by backend workflows (see backend/workflows/orchestrator.py).</p>
        <p className="mt-1">No direct local toggle is configured yet; this is UI scaffolding for future settings.</p>
      </div>
    </div>
  );
}
