/* ═══════════════════════════════════════════════════════════
   Agent Store — Firestore persistence for deployed agents

   Stores agent definitions, workflow configs, and status
   in Firestore so they persist across function invocations
   and can be executed server-side without the browser.

   Collection: agents/{agentId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

const AGENTS_COLLECTION = 'agents';
const EXECUTIONS_COLLECTION = 'agent_executions';

// Lazy initialization state
let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

// In-memory fallback when Firestore is unavailable
const memoryAgents = new Map<string, StoredAgent>();
const memoryExecutions = new Map<string, ExecutionRecord>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    // Test connectivity with a simple read
    await db.collection(AGENTS_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch (err) {
    console.warn('⚠️  AgentStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

export interface StoredAgent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft' | 'error' | 'archived';
  userId: string;
  workflow: any;
  triggerType?: string;
  triggerConfig?: any;
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
  executionCount: number;
  errorCount: number;
  lastError?: string;
}

export interface ExecutionRecord {
  id: string;
  agentId: string;
  agentName: string;
  userId: string;
  status: 'running' | 'completed' | 'failed';
  trigger: string;
  triggerData?: any;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  logs: ExecutionNodeLog[];
  output?: any;
  error?: string;
}

export interface ExecutionNodeLog {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input?: any;
  output?: any;
  error?: string;
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    // Check if any Firebase app exists
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      console.log('🔥 AgentStore: Firebase Admin initialized');
    } else {
      firebaseApp = getApps()[0];
    }
    firestoreDb = getFirestore(firebaseApp);
    return firestoreDb;
  } catch (err: any) {
    initializationError = err.message;
    throw new Error(`Firestore not available: ${err.message}`);
  }
}

export const AgentStore = {
  /** Save an agent (also updates in-memory cache) */
  async save(agent: StoredAgent): Promise<void> {
    // Always save to memory first
    memoryAgents.set(agent.id, agent);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(AGENTS_COLLECTION).doc(agent.id).set(agent, { merge: true });
    }
    console.log(`✅ Agent saved: ${agent.name} (${agent.id})`);
  },

  /** Get an agent by ID */
  async get(agentId: string): Promise<StoredAgent | null> {
    // Check memory first
    const memAgent = memoryAgents.get(agentId);
    if (memAgent) return memAgent;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(AGENTS_COLLECTION).doc(agentId).get();
      if (doc.exists) {
        const agent = doc.data() as StoredAgent;
        memoryAgents.set(agentId, agent); // Cache it
        return agent;
      }
    }
    return null;
  },

  /** Get all agents for a user */
  async getByUser(userId: string): Promise<StoredAgent[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(AGENTS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();
      const agents = snapshot.docs.map(d => d.data() as StoredAgent);
      // Update memory cache
      agents.forEach(a => memoryAgents.set(a.id, a));
      return agents;
    }
    
    // Fallback to memory
    return Array.from(memoryAgents.values())
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  /** Get all active agents (for scheduler) */
  async getActive(): Promise<StoredAgent[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(AGENTS_COLLECTION)
        .where('status', '==', 'active')
        .get();
      const agents = snapshot.docs.map(d => d.data() as StoredAgent);
      // Update memory cache
      agents.forEach(a => memoryAgents.set(a.id, a));
      return agents;
    }
    
    // Fallback to memory
    return Array.from(memoryAgents.values()).filter(a => a.status === 'active');
  },
  
  /** Get all agents (for syncing from frontend) */
  async getAll(): Promise<StoredAgent[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db.collection(AGENTS_COLLECTION).get();
      const agents = snapshot.docs.map(d => d.data() as StoredAgent);
      agents.forEach(a => memoryAgents.set(a.id, a));
      return agents;
    }
    return Array.from(memoryAgents.values());
  },

  /** Update agent status */
  async updateStatus(agentId: string, status: StoredAgent['status'], error?: string): Promise<void> {
    const update: Partial<StoredAgent> = { 
      status, 
      updatedAt: new Date().toISOString() 
    };
    if (error) update.lastError = error;
    
    // Update memory
    const memAgent = memoryAgents.get(agentId);
    if (memAgent) {
      memoryAgents.set(agentId, { ...memAgent, ...update });
    }
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(AGENTS_COLLECTION).doc(agentId).update(update);
    }
  },

  /** Record execution statistics */
  async recordExecution(agentId: string, success: boolean): Promise<void> {
    const update: Partial<StoredAgent> = {
      lastExecutedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Update memory
    const memAgent = memoryAgents.get(agentId);
    if (memAgent) {
      update.executionCount = (memAgent.executionCount || 0) + 1;
      if (!success) update.errorCount = (memAgent.errorCount || 0) + 1;
      memoryAgents.set(agentId, { ...memAgent, ...update } as StoredAgent);
    }
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const ref = db.collection(AGENTS_COLLECTION).doc(agentId);
      const doc = await ref.get();
      if (doc.exists) {
        const data = doc.data()!;
        update.executionCount = (data.executionCount || 0) + 1;
        if (!success) update.errorCount = (data.errorCount || 0) + 1;
      }
      await ref.update(update);
    }
  },

  /** Delete an agent */
  async delete(agentId: string): Promise<void> {
    memoryAgents.delete(agentId);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(AGENTS_COLLECTION).doc(agentId).delete();
    }
    console.log(`🗑️ Agent deleted: ${agentId}`);
  },
  
  /** Add agent to memory (called when agents are synced from frontend via /api/agents) */
  addToMemory(agent: StoredAgent): void {
    memoryAgents.set(agent.id, agent);
  },

  // --- Execution logs ---

  /** Save an execution record */
  async saveExecution(record: ExecutionRecord): Promise<void> {
    memoryExecutions.set(record.id, record);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(EXECUTIONS_COLLECTION).doc(record.id).set(record);
    }
  },

  /** Update an execution record */
  async updateExecution(executionId: string, update: Partial<ExecutionRecord>): Promise<void> {
    const memExec = memoryExecutions.get(executionId);
    if (memExec) {
      memoryExecutions.set(executionId, { ...memExec, ...update } as ExecutionRecord);
    }
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(EXECUTIONS_COLLECTION).doc(executionId).update(update);
    }
  },

  /** Get executions for an agent */
  async getExecutions(agentId: string, limit = 20): Promise<ExecutionRecord[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(EXECUTIONS_COLLECTION)
        .where('agentId', '==', agentId)
        .orderBy('startedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(d => d.data() as ExecutionRecord);
    }
    
    return Array.from(memoryExecutions.values())
      .filter(e => e.agentId === agentId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  },

  /** Get recent executions for a user */
  async getRecentExecutions(userId: string, limit = 50): Promise<ExecutionRecord[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(EXECUTIONS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('startedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(d => d.data() as ExecutionRecord);
    }
    
    return Array.from(memoryExecutions.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  },

  /** Get all recent executions */
  async getAllRecentExecutions(limit = 50): Promise<ExecutionRecord[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(EXECUTIONS_COLLECTION)
        .orderBy('startedAt', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(d => d.data() as ExecutionRecord);
    }
    
    return Array.from(memoryExecutions.values())
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  },
};
