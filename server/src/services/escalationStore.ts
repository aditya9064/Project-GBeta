/* ═══════════════════════════════════════════════════════════
   Escalation Store — Manages escalation queue for human review
   
   Tracks escalated tasks that require human intervention:
   - Failed executions needing review
   - Low-confidence outputs
   - Flagged content
   - Manual approval requests
   
   Collection: escalations/{escalationId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const COLLECTION = 'escalations';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

const memoryEscalations = new Map<string, Escalation>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  EscalationStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 EscalationStore: Firebase Admin initialized');
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

export type EscalationType = 'execution_failure' | 'low_confidence' | 'flagged_content' | 'manual_review' | 'approval_required' | 'budget_exceeded';
export type EscalationStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed' | 'auto_resolved';
export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Escalation {
  id: string;
  type: EscalationType;
  status: EscalationStatus;
  priority: EscalationPriority;
  
  // Source context
  agentId?: string;
  agentName?: string;
  crewId?: string;
  crewName?: string;
  executionId?: string;
  nodeId?: string;
  nodeName?: string;
  
  // Escalation details
  title: string;
  description: string;
  errorMessage?: string;
  context?: Record<string, unknown>;
  
  // Review data
  originalOutput?: unknown;
  suggestedAction?: string;
  reviewerNotes?: string;
  resolution?: string;
  resolvedBy?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  dueBy?: string;
  
  // User assignment
  assignedTo?: string;
  userId: string;
}

export interface EscalationFilters {
  status?: EscalationStatus[];
  type?: EscalationType[];
  priority?: EscalationPriority[];
  agentId?: string;
  crewId?: string;
  userId?: string;
  assignedTo?: string;
}

function generateId(): string {
  return `esc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const EscalationStore = {
  /** Create a new escalation */
  async create(data: Omit<Escalation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Escalation> {
    const escalation: Escalation = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    memoryEscalations.set(escalation.id, escalation);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(escalation.id).set(escalation);
    }
    
    logger.info(`🚨 Escalation created: ${escalation.title} [${escalation.priority}]`);
    return escalation;
  },

  /** Get escalation by ID */
  async get(id: string): Promise<Escalation | null> {
    const memEsc = memoryEscalations.get(id);
    if (memEsc) return memEsc;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(COLLECTION).doc(id).get();
      if (doc.exists) {
        const esc = doc.data() as Escalation;
        memoryEscalations.set(id, esc);
        return esc;
      }
    }
    
    return null;
  },

  /** Update an escalation */
  async update(id: string, updates: Partial<Escalation>): Promise<Escalation | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: Escalation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    memoryEscalations.set(id, updated);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(id).set(updated, { merge: true });
    }
    
    return updated;
  },

  /** Resolve an escalation */
  async resolve(
    id: string, 
    resolution: string, 
    resolvedBy: string,
    reviewerNotes?: string
  ): Promise<Escalation | null> {
    return this.update(id, {
      status: 'resolved',
      resolution,
      resolvedBy,
      reviewerNotes,
      resolvedAt: new Date().toISOString(),
    });
  },

  /** Dismiss an escalation */
  async dismiss(id: string, reason: string, dismissedBy: string): Promise<Escalation | null> {
    return this.update(id, {
      status: 'dismissed',
      resolution: reason,
      resolvedBy: dismissedBy,
      resolvedAt: new Date().toISOString(),
    });
  },

  /** Assign escalation to a user */
  async assign(id: string, assignedTo: string): Promise<Escalation | null> {
    return this.update(id, {
      assignedTo,
      status: 'in_review',
    });
  },

  /** List escalations with filters */
  async list(filters: EscalationFilters = {}, limit = 50): Promise<Escalation[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      let query = db.collection(COLLECTION).orderBy('createdAt', 'desc');
      
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      if (filters.status && filters.status.length === 1) {
        query = query.where('status', '==', filters.status[0]);
      }
      
      if (filters.agentId) {
        query = query.where('agentId', '==', filters.agentId);
      }
      
      if (filters.crewId) {
        query = query.where('crewId', '==', filters.crewId);
      }
      
      query = query.limit(limit);
      
      const snapshot = await query.get();
      let results = snapshot.docs.map(d => d.data() as Escalation);
      
      // Apply additional filters in-memory
      if (filters.status && filters.status.length > 1) {
        results = results.filter(e => filters.status!.includes(e.status));
      }
      if (filters.type) {
        results = results.filter(e => filters.type!.includes(e.type));
      }
      if (filters.priority) {
        results = results.filter(e => filters.priority!.includes(e.priority));
      }
      if (filters.assignedTo) {
        results = results.filter(e => e.assignedTo === filters.assignedTo);
      }
      
      results.forEach(e => memoryEscalations.set(e.id, e));
      return results;
    }
    
    // Memory fallback
    let results = Array.from(memoryEscalations.values());
    
    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    if (filters.status) {
      results = results.filter(e => filters.status!.includes(e.status));
    }
    if (filters.type) {
      results = results.filter(e => filters.type!.includes(e.type));
    }
    if (filters.priority) {
      results = results.filter(e => filters.priority!.includes(e.priority));
    }
    if (filters.agentId) {
      results = results.filter(e => e.agentId === filters.agentId);
    }
    if (filters.crewId) {
      results = results.filter(e => e.crewId === filters.crewId);
    }
    if (filters.assignedTo) {
      results = results.filter(e => e.assignedTo === filters.assignedTo);
    }
    
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },

  /** Get pending escalation count */
  async getPendingCount(userId?: string): Promise<number> {
    const filters: EscalationFilters = {
      status: ['pending', 'in_review'],
      userId,
    };
    const escalations = await this.list(filters, 1000);
    return escalations.length;
  },

  /** Get escalation summary */
  async getSummary(userId?: string): Promise<{
    total: number;
    pending: number;
    inReview: number;
    resolved: number;
    byPriority: { priority: EscalationPriority; count: number }[];
    byType: { type: EscalationType; count: number }[];
  }> {
    const all = await this.list({ userId }, 1000);
    
    const byPriority = new Map<EscalationPriority, number>();
    const byType = new Map<EscalationType, number>();
    let pending = 0;
    let inReview = 0;
    let resolved = 0;
    
    for (const esc of all) {
      if (esc.status === 'pending') pending++;
      else if (esc.status === 'in_review') inReview++;
      else if (esc.status === 'resolved' || esc.status === 'dismissed') resolved++;
      
      byPriority.set(esc.priority, (byPriority.get(esc.priority) || 0) + 1);
      byType.set(esc.type, (byType.get(esc.type) || 0) + 1);
    }
    
    return {
      total: all.length,
      pending,
      inReview,
      resolved,
      byPriority: Array.from(byPriority.entries()).map(([priority, count]) => ({ priority, count })),
      byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
    };
  },

  /** Delete escalation */
  async delete(id: string): Promise<boolean> {
    memoryEscalations.delete(id);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(id).delete();
    }
    
    return true;
  },
};
