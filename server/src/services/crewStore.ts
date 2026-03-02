/* ═══════════════════════════════════════════════════════════
   Crew Store — Firestore persistence for agent crews/teams

   Stores crew definitions, members, roles, and shared context
   in Firestore so they persist across function invocations.

   Collection: crews/{crewId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const CREWS_COLLECTION = 'crews';

// Lazy initialization state
let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

// In-memory fallback when Firestore is unavailable
const memoryCrews = new Map<string, StoredCrew>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(CREWS_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  CrewStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

export type CrewMemberRole = 'manager' | 'specialist' | 'reviewer' | 'qa';
export type CrewMemberPermission = 'execute' | 'delegate' | 'review' | 'approve';

export interface CrewMember {
  agentId: string;
  agentName: string;
  role: CrewMemberRole;
  joinedAt: string;
  permissions: CrewMemberPermission[];
}

export interface CrewSettings {
  supervisionLevel: 'none' | 'light' | 'strict';
  requireReviewForOutput: boolean;
  escalationEnabled: boolean;
  escalationThreshold: number;
  maxConcurrentTasks: number;
}

export interface CrewStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgDurationMs: number;
  lastExecutedAt?: string;
}

export interface StoredCrew {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: CrewMember[];
  sharedContext: Record<string, any>;
  settings: CrewSettings;
  stats: CrewStats;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 CrewStore: Firebase Admin initialized');
    } else {
      firebaseApp = getApps()[0];
    }
    firestoreDb = getFirestore(firebaseApp);
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    return firestoreDb;
  } catch (err: any) {
    throw new Error(`Firestore not available: ${err.message}`);
  }
}

function getDefaultSettings(): CrewSettings {
  return {
    supervisionLevel: 'light',
    requireReviewForOutput: false,
    escalationEnabled: true,
    escalationThreshold: 2,
    maxConcurrentTasks: 3,
  };
}

function getDefaultStats(): CrewStats {
  return {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgDurationMs: 0,
  };
}

export const CrewStore = {
  /** Create or update a crew */
  async save(crew: StoredCrew): Promise<void> {
    memoryCrews.set(crew.id, crew);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(CREWS_COLLECTION).doc(crew.id).set(crew, { merge: true });
    }
    logger.info(`✅ Crew saved: ${crew.name} (${crew.id})`);
  },

  /** Get a crew by ID */
  async get(crewId: string): Promise<StoredCrew | null> {
    const memCrew = memoryCrews.get(crewId);
    if (memCrew) return memCrew;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(CREWS_COLLECTION).doc(crewId).get();
      if (doc.exists) {
        const crew = doc.data() as StoredCrew;
        memoryCrews.set(crewId, crew);
        return crew;
      }
    }
    return null;
  },

  /** Get all crews for a user */
  async getByUser(userId: string): Promise<StoredCrew[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(CREWS_COLLECTION)
        .where('ownerId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('updatedAt', 'desc')
        .get();
      const crews = snapshot.docs.map(d => d.data() as StoredCrew);
      crews.forEach(c => memoryCrews.set(c.id, c));
      return crews;
    }
    
    return Array.from(memoryCrews.values())
      .filter(c => c.ownerId === userId && c.status === 'active')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  /** Get all active crews */
  async getActive(): Promise<StoredCrew[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(CREWS_COLLECTION)
        .where('status', '==', 'active')
        .get();
      const crews = snapshot.docs.map(d => d.data() as StoredCrew);
      crews.forEach(c => memoryCrews.set(c.id, c));
      return crews;
    }
    
    return Array.from(memoryCrews.values()).filter(c => c.status === 'active');
  },

  /** Create a new crew */
  async create(data: {
    name: string;
    description: string;
    ownerId: string;
    members?: CrewMember[];
    settings?: Partial<CrewSettings>;
  }): Promise<StoredCrew> {
    const now = new Date().toISOString();
    const crew: StoredCrew = {
      id: `crew-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      members: data.members || [],
      sharedContext: {},
      settings: { ...getDefaultSettings(), ...data.settings },
      stats: getDefaultStats(),
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };
    
    await this.save(crew);
    return crew;
  },

  /** Update crew details */
  async update(crewId: string, update: Partial<StoredCrew>): Promise<StoredCrew | null> {
    const crew = await this.get(crewId);
    if (!crew) return null;
    
    const updated = {
      ...crew,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    
    await this.save(updated);
    return updated;
  },

  /** Archive a crew (soft delete) */
  async archive(crewId: string): Promise<void> {
    await this.update(crewId, { status: 'archived' });
    logger.info(`🗃️ Crew archived: ${crewId}`);
  },

  /** Add a member to a crew */
  async addMember(crewId: string, member: CrewMember): Promise<StoredCrew | null> {
    const crew = await this.get(crewId);
    if (!crew) return null;
    
    const existingIndex = crew.members.findIndex(m => m.agentId === member.agentId);
    if (existingIndex >= 0) {
      crew.members[existingIndex] = member;
    } else {
      crew.members.push(member);
    }
    
    crew.updatedAt = new Date().toISOString();
    await this.save(crew);
    return crew;
  },

  /** Remove a member from a crew */
  async removeMember(crewId: string, agentId: string): Promise<StoredCrew | null> {
    const crew = await this.get(crewId);
    if (!crew) return null;
    
    crew.members = crew.members.filter(m => m.agentId !== agentId);
    crew.updatedAt = new Date().toISOString();
    await this.save(crew);
    return crew;
  },

  /** Update a member's role/permissions */
  async updateMember(
    crewId: string,
    agentId: string,
    update: Partial<CrewMember>
  ): Promise<StoredCrew | null> {
    const crew = await this.get(crewId);
    if (!crew) return null;
    
    const memberIndex = crew.members.findIndex(m => m.agentId === agentId);
    if (memberIndex < 0) return null;
    
    crew.members[memberIndex] = { ...crew.members[memberIndex], ...update };
    crew.updatedAt = new Date().toISOString();
    await this.save(crew);
    return crew;
  },

  /** Update shared context */
  async updateSharedContext(crewId: string, context: Record<string, any>): Promise<void> {
    const crew = await this.get(crewId);
    if (!crew) return;
    
    crew.sharedContext = { ...crew.sharedContext, ...context };
    crew.updatedAt = new Date().toISOString();
    await this.save(crew);
  },

  /** Record execution statistics */
  async recordExecution(crewId: string, success: boolean, durationMs: number): Promise<void> {
    const crew = await this.get(crewId);
    if (!crew) return;
    
    const stats = crew.stats;
    const newTotal = stats.totalExecutions + 1;
    const newAvg = ((stats.avgDurationMs * stats.totalExecutions) + durationMs) / newTotal;
    
    crew.stats = {
      totalExecutions: newTotal,
      successfulExecutions: success ? stats.successfulExecutions + 1 : stats.successfulExecutions,
      failedExecutions: success ? stats.failedExecutions : stats.failedExecutions + 1,
      avgDurationMs: Math.round(newAvg),
      lastExecutedAt: new Date().toISOString(),
    };
    crew.updatedAt = new Date().toISOString();
    
    await this.save(crew);
  },

  /** Get crews that contain a specific agent */
  async getCrewsForAgent(agentId: string): Promise<StoredCrew[]> {
    const allCrews = await this.getActive();
    return allCrews.filter(c => c.members.some(m => m.agentId === agentId));
  },

  /** Add crew to memory (for syncing) */
  addToMemory(crew: StoredCrew): void {
    memoryCrews.set(crew.id, crew);
  },
};
