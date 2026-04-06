'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  subtitle?: string;
  // Optional hover detail rows — shown on hover
  hoverDetails?: Array<{ label: string; value: string }>;
}

export default function StatCard({ label, value, icon, color, trend, subtitle, hoverDetails }: StatCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="apple-card"
      style={{
        padding: 20,
        cursor: hoverDetails ? 'pointer' : 'default',
        border: hovered && hoverDetails ? `1px solid ${color}40` : undefined,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered && hoverDetails ? `0 4px 20px ${color}18` : undefined,
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
              {trend.direction === 'up' ? (
                <TrendingUp size={12} color="#34c759" />
              ) : trend.direction === 'down' ? (
                <TrendingDown size={12} color="#ff3b30" />
              ) : (
                <Activity size={12} color="var(--text-tertiary)" />
              )}
              <span className="text-xs font-semibold"
                style={{ 
                  color: trend.direction === 'up' ? '#34c759' : 
                         trend.direction === 'down' ? '#ff3b30' : 
                         'var(--text-tertiary)' 
                }}>
                {trend.direction !== 'neutral' && (trend.value > 0 ? '+' : '')}
                {trend.direction !== 'neutral' ? `${trend.value}%` : 'Stable'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>vs last month</span>
            </div>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: hovered && hoverDetails ? `${color}28` : `${color}18`,
            color,
            transition: 'background 0.2s',
          }}
        >
          {icon}
        </div>
      </div>

      {/* Hover detail panel */}
      {hoverDetails && hovered && (
        <div
          className="animate-fade-in-up"
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${color}25`,
          }}
        >
          {hoverDetails.map((d, i) => (
            <div key={i} className="flex items-center justify-between" style={{ marginBottom: i < hoverDetails.length - 1 ? 6 : 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
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
