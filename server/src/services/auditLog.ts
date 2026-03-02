/* ═══════════════════════════════════════════════════════════
   Audit Logging Service
   
   Tracks security-sensitive operations for compliance and
   forensics. Stores logs in Firestore with retention policies.
   ═══════════════════════════════════════════════════════════ */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger, LogContext } from './logger.js';

const AUDIT_LOG_COLLECTION = 'audit_logs';

// Audit event categories
export type AuditCategory = 
  | 'authentication'
  | 'authorization'
  | 'agent_management'
  | 'crew_management'
  | 'execution'
  | 'budget'
  | 'data_access'
  | 'configuration'
  | 'user_management';

// Audit event actions
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'login'
  | 'logout'
  | 'permission_change'
  | 'settings_change'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject';

// Audit event outcome
export type AuditOutcome = 'success' | 'failure' | 'denied';

export interface AuditEvent {
  id?: string;
  timestamp: Date;
  category: AuditCategory;
  action: AuditAction;
  outcome: AuditOutcome;
  
  // Actor information
  actorId: string;
  actorType: 'user' | 'agent' | 'system' | 'api_key';
  actorEmail?: string;
  actorIp?: string;
  actorUserAgent?: string;
  
  // Resource information
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  
  // Change details
  changes?: {
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }[];
  
  // Context
  correlationId?: string;
  requestPath?: string;
  requestMethod?: string;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
  
  // Risk indicators
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  flagged?: boolean;
  flagReason?: string;
}

// High-risk operations that should be flagged
const HIGH_RISK_OPERATIONS: Array<{ category: AuditCategory; action: AuditAction }> = [
  { category: 'user_management', action: 'delete' },
  { category: 'user_management', action: 'permission_change' },
  { category: 'budget', action: 'settings_change' },
  { category: 'configuration', action: 'settings_change' },
  { category: 'agent_management', action: 'delete' },
  { category: 'data_access', action: 'export' },
];

// Determine risk level based on operation
function calculateRiskLevel(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent['riskLevel'] {
  // Failed auth attempts are always high risk
  if (event.category === 'authentication' && event.outcome === 'failure') {
    return 'high';
  }
  
  // Denied operations are medium risk
  if (event.outcome === 'denied') {
    return 'medium';
  }
  
  // Check high-risk operations
  for (const op of HIGH_RISK_OPERATIONS) {
    if (event.category === op.category && event.action === op.action) {
      return event.outcome === 'success' ? 'high' : 'critical';
    }
  }
  
  // Delete operations are always at least medium
  if (event.action === 'delete') {
    return 'medium';
  }
  
  return 'low';
}

// Check if operation should be flagged for review
function shouldFlag(event: AuditEvent): { flagged: boolean; reason?: string } {
  // Multiple failed login attempts (would need aggregation)
  if (event.category === 'authentication' && event.outcome === 'failure') {
    return { flagged: true, reason: 'Failed authentication attempt' };
  }
  
  // Permission denied
  if (event.outcome === 'denied') {
    return { flagged: true, reason: 'Access denied to protected resource' };
  }
  
  // Bulk operations
  if (event.metadata?.count && (event.metadata.count as number) > 10) {
    return { flagged: true, reason: 'Bulk operation detected' };
  }
  
  // High-risk operations
  if (event.riskLevel === 'critical' || event.riskLevel === 'high') {
    return { flagged: true, reason: 'High-risk operation' };
  }
  
  return { flagged: false };
}

export const AuditLog = {
  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'correlationId'>): Promise<string> {
    const db = getFirestore();
    
    // Add context from async local storage
    const context = LogContext.generateId;
    const correlationId = logger.getCorrelationId();
    
    const fullEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
      correlationId,
      riskLevel: event.riskLevel || calculateRiskLevel(event),
    };
    
    // Check if should be flagged
    const flagInfo = shouldFlag(fullEvent);
    fullEvent.flagged = flagInfo.flagged;
    fullEvent.flagReason = flagInfo.reason;
    
    try {
      const docRef = await db.collection(AUDIT_LOG_COLLECTION).add({
        ...fullEvent,
        timestamp: FieldValue.serverTimestamp(),
      });
      
      // Also log to standard logger for real-time visibility
      const logLevel = fullEvent.outcome === 'failure' || fullEvent.outcome === 'denied' ? 'warn' : 'info';
      logger[logLevel](`Audit: ${event.category}.${event.action}`, {
        outcome: event.outcome,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        actorId: event.actorId,
        riskLevel: fullEvent.riskLevel,
        flagged: fullEvent.flagged,
      });
      
      return docRef.id;
    } catch (err) {
      logger.error('Failed to write audit log', { error: err, event });
      throw err;
    }
  },

  /**
   * Quick audit helpers for common operations
   */
  async agentCreated(actorId: string, agentId: string, agentName: string, metadata?: Record<string, unknown>) {
    return this.log({
      category: 'agent_management',
      action: 'create',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType: 'agent',
      resourceId: agentId,
      resourceName: agentName,
      metadata,
    });
  },

  async agentDeleted(actorId: string, agentId: string, agentName: string) {
    return this.log({
      category: 'agent_management',
      action: 'delete',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType: 'agent',
      resourceId: agentId,
      resourceName: agentName,
    });
  },

  async executionStarted(actorId: string, executionId: string, agentId: string) {
    return this.log({
      category: 'execution',
      action: 'execute',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType: 'execution',
      resourceId: executionId,
      metadata: { agentId },
    });
  },

  async budgetChanged(actorId: string, userId: string, changes: AuditEvent['changes']) {
    return this.log({
      category: 'budget',
      action: 'settings_change',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType: 'budget',
      resourceId: userId,
      changes,
    });
  },

  async permissionChanged(actorId: string, targetUserId: string, changes: AuditEvent['changes']) {
    return this.log({
      category: 'user_management',
      action: 'permission_change',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType: 'user',
      resourceId: targetUserId,
      changes,
    });
  },

  async accessDenied(actorId: string, resourceType: string, resourceId: string, reason: string) {
    return this.log({
      category: 'authorization',
      action: 'read',
      outcome: 'denied',
      actorId,
      actorType: 'user',
      resourceType,
      resourceId,
      metadata: { reason },
    });
  },

  async dataExported(actorId: string, resourceType: string, count: number) {
    return this.log({
      category: 'data_access',
      action: 'export',
      outcome: 'success',
      actorId,
      actorType: 'user',
      resourceType,
      metadata: { count },
    });
  },

  /**
   * Query audit logs
   */
  async query(options: {
    actorId?: string;
    category?: AuditCategory;
    action?: AuditAction;
    outcome?: AuditOutcome;
    resourceType?: string;
    resourceId?: string;
    flaggedOnly?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const db = getFirestore();
    let query = db.collection(AUDIT_LOG_COLLECTION)
      .orderBy('timestamp', 'desc');
    
    if (options.actorId) {
      query = query.where('actorId', '==', options.actorId);
    }
    if (options.category) {
      query = query.where('category', '==', options.category);
    }
    if (options.action) {
      query = query.where('action', '==', options.action);
    }
    if (options.outcome) {
      query = query.where('outcome', '==', options.outcome);
    }
    if (options.resourceType) {
      query = query.where('resourceType', '==', options.resourceType);
    }
    if (options.resourceId) {
      query = query.where('resourceId', '==', options.resourceId);
    }
    if (options.flaggedOnly) {
      query = query.where('flagged', '==', true);
    }
    if (options.startDate) {
      query = query.where('timestamp', '>=', Timestamp.fromDate(options.startDate));
    }
    if (options.endDate) {
      query = query.where('timestamp', '<=', Timestamp.fromDate(options.endDate));
    }
    
    query = query.limit(options.limit || 100);
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp)?.toDate() || new Date(),
    })) as AuditEvent[];
  },

  /**
   * Get flagged events for review
   */
  async getFlaggedEvents(limit = 50): Promise<AuditEvent[]> {
    return this.query({ flaggedOnly: true, limit });
  },

  /**
   * Get recent high-risk events
   */
  async getHighRiskEvents(hours = 24, limit = 100): Promise<AuditEvent[]> {
    const db = getFirestore();
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const snapshot = await db.collection(AUDIT_LOG_COLLECTION)
      .where('timestamp', '>=', Timestamp.fromDate(startDate))
      .where('riskLevel', 'in', ['high', 'critical'])
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp)?.toDate() || new Date(),
    })) as AuditEvent[];
  },

  /**
   * Get summary statistics
   */
  async getStats(startDate: Date, endDate: Date): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byOutcome: Record<string, number>;
    byRiskLevel: Record<string, number>;
    flaggedCount: number;
  }> {
    const events = await this.query({ startDate, endDate, limit: 10000 });
    
    const stats = {
      total: events.length,
      byCategory: {} as Record<string, number>,
      byOutcome: {} as Record<string, number>,
      byRiskLevel: {} as Record<string, number>,
      flaggedCount: 0,
    };
    
    for (const event of events) {
      stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;
      stats.byOutcome[event.outcome] = (stats.byOutcome[event.outcome] || 0) + 1;
      if (event.riskLevel) {
        stats.byRiskLevel[event.riskLevel] = (stats.byRiskLevel[event.riskLevel] || 0) + 1;
      }
      if (event.flagged) {
        stats.flaggedCount++;
      }
    }
    
    return stats;
  },
};
