import { getAuthHeaders } from '../../lib/firebase';

const BACKEND_URL = import.meta.env.PROD
  ? ''
  : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export type OperonRiskLevel = 'read_only' | 'low_risk_change' | 'high_risk';

export type OperonActionType =
  | 'navigate'
  | 'create_agent'
  | 'run_agent'
  | 'pause_agent'
  | 'resume_agent'
  | 'delete_agent'
  | 'open_catalog'
  | 'ask_clarification'
  | 'confirm_action'
  | 'explanation';

export interface OperonAction {
  id: string;
  type: OperonActionType;
  description: string;
  params: Record<string, any>;
  status: 'planned' | 'awaiting_confirmation' | 'executed' | 'failed' | 'skipped';
  riskLevel: OperonRiskLevel;
}

export interface OperonQueryResult {
  id: string;
  userId: string;
  sessionId?: string;
  message: string;
  reply: string;
  actions: OperonAction[];
  riskLevel: OperonRiskLevel;
  requiresConfirmation: boolean;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: string;
}

export interface OperonQueryOptions {
  userId?: string;
  sessionId?: string;
  context?: any;
}

export async function queryOperon(
  message: string,
  options: OperonQueryOptions = {},
): Promise<OperonQueryResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/operon/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      userId: options.userId,
      sessionId: options.sessionId,
      context: options.context,
    }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Operon query failed: invalid JSON response');
  }

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Operon query failed');
  }

  return data.data as OperonQueryResult;
}

export async function getOperonLogs(
  userId: string,
  limit = 20,
): Promise<OperonQueryResult[]> {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (limit) params.set('limit', String(limit));

  const logHeaders = await getAuthHeaders();
  const res = await fetch(`${BACKEND_URL}/api/operon/logs?${params.toString()}`, { headers: logHeaders });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new Error('Failed to load Operon logs: invalid JSON response');
  }

  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to load Operon logs');
  }

  return data.data as OperonQueryResult[];
}
