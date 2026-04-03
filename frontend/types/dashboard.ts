export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  xAxis: string;
  yAxis: string;
  title: string;
  description: string;
}

export interface DashboardConfig {
  charts: ChartConfig[];
  suggested_queries?: string[];
}

export interface QueryMetadata {
  row_count: number;
  columns: string[];
  pii_columns_redacted: string[];
  sql_used: string;
  execution_time_ms: number;
}

export interface QueryResponse {
  status: 'success' | 'error' | 'no_tables';
  data: Record<string, unknown>[];
  dashboard_config: DashboardConfig;
  summary_text: string;
  workflow_steps?: string[];
  metadata?: QueryMetadata;
  error?: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  queryResponse?: QueryResponse;
  isError?: boolean;
}

export interface Thread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: Date;
}
