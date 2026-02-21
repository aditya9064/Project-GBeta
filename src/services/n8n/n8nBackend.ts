/**
 * n8n Backend API Client
 * 
 * Communicates with our Express backend which proxies to the
 * self-hosted n8n instance. This is the bridge that makes every
 * n8n automation actually executable.
 * 
 * Flow:
 *   Frontend → /api/n8n/* → Express backend → n8n REST API
 */

import type { N8nWorkflow } from './converter';

/* ═══ Types ═══════════════════════════════════════════════ */

export interface N8nStatus {
  connected: boolean;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyValid: boolean;
  workflowCount: number;
  editorUrl: string;
  hint?: string;
}

export interface N8nDeployedWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  editorUrl: string;
}

export interface N8nExecutionResult {
  executionId: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  finished: boolean;
  data: any;
  workflowId: string;
  workflowName: string;
  triggeredVia?: string;
  startedAt: string;
  stoppedAt: string | null;
}

/* ═══ Helpers ════════════════════════════════════════════ */

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    },
    ...options,
  });

  const json = await resp.json();

  if (!resp.ok || json.success === false) {
    const error = json.error || json.message || `API error: ${resp.status}`;
    throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
  }

  return json.data as T;
}

/* ═══ Cached status ══════════════════════════════════════ */

let _cachedStatus: N8nStatus | null = null;
let _statusCheckedAt = 0;
const STATUS_CACHE_MS = 30_000; // 30 seconds

/* ═══ Public API ═════════════════════════════════════════ */

/**
 * Check if the n8n backend is connected and available
 */
export async function checkN8nStatus(forceRefresh = false): Promise<N8nStatus> {
  const now = Date.now();
  if (!forceRefresh && _cachedStatus && now - _statusCheckedAt < STATUS_CACHE_MS) {
    return _cachedStatus;
  }

  try {
    const status = await apiCall<N8nStatus>('/api/n8n/status');
    _cachedStatus = status;
    _statusCheckedAt = now;
    return status;
  } catch {
    const fallback: N8nStatus = {
      connected: false,
      baseUrl: 'http://localhost:5678',
      apiKeyConfigured: false,
      apiKeyValid: false,
      workflowCount: 0,
      editorUrl: 'http://localhost:5678',
      hint: 'Backend server is not running',
    };
    _cachedStatus = fallback;
    _statusCheckedAt = now;
    return fallback;
  }
}

/**
 * Check if n8n is fully ready (connected + API key valid)
 */
export async function isN8nReady(): Promise<boolean> {
  const status = await checkN8nStatus();
  return status.connected && status.apiKeyValid;
}

/**
 * Push an n8n workflow to the n8n instance.
 * Returns the n8n workflow ID and editor URL.
 */
export async function pushWorkflowToN8n(workflow: N8nWorkflow): Promise<N8nDeployedWorkflow> {
  return apiCall<N8nDeployedWorkflow>('/api/n8n/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });
}

/**
 * Activate a workflow in n8n (enables its triggers).
 */
export async function activateWorkflow(n8nWorkflowId: string): Promise<{ id: string; active: boolean }> {
  return apiCall(`/api/n8n/workflows/${n8nWorkflowId}/activate`, { method: 'POST' });
}

/**
 * Deactivate a workflow in n8n.
 */
export async function deactivateWorkflow(n8nWorkflowId: string): Promise<{ id: string; active: boolean }> {
  return apiCall(`/api/n8n/workflows/${n8nWorkflowId}/deactivate`, { method: 'POST' });
}

/**
 * Execute a workflow in n8n and return the result.
 */
export async function executeWorkflowInN8n(
  n8nWorkflowId: string,
  triggerData: Record<string, any> = {}
): Promise<N8nExecutionResult> {
  return apiCall<N8nExecutionResult>(`/api/n8n/workflows/${n8nWorkflowId}/run`, {
    method: 'POST',
    body: JSON.stringify({ data: triggerData }),
  });
}

/**
 * Get details of a specific execution.
 */
export async function getExecution(executionId: string): Promise<N8nExecutionResult> {
  return apiCall<N8nExecutionResult>(`/api/n8n/executions/${executionId}`);
}

/**
 * Get the n8n editor URL for a workflow.
 * Users can open this to edit the workflow visually in n8n.
 */
export async function getEditorUrl(n8nWorkflowId: string): Promise<string> {
  const result = await apiCall<{ editorUrl: string }>(`/api/n8n/editor-url/${n8nWorkflowId}`);
  return result.editorUrl;
}

/**
 * Get workflow details from n8n.
 */
export async function getN8nWorkflow(n8nWorkflowId: string): Promise<any> {
  return apiCall(`/api/n8n/workflows/${n8nWorkflowId}`);
}


