/* ═══════════════════════════════════════════════════════════
   useAutonomousAgent — React hook for the autonomous agent

   Manages SSE connection to /api/autonomous/run, tracks
   execution steps, and provides action methods for approval,
   messaging, and cancellation.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuthHeaders } from '../lib/firebase';

const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');
const MAX_RECONNECT_RETRIES = 3;
const RECONNECT_BASE_DELAY = 2000;

export type StepType = 'thinking' | 'tool_call' | 'tool_result' | 'approval_required' | 'user_message' | 'error' | 'done' | 'ask_user';

export interface ExecutionStep {
  id: string;
  type: StepType;
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  content?: string;
  riskLevel?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
  durationMs?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  steps?: ExecutionStep[];
  isStreaming?: boolean;
}

export interface AutonomousState {
  status: 'idle' | 'running' | 'awaiting_approval' | 'awaiting_user' | 'completed' | 'failed' | 'cancelled';
  executionId: string | null;
  messages: ChatMessage[];
  currentSteps: ExecutionStep[];
  totalTokens: number;
  totalCost: number;
  pendingApproval: {
    toolName: string;
    toolArgs: Record<string, any>;
    riskLevel: string;
    description: string;
  } | null;
  pendingQuestion: string | null;
}

const initialState: AutonomousState = {
  status: 'idle',
  executionId: null,
  messages: [],
  currentSteps: [],
  totalTokens: 0,
  totalCost: 0,
  pendingApproval: null,
  pendingQuestion: null,
};

export interface AutonomousOptions {
  model?: string;
  maxIterations?: number;
  autoApproveRisk?: 'low' | 'medium' | 'high';
  tools?: string[];
  systemPrompt?: string;
}

export interface ExecutionHistoryItem {
  id: string;
  goal: string;
  status: string;
  model: string;
  stepCount: number;
  totalTokens: number;
  totalCost: number;
  startedAt: string;
  completedAt?: string;
  result?: string;
}

export function useAutonomousAgent() {
  const [state, setState] = useState<AutonomousState>(initialState);
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/autonomous/history?limit=20`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success) setHistory(json.data || []);
      }
    } catch { /* best effort */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      readerRef.current?.cancel().catch(() => {});
    };
  }, []);

  const sendGoal = useCallback(async (goal: string, options: AutonomousOptions = {}) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: goal,
      timestamp: new Date().toISOString(),
    };

    setState(prev => ({
      ...initialState,
      status: 'running',
      messages: [...prev.messages, userMsg],
    }));

    const headers = await getAuthHeaders();
    const controller = new AbortController();
    abortRef.current = controller;

    let execId: string | null = null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/autonomous/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ goal, ...options }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        setState(prev => ({
          ...prev,
          status: 'failed',
          messages: [...prev.messages, {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: `Error: ${errText}`,
            timestamp: new Date().toISOString(),
          }],
        }));
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      const accumulatedSteps: ExecutionStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.executionId) execId = data.executionId;
              processEvent(currentEvent, data, accumulatedSteps, execId, setState);
            } catch {
              // Skip malformed events
            }
          }
        }
      }

      setState(prev => {
        if (prev.status === 'running') {
          return { ...prev, status: 'completed' };
        }
        return prev;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setState(prev => ({ ...prev, status: 'cancelled' }));
      } else {
        if (execId) {
          const resolved = await pollExecutionStatus(execId, setState);
          if (resolved) return;
        }

        setState(prev => ({
          ...prev,
          status: prev.status === 'running' ? 'failed' : prev.status,
          messages: [...prev.messages, {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: `Connection error: ${err.message}`,
            timestamp: new Date().toISOString(),
          }],
        }));
      }
    }
  }, []);

  const approve = useCallback(async (approved: boolean) => {
    const execId = state.executionId;
    if (!execId) return;

    const headers = await getAuthHeaders();
    try {
      await fetch(`${BACKEND_URL}/api/autonomous/${execId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ approved }),
      });
      setState(prev => ({
        ...prev,
        status: 'running',
        pendingApproval: null,
      }));
    } catch (err: any) {
      console.error('Approval failed:', err);
    }
  }, [state.executionId]);

  const sendMessage = useCallback(async (message: string) => {
    const execId = state.executionId;
    if (!execId) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      pendingQuestion: null,
      status: 'running',
    }));

    const headers = await getAuthHeaders();
    try {
      await fetch(`${BACKEND_URL}/api/autonomous/${execId}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message }),
      });
    } catch (err: any) {
      console.error('Send message failed:', err);
    }
  }, [state.executionId]);

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    const execId = state.executionId;
    if (execId) {
      const headers = await getAuthHeaders();
      try {
        await fetch(`${BACKEND_URL}/api/autonomous/${execId}/cancel`, {
          method: 'POST',
          headers,
        });
      } catch {
        // Best effort
      }
    }
    setState(prev => ({ ...prev, status: 'cancelled' }));
  }, [state.executionId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initialState);
  }, []);

  const sendGoalWithRefresh = useCallback(async (goal: string, options: AutonomousOptions = {}) => {
    await sendGoal(goal, options);
    setTimeout(() => fetchHistory(), 1000);
  }, [sendGoal, fetchHistory]);

  return {
    ...state,
    history,
    historyLoading,
    fetchHistory,
    sendGoal: sendGoalWithRefresh,
    approve,
    sendMessage,
    cancel,
    reset,
  };
}

/* ─── SSE Event Processing ──────────────────────────────── */

function processEvent(
  event: string,
  data: any,
  accumulatedSteps: ExecutionStep[],
  execId: string | null,
  setState: React.Dispatch<React.SetStateAction<AutonomousState>>,
) {
  switch (event) {
    case 'execution_start':
      setState(prev => ({
        ...prev,
        executionId: data.executionId,
        status: 'running',
      }));
      break;

    case 'thinking':
      setState(prev => ({
        ...prev,
        currentSteps: [...prev.currentSteps, {
          id: `step-${Date.now()}`,
          type: 'thinking',
          timestamp: new Date().toISOString(),
          content: data.message,
        }],
      }));
      break;

    case 'step_thinking':
      if (data.step) {
        accumulatedSteps.push(data.step);
        setState(prev => ({
          ...prev,
          currentSteps: [...prev.currentSteps, data.step],
          totalTokens: prev.totalTokens + (data.step.tokenUsage?.total || 0),
        }));
      }
      break;

    case 'tool_start':
      setState(prev => ({
        ...prev,
        currentSteps: [...prev.currentSteps, {
          id: `step-${Date.now()}`,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          toolName: data.toolName,
          toolArgs: data.toolArgs,
          content: `Calling ${data.toolName}...`,
        }],
      }));
      break;

    case 'tool_complete':
      if (data.step) {
        accumulatedSteps.push(data.step);
        setState(prev => {
          const updated = [...prev.currentSteps];
          const idx = updated.findLastIndex(s => s.toolName === data.step.toolName && !s.toolResult);
          if (idx !== -1) {
            updated[idx] = data.step;
          } else {
            updated.push(data.step);
          }
          return { ...prev, currentSteps: updated };
        });
      }
      break;

    case 'approval_required':
      setState(prev => ({
        ...prev,
        status: 'awaiting_approval',
        executionId: data.executionId || execId,
        pendingApproval: {
          toolName: data.toolName,
          toolArgs: data.toolArgs,
          riskLevel: data.riskLevel,
          description: data.description,
        },
        currentSteps: [...prev.currentSteps, data.step || {
          id: `step-${Date.now()}`,
          type: 'approval_required',
          timestamp: new Date().toISOString(),
          toolName: data.toolName,
          toolArgs: data.toolArgs,
          riskLevel: data.riskLevel,
        }],
      }));
      break;

    case 'approval_granted':
    case 'approval_denied':
      setState(prev => ({
        ...prev,
        status: 'running',
        pendingApproval: null,
      }));
      break;

    case 'awaiting_user':
      setState(prev => ({
        ...prev,
        status: 'awaiting_user',
        executionId: data.executionId || execId,
        pendingQuestion: data.question,
        currentSteps: [...prev.currentSteps, data.step || {
          id: `step-${Date.now()}`,
          type: 'ask_user',
          timestamp: new Date().toISOString(),
          content: data.question,
        }],
      }));
      break;

    case 'user_response':
      setState(prev => ({
        ...prev,
        status: 'running',
        pendingQuestion: null,
      }));
      break;

    case 'step_done': {
      const result = data.result || data.step?.content || '';
      const doneMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result,
        timestamp: new Date().toISOString(),
        steps: [...accumulatedSteps],
      };
      setState(prev => ({
        ...prev,
        status: 'completed',
        messages: [...prev.messages, doneMsg],
        currentSteps: [],
      }));
      break;
    }

    case 'step_error':
      if (data.step) {
        accumulatedSteps.push(data.step);
        setState(prev => ({
          ...prev,
          currentSteps: [...prev.currentSteps, data.step],
        }));
      }
      break;

    case 'execution_complete':
      setState(prev => ({
        ...prev,
        totalTokens: data.totalTokens || prev.totalTokens,
        totalCost: data.totalCost || prev.totalCost,
      }));
      break;

    case 'execution_cancelled':
      setState(prev => ({ ...prev, status: 'cancelled' }));
      break;

    case 'execution_error':
      setState(prev => ({
        ...prev,
        status: 'failed',
        messages: [...prev.messages, {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
        }],
      }));
      break;

    case 'max_iterations':
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `Reached maximum iterations (${data.iterations}). The task may be partially complete.`,
          timestamp: new Date().toISOString(),
        }],
      }));
      break;

    case 'done':
      break;

    default:
      break;
  }
}

/* ─── Stream Reconnection / Status Polling ──────────────── */

async function pollExecutionStatus(
  executionId: string,
  setState: React.Dispatch<React.SetStateAction<AutonomousState>>,
): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RECONNECT_RETRIES; attempt++) {
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, attempt);

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, {
        id: `msg-reconnect-${Date.now()}`,
        role: 'system',
        content: `Stream disconnected. Checking status (attempt ${attempt + 1}/${MAX_RECONNECT_RETRIES})...`,
        timestamp: new Date().toISOString(),
      }],
    }));

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/autonomous/${executionId}/status`, { headers });
      if (!res.ok) continue;

      const json = await res.json();
      if (!json.success) continue;

      const { status, result, error } = json.data;

      if (status === 'running') continue;

      const finalStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed';
      setState(prev => ({
        ...prev,
        status: finalStatus,
        messages: [...prev.messages, {
          id: `msg-status-${Date.now()}`,
          role: status === 'completed' ? 'assistant' : 'system',
          content: result || error || `Execution ${status}.`,
          timestamp: new Date().toISOString(),
        }],
      }));
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
