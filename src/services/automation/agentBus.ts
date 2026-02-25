// Agent Bus — Inter-agent communication and discovery
//
// Provides three capabilities:
// 1. Agent Registry  — deployed agents register their capabilities for discovery
// 2. Event Bus       — agents emit events that other agents can subscribe to
// 3. Direct Call     — one agent can invoke another and wait for its result

import type { AgentBusEvent, AgentRegistryEntry, AgentStatus, DeployedAgent } from './types';

type EventHandler = (event: AgentBusEvent) => void;

const LOCAL_REGISTRY_KEY = 'agent_registry';
const LOCAL_EVENTS_KEY = 'agent_bus_events';

// ─── In-memory state ────────────────────────────────────

const subscribers = new Map<string, Set<EventHandler>>();
let registryCache: AgentRegistryEntry[] = [];
let agentRunner: ((agentId: string, triggerData: any) => Promise<any>) | null = null;

// ─── Persistence helpers ────────────────────────────────

function loadRegistry(): AgentRegistryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegistry(entries: AgentRegistryEntry[]): void {
  try {
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save agent registry:', e);
  }
}

function loadEvents(): AgentBusEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: AgentBusEvent[]): void {
  try {
    const trimmed = events.slice(-200);
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save bus events:', e);
  }
}

// ─── Capability extraction ──────────────────────────────

function extractCapabilities(agent: DeployedAgent): string[] {
  const caps: string[] = [];
  if (agent.capabilities && agent.capabilities.length > 0) return agent.capabilities;

  for (const node of agent.workflow.nodes) {
    const cfg = node.config as any;
    if (node.type === 'app') {
      caps.push(`app:${cfg.appType || 'unknown'}`);
    } else if (node.type === 'ai') {
      caps.push('ai:processing');
    } else if (node.type === 'trigger') {
      caps.push(`trigger:${cfg.triggerType || 'manual'}`);
    } else if (node.type === 'memory') {
      caps.push('memory:enabled');
    }
  }

  if (agent.description) {
    const desc = agent.description.toLowerCase();
    const keywords = ['email', 'slack', 'notion', 'report', 'analyze', 'summarize', 'classify', 'monitor'];
    for (const kw of keywords) {
      if (desc.includes(kw)) caps.push(`domain:${kw}`);
    }
  }

  return [...new Set(caps)];
}

// ─── Public API ─────────────────────────────────────────

export const AgentBus = {
  /**
   * Register a runner function that the bus can call to execute agents.
   * This is called once from AgentContext during initialization.
   */
  setAgentRunner(runner: (agentId: string, triggerData: any) => Promise<any>): void {
    agentRunner = runner;
  },

  // ═══ REGISTRY ═══════════════════════════════════════════

  /**
   * Register or update an agent in the registry.
   */
  register(agent: DeployedAgent): void {
    const entry: AgentRegistryEntry = {
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: extractCapabilities(agent),
      status: agent.status,
      lastSeen: new Date(),
    };

    registryCache = registryCache.filter((e) => e.agentId !== agent.id);
    registryCache.push(entry);
    saveRegistry(registryCache);
  },

  /**
   * Unregister an agent.
   */
  unregister(agentId: string): void {
    registryCache = registryCache.filter((e) => e.agentId !== agentId);
    saveRegistry(registryCache);
  },

  /**
   * Bulk-sync the registry from the current list of deployed agents.
   */
  syncRegistry(agents: DeployedAgent[]): void {
    registryCache = agents
      .filter((a) => a.status === 'active' || a.status === 'paused')
      .map((a) => ({
        agentId: a.id,
        name: a.name,
        description: a.description,
        capabilities: extractCapabilities(a),
        status: a.status,
        lastSeen: new Date(),
      }));
    saveRegistry(registryCache);
  },

  /**
   * Discover agents by capability.
   */
  findAgentsByCapability(capability: string): AgentRegistryEntry[] {
    if (registryCache.length === 0) registryCache = loadRegistry();
    const lower = capability.toLowerCase();
    return registryCache.filter(
      (e) =>
        e.status === 'active' &&
        (e.capabilities.some((c) => c.toLowerCase().includes(lower)) ||
          (e.description || '').toLowerCase().includes(lower) ||
          e.name.toLowerCase().includes(lower)),
    );
  },

  /**
   * Get a specific agent from the registry.
   */
  getAgent(agentId: string): AgentRegistryEntry | undefined {
    if (registryCache.length === 0) registryCache = loadRegistry();
    return registryCache.find((e) => e.agentId === agentId);
  },

  /**
   * List all registered agents.
   */
  listAgents(): AgentRegistryEntry[] {
    if (registryCache.length === 0) registryCache = loadRegistry();
    return [...registryCache];
  },

  // ═══ EVENT BUS ══════════════════════════════════════════

  /**
   * Emit an event on the bus.
   */
  emit(event: Omit<AgentBusEvent, 'id' | 'timestamp' | 'handled'>): AgentBusEvent {
    const fullEvent: AgentBusEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      handled: false,
    };

    // Persist
    const events = loadEvents();
    events.push(fullEvent);
    saveEvents(events);

    // Notify in-memory subscribers
    const targetKey = event.targetAgentId || '*';
    const handlers = subscribers.get(targetKey) || new Set();
    const broadcastHandlers = subscribers.get('*') || new Set();

    for (const handler of [...handlers, ...broadcastHandlers]) {
      try {
        handler(fullEvent);
      } catch (err) {
        console.error('AgentBus handler error:', err);
      }
    }

    return fullEvent;
  },

  /**
   * Subscribe to events for a specific agent, or '*' for all events.
   */
  subscribe(agentIdOrWildcard: string, handler: EventHandler): () => void {
    if (!subscribers.has(agentIdOrWildcard)) {
      subscribers.set(agentIdOrWildcard, new Set());
    }
    subscribers.get(agentIdOrWildcard)!.add(handler);

    return () => {
      subscribers.get(agentIdOrWildcard)?.delete(handler);
    };
  },

  /**
   * Get recent events (for UI display / debugging).
   */
  getRecentEvents(limit = 50): AgentBusEvent[] {
    return loadEvents().slice(-limit);
  },

  // ═══ DIRECT AGENT CALL ══════════════════════════════════

  /**
   * Call another agent and optionally wait for its result.
   * This is the core of agent-to-agent collaboration.
   */
  async callAgent(
    sourceAgentId: string,
    sourceAgentName: string,
    targetAgentId: string,
    inputData: any,
    waitForResult = true,
    timeoutMs = 30_000,
  ): Promise<{ success: boolean; output?: any; error?: string }> {
    if (!agentRunner) {
      return { success: false, error: 'Agent runner not initialized. Deploy agents through CrewOS first.' };
    }

    const target = this.getAgent(targetAgentId);
    if (!target) {
      return { success: false, error: `Target agent "${targetAgentId}" not found in registry.` };
    }
    if (target.status !== 'active') {
      return { success: false, error: `Target agent "${target.name}" is ${target.status}, not active.` };
    }

    // Emit a request event
    this.emit({
      type: 'agent_request',
      sourceAgentId,
      sourceAgentName,
      targetAgentId,
      payload: { inputData, waitForResult },
    });

    if (!waitForResult) {
      // Fire-and-forget: kick off execution without waiting
      agentRunner(targetAgentId, {
        ...inputData,
        _callerAgentId: sourceAgentId,
        _callerAgentName: sourceAgentName,
      }).catch((err) =>
        console.error(`Background agent call to ${target.name} failed:`, err),
      );
      return { success: true, output: { status: 'dispatched', targetAgent: target.name } };
    }

    // Wait for result with timeout
    try {
      const result = await Promise.race([
        agentRunner(targetAgentId, {
          ...inputData,
          _callerAgentId: sourceAgentId,
          _callerAgentName: sourceAgentName,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent call to "${target.name}" timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      // Emit completion event
      this.emit({
        type: 'agent_output',
        sourceAgentId: targetAgentId,
        sourceAgentName: target.name,
        targetAgentId: sourceAgentId,
        payload: result,
      });

      return { success: true, output: result };
    } catch (err: any) {
      return { success: false, error: err.message || 'Agent call failed' };
    }
  },
};
