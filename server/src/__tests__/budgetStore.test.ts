/* ═══════════════════════════════════════════════════════════
   Budget Store Unit Tests
   ═══════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

// Budget types
interface Budget {
  userId: string;
  monthlyLimit: number;
  currentSpend: number;
  alertThreshold: number;
}

interface CostEntry {
  amount: number;
  type: 'openai' | 'anthropic' | 'google' | 'custom';
  operation: string;
  agentId?: string;
  crewId?: string;
}

// Budget logic tests (without Firestore)
describe('Budget Calculations', () => {
  describe('Remaining Budget', () => {
    function getRemainingBudget(budget: Budget): number {
      return Math.max(0, budget.monthlyLimit - budget.currentSpend);
    }

    it('should calculate remaining budget correctly', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 30,
        alertThreshold: 0.8,
      };
      expect(getRemainingBudget(budget)).toBe(70);
    });

    it('should return 0 when over budget', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 150,
        alertThreshold: 0.8,
      };
      expect(getRemainingBudget(budget)).toBe(0);
    });
  });

  describe('Budget Alerts', () => {
    function shouldAlert(budget: Budget): boolean {
      const usageRatio = budget.currentSpend / budget.monthlyLimit;
      return usageRatio >= budget.alertThreshold;
    }

    function isOverBudget(budget: Budget): boolean {
      return budget.currentSpend > budget.monthlyLimit;
    }

    it('should alert when threshold reached', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 85,
        alertThreshold: 0.8,
      };
      expect(shouldAlert(budget)).toBe(true);
    });

    it('should not alert when below threshold', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 50,
        alertThreshold: 0.8,
      };
      expect(shouldAlert(budget)).toBe(false);
    });

    it('should detect over budget', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 120,
        alertThreshold: 0.8,
      };
      expect(isOverBudget(budget)).toBe(true);
    });
  });

  describe('Cost Estimation', () => {
    const MODEL_COSTS: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.001,
      'claude-3-opus': 0.075,
      'claude-3-sonnet': 0.015,
    };

    function estimateCost(model: string, tokens: number): number {
      const costPerKToken = MODEL_COSTS[model] || 0.01;
      return (tokens / 1000) * costPerKToken;
    }

    it('should estimate GPT-4 cost correctly', () => {
      const cost = estimateCost('gpt-4', 1000);
      expect(cost).toBe(0.03);
    });

    it('should estimate GPT-3.5 cost correctly', () => {
      const cost = estimateCost('gpt-3.5-turbo', 10000);
      expect(cost).toBe(0.01);
    });

    it('should use default cost for unknown model', () => {
      const cost = estimateCost('unknown-model', 1000);
      expect(cost).toBe(0.01);
    });
  });

  describe('Budget Check', () => {
    function canExecute(budget: Budget, estimatedCost: number): {
      allowed: boolean;
      reason?: string;
    } {
      const remaining = budget.monthlyLimit - budget.currentSpend;
      
      if (estimatedCost > remaining) {
        return {
          allowed: false,
          reason: `Insufficient budget. Need $${estimatedCost.toFixed(2)}, have $${remaining.toFixed(2)}`,
        };
      }
      
      return { allowed: true };
    }

    it('should allow execution within budget', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 30,
        alertThreshold: 0.8,
      };
      const result = canExecute(budget, 10);
      expect(result.allowed).toBe(true);
    });

    it('should deny execution exceeding budget', () => {
      const budget: Budget = {
        userId: 'user-1',
        monthlyLimit: 100,
        currentSpend: 95,
        alertThreshold: 0.8,
      };
      const result = canExecute(budget, 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient budget');
    });
  });
});

describe('Spending Analytics', () => {
  interface SpendingEntry {
    date: Date;
    amount: number;
    agentId: string;
    crewId?: string;
  }

  function aggregateByAgent(entries: SpendingEntry[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of entries) {
      result[entry.agentId] = (result[entry.agentId] || 0) + entry.amount;
    }
    return result;
  }

  function aggregateByCrew(entries: SpendingEntry[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.crewId) {
        result[entry.crewId] = (result[entry.crewId] || 0) + entry.amount;
      }
    }
    return result;
  }

  function getDailyTrend(entries: SpendingEntry[]): { date: string; amount: number }[] {
    const byDate: Record<string, number> = {};
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + entry.amount;
    }
    return Object.entries(byDate)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const testEntries: SpendingEntry[] = [
    { date: new Date('2024-01-01'), amount: 10, agentId: 'a1', crewId: 'c1' },
    { date: new Date('2024-01-01'), amount: 5, agentId: 'a2', crewId: 'c1' },
    { date: new Date('2024-01-02'), amount: 8, agentId: 'a1' },
    { date: new Date('2024-01-02'), amount: 12, agentId: 'a1', crewId: 'c2' },
  ];

  it('should aggregate spending by agent', () => {
    const result = aggregateByAgent(testEntries);
    expect(result['a1']).toBe(30);
    expect(result['a2']).toBe(5);
  });

  it('should aggregate spending by crew', () => {
    const result = aggregateByCrew(testEntries);
    expect(result['c1']).toBe(15);
    expect(result['c2']).toBe(12);
  });

  it('should calculate daily trend', () => {
    const trend = getDailyTrend(testEntries);
    expect(trend.length).toBe(2);
    expect(trend[0].amount).toBe(15);
    expect(trend[1].amount).toBe(20);
  });
});

describe('Budget Limits', () => {
  function validateBudgetLimit(limit: number): { valid: boolean; error?: string } {
    if (limit < 0) {
      return { valid: false, error: 'Budget limit cannot be negative' };
    }
    if (limit > 10000) {
      return { valid: false, error: 'Budget limit exceeds maximum of $10,000' };
    }
    return { valid: true };
  }

  it('should accept valid limits', () => {
    expect(validateBudgetLimit(100).valid).toBe(true);
    expect(validateBudgetLimit(5000).valid).toBe(true);
  });

  it('should reject negative limits', () => {
    const result = validateBudgetLimit(-10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negative');
  });

  it('should reject excessive limits', () => {
    const result = validateBudgetLimit(50000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });
});
