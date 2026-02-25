// Enhanced Memory Service — Episodic, Semantic, and Procedural memory
//
// Builds on top of AgentMemoryService to provide structured memory types:
//   - Episodic: What happened (execution outcomes, interactions, events)
//   - Semantic: Facts about the world (contacts, preferences, patterns)
//   - Procedural: Learned shortcuts (if X then Y, auto-CC rules, etc.)
//
// All memory is indexed by agent and supports relevance-based retrieval.

import { AgentMemoryService } from './memoryService';
import type { MemoryScope } from './types';

export type MemoryType = 'episodic' | 'semantic' | 'procedural';

export interface EpisodicMemory {
  type: 'episodic';
  eventType: 'execution' | 'interaction' | 'error' | 'decision';
  summary: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, any>;
  relatedEntities: string[];
  timestamp: Date;
  importance: number; // 0-1, higher = more important
}

export interface SemanticMemory {
  type: 'semantic';
  category: 'contact' | 'preference' | 'pattern' | 'fact' | 'business_rule';
  subject: string;
  predicate: string;
  object: any;
  confidence: number; // 0-1
  source: string;
  lastVerified: Date;
}

export interface ProceduralMemory {
  type: 'procedural';
  trigger: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
  successRate: number;
  timesApplied: number;
  lastApplied?: Date;
  learnedFrom: string;
}

export type EnhancedMemoryEntry = EpisodicMemory | SemanticMemory | ProceduralMemory;

const EPISODIC_PREFIX = 'episodic::';
const SEMANTIC_PREFIX = 'semantic::';
const PROCEDURAL_PREFIX = 'procedural::';
const MEMORY_INDEX_KEY = 'memory_index';
const MAX_EPISODIC = 200;
const MAX_SEMANTIC = 500;
const MAX_PROCEDURAL = 100;

function memoryKey(memType: MemoryType, id: string): string {
  const prefixes: Record<MemoryType, string> = {
    episodic: EPISODIC_PREFIX,
    semantic: SEMANTIC_PREFIX,
    procedural: PROCEDURAL_PREFIX,
  };
  return `${prefixes[memType]}${id}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
}

async function loadIndex(agentId: string): Promise<Record<MemoryType, string[]>> {
  const idx = await AgentMemoryService.read(agentId, 'agent', MEMORY_INDEX_KEY);
  return idx || { episodic: [], semantic: [], procedural: [] };
}

async function saveIndex(agentId: string, index: Record<MemoryType, string[]>): Promise<void> {
  await AgentMemoryService.write(agentId, 'agent', MEMORY_INDEX_KEY, index);
}

export const EnhancedMemoryService = {

  // ═══ EPISODIC MEMORY ══════════════════════════════════════

  async recordEpisode(
    agentId: string,
    episode: Omit<EpisodicMemory, 'type' | 'timestamp'>,
  ): Promise<string> {
    const id = generateId();
    const entry: EpisodicMemory = {
      ...episode,
      type: 'episodic',
      timestamp: new Date(),
    };

    await AgentMemoryService.write(agentId, 'agent', memoryKey('episodic', id), entry);

    const index = await loadIndex(agentId);
    index.episodic.push(id);
    if (index.episodic.length > MAX_EPISODIC) {
      const removed = index.episodic.shift()!;
      await AgentMemoryService.delete(agentId, 'agent', memoryKey('episodic', removed));
    }
    await saveIndex(agentId, index);

    return id;
  },

  async getRecentEpisodes(agentId: string, limit = 20): Promise<EpisodicMemory[]> {
    const index = await loadIndex(agentId);
    const recentIds = index.episodic.slice(-limit);
    const episodes: EpisodicMemory[] = [];

    for (const id of recentIds) {
      const entry = await AgentMemoryService.read(agentId, 'agent', memoryKey('episodic', id));
      if (entry) episodes.push(entry);
    }

    return episodes.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  async findEpisodes(
    agentId: string,
    filter: { eventType?: string; outcome?: string; entity?: string },
  ): Promise<EpisodicMemory[]> {
    const all = await this.getRecentEpisodes(agentId, MAX_EPISODIC);
    return all.filter((ep) => {
      if (filter.eventType && ep.eventType !== filter.eventType) return false;
      if (filter.outcome && ep.outcome !== filter.outcome) return false;
      if (filter.entity && !ep.relatedEntities.some(e => e.toLowerCase().includes(filter.entity!.toLowerCase()))) return false;
      return true;
    });
  },

  // ═══ SEMANTIC MEMORY ══════════════════════════════════════

  async storeFact(
    agentId: string,
    fact: Omit<SemanticMemory, 'type' | 'lastVerified'>,
  ): Promise<string> {
    const id = `${fact.subject}::${fact.predicate}`.replace(/\s+/g, '_').toLowerCase();
    const existing = await AgentMemoryService.read(agentId, 'agent', memoryKey('semantic', id));

    const entry: SemanticMemory = {
      ...fact,
      type: 'semantic',
      lastVerified: new Date(),
      confidence: existing
        ? Math.min(1, (existing.confidence + fact.confidence) / 2 + 0.1)
        : fact.confidence,
    };

    await AgentMemoryService.write(agentId, 'agent', memoryKey('semantic', id), entry);

    const index = await loadIndex(agentId);
    if (!index.semantic.includes(id)) {
      index.semantic.push(id);
      if (index.semantic.length > MAX_SEMANTIC) {
        const removed = index.semantic.shift()!;
        await AgentMemoryService.delete(agentId, 'agent', memoryKey('semantic', removed));
      }
      await saveIndex(agentId, index);
    }

    return id;
  },

  async getFact(agentId: string, subject: string, predicate: string): Promise<SemanticMemory | null> {
    const id = `${subject}::${predicate}`.replace(/\s+/g, '_').toLowerCase();
    return AgentMemoryService.read(agentId, 'agent', memoryKey('semantic', id));
  },

  async queryFacts(agentId: string, searchTerm: string): Promise<SemanticMemory[]> {
    const index = await loadIndex(agentId);
    const results: SemanticMemory[] = [];
    const lower = searchTerm.toLowerCase();

    for (const id of index.semantic) {
      const fact = await AgentMemoryService.read(agentId, 'agent', memoryKey('semantic', id));
      if (!fact) continue;
      if (
        fact.subject.toLowerCase().includes(lower) ||
        fact.predicate.toLowerCase().includes(lower) ||
        JSON.stringify(fact.object).toLowerCase().includes(lower)
      ) {
        results.push(fact);
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  },

  async getFactsByCategory(agentId: string, category: SemanticMemory['category']): Promise<SemanticMemory[]> {
    const index = await loadIndex(agentId);
    const results: SemanticMemory[] = [];

    for (const id of index.semantic) {
      const fact = await AgentMemoryService.read(agentId, 'agent', memoryKey('semantic', id));
      if (fact && fact.category === category) results.push(fact);
    }

    return results;
  },

  // ═══ PROCEDURAL MEMORY ════════════════════════════════════

  async learnProcedure(
    agentId: string,
    procedure: Omit<ProceduralMemory, 'type' | 'successRate' | 'timesApplied'>,
  ): Promise<string> {
    const id = `${procedure.trigger}::${procedure.action}`.replace(/\s+/g, '_').toLowerCase();
    const existing = await AgentMemoryService.read(agentId, 'agent', memoryKey('procedural', id));

    const entry: ProceduralMemory = {
      ...procedure,
      type: 'procedural',
      successRate: existing ? existing.successRate : 1.0,
      timesApplied: existing ? existing.timesApplied : 0,
      lastApplied: existing?.lastApplied,
    };

    await AgentMemoryService.write(agentId, 'agent', memoryKey('procedural', id), entry);

    const index = await loadIndex(agentId);
    if (!index.procedural.includes(id)) {
      index.procedural.push(id);
      if (index.procedural.length > MAX_PROCEDURAL) {
        const removed = index.procedural.shift()!;
        await AgentMemoryService.delete(agentId, 'agent', memoryKey('procedural', removed));
      }
      await saveIndex(agentId, index);
    }

    return id;
  },

  async findProcedures(agentId: string, trigger: string): Promise<ProceduralMemory[]> {
    const index = await loadIndex(agentId);
    const results: ProceduralMemory[] = [];
    const lower = trigger.toLowerCase();

    for (const id of index.procedural) {
      const proc = await AgentMemoryService.read(agentId, 'agent', memoryKey('procedural', id));
      if (!proc) continue;
      if (
        proc.trigger.toLowerCase().includes(lower) ||
        proc.condition.toLowerCase().includes(lower)
      ) {
        results.push(proc);
      }
    }

    return results
      .filter(p => p.successRate > 0.3)
      .sort((a, b) => b.successRate * b.timesApplied - a.successRate * a.timesApplied);
  },

  async recordProcedureOutcome(
    agentId: string,
    trigger: string,
    action: string,
    success: boolean,
  ): Promise<void> {
    const id = `${trigger}::${action}`.replace(/\s+/g, '_').toLowerCase();
    const proc = await AgentMemoryService.read(agentId, 'agent', memoryKey('procedural', id));
    if (!proc) return;

    const total = proc.timesApplied + 1;
    const successCount = proc.successRate * proc.timesApplied + (success ? 1 : 0);
    proc.successRate = successCount / total;
    proc.timesApplied = total;
    proc.lastApplied = new Date();

    await AgentMemoryService.write(agentId, 'agent', memoryKey('procedural', id), proc);
  },

  // ═══ COMPOSITE QUERIES ════════════════════════════════════

  async buildAgentContext(agentId: string): Promise<{
    recentEpisodes: EpisodicMemory[];
    relevantFacts: SemanticMemory[];
    applicableProcedures: ProceduralMemory[];
  }> {
    const [episodes, factsIndex] = await Promise.all([
      this.getRecentEpisodes(agentId, 10),
      loadIndex(agentId),
    ]);

    const facts: SemanticMemory[] = [];
    for (const id of factsIndex.semantic.slice(-20)) {
      const fact = await AgentMemoryService.read(agentId, 'agent', memoryKey('semantic', id));
      if (fact && fact.confidence > 0.5) facts.push(fact);
    }

    const procs: ProceduralMemory[] = [];
    for (const id of factsIndex.procedural) {
      const proc = await AgentMemoryService.read(agentId, 'agent', memoryKey('procedural', id));
      if (proc && proc.successRate > 0.5) procs.push(proc);
    }

    return {
      recentEpisodes: episodes,
      relevantFacts: facts,
      applicableProcedures: procs,
    };
  },

  async clearAll(agentId: string): Promise<void> {
    const index = await loadIndex(agentId);

    const allKeys = [
      ...index.episodic.map(id => memoryKey('episodic', id)),
      ...index.semantic.map(id => memoryKey('semantic', id)),
      ...index.procedural.map(id => memoryKey('procedural', id)),
    ];

    for (const key of allKeys) {
      await AgentMemoryService.delete(agentId, 'agent', key);
    }

    await AgentMemoryService.delete(agentId, 'agent', MEMORY_INDEX_KEY);
  },

  async getStats(agentId: string): Promise<{
    episodicCount: number;
    semanticCount: number;
    proceduralCount: number;
  }> {
    const index = await loadIndex(agentId);
    return {
      episodicCount: index.episodic.length,
      semanticCount: index.semantic.length,
      proceduralCount: index.procedural.length,
    };
  },
};
