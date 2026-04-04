/* ═══════════════════════════════════════════════════════════
   Memory System — Context Builder
   
   Generates relevant context to inject into new agent sessions.
   Adapted from claude-mem's ContextBuilder.ts — the core idea:
   
   1. Fetch recent observations + summaries for this user/project
   2. Build a chronological timeline
   3. Render it as a structured text block
   4. Track approximate token count for cost awareness
   
   This gives agents "memory" of what happened in prior sessions.
   ═══════════════════════════════════════════════════════════ */

import { MemoryDatabase } from './database.js';
import { logger } from '../logger.js';
import type {
  ContextOutput,
  MemoryObservation,
  MemorySummary,
  MemoryConfig,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG as defaultConfig } from './types.js';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderObservationCompact(obs: MemoryObservation): string {
  const time = new Date(obs.createdAtEpoch).toLocaleString();
  const parts = [`[${obs.type.toUpperCase()}] ${obs.title}`];
  if (obs.subtitle) parts.push(`  ${obs.subtitle}`);
  if (obs.narrative) parts.push(`  ${obs.narrative}`);
  if (obs.facts.length > 0) parts.push(`  Facts: ${obs.facts.join('; ')}`);
  if (obs.concepts.length > 0) parts.push(`  Concepts: ${obs.concepts.join(', ')}`);
  if (obs.toolName) parts.push(`  Tool: ${obs.toolName}`);
  parts.push(`  @ ${time}`);
  return parts.join('\n');
}

function renderSummaryCompact(summary: MemorySummary): string {
  const time = new Date(summary.createdAtEpoch).toLocaleString();
  const parts = [`── Session Summary (${time}) ──`];
  if (summary.request) parts.push(`  Request: ${summary.request}`);
  if (summary.investigated) parts.push(`  Investigated: ${summary.investigated}`);
  if (summary.learned) parts.push(`  Learned: ${summary.learned}`);
  if (summary.completed) parts.push(`  Completed: ${summary.completed}`);
  if (summary.nextSteps) parts.push(`  Next Steps: ${summary.nextSteps}`);
  if (summary.notes) parts.push(`  Notes: ${summary.notes}`);
  return parts.join('\n');
}

export const MemoryContextBuilder = {
  /**
   * Generate context for a new agent session.
   * 
   * Returns structured context with recent observations and summaries,
   * formatted as a text block that can be prepended to agent prompts.
   */
  async generate(
    userId: string,
    options: {
      project?: string;
      agentType?: string;
      maxObservations?: number;
      maxSummaries?: number;
      query?: string;
    } = {}
  ): Promise<ContextOutput> {
    const maxObs = options.maxObservations || defaultConfig.maxObservationsPerContext;
    const maxSum = options.maxSummaries || defaultConfig.maxSummariesPerContext;

    let observations: MemoryObservation[];

    if (options.query) {
      observations = await MemoryDatabase.searchObservations(userId, options.query, {
        project: options.project,
        limit: maxObs,
      });
    } else {
      observations = await MemoryDatabase.getObservationsByUser(userId, {
        project: options.project,
        limit: maxObs,
      });
    }

    const summaries = await MemoryDatabase.getSummariesByUser(userId, maxSum);
    const stats = await MemoryDatabase.getStats(userId);

    if (observations.length === 0 && summaries.length === 0) {
      return {
        recentObservations: [],
        recentSummaries: [],
        relevantContext: '',
        tokenEstimate: 0,
        sessionCount: stats.totalSessions,
        observationCount: stats.totalObservations,
      };
    }

    const contextParts: string[] = [];

    contextParts.push('═══ MEMORY CONTEXT ═══');
    contextParts.push(
      `Sessions: ${stats.totalSessions} | Observations: ${stats.totalObservations} | Summaries: ${stats.totalSummaries}`
    );
    if (options.project) {
      contextParts.push(`Project: ${options.project}`);
    }
    contextParts.push('');

    if (summaries.length > 0) {
      contextParts.push('── Recent Session Summaries ──');
      for (const summary of summaries) {
        contextParts.push(renderSummaryCompact(summary));
        contextParts.push('');
      }
    }

    if (observations.length > 0) {
      contextParts.push('── Recent Observations ──');
      for (const obs of observations.slice().reverse()) {
        contextParts.push(renderObservationCompact(obs));
        contextParts.push('');
      }
    }

    contextParts.push('═══ END MEMORY CONTEXT ═══');

    const relevantContext = contextParts.join('\n');

    return {
      recentObservations: observations,
      recentSummaries: summaries,
      relevantContext,
      tokenEstimate: estimateTokens(relevantContext),
      sessionCount: stats.totalSessions,
      observationCount: stats.totalObservations,
    };
  },

  /**
   * Generate a concise context string suitable for injecting into system prompts.
   * Uses progressive disclosure: summaries first, then only recent observations.
   */
  async generatePromptContext(
    userId: string,
    project?: string,
    maxTokens = 2000
  ): Promise<string> {
    const summaries = await MemoryDatabase.getSummariesByUser(userId, 3);
    const observations = await MemoryDatabase.getObservationsByUser(userId, {
      project,
      limit: 15,
    });

    if (summaries.length === 0 && observations.length === 0) {
      return '';
    }

    const parts: string[] = [];
    parts.push('<memory_context>');

    for (const summary of summaries) {
      const rendered = renderSummaryCompact(summary);
      if (estimateTokens(parts.join('\n') + rendered) > maxTokens) break;
      parts.push(rendered);
    }

    for (const obs of observations.slice().reverse()) {
      const rendered = renderObservationCompact(obs);
      if (estimateTokens(parts.join('\n') + rendered) > maxTokens) break;
      parts.push(rendered);
    }

    parts.push('</memory_context>');
    return parts.join('\n');
  },
};
