'use client';

import {
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  label?: string;
}

function getColor(score: number): string {
  if (score >= 70) return '#34c759';
  if (score >= 40) return '#ff9500';
  return '#ff3b30';
}

export default function ScoreGauge({ score, size = 160, label = 'Score' }: ScoreGaugeProps) {
  const color = getColor(score);
  const data = [{ value: score, fill: color }];

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: 'relative', width: size, height: size }}>
        <RadialBarChart
          width={size}
          height={size}
          cx={size / 2}
          cy={size / 2}
          innerRadius={size * 0.3}
          outerRadius={size * 0.46}
          barSize={size * 0.08}
          data={data}
          startAngle={225}
          endAngle={-45}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          {/* Background track */}
          <RadialBar
            background={{ fill: 'var(--border-primary)' }}
            dataKey="value"
            cornerRadius={size * 0.04}
            angleAxisId={0}
          />
        </RadialBarChart>
        {/* Center text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: size * 0.22, fontWeight: 800, color, lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: size * 0.09, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
