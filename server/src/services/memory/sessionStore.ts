/* ═══════════════════════════════════════════════════════════
   Memory System — Session Store
   
   Creates and manages memory sessions. Idempotent: calling
   createSession with the same ID returns the existing session.
   Adapted from claude-mem's sessions/create.ts pattern.
   ═══════════════════════════════════════════════════════════ */

import { randomUUID } from 'crypto';
import { MemoryDatabase } from './database.js';
import { logger } from '../logger.js';
import type { MemorySession, SessionStatus } from './types.js';

export const MemorySessionStore = {
  async create(params: {
    userId: string;
    agentType: string;
    project?: string;
    userPrompt: string;
    title?: string;
    metadata?: Record<string, any>;
    sessionId?: string;
  }): Promise<MemorySession> {
    const sessionId = params.sessionId || randomUUID();

    const existing = await MemoryDatabase.getSession(sessionId);
    if (existing) {
      if (params.project && !existing.project) {
        await MemoryDatabase.updateSessionStatus(sessionId, existing.status);
      }
      return existing;
    }

    const now = new Date();
    const session: MemorySession = {
      id: sessionId,
      userId: params.userId,
      agentType: params.agentType,
      project: params.project || 'default',
      userPrompt: params.userPrompt,
      title: params.title,
      status: 'active',
      observationCount: 0,
      createdAt: now.toISOString(),
      createdAtEpoch: now.getTime(),
      metadata: params.metadata,
    };

    await MemoryDatabase.storeSession(session);
    logger.info(`[Memory] Session created: ${sessionId} for agent=${params.agentType}`);
    return session;
  },

  async complete(sessionId: string, observationCount?: number): Promise<void> {
    await MemoryDatabase.updateSessionStatus(sessionId, 'completed', observationCount);
    logger.info(`[Memory] Session completed: ${sessionId}`);
  },

  async fail(sessionId: string): Promise<void> {
    await MemoryDatabase.updateSessionStatus(sessionId, 'failed');
    logger.info(`[Memory] Session failed: ${sessionId}`);
  },

  async get(sessionId: string): Promise<MemorySession | null> {
    return MemoryDatabase.getSession(sessionId);
  },

  async listByUser(userId: string, limit = 20, offset = 0): Promise<MemorySession[]> {
    return MemoryDatabase.getSessionsByUser(userId, limit, offset);
  },
};
