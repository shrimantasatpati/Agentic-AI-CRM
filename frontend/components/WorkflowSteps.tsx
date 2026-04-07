'use client';

import { useReducer, useEffect, useRef } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import type { ExecutionStep } from '@/types';

// ---- Reducer ----
type Action =
  | { type: 'START_STEP'; index: number }
  | { type: 'COMPLETE_STEP'; index: number; output: string; durationMs: number }
  | { type: 'ERROR_STEP'; index: number; output: string }
  | { type: 'RESET' }
  | { type: 'REPLAY_REAL'; steps: Array<{ name: string; output: string; durationMs: number }> };

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
  // When provided, replays these real steps (from API response) in animated sequence
  realSteps?: Array<{ name: string; output: string; durationMs: number }> | null;
}

export default function WorkflowSteps({ steps, color, running, onComplete, realSteps }: WorkflowStepsProps) {
  const [state, dispatch] = useReducer(
    reducer,
    steps.map((s, i) => ({ id: i, name: s.name, status: 'pending' as const }))
  );

  const animRef = useRef<boolean>(false);

  // Phase 1: While API is running, show a "pending → running" shimmer on first step only
  useEffect(() => {
    if (!running) return;
    dispatch({ type: 'RESET' });
    animRef.current = false;
    // Start the first step as "running" immediately so the user sees activity
    dispatch({ type: 'START_STEP', index: 0 });
  }, [running]);

  // Phase 2: Once real steps arrive from the API response, replay them in animated sequence
  useEffect(() => {
    if (!realSteps || realSteps.length === 0) return;
    if (animRef.current) return; // Don't replay if already replaying
    animRef.current = true;

    dispatch({ type: 'RESET' });

    let cancelled = false;
    const startTime = Date.now();

    const replay = async () => {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;

        dispatch({ type: 'START_STEP', index: i });

        // Use real timing from the API — each step shown for its real duration
        // But cap at 1200ms per step so it doesn't feel too slow in replay
        const realStep = realSteps[i];
        const displayMs = realStep ? Math.min(realStep.durationMs || 600, 1200) : 600;

        await new Promise((r) => setTimeout(r, displayMs));
        if (cancelled) return;

        const outputText = realStep ? realStep.output : steps[i].output;
        const durationMs = realStep ? (realStep.durationMs || displayMs) : displayMs;

        dispatch({ type: 'COMPLETE_STEP', index: i, output: outputText, durationMs });

        await new Promise((r) => setTimeout(r, 100));
      }

      if (!cancelled && onComplete) {
        onComplete(Date.now() - startTime);
      }
    };

    replay();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realSteps]);

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
            Completed in {totalMs}ms — Real LLM execution
          </span>
        </div>
      )}

      {/* Loading indicator while API is running and no real steps yet */}
      {running && !allComplete && !realSteps && (
        <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--border-secondary)', opacity: 0.6 }}>
          <div className="step-spinner" style={{ borderTopColor: color, width: 12, height: 12 }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Waiting for LLM response…</span>
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
