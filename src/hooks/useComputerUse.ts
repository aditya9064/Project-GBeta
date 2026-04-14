/* ═══════════════════════════════════════════════════════════
   OperonAI Desktop Hooks

   useClaudeAgent — Claude Agent SDK powered agents
   useSwarm      — Orchestrated multi-agent team coordination
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect } from 'react';
import {
  persistExecution,
  updateExecutionStatus,
  updateTaskStatus,
} from '../services/executionPersistence';

/* ─── Type declarations for the Electron preload bridge ─── */

interface AgentStartArgs {
  goal: string;
  maxTurns?: number;
  workingDirectory?: string;
  enableGui?: boolean;
  systemPrompt?: string;
  permissionMode?: string;
  isolateFilesystem?: boolean;
}

interface AgentAPI {
  start: (args: AgentStartArgs) => Promise<{ agentId?: string; error?: string }>;
  startQueued: (args: AgentStartArgs) => Promise<{ agentId?: string; error?: string }>;
  list: () => Promise<any[]>;
  getStatus: (agentId: string) => Promise<any>;
  cancel: (agentId: string) => Promise<{ success: boolean }>;
  cancelAll: () => Promise<{ cancelled: number }>;
  activeCount: () => Promise<{ count: number }>;
  queuedCount: () => Promise<{ count: number }>;
  remove: (agentId: string) => Promise<{ success: boolean }>;
  onStep: (callback: (data: any) => void) => () => void;
  onScreenshot: (callback: (data: any) => void) => () => void;
  onComplete: (callback: (data: any) => void) => () => void;
  onError: (callback: (data: any) => void) => () => void;
  onStatusChange: (callback: (data: any) => void) => () => void;
}

interface SwarmStartArgs {
  goal: string;
  maxWorkers?: number;
  maxTurnsOrchestrator?: number;
  maxTurnsWorker?: number;
  workingDirectory?: string;
  enableGui?: boolean;
  permissionMode?: string;
  isolateWorkers?: boolean;
}

interface SwarmAPI {
  start: (args: SwarmStartArgs) => Promise<{ swarmId?: string; error?: string }>;
  getStatus: (swarmId: string) => Promise<any>;
  list: () => Promise<any[]>;
  cancel: (swarmId: string) => Promise<{ success: boolean }>;
  getTasks: (swarmId: string) => Promise<any[]>;
  remove: (swarmId: string) => Promise<{ success: boolean }>;
  onTaskUpdate: (callback: (data: any) => void) => () => void;
  onStatus: (callback: (data: any) => void) => () => void;
  onWorkerSpawned: (callback: (data: any) => void) => () => void;
  onWorkerFinished: (callback: (data: any) => void) => () => void;
  onOrchestratorStep: (callback: (data: any) => void) => () => void;
  onWorkerStep: (callback: (data: any) => void) => () => void;
}

interface OperonDesktop {
  isDesktop: boolean;
  platform: string;
  agent: AgentAPI;
  swarm: SwarmAPI;
  getPlatformInfo: () => Promise<{
    platform: string;
    arch: string;
    screenSize: { width: number; height: number };
    displays: Array<{ id: number; bounds: any; scaleFactor: number }>;
  }>;
}

declare global {
  interface Window {
    operonDesktop?: OperonDesktop;
  }
}

/* ─── Types ──────────────────────────────────────────────── */

export type ClaudeAgentStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ClaudeAgentViewMode = 'live' | 'background';

export interface ClaudeAgentStep {
  type: 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'text' | 'status';
  content: string;
  toolName?: string;
  timestamp: string;
}

export interface ClaudeAgentExecution {
  agentId: string;
  goal: string;
  status: ClaudeAgentStatus;
  viewMode: ClaudeAgentViewMode;
  steps: ClaudeAgentStep[];
  stepCount: number;
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  expanded: boolean;
  finishedAt: string | null;
}

/* ═══════════════════════════════════════════════════════════
   useClaudeAgent — Claude Agent SDK powered multi-agent hook

   Each agent gets Claude Code's full capabilities plus its
   own virtual display for GUI app control.
   ═══════════════════════════════════════════════════════════ */

export function useClaudeAgent() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.agent;

  const [agents, setAgents] = useState<Map<string, ClaudeAgentExecution>>(new Map());

  useEffect(() => {
    if (!isDesktop) return;
    const api = window.operonDesktop!.agent;
    const unsubs: Array<() => void> = [];

    unsubs.push(api.onStep((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (!agent) return prev;
        const newCount = agent.stepCount + 1;
        if (agent.viewMode === 'background') {
          next.set(data.agentId, { ...agent, stepCount: newCount });
        } else {
          const steps = [...agent.steps, data.step];
          next.set(data.agentId, { ...agent, steps: steps.length > 200 ? steps.slice(-100) : steps, stepCount: newCount });
        }
        return next;
      });
    }));

    unsubs.push(api.onScreenshot((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (!agent || agent.viewMode === 'background') return prev;
        next.set(data.agentId, { ...agent, latestScreenshot: data.screenshot });
        return next;
      });
    }));

    unsubs.push(api.onComplete((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (!agent) return prev;
        next.set(data.agentId, { ...agent, status: 'completed', result: data.result, finishedAt: new Date().toISOString() });
        return next;
      });
    }));

    unsubs.push(api.onError((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (!agent) return prev;
        next.set(data.agentId, { ...agent, status: 'failed', error: data.error, finishedAt: new Date().toISOString() });
        return next;
      });
    }));

    unsubs.push(api.onStatusChange((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (!agent) return prev;
        next.set(data.agentId, { ...agent, status: data.status });
        return next;
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startAgent = useCallback(async (
    goal: string,
    options?: {
      maxTurns?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      systemPrompt?: string;
      permissionMode?: string;
      isolateFilesystem?: boolean;
      queued?: boolean;
      viewMode?: ClaudeAgentViewMode;
    },
  ) => {
    if (!isDesktop) return null;

    const api = window.operonDesktop!.agent;
    const { queued, viewMode: vm, ...args } = options || {};
    const fn = queued ? api.startQueued : api.start;
    const result = await fn({ goal, ...args });

    if (result.error) throw new Error(result.error);
    const agentId = result.agentId!;
    const viewMode = vm || 'live';

    setAgents(prev => {
      const next = new Map(prev);
      next.set(agentId, {
        agentId,
        goal,
        status: 'starting',
        viewMode,
        steps: [],
        stepCount: 0,
        latestScreenshot: null,
        result: null,
        error: null,
        expanded: viewMode === 'live',
        finishedAt: null,
      });
      return next;
    });

    return agentId;
  }, [isDesktop]);

  const cancelAgent = useCallback(async (agentId: string) => {
    if (!isDesktop) return;
    await window.operonDesktop!.agent.cancel(agentId);
    setAgents(prev => {
      const next = new Map(prev);
      const agent = next.get(agentId);
      if (agent) next.set(agentId, { ...agent, status: 'cancelled' });
      return next;
    });
  }, [isDesktop]);

  const cancelAll = useCallback(async () => {
    if (!isDesktop) return;
    await window.operonDesktop!.agent.cancelAll();
    setAgents(prev => {
      const next = new Map(prev);
      for (const [id, agent] of next) {
        if (agent.status === 'running' || agent.status === 'starting') {
          next.set(id, { ...agent, status: 'cancelled' });
        }
      }
      return next;
    });
  }, [isDesktop]);

  const removeAgent = useCallback(async (agentId: string) => {
    if (isDesktop) {
      await window.operonDesktop!.agent.remove(agentId).catch(() => {});
    }
    setAgents(prev => {
      const next = new Map(prev);
      next.delete(agentId);
      return next;
    });
  }, [isDesktop]);

  const toggleExpanded = useCallback((agentId: string) => {
    setAgents(prev => {
      const next = new Map(prev);
      const agent = next.get(agentId);
      if (agent) next.set(agentId, { ...agent, expanded: !agent.expanded });
      return next;
    });
  }, []);

  const setViewMode = useCallback((agentId: string, viewMode: ClaudeAgentViewMode) => {
    setAgents(prev => {
      const next = new Map(prev);
      const agent = next.get(agentId);
      if (!agent) return prev;
      const updates: Partial<ClaudeAgentExecution> = { viewMode };
      if (viewMode === 'background') {
        updates.steps = [];
        updates.latestScreenshot = null;
        updates.expanded = false;
      }
      next.set(agentId, { ...agent, ...updates });
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setAgents(prev => {
      const next = new Map(prev);
      for (const [id, agent] of next) {
        if (agent.status !== 'running' && agent.status !== 'starting') {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const agentList = Array.from(agents.values());
  const activeCount = agentList.filter(a => a.status === 'running' || a.status === 'starting').length;
  const finishedCount = agentList.filter(a => a.status === 'completed' || a.status === 'failed').length;

  return {
    isDesktop,
    agents,
    agentList,
    activeCount,
    finishedCount,
    startAgent,
    cancelAgent,
    cancelAll,
    removeAgent,
    toggleExpanded,
    setViewMode,
    clearCompleted,
  };
}

/* ═══════════════════════════════════════════════════════════
   useSwarm — Orchestrated multi-agent team coordination

   An orchestrator agent decomposes goals into a task DAG,
   spawns workers, handles handoffs, shares artifacts, and
   aggregates results.
   ═══════════════════════════════════════════════════════════ */

export type SwarmSessionStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface SwarmTaskInfo {
  id: string;
  title: string;
  description: string;
  status: string;
  assignedTo: string | null;
  dependencies: string[];
  result: string | null;
  priority: number;
  failureReason: string | null;
}

export interface SwarmWorkerInfo {
  workerId: string;
  taskId: string;
  taskTitle: string;
  status: 'running' | 'completed' | 'failed';
  result: string | null;
  steps: ClaudeAgentStep[];
  stepCount: number;
}

export interface SwarmSession {
  swarmId: string;
  goal: string;
  status: SwarmSessionStatus;
  tasks: SwarmTaskInfo[];
  workers: Map<string, SwarmWorkerInfo>;
  orchestratorSteps: ClaudeAgentStep[];
  result: string | null;
  error: string | null;
  startedAt: string;
}

export function useSwarm() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.swarm;

  const [sessions, setSessions] = useState<Map<string, SwarmSession>>(new Map());

  useEffect(() => {
    if (!isDesktop) return;
    const api = window.operonDesktop!.swarm;
    const unsubs: Array<() => void> = [];

    unsubs.push(api.onStatus((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (session) {
          next.set(data.swarmId, { ...session, status: data.status });
          const isTerminal = data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled';
          updateExecutionStatus(data.swarmId, data.status, isTerminal ? { completedAt: new Date().toISOString() } : undefined);
        }
        return next;
      });
    }));

    unsubs.push(api.onTaskUpdate((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (!session) return prev;
        const tasks = [...session.tasks];
        const idx = tasks.findIndex(t => t.id === data.taskId);
        const taskInfo: SwarmTaskInfo = {
          id: data.task.id,
          title: data.task.title,
          description: data.task.description,
          status: data.task.status,
          assignedTo: data.task.assignedTo,
          dependencies: data.task.dependencies,
          result: data.task.result,
          priority: data.task.priority,
          failureReason: data.task.failureReason,
        };
        if (idx >= 0) {
          tasks[idx] = taskInfo;
        } else {
          tasks.push(taskInfo);
        }
        next.set(data.swarmId, { ...session, tasks });

        updateTaskStatus(data.swarmId, data.task.id, data.task.status, {
          result: data.task.result || undefined,
          failureReason: data.task.failureReason || undefined,
        });
        return next;
      });
    }));

    unsubs.push(api.onWorkerSpawned((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (!session) return prev;
        const workers = new Map(session.workers);
        workers.set(data.workerId, {
          workerId: data.workerId,
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          status: 'running',
          result: null,
          steps: [],
          stepCount: 0,
        });
        next.set(data.swarmId, { ...session, workers });
        return next;
      });
    }));

    unsubs.push(api.onWorkerFinished((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (!session) return prev;
        const workers = new Map(session.workers);
        const worker = workers.get(data.workerId);
        if (worker) {
          workers.set(data.workerId, { ...worker, status: data.status, result: data.result });
        }
        next.set(data.swarmId, { ...session, workers });
        return next;
      });
    }));

    unsubs.push(api.onOrchestratorStep((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (!session) return prev;
        const steps = [...session.orchestratorSteps, data.step];
        next.set(data.swarmId, {
          ...session,
          orchestratorSteps: steps.length > 100 ? steps.slice(-50) : steps,
        });
        return next;
      });
    }));

    unsubs.push(api.onWorkerStep((data) => {
      setSessions(prev => {
        const next = new Map(prev);
        const session = next.get(data.swarmId);
        if (!session) return prev;
        const workers = new Map(session.workers);
        const worker = workers.get(data.workerId);
        if (worker) {
          const steps = [...worker.steps, data.step];
          workers.set(data.workerId, {
            ...worker,
            steps: steps.length > 50 ? steps.slice(-30) : steps,
            stepCount: worker.stepCount + 1,
          });
        }
        next.set(data.swarmId, { ...session, workers });
        return next;
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startSwarm = useCallback(async (
    goal: string,
    options?: {
      maxWorkers?: number;
      maxTurnsOrchestrator?: number;
      maxTurnsWorker?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      permissionMode?: string;
      isolateWorkers?: boolean;
    },
  ) => {
    if (!isDesktop) return null;

    const result = await window.operonDesktop!.swarm.start({ goal, ...options });
    if (result.error) throw new Error(result.error);
    const swarmId = result.swarmId!;

    const startedAt = new Date().toISOString();
    setSessions(prev => {
      const next = new Map(prev);
      next.set(swarmId, {
        swarmId,
        goal,
        status: 'planning',
        tasks: [],
        workers: new Map(),
        orchestratorSteps: [],
        result: null,
        error: null,
        startedAt,
      });
      return next;
    });

    persistExecution({ swarmId, goal, status: 'planning', startedAt });

    return swarmId;
  }, [isDesktop]);

  const cancelSwarm = useCallback(async (swarmId: string) => {
    if (!isDesktop) return;
    await window.operonDesktop!.swarm.cancel(swarmId);
    setSessions(prev => {
      const next = new Map(prev);
      const session = next.get(swarmId);
      if (session) next.set(swarmId, { ...session, status: 'cancelled' });
      return next;
    });
  }, [isDesktop]);

  const removeSwarm = useCallback(async (swarmId: string) => {
    if (isDesktop) {
      await window.operonDesktop!.swarm.remove(swarmId).catch(() => {});
    }
    setSessions(prev => {
      const next = new Map(prev);
      next.delete(swarmId);
      return next;
    });
  }, [isDesktop]);

  const refreshSwarm = useCallback(async (swarmId: string) => {
    if (!isDesktop) return;
    const status = await window.operonDesktop!.swarm.getStatus(swarmId);
    if (!status) return;
    setSessions(prev => {
      const next = new Map(prev);
      const session = next.get(swarmId);
      if (session) {
        next.set(swarmId, {
          ...session,
          status: status.status,
          result: status.result,
          error: status.error,
          tasks: status.tasks || session.tasks,
        });
      }
      return next;
    });
  }, [isDesktop]);

  const sessionList = Array.from(sessions.values());
  const activeCount = sessionList.filter(s =>
    s.status === 'planning' || s.status === 'executing'
  ).length;

  return {
    isDesktop,
    sessions,
    sessionList,
    activeCount,
    startSwarm,
    cancelSwarm,
    removeSwarm,
    refreshSwarm,
  };
}
