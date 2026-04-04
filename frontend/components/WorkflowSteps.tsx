'use client';

import { useReducer, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import type { ExecutionStep } from '@/types';

// ---- Reducer ----
type Action =
  | { type: 'START_STEP'; index: number }
  | { type: 'COMPLETE_STEP'; index: number; output: string; durationMs: number }
  | { type: 'ERROR_STEP'; index: number; output: string }
  | { type: 'RESET' };

function reducer(state: ExecutionStep[], action: Action): ExecutionStep[] {
  switch (action.type) {
    case 'START_STEP':
      return state.map((s, i) =>
        i === action.index ? { ...s, status: 'running' } : s
      );
    case 'COMPLETE_STEP':
      return state.map((s, i) =>
        i === action.index
          ? { ...s, status: 'complete', output: action.output, durationMs: action.durationMs }
          : s
      );
    case 'ERROR_STEP':
      return state.map((s, i) =>
        i === action.index ? { ...s, status: 'error', output: action.output } : s
      );
    case 'RESET':
      return state.map((s) => ({ ...s, status: 'pending', output: undefined, durationMs: undefined }));
    default:
      return state;
  }
}

// ---- Props ----
interface WorkflowStepsProps {
  steps: { name: string; output: string }[];
  color: string;
  running: boolean;
  onComplete?: (totalMs: number) => void;
}

export default function WorkflowSteps({ steps, color, running, onComplete }: WorkflowStepsProps) {
  const [state, dispatch] = useReducer(
    reducer,
    steps.map((s, i) => ({ id: i, name: s.name, status: 'pending' as const }))
  );

  useEffect(() => {
    if (!running) return;

    // Reset first
    dispatch({ type: 'RESET' });

    let cancelled = false;
    const startTime = Date.now();

    const run = async () => {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;

        // Mark as running
        dispatch({ type: 'START_STEP', index: i });

        // Simulate processing time (300–800ms varies by step)
        const delay = 300 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));

        if (cancelled) return;
        const stepStart = Date.now();
        const durationMs = Math.round(delay);

        dispatch({
          type: 'COMPLETE_STEP',
          index: i,
          output: steps[i].output,
          durationMs,
        });

        // Small gap between steps
        await new Promise((r) => setTimeout(r, 120));
      }

      if (!cancelled && onComplete) {
        onComplete(Date.now() - startTime);
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const totalMs = state.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  const allComplete = state.every((s) => s.status === 'complete');

  return (
    <div className="space-y-1">
      {state.map((step, idx) => (
        <div key={step.id} className="relative flex gap-3 pb-2" style={{ minHeight: 44 }}>
          {/* Connector line */}
          {idx < state.length - 1 && (
            <div
              className="absolute"
              style={{ left: 11, top: 26, bottom: 0, width: 1, background: 'var(--border-primary)' }}
            />
          )}

          {/* Step circle */}
          <div className="flex-shrink-0 z-10">
            <StepCircle step={step} color={color} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-medium leading-tight"
                style={{
                  color: step.status === 'pending' ? 'var(--text-tertiary)'
                       : step.status === 'running' ? color
                       : 'var(--text-primary)',
                }}
              >
                {step.name}
              </span>
              {step.durationMs !== undefined && (
                <span className="step-duration">{step.durationMs}ms</span>
              )}
            </div>
            {step.output && step.status !== 'pending' && (
              <p
                className="text-xs mt-0.5 animate-fade-in-up"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}
              >
                {step.output}
              </p>
            )}
          </div>
        </div>
      ))}

      {allComplete && totalMs > 0 && (
        <div
          className="flex items-center gap-2 mt-3 pt-3 animate-fade-in-up"
          style={{ borderTop: '1px solid var(--border-primary)' }}
        >
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: color }}>
            <Check size={10} color="#fff" />
          </div>
          <span className="text-xs font-semibold" style={{ color }}>
            Completed in {totalMs}ms
          </span>
        </div>
      )}
    </div>
  );
}

function StepCircle({ step, color }: { step: ExecutionStep; color: string }) {
  if (step.status === 'pending') {
    return (
      <div className="step-circle step-circle-pending">
        <span>{step.id + 1}</span>
      </div>
    );
  }
  if (step.status === 'running') {
    return (
      <div className="step-circle step-circle-running" style={{ color }}>
        <div className="step-spinner" style={{ borderTopColor: color }} />
      </div>
    );
  }
  if (step.status === 'complete') {
    return (
      <div className="step-circle step-circle-complete animate-fade-in" style={{ background: color }}>
        <Check size={12} />
      </div>
    );
  }
  return (
    <div className="step-circle step-circle-error">
      <AlertCircle size={12} />
    </div>
  );
}
