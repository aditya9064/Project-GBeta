/* ═══════════════════════════════════════════════════════════
   Budget Service — Frontend API for cost tracking and budgets
   ═══════════════════════════════════════════════════════════ */

const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

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
  alertThreshold: number;
  alertsEnabled: boolean;
  hardLimit: boolean;
  agentBudgets?: { [agentId: string]: number };
  crewBudgets?: { [crewId: string]: number };
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

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
}

export const BudgetService = {
  /** Get user budget */
  async getBudget(userId: string): Promise<UserBudget> {
    return apiRequest<UserBudget>(`/api/budget/${userId}`);
  },

  /** Update budget settings */
  async updateBudget(userId: string, updates: Partial<UserBudget>): Promise<UserBudget> {
    return apiRequest<UserBudget>(`/api/budget/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /** Get spending summary */
  async getSpendingSummary(userId: string): Promise<SpendingSummary> {
    return apiRequest<SpendingSummary>(`/api/budget/${userId}/summary`);
  },

  /** Get cost entries */
  async getCostEntries(userId: string, since?: string, limit = 100): Promise<CostEntry[]> {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    params.set('limit', String(limit));
    return apiRequest<CostEntry[]>(`/api/budget/${userId}/entries?${params.toString()}`);
  },

  /** Record a cost */
  async recordCost(data: {
    userId: string;
    agentId?: string;
    agentName?: string;
    crewId?: string;
    crewName?: string;
    executionId?: string;
    category: CostCategory;
    amount: number;
    description: string;
    metadata?: CostEntry['metadata'];
  }): Promise<CostEntry> {
    return apiRequest<CostEntry>(`/api/budget/${data.userId}/cost`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Check if execution is allowed */
  async canExecute(userId: string, estimatedCost: number, agentId?: string, crewId?: string): Promise<{
    allowed: boolean;
    reason?: string;
    budgetRemaining: number;
  }> {
    const params = new URLSearchParams();
    params.set('cost', String(estimatedCost));
    if (agentId) params.set('agentId', agentId);
    if (crewId) params.set('crewId', crewId);
    return apiRequest(`/api/budget/${userId}/can-execute?${params.toString()}`);
  },

  /** Set agent budget limit */
  async setAgentBudget(userId: string, agentId: string, budget: number): Promise<void> {
    await apiRequest(`/api/budget/${userId}/agent/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ budget }),
    });
  },

  /** Set crew budget limit */
  async setCrewBudget(userId: string, crewId: string, budget: number): Promise<void> {
    await apiRequest(`/api/budget/${userId}/crew/${crewId}`, {
      method: 'POST',
      body: JSON.stringify({ budget }),
    });
  },

  /** Calculate token cost (client-side estimation) */
  calculateTokenCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'default': { input: 0.001, output: 0.002 },
    };
    
    const rate = rates[model] || rates['default'];
    return (inputTokens / 1000 * rate.input) + (outputTokens / 1000 * rate.output);
  },

  /** Format currency */
  formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
  },

  /** Format percentage */
  formatPercentage(value: number): string {
    return `${Math.round(value * 100)}%`;
  },

  /** Get category label */
  getCategoryLabel(category: CostCategory): string {
    switch (category) {
      case 'ai_tokens': return 'AI Tokens';
      case 'api_calls': return 'API Calls';
      case 'storage': return 'Storage';
      case 'compute': return 'Compute';
      case 'other': return 'Other';
    }
  },

  /** Get category color */
  getCategoryColor(category: CostCategory): string {
    switch (category) {
      case 'ai_tokens': return '#8b5cf6';
      case 'api_calls': return '#3b82f6';
      case 'storage': return '#10b981';
      case 'compute': return '#f59e0b';
      case 'other': return '#6b7280';
    }
  },
};
