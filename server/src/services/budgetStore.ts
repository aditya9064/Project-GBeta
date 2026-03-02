/* ═══════════════════════════════════════════════════════════
   Budget Store — Cost tracking and budget management
   
   Tracks AI usage costs, enforces budget limits, and provides
   spending analytics per agent, crew, and user.
   
   Collections:
   - budgets/{userId} — User budget settings
   - cost_entries/{entryId} — Individual cost records
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const BUDGETS_COLLECTION = 'budgets';
const COST_ENTRIES_COLLECTION = 'cost_entries';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

const memoryBudgets = new Map<string, UserBudget>();
const memoryCostEntries: CostEntry[] = [];

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(BUDGETS_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  BudgetStore: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
      logger.info('🔥 BudgetStore: Firebase Admin initialized');
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

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly';
export type CostCategory = 'ai_tokens' | 'api_calls' | 'storage' | 'compute' | 'other';

export interface UserBudget {
  userId: string;
  totalBudget: number;
  periodBudget: number;
  period: BudgetPeriod;
  currentSpend: number;
  periodStart: string;
  periodEnd: string;
  alertThreshold: number; // 0-1, e.g., 0.8 = alert at 80%
  alertsEnabled: boolean;
  hardLimit: boolean; // If true, block executions when budget exceeded
  agentBudgets?: { [agentId: string]: number }; // Per-agent limits
  crewBudgets?: { [crewId: string]: number }; // Per-crew limits
  updatedAt: string;
}

export interface CostEntry {
  id: string;
  userId: string;
  agentId?: string;
  agentName?: string;
  crewId?: string;
  crewName?: string;
  executionId?: string;
  category: CostCategory;
  amount: number;
  description: string;
  metadata?: {
    model?: string;
    tokensInput?: number;
    tokensOutput?: number;
    apiCalls?: number;
  };
  timestamp: string;
}

export interface SpendingSummary {
  totalSpend: number;
  periodSpend: number;
  budgetRemaining: number;
  budgetUtilization: number;
  byCategory: { category: CostCategory; amount: number }[];
  byAgent: { agentId: string; agentName: string; amount: number }[];
  byCrew: { crewId: string; crewName: string; amount: number }[];
  recentEntries: CostEntry[];
  projectedMonthlySpend: number;
  trends: { period: string; amount: number }[];
}

// Cost rates for different models
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 }, // per 1K tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'default': { input: 0.001, output: 0.002 },
};

function generateId(): string {
  return `cost-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function getPeriodDates(period: BudgetPeriod): { start: string; end: string } {
  const now = new Date();
  let start: Date;
  let end: Date;
  
  switch (period) {
    case 'daily':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export const BudgetStore = {
  /** Calculate cost from token usage */
  calculateTokenCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates = MODEL_COSTS[model] || MODEL_COSTS['default'];
    return (inputTokens / 1000 * rates.input) + (outputTokens / 1000 * rates.output);
  },

  /** Get or create user budget */
  async getBudget(userId: string): Promise<UserBudget> {
    let budget = memoryBudgets.get(userId);
    
    if (!budget && await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(BUDGETS_COLLECTION).doc(userId).get();
      if (doc.exists) {
        budget = doc.data() as UserBudget;
        memoryBudgets.set(userId, budget);
      }
    }
    
    if (!budget) {
      // Create default budget
      const { start, end } = getPeriodDates('monthly');
      budget = {
        userId,
        totalBudget: 100, // $100 default
        periodBudget: 100,
        period: 'monthly',
        currentSpend: 0,
        periodStart: start,
        periodEnd: end,
        alertThreshold: 0.8,
        alertsEnabled: true,
        hardLimit: false,
        updatedAt: new Date().toISOString(),
      };
      await this.saveBudget(budget);
    }
    
    // Check if period needs to be reset
    const { start: currentStart, end: currentEnd } = getPeriodDates(budget.period);
    if (budget.periodStart !== currentStart) {
      budget.periodStart = currentStart;
      budget.periodEnd = currentEnd;
      budget.currentSpend = 0;
      await this.saveBudget(budget);
    }
    
    return budget;
  },

  /** Save user budget */
  async saveBudget(budget: UserBudget): Promise<void> {
    budget.updatedAt = new Date().toISOString();
    memoryBudgets.set(budget.userId, budget);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(BUDGETS_COLLECTION).doc(budget.userId).set(budget);
    }
  },

  /** Update budget settings */
  async updateBudget(userId: string, updates: Partial<UserBudget>): Promise<UserBudget> {
    const budget = await this.getBudget(userId);
    Object.assign(budget, updates);
    await this.saveBudget(budget);
    return budget;
  },

  /** Record a cost entry */
  async recordCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): Promise<CostEntry> {
    const costEntry: CostEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    
    memoryCostEntries.push(costEntry);
    
    // Update user's current spend
    const budget = await this.getBudget(entry.userId);
    budget.currentSpend += entry.amount;
    await this.saveBudget(budget);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(COST_ENTRIES_COLLECTION).doc(costEntry.id).set(costEntry);
    }
    
    logger.info(`💰 Cost recorded: $${entry.amount.toFixed(4)} for ${entry.agentName || 'Unknown'}`);
    
    // Check budget alerts
    await this.checkBudgetAlerts(entry.userId);
    
    return costEntry;
  },

  /** Check if execution is allowed based on budget */
  async canExecute(userId: string, estimatedCost: number, agentId?: string, crewId?: string): Promise<{
    allowed: boolean;
    reason?: string;
    budgetRemaining: number;
  }> {
    const budget = await this.getBudget(userId);
    const remaining = budget.periodBudget - budget.currentSpend;
    
    if (!budget.hardLimit) {
      return { allowed: true, budgetRemaining: remaining };
    }
    
    if (budget.currentSpend + estimatedCost > budget.periodBudget) {
      return {
        allowed: false,
        reason: `Budget limit exceeded. Current spend: $${budget.currentSpend.toFixed(2)}, Budget: $${budget.periodBudget.toFixed(2)}`,
        budgetRemaining: remaining,
      };
    }
    
    // Check agent-specific budget
    if (agentId && budget.agentBudgets?.[agentId]) {
      const agentSpend = await this.getAgentSpend(userId, agentId);
      if (agentSpend + estimatedCost > budget.agentBudgets[agentId]) {
        return {
          allowed: false,
          reason: `Agent budget limit exceeded`,
          budgetRemaining: budget.agentBudgets[agentId] - agentSpend,
        };
      }
    }
    
    // Check crew-specific budget
    if (crewId && budget.crewBudgets?.[crewId]) {
      const crewSpend = await this.getCrewSpend(userId, crewId);
      if (crewSpend + estimatedCost > budget.crewBudgets[crewId]) {
        return {
          allowed: false,
          reason: `Crew budget limit exceeded`,
          budgetRemaining: budget.crewBudgets[crewId] - crewSpend,
        };
      }
    }
    
    return { allowed: true, budgetRemaining: remaining };
  },

  /** Get spending for an agent in current period */
  async getAgentSpend(userId: string, agentId: string): Promise<number> {
    const budget = await this.getBudget(userId);
    const entries = await this.getCostEntries(userId, budget.periodStart);
    return entries
      .filter(e => e.agentId === agentId)
      .reduce((sum, e) => sum + e.amount, 0);
  },

  /** Get spending for a crew in current period */
  async getCrewSpend(userId: string, crewId: string): Promise<number> {
    const budget = await this.getBudget(userId);
    const entries = await this.getCostEntries(userId, budget.periodStart);
    return entries
      .filter(e => e.crewId === crewId)
      .reduce((sum, e) => sum + e.amount, 0);
  },

  /** Get cost entries for a user */
  async getCostEntries(userId: string, since?: string, limit = 100): Promise<CostEntry[]> {
    if (await isFirestoreAvailable()) {
      const db = getDb();
      let query = db.collection(COST_ENTRIES_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);
      
      if (since) {
        query = db.collection(COST_ENTRIES_COLLECTION)
          .where('userId', '==', userId)
          .where('timestamp', '>=', since)
          .orderBy('timestamp', 'desc')
          .limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(d => d.data() as CostEntry);
    }
    
    let entries = memoryCostEntries.filter(e => e.userId === userId);
    if (since) {
      entries = entries.filter(e => e.timestamp >= since);
    }
    return entries.slice(0, limit);
  },

  /** Get spending summary */
  async getSpendingSummary(userId: string): Promise<SpendingSummary> {
    const budget = await this.getBudget(userId);
    const entries = await this.getCostEntries(userId, budget.periodStart);
    
    // By category
    const byCategoryMap = new Map<CostCategory, number>();
    const byAgentMap = new Map<string, { name: string; amount: number }>();
    const byCrewMap = new Map<string, { name: string; amount: number }>();
    
    for (const entry of entries) {
      // Category
      byCategoryMap.set(entry.category, (byCategoryMap.get(entry.category) || 0) + entry.amount);
      
      // Agent
      if (entry.agentId) {
        const existing = byAgentMap.get(entry.agentId) || { name: entry.agentName || 'Unknown', amount: 0 };
        existing.amount += entry.amount;
        byAgentMap.set(entry.agentId, existing);
      }
      
      // Crew
      if (entry.crewId) {
        const existing = byCrewMap.get(entry.crewId) || { name: entry.crewName || 'Unknown', amount: 0 };
        existing.amount += entry.amount;
        byCrewMap.set(entry.crewId, existing);
      }
    }
    
    // Calculate daily average and project monthly
    const daysInPeriod = Math.ceil(
      (new Date(budget.periodEnd).getTime() - new Date(budget.periodStart).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysPassed = Math.ceil(
      (Date.now() - new Date(budget.periodStart).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyAverage = daysPassed > 0 ? budget.currentSpend / daysPassed : 0;
    const projectedMonthlySpend = dailyAverage * 30;
    
    // Build trends (last 7 days)
    const trends: { period: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAmount = entries
        .filter(e => e.timestamp.startsWith(dateStr))
        .reduce((sum, e) => sum + e.amount, 0);
      
      trends.push({ period: dateStr, amount: dayAmount });
    }
    
    return {
      totalSpend: budget.currentSpend,
      periodSpend: budget.currentSpend,
      budgetRemaining: budget.periodBudget - budget.currentSpend,
      budgetUtilization: budget.periodBudget > 0 ? budget.currentSpend / budget.periodBudget : 0,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, amount]) => ({ category, amount })),
      byAgent: Array.from(byAgentMap.entries()).map(([agentId, { name, amount }]) => ({ 
        agentId, agentName: name, amount 
      })),
      byCrew: Array.from(byCrewMap.entries()).map(([crewId, { name, amount }]) => ({ 
        crewId, crewName: name, amount 
      })),
      recentEntries: entries.slice(0, 10),
      projectedMonthlySpend,
      trends,
    };
  },

  /** Check and trigger budget alerts */
  async checkBudgetAlerts(userId: string): Promise<{ shouldAlert: boolean; message?: string }> {
    const budget = await this.getBudget(userId);
    
    if (!budget.alertsEnabled) {
      return { shouldAlert: false };
    }
    
    const utilization = budget.currentSpend / budget.periodBudget;
    
    if (utilization >= 1) {
      return {
        shouldAlert: true,
        message: `Budget exceeded! Spent $${budget.currentSpend.toFixed(2)} of $${budget.periodBudget.toFixed(2)}`,
      };
    }
    
    if (utilization >= budget.alertThreshold) {
      return {
        shouldAlert: true,
        message: `Budget warning: ${Math.round(utilization * 100)}% used ($${budget.currentSpend.toFixed(2)} of $${budget.periodBudget.toFixed(2)})`,
      };
    }
    
    return { shouldAlert: false };
  },

  /** Set agent-specific budget */
  async setAgentBudget(userId: string, agentId: string, budget: number): Promise<void> {
    const userBudget = await this.getBudget(userId);
    userBudget.agentBudgets = userBudget.agentBudgets || {};
    userBudget.agentBudgets[agentId] = budget;
    await this.saveBudget(userBudget);
  },

  /** Set crew-specific budget */
  async setCrewBudget(userId: string, crewId: string, budget: number): Promise<void> {
    const userBudget = await this.getBudget(userId);
    userBudget.crewBudgets = userBudget.crewBudgets || {};
    userBudget.crewBudgets[crewId] = budget;
    await this.saveBudget(userBudget);
  },
};
