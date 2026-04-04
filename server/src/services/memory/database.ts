/* ═══════════════════════════════════════════════════════════
   Memory System — Firestore Database Layer
   
   Adapted from claude-mem's SQLite architecture. Uses
   Firestore collections with the same logical schema:
   - memory_sessions  → sdk_sessions
   - memory_observations → observations  
   - memory_summaries → session_summaries
   
   Includes in-memory fallback for local dev without Firebase.
   ═══════════════════════════════════════════════════════════ */

import { logger } from '../logger.js';
import type {
  MemorySession,
  MemoryObservation,
  MemorySummary,
  SessionStatus,
} from './types.js';

type FirestoreDB = FirebaseFirestore.Firestore;

const COLLECTIONS = {
  sessions: 'memory_sessions',
  observations: 'memory_observations',
  summaries: 'memory_summaries',
} as const;

let firestoreDb: FirestoreDB | null = null;

async function getFirestore(): Promise<FirestoreDB | null> {
  if (firestoreDb) return firestoreDb;
  try {
    const { getApps } = await import('firebase-admin/app');
    const firestore = await import('firebase-admin/firestore');
    if (getApps().length > 0) {
      firestoreDb = firestore.getFirestore();
      return firestoreDb;
    }
  } catch {
    // Firebase not available
  }
  return null;
}

const inMemoryStore = {
  sessions: new Map<string, MemorySession>(),
  observations: new Map<string, MemoryObservation>(),
  summaries: new Map<string, MemorySummary>(),
};

export const MemoryDatabase = {
  async storeSession(session: MemorySession): Promise<string> {
    const db = await getFirestore();
    if (db) {
      const ref = db.collection(COLLECTIONS.sessions).doc(session.id);
      await ref.set(session);
      return session.id;
    }
    inMemoryStore.sessions.set(session.id, session);
    return session.id;
  },

  async getSession(sessionId: string): Promise<MemorySession | null> {
    const db = await getFirestore();
    if (db) {
      const doc = await db.collection(COLLECTIONS.sessions).doc(sessionId).get();
      return doc.exists ? (doc.data() as MemorySession) : null;
    }
    return inMemoryStore.sessions.get(sessionId) || null;
  },

  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    observationCount?: number
  ): Promise<void> {
    const db = await getFirestore();
    const update: Record<string, any> = { status };
    if (status === 'completed' || status === 'failed') {
      update.completedAt = new Date().toISOString();
      update.completedAtEpoch = Date.now();
    }
    if (observationCount !== undefined) {
      update.observationCount = observationCount;
    }

    if (db) {
      await db.collection(COLLECTIONS.sessions).doc(sessionId).update(update);
      return;
    }
    const mem = inMemoryStore.sessions.get(sessionId);
    if (mem) Object.assign(mem, update);
  },

  async getSessionsByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<MemorySession[]> {
    const db = await getFirestore();
    if (db) {
      const snap = await db
        .collection(COLLECTIONS.sessions)
        .where('userId', '==', userId)
        .orderBy('createdAtEpoch', 'desc')
        .offset(offset)
        .limit(limit)
        .get();
      return snap.docs.map((d) => d.data() as MemorySession);
    }
    return Array.from(inMemoryStore.sessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAtEpoch - a.createdAtEpoch)
      .slice(offset, offset + limit);
  },

  async storeObservation(obs: MemoryObservation): Promise<string> {
    const db = await getFirestore();
    if (db) {
      const ref = db.collection(COLLECTIONS.observations).doc(obs.id);
      await ref.set(obs);
      return obs.id;
    }
    inMemoryStore.observations.set(obs.id, obs);
    return obs.id;
  },

  async findDuplicateObservation(
    contentHash: string,
    afterEpoch: number
  ): Promise<MemoryObservation | null> {
    const db = await getFirestore();
    if (db) {
      const snap = await db
        .collection(COLLECTIONS.observations)
        .where('contentHash', '==', contentHash)
        .where('createdAtEpoch', '>', afterEpoch)
        .limit(1)
        .get();
      return snap.empty ? null : (snap.docs[0].data() as MemoryObservation);
    }
    for (const obs of inMemoryStore.observations.values()) {
      if (obs.contentHash === contentHash && obs.createdAtEpoch > afterEpoch) {
        return obs;
      }
    }
    return null;
  },

  async getObservationsBySession(sessionId: string): Promise<MemoryObservation[]> {
    const db = await getFirestore();
    if (db) {
      const snap = await db
        .collection(COLLECTIONS.observations)
        .where('sessionId', '==', sessionId)
        .orderBy('createdAtEpoch', 'asc')
        .get();
      return snap.docs.map((d) => d.data() as MemoryObservation);
    }
    return Array.from(inMemoryStore.observations.values())
      .filter((o) => o.sessionId === sessionId)
      .sort((a, b) => a.createdAtEpoch - b.createdAtEpoch);
  },

  async getObservationsByUser(
    userId: string,
    options: {
      project?: string;
      type?: string;
      limit?: number;
      startAfterEpoch?: number;
      endBeforeEpoch?: number;
    } = {}
  ): Promise<MemoryObservation[]> {
    const limit = options.limit || 50;
    const db = await getFirestore();

    if (db) {
      let query: FirebaseFirestore.Query = db
        .collection(COLLECTIONS.observations)
        .where('userId', '==', userId);

      if (options.project) query = query.where('project', '==', options.project);
      if (options.type) query = query.where('type', '==', options.type);
      if (options.startAfterEpoch)
        query = query.where('createdAtEpoch', '>=', options.startAfterEpoch);
      if (options.endBeforeEpoch)
        query = query.where('createdAtEpoch', '<=', options.endBeforeEpoch);

      const snap = await query
        .orderBy('createdAtEpoch', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map((d) => d.data() as MemoryObservation);
    }

    let results = Array.from(inMemoryStore.observations.values()).filter(
      (o) => o.userId === userId
    );
    if (options.project) results = results.filter((o) => o.project === options.project);
    if (options.type) results = results.filter((o) => o.type === options.type);
    if (options.startAfterEpoch)
      results = results.filter((o) => o.createdAtEpoch >= options.startAfterEpoch!);
    if (options.endBeforeEpoch)
      results = results.filter((o) => o.createdAtEpoch <= options.endBeforeEpoch!);

    return results
      .sort((a, b) => b.createdAtEpoch - a.createdAtEpoch)
      .slice(0, limit);
  },

  async getObservationsByIds(ids: string[]): Promise<MemoryObservation[]> {
    if (ids.length === 0) return [];
    const db = await getFirestore();
    if (db) {
      const batchSize = 10;
      const results: MemoryObservation[] = [];
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const snap = await db
          .collection(COLLECTIONS.observations)
          .where('__name__', 'in', batch)
          .get();
        results.push(...snap.docs.map((d) => d.data() as MemoryObservation));
      }
      return results;
    }
    return ids
      .map((id) => inMemoryStore.observations.get(id))
      .filter(Boolean) as MemoryObservation[];
  },

  async storeSummary(summary: MemorySummary): Promise<string> {
    const db = await getFirestore();
    if (db) {
      const ref = db.collection(COLLECTIONS.summaries).doc(summary.id);
      await ref.set(summary);
      return summary.id;
    }
    inMemoryStore.summaries.set(summary.id, summary);
    return summary.id;
  },

  async getSummaryBySession(sessionId: string): Promise<MemorySummary | null> {
    const db = await getFirestore();
    if (db) {
      const snap = await db
        .collection(COLLECTIONS.summaries)
        .where('sessionId', '==', sessionId)
        .orderBy('createdAtEpoch', 'desc')
        .limit(1)
        .get();
      return snap.empty ? null : (snap.docs[0].data() as MemorySummary);
    }
    const matches = Array.from(inMemoryStore.summaries.values())
      .filter((s) => s.sessionId === sessionId)
      .sort((a, b) => b.createdAtEpoch - a.createdAtEpoch);
    return matches[0] || null;
  },

  async getSummariesByUser(
    userId: string,
    limit = 10
  ): Promise<MemorySummary[]> {
    const db = await getFirestore();
    if (db) {
      const snap = await db
        .collection(COLLECTIONS.summaries)
        .where('userId', '==', userId)
        .orderBy('createdAtEpoch', 'desc')
        .limit(limit)
        .get();
      return snap.docs.map((d) => d.data() as MemorySummary);
    }
    return Array.from(inMemoryStore.summaries.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAtEpoch - a.createdAtEpoch)
      .slice(0, limit);
  },

  async searchObservations(
    userId: string,
    query: string,
    options: { project?: string; type?: string; limit?: number } = {}
  ): Promise<MemoryObservation[]> {
    const limit = options.limit || 20;
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const all = await this.getObservationsByUser(userId, {
      project: options.project,
      type: options.type,
      limit: 200,
    });

    const scored = all
      .map((obs) => {
        const searchable = [
          obs.title,
          obs.subtitle,
          obs.narrative,
          ...(obs.facts || []),
          ...(obs.concepts || []),
          obs.toolName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 0;
        for (const term of terms) {
          if (searchable.includes(term)) score++;
        }
        return { obs, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((r) => r.obs);
  },

  async getStats(userId: string): Promise<{
    totalSessions: number;
    totalObservations: number;
    totalSummaries: number;
    oldestSession?: string;
    newestSession?: string;
  }> {
    const db = await getFirestore();
    if (db) {
      const [sessSnap, obsSnap, sumSnap] = await Promise.all([
        db
          .collection(COLLECTIONS.sessions)
          .where('userId', '==', userId)
          .count()
          .get(),
        db
          .collection(COLLECTIONS.observations)
          .where('userId', '==', userId)
          .count()
          .get(),
        db
          .collection(COLLECTIONS.summaries)
          .where('userId', '==', userId)
          .count()
          .get(),
      ]);

      const oldest = await db
        .collection(COLLECTIONS.sessions)
        .where('userId', '==', userId)
        .orderBy('createdAtEpoch', 'asc')
        .limit(1)
        .get();

      const newest = await db
        .collection(COLLECTIONS.sessions)
        .where('userId', '==', userId)
        .orderBy('createdAtEpoch', 'desc')
        .limit(1)
        .get();

      return {
        totalSessions: sessSnap.data().count,
        totalObservations: obsSnap.data().count,
        totalSummaries: sumSnap.data().count,
        oldestSession: oldest.empty
          ? undefined
          : (oldest.docs[0].data() as MemorySession).createdAt,
        newestSession: newest.empty
          ? undefined
          : (newest.docs[0].data() as MemorySession).createdAt,
      };
    }

    const sessions = Array.from(inMemoryStore.sessions.values()).filter(
      (s) => s.userId === userId
    );
    const observations = Array.from(inMemoryStore.observations.values()).filter(
      (o) => o.userId === userId
    );
    const summaries = Array.from(inMemoryStore.summaries.values()).filter(
      (s) => s.userId === userId
    );

    sessions.sort((a, b) => a.createdAtEpoch - b.createdAtEpoch);

    return {
      totalSessions: sessions.length,
      totalObservations: observations.length,
      totalSummaries: summaries.length,
      oldestSession: sessions[0]?.createdAt,
      newestSession: sessions[sessions.length - 1]?.createdAt,
    };
  },
};
