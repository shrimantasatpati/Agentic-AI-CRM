'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartConfig } from '@/types/dashboard';

interface Props {
  config: ChartConfig;
  data: Record<string, unknown>[];
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--chart-tooltip-bg)',
        border: `1px solid var(--chart-tooltip-border)`,
        borderRadius: '10px',
        padding: '10px 14px',
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <p style={{ color: 'var(--chart-tooltip-label)', fontSize: '0.8rem', marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: 'var(--chart-tooltip-text)', fontWeight: 600, fontSize: '0.95rem' }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AreaChartWidget({ config, data }: Props) {
  return (
    <div className="apple-card fade-in-up" style={{ padding: '16px' }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{config.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'break-word', paddingRight: '8px' }}>{config.description}</p>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 65 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" vertical={false} />
          <XAxis
            dataKey={config.xAxis}
            stroke="var(--chart-axis-text)"
            tick={{ fontSize: 11, fill: 'var(--chart-axis-text)' }}
            axisLine={false}
            tickLine={false}
            angle={-35}
            textAnchor="end"
            height={50}
          />
          <YAxis 
            stroke="var(--chart-axis-text)" 
            tick={{ fontSize: 11, fill: 'var(--chart-axis-text)' }}
            axisLine={false} 
            tickLine={false} 
            tickFormatter={(value) => typeof value === 'number' && value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
          />
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right" 
            wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.8rem', paddingLeft: '10px' }} 
          />
          <Area
            type="monotone"
            dataKey={config.yAxis}
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#areaGradient)"
            dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#0d1120' }}
            activeDot={{ r: 6, fill: '#22d3ee' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
