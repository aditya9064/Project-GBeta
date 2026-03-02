/* ═══════════════════════════════════════════════════════════
   Routing Service — Smart agent selection and task routing
   
   Selects the best agent for a task based on:
   - Capabilities match
   - Current load/availability
   - Past performance
   - Cost constraints
   - Domain expertise
   ═══════════════════════════════════════════════════════════ */

import type { DeployedAgent } from '../automation/types';
import { MetricsService } from './metricsService';

export interface RoutingCriteria {
  requiredCapabilities?: string[];
  preferredCapabilities?: string[];
  domain?: string;
  tags?: string[];
  maxCost?: number;
  preferLowLoad?: boolean;
  preferHighPerformance?: boolean;
  excludeAgentIds?: string[];
}

export interface RoutingResult {
  agent: DeployedAgent;
  score: number;
  reasons: string[];
  matchedCapabilities: string[];
  estimatedCost: number;
}

export interface RoutingAnalysis {
  bestMatch: RoutingResult | null;
  alternatives: RoutingResult[];
  noMatchReasons: string[];
  totalCandidates: number;
  filteredOut: number;
}

const CAPABILITY_SYNONYMS: Record<string, string[]> = {
  'email': ['gmail', 'outlook', 'smtp', 'mail'],
  'messaging': ['slack', 'teams', 'discord', 'chat'],
  'documents': ['notion', 'docs', 'sheets', 'spreadsheet'],
  'analysis': ['analyze', 'analytics', 'reporting', 'insights'],
  'research': ['search', 'web', 'scraping', 'data-collection'],
  'writing': ['content', 'copywriting', 'text', 'generation'],
  'scheduling': ['calendar', 'appointments', 'booking'],
  'crm': ['salesforce', 'hubspot', 'customer', 'leads'],
};

function normalizeCapability(cap: string): string {
  const lower = cap.toLowerCase().trim();
  
  for (const [canonical, synonyms] of Object.entries(CAPABILITY_SYNONYMS)) {
    if (synonyms.includes(lower) || lower === canonical) {
      return canonical;
    }
  }
  
  return lower;
}

function capabilitiesMatch(agentCaps: string[], required: string[]): string[] {
  const normalizedAgentCaps = agentCaps.map(normalizeCapability);
  const matched: string[] = [];
  
  for (const req of required) {
    const normalizedReq = normalizeCapability(req);
    if (normalizedAgentCaps.includes(normalizedReq)) {
      matched.push(req);
    }
    
    // Check for partial matches (e.g., "app:gmail" matches "email")
    for (const cap of agentCaps) {
      const parts = cap.split(':');
      const capName = parts[parts.length - 1].toLowerCase();
      if (capName.includes(normalizedReq) || normalizedReq.includes(capName)) {
        if (!matched.includes(req)) {
          matched.push(req);
        }
      }
    }
  }
  
  return matched;
}

function calculateScore(
  agent: DeployedAgent,
  criteria: RoutingCriteria,
  matchedCaps: string[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  
  // Required capabilities match (major factor)
  if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
    const matchRatio = matchedCaps.length / criteria.requiredCapabilities.length;
    score += matchRatio * 40;
    if (matchRatio === 1) {
      reasons.push('All required capabilities matched');
    } else {
      reasons.push(`${Math.round(matchRatio * 100)}% capability match`);
    }
  } else {
    score += 20; // No requirements = base score
  }
  
  // Preferred capabilities (bonus)
  if (criteria.preferredCapabilities) {
    const prefMatched = capabilitiesMatch(agent.capabilities || [], criteria.preferredCapabilities);
    score += prefMatched.length * 5;
    if (prefMatched.length > 0) {
      reasons.push(`${prefMatched.length} preferred capabilities`);
    }
  }
  
  // Domain match
  if (criteria.domain && agent.domain === criteria.domain) {
    score += 15;
    reasons.push(`Domain expertise: ${criteria.domain}`);
  }
  
  // Tag match
  if (criteria.tags && agent.tags) {
    const tagMatches = criteria.tags.filter(t => agent.tags?.includes(t)).length;
    score += tagMatches * 3;
    if (tagMatches > 0) {
      reasons.push(`${tagMatches} tag matches`);
    }
  }
  
  // Load consideration
  if (criteria.preferLowLoad) {
    const maxConcurrent = agent.maxConcurrentExecutions || 5;
    const currentLoad = agent.currentLoad || 0;
    const loadRatio = 1 - (currentLoad / maxConcurrent);
    score += loadRatio * 10;
    if (loadRatio > 0.5) {
      reasons.push('Low current load');
    }
  }
  
  // Performance consideration
  if (criteria.preferHighPerformance) {
    const successRate = agent.successfulExecutions / Math.max(agent.totalExecutions, 1);
    score += successRate * 20;
    if (successRate >= 0.9) {
      reasons.push(`High success rate (${Math.round(successRate * 100)}%)`);
    }
  }
  
  // Priority boost
  if (agent.priority) {
    score += agent.priority * 2;
    if (agent.priority >= 5) {
      reasons.push('High priority agent');
    }
  }
  
  // Cost penalty
  if (criteria.maxCost && agent.costPerExecution) {
    if (agent.costPerExecution > criteria.maxCost) {
      score -= 50; // Heavy penalty for exceeding budget
      reasons.push('Exceeds cost limit');
    } else {
      const costRatio = 1 - (agent.costPerExecution / criteria.maxCost);
      score += costRatio * 5;
    }
  }
  
  return { score, reasons };
}

export const RoutingService = {
  /**
   * Find the best agent for a task based on criteria
   */
  findBestAgent(
    agents: DeployedAgent[],
    criteria: RoutingCriteria
  ): RoutingAnalysis {
    const noMatchReasons: string[] = [];
    const candidates: RoutingResult[] = [];
    let filteredOut = 0;
    
    for (const agent of agents) {
      // Skip inactive agents
      if (agent.status !== 'active') {
        filteredOut++;
        continue;
      }
      
      // Skip excluded agents
      if (criteria.excludeAgentIds?.includes(agent.id)) {
        filteredOut++;
        continue;
      }
      
      // Check if agent is overloaded
      const maxConcurrent = agent.maxConcurrentExecutions || 5;
      const currentLoad = agent.currentLoad || 0;
      if (currentLoad >= maxConcurrent) {
        filteredOut++;
        noMatchReasons.push(`${agent.name} is at capacity (${currentLoad}/${maxConcurrent})`);
        continue;
      }
      
      // Check required capabilities
      const agentCaps = agent.capabilities || [];
      const matchedCaps = criteria.requiredCapabilities 
        ? capabilitiesMatch(agentCaps, criteria.requiredCapabilities)
        : [];
      
      // If there are required capabilities and none match, skip
      if (criteria.requiredCapabilities && 
          criteria.requiredCapabilities.length > 0 && 
          matchedCaps.length === 0) {
        filteredOut++;
        noMatchReasons.push(`${agent.name} lacks required capabilities`);
        continue;
      }
      
      // Check cost constraint
      if (criteria.maxCost && agent.costPerExecution && agent.costPerExecution > criteria.maxCost) {
        filteredOut++;
        noMatchReasons.push(`${agent.name} exceeds budget ($${agent.costPerExecution} > $${criteria.maxCost})`);
        continue;
      }
      
      // Calculate score
      const { score, reasons } = calculateScore(agent, criteria, matchedCaps);
      
      candidates.push({
        agent,
        score,
        reasons,
        matchedCapabilities: matchedCaps,
        estimatedCost: agent.costPerExecution || 0,
      });
    }
    
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    return {
      bestMatch: candidates[0] || null,
      alternatives: candidates.slice(1, 4), // Top 3 alternatives
      noMatchReasons,
      totalCandidates: agents.length,
      filteredOut,
    };
  },

  /**
   * Find multiple agents for parallel task execution
   */
  findAgentsForTasks(
    agents: DeployedAgent[],
    tasks: { description: string; requiredCapability?: string }[],
    criteria: RoutingCriteria = {}
  ): Map<string, DeployedAgent | null> {
    const assignments = new Map<string, DeployedAgent | null>();
    const usedAgents = new Set<string>();
    
    for (const task of tasks) {
      const taskCriteria: RoutingCriteria = {
        ...criteria,
        requiredCapabilities: task.requiredCapability ? [task.requiredCapability] : undefined,
        excludeAgentIds: [...(criteria.excludeAgentIds || []), ...usedAgents],
      };
      
      const result = this.findBestAgent(agents, taskCriteria);
      
      if (result.bestMatch) {
        assignments.set(task.description, result.bestMatch.agent);
        usedAgents.add(result.bestMatch.agent.id);
      } else {
        assignments.set(task.description, null);
      }
    }
    
    return assignments;
  },

  /**
   * Suggest capabilities for an agent based on its workflow
   */
  suggestCapabilities(agent: DeployedAgent): string[] {
    const suggested: string[] = [];
    
    for (const node of agent.workflow.nodes) {
      const config = node.config as any;
      
      switch (node.type) {
        case 'app':
          if (config.appType) {
            suggested.push(`app:${config.appType}`);
            // Add domain capability
            if (config.appType === 'gmail') suggested.push('email');
            if (config.appType === 'slack') suggested.push('messaging');
            if (config.appType === 'notion') suggested.push('documents');
          }
          break;
        case 'ai':
          suggested.push('ai:processing');
          if (config.systemPrompt?.toLowerCase().includes('summar')) {
            suggested.push('summarization');
          }
          if (config.systemPrompt?.toLowerCase().includes('analy')) {
            suggested.push('analysis');
          }
          if (config.systemPrompt?.toLowerCase().includes('classif')) {
            suggested.push('classification');
          }
          break;
        case 'trigger':
          if (config.triggerType) {
            suggested.push(`trigger:${config.triggerType}`);
          }
          break;
        case 'web':
          suggested.push('web:scraping');
          suggested.push('research');
          break;
        case 'memory':
          suggested.push('memory:enabled');
          break;
      }
    }
    
    // Add description-based suggestions
    if (agent.description) {
      const desc = agent.description.toLowerCase();
      const keywords = [
        'email', 'slack', 'notion', 'report', 'analyze', 'summarize',
        'classify', 'monitor', 'sales', 'marketing', 'support', 'research',
        'data', 'automation', 'scheduling', 'crm'
      ];
      
      for (const kw of keywords) {
        if (desc.includes(kw) && !suggested.some(s => s.includes(kw))) {
          suggested.push(`domain:${kw}`);
        }
      }
    }
    
    return [...new Set(suggested)];
  },

  /**
   * Get all unique capabilities from a list of agents
   */
  getAllCapabilities(agents: DeployedAgent[]): { capability: string; count: number }[] {
    const capCounts = new Map<string, number>();
    
    for (const agent of agents) {
      for (const cap of agent.capabilities || []) {
        const normalized = normalizeCapability(cap);
        capCounts.set(normalized, (capCounts.get(normalized) || 0) + 1);
      }
    }
    
    return Array.from(capCounts.entries())
      .map(([capability, count]) => ({ capability, count }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Get all unique tags from a list of agents
   */
  getAllTags(agents: DeployedAgent[]): { tag: string; count: number }[] {
    const tagCounts = new Map<string, number>();
    
    for (const agent of agents) {
      for (const tag of agent.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Find agents by capability
   */
  findByCapability(agents: DeployedAgent[], capability: string): DeployedAgent[] {
    const normalized = normalizeCapability(capability);
    
    return agents.filter(agent => {
      const agentCaps = (agent.capabilities || []).map(normalizeCapability);
      return agentCaps.includes(normalized) || 
             agentCaps.some(c => c.includes(normalized) || normalized.includes(c));
    });
  },

  /**
   * Find agents by tag
   */
  findByTag(agents: DeployedAgent[], tag: string): DeployedAgent[] {
    return agents.filter(agent => agent.tags?.includes(tag));
  },

  /**
   * Find agents by domain
   */
  findByDomain(agents: DeployedAgent[], domain: string): DeployedAgent[] {
    return agents.filter(agent => agent.domain === domain);
  },
};
