'use client';

import { useState, useRef, useEffect } from 'react';
import QueryInput from '@/components/QueryInput';
import DataTable from '@/components/DataTable';
import ChartGrid from '@/components/ChartGrid';
import { useTheme } from '@/components/ThemeProvider';
import { QueryResponse, ChatMessage, Thread } from '@/types/dashboard';
import WorkflowSteps from '@/components/WorkflowSteps';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const DEFAULT_QUERIES = [
  'Show me deals by stage',
  'Who are my high-scoring leads?',
  'Customer health overview'
];

// ── Shared Suggestions Component ───────────────────────────────────────────────
function SuggestionPills({ suggestions, onClick, disabled }: { suggestions: string[], onClick: (s:string)=>void, disabled: boolean }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
      {suggestions.map((q, i) => (
        <button
          key={i}
          className="btn-ghost"
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '20px', border: '1px solid var(--border-medium)', background: 'var(--bg-glass)', transition: 'all 0.2s', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
          onClick={() => onClick(q)}
          disabled={disabled}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

// ── SQL Display Component ────────────────────────────────────────────────────────
function MiniSQLPanel({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
      <button
        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', padding: '6px 12px', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ opacity: 0.6 }}>{open ? '▼' : '▶'}</span>
        {open ? 'Hide SQL Logic' : 'View Generated SQL Query'}
      </button>
      {open && (
        <pre style={{
          marginTop: '10px',
          padding: '16px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border-medium)',
          borderRadius: '12px',
          fontSize: '0.75rem',
          color: 'var(--accent-primary)',
          overflowX: 'auto',
          lineHeight: '1.4',
          fontFamily: 'monospace'
        }}>
          {sql}
        </pre>
      )}
    </div>
  );
}

// ── Agent Workflow Steps Component ─────────────────────────────────────────────

// ── Main Layout with Sidebar + Chat Flow ───────────────────────────────────────
export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  
  // Mobile Sidebar State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Responsive Hook
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const lg = window.matchMedia('(max-width: 768px)');
    setIsMobile(lg.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    lg.addEventListener('change', handler);
    return () => lg.removeEventListener('change', handler);
  }, []);

  // Thread State Management
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  
  // Track if we just submitted so we can scroll ONCE to the bottom loading state, then let user read down freely.
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);

  const activeThread = threads.find(t => t.id === activeThreadId);
  const messages = activeThread?.messages || [];
  
  useEffect(() => {
    if (shouldAutoScroll) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
      setShouldAutoScroll(false);
    }
  }, [messages, isLoading, shouldAutoScroll]);

  const handleCreateNewThread = () => {
    const newId = `thread-${Date.now()}`;
    const newThread: Thread = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      updatedAt: new Date()
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
    if (isMobile) setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    if (threads.length === 0) {
      handleCreateNewThread();
    }
  }, []);

  const handleQuery = async (prompt: string, skipUserMessage = false) => {
    if (!activeThreadId) return;

    if (!skipUserMessage) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
          return { 
            ...t, 
            title: t.title === 'New Conversation' ? prompt.substring(0, 30) + '...' : t.title,
            messages: [...t.messages, userMsg], 
            updatedAt: new Date() 
          };
        }
        return t;
      }));
    }
    
    setIsLoading(true);
    setShouldAutoScroll(true); // Auto scroll down to the loading spinner!

    try {
      const res = await fetch(`${BACKEND_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const json: QueryResponse = await res.json();

      if (!res.ok || json.status === 'error') {
        throw new Error(json.error || json.message || 'Query failed');
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: json.summary_text || 'Analytics compiled successfully.',
        timestamp: new Date(),
        queryResponse: json,
      };

      setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
          return { ...t, messages: [...t.messages, assistantMsg], updatedAt: new Date() };
        }
        return t;
      }));

    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${(err as Error).message}`,
        timestamp: new Date(),
        isError: true,
      };
      setThreads(prev => prev.map(t => {
        if (t.id === activeThreadId) {
          return { ...t, messages: [...t.messages, errorMsg], updatedAt: new Date() };
        }
        return t;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const lastResponse = [...messages].reverse().find(m => m.role === 'assistant' && !m.isError)?.queryResponse;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'transparent', position: 'relative', overflow: 'hidden' }}>
      
      {/* ── MAIN ANALYTICS VIEW ────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', overflowY: 'auto' }}>

        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 12px' : '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', maxWidth: '800px', padding: '0 40px' }}>
              <h2 style={{ fontSize: isMobile ? '2.5rem' : '4rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.06em', lineHeight: 1 }}>Welcome to AI CRM.</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '40px', fontWeight: 500 }}>Ask any question to generate an intelligent analytical report powered by autonomous agents.</p>
              <SuggestionPills suggestions={DEFAULT_QUERIES} onClick={handleQuery} disabled={isLoading} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '1000px', width: '100%', paddingBottom: '40px' }}>
              {messages.map((msg, i) => (
                <div key={msg.id} className="fade-in-up" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}>
                  
                  {/* USER BUBBLE */}
                  {msg.role === 'user' && (
                    <div style={{
                      background: 'var(--accent-primary)',
                      color: '#fff',
                      padding: '14px 20px',
                      borderRadius: '24px 24px 6px 24px',
                      fontSize: isMobile ? '0.95rem' : '1.05rem',
                      maxWidth: isMobile ? '90%' : '75%',
                      lineHeight: 1.5,
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      {msg.content}
                    </div>
                  )}

                  {/* AI BUBBLE */}
                  {msg.role === 'assistant' && (
                    <div className="apple-card" style={{
                      background: msg.isError ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-surface)',
                      padding: isMobile ? '16px 20px' : '24px 32px',
                      borderRadius: '6px 24px 24px 24px',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '24px',
                      border: msg.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-medium)',
                      boxShadow: 'var(--shadow-md)'
                    }}>
                      
                      {/* Context Pills */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                         <span className={msg.isError ? "badge badge-gray" : "badge badge-green"}>
                            {msg.isError ? "System Alert" : "Insight AI"}
                         </span>
                         {msg.queryResponse?.metadata?.row_count !== undefined && (
                            <span className="badge badge-gray">{msg.queryResponse.metadata.row_count.toLocaleString()} rows scanned</span>
                         )}
                      </div>

                      {/* Main Insight / Error Text */}
                      <p style={{ fontSize: isMobile ? '0.95rem' : '1rem', color: msg.isError ? '#ef4444' : 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </p>

                      {/* Retry Button on Error */}
                      {msg.isError && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10 }}>
                          <button
                            className="btn-ghost"
                            style={{ 
                              padding: '8px 16px', borderRadius: '16px', background: 'var(--bg-glass)', 
                              border: '1px solid var(--border-medium)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem'
                            }}
                            onClick={() => {
                              // Find the immediate proceeding user message prompt to retry
                              const prevUserMsg = messages[i-1];
                              if (prevUserMsg && prevUserMsg.role === 'user') {
                                handleQuery(prevUserMsg.content, true); // true = skip adding standard user bubble
                              }
                            }}
                            disabled={isLoading}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                            Retry Request
                          </button>
                        </div>
                      )}
                      {/* New Workflow Steps Visualization */}
                      {msg.queryResponse?.workflow_steps && (
                        <div style={{ marginBottom: '8px' }}>
                          <WorkflowSteps steps={msg.queryResponse.workflow_steps} />
                        </div>
                      )}

                      {/* Content Summary (Only if no summary_text in response yet) */}
                      {!msg.queryResponse?.summary_text && (
                        <div style={{ marginBottom: '16px' }}>{msg.content}</div>
                      )}
                      {msg.queryResponse?.dashboard_config?.charts && msg.queryResponse.dashboard_config.charts.length > 0 && (
                        <div style={{ width: '100%' }} className="chart-card-container">
                          <ChartGrid
                            charts={msg.queryResponse.dashboard_config.charts}
                            data={msg.queryResponse.data}
                          />
                        </div>
                      )}

                      {/* Deeply Compressed Data Table */}
                      {msg.queryResponse?.data && msg.queryResponse.data.length > 0 && (
                        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                          <DataTable data={msg.queryResponse.data} />
                        </div>
                      )}

                      {/* SQL Details Panel */}
                      {msg.queryResponse?.metadata?.sql_used && (
                        <MiniSQLPanel sql={msg.queryResponse.metadata.sql_used} />
                      )}

                    </div>
                  )}
                </div>
              ))}
              
              {/* Loading Indicator */}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-start', padding: '16px' }}>
                   <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                   <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Analyzing your data...</span>
                </div>
              )}

              {/* Suggestions at end of thread */}
              {lastResponse?.dashboard_config?.suggested_queries && lastResponse.dashboard_config.suggested_queries.length > 0 && !isLoading && (
                 <div className="fade-in-up" style={{ alignSelf: 'center', marginTop: '10px' }}>
                   <SuggestionPills suggestions={lastResponse.dashboard_config.suggested_queries} onClick={handleQuery} disabled={isLoading} />
                 </div>
              )}
              
              <div ref={endOfMessagesRef} />
            </div>
          )}
        </div>

        {/* ── INPUT FOOTER ────────────────────────────────────────────────── */}
        <footer style={{
           padding: isMobile ? '16px 12px 24px' : '24px 20px 40px',
           background: 'var(--bg-glass)',
           backdropFilter: 'blur(24px)',
           borderTop: '1px solid var(--border-subtle)',
           zIndex: 10
        }}>
           <div style={{ maxWidth: '800px', margin: '0 auto' }}>
             <QueryInput onSubmit={(val) => handleQuery(val, false)} isLoading={isLoading} />
           </div>
        </footer>

      </main>
    </div>
  );
}
