/* ═══════════════════════════════════════════════════════════
   Feedback Store — Firestore persistence for execution feedback

   Stores user feedback, ratings, and corrections to enable
   agent learning and improvement over time.

   Collection: execution_feedback/{feedbackId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const FEEDBACK_COLLECTION = 'execution_feedback';

// Lazy initialization state
let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

// In-memory fallback
const memoryFeedback = new Map<string, ExecutionFeedback>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(FEEDBACK_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  FeedbackStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

export type FeedbackOutcome = 'success' | 'failure' | 'partial' | 'user_corrected';

export interface UserCorrection {
  field: string;
  before: string;
  after: string;
}

export interface ExecutionFeedback {
  id: string;
  executionId: string;
  agentId: string;
  crewId?: string;
  userId?: string;
  outcome: FeedbackOutcome;
  userCorrections?: UserCorrection[];
  rating?: number;
  feedbackText?: string;
  timestamp: string;
}

export interface FeedbackPattern {
  type: 'common_failure' | 'improvement_opportunity' | 'strength';
  description: string;
  frequency: number;
  examples: string[];
  suggestedAction?: string;
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 FeedbackStore: Firebase Admin initialized');
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

function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T;
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key as keyof T] = obj[key];
    }
  }
  return result;
}

export const FeedbackStore = {
  /** Save feedback */
  async save(feedback: ExecutionFeedback): Promise<void> {
    memoryFeedback.set(feedback.id, feedback);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const cleanFeedback = removeUndefined(feedback);
      await db.collection(FEEDBACK_COLLECTION).doc(feedback.id).set(cleanFeedback);
    }
    logger.info(`✅ Feedback saved: ${feedback.id} for agent ${feedback.agentId}`);
  },

  /** Get feedback by ID */
  async get(feedbackId: string): Promise<ExecutionFeedback | null> {
    const memFeedback = memoryFeedback.get(feedbackId);
    if (memFeedback) return memFeedback;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(FEEDBACK_COLLECTION).doc(feedbackId).get();
      if (doc.exists) {
        const feedback = doc.data() as ExecutionFeedback;
        memoryFeedback.set(feedbackId, feedback);
        return feedback;
      }
    }
    return null;
  },

  /** Get all feedback for an agent */
  async getByAgent(agentId: string, limit = 100): Promise<ExecutionFeedback[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(FEEDBACK_COLLECTION)
        .where('agentId', '==', agentId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      const feedback = snapshot.docs.map(d => d.data() as ExecutionFeedback);
      feedback.forEach(f => memoryFeedback.set(f.id, f));
      return feedback;
    }
    
    return Array.from(memoryFeedback.values())
      .filter(f => f.agentId === agentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  /** Get all feedback for a crew */
  async getByCrew(crewId: string, limit = 100): Promise<ExecutionFeedback[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(FEEDBACK_COLLECTION)
        .where('crewId', '==', crewId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(d => d.data() as ExecutionFeedback);
    }
    
    return Array.from(memoryFeedback.values())
      .filter(f => f.crewId === crewId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  /** Get feedback by execution ID */
  async getByExecution(executionId: string): Promise<ExecutionFeedback | null> {
    const fromMemory = Array.from(memoryFeedback.values())
      .find(f => f.executionId === executionId);
    if (fromMemory) return fromMemory;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db
        .collection(FEEDBACK_COLLECTION)
        .where('executionId', '==', executionId)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const feedback = snapshot.docs[0].data() as ExecutionFeedback;
        memoryFeedback.set(feedback.id, feedback);
        return feedback;
      }
    }
    return null;
  },

  /** Analyze patterns for an agent */
  async analyzePatterns(agentId: string): Promise<FeedbackPattern[]> {
    const feedback = await this.getByAgent(agentId, 200);
    const patterns: FeedbackPattern[] = [];

    // Analyze failure patterns
    const failures = feedback.filter(f => f.outcome === 'failure');
    if (failures.length >= 3) {
      const failureTexts = failures
        .map(f => f.feedbackText)
        .filter(Boolean) as string[];
      
      patterns.push({
        type: 'common_failure',
        description: `Agent has ${failures.length} recorded failures out of ${feedback.length} executions`,
        frequency: failures.length,
        examples: failureTexts.slice(0, 3),
        suggestedAction: 'Review failure cases and improve error handling or prompts',
      });
    }

    // Analyze correction patterns
    const corrections = feedback.filter(
      f => f.userCorrections && f.userCorrections.length > 0
    );
    if (corrections.length >= 2) {
      const correctedFields = corrections.flatMap(
        f => f.userCorrections?.map(c => c.field) || []
      );
      const fieldCounts = correctedFields.reduce((acc, field) => {
        acc[field] = (acc[field] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sortedFields = Object.entries(fieldCounts)
        .sort((a, b) => b[1] - a[1]);

      if (sortedFields.length > 0) {
        const [topField, count] = sortedFields[0];
        patterns.push({
          type: 'improvement_opportunity',
          description: `"${topField}" field was corrected ${count} times`,
          frequency: count,
          examples: corrections
            .flatMap(f => f.userCorrections || [])
            .filter(c => c.field === topField)
            .slice(0, 3)
            .map(c => `"${c.before}" → "${c.after}"`),
          suggestedAction: `Review and improve the logic for generating "${topField}"`,
        });
      }
    }

    // Identify strengths
    const successes = feedback.filter(f => f.outcome === 'success');
    const successRate = feedback.length > 0 
      ? successes.length / feedback.length 
      : 0;
    
    if (successRate >= 0.8 && feedback.length >= 5) {
      patterns.push({
        type: 'strength',
        description: `High success rate: ${Math.round(successRate * 100)}% (${successes.length}/${feedback.length})`,
        frequency: successes.length,
        examples: [],
      });
    }

    // High rating pattern
    const ratedFeedback = feedback.filter(f => f.rating !== undefined);
    if (ratedFeedback.length >= 3) {
      const avgRating = ratedFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / ratedFeedback.length;
      if (avgRating >= 4) {
        patterns.push({
          type: 'strength',
          description: `High average rating: ${avgRating.toFixed(1)}/5 from ${ratedFeedback.length} reviews`,
          frequency: ratedFeedback.length,
          examples: [],
        });
      }
    }

    return patterns;
  },

  /** Get aggregate stats for an agent */
  async getStats(agentId: string): Promise<{
    totalFeedback: number;
    averageRating: number;
    outcomeDistribution: Record<FeedbackOutcome, number>;
    correctionRate: number;
  }> {
    const feedback = await this.getByAgent(agentId, 500);
    
    const outcomeDistribution: Record<FeedbackOutcome, number> = {
      success: 0,
      failure: 0,
      partial: 0,
      user_corrected: 0,
    };

    let totalRating = 0;
    let ratingCount = 0;
    let correctionCount = 0;

    feedback.forEach(f => {
      outcomeDistribution[f.outcome]++;
      if (f.rating !== undefined) {
        totalRating += f.rating;
        ratingCount++;
      }
      if (f.userCorrections && f.userCorrections.length > 0) {
        correctionCount++;
      }
    });

    return {
      totalFeedback: feedback.length,
      averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      outcomeDistribution,
      correctionRate: feedback.length > 0 ? correctionCount / feedback.length : 0,
    };
  },

  /** Add to memory (for syncing) */
  addToMemory(feedback: ExecutionFeedback): void {
    memoryFeedback.set(feedback.id, feedback);
  },
};
