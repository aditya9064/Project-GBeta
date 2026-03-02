/* ═══════════════════════════════════════════════════════════
   Operon Service — Manager / Twin Agent Core

   Handles user queries for Operon, the per-user manager agent
   that orchestrates agents, navigates the app, and executes
   actions with a confirmation flow.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../config.js';
import { logger, Metrics } from './logger.js';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  return openaiClient;
}

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

export interface OperonQueryInput {
  userId?: string;
  sessionId?: string;
  message: string;
  context?: any;
}

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

const OPERON_LOG_LIMIT = 50;
const operonLogsByUser = new Map<string, OperonQueryResult[]>();

const conversationsByUser = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
const MAX_HISTORY = 10;

function addLog(entry: OperonQueryResult): void {
  const existing = operonLogsByUser.get(entry.userId) || [];
  existing.unshift(entry);
  if (existing.length > OPERON_LOG_LIMIT) existing.length = OPERON_LOG_LIMIT;
  operonLogsByUser.set(entry.userId, existing);
}

function addToConversation(userId: string, role: 'user' | 'assistant', content: string): void {
  const history = conversationsByUser.get(userId) || [];
  history.push({ role, content });
  if (history.length > MAX_HISTORY * 2) history.splice(0, 2);
  conversationsByUser.set(userId, history);
}

function getConversationHistory(userId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  return conversationsByUser.get(userId) || [];
}

const SYSTEM_PROMPT = `You are Operon, a voice-first AI assistant that EXECUTES actions. You ACT, not plan.

CRITICAL: Respond with ONLY raw JSON. No markdown, no text outside JSON.

ACTIONS (put in "actions" array):
- navigate: {"type":"navigate","params":{"tab":"agents|comms|docai|sales|workflow|logs|workforce|monitoring|marketplace"},"requiresConfirmation":false}
- create_agent: {"type":"create_agent","params":{"prompt":"full task description"},"requiresConfirmation":true}
- run_agent: {"type":"run_agent","params":{"agentName":"name"},"requiresConfirmation":false}
- pause_agent: {"type":"pause_agent","params":{"agentName":"name"},"requiresConfirmation":false}
- resume_agent: {"type":"resume_agent","params":{"agentName":"name"},"requiresConfirmation":false}
- delete_agent: {"type":"delete_agent","params":{"agentName":"name"},"requiresConfirmation":true}
- open_catalog: {"type":"open_catalog","params":{},"requiresConfirmation":false}
- ask_clarification: {"type":"ask_clarification","params":{"question":"short question","options":["Option A","Option B","Option C"]},"requiresConfirmation":false}

FORMAT: {"reply":"1 short sentence","actions":[...]}

RULES:
1. "create/build/make an agent that..." → IMMEDIATELY use create_agent. Pass the FULL user request as the prompt. Do NOT break it into steps.
2. "reply" = 1 sentence max. Spoken aloud.
3. create_agent, delete_agent → requiresConfirmation:true.
4. navigate, open_catalog, run_agent → requiresConfirmation:false (auto-execute).
5. User says "yes/do it/go ahead" → execute pending action with requiresConfirmation:false.
6. User says "no/cancel" → empty actions, acknowledge.
7. ONLY use ask_clarification when the request is genuinely ambiguous (e.g. "do something" with no detail). Always provide 3-5 concrete options in the options array. Last option should always be "Other...".
8. NEVER ask clarification when the user gives a clear task. "Create an agent that goes to amazon and adds jump rope to cart" is clear — just do it.
9. NEVER write numbered lists, plans, or step-by-step explanations. Ever.
10. NEVER ask "what would you like to do?" or list capabilities. Just act on what the user said.`;

function parseOperonResponse(raw: string): { reply: string; actions: any[] } {
  const cleaned = raw.trim();

  // Strategy 1: Direct JSON parse
  if (cleaned.startsWith('{')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.reply !== undefined) {
        return { reply: parsed.reply, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
      }
    } catch { /* continue */ }
  }

  // Strategy 2: Extract from code fence
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (parsed.reply !== undefined) {
        return { reply: parsed.reply, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
      }
    } catch { /* continue */ }
  }

  // Strategy 3: Find JSON object anywhere in the text
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
      if (parsed.reply !== undefined) {
        return { reply: parsed.reply, actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
      }
    } catch { /* continue */ }
  }

  // Strategy 4: Model returned plain text — treat as reply with no actions
  return { reply: raw, actions: [] };
}

function deriveRiskLevel(actions: any[]): { riskLevel: OperonRiskLevel; requiresConfirmation: boolean } {
  if (actions.length === 0) return { riskLevel: 'read_only', requiresConfirmation: false };

  const hasHighRisk = actions.some((a: any) =>
    ['delete_agent'].includes(a.type) || a.requiresConfirmation === true
  );
  const hasChange = actions.some((a: any) =>
    ['create_agent', 'run_agent', 'pause_agent', 'resume_agent'].includes(a.type)
  );

  if (hasHighRisk) return { riskLevel: 'high_risk', requiresConfirmation: true };
  if (hasChange) return { riskLevel: 'low_risk_change', requiresConfirmation: actions.some((a: any) => a.requiresConfirmation) };
  return { riskLevel: 'read_only', requiresConfirmation: false };
}

export const OperonService = {
  async handleQuery(input: OperonQueryInput): Promise<OperonQueryResult> {
    const userId = input.userId || 'anonymous';
    const sessionId = input.sessionId;
    const message = input.message?.trim();

    if (!message) throw new Error('Message is required');

    const startTimer = Metrics.startTimer('operon.query.duration_ms', { userId });

    try {
      logger.info('Operon: handling query', { userId, sessionId });

      addToConversation(userId, 'user', message);

      const contextBlock = input.context
        ? `\n\nCurrent app state:\n${JSON.stringify(input.context, null, 2)}`
        : '';

      const history = getConversationHistory(userId);
      const conversationBlock = history.slice(0, -1).map(m =>
        `${m.role === 'user' ? 'User' : 'Operon'}: ${m.content}`
      ).join('\n');

      const prompt = [
        conversationBlock ? `Recent conversation:\n${conversationBlock}\n` : '',
        `User: ${message}`,
        contextBlock,
        '',
        'Reply with ONLY a raw JSON object: {"reply":"...","actions":[...]}',
      ].filter(Boolean).join('\n');

      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const usage = completion.usage;

      const aiResult = {
        response: responseText,
        model: 'gpt-4o',
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
      };

      const { reply, actions: rawActions } = parseOperonResponse(aiResult.response);

      const actions: OperonAction[] = rawActions.map((a: any, i: number) => ({
        id: `action-${Date.now()}-${i}`,
        type: a.type || 'explanation',
        description: a.description || reply,
        params: a.params || {},
        status: a.requiresConfirmation ? 'awaiting_confirmation' as const : 'planned' as const,
        riskLevel: a.requiresConfirmation ? 'high_risk' as const : 'read_only' as const,
      }));

      const { riskLevel, requiresConfirmation } = deriveRiskLevel(rawActions);

      addToConversation(userId, 'assistant', reply);

      const entry: OperonQueryResult = {
        id: `operon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        sessionId,
        message,
        reply,
        actions,
        riskLevel,
        requiresConfirmation,
        model: aiResult.model,
        usage: aiResult.usage,
        timestamp: new Date().toISOString(),
      };

      addLog(entry);

      logger.info('Operon: query handled', {
        userId,
        riskLevel,
        actionCount: actions.length,
        actionTypes: actions.map(a => a.type),
      });

      return entry;
    } catch (err) {
      logger.error('Operon query failed', { userId, sessionId, error: err });
      throw err;
    } finally {
      startTimer();
    }
  },

  getLogsForUser(userId: string, limit = OPERON_LOG_LIMIT): OperonQueryResult[] {
    const effectiveUserId = userId || 'anonymous';
    const logs = operonLogsByUser.get(effectiveUserId) || [];
    return logs.slice(0, limit);
  },
};
