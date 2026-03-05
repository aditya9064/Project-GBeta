/* ═══════════════════════════════════════════════════════════
   Token Store (Firestore in production, in-memory locally)
   
   Persists OAuth tokens across Cloud Function invocations.
   
   Cloud Functions are stateless — each request could spin up
   a fresh instance with no in-memory state. This store keeps
   OAuth tokens in Firestore so connections survive restarts.
   
   In local dev (when Firestore is unavailable), falls back to
   an in-memory store so the server runs without errors.
   
   Collection: oauth_tokens/{service}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

/* ─── Firestore initialization (may fail locally) ──────── */

let db: Firestore | null = null;
let firestoreAvailable = false;

try {
  if (getApps().length === 0) {
    initializeApp();
  }
  db = getFirestore();
  firestoreAvailable = true;
} catch (err) {
  logger.warn('Firestore unavailable — using in-memory token store for local dev');
}

const COLLECTION = 'oauth_tokens';

/* ─── In-memory fallback for local development ─────────── */

const memoryStore = new Map<string, StoredTokenData>();

export interface StoredTokenData {
  tokens: Record<string, unknown>;
  connection: Record<string, unknown>;
  updatedAt: Date;
}

/* ─── Firestore connectivity check (runs once) ─────────── */

let firestoreChecked = false;

async function ensureFirestore(): Promise<boolean> {
  if (!db || !firestoreAvailable) return false;
  if (firestoreChecked) return firestoreAvailable;

  try {
    // Quick read to verify Firestore is accessible (avoid reserved __ prefix)
    await db.collection(COLLECTION).doc('health_check').get();
    firestoreChecked = true;
    logger.info('Firestore is accessible for token storage');
    return true;
  } catch (err: any) {
    // Log the actual error for debugging
    logger.error('Firestore check failed', { error: err?.message || err, code: err?.code, details: err?.details });
    firestoreAvailable = false;
    firestoreChecked = true;
    logger.warn('Falling back to in-memory token store');
    return false;
  }
}

export const TokenStore = {
  /** Save tokens for a service (gmail, slack, teams) */
  async save(service: string, tokens: Record<string, unknown>, connection: Record<string, unknown>): Promise<void> {
    const data: StoredTokenData = {
      tokens,
      connection: {
        ...connection,
        connectedAt: connection.connectedAt instanceof Date
          ? connection.connectedAt.toISOString()
          : connection.connectedAt,
        lastSyncAt: connection.lastSyncAt instanceof Date
          ? connection.lastSyncAt.toISOString()
          : connection.lastSyncAt,
      },
      updatedAt: new Date(),
    };

    // Always save to memory
    memoryStore.set(service, data);

    // Try Firestore too
    if (await ensureFirestore()) {
      try {
        await db!.collection(COLLECTION).doc(service).set({
          ...data,
          updatedAt: data.updatedAt.toISOString(),
        });
        logger.info(`Saved ${service} tokens to Firestore`);
      } catch (err) {
        // Silently fall back — already in memory
      }
    }
  },

  /** Load stored tokens for a service */
  async load(service: string): Promise<StoredTokenData | null> {
    // Try Firestore first
    if (await ensureFirestore()) {
      try {
        const doc = await db!.collection(COLLECTION).doc(service).get();
        if (doc.exists) {
          const d = doc.data()!;
          const result: StoredTokenData = {
            tokens: d.tokens,
            connection: {
              ...d.connection,
              connectedAt: d.connection.connectedAt
                ? new Date(d.connection.connectedAt)
                : undefined,
              lastSyncAt: d.connection.lastSyncAt
                ? new Date(d.connection.lastSyncAt)
                : undefined,
            },
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
          };
          memoryStore.set(service, result); // Cache in memory
          return result;
        }
      } catch {
        // Fall through to memory
      }
    }

    // Fall back to in-memory store
    return memoryStore.get(service) || null;
  },

  /** Delete stored tokens for a service */
  async delete(service: string): Promise<void> {
    memoryStore.delete(service);

    if (await ensureFirestore()) {
      try {
        await db!.collection(COLLECTION).doc(service).delete();
        logger.info(`Deleted ${service} tokens from Firestore`);
      } catch {
        // Silently ignore — already removed from memory
      }
    }
  },
};

