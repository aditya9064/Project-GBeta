/* ═══════════════════════════════════════════════════════════
   Memory System — Summary Store
   
   Stores compressed session summaries. When a session ends,
   the system generates a structured summary capturing what
   was requested, investigated, learned, completed, and
   what the next steps are.
   Adapted from claude-mem's summaries/store.ts pattern.
   ═══════════════════════════════════════════════════════════ */

import { randomUUID } from 'crypto';
import { MemoryDatabase } from './database.js';
import { logger } from '../logger.js';
import type { MemorySummary, SummaryInput } from './types.js';

export const MemorySummaryStore = {
  async store(
    sessionId: string,
    userId: string,
    project: string,
    input: SummaryInput
  ): Promise<MemorySummary> {
    const now = Date.now();
    const summary: MemorySummary = {
      id: randomUUID(),
      sessionId,
      userId,
      project,
      request: input.request,
      investigated: input.investigated,
      learned: input.learned,
      completed: input.completed,
      nextSteps: input.nextSteps,
      notes: input.notes,
      createdAt: new Date(now).toISOString(),
      createdAtEpoch: now,
    };

    await MemoryDatabase.storeSummary(summary);
    logger.info(`[Memory] Summary stored for session ${sessionId}`);
    return summary;
  },

  async getBySession(sessionId: string): Promise<MemorySummary | null> {
    return MemoryDatabase.getSummaryBySession(sessionId);
  },

  async getByUser(userId: string, limit = 10): Promise<MemorySummary[]> {
    return MemoryDatabase.getSummariesByUser(userId, limit);
  },
};
