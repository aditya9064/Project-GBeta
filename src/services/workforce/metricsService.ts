/* ═══════════════════════════════════════════════════════════
   Metrics Service — Agent and crew performance analytics
   
   Tracks execution stats, success rates, costs, and ROI
   for individual agents and crews.
   ═══════════════════════════════════════════════════════════ */

// In production, use relative /api paths. In dev, VITE_API_URL points to localhost:3001
const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export type MetricPeriod = 'daily' | 'weekly' | 'monthly' | 'all_time';

export interface AgentMetrics {
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
}

export interface CrewMetrics {
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
  memberContributions: MemberContribution[];
  successRate: number;
}

export interface MemberContribution {
  agentId: string;
  agentName: string;
  role: string;
  executionCount: number;
  successRate: number;
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
  recentActivity: ActivityEntry[];
  healthScore: number;
}

export interface ActivityEntry {
  type: 'execution' | 'crew_task' | 'feedback' | 'error';
  agentId?: string;
  agentName?: string;
  crewId?: string;
  crewName?: string;
  description: string;
  timestamp: string;
  success?: boolean;
}

export interface MetricsTrend {
  period: string;
  executions: number;
  successRate: number;
  avgDuration: number;
  cost: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const result: ApiResponse<T> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'API request failed');
  }
  
  return result.data as T;
}

// Local storage for offline metrics
const METRICS_STORAGE_KEY = 'workforce_metrics';
const ACTIVITY_STORAGE_KEY = 'workforce_activity';

interface StoredMetrics {
  agents: Record<string, AgentMetrics>;
  lastUpdated: string;
}

function getStoredMetrics(): StoredMetrics {
  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : { agents: {}, lastUpdated: '' };
  } catch {
    return { agents: {}, lastUpdated: '' };
  }
}

function storeMetrics(metrics: StoredMetrics): void {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage errors
  }
}

function getStoredActivity(): ActivityEntry[] {
  try {
    const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeActivity(activity: ActivityEntry[]): void {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activity.slice(-200)));
  } catch {
    // Ignore storage errors
  }
}

export const MetricsService = {
  /** Get metrics for all agents */
  async getAllAgentMetrics(
    period: MetricPeriod = 'weekly',
    userId?: string
  ): Promise<AgentMetrics[]> {
    try {
      const query = new URLSearchParams({ period });
      if (userId) query.set('userId', userId);
      return await apiRequest<AgentMetrics[]>(`/api/metrics/agents?${query}`);
    } catch {
      // Return from local storage
      const stored = getStoredMetrics();
      return Object.values(stored.agents);
    }
  },

  /** Get metrics for a specific agent */
  async getAgentMetrics(
    agentId: string,
    period: MetricPeriod = 'weekly'
  ): Promise<AgentMetrics> {
    try {
      return await apiRequest<AgentMetrics>(
        `/api/metrics/agents/${agentId}?period=${period}`
      );
    } catch {
      const stored = getStoredMetrics();
      return stored.agents[agentId] || this.createEmptyAgentMetrics(agentId, '', period);
    }
  },

  /** Get metrics for a crew */
  async getCrewMetrics(
    crewId: string,
    period: MetricPeriod = 'weekly'
  ): Promise<CrewMetrics> {
    return apiRequest<CrewMetrics>(
      `/api/metrics/crews/${crewId}?period=${period}`
    );
  },

  /** Get workforce summary */
  async getSummary(userId?: string): Promise<WorkforceSummary> {
    try {
      const query = userId ? `?userId=${userId}` : '';
      return await apiRequest<WorkforceSummary>(`/api/metrics/summary${query}`);
    } catch {
      // Generate from local data
      return this.generateLocalSummary();
    }
  },

  /** Get metric trends over time */
  async getTrends(
    agentId?: string,
    periods = 7
  ): Promise<MetricsTrend[]> {
    try {
      const query = new URLSearchParams({ periods: String(periods) });
      if (agentId) query.set('agentId', agentId);
      return await apiRequest<MetricsTrend[]>(`/api/metrics/trends?${query}`);
    } catch {
      return this.generateLocalTrends(periods);
    }
  },

  /** Record an execution for metrics (called after workflow execution) */
  recordExecution(
    agentId: string,
    agentName: string,
    success: boolean,
    durationMs: number,
    cost = 0
  ): void {
    const stored = getStoredMetrics();
    const existing = stored.agents[agentId] || this.createEmptyAgentMetrics(
      agentId,
      agentName,
      'all_time'
    );

    const newTotal = existing.totalExecutions + 1;
    const newAvgDuration = 
      ((existing.avgDurationMs * existing.totalExecutions) + durationMs) / newTotal;

    stored.agents[agentId] = {
      ...existing,
      agentName,
      totalExecutions: newTotal,
      successCount: success ? existing.successCount + 1 : existing.successCount,
      failureCount: success ? existing.failureCount : existing.failureCount + 1,
      avgDurationMs: Math.round(newAvgDuration),
      minDurationMs: Math.min(existing.minDurationMs || durationMs, durationMs),
      maxDurationMs: Math.max(existing.maxDurationMs || 0, durationMs),
      totalCost: existing.totalCost + cost,
      successRate: (success ? existing.successCount + 1 : existing.successCount) / newTotal,
    };
    stored.lastUpdated = new Date().toISOString();
    storeMetrics(stored);

    // Record activity
    this.recordActivity({
      type: 'execution',
      agentId,
      agentName,
      description: success 
        ? `Completed successfully in ${Math.round(durationMs / 1000)}s`
        : 'Execution failed',
      timestamp: new Date().toISOString(),
      success,
    });
  },

  /** Record activity entry */
  recordActivity(entry: ActivityEntry): void {
    const activity = getStoredActivity();
    activity.push(entry);
    storeActivity(activity);
  },

  /** Get recent activity */
  getRecentActivity(limit = 20): ActivityEntry[] {
    return getStoredActivity().slice(-limit).reverse();
  },

  /** Create empty metrics object */
  createEmptyAgentMetrics(
    agentId: string,
    agentName: string,
    period: MetricPeriod
  ): AgentMetrics {
    const now = new Date();
    return {
      agentId,
      agentName,
      period,
      periodStart: now.toISOString(),
      periodEnd: now.toISOString(),
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      totalCost: 0,
      userCorrections: 0,
      successRate: 0,
    };
  },

  /** Generate summary from local data */
  generateLocalSummary(): WorkforceSummary {
    const stored = getStoredMetrics();
    const agents = Object.values(stored.agents);
    const activity = getStoredActivity();

    const totalExecutions = agents.reduce((sum, a) => sum + a.totalExecutions, 0);
    const totalSuccess = agents.reduce((sum, a) => sum + a.successCount, 0);
    const totalDuration = agents.reduce(
      (sum, a) => sum + a.avgDurationMs * a.totalExecutions,
      0
    );
    const totalCost = agents.reduce((sum, a) => sum + a.totalCost, 0);

    const topPerformers = [...agents]
      .filter(a => a.totalExecutions >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    const successRate = totalExecutions > 0 ? totalSuccess / totalExecutions : 0;
    const healthScore = Math.round(successRate * 100);

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.totalExecutions > 0).length,
      totalCrews: 0,
      activeCrews: 0,
      totalExecutions,
      successRate,
      avgDurationMs: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      totalCost,
      topPerformers,
      recentActivity: activity.slice(-10).reverse(),
      healthScore,
    };
  },

  /** Generate trends from local data */
  generateLocalTrends(periods: number): MetricsTrend[] {
    const trends: MetricsTrend[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      trends.push({
        period: date.toISOString().split('T')[0],
        executions: 0,
        successRate: 0,
        avgDuration: 0,
        cost: 0,
      });
    }

    return trends;
  },

  /** Format duration for display */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  },

  /** Format cost for display */
  formatCost(cost: number): string {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  },

  /** Calculate ROI estimate */
  calculateROI(
    metrics: AgentMetrics,
    estimatedManualMinutes: number,
    hourlyRate: number
  ): { timeSaved: number; moneySaved: number } {
    const totalMinutesSaved = metrics.successCount * estimatedManualMinutes;
    const hoursSaved = totalMinutesSaved / 60;
    const moneySaved = hoursSaved * hourlyRate - metrics.totalCost;

    return {
      timeSaved: totalMinutesSaved,
      moneySaved: Math.max(0, moneySaved),
    };
  },
};
