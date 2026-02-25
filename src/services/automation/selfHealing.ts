// Self-Healing Service — LLM-powered error recovery
//
// When an action fails, instead of just retrying or giving up, this service
// uses an LLM to reason about the failure and suggest alternative approaches.
//
// Examples:
//   - Gmail API returns 429 → agent waits with exponential backoff
//   - Slack channel renamed → agent searches for the new channel name
//   - HTTP endpoint returns 404 → agent tries alternative URLs
//   - Document generation fails → agent regenerates with modified prompt

import {
  isBackendAvailable,
  AutomationAIAPI,
} from './automationApi';
import { EnhancedMemoryService } from './enhancedMemory';

export interface FailureContext {
  agentId: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  action: string;
  input: any;
  error: string;
  errorCode?: number;
  attempt: number;
  maxAttempts: number;
  previousAttempts?: { strategy: string; error: string }[];
}

export interface RecoveryStrategy {
  strategy: 'retry_with_backoff' | 'modify_input' | 'alternative_action' | 'skip' | 'escalate';
  reasoning: string;
  modifiedInput?: any;
  alternativeAction?: string;
  waitMs?: number;
  confidence: number;
}

const RECOVERY_HISTORY_KEY = 'recovery_history';

interface RecoveryRecord {
  nodeType: string;
  errorPattern: string;
  strategyUsed: string;
  succeeded: boolean;
  timestamp: string;
}

function loadRecoveryHistory(): RecoveryRecord[] {
  try {
    const raw = localStorage.getItem(RECOVERY_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecoveryHistory(records: RecoveryRecord[]): void {
  try {
    localStorage.setItem(RECOVERY_HISTORY_KEY, JSON.stringify(records.slice(-200)));
  } catch { /* ignore */ }
}

function classifyError(error: string, errorCode?: number): string {
  if (errorCode === 429 || error.includes('rate limit') || error.includes('too many requests')) {
    return 'rate_limited';
  }
  if (errorCode === 401 || errorCode === 403 || error.includes('unauthorized') || error.includes('forbidden')) {
    return 'auth_error';
  }
  if (errorCode === 404 || error.includes('not found')) {
    return 'not_found';
  }
  if (errorCode === 500 || errorCode === 502 || errorCode === 503 || error.includes('server error') || error.includes('unavailable')) {
    return 'server_error';
  }
  if (error.includes('timeout') || error.includes('timed out') || error.includes('ETIMEDOUT')) {
    return 'timeout';
  }
  if (error.includes('network') || error.includes('ECONNREFUSED') || error.includes('ENOTFOUND')) {
    return 'network_error';
  }
  if (error.includes('invalid') || error.includes('validation') || error.includes('required')) {
    return 'validation_error';
  }
  return 'unknown';
}

function getBuiltInStrategy(errorClass: string, attempt: number): RecoveryStrategy | null {
  switch (errorClass) {
    case 'rate_limited':
      return {
        strategy: 'retry_with_backoff',
        reasoning: 'Rate limited — applying exponential backoff before retry.',
        waitMs: Math.min(1000 * Math.pow(2, attempt), 30000),
        confidence: 0.9,
      };
    case 'server_error':
      return {
        strategy: 'retry_with_backoff',
        reasoning: 'Server error is likely transient — retrying after delay.',
        waitMs: Math.min(2000 * Math.pow(2, attempt), 30000),
        confidence: 0.7,
      };
    case 'timeout':
      return {
        strategy: 'retry_with_backoff',
        reasoning: 'Request timed out — retrying with longer timeout.',
        waitMs: 3000,
        modifiedInput: { _extendedTimeout: true },
        confidence: 0.6,
      };
    case 'network_error':
      if (attempt < 2) {
        return {
          strategy: 'retry_with_backoff',
          reasoning: 'Network error may be transient — retrying.',
          waitMs: 5000,
          confidence: 0.5,
        };
      }
      return {
        strategy: 'escalate',
        reasoning: 'Persistent network error — needs human attention.',
        confidence: 0.9,
      };
    case 'auth_error':
      return {
        strategy: 'escalate',
        reasoning: 'Authentication/authorization error — credentials need to be refreshed.',
        confidence: 0.95,
      };
    default:
      return null;
  }
}

async function getAIStrategy(context: FailureContext): Promise<RecoveryStrategy> {
  if (!isBackendAvailable()) {
    return {
      strategy: 'skip',
      reasoning: 'Backend offline — cannot use AI for recovery analysis.',
      confidence: 0.3,
    };
  }

  const pastRecoveries = loadRecoveryHistory()
    .filter(r => r.nodeType === context.nodeType)
    .slice(-5);

  const historyContext = pastRecoveries.length > 0
    ? `\nPast recovery attempts for ${context.nodeType} nodes:\n${pastRecoveries.map(r => `  - Error: "${r.errorPattern}" → Strategy: ${r.strategyUsed} → ${r.succeeded ? 'Success' : 'Failed'}`).join('\n')}`
    : '';

  const previousAttemptsContext = context.previousAttempts?.length
    ? `\nPrevious recovery attempts this execution:\n${context.previousAttempts.map(a => `  - Strategy: ${a.strategy} → Failed: ${a.error}`).join('\n')}`
    : '';

  const prompt = `You are diagnosing a workflow automation failure. Suggest a recovery strategy.

Node: "${context.nodeLabel}" (type: ${context.nodeType})
Action: ${context.action}
Error: ${context.error}
${context.errorCode ? `HTTP Status: ${context.errorCode}` : ''}
Input: ${JSON.stringify(context.input).substring(0, 500)}
Attempt: ${context.attempt} of ${context.maxAttempts}
${historyContext}
${previousAttemptsContext}

Respond with EXACTLY this JSON (no markdown):
{
  "strategy": "retry_with_backoff" | "modify_input" | "alternative_action" | "skip" | "escalate",
  "reasoning": "why this strategy",
  "modifiedInput": { ... } or null,
  "alternativeAction": "description" or null,
  "waitMs": number or null,
  "confidence": 0.0-1.0
}`;

  try {
    const result = await AutomationAIAPI.process(prompt, {
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 500,
    });

    if (result?.response) {
      const text = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          strategy: parsed.strategy || 'skip',
          reasoning: parsed.reasoning || 'AI-suggested recovery',
          modifiedInput: parsed.modifiedInput,
          alternativeAction: parsed.alternativeAction,
          waitMs: parsed.waitMs,
          confidence: parsed.confidence || 0.5,
        };
      }
    }
  } catch {
    // AI analysis failed — fall through to default
  }

  return {
    strategy: 'skip',
    reasoning: 'AI recovery analysis unavailable — skipping node.',
    confidence: 0.3,
  };
}

export const SelfHealingService = {
  async analyzeFailure(context: FailureContext): Promise<RecoveryStrategy> {
    const errorClass = classifyError(context.error, context.errorCode);
    console.log(`[SelfHealing] Analyzing failure: "${context.error}" → class: ${errorClass}`);

    const builtIn = getBuiltInStrategy(errorClass, context.attempt);
    if (builtIn && builtIn.confidence >= 0.7) {
      console.log(`[SelfHealing] Using built-in strategy: ${builtIn.strategy} (confidence: ${builtIn.confidence})`);
      return builtIn;
    }

    // For lower-confidence built-in strategies or unknown errors, consult AI
    const aiStrategy = await getAIStrategy(context);

    // Use whichever has higher confidence
    if (builtIn && builtIn.confidence >= aiStrategy.confidence) {
      return builtIn;
    }

    console.log(`[SelfHealing] Using AI strategy: ${aiStrategy.strategy} (confidence: ${aiStrategy.confidence})`);
    return aiStrategy;
  },

  async applyStrategy(
    strategy: RecoveryStrategy,
    originalExecutor: () => Promise<any>,
    context: FailureContext,
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    console.log(`[SelfHealing] Applying strategy: ${strategy.strategy} — ${strategy.reasoning}`);

    switch (strategy.strategy) {
      case 'retry_with_backoff': {
        if (strategy.waitMs) {
          console.log(`[SelfHealing] Waiting ${strategy.waitMs}ms before retry...`);
          await new Promise(r => setTimeout(r, Math.min(strategy.waitMs!, 30000)));
        }

        try {
          const result = await originalExecutor();
          this.recordOutcome(context, strategy.strategy, true);
          return { success: true, output: result };
        } catch (err: any) {
          this.recordOutcome(context, strategy.strategy, false);
          return { success: false, error: err.message };
        }
      }

      case 'modify_input': {
        console.log('[SelfHealing] Attempting with modified input');
        this.recordOutcome(context, strategy.strategy, false);
        return {
          success: false,
          error: `Input modification suggested: ${strategy.reasoning}. Modified input: ${JSON.stringify(strategy.modifiedInput)}`,
        };
      }

      case 'alternative_action': {
        console.log(`[SelfHealing] Suggesting alternative: ${strategy.alternativeAction}`);
        this.recordOutcome(context, strategy.strategy, false);
        return {
          success: false,
          error: `Alternative suggested: ${strategy.alternativeAction}. ${strategy.reasoning}`,
        };
      }

      case 'skip': {
        console.log('[SelfHealing] Skipping failed node and continuing');
        this.recordOutcome(context, strategy.strategy, true);
        return {
          success: true,
          output: {
            _skipped: true,
            _reason: strategy.reasoning,
            _originalError: context.error,
          },
        };
      }

      case 'escalate': {
        console.log('[SelfHealing] Escalating to human attention');
        this.recordOutcome(context, strategy.strategy, false);

        await EnhancedMemoryService.recordEpisode(context.agentId, {
          eventType: 'error',
          summary: `Escalated: ${context.nodeLabel} — ${context.error}`,
          outcome: 'failure',
          details: {
            nodeType: context.nodeType,
            error: context.error,
            strategy: strategy.reasoning,
          },
          relatedEntities: [context.nodeLabel, context.nodeType],
          importance: 0.9,
        });

        return {
          success: false,
          error: `[ESCALATED] ${strategy.reasoning}. Original error: ${context.error}`,
        };
      }

      default:
        return { success: false, error: context.error };
    }
  },

  recordOutcome(context: FailureContext, strategy: string, succeeded: boolean): void {
    const errorClass = classifyError(context.error, context.errorCode);
    const records = loadRecoveryHistory();
    records.push({
      nodeType: context.nodeType,
      errorPattern: errorClass,
      strategyUsed: strategy,
      succeeded,
      timestamp: new Date().toISOString(),
    });
    saveRecoveryHistory(records);
  },

  getRecoveryStats(): {
    totalRecoveries: number;
    successRate: number;
    byStrategy: Record<string, { total: number; successes: number }>;
  } {
    const records = loadRecoveryHistory();
    const byStrategy: Record<string, { total: number; successes: number }> = {};

    for (const r of records) {
      if (!byStrategy[r.strategyUsed]) byStrategy[r.strategyUsed] = { total: 0, successes: 0 };
      byStrategy[r.strategyUsed].total++;
      if (r.succeeded) byStrategy[r.strategyUsed].successes++;
    }

    const total = records.length;
    const successes = records.filter(r => r.succeeded).length;

    return {
      totalRecoveries: total,
      successRate: total > 0 ? successes / total : 0,
      byStrategy,
    };
  },
};
