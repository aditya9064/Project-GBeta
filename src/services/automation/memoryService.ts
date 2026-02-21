// Agent Memory Service
// Provides persistent memory for agents across executions.
// Uses Firestore when available, falls back to localStorage.

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { MemoryEntry, MemoryScope } from './types';

const MEMORY_COLLECTION = 'agent_memory';
const SHARED_MEMORY_COLLECTION = 'shared_memory';
const LOCAL_STORAGE_KEY = 'agent_memory_store';

function localKey(agentId: string, scope: MemoryScope, key: string): string {
  return `${scope}::${agentId}::${key}`;
}

function loadLocalMemory(): Record<string, MemoryEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalMemory(store: Record<string, MemoryEntry>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to persist memory to localStorage:', e);
  }
}

function isExpired(entry: MemoryEntry): boolean {
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt).getTime() < Date.now();
}

async function tryFirestore<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export const AgentMemoryService = {
  /**
   * Write a value into agent memory.
   */
  async write(
    agentId: string,
    scope: MemoryScope,
    key: string,
    value: any,
    ttlMinutes?: number,
  ): Promise<MemoryEntry> {
    const now = new Date();
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      scope,
      key,
      value,
      createdAt: now,
      updatedAt: now,
      expiresAt: ttlMinutes ? new Date(now.getTime() + ttlMinutes * 60_000) : undefined,
    };

    // Persist to localStorage (always available)
    const store = loadLocalMemory();
    store[localKey(agentId, scope, key)] = entry;
    saveLocalMemory(store);

    // Also persist to Firestore
    const coll = scope === 'shared' ? SHARED_MEMORY_COLLECTION : MEMORY_COLLECTION;
    const docId = scope === 'shared' ? key : `${agentId}_${key}`;
    await tryFirestore(() =>
      setDoc(doc(db, coll, docId), {
        ...entry,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );

    return entry;
  },

  /**
   * Read a specific key from memory.
   */
  async read(
    agentId: string,
    scope: MemoryScope,
    key: string,
  ): Promise<any | null> {
    // Try Firestore first
    const coll = scope === 'shared' ? SHARED_MEMORY_COLLECTION : MEMORY_COLLECTION;
    const docId = scope === 'shared' ? key : `${agentId}_${key}`;

    const firestoreResult = await tryFirestore(async () => {
      const snap = await getDoc(doc(db, coll, docId));
      if (!snap.exists()) return null;
      const data = snap.data() as MemoryEntry;
      if (isExpired(data)) {
        await deleteDoc(doc(db, coll, docId));
        return null;
      }
      return data.value;
    });

    if (firestoreResult !== null) return firestoreResult;

    // Fallback to localStorage
    const store = loadLocalMemory();
    const entry = store[localKey(agentId, scope, key)];
    if (!entry) return null;
    if (isExpired(entry)) {
      delete store[localKey(agentId, scope, key)];
      saveLocalMemory(store);
      return null;
    }
    return entry.value;
  },

  /**
   * Search memory entries by substring match on keys and values.
   */
  async search(
    agentId: string,
    scope: MemoryScope,
    queryStr: string,
  ): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    const lowerQ = queryStr.toLowerCase();

    // Try Firestore
    const firestoreResults = await tryFirestore(async () => {
      const coll = scope === 'shared' ? SHARED_MEMORY_COLLECTION : MEMORY_COLLECTION;
      const constraints =
        scope === 'shared'
          ? [orderBy('updatedAt', 'desc')]
          : [where('agentId', '==', agentId), orderBy('updatedAt', 'desc')];
      const q = query(collection(db, coll), ...constraints);
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => d.data() as MemoryEntry)
        .filter((e) => !isExpired(e))
        .filter(
          (e) =>
            e.key.toLowerCase().includes(lowerQ) ||
            JSON.stringify(e.value).toLowerCase().includes(lowerQ),
        );
    });

    if (firestoreResults && firestoreResults.length > 0) return firestoreResults;

    // Fallback to localStorage
    const store = loadLocalMemory();
    for (const [lk, entry] of Object.entries(store)) {
      if (isExpired(entry)) continue;
      const matchesScope =
        scope === 'shared'
          ? lk.startsWith('shared::')
          : lk.startsWith(`${scope}::${agentId}::`);
      if (!matchesScope) continue;
      if (
        entry.key.toLowerCase().includes(lowerQ) ||
        JSON.stringify(entry.value).toLowerCase().includes(lowerQ)
      ) {
        results.push(entry);
      }
    }

    return results;
  },

  /**
   * Delete a memory entry.
   */
  async delete(agentId: string, scope: MemoryScope, key: string): Promise<boolean> {
    const store = loadLocalMemory();
    delete store[localKey(agentId, scope, key)];
    saveLocalMemory(store);

    const coll = scope === 'shared' ? SHARED_MEMORY_COLLECTION : MEMORY_COLLECTION;
    const docId = scope === 'shared' ? key : `${agentId}_${key}`;
    await tryFirestore(() => deleteDoc(doc(db, coll, docId)));

    return true;
  },

  /**
   * Get all memory for an agent (used when loading context at execution start).
   */
  async loadAgentMemory(agentId: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    const firestoreEntries = await tryFirestore(async () => {
      const q = query(
        collection(db, MEMORY_COLLECTION),
        where('agentId', '==', agentId),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as MemoryEntry);
    });

    if (firestoreEntries) {
      for (const entry of firestoreEntries) {
        if (!isExpired(entry)) {
          result[entry.key] = entry.value;
        }
      }
      return result;
    }

    // Fallback to localStorage
    const store = loadLocalMemory();
    for (const [lk, entry] of Object.entries(store)) {
      if (lk.startsWith(`agent::${agentId}::`) && !isExpired(entry)) {
        result[entry.key] = entry.value;
      }
    }

    return result;
  },

  /**
   * Clear all memory for an agent.
   */
  async clearAgentMemory(agentId: string): Promise<void> {
    const store = loadLocalMemory();
    for (const key of Object.keys(store)) {
      if (key.includes(`::${agentId}::`)) {
        delete store[key];
      }
    }
    saveLocalMemory(store);

    await tryFirestore(async () => {
      const q = query(
        collection(db, MEMORY_COLLECTION),
        where('agentId', '==', agentId),
      );
      const snap = await getDocs(q);
      const deletes = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletes);
    });
  },
};
