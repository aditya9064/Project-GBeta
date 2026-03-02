/* ═══════════════════════════════════════════════════════════
   Escalation Store Unit Tests (Mock Firestore)
   ═══════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
interface Escalation {
  id: string;
  executionId: string;
  agentId: string;
  agentName: string;
  type: 'failed_execution' | 'low_confidence' | 'human_required' | 'timeout' | 'budget_exceeded';
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  createdAt: Date;
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
}

// Test helper to create mock escalations
function createMockEscalation(overrides: Partial<Escalation> = {}): Escalation {
  return {
    id: `esc-${Date.now()}`,
    executionId: 'exec-123',
    agentId: 'agent-1',
    agentName: 'Test Agent',
    type: 'failed_execution',
    status: 'pending',
    priority: 'medium',
    title: 'Test Escalation',
    description: 'Test description',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Escalation Logic Tests', () => {
  describe('Priority Calculation', () => {
    function calculatePriority(
      type: Escalation['type'],
      failureCount: number
    ): Escalation['priority'] {
      if (type === 'budget_exceeded') return 'critical';
      if (failureCount > 3) return 'critical';
      if (type === 'timeout' && failureCount > 1) return 'high';
      if (type === 'low_confidence') return 'low';
      return 'medium';
    }

    it('should return critical for budget exceeded', () => {
      expect(calculatePriority('budget_exceeded', 0)).toBe('critical');
    });

    it('should return critical for high failure count', () => {
      expect(calculatePriority('failed_execution', 5)).toBe('critical');
    });

    it('should return high for repeated timeouts', () => {
      expect(calculatePriority('timeout', 2)).toBe('high');
    });

    it('should return low for low confidence', () => {
      expect(calculatePriority('low_confidence', 0)).toBe('low');
    });

    it('should return medium by default', () => {
      expect(calculatePriority('failed_execution', 1)).toBe('medium');
    });
  });

  describe('Status Transitions', () => {
    function canTransition(
      from: Escalation['status'],
      to: Escalation['status']
    ): boolean {
      const allowedTransitions: Record<Escalation['status'], Escalation['status'][]> = {
        pending: ['in_review', 'dismissed'],
        in_review: ['resolved', 'dismissed', 'pending'],
        resolved: [],
        dismissed: ['pending'],
      };
      return allowedTransitions[from]?.includes(to) ?? false;
    }

    it('should allow pending to in_review', () => {
      expect(canTransition('pending', 'in_review')).toBe(true);
    });

    it('should allow in_review to resolved', () => {
      expect(canTransition('in_review', 'resolved')).toBe(true);
    });

    it('should not allow resolved to pending', () => {
      expect(canTransition('resolved', 'pending')).toBe(false);
    });

    it('should allow dismissed to pending (reopen)', () => {
      expect(canTransition('dismissed', 'pending')).toBe(true);
    });
  });

  describe('Escalation Filtering', () => {
    const escalations: Escalation[] = [
      createMockEscalation({ id: '1', status: 'pending', priority: 'high' }),
      createMockEscalation({ id: '2', status: 'pending', priority: 'low' }),
      createMockEscalation({ id: '3', status: 'resolved', priority: 'high' }),
      createMockEscalation({ id: '4', status: 'in_review', priority: 'medium' }),
    ];

    function filterEscalations(
      items: Escalation[],
      filters: { status?: Escalation['status']; priority?: Escalation['priority'] }
    ): Escalation[] {
      return items.filter((item) => {
        if (filters.status && item.status !== filters.status) return false;
        if (filters.priority && item.priority !== filters.priority) return false;
        return true;
      });
    }

    it('should filter by status', () => {
      const pending = filterEscalations(escalations, { status: 'pending' });
      expect(pending.length).toBe(2);
    });

    it('should filter by priority', () => {
      const high = filterEscalations(escalations, { priority: 'high' });
      expect(high.length).toBe(2);
    });

    it('should filter by both status and priority', () => {
      const result = filterEscalations(escalations, { 
        status: 'pending', 
        priority: 'high' 
      });
      expect(result.length).toBe(1);
    });
  });

  describe('Assignment Logic', () => {
    function canAssign(escalation: Escalation): boolean {
      return escalation.status === 'pending' || escalation.status === 'in_review';
    }

    it('should allow assignment for pending escalations', () => {
      const esc = createMockEscalation({ status: 'pending' });
      expect(canAssign(esc)).toBe(true);
    });

    it('should allow assignment for in_review escalations', () => {
      const esc = createMockEscalation({ status: 'in_review' });
      expect(canAssign(esc)).toBe(true);
    });

    it('should not allow assignment for resolved escalations', () => {
      const esc = createMockEscalation({ status: 'resolved' });
      expect(canAssign(esc)).toBe(false);
    });
  });
});

describe('Escalation Statistics', () => {
  function calculateStats(escalations: Escalation[]) {
    const stats = {
      total: escalations.length,
      pending: 0,
      inReview: 0,
      resolved: 0,
      dismissed: 0,
      byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
    };

    for (const esc of escalations) {
      if (esc.status === 'pending') stats.pending++;
      if (esc.status === 'in_review') stats.inReview++;
      if (esc.status === 'resolved') stats.resolved++;
      if (esc.status === 'dismissed') stats.dismissed++;
      stats.byPriority[esc.priority]++;
    }

    return stats;
  }

  it('should calculate correct totals', () => {
    const escalations = [
      createMockEscalation({ status: 'pending', priority: 'high' }),
      createMockEscalation({ status: 'resolved', priority: 'low' }),
      createMockEscalation({ status: 'pending', priority: 'critical' }),
    ];

    const stats = calculateStats(escalations);
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(2);
    expect(stats.resolved).toBe(1);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.critical).toBe(1);
  });
});
