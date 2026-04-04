'use client';

import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div className="error-banner">
      <AlertCircle size={16} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-ghost"
          style={{ color: '#cc1b11', fontSize: 12, padding: '4px 10px' }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
      <button onClick={dismiss} className="btn-ghost p-1" style={{ color: '#cc1b11' }}>
        <X size={14} />
      </button>
    </div>
  );
}
