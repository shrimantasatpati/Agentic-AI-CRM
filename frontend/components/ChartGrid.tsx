import { ChartConfig } from '@/types/dashboard';
import BarChartWidget from './charts/BarChartWidget';
import LineChartWidget from './charts/LineChartWidget';
import PieChartWidget from './charts/PieChartWidget';
import AreaChartWidget from './charts/AreaChartWidget';

interface Props {
  charts: ChartConfig[];
  data: any[];
}

export default function ChartGrid({ charts, data }: Props) {
  if (!charts || charts.length === 0) {
    return (
       <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: '12px' }}>
          No charts available.
       </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      gap: '16px',
      paddingBottom: '16px',
      width: '100%',
      scrollbarWidth: 'thin',
    }}>
      {charts.map((chartConfig, i) => {
        // Enforce a strict min-width so they carousel horizontally
        const cardStyle = { minWidth: '420px', scrollSnapAlign: 'start' as const, flexShrink: 0 };

        return (
          <div key={i} style={cardStyle}>
            {chartConfig.type === 'bar' && <BarChartWidget config={chartConfig} data={data} />}
            {chartConfig.type === 'line' && <LineChartWidget config={chartConfig} data={data} />}
            {chartConfig.type === 'pie' && <PieChartWidget config={chartConfig} data={data} />}
            {chartConfig.type === 'area' && <AreaChartWidget config={chartConfig} data={data} />}
          </div>
        )
      })}
    </div>
  );
}
