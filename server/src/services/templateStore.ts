/* ═══════════════════════════════════════════════════════════
   Template Store — Agent template library and sharing
   
   Allows users to save agents as templates and share them.
   Templates include workflow definitions, configurations,
   and metadata for discovery.
   
   Collection: agent_templates/{templateId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const COLLECTION = 'agent_templates';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

const memoryTemplates = new Map<string, AgentTemplate>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  TemplateStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 TemplateStore: Firebase Admin initialized');
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

export type TemplateVisibility = 'private' | 'team' | 'public';
export type TemplateCategory = 
  | 'productivity' 
  | 'sales' 
  | 'marketing' 
  | 'support' 
  | 'engineering' 
  | 'data' 
  | 'communication'
  | 'automation'
  | 'other';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  
  // Template content
  workflow: any; // WorkflowDefinition
  settings?: {
    retryOnFailure?: boolean;
    maxRetries?: number;
    timeout?: number;
    memoryEnabled?: boolean;
  };
  
  // Discovery
  category: TemplateCategory;
  tags: string[];
  capabilities: string[];
  
  // Ownership
  authorId: string;
  authorName: string;
  visibility: TemplateVisibility;
  teamId?: string;
  
  // Stats
  usageCount: number;
  rating: number;
  ratingCount: number;
  
  // Version
  version: string;
  changelog?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  tags?: string[];
  visibility?: TemplateVisibility;
  authorId?: string;
  teamId?: string;
  search?: string;
}

export interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

const memoryReviews = new Map<string, TemplateReview>();
const REVIEWS_COLLECTION = 'template_reviews';

function generateId(): string {
  return `tmpl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const TemplateStore = {
  /** Create a new template */
  async create(data: Omit<AgentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'rating' | 'ratingCount'>): Promise<AgentTemplate> {
    const template: AgentTemplate = {
      ...data,
      id: generateId(),
      usageCount: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    memoryTemplates.set(template.id, template);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(template.id).set(template);
    }
    
    logger.info(`📦 Template created: ${template.name}`);
    return template;
  },

  /** Get template by ID */
  async get(id: string): Promise<AgentTemplate | null> {
    const memTmpl = memoryTemplates.get(id);
    if (memTmpl) return memTmpl;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(COLLECTION).doc(id).get();
      if (doc.exists) {
        const tmpl = doc.data() as AgentTemplate;
        memoryTemplates.set(id, tmpl);
        return tmpl;
      }
    }
    
    return null;
  },

  /** Update a template */
  async update(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: AgentTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    memoryTemplates.set(id, updated);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(id).set(updated, { merge: true });
    }
    
    return updated;
  },

  /** List templates with filters */
  async list(filters: TemplateFilters = {}, limit = 50): Promise<AgentTemplate[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      let query = db.collection(COLLECTION).orderBy('usageCount', 'desc');
      
      if (filters.visibility) {
        query = query.where('visibility', '==', filters.visibility);
      }
      
      if (filters.authorId) {
        query = query.where('authorId', '==', filters.authorId);
      }
      
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      
      if (filters.teamId) {
        query = query.where('teamId', '==', filters.teamId);
      }
      
      query = query.limit(limit);
      
      const snapshot = await query.get();
      let results = snapshot.docs.map(d => d.data() as AgentTemplate);
      
      // Apply additional filters in-memory
      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(t => 
          filters.tags!.some(tag => t.tags.includes(tag))
        );
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      results.forEach(t => memoryTemplates.set(t.id, t));
      return results;
    }
    
    // Memory fallback
    let results = Array.from(memoryTemplates.values());
    
    if (filters.visibility) {
      results = results.filter(t => t.visibility === filters.visibility);
    }
    if (filters.authorId) {
      results = results.filter(t => t.authorId === filters.authorId);
    }
    if (filters.category) {
      results = results.filter(t => t.category === filters.category);
    }
    if (filters.teamId) {
      results = results.filter(t => t.teamId === filters.teamId);
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(t => 
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower)
      );
    }
    
    return results
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  },

  /** Get public templates (for template library) */
  async getPublicTemplates(category?: TemplateCategory, limit = 50): Promise<AgentTemplate[]> {
    return this.list({ visibility: 'public', category }, limit);
  },

  /** Get user's templates */
  async getUserTemplates(userId: string, limit = 50): Promise<AgentTemplate[]> {
    return this.list({ authorId: userId }, limit);
  },

  /** Increment usage count */
  async recordUsage(id: string): Promise<void> {
    const template = await this.get(id);
    if (template) {
      template.usageCount++;
      await this.update(id, { usageCount: template.usageCount });
    }
  },

  /** Rate a template */
  async rate(id: string, rating: number): Promise<AgentTemplate | null> {
    const template = await this.get(id);
    if (!template) return null;
    
    const newRatingCount = template.ratingCount + 1;
    const newRating = (template.rating * template.ratingCount + rating) / newRatingCount;
    
    return this.update(id, {
      rating: newRating,
      ratingCount: newRatingCount,
    });
  },

  /** Publish a template (make public) */
  async publish(id: string): Promise<AgentTemplate | null> {
    return this.update(id, {
      visibility: 'public',
      publishedAt: new Date().toISOString(),
    });
  },

  /** Unpublish a template (make private) */
  async unpublish(id: string): Promise<AgentTemplate | null> {
    return this.update(id, {
      visibility: 'private',
      publishedAt: undefined,
    });
  },

  /** Delete a template */
  async delete(id: string): Promise<boolean> {
    memoryTemplates.delete(id);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COLLECTION).doc(id).delete();
    }
    
    return true;
  },

  /** Get popular templates */
  async getPopular(limit = 10): Promise<AgentTemplate[]> {
    const templates = await this.list({ visibility: 'public' }, limit * 2);
    return templates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  },

  /** Get top-rated templates */
  async getTopRated(limit = 10): Promise<AgentTemplate[]> {
    const templates = await this.list({ visibility: 'public' }, limit * 2);
    return templates
      .filter(t => t.ratingCount >= 3) // Minimum ratings
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  },

  /** Search templates */
  async search(query: string, limit = 20): Promise<AgentTemplate[]> {
    return this.list({ visibility: 'public', search: query }, limit);
  },

  /** Get categories with counts */
  async getCategoryCounts(): Promise<{ category: TemplateCategory; count: number }[]> {
    const templates = await this.list({ visibility: 'public' }, 1000);
    const counts = new Map<TemplateCategory, number>();
    
    for (const t of templates) {
      counts.set(t.category, (counts.get(t.category) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  },

  /** Add a review to a template */
  async addReview(
    templateId: string,
    data: Omit<TemplateReview, 'id' | 'templateId' | 'helpful' | 'createdAt' | 'updatedAt'>
  ): Promise<TemplateReview> {
    const review: TemplateReview = {
      ...data,
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      templateId,
      helpful: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memoryReviews.set(review.id, review);

    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(REVIEWS_COLLECTION).doc(review.id).set(review);
    }

    // Update template rating
    await this.rate(templateId, data.rating);

    logger.info(`📝 Review added for template ${templateId}`);
    return review;
  },

  /** Get reviews for a template */
  async getReviews(templateId: string, limit = 20): Promise<TemplateReview[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db.collection(REVIEWS_COLLECTION)
        .where('templateId', '==', templateId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      const reviews = snapshot.docs.map(d => d.data() as TemplateReview);
      reviews.forEach(r => memoryReviews.set(r.id, r));
      return reviews;
    }

    return Array.from(memoryReviews.values())
      .filter(r => r.templateId === templateId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  },

  /** Mark a review as helpful */
  async markReviewHelpful(reviewId: string): Promise<TemplateReview | null> {
    const review = memoryReviews.get(reviewId);
    if (!review) {
      if (await isFirestoreAvailable()) {
        const db = getDb();
        const doc = await db.collection(REVIEWS_COLLECTION).doc(reviewId).get();
        if (!doc.exists) return null;
        const r = doc.data() as TemplateReview;
        r.helpful++;
        await db.collection(REVIEWS_COLLECTION).doc(reviewId).update({ helpful: r.helpful });
        memoryReviews.set(reviewId, r);
        return r;
      }
      return null;
    }

    review.helpful++;
    memoryReviews.set(reviewId, review);

    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(REVIEWS_COLLECTION).doc(reviewId).update({ helpful: review.helpful });
    }

    return review;
  },

  /** Get featured templates (curated selection) */
  async getFeatured(limit = 6): Promise<AgentTemplate[]> {
    const templates = await this.list({ visibility: 'public' }, 100);
    return templates
      .filter(t => t.ratingCount >= 5 && t.rating >= 4)
      .sort((a, b) => (b.rating * b.usageCount) - (a.rating * a.usageCount))
      .slice(0, limit);
  },

  /** Get recently published templates */
  async getRecent(limit = 10): Promise<AgentTemplate[]> {
    const templates = await this.list({ visibility: 'public' }, limit * 2);
    return templates
      .filter(t => t.publishedAt)
      .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
      .slice(0, limit);
  },

  /** Clone a template for a user */
  async clone(templateId: string, userId: string, userName: string): Promise<AgentTemplate | null> {
    const original = await this.get(templateId);
    if (!original) return null;

    const cloned = await this.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      icon: original.icon,
      color: original.color,
      workflow: original.workflow,
      settings: original.settings,
      category: original.category,
      tags: [...original.tags],
      capabilities: [...original.capabilities],
      authorId: userId,
      authorName: userName,
      visibility: 'private',
      version: '1.0.0',
    });

    // Record usage on original
    await this.recordUsage(templateId);

    return cloned;
  },
};
