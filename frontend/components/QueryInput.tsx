'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Props {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function QueryInput({ onSubmit, isLoading }: Props) {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, [inputValue]);

  const handleSubmit = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Expose setInputValue via a window event or ref if we want to programmatically set it, 
  // but since we moved suggestions to page.tsx, page.tsx just calls handleQuery directly!

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '24px',
      padding: '8px 12px 8px 16px',
      boxShadow: 'var(--shadow-sm)',
      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      width: '100%',
    }}>
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything about your data..."
        disabled={isLoading}
        rows={1}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-outfit)',
          fontSize: '0.95rem',
          resize: 'none',
          lineHeight: '1.4',
          padding: '8px 0',
          maxHeight: '150px'
        }}
      />

      <button
        style={{ 
          background: inputValue.trim() && !isLoading ? 'var(--accent-primary)' : 'var(--border-medium)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          marginLeft: '8px',
          marginBottom: '2px'
        }}
        onClick={handleSubmit}
        disabled={isLoading || !inputValue.trim()}
      >
        {isLoading ? (
          <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff', borderRightColor: '#fff' }} />
        ) : (
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
           </svg>
        )}
      </button>
    </div>
  );
}
