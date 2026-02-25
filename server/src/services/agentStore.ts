/* ═══════════════════════════════════════════════════════════
   Agent Store — Firestore persistence for deployed agents

   Stores agent definitions, workflow configs, and status
   in Firestore so they persist across function invocations
   and can be executed server-side without the browser.

   Collection: agents/{agentId}
   ═══════════════════════════════════════════════════════════ */

import { getFirestore } from 'firebase-admin/firestore';

const AGENTS_COLLECTION = 'agents';
const EXECUTIONS_COLLECTION = 'agent_executions';

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

function getDb() {
  return getFirestore();
}

export const AgentStore = {
  async save(agent: StoredAgent): Promise<void> {
    const db = getDb();
    await db.collection(AGENTS_COLLECTION).doc(agent.id).set(agent, { merge: true });
    console.log(`✅ Agent saved: ${agent.name} (${agent.id})`);
  },

  async get(agentId: string): Promise<StoredAgent | null> {
    const db = getDb();
    const doc = await db.collection(AGENTS_COLLECTION).doc(agentId).get();
    if (!doc.exists) return null;
    return doc.data() as StoredAgent;
  },

  async getByUser(userId: string): Promise<StoredAgent[]> {
    const db = getDb();
    const snapshot = await db
      .collection(AGENTS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    return snapshot.docs.map(d => d.data() as StoredAgent);
  },

  async getActive(): Promise<StoredAgent[]> {
    const db = getDb();
    const snapshot = await db
      .collection(AGENTS_COLLECTION)
      .where('status', '==', 'active')
      .get();
    return snapshot.docs.map(d => d.data() as StoredAgent);
  },

  async updateStatus(agentId: string, status: StoredAgent['status'], error?: string): Promise<void> {
    const db = getDb();
    const update: any = { status, updatedAt: new Date().toISOString() };
    if (error) update.lastError = error;
    await db.collection(AGENTS_COLLECTION).doc(agentId).update(update);
  },

  async recordExecution(agentId: string, success: boolean): Promise<void> {
    const db = getDb();
    const ref = db.collection(AGENTS_COLLECTION).doc(agentId);
    const update: any = {
      lastExecutedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const doc = await ref.get();
    if (doc.exists) {
      const data = doc.data()!;
      update.executionCount = (data.executionCount || 0) + 1;
      if (!success) update.errorCount = (data.errorCount || 0) + 1;
    }
    await ref.update(update);
  },

  async delete(agentId: string): Promise<void> {
    const db = getDb();
    await db.collection(AGENTS_COLLECTION).doc(agentId).delete();
    console.log(`🗑️ Agent deleted: ${agentId}`);
  },

  // --- Execution logs ---

  async saveExecution(record: ExecutionRecord): Promise<void> {
    const db = getDb();
    await db.collection(EXECUTIONS_COLLECTION).doc(record.id).set(record);
  },

  async updateExecution(executionId: string, update: Partial<ExecutionRecord>): Promise<void> {
    const db = getDb();
    await db.collection(EXECUTIONS_COLLECTION).doc(executionId).update(update);
  },

  async getExecutions(agentId: string, limit = 20): Promise<ExecutionRecord[]> {
    const db = getDb();
    const snapshot = await db
      .collection(EXECUTIONS_COLLECTION)
      .where('agentId', '==', agentId)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data() as ExecutionRecord);
  },

  async getRecentExecutions(userId: string, limit = 50): Promise<ExecutionRecord[]> {
    const db = getDb();
    const snapshot = await db
      .collection(EXECUTIONS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data() as ExecutionRecord);
  },

  async getAllRecentExecutions(limit = 50): Promise<ExecutionRecord[]> {
    const db = getDb();
    const snapshot = await db
      .collection(EXECUTIONS_COLLECTION)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(d => d.data() as ExecutionRecord);
  },
};
