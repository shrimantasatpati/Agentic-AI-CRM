const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---- Generic fetch wrapper ----
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ---- Analytics ----
import type { DashboardStats, PipelineData } from '@/types';

export const getDashboard = () =>
  apiFetch<DashboardStats>('/api/analytics/dashboard');

export const getPipeline = () =>
  apiFetch<PipelineData>('/api/analytics/pipeline');

// ---- Leads ----
export const getLeads = () =>
  apiFetch<unknown[]>('/api/leads/');

export const createLead = (data: Record<string, unknown>) =>
  apiFetch('/api/leads/', { method: 'POST', body: JSON.stringify(data) });

// ---- Deals ----
export const getDeals = () =>
  apiFetch<unknown[]>('/api/deals/');

// ---- Customers ----
export const getCustomers = () =>
  apiFetch<unknown[]>('/api/customers/');

// ---- Agent Triggers ----
export const qualifyLead = (data: Record<string, unknown>) =>
  apiFetch('/api/leads/workflow', { method: 'POST', body: JSON.stringify(data) });

export const analyzeEmail = (data: Record<string, unknown>) =>
  apiFetch('/api/agents/analyze-email', { method: 'POST', body: JSON.stringify(data) });

export const analyzeDeal = (dealId: string) =>
  apiFetch(`/api/agents/analyze-deal/${dealId}`, { method: 'POST' });

export const monitorCustomer = (customerId: string) =>
  apiFetch(`/api/agents/monitor-customer/${customerId}`, { method: 'POST' });

export const scheduleMeeting = (data: Record<string, unknown>) =>
  apiFetch('/api/agents/schedule-meeting', { method: 'POST', body: JSON.stringify(data) });

export const generateDashboard = (category = 'all') =>
  apiFetch('/api/agents/generate-dashboard', {
    method: 'POST',
    body: JSON.stringify({ category }),
  });

// ---- Query ----
export const queryDatabase = (prompt: string) =>
  apiFetch('/api/query', { method: 'POST', body: JSON.stringify({ prompt }) });

// ---- Webhooks ----
export const fireEmailWebhook = (data: Record<string, unknown>) =>
  apiFetch('/webhooks/email-received', { method: 'POST', body: JSON.stringify(data) });

export const fireFormWebhook = (data: Record<string, unknown>) =>
  apiFetch('/webhooks/form-submission', { method: 'POST', body: JSON.stringify(data) });

// ---- Scheduled Workflows ----
export const runDailyWorkflow = () =>
  apiFetch('/api/demo/run-agent-workflow?workflow_type=daily', { method: 'POST' });

export const runWeeklyWorkflow = () =>
  apiFetch('/api/demo/run-agent-workflow?workflow_type=weekly', { method: 'POST' });
