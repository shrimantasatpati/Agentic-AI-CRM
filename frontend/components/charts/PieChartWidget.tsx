'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ChartConfig } from '@/types/dashboard';

interface Props {
  config: ChartConfig;
  data: Record<string, unknown>[];
}

const COLORS = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#e11d48'];

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; percent: number }>;
}) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div style={{
        background: 'var(--chart-tooltip-bg)',
        border: `1px solid var(--chart-tooltip-border)`,
        borderRadius: '10px',
        padding: '10px 14px',
        backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <p style={{ color: 'var(--chart-tooltip-label)', fontSize: '0.8rem', marginBottom: 4 }}>{item.name}</p>
        <p style={{ color: 'var(--chart-tooltip-text)', fontWeight: 600, fontSize: '0.95rem' }}>
          {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </p>
        <p style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem' }}>
          {(item.percent * 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({ percent }: { percent?: number }) => {
  if (percent === undefined || percent < 0.05) return null;
  return `${(percent * 100).toFixed(0)}%`;
};

export default function PieChartWidget({ config, data }: Props) {
  // Aggregate data by category for a cleaner summary
  const aggregatedMap = data.reduce((acc: Record<string, number>, row) => {
    const key = String(row[config.xAxis] ?? 'Unknown');
    const val = Number(row[config.yAxis] ?? 0);
    acc[key] = (acc[key] || 0) + val;
    return acc;
  }, {});

  const pieData = Object.entries(aggregatedMap).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="apple-card fade-in-up" style={{ padding: '16px' }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: '0.95rem' }}>{config.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 16, lineHeight: 1.4, whiteSpace: 'normal', overflowWrap: 'break-word', paddingRight: '8px' }}>{config.description}</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {pieData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right" 
            wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.75rem', paddingLeft: '10px' }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
