'use client';

import {
  LineChart,
  Line,
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
  payload?: Array<{ value: number; color: string }>;
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

export default function LineChartWidget({ config, data }: Props) {
  return (
    <div className="apple-card fade-in-up" style={{ padding: '16px' }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{config.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'break-word', paddingRight: '8px' }}>{config.description}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 65 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={1}/>
              <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity={1}/>
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
            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
          />
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right" 
            wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.8rem', paddingLeft: '10px' }} 
          />
          <Line
            type="monotone"
            dataKey={config.yAxis}
            stroke="url(#lineGradient)"
            strokeWidth={2.5}
            dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#0d1120' }}
            activeDot={{ r: 6, fill: '#22d3ee' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
