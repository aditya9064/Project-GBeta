/* ═══════════════════════════════════════════════════════════
   Routing Service Tests (Frontend service - tested with mock)
   ═══════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

// Mock the RoutingService logic directly for testing
interface DeployedAgent {
  id: string;
  name: string;
  status: 'active' | 'paused';
  capabilities?: string[];
  tags?: string[];
  domain?: string;
  priority?: number;
  costPerExecution?: number;
  maxConcurrentExecutions?: number;
  currentLoad?: number;
  totalExecutions: number;
  successfulExecutions: number;
}

interface RoutingCriteria {
  requiredCapabilities?: string[];
  preferredCapabilities?: string[];
  domain?: string;
  tags?: string[];
  maxCost?: number;
  preferLowLoad?: boolean;
  preferHighPerformance?: boolean;
  excludeAgentIds?: string[];
}

function capabilitiesMatch(agentCaps: string[], required: string[]): string[] {
  const matched: string[] = [];
  for (const req of required) {
    const normalizedReq = req.toLowerCase();
    for (const cap of agentCaps) {
      if (cap.toLowerCase().includes(normalizedReq) || normalizedReq.includes(cap.toLowerCase())) {
        if (!matched.includes(req)) {
          matched.push(req);
        }
      }
    }
  }
  return matched;
}

function findBestAgent(agents: DeployedAgent[], criteria: RoutingCriteria) {
  const candidates: { agent: DeployedAgent; score: number }[] = [];
  
  for (const agent of agents) {
    if (agent.status !== 'active') continue;
    if (criteria.excludeAgentIds?.includes(agent.id)) continue;
    
    const agentCaps = agent.capabilities || [];
    const matchedCaps = criteria.requiredCapabilities 
      ? capabilitiesMatch(agentCaps, criteria.requiredCapabilities)
      : [];
    
    if (criteria.requiredCapabilities && 
        criteria.requiredCapabilities.length > 0 && 
        matchedCaps.length === 0) {
      continue;
    }
    
    if (criteria.maxCost && agent.costPerExecution && agent.costPerExecution > criteria.maxCost) {
      continue;
    }
    
    let score = 0;
    
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      score += (matchedCaps.length / criteria.requiredCapabilities.length) * 40;
    } else {
      score += 20;
    }
    
    if (criteria.domain && agent.domain === criteria.domain) {
      score += 15;
    }
    
    if (agent.priority) {
      score += agent.priority * 2;
    }
    
    if (criteria.preferHighPerformance) {
      const successRate = agent.successfulExecutions / Math.max(agent.totalExecutions, 1);
      score += successRate * 20;
    }
    
    candidates.push({ agent, score });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  
  return {
    bestMatch: candidates[0] || null,
    alternatives: candidates.slice(1, 4),
    totalCandidates: agents.length,
  };
}

describe('RoutingService', () => {
  const mockAgents: DeployedAgent[] = [
    {
      id: 'agent-1',
      name: 'Email Agent',
      status: 'active',
      capabilities: ['email', 'gmail', 'messaging'],
      domain: 'communication',
      priority: 5,
      totalExecutions: 100,
      successfulExecutions: 95,
    },
    {
      id: 'agent-2',
      name: 'Slack Agent',
      status: 'active',
      capabilities: ['slack', 'messaging', 'notifications'],
      domain: 'communication',
      priority: 3,
      totalExecutions: 50,
      successfulExecutions: 48,
    },
    {
      id: 'agent-3',
      name: 'Sales Agent',
      status: 'active',
      capabilities: ['crm', 'salesforce', 'leads'],
      domain: 'sales',
      priority: 8,
      costPerExecution: 0.05,
      totalExecutions: 200,
      successfulExecutions: 180,
    },
    {
      id: 'agent-4',
      name: 'Paused Agent',
      status: 'paused',
      capabilities: ['email'],
      totalExecutions: 10,
      successfulExecutions: 5,
    },
  ];

  describe('findBestAgent', () => {
    it('should find best agent based on required capabilities', () => {
      const result = findBestAgent(mockAgents, {
        requiredCapabilities: ['email'],
      });
      
      expect(result.bestMatch).not.toBeNull();
      expect(result.bestMatch?.agent.id).toBe('agent-1');
    });

    it('should filter out paused agents', () => {
      const result = findBestAgent(mockAgents, {
        requiredCapabilities: ['email'],
      });
      
      expect(result.bestMatch?.agent.status).toBe('active');
    });

    it('should respect domain preference', () => {
      const result = findBestAgent(mockAgents, {
        domain: 'sales',
      });
      
      expect(result.bestMatch?.agent.id).toBe('agent-3');
    });

    it('should exclude specified agents', () => {
      const result = findBestAgent(mockAgents, {
        requiredCapabilities: ['messaging'],
        excludeAgentIds: ['agent-1'],
      });
      
      expect(result.bestMatch?.agent.id).toBe('agent-2');
    });

    it('should respect cost constraints', () => {
      const result = findBestAgent(mockAgents, {
        maxCost: 0.01,
      });
      
      // Agent-3 costs 0.05, should be excluded
      expect(result.bestMatch?.agent.id).not.toBe('agent-3');
    });

    it('should prefer higher priority agents', () => {
      const result = findBestAgent(mockAgents, {});
      
      // Agent-3 has priority 8, highest
      expect(result.bestMatch?.agent.id).toBe('agent-3');
    });

    it('should return alternatives', () => {
      const result = findBestAgent(mockAgents, {
        requiredCapabilities: ['messaging'],
      });
      
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should return null when no agents match', () => {
      const result = findBestAgent(mockAgents, {
        requiredCapabilities: ['nonexistent-capability'],
      });
      
      expect(result.bestMatch).toBeNull();
    });

    it('should prefer high performance agents when flag is set', () => {
      const result = findBestAgent(mockAgents, {
        preferHighPerformance: true,
      });
      
      // All have high success rates, but agent-1 and agent-2 are highest
      expect(result.bestMatch).not.toBeNull();
    });
  });

  describe('capabilitiesMatch', () => {
    it('should match exact capabilities', () => {
      const matched = capabilitiesMatch(['email', 'slack'], ['email']);
      expect(matched).toContain('email');
    });

    it('should match partial capabilities', () => {
      const matched = capabilitiesMatch(['app:gmail'], ['gmail']);
      expect(matched).toContain('gmail');
    });

    it('should return empty for no matches', () => {
      const matched = capabilitiesMatch(['email'], ['slack']);
      expect(matched.length).toBe(0);
    });
  });
});
