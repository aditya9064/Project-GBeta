/* ═══════════════════════════════════════════════════════════
   Memory System — Main Service (Facade)
   
   High-level API that agents use to interact with the memory
   system. Wraps session, observation, summary, search, and
   context building into a simple interface.
   
   Usage by agents:
     const session = await Memory.startSession({ ... });
     await Memory.observe(session.id, { ... });
     await Memory.endSession(session.id);
     const ctx = await Memory.getContext(userId);
   ═══════════════════════════════════════════════════════════ */

import { MemorySessionStore } from './sessionStore.js';
import { MemoryObservationStore } from './observationStore.js';
import { MemorySummaryStore } from './summaryStore.js';
import { MemorySearchService } from './searchService.js';
import { MemoryContextBuilder } from './contextBuilder.js';
import { logger } from '../logger.js';
import type {
  MemorySession,
  MemoryObservation,
  MemorySummary,
  ObservationInput,
  SummaryInput,
  SearchQuery,
  ContextOutput,
} from './types.js';

export const Memory = {
  // ─── Session Lifecycle ─────────────────────────────────

  async startSession(params: {
    userId: string;
    agentType: string;
    project?: string;
    userPrompt: string;
    title?: string;
    metadata?: Record<string, any>;
    sessionId?: string;
  }): Promise<MemorySession> {
    return MemorySessionStore.create(params);
  },

  async endSession(
    sessionId: string,
    summary?: SummaryInput
  ): Promise<MemorySummary | null> {
    const session = await MemorySessionStore.get(sessionId);
    if (!session) {
      logger.warn(`[Memory] Cannot end session: ${sessionId} not found`);
      return null;
    }

    const observations = await MemoryObservationStore.getBySession(sessionId);
    await MemorySessionStore.complete(sessionId, observations.length);

    if (summary) {
      return MemorySummaryStore.store(
        sessionId,
        session.userId,
        session.project,
        summary
      );
    }

    if (observations.length > 0) {
      const autoSummary = generateAutoSummary(session, observations);
      return MemorySummaryStore.store(
        sessionId,
        session.userId,
        session.project,
        autoSummary
      );
    }

    return null;
  },

  async failSession(sessionId: string): Promise<void> {
    await MemorySessionStore.fail(sessionId);
  },

  // ─── Observation Capture ───────────────────────────────

  async observe(
    sessionId: string,
    userId: string,
    project: string,
    input: ObservationInput,
    promptNumber?: number
  ): Promise<MemoryObservation | null> {
    return MemoryObservationStore.store(
      sessionId,
      userId,
      project,
      input,
      promptNumber
    );
  },

  /**
   * Convenience: capture a tool use as an observation
   */
  async observeToolUse(
    sessionId: string,
    userId: string,
    project: string,
    toolName: string,
    input: Record<string, any>,
    output: string,
    observationType: ObservationInput['type'] = 'action'
  ): Promise<MemoryObservation | null> {
    return this.observe(sessionId, userId, project, {
      type: observationType,
      title: `Used ${toolName}`,
      narrative: typeof output === 'string' ? output.slice(0, 500) : JSON.stringify(output).slice(0, 500),
      toolName,
      toolInput: input,
      toolOutput: output.slice(0, 1000),
    });
  },

  /**
   * Convenience: capture an error as an observation
   */
  async observeError(
    sessionId: string,
    userId: string,
    project: string,
    error: string,
    context?: string
  ): Promise<MemoryObservation | null> {
    return this.observe(sessionId, userId, project, {
      type: 'error',
      title: `Error: ${error.slice(0, 100)}`,
      narrative: context || error,
    });
  },

  // ─── Search & Context ─────────────────────────────────

  async search(query: SearchQuery) {
    return MemorySearchService.search(query);
  },

  async timeline(
    userId: string,
    options: {
      aroundObservationId?: string;
      aroundTimestamp?: number;
      windowMs?: number;
      limit?: number;
    } = {}
  ) {
    return MemorySearchService.timeline(userId, options);
  },

  async getDetails(ids: string[]) {
    return MemorySearchService.getDetails(ids);
  },

  async getContext(
    userId: string,
    options: {
      project?: string;
      agentType?: string;
      query?: string;
      maxObservations?: number;
      maxSummaries?: number;
    } = {}
  ): Promise<ContextOutput> {
    return MemoryContextBuilder.generate(userId, options);
  },

  async getPromptContext(
    userId: string,
    project?: string,
    maxTokens = 2000
  ): Promise<string> {
    return MemoryContextBuilder.generatePromptContext(userId, project, maxTokens);
  },

  async getStats(userId: string) {
    return MemorySearchService.getStats(userId);
  },

  async getSessions(userId: string, limit = 20, offset = 0) {
    return MemorySessionStore.listByUser(userId, limit, offset);
  },

  async getSessionObservations(sessionId: string) {
    return MemoryObservationStore.getBySession(sessionId);
  },

  async getSessionSummary(sessionId: string) {
    return MemorySummaryStore.getBySession(sessionId);
  },
};

function generateAutoSummary(
  session: MemorySession,
  observations: MemoryObservation[]
): SummaryInput {
  const types = new Map<string, number>();
  const allConcepts = new Set<string>();
  const allFiles = new Set<string>();

  for (const obs of observations) {
    types.set(obs.type, (types.get(obs.type) || 0) + 1);
    obs.concepts.forEach((c) => allConcepts.add(c));
    obs.filesRead.forEach((f) => allFiles.add(f));
    obs.filesModified.forEach((f) => allFiles.add(f));
  }

  const typeStr = Array.from(types.entries())
    .map(([t, c]) => `${c} ${t}${c > 1 ? 's' : ''}`)
    .join(', ');

  return {
    request: session.userPrompt,
    investigated: allConcepts.size > 0
      ? `Concepts: ${Array.from(allConcepts).slice(0, 10).join(', ')}`
      : undefined,
    completed: `${observations.length} observations (${typeStr})`,
    learned: observations
      .filter((o) => o.type === 'discovery')
      .map((o) => o.title)
      .slice(0, 5)
      .join('; ') || undefined,
    notes: allFiles.size > 0
      ? `Files involved: ${Array.from(allFiles).slice(0, 10).join(', ')}`
      : undefined,
  };
}
