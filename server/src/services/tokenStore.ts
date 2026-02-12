/* ═══════════════════════════════════════════════════════════
   Firestore Token Store
   
   Persists OAuth tokens across Cloud Function invocations.
   
   Cloud Functions are stateless — each request could spin up
   a fresh instance with no in-memory state. This store keeps
   OAuth tokens in Firestore so connections survive restarts.
   
   Collection: oauth_tokens/{service}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (auto-credentials in Cloud Functions)
if (getApps().length === 0) {
  initializeApp();
}

const db: Firestore = getFirestore();
const COLLECTION = 'oauth_tokens';

export interface StoredTokenData {
  tokens: Record<string, unknown>;
  connection: Record<string, unknown>;
  updatedAt: Date;
}

export const TokenStore = {
  /** Save tokens for a service (gmail, slack, teams) */
  async save(service: string, tokens: Record<string, unknown>, connection: Record<string, unknown>): Promise<void> {
    try {
      await db.collection(COLLECTION).doc(service).set({
        tokens,
        connection: {
          ...connection,
          // Convert Date objects to ISO strings for Firestore
          connectedAt: connection.connectedAt instanceof Date
            ? connection.connectedAt.toISOString()
            : connection.connectedAt,
          lastSyncAt: connection.lastSyncAt instanceof Date
            ? connection.lastSyncAt.toISOString()
            : connection.lastSyncAt,
        },
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Saved ${service} tokens to Firestore`);
    } catch (err) {
      console.error(`❌ Failed to save ${service} tokens:`, err);
    }
  },

  /** Load stored tokens for a service */
  async load(service: string): Promise<StoredTokenData | null> {
    try {
      const doc = await db.collection(COLLECTION).doc(service).get();
      if (!doc.exists) return null;
      
      const data = doc.data()!;
      return {
        tokens: data.tokens,
        connection: {
          ...data.connection,
          // Restore Date objects
          connectedAt: data.connection.connectedAt
            ? new Date(data.connection.connectedAt)
            : undefined,
          lastSyncAt: data.connection.lastSyncAt
            ? new Date(data.connection.lastSyncAt)
            : undefined,
        },
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      };
    } catch (err) {
      console.error(`❌ Failed to load ${service} tokens:`, err);
      return null;
    }
  },

  /** Delete stored tokens for a service */
  async delete(service: string): Promise<void> {
    try {
      await db.collection(COLLECTION).doc(service).delete();
      console.log(`🗑️ Deleted ${service} tokens from Firestore`);
    } catch (err) {
      console.error(`❌ Failed to delete ${service} tokens:`, err);
    }
  },
};

