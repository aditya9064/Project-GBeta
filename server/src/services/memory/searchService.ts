/* ═══════════════════════════════════════════════════════════
   Memory System — Search Service
   
   Provides claude-mem's 3-layer search workflow:
   1. search() → compact index of matching observations
   2. timeline() → chronological context around a point
   3. getDetails() → full observation data by IDs
   
   Uses text-based scoring since Firestore doesn't have FTS5.
   For production, this can be extended with Algolia/Typesense.
   ═══════════════════════════════════════════════════════════ */

import { MemoryDatabase } from './database.js';
import { MemoryObservationStore } from './observationStore.js';
import { MemorySummaryStore } from './summaryStore.js';
import { MemorySessionStore } from './sessionStore.js';
import { logger } from '../logger.js';
import type {
  SearchQuery,
  SearchResult,
  TimelineEntry,
  MemoryObservation,
  MemorySummary,
  MemorySession,
} from './types.js';

export interface SearchIndexEntry {
  id: string;
  type: string;
  title: string;
  agentType?: string;
  project: string;
  createdAt: string;
  createdAtEpoch: number;
  score: number;
}

export const MemorySearchService = {
  /**
   * Layer 1: Search — returns compact index entries (~50-100 tokens each)
   */
  async search(query: SearchQuery): Promise<SearchIndexEntry[]> {
    const limit = query.limit || 20;
    const observations = await MemoryDatabase.searchObservations(
      query.userId,
      query.query,
      {
        project: query.project,
        type: query.type,
        limit,
      }
    );

    return observations.map((obs, i) => ({
      id: obs.id,
      type: obs.type,
      title: obs.title,
      project: obs.project,
      createdAt: obs.createdAt,
      createdAtEpoch: obs.createdAtEpoch,
      score: observations.length - i,
    }));
  },

  /**
   * Layer 2: Timeline — returns chronological context around a timestamp or observation
   */
  async timeline(
    userId: string,
    options: {
      aroundObservationId?: string;
      aroundTimestamp?: number;
      windowMs?: number;
      limit?: number;
    }
  ): Promise<TimelineEntry[]> {
    const windowMs = options.windowMs || 60 * 60 * 1000; // 1 hour default
    const limit = options.limit || 30;
    let centerEpoch: number;

    if (options.aroundObservationId) {
      const obs = (await MemoryDatabase.getObservationsByIds([options.aroundObservationId]))[0];
      if (!obs) return [];
      centerEpoch = obs.createdAtEpoch;
    } else if (options.aroundTimestamp) {
      centerEpoch = options.aroundTimestamp;
    } else {
      centerEpoch = Date.now();
    }

    const startEpoch = centerEpoch - windowMs;
    const endEpoch = centerEpoch + windowMs;

    const [observations, sessions, summaries] = await Promise.all([
      MemoryDatabase.getObservationsByUser(userId, {
        startAfterEpoch: startEpoch,
        endBeforeEpoch: endEpoch,
        limit: 100,
      }),
      MemoryDatabase.getSessionsByUser(userId, 50),
      MemoryDatabase.getSummariesByUser(userId, 50),
    ]);

    const entries: TimelineEntry[] = [];

    for (const obs of observations) {
      entries.push({
        timestamp: obs.createdAtEpoch,
        type: 'observation',
        data: obs,
      });
    }

    for (const session of sessions) {
      if (session.createdAtEpoch >= startEpoch && session.createdAtEpoch <= endEpoch) {
        entries.push({
          timestamp: session.createdAtEpoch,
          type: 'session_start',
          data: session,
        });
      }
      if (
        session.completedAtEpoch &&
        session.completedAtEpoch >= startEpoch &&
        session.completedAtEpoch <= endEpoch
      ) {
        entries.push({
          timestamp: session.completedAtEpoch,
          type: 'session_end',
          data: session,
        });
      }
    }

    for (const summary of summaries) {
      if (summary.createdAtEpoch >= startEpoch && summary.createdAtEpoch <= endEpoch) {
        entries.push({
          timestamp: summary.createdAtEpoch,
          type: 'summary',
          data: summary,
        });
      }
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries.slice(0, limit);
  },

  /**
   * Layer 3: Get full observation details by IDs
   */
  async getDetails(ids: string[]): Promise<MemoryObservation[]> {
    return MemoryObservationStore.getByIds(ids);
  },

  async getStats(userId: string) {
    return MemoryDatabase.getStats(userId);
  },
};
