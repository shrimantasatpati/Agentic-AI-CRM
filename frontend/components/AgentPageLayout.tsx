'use client';

import { useState, useRef, useEffect } from 'react';
import WorkflowSteps from '@/components/WorkflowSteps';
import ErrorBanner from '@/components/ErrorBanner';

interface StepDef {
  name: string;
  output: string;
}

interface ExampleInput {
  label: string;
  data: Record<string, string>;
}

interface AgentPageLayoutProps {
  // Agent identity
  agentName: string;
  agentDescription: string;
  agentColor: string;
  agentEmoji: string;

  // Form
  formFields: Array<{
    key: string;
    label: string;
    type?: 'text' | 'textarea' | 'email' | 'select';
    placeholder?: string;
    options?: string[];
    rows?: number;
  }>;
  defaultValues: Record<string, string>;
  examples: ExampleInput[];

  // Steps
  steps: StepDef[];

  // Optional extra content rendered below the description (e.g. OAuth banners)
  headerExtra?: React.ReactNode;

  // API call + result renderer
  onRun: (formData: Record<string, string>) => Promise<void>;
  resultNode: React.ReactNode;
  isComplete: boolean;
  isReady?: boolean;
  error?: string | null;
  onRetry?: () => void;
  agentId?: string; // Backend name for dynamic examples (e.g. LeadQualificationAgent)
  externalFillValues?: Record<string, string> | null;
}

export default function AgentPageLayout({
  agentName, agentDescription, agentColor, agentEmoji,
  formFields, defaultValues, examples, steps,
  onRun, resultNode, isComplete, error, onRetry, headerExtra, isReady, agentId, externalFillValues
}: AgentPageLayoutProps) {
  const [formData, setFormData] = useState<Record<string, string>>(defaultValues);
  const [running, setRunning]   = useState(false);
  const [totalMs, setTotalMs]   = useState<number | null>(null);
  const [dynamicExamples, setDynamicExamples] = useState<ExampleInput[]>([]);

  useEffect(() => {
    if (externalFillValues) {
      setFormData((prev) => ({ ...prev, ...externalFillValues }));
    }
  }, [externalFillValues]);

  // Fetch real recent inputs to use as examples
  useEffect(() => {
    if (!agentId) return;
    fetch(`http://localhost:8000/api/agents/recent-inputs/${agentId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setDynamicExamples(data))
      .catch(() => {});
  }, [agentId]);

  // resolveAnimRef: holds the resolver that fires when animation finishes
  const resolveAnimRef = useRef<((ms: number) => void) | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setTotalMs(null);
    // Create a promise that resolves when WorkflowSteps animation completes
    const animDone = new Promise<number>((resolve) => {
      resolveAnimRef.current = resolve;
    });
    // Run API call and wait for animation — both must finish before we stop
    try {
      await Promise.all([
        onRun(formData).catch(() => { /* error handled by parent */ }),
        animDone,
      ]);
    } finally {
      setRunning(false);
    }
  };

  const handleAnimationComplete = (ms: number) => {
    setTotalMs(ms);
    // Unblock handleRun so it can call setRunning(false)
    if (resolveAnimRef.current) {
      resolveAnimRef.current(ms);
      resolveAnimRef.current = null;
    }
  };

  const applyExample = (ex: ExampleInput) => {
    setFormData((prev) => ({ ...prev, ...ex.data }));
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-0.5">
          <span style={{ fontSize: 22 }}>{agentEmoji}</span>
          <h1 className="section-title" style={{ fontSize: 22 }}>{agentName}</h1>
          <span className="badge badge-blue ml-2">AI Agent</span>
        </div>
        <p className="section-subtitle">{agentDescription}</p>
      </div>

      {/* Optional header slot — e.g. OAuth connect banners */}
      {headerExtra}

      <div className="flex gap-4 items-start">
        {/* PANEL 1 — Input Form */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <div className="apple-card h-full">
            <h3 className="font-700 text-sm mb-4" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              Configure Input
            </h3>
            <div>
              {formFields.map((field) => (
                <div key={field.key} className="form-group">
                  <label className="form-label">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      className="form-input form-textarea"
                      rows={field.rows || 3}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      className="form-input"
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      style={{ background: 'var(--bg-input)' }}
                    >
                      {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      className="form-input"
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              className="btn-primary w-full mt-2"
              disabled={running || isReady === false}
              onClick={handleRun}
              style={{ 
                background: running || isReady === false ? 'rgba(0,0,0,0.1)' : `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
                opacity: running || isReady === false ? 0.6 : 1,
                cursor: running || isReady === false ? 'not-allowed' : 'pointer',
                color: running || isReady === false ? 'var(--text-tertiary)' : '#fff'
              }}
            >
              {running ? (
                <><div className="step-spinner" style={{ borderTopColor: '#fff', width: 14, height: 14 }} /> Running...</>
              ) : (
                <>▶ Run Agent</>
              )}
            </button>
            {isReady === false && (
              <p className="text-[10px] text-center mt-2" style={{ color: '#ff3b30' }}>
                Please select a record from the dropdown/list above to continue.
              </p>
            )}

            {/* Example Inputs */}
            <div className="mt-5">
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Example Inputs
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Static Examples */}
                {(examples || []).map((ex) => (
                  <button key={ex.label} className="chip" onClick={() => applyExample(ex)}>
                    {ex.label}
                  </button>
                ))}
                {/* Dynamic Examples */}
                {dynamicExamples.map((ex, idx) => (
                  <button key={`dyn-${idx}`} className="chip" style={{ borderColor: `${agentColor}40`, background: `${agentColor}08` }} onClick={() => applyExample(ex)}>
                    <span className="opacity-60 mr-1 text-[10px]">Recent</span> {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2 — Execution Timeline */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <div className="apple-card h-full">
            <h3 className="font-700 text-sm mb-4" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              Execution Steps
            </h3>
            {error && <div className="mb-3"><ErrorBanner message={error} onRetry={onRetry} /></div>}
            <WorkflowSteps
              steps={steps}
              color={agentColor}
              running={running}
              onComplete={handleAnimationComplete}
            />
          </div>
        </div>

        {/* PANEL 3 — Results */}
        <div className="flex-1 min-w-0">
          {isComplete ? (
            <div className="animate-fade-in-up">
              {resultNode}
            </div>
          ) : (
            <div
              className="apple-card flex flex-col items-center justify-center"
              style={{ minHeight: 300, opacity: 0.6 }}
            >
              <span style={{ fontSize: 40, marginBottom: 12 }}>{agentEmoji}</span>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Run the agent to see results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
