/* ═══════════════════════════════════════════════════════════
   Autonomous Executor — Claude-Code-style agentic loop

   Given a goal and a set of tools, the LLM iteratively decides
   the next action (via OpenAI function calling), executes it,
   observes the result, and repeats until the goal is achieved
   or a limit is reached.

   Key features:
   - OpenAI function-calling for tool selection
   - SSE streaming for real-time progress
   - Approval gating for high-risk tools
   - Context window management with summarization
   - Sub-agent spawning for parallel work
   - Cancellation via AbortController
   - Cost tracking per step
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { config } from '../config.js';
import { ToolRegistry, defaultRegistry, type ToolContext, type RiskLevel } from './toolRegistry.js';
import { logger } from './logger.js';

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

/* ─── Cost per 1K tokens (approximate, GPT-4o pricing) ─── */

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o':       { input: 0.0025, output: 0.01 },
  'gpt-4o-mini':  { input: 0.00015, output: 0.0006 },
  'gpt-4':        { input: 0.03, output: 0.06 },
  'gpt-4-turbo':  { input: 0.01, output: 0.03 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = COST_PER_1K[model] || COST_PER_1K['gpt-4o'];
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

/* ─── System Prompt ─────────────────────────────────────── */

const DEFAULT_SYSTEM_PROMPT = `You are an autonomous AI agent built into OperonAI. Your job is to accomplish the user's goal by using the tools available to you.

RULES:
1. Break complex goals into smaller steps and execute them one at a time.
2. After each tool call, analyze the result and decide your next action.
3. If you need information you don't have, use the appropriate tool to get it (read emails, make HTTP requests, browse the web, etc.).
4. If something fails, try an alternative approach before giving up.
5. When you're done, provide a clear summary of what you accomplished.
6. If you need clarification from the user, use the ask_user tool.
7. Be concise in your reasoning. Focus on action, not explanation.
8. Never fabricate data — always use tools to get real information.
9. For potentially destructive actions (sending emails, posting messages), confirm the content is correct before executing.

You have access to: Gmail, Slack, HTTP requests, AI analysis, browser navigation, code execution, persistent memory, and Google Workspace (Drive, Calendar, Sheets, Docs, Chat, Admin, Tasks, and all other Workspace APIs via the gws CLI).

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

/* ─── OpenAI Client ─────────────────────────────────────── */

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/* ─── Context Summarization ─────────────────────────────── */

const MAX_MESSAGES_BEFORE_SUMMARIZE = 40;
const SUMMARIZE_KEEP_RECENT = 10;

async function summarizeContext(messages: ChatCompletionMessageParam[], model: string): Promise<ChatCompletionMessageParam[]> {
  if (messages.length <= MAX_MESSAGES_BEFORE_SUMMARIZE) return messages;

  const openai = getOpenAI();
  const systemMsg = messages[0];
  const toSummarize = messages.slice(1, messages.length - SUMMARIZE_KEEP_RECENT);
  const recent = messages.slice(messages.length - SUMMARIZE_KEEP_RECENT);

  const summaryContent = toSummarize
    .map(m => {
      if (m.role === 'assistant' && 'content' in m && m.content) return `Assistant: ${String(m.content).substring(0, 200)}`;
      if (m.role === 'tool' && 'content' in m) return `Tool result: ${String(m.content).substring(0, 200)}`;
      if (m.role === 'user' && 'content' in m) return `User: ${String(m.content).substring(0, 200)}`;
      return '';
    })
    .filter(Boolean)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Summarize the following conversation history concisely, preserving key facts, decisions, and results. Focus on what was accomplished and what information was gathered.' },
        { role: 'user', content: summaryContent },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const summary = response.choices[0]?.message?.content || 'Previous context summarized.';
    return [
      systemMsg,
      { role: 'user' as const, content: `[Previous conversation summary: ${summary}]` },
      ...recent,
    ];
  } catch {
    return [systemMsg, ...recent];
  }
}

/* ─── Core Agentic Loop ─────────────────────────────────── */

export async function executeAutonomous(
  goal: string,
  userId: string,
  emit: SSEEmitter,
  options: AutonomousOptions = {},
): Promise<AutonomousExecution> {
  const {
    model = 'gpt-4o',
    maxIterations = 25,
    autoApproveRisk = 'low',
    tools: toolNames,
    systemPrompt,
    parentExecutionId,
  } = options;

  const executionId = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  const registry = defaultRegistry;
  const openai = getOpenAI();
  const openaiTools: ChatCompletionTool[] = registry.toOpenAITools(toolNames);

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
  const controller = new AbortController();
  abortControllers.set(executionId, controller);

  const riskLevels: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  const autoApproveThreshold = riskLevels[autoApproveRisk];

  const toolContext: ToolContext = {
    userId,
    executionId,
    agentMemory: new Map(),
  };

  const fullSystemPrompt = systemPrompt
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nAdditional instructions:\n${systemPrompt}`
    : DEFAULT_SYSTEM_PROMPT;

  let messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: fullSystemPrompt },
    { role: 'user', content: goal },
  ];

  emit('execution_start', { executionId, goal, model, maxIterations });

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      if (controller.signal.aborted) {
        execution.status = 'cancelled';
        execution.error = 'Cancelled by user';
        emit('execution_cancelled', { executionId });
        break;
      }

      messages = await summarizeContext(messages, model);

      const stepStart = Date.now();
      emit('thinking', { executionId, iteration, message: `Reasoning (step ${iteration + 1})...` });

      let response;
      try {
        response = await openai.chat.completions.create({
          model,
          messages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
          temperature: 0.5,
          max_tokens: 4096,
        });
      } catch (err: any) {
        const errorStep: ExecutionStep = {
          id: `step-${Date.now()}`,
          type: 'error',
          timestamp: new Date().toISOString(),
          error: `OpenAI API error: ${err.message}`,
          durationMs: Date.now() - stepStart,
        };
        execution.steps.push(errorStep);
        emit('step_error', { executionId, step: errorStep });
        execution.status = 'failed';
        execution.error = err.message;
        break;
      }

      const choice = response.choices[0];
      const usage = response.usage;
      if (usage) {
        execution.totalTokens += usage.total_tokens;
        execution.totalCost += estimateCost(model, usage.prompt_tokens, usage.completion_tokens);
      }

      const tokenUsage = usage ? {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      } : undefined;

      // If the model returns text content (no tool calls) — the agent is done or communicating
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
        const content = choice.message.content || '';
        messages.push({ role: 'assistant', content });

        const doneStep: ExecutionStep = {
          id: `step-${Date.now()}`,
          type: 'done',
          timestamp: new Date().toISOString(),
          content,
          tokenUsage,
          durationMs: Date.now() - stepStart,
        };
        execution.steps.push(doneStep);
        execution.result = content;
        execution.status = 'completed';
        emit('step_done', { executionId, step: doneStep, result: content });
        break;
      }

      // Process tool calls
      const assistantMessage: ChatCompletionMessageParam = {
        role: 'assistant',
        content: choice.message.content || null,
        tool_calls: choice.message.tool_calls,
      };
      messages.push(assistantMessage);

      if (choice.message.content) {
        const thinkingStep: ExecutionStep = {
          id: `step-${Date.now()}-think`,
          type: 'thinking',
          timestamp: new Date().toISOString(),
          content: choice.message.content,
          tokenUsage,
          durationMs: Date.now() - stepStart,
        };
        execution.steps.push(thinkingStep);
        emit('step_thinking', { executionId, step: thinkingStep });
      }

      for (const toolCall of choice.message.tool_calls) {
        if (controller.signal.aborted) break;

        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const tool = registry.get(toolName);

        if (!tool) {
          const errResult = JSON.stringify({ error: `Unknown tool: ${toolName}` });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: errResult });
          continue;
        }

        // Handle ask_user specially — pause and wait for user response
        if (toolName === 'ask_user') {
          const askStep: ExecutionStep = {
            id: `step-${Date.now()}-ask`,
            type: 'ask_user',
            timestamp: new Date().toISOString(),
            toolName,
            toolArgs,
            content: toolArgs.question,
          };
          execution.steps.push(askStep);
          execution.status = 'awaiting_user';
          emit('awaiting_user', { executionId, step: askStep, question: toolArgs.question });

          const userResponse = await waitForUserMessage(executionId, controller.signal);
          if (userResponse === null) {
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ cancelled: true }) });
            continue;
          }

          execution.status = 'running';
          const responseStep: ExecutionStep = {
            id: `step-${Date.now()}-user`,
            type: 'user_message',
            timestamp: new Date().toISOString(),
            content: userResponse,
          };
          execution.steps.push(responseStep);
          emit('user_response', { executionId, step: responseStep });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ userResponse }) });
          continue;
        }

        // Check approval for high-risk tools
        const toolRisk = riskLevels[tool.riskLevel];
        if (toolRisk > autoApproveThreshold) {
          const approvalStep: ExecutionStep = {
            id: `step-${Date.now()}-approve`,
            type: 'approval_required',
            timestamp: new Date().toISOString(),
            toolName,
            toolArgs,
            riskLevel: tool.riskLevel,
            content: `Requesting approval to execute ${toolName}`,
          };
          execution.steps.push(approvalStep);
          execution.status = 'awaiting_approval';
          emit('approval_required', {
            executionId,
            step: approvalStep,
            toolName,
            toolArgs,
            riskLevel: tool.riskLevel,
            description: tool.description,
          });

          const approved = await waitForApproval(executionId, controller.signal);
          execution.status = 'running';

          if (!approved) {
            const deniedResult = JSON.stringify({ denied: true, message: 'User denied this action. Try an alternative approach or ask the user for guidance.' });
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: deniedResult });
            emit('approval_denied', { executionId, toolName });
            continue;
          }
          emit('approval_granted', { executionId, toolName });
        }

        // Execute the tool
        const toolStart = Date.now();
        emit('tool_start', { executionId, toolName, toolArgs });

        let toolResult: any;
        try {
          toolResult = await tool.execute(toolArgs, toolContext);
        } catch (err: any) {
          toolResult = { error: err.message };
        }

        const toolStep: ExecutionStep = {
          id: `step-${Date.now()}-tool`,
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          toolName,
          toolArgs,
          toolResult: truncateResult(toolResult),
          durationMs: Date.now() - toolStart,
        };
        execution.steps.push(toolStep);
        emit('tool_complete', { executionId, step: toolStep });

        const resultStr = JSON.stringify(toolResult);
        const truncated = resultStr.length > 8000 ? resultStr.substring(0, 8000) + '...[truncated]' : resultStr;
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: truncated });
      }

      // If we've hit the last iteration, mark as completed with a note
      if (iteration === maxIterations - 1) {
        execution.status = 'completed';
        execution.result = 'Reached maximum iterations. The task may be partially complete — review the steps above.';
        emit('max_iterations', { executionId, iterations: maxIterations });
      }
    }
  } catch (err: any) {
    execution.status = 'failed';
    execution.error = err.message;
    emit('execution_error', { executionId, error: err.message });
    logger.error(`[AutonomousExecutor] Fatal error in execution ${executionId}:`, err);
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
  }

  return execution;
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
