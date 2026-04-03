'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Loader2, Sparkles, Activity, Database, BrainCircuit, Terminal } from 'lucide-react';

interface WorkflowStepsProps {
  steps: string[];
}

export default function WorkflowSteps({ steps }: WorkflowStepsProps) {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);

  useEffect(() => {
    if (steps.length > 0) {
      // Simulate real-time progress by staggered reveal
      const timer = setInterval(() => {
        setVisibleSteps((prev) => {
          if (prev >= steps.length) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, 600); // Reveal a step every 600ms

      return () => clearInterval(timer);
    }
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const getIcon = (step: string) => {
    const s = step.toLowerCase();
    if (s.includes('intent') || s.includes('identifying')) return <Sparkles size={16} className="text-purple-500" />;
    if (s.includes('sql') || s.includes('query')) return <Terminal size={16} className="text-blue-500" />;
    if (s.includes('executing') || s.includes('extracting')) return <Database size={16} className="text-cyan-500" />;
    if (s.includes('reasoning') || s.includes('synthesizing')) return <BrainCircuit size={16} className="text-pink-500" />;
    if (s.includes('success') || s.includes('retrieved')) return <CheckCircle2 size={16} className="text-green-500" />;
    return <Activity size={16} className="text-gray-400" />;
  };

  return (
    <div className="flex flex-col gap-3 py-4 pl-4 border-l-2 border-dashed border-[var(--border-subtle)] my-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 size={16} className="animate-spin text-blue-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Agentic Workflow in Progress
        </span>
      </div>
      
      {steps.map((step, index) => {
        const isVisible = index < visibleSteps;
        const isLast = index === visibleSteps - 1 && index < steps.length - 1;
        
        return (
          <div 
            key={index} 
            className={`flex items-start gap-3 transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}
          >
            <div className="mt-0.5 relative">
              {isVisible ? getIcon(step) : <Circle size={16} className="text-[var(--border-medium)]" />}
              {isLast && (
                 <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
              )}
            </div>
            
            <div className={`text-sm ${isVisible ? 'text-[var(--text-secondary)] font-medium' : 'text-[var(--text-muted)]'}`}>
              {step}
            </div>
          </div>
        );
      })}
      
      {visibleSteps < steps.length && (
         <div className="flex items-center gap-3 animate-pulse ml-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60 transition-all delay-75" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30 transition-all delay-150" />
         </div>
      )}
    </div>
  );
}
