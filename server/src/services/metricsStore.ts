/* ═══════════════════════════════════════════════════════════
   Metrics Store — Firestore persistence for agent metrics

   Stores execution metrics, success rates, and performance data
   for agents and crews with period-based aggregations.

   Collection: agent_metrics/{metricId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const METRICS_COLLECTION = 'agent_metrics';
const CREW_METRICS_COLLECTION = 'crew_metrics';
const EXECUTION_LOG_COLLECTION = 'execution_logs';

// Lazy initialization state
let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

// In-memory fallback
const memoryMetrics = new Map<string, AgentMetrics>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(METRICS_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  MetricsStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

export type MetricPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface AgentMetrics {
  id: string;
  agentId: string;
  agentName: string;
  period: MetricPeriod;
  periodStart: string;
  periodEnd: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  totalCost: number;
  userCorrections: number;
  successRate: number;
  updatedAt: string;
}

export interface CrewMetrics {
  id: string;
  crewId: string;
  crewName: string;
  period: MetricPeriod;
  periodStart: string;
  periodEnd: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  totalCost: number;
  memberContributions: {
    agentId: string;
    agentName: string;
    executionCount: number;
    successRate: number;
  }[];
  successRate: number;
  updatedAt: string;
}

export interface WorkforceSummary {
  totalAgents: number;
  activeAgents: number;
  totalCrews: number;
  activeCrews: number;
  totalExecutions: number;
  successRate: number;
  avgDurationMs: number;
  totalCost: number;
  topPerformers: AgentMetrics[];
  healthScore: number;
  lastUpdated: string;
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 MetricsStore: Firebase Admin initialized');
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

function getMetricId(agentId: string, period: MetricPeriod, periodStart: string): string {
  return `${agentId}_${period}_${periodStart}`;
}

function getPeriodStart(period: MetricPeriod): string {
  const now = new Date();
  switch (period) {
    case 'daily':
      return now.toISOString().split('T')[0];
    case 'weekly': {
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      return weekStart.toISOString().split('T')[0];
    }
    case 'monthly':
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    case 'all_time':
      return '2020-01-01';
  }
}

function getPeriodEnd(period: MetricPeriod, start: string): string {
  const startDate = new Date(start);
  switch (period) {
    case 'daily':
      return start;
    case 'weekly': {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      return endDate.toISOString().split('T')[0];
    }
    case 'monthly': {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      return endDate.toISOString().split('T')[0];
    }
    case 'all_time':
      return new Date().toISOString().split('T')[0];
  }
}

export const MetricsStore = {
  /** Record an execution for metrics */
  async recordExecution(
    agentId: string,
    agentName: string,
    success: boolean,
    durationMs: number,
    cost = 0,
    hadCorrections = false
  ): Promise<void> {
    const periods: MetricPeriod[] = ['daily', 'weekly', 'monthly', 'all_time'];
    
    for (const period of periods) {
      const periodStart = getPeriodStart(period);
      const metricId = getMetricId(agentId, period, periodStart);
      
      let existing = await this.get(metricId);
      
      if (!existing) {
        existing = {
          id: metricId,
          agentId,
          agentName,
          period,
          periodStart,
          periodEnd: getPeriodEnd(period, periodStart),
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          avgDurationMs: 0,
          minDurationMs: durationMs,
          maxDurationMs: durationMs,
          totalCost: 0,
          userCorrections: 0,
          successRate: 0,
          updatedAt: new Date().toISOString(),
        };
      }
      
      const newTotal = existing.totalExecutions + 1;
      const newAvgDuration = 
        ((existing.avgDurationMs * existing.totalExecutions) + durationMs) / newTotal;
      
      existing.totalExecutions = newTotal;
      existing.successCount += success ? 1 : 0;
      existing.failureCount += success ? 0 : 1;
      existing.avgDurationMs = Math.round(newAvgDuration);
      existing.minDurationMs = Math.min(existing.minDurationMs, durationMs);
      existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
      existing.totalCost += cost;
      existing.userCorrections += hadCorrections ? 1 : 0;
      existing.successRate = existing.successCount / existing.totalExecutions;
      existing.updatedAt = new Date().toISOString();
      
      await this.save(existing);
    }
  },

  /** Save metrics */
  async save(metrics: AgentMetrics): Promise<void> {
    memoryMetrics.set(metrics.id, metrics);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(METRICS_COLLECTION).doc(metrics.id).set(metrics, { merge: true });
    }
  },

  /** Get metrics by ID */
  async get(metricId: string): Promise<AgentMetrics | null> {
    const memMetric = memoryMetrics.get(metricId);
    if (memMetric) return memMetric;
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(METRICS_COLLECTION).doc(metricId).get();
      if (doc.exists) {
        const metrics = doc.data() as AgentMetrics;
        memoryMetrics.set(metricId, metrics);
        return metrics;
      }
    }
    return null;
  },

  /** Get metrics for an agent */
  async getByAgent(agentId: string, period: MetricPeriod = 'weekly'): Promise<AgentMetrics | null> {
    const periodStart = getPeriodStart(period);
    const metricId = getMetricId(agentId, period, periodStart);
    return this.get(metricId);
  },

  /** Get all agent metrics for a period */
  async getAllAgentMetrics(period: MetricPeriod = 'weekly', userId?: string): Promise<AgentMetrics[]> {
    const periodStart = getPeriodStart(period);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      let query = db.collection(METRICS_COLLECTION)
        .where('period', '==', period)
        .where('periodStart', '==', periodStart);
      
      const snapshot = await query.get();
      const metrics = snapshot.docs.map(d => d.data() as AgentMetrics);
      metrics.forEach(m => memoryMetrics.set(m.id, m));
      return metrics.sort((a, b) => b.successRate - a.successRate);
    }
    
    return Array.from(memoryMetrics.values())
      .filter(m => m.period === period && m.periodStart === periodStart)
      .sort((a, b) => b.successRate - a.successRate);
  },

  /** Get workforce summary */
  async getSummary(userId?: string): Promise<WorkforceSummary> {
    const metrics = await this.getAllAgentMetrics('weekly');
    
    const totalExecutions = metrics.reduce((sum, m) => sum + m.totalExecutions, 0);
    const totalSuccess = metrics.reduce((sum, m) => sum + m.successCount, 0);
    const totalDuration = metrics.reduce(
      (sum, m) => sum + m.avgDurationMs * m.totalExecutions,
      0
    );
    const totalCost = metrics.reduce((sum, m) => sum + m.totalCost, 0);
    
    const activeAgents = new Set(metrics.map(m => m.agentId)).size;
    const successRate = totalExecutions > 0 ? totalSuccess / totalExecutions : 0;
    const avgDurationMs = totalExecutions > 0 ? totalDuration / totalExecutions : 0;
    const healthScore = Math.round(successRate * 100);
    
    const topPerformers = metrics
      .filter(m => m.totalExecutions >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);
    
    return {
      totalAgents: activeAgents,
      activeAgents,
      totalCrews: 0,
      activeCrews: 0,
      totalExecutions,
      successRate,
      avgDurationMs,
      totalCost,
      topPerformers,
      healthScore,
      lastUpdated: new Date().toISOString(),
    };
  },

  /** Get metrics trends */
  async getTrends(agentId?: string, days = 7): Promise<{ period: string; executions: number; successRate: number; avgDuration: number; cost: number }[]> {
    const trends: { period: string; executions: number; successRate: number; avgDuration: number; cost: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (agentId) {
        const metricId = getMetricId(agentId, 'daily', dateStr);
        const metric = await this.get(metricId);
        
        if (metric) {
          trends.push({
            period: dateStr,
            executions: metric.totalExecutions,
            successRate: metric.successRate,
            avgDuration: metric.avgDurationMs,
            cost: metric.totalCost,
          });
        } else {
          trends.push({
            period: dateStr,
            executions: 0,
            successRate: 0,
            avgDuration: 0,
            cost: 0,
          });
        }
      } else {
        const allMetrics = Array.from(memoryMetrics.values())
          .filter(m => m.period === 'daily' && m.periodStart === dateStr);
        
        const totalExec = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
        const totalSuccess = allMetrics.reduce((sum, m) => sum + m.successCount, 0);
        const totalDur = allMetrics.reduce(
          (sum, m) => sum + m.avgDurationMs * m.totalExecutions,
          0
        );
        const totalCost = allMetrics.reduce((sum, m) => sum + m.totalCost, 0);
        
        trends.push({
          period: dateStr,
          executions: totalExec,
          successRate: totalExec > 0 ? totalSuccess / totalExec : 0,
          avgDuration: totalExec > 0 ? totalDur / totalExec : 0,
          cost: totalCost,
        });
      }
    }
    
    return trends;
  },

  /** Add to memory */
  addToMemory(metrics: AgentMetrics): void {
    memoryMetrics.set(metrics.id, metrics);
  },

  /** Record crew execution */
  async recordCrewExecution(
    crewId: string,
    crewName: string,
    success: boolean,
    durationMs: number,
    cost = 0,
    memberContributions: { agentId: string; agentName: string; success: boolean }[] = []
  ): Promise<void> {
    const periods: MetricPeriod[] = ['daily', 'weekly', 'monthly', 'all_time'];
    
    for (const period of periods) {
      const periodStart = getPeriodStart(period);
      const metricId = `crew_${crewId}_${period}_${periodStart}`;
      
      let existing = await this.getCrewMetrics(metricId);
      
      if (!existing) {
        existing = {
          id: metricId,
          crewId,
          crewName,
          period,
          periodStart,
          periodEnd: getPeriodEnd(period, periodStart),
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          avgDurationMs: 0,
          totalCost: 0,
          memberContributions: [],
          successRate: 0,
          updatedAt: new Date().toISOString(),
        };
      }
      
      const newTotal = existing.totalExecutions + 1;
      const newAvgDuration = 
        ((existing.avgDurationMs * existing.totalExecutions) + durationMs) / newTotal;
      
      existing.totalExecutions = newTotal;
      existing.successCount += success ? 1 : 0;
      existing.failureCount += success ? 0 : 1;
      existing.avgDurationMs = Math.round(newAvgDuration);
      existing.totalCost += cost;
      existing.successRate = existing.successCount / existing.totalExecutions;
      existing.updatedAt = new Date().toISOString();
      
      // Update member contributions
      for (const contrib of memberContributions) {
        const existingMember = existing.memberContributions.find(m => m.agentId === contrib.agentId);
        if (existingMember) {
          existingMember.executionCount++;
          existingMember.successRate = contrib.success 
            ? (existingMember.successRate * (existingMember.executionCount - 1) + 1) / existingMember.executionCount
            : (existingMember.successRate * (existingMember.executionCount - 1)) / existingMember.executionCount;
        } else {
          existing.memberContributions.push({
            agentId: contrib.agentId,
            agentName: contrib.agentName,
            executionCount: 1,
            successRate: contrib.success ? 1 : 0,
          });
        }
      }
      
      await this.saveCrewMetrics(existing);
    }
  },

  /** Save crew metrics */
  async saveCrewMetrics(metrics: CrewMetrics): Promise<void> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(CREW_METRICS_COLLECTION).doc(metrics.id).set(metrics, { merge: true });
    }
  },

  /** Get crew metrics */
  async getCrewMetrics(metricId: string): Promise<CrewMetrics | null> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(CREW_METRICS_COLLECTION).doc(metricId).get();
      if (doc.exists) {
        return doc.data() as CrewMetrics;
      }
    }
    return null;
  },

  /** Get all crew metrics */
  async getAllCrewMetrics(period: MetricPeriod = 'weekly'): Promise<CrewMetrics[]> {
    const periodStart = getPeriodStart(period);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db.collection(CREW_METRICS_COLLECTION)
        .where('period', '==', period)
        .where('periodStart', '==', periodStart)
        .get();
      
      return snapshot.docs.map(d => d.data() as CrewMetrics)
        .sort((a, b) => b.successRate - a.successRate);
    }
    
    return [];
  },

  /** Log an execution for detailed tracking */
  async logExecution(log: {
    executionId: string;
    agentId: string;
    agentName: string;
    crewId?: string;
    crewName?: string;
    success: boolean;
    durationMs: number;
    cost: number;
    nodeCount: number;
    errorMessage?: string;
    trigger: string;
    userId: string;
    timestamp: string;
  }): Promise<void> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(EXECUTION_LOG_COLLECTION).doc(log.executionId).set(log);
    }
  },

  /** Get recent executions */
  async getRecentExecutions(limit = 50, agentId?: string, crewId?: string): Promise<any[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      let query = db.collection(EXECUTION_LOG_COLLECTION)
        .orderBy('timestamp', 'desc')
        .limit(limit);
      
      if (agentId) {
        query = db.collection(EXECUTION_LOG_COLLECTION)
          .where('agentId', '==', agentId)
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      
      if (crewId) {
        query = db.collection(EXECUTION_LOG_COLLECTION)
          .where('crewId', '==', crewId)
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(d => d.data());
    }
    
    return [];
  },

  /** Get execution stats for a time range */
  async getExecutionStats(startDate: string, endDate: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    totalCost: number;
    byAgent: { agentId: string; agentName: string; count: number; successRate: number }[];
    byCrew: { crewId: string; crewName: string; count: number; successRate: number }[];
  }> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      const snapshot = await db.collection(EXECUTION_LOG_COLLECTION)
        .where('timestamp', '>=', startDate)
        .where('timestamp', '<=', endDate)
        .get();
      
      const logs = snapshot.docs.map(d => d.data());
      
      const byAgent = new Map<string, { agentName: string; count: number; success: number }>();
      const byCrew = new Map<string, { crewName: string; count: number; success: number }>();
      
      let totalDuration = 0;
      let totalCost = 0;
      let successful = 0;
      
      for (const log of logs) {
        if (log.success) successful++;
        totalDuration += log.durationMs || 0;
        totalCost += log.cost || 0;
        
        const agentEntry = byAgent.get(log.agentId) || { agentName: log.agentName, count: 0, success: 0 };
        agentEntry.count++;
        if (log.success) agentEntry.success++;
        byAgent.set(log.agentId, agentEntry);
        
        if (log.crewId) {
          const crewEntry = byCrew.get(log.crewId) || { crewName: log.crewName || 'Unknown', count: 0, success: 0 };
          crewEntry.count++;
          if (log.success) crewEntry.success++;
          byCrew.set(log.crewId, crewEntry);
        }
      }
      
      return {
        total: logs.length,
        successful,
        failed: logs.length - successful,
        avgDuration: logs.length > 0 ? totalDuration / logs.length : 0,
        totalCost,
        byAgent: Array.from(byAgent.entries()).map(([agentId, data]) => ({
          agentId,
          agentName: data.agentName,
          count: data.count,
          successRate: data.count > 0 ? data.success / data.count : 0,
        })),
        byCrew: Array.from(byCrew.entries()).map(([crewId, data]) => ({
          crewId,
          crewName: data.crewName,
          count: data.count,
          successRate: data.count > 0 ? data.success / data.count : 0,
        })),
      };
    }
    
    return {
      total: 0,
      successful: 0,
      failed: 0,
      avgDuration: 0,
      totalCost: 0,
      byAgent: [],
      byCrew: [],
    };
  },
};
