'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' };
  subtitle?: string;
}

export default function StatCard({ label, value, icon, color, trend, subtitle }: StatCardProps) {
  return (
    <div className="apple-card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
            {label}
          </p>
          <p className="text-2xl font-800 leading-tight" style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.direction === 'up'
                ? <TrendingUp size={12} color="#34c759" />
                : <TrendingDown size={12} color="#ff3b30" />}
              <span className="text-xs font-semibold"
                style={{ color: trend.direction === 'up' ? '#34c759' : '#ff3b30' }}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>vs last month</span>
            </div>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// Skeleton variant
export function StatCardSkeleton() {
  return (
    <div className="apple-card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-7 w-28" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
    </div>
  );
}
