'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { ChartConfig } from '@/types/dashboard';

interface Props {
  config: ChartConfig;
  data: Record<string, unknown>[];
}

const COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
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

export default function BarChartWidget({ config, data }: Props) {
  // Aggregate data by category for a cleaner summary
  const aggregatedMap = data.reduce((acc: Record<string, number>, row) => {
    const key = String(row[config.xAxis] ?? 'Unknown');
    const val = Number(row[config.yAxis] ?? 0);
    acc[key] = (acc[key] || 0) + val;
    return acc;
  }, {});

  const barData = Object.entries(aggregatedMap).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="apple-card fade-in-up" style={{ padding: '16px' }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{config.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'break-word', paddingRight: '8px' }}>{config.description}</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 65 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--chart-axis-text)"
            tick={{ fontSize: 11, fill: 'var(--chart-axis-text)' }}
            axisLine={false}
            tickLine={false}
            angle={-45}
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
          <Bar dataKey={config.yAxis} radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
