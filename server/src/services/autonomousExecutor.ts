/* ═══════════════════════════════════════════════════════════
   Autonomous Executor — Powered by Claude Agent SDK

   Replaces the manual OpenAI ReAct loop with the Claude Agent
   SDK's built-in agentic loop. Claude autonomously decides
   which tools to call, handles context management, and runs
   to completion.

   Key capabilities:
   - Claude Agent SDK agentic loop (no manual iteration)
   - Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
   - Custom tools via MCP: Gmail, Slack, Google Workspace, HTTP, Memory
   - SSE streaming for real-time progress
   - Approval gating via PreToolUse hooks
   - Sub-agent delegation via Agent tool
   - Session resume/fork
   - Cost tracking & budget limits
   - Cancellation via AbortController
   ═══════════════════════════════════════════════════════════ */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookCallback, SyncHookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config.js';
import { logger } from './logger.js';
import { setToolContext, createOperonMcpServer } from './mcpToolsServer.js';
import type { RiskLevel, ToolContext } from './toolRegistry.js';

/* ─── Firestore persistence helper ───────────────────────── */

async function getFirestoreDb() {
  try {
    const { getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (getApps().length > 0) return getFirestore();
  } catch { /* Firestore not available */ }
  return null;
}

const EXECUTIONS_COLLECTION = 'autonomous_executions';

/* ─── Types ─────────────────────────────────────────────── */

export type StepType = 'thinking' | 'tool_call' | 'tool_result' | 'approval_required' | 'user_message' | 'error' | 'done' | 'ask_user';

export interface ExecutionStep {
  id: string;
  type: StepType;
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  content?: string;
  riskLevel?: RiskLevel;
  tokenUsage?: { prompt: number; completion: number; total: number };
  durationMs?: number;
  error?: string;
}

export interface AutonomousExecution {
  id: string;
  userId: string;
  goal: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval' | 'awaiting_user';
  steps: ExecutionStep[];
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  totalTokens: number;
  totalCost: number;
  model: string;
  maxIterations: number;
  sessionId?: string;
  parentExecutionId?: string;
}

export interface AutonomousOptions {
  model?: string;
  maxIterations?: number;
  autoApproveRisk?: RiskLevel;
  tools?: string[];
  systemPrompt?: string;
  parentExecutionId?: string;
}

type SSEEmitter = (event: string, data: Record<string, any>) => void;

/* ─── High-risk tools that require user approval ────────── */

const HIGH_RISK_TOOLS = new Set([
  'gmail_send', 'gmail_reply', 'slack_send',
]);

const MEDIUM_RISK_TOOLS = new Set([
  'http_request', 'browser_navigate', 'run_code',
  'google_drive', 'google_calendar', 'google_sheets',
  'google_docs', 'google_workspace', 'create_workflow',
  'gmail_draft', 'spawn_agent',
]);

function getToolRisk(toolName: string): RiskLevel {
  if (HIGH_RISK_TOOLS.has(toolName)) return 'high';
  if (MEDIUM_RISK_TOOLS.has(toolName)) return 'medium';
  return 'low';
}

/* ─── System Prompt ─────────────────────────────────────── */

const DEFAULT_SYSTEM_PROMPT = `You are an autonomous AI agent built into OperonAI. You serve two purposes:

1. EXECUTE tasks immediately — use tools to accomplish the user's goal right now.
2. HELP CREATE reusable agents — when the user says "create an agent", "build an automation", or "deploy a workflow", execute the task first to validate it works, then summarize what you did so the user can deploy it as a reusable agent.

RULES:
1. Break complex goals into smaller steps and execute them one at a time.
2. After each tool call, analyze the result and decide your next action.
3. If you need information you don't have, use the appropriate tool to get it.
4. If something fails, try an alternative approach before giving up.
5. When you're done, provide a clear summary of what you accomplished.
6. Be concise in your reasoning. Focus on action, not explanation.
7. Never fabricate data — always use tools to get real information.
8. For potentially destructive actions (sending emails, posting messages), confirm the content is correct before executing.
9. After completing a task, remind the user they can click "Deploy as Agent" to save this as a reusable automation.

You have access to: Gmail, Slack, HTTP requests, AI analysis, browser navigation, code execution, persistent memory, Google Workspace (Drive, Calendar, Sheets, Docs), web search, and file system operations.

GOOGLE WORKSPACE TIPS:
- Use the specific google_drive, google_calendar, google_sheets, google_docs tools for common operations.
- Use the google_workspace tool for less common APIs (Chat, Admin, Tasks, etc.).
- Drive search supports queries like: name contains 'report', mimeType='application/pdf', modifiedTime > '2026-01-01'.
- Calendar times must be ISO 8601 format with timezone offset.
- Sheets ranges use A1 notation: "Sheet1!A1:C10".`;

/* ─── Execution Store (in-memory, keyed by executionId) ── */

const activeExecutions = new Map<string, AutonomousExecution>();
const approvalResolvers = new Map<string, (approved: boolean) => void>();
const userMessageResolvers = new Map<string, (message: string) => void>();
const abortControllers = new Map<string, AbortController>();

/* ─── Claude model mapping ──────────────────────────────── */

const CLAUDE_MODELS: Record<string, string> = {
  'claude-sonnet':       'claude-sonnet-4-20250514',
  'claude-sonnet-4':     'claude-sonnet-4-20250514',
  'claude-opus':         'claude-opus-4-20250514',
  'claude-opus-4':       'claude-opus-4-20250514',
  'claude-haiku':        'claude-haiku-3-5-20241022',
  'claude-haiku-3.5':    'claude-haiku-3-5-20241022',
};

function resolveModel(input?: string): string {
  if (!input) return config.anthropic.model || 'claude-sonnet-4-20250514';
  return CLAUDE_MODELS[input] || input;
}

/* ─── Core Agentic Loop (Claude Agent SDK) ──────────────── */

export async function executeAutonomous(
  goal: string,
  userId: string,
  emit: SSEEmitter,
  options: AutonomousOptions = {},
): Promise<AutonomousExecution> {
  const {
    maxIterations = 25,
    autoApproveRisk = 'low',
    systemPrompt,
    parentExecutionId,
  } = options;

  const model = resolveModel(options.model);
  const executionId = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  const execution: AutonomousExecution = {
    id: executionId,
    userId,
    goal,
    status: 'running',
    steps: [],
    startedAt: new Date().toISOString(),
    totalTokens: 0,
    totalCost: 0,
    model,
    maxIterations,
    parentExecutionId,
  };

  activeExecutions.set(executionId, execution);
  persistExecution(execution).catch(() => {});

  const controller = new AbortController();
  abortControllers.set(executionId, controller);

  const riskLevels: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  const autoApproveThreshold = riskLevels[autoApproveRisk];

  const toolContext: ToolContext = {
    userId,
    executionId,
    agentMemory: new Map(),
  };
  setToolContext(toolContext);

  let fullSystemPrompt = DEFAULT_SYSTEM_PROMPT;
  if (systemPrompt) fullSystemPrompt += `\n\nAdditional instructions:\n${systemPrompt}`;
  if (parentExecutionId) {
    fullSystemPrompt += `\n\nYou are a sub-agent spawned by a parent execution (${parentExecutionId}). Focus exclusively on your assigned goal and return a concise result.`;
  }

  emit('execution_start', { executionId, goal, model, maxIterations });

  /* ─── Approval hook for risky MCP tools ────────────────── */

  const approvalHook: HookCallback = async (input, _toolUseId, _opts): Promise<SyncHookJSONOutput> => {
    const toolName: string = (input as any)?.tool_name || '';

    const toolRisk = getToolRisk(toolName);
    const toolRiskLevel = riskLevels[toolRisk];

    if (toolRiskLevel <= autoApproveThreshold) return {};

    const toolArgs = (input as any)?.tool_input || {};
    const step: ExecutionStep = {
      id: `step-${Date.now()}-approve`,
      type: 'approval_required',
      timestamp: new Date().toISOString(),
      toolName,
      toolArgs,
      riskLevel: toolRisk,
      content: `Requesting approval to execute ${toolName}`,
    };
    execution.steps.push(step);
    execution.status = 'awaiting_approval';

    emit('approval_required', {
      executionId, step, toolName, toolArgs, riskLevel: toolRisk,
      description: `Execute ${toolName}`,
    });

    const approved = await waitForApproval(executionId, controller.signal);
    execution.status = 'running';

    if (!approved) {
      emit('approval_denied', { executionId, toolName });
      return { decision: 'block', reason: 'User denied this action. Try an alternative approach or ask the user for guidance.' };
    }

    emit('approval_granted', { executionId, toolName });
    return {};
  };

  /* ─── Build allowed tools list ─────────────────────────── */

  const builtInTools = [
    'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
    'Bash', 'Write', 'Edit',
    'Agent', 'AskUserQuestion', 'TodoWrite',
  ];

  /* ─── Configure sub-agents ─────────────────────────────── */

  const agents: Record<string, any> = {
    'research-agent': {
      description: 'Specialized research agent for web search and data gathering.',
      prompt: 'You are a research specialist. Search the web, read pages, and compile findings into a clear summary.',
      tools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
    },
    'email-agent': {
      description: 'Specialized agent for email tasks — reading, searching, drafting, and sending.',
      prompt: 'You are an email specialist. Handle all email-related tasks efficiently.',
      tools: ['Read', 'Grep'],
    },
  };

  try {
    const agentStream = query({
      prompt: goal,
      options: {
        model,
        systemPrompt: fullSystemPrompt,
        allowedTools: builtInTools,
        maxTurns: maxIterations,
        maxBudgetUsd: 5.00,
        effort: 'high',
        permissionMode: 'default',
        agents,
        abortController: controller,

        mcpServers: {
          'operon-tools': createOperonMcpServer(),
        },

        hooks: {
          PreToolUse: [
            { matcher: 'gmail_*|slack_*|http_*|browser_*|run_code|google_*|create_workflow', hooks: [approvalHook] },
          ],
          PostToolUse: [
            {
              matcher: '*',
              hooks: [async (input, _toolUseId, _opts): Promise<SyncHookJSONOutput> => {
                const toolName = (input as any)?.tool_name || 'unknown';
                const step: ExecutionStep = {
                  id: `step-${Date.now()}-tool`,
                  type: 'tool_call',
                  timestamp: new Date().toISOString(),
                  toolName,
                  toolArgs: (input as any)?.tool_input,
                  toolResult: truncateResult((input as any)?.tool_response),
                };
                execution.steps.push(step);
                emit('tool_complete', { executionId, step });
                return {};
              }],
            },
          ],
        },
      },
    });

    /* ─── Stream messages from the Claude Agent SDK ────────── */

    for await (const message of agentStream) {
      if (controller.signal.aborted) {
        execution.status = 'cancelled';
        execution.error = 'Cancelled by user';
        emit('execution_cancelled', { executionId });
        break;
      }

      switch (message.type) {
        case 'system': {
          if ((message as any).subtype === 'init') {
            execution.sessionId = (message as any).session_id;
          }
          break;
        }

        case 'assistant': {
          const content = extractTextContent((message as any).message?.content);
          if (content) {
            const step: ExecutionStep = {
              id: `step-${Date.now()}-think`,
              type: 'thinking',
              timestamp: new Date().toISOString(),
              content,
            };
            execution.steps.push(step);
            emit('step_thinking', { executionId, step });
          }

          const toolCalls = extractToolCalls((message as any).message?.content);
          for (const tc of toolCalls) {
            emit('tool_start', { executionId, toolName: tc.name, toolArgs: tc.input });
          }
          break;
        }

        case 'result': {
          const resultMsg = message as any;
          const resultText = resultMsg.result || '';
          execution.totalCost = resultMsg.total_cost_usd || 0;
          execution.totalTokens = resultMsg.usage?.input_tokens
            ? resultMsg.usage.input_tokens + (resultMsg.usage.output_tokens || 0)
            : 0;
          execution.sessionId = resultMsg.session_id;

          if (resultMsg.subtype === 'success') {
            execution.status = 'completed';
            execution.result = resultText;

            const doneStep: ExecutionStep = {
              id: `step-${Date.now()}-done`,
              type: 'done',
              timestamp: new Date().toISOString(),
              content: resultText,
            };
            execution.steps.push(doneStep);
            emit('step_done', { executionId, step: doneStep, result: resultText });
          } else if (resultMsg.subtype === 'error_max_turns') {
            execution.status = 'completed';
            execution.result = `Reached maximum turns (${maxIterations}). The task may be partially complete.`;
            emit('max_iterations', { executionId, iterations: maxIterations });
          } else if (resultMsg.subtype === 'error_max_budget_usd') {
            execution.status = 'completed';
            execution.result = 'Reached budget limit. The task may be partially complete.';
            emit('max_iterations', { executionId, iterations: maxIterations });
          } else {
            execution.status = 'failed';
            execution.error = resultMsg.subtype || 'Unknown error';
            emit('execution_error', { executionId, error: execution.error });
          }
          break;
        }

        default:
          break;
      }
    }

  } catch (err: any) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      execution.status = 'cancelled';
      execution.error = 'Cancelled by user';
      emit('execution_cancelled', { executionId });
    } else {
      execution.status = 'failed';
      execution.error = err.message;
      emit('execution_error', { executionId, error: err.message });
      logger.error(`[AutonomousExecutor] Fatal error in execution ${executionId}:`, err);
    }
  } finally {
    execution.completedAt = new Date().toISOString();
    emit('execution_complete', {
      executionId,
      status: execution.status,
      result: execution.result,
      error: execution.error,
      totalTokens: execution.totalTokens,
      totalCost: execution.totalCost,
      stepCount: execution.steps.length,
    });
    abortControllers.delete(executionId);
    persistExecution(execution).catch(() => {});
  }

  return execution;
}

/* ─── Message Content Extraction ─────────────────────────── */

function extractTextContent(content: any[]): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');
}

function extractToolCalls(content: any[]): Array<{ name: string; input: any }> {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block: any) => block.type === 'tool_use')
    .map((block: any) => ({ name: block.name, input: block.input }));
}

/* ─── Approval / User Message Waiting ───────────────────── */

function waitForApproval(executionId: string, signal: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) { resolve(false); return; }
    approvalResolvers.set(executionId, resolve);
    const onAbort = () => { approvalResolvers.delete(executionId); resolve(false); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function waitForUserMessage(executionId: string, signal: AbortSignal): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    if (signal.aborted) { resolve(null); return; }
    userMessageResolvers.set(executionId, (msg: string) => resolve(msg));
    const onAbort = () => { userMessageResolvers.delete(executionId); resolve(null); };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/* ─── Public API ────────────────────────────────────────── */

export function resolveApproval(executionId: string, approved: boolean): boolean {
  const resolver = approvalResolvers.get(executionId);
  if (resolver) {
    resolver(approved);
    approvalResolvers.delete(executionId);
    return true;
  }
  return false;
}

export function sendUserMessage(executionId: string, message: string): boolean {
  const resolver = userMessageResolvers.get(executionId);
  if (resolver) {
    resolver(message);
    userMessageResolvers.delete(executionId);
    return true;
  }
  return false;
}

export function cancelExecution(executionId: string): boolean {
  const controller = abortControllers.get(executionId);
  if (controller) {
    controller.abort();
    return true;
  }
  return false;
}

export function getExecution(executionId: string): AutonomousExecution | undefined {
  return activeExecutions.get(executionId);
}

export function getActiveExecutions(userId?: string): AutonomousExecution[] {
  const all = Array.from(activeExecutions.values());
  return userId ? all.filter(e => e.userId === userId) : all;
}

/* ─── Sub-Agent Spawning ───────────────────────────────── */

const MAX_SPAWN_DEPTH = 3;

function getExecutionDepth(executionId: string): number {
  let depth = 0;
  let current = activeExecutions.get(executionId);
  while (current?.parentExecutionId) {
    depth++;
    current = activeExecutions.get(current.parentExecutionId);
  }
  return depth;
}

export async function spawnSubAgent(
  parentExecutionId: string,
  goal: string,
  userId: string,
  options: AutonomousOptions = {},
): Promise<{ success: boolean; result?: string; error?: string; executionId?: string }> {
  const depth = getExecutionDepth(parentExecutionId);
  if (depth >= MAX_SPAWN_DEPTH) {
    return { success: false, error: `Maximum sub-agent nesting depth (${MAX_SPAWN_DEPTH}) reached` };
  }

  const subResults: string[] = [];
  const collectEmit: SSEEmitter = (event, data) => {
    if (event === 'step_done' && data.result) {
      subResults.push(data.result);
    }
  };

  try {
    const execution = await executeAutonomous(goal, userId, collectEmit, {
      ...options,
      parentExecutionId,
      maxIterations: options.maxIterations || 15,
    });

    return {
      success: execution.status === 'completed',
      result: execution.result || subResults.join('\n') || 'Sub-agent completed without explicit result',
      executionId: execution.id,
      error: execution.error,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ─── Persistence ───────────────────────────────────────── */

async function persistExecution(execution: AutonomousExecution): Promise<void> {
  try {
    const db = await getFirestoreDb();
    if (!db) return;

    const stepsSummary = execution.steps.map(s => ({
      id: s.id, type: s.type, timestamp: s.timestamp,
      toolName: s.toolName, content: s.content?.substring(0, 500),
      durationMs: s.durationMs, error: s.error,
    }));

    await db.collection(EXECUTIONS_COLLECTION).doc(execution.id).set({
      id: execution.id, userId: execution.userId, goal: execution.goal,
      status: execution.status, result: execution.result?.substring(0, 5000),
      error: execution.error, startedAt: execution.startedAt,
      completedAt: execution.completedAt || null,
      totalTokens: execution.totalTokens, totalCost: execution.totalCost,
      model: execution.model, maxIterations: execution.maxIterations,
      parentExecutionId: execution.parentExecutionId || null,
      sessionId: execution.sessionId || null,
      stepCount: execution.steps.length, steps: stepsSummary,
    }, { merge: true });
  } catch (err: any) {
    logger.warn(`[AutonomousExecutor] Failed to persist execution ${execution.id}: ${err.message}`);
  }
}

export async function getExecutionHistory(userId: string, limit = 20): Promise<any[]> {
  const db = await getFirestoreDb();
  if (!db) {
    return Array.from(activeExecutions.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit)
      .map(e => ({
        id: e.id, goal: e.goal, status: e.status, model: e.model,
        stepCount: e.steps.length, totalTokens: e.totalTokens, totalCost: e.totalCost,
        startedAt: e.startedAt, completedAt: e.completedAt, result: e.result?.substring(0, 200),
      }));
  }

  const snapshot = await db.collection(EXECUTIONS_COLLECTION)
    .where('userId', '==', userId)
    .orderBy('startedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      id: d.id, goal: d.goal, status: d.status, model: d.model,
      stepCount: d.stepCount, totalTokens: d.totalTokens, totalCost: d.totalCost,
      startedAt: d.startedAt, completedAt: d.completedAt, result: d.result?.substring(0, 200),
    };
  });
}

export async function getExecutionById(executionId: string): Promise<any | null> {
  const active = activeExecutions.get(executionId);
  if (active) return active;

  const db = await getFirestoreDb();
  if (!db) return null;

  const doc = await db.collection(EXECUTIONS_COLLECTION).doc(executionId).get();
  return doc.exists ? doc.data() : null;
}

/* ─── Helpers ───────────────────────────────────────────── */

function truncateResult(result: any): any {
  try {
    const str = JSON.stringify(result);
    if (str.length > 3000) {
      return { _truncated: true, _size: str.length, preview: str.substring(0, 2000) + '...' };
    }
    return result;
  } catch {
    return { _type: typeof result, _error: 'Could not serialize result' };
  }
}
