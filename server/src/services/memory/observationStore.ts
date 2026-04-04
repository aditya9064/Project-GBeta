/* ═══════════════════════════════════════════════════════════
   Memory System — Observation Store
   
   Captures what agents do and learn. Each observation is a
   structured record of a tool use, decision, discovery, etc.
   Uses content-hash deduplication within a 30s window,
   adapted from claude-mem's observations/store.ts pattern.
   ═══════════════════════════════════════════════════════════ */

import { createHash, randomUUID } from 'crypto';
import { MemoryDatabase } from './database.js';
import { logger } from '../logger.js';
import type {
  MemoryObservation,
  ObservationInput,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';

const DEDUP_WINDOW_MS = 30_000;

function computeContentHash(
  sessionId: string,
  title: string,
  narrative?: string
): string {
  return createHash('sha256')
    .update(`${sessionId}|${title}|${narrative || ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const MemoryObservationStore = {
  async store(
    sessionId: string,
    userId: string,
    project: string,
    input: ObservationInput,
    promptNumber?: number
  ): Promise<MemoryObservation | null> {
    const now = Date.now();
    const contentHash = computeContentHash(sessionId, input.title, input.narrative);

    const duplicate = await MemoryDatabase.findDuplicateObservation(
      contentHash,
      now - DEDUP_WINDOW_MS
    );
    if (duplicate) {
      logger.info(`[Memory] Skipped duplicate observation: ${contentHash}`);
      return duplicate;
    }

    const observation: MemoryObservation = {
      id: randomUUID(),
      sessionId,
      userId,
      project,
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      narrative: input.narrative,
      facts: input.facts || [],
      concepts: input.concepts || [],
      filesRead: input.filesRead || [],
      filesModified: input.filesModified || [],
      toolName: input.toolName,
      contentHash,
      promptNumber,
      createdAt: new Date(now).toISOString(),
      createdAtEpoch: now,
    };

    await MemoryDatabase.storeObservation(observation);
    logger.info(
      `[Memory] Observation stored: ${observation.id} type=${input.type} title="${input.title}"`
    );
    return observation;
  },

  async getBySession(sessionId: string): Promise<MemoryObservation[]> {
    return MemoryDatabase.getObservationsBySession(sessionId);
  },

  async getByUser(
    userId: string,
    options: {
      project?: string;
      type?: string;
      limit?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<MemoryObservation[]> {
    return MemoryDatabase.getObservationsByUser(userId, {
      project: options.project,
      type: options.type,
      limit: options.limit,
      startAfterEpoch: options.startDate
        ? new Date(options.startDate).getTime()
        : undefined,
      endBeforeEpoch: options.endDate
        ? new Date(options.endDate).getTime()
        : undefined,
    });
  },

  async getByIds(ids: string[]): Promise<MemoryObservation[]> {
    return MemoryDatabase.getObservationsByIds(ids);
  },
};
