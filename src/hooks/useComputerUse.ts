/* ═══════════════════════════════════════════════════════════
   useComputerUse — React hook for the desktop Computer Use agent

   When the app runs inside the Electron desktop shell,
   this hook connects to the Computer Use agent running in
   the main process. It enables the UI to start tasks, show
   live screenshots, display actions, and gate approvals.

   When running in a regular browser, isDesktop is false
   and none of the Computer Use features are available.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useRef } from 'react';

/* ─── Type declarations for the Electron preload bridge ─── */

interface MultiAgentAPI {
  start: (args: {
    goal: string;
    targetApp: string;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
  }) => Promise<{ executionId: string }>;
  list: () => Promise<any[]>;
  cancel: (executionId: string) => Promise<{ success: boolean }>;
  cancelAll: () => Promise<{ cancelled: number }>;
  approve: (executionId: string, approved: boolean) => Promise<{ success: boolean }>;
  onStep: (callback: (data: any) => void) => () => void;
  onScreenshot: (callback: (data: any) => void) => () => void;
  onComplete: (callback: (data: any) => void) => () => void;
  onError: (callback: (data: any) => void) => () => void;
  onApprovalRequired: (callback: (data: any) => void) => () => void;
  onStatusChange: (callback: (data: any) => void) => () => void;
}

interface SandboxedAPI {
  start: (args: {
    goal: string;
    targetApp?: string;
    startUrl?: string;
    mode?: 'headless' | 'window' | 'auto';
  }) => Promise<{ executionId: string; mode: string }>;
  cancel: (executionId: string) => Promise<{ success: boolean }>;
  detectMode: (goal: string, targetApp?: string) => Promise<{ mode: string }>;
  onStep: (callback: (data: any) => void) => () => void;
  onScreenshot: (callback: (data: any) => void) => () => void;
  onComplete: (callback: (data: any) => void) => () => void;
  onError: (callback: (data: any) => void) => () => void;
}

interface VirtualDisplayAPI {
  start: (args: {
    goal: string;
    apps?: string[];
    maxTurns?: number;
  }) => Promise<{ executionId: string }>;
  cancel: (executionId: string) => Promise<{ success: boolean }>;
  listDisplays: () => Promise<any[]>;
  onStep: (callback: (data: any) => void) => () => void;
  onScreenshot: (callback: (data: any) => void) => () => void;
  onComplete: (callback: (data: any) => void) => () => void;
  onError: (callback: (data: any) => void) => () => void;
}

interface AgentAPI {
  start: (args: {
    goal: string;
    maxTurns?: number;
    workingDirectory?: string;
    enableGui?: boolean;
    systemPrompt?: string;
  }) => Promise<{ agentId: string }>;
  list: () => Promise<any[]>;
  getStatus: (agentId: string) => Promise<any>;
  cancel: (agentId: string) => Promise<{ success: boolean }>;
  cancelAll: () => Promise<{ cancelled: number }>;
  activeCount: () => Promise<{ count: number }>;
  remove: (agentId: string) => Promise<{ success: boolean }>;
  onStep: (callback: (data: any) => void) => () => void;
  onScreenshot: (callback: (data: any) => void) => () => void;
  onComplete: (callback: (data: any) => void) => () => void;
  onError: (callback: (data: any) => void) => () => void;
  onStatusChange: (callback: (data: any) => void) => () => void;
}

interface OperonDesktop {
  isDesktop: boolean;
  platform: string;
  computerUse: {
    start: (args: {
      goal: string;
      model?: string;
      maxTurns?: number;
      maxBudgetUsd?: number;
      allowedApps?: string[];
    }) => Promise<{ executionId: string }>;
    approve: (executionId: string, approved: boolean) => Promise<{ success: boolean }>;
    cancel: (executionId: string) => Promise<{ success: boolean }>;
    takeScreenshot: () => Promise<string | null>;
    onStep: (callback: (data: any) => void) => () => void;
    onScreenshot: (callback: (data: any) => void) => () => void;
    onComplete: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
    onApprovalRequired: (callback: (data: any) => void) => () => void;
  };
  multiAgent: MultiAgentAPI;
  sandboxed: SandboxedAPI;
  virtualDisplay: VirtualDisplayAPI;
  agent: AgentAPI;
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

export interface ComputerUseStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'approval';
  content?: string;
  action?: {
    type: string;
    coordinate?: [number, number];
    text?: string;
    key?: string;
  };
  timestamp: string;
}

export interface ComputerUseState {
  isDesktop: boolean;
  status: 'idle' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  executionId: string | null;
  steps: ComputerUseStep[];
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  pendingApproval: { description: string; action: any } | null;
}

/* ─── Hook ───────────────────────────────────────────────── */

export function useComputerUse() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.isDesktop;

  const [state, setState] = useState<ComputerUseState>({
    isDesktop,
    status: 'idle',
    executionId: null,
    steps: [],
    latestScreenshot: null,
    result: null,
    error: null,
    pendingApproval: null,
  });

  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!isDesktop) return;
    const desktop = window.operonDesktop!;

    const unsubs: Array<() => void> = [];

    unsubs.push(desktop.computerUse.onStep((data) => {
      setState(prev => ({
        ...prev,
        steps: [...prev.steps, data.step],
      }));
    }));

    unsubs.push(desktop.computerUse.onScreenshot((data) => {
      setState(prev => ({
        ...prev,
        latestScreenshot: data.screenshot,
      }));
    }));

    unsubs.push(desktop.computerUse.onComplete((data) => {
      setState(prev => ({
        ...prev,
        status: 'completed',
        result: data.result,
      }));
    }));

    unsubs.push(desktop.computerUse.onError((data) => {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: data.error,
      }));
    }));

    unsubs.push(desktop.computerUse.onApprovalRequired((data) => {
      setState(prev => ({
        ...prev,
        status: 'awaiting_approval',
        pendingApproval: data.action,
      }));
    }));

    cleanupRef.current = unsubs;
    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startTask = useCallback(async (goal: string, options?: {
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    allowedApps?: string[];
  }) => {
    if (!isDesktop) return;

    setState(prev => ({
      ...prev,
      status: 'running',
      steps: [],
      latestScreenshot: null,
      result: null,
      error: null,
      pendingApproval: null,
    }));

    const { executionId } = await window.operonDesktop!.computerUse.start({
      goal,
      ...options,
    });

    setState(prev => ({ ...prev, executionId }));
  }, [isDesktop]);

  const approve = useCallback(async (approved: boolean) => {
    if (!isDesktop || !state.executionId) return;

    await window.operonDesktop!.computerUse.approve(state.executionId, approved);
    setState(prev => ({
      ...prev,
      status: 'running',
      pendingApproval: null,
    }));
  }, [isDesktop, state.executionId]);

  const cancel = useCallback(async () => {
    if (!isDesktop || !state.executionId) return;

    await window.operonDesktop!.computerUse.cancel(state.executionId);
    setState(prev => ({ ...prev, status: 'cancelled' }));
  }, [isDesktop, state.executionId]);

  const takeScreenshot = useCallback(async () => {
    if (!isDesktop) return null;
    return window.operonDesktop!.computerUse.takeScreenshot();
  }, [isDesktop]);

  const reset = useCallback(() => {
    setState({
      isDesktop,
      status: 'idle',
      executionId: null,
      steps: [],
      latestScreenshot: null,
      result: null,
      error: null,
      pendingApproval: null,
    });
  }, [isDesktop]);

  return {
    ...state,
    startTask,
    approve,
    cancel,
    takeScreenshot,
    reset,
  };
}

/* ═══════════════════════════════════════════════════════════
   useMultiAgent — React hook for running multiple desktop
   agents concurrently, each scoped to a target app window
   ═══════════════════════════════════════════════════════════ */

export type MultiAgentStatus = 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface MultiAgentExecution {
  executionId: string;
  targetApp: string;
  goal: string;
  status: MultiAgentStatus;
  steps: ComputerUseStep[];
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  pendingApproval: { description: string; action: any } | null;
}

export function useMultiAgent() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.isDesktop;

  const [agents, setAgents] = useState<Map<string, MultiAgentExecution>>(new Map());

  useEffect(() => {
    if (!isDesktop) return;
    const api = window.operonDesktop!.multiAgent;
    const unsubs: Array<() => void> = [];

    unsubs.push(api.onStep((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, {
            ...agent,
            steps: [...agent.steps, data.step],
          });
        }
        return next;
      });
    }));

    unsubs.push(api.onScreenshot((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, { ...agent, latestScreenshot: data.screenshot });
        }
        return next;
      });
    }));

    unsubs.push(api.onComplete((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, { ...agent, status: 'completed', result: data.result });
        }
        return next;
      });
    }));

    unsubs.push(api.onError((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, { ...agent, status: 'failed', error: data.error });
        }
        return next;
      });
    }));

    unsubs.push(api.onApprovalRequired((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, {
            ...agent,
            status: 'awaiting_approval',
            pendingApproval: data.action,
          });
        }
        return next;
      });
    }));

    unsubs.push(api.onStatusChange((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.executionId);
        if (agent) {
          next.set(data.executionId, { ...agent, status: data.status });
        }
        return next;
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startAgent = useCallback(async (
    goal: string,
    targetApp: string,
    options?: { model?: string; maxTurns?: number; maxBudgetUsd?: number },
  ) => {
    if (!isDesktop) return null;
    const { executionId } = await window.operonDesktop!.multiAgent.start({
      goal,
      targetApp,
      ...options,
    });

    setAgents(prev => {
      const next = new Map(prev);
      next.set(executionId, {
        executionId,
        targetApp,
        goal,
        status: 'running',
        steps: [],
        latestScreenshot: null,
        result: null,
        error: null,
        pendingApproval: null,
      });
      return next;
    });

    return executionId;
  }, [isDesktop]);

  const cancelAgent = useCallback(async (executionId: string) => {
    if (!isDesktop) return;
    await window.operonDesktop!.multiAgent.cancel(executionId);
    setAgents(prev => {
      const next = new Map(prev);
      const agent = next.get(executionId);
      if (agent) next.set(executionId, { ...agent, status: 'cancelled' });
      return next;
    });
  }, [isDesktop]);

  const cancelAll = useCallback(async () => {
    if (!isDesktop) return;
    await window.operonDesktop!.multiAgent.cancelAll();
    setAgents(prev => {
      const next = new Map(prev);
      for (const [id, agent] of next) {
        if (agent.status === 'running' || agent.status === 'awaiting_approval') {
          next.set(id, { ...agent, status: 'cancelled' });
        }
      }
      return next;
    });
  }, [isDesktop]);

  const approveAgent = useCallback(async (executionId: string, approved: boolean) => {
    if (!isDesktop) return;
    await window.operonDesktop!.multiAgent.approve(executionId, approved);
    if (approved) {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(executionId);
        if (agent) next.set(executionId, { ...agent, status: 'running', pendingApproval: null });
        return next;
      });
    }
  }, [isDesktop]);

  const removeAgent = useCallback((executionId: string) => {
    setAgents(prev => {
      const next = new Map(prev);
      next.delete(executionId);
      return next;
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setAgents(prev => {
      const next = new Map(prev);
      for (const [id, agent] of next) {
        if (agent.status !== 'running' && agent.status !== 'awaiting_approval') {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const agentList = Array.from(agents.values());
  const activeCount = agentList.filter(a => a.status === 'running' || a.status === 'awaiting_approval').length;

  return {
    isDesktop,
    agents,
    agentList,
    activeCount,
    startAgent,
    cancelAgent,
    cancelAll,
    approveAgent,
    removeAgent,
    clearCompleted,
  };
}

/* ═══════════════════════════════════════════════════════════
   useSandboxedAgent — Run agent tasks without taking over
   the user's screen. Auto-detects web vs native tasks.
   
   Web tasks → headless Puppeteer (invisible to user)
   Native tasks → per-window isolation (no cursor hijack)
   ═══════════════════════════════════════════════════════════ */

export interface SandboxedExecution {
  executionId: string;
  goal: string;
  mode: string;
  targetApp?: string;
  status: 'running' | 'completed' | 'failed';
  steps: Array<{ type: string; content?: string; timestamp: string }>;
  latestScreenshot: string | null;
  result: string | null;
  extractedData: any;
  error: string | null;
}

export function useSandboxedAgent() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.sandboxed;

  const [executions, setExecutions] = useState<Map<string, SandboxedExecution>>(new Map());

  useEffect(() => {
    if (!isDesktop) return;
    const api = window.operonDesktop!.sandboxed;
    const unsubs: Array<() => void> = [];

    unsubs.push(api.onStep((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, {
            ...exec,
            steps: [...exec.steps, data.step],
          });
        }
        return next;
      });
    }));

    unsubs.push(api.onScreenshot((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, { ...exec, latestScreenshot: data.screenshot });
        }
        return next;
      });
    }));

    unsubs.push(api.onComplete((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, {
            ...exec,
            status: 'completed',
            result: data.result,
            extractedData: data.extractedData,
          });
        }
        return next;
      });
    }));

    unsubs.push(api.onError((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, { ...exec, status: 'failed', error: data.error });
        }
        return next;
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startTask = useCallback(async (
    goal: string,
    options?: { targetApp?: string; startUrl?: string; mode?: 'headless' | 'window' | 'auto' }
  ) => {
    if (!isDesktop) return null;

    const { executionId, mode } = await window.operonDesktop!.sandboxed.start({
      goal,
      ...options,
      mode: options?.mode || 'auto',
    });

    setExecutions(prev => {
      const next = new Map(prev);
      next.set(executionId, {
        executionId,
        goal,
        mode,
        targetApp: options?.targetApp,
        status: 'running',
        steps: [],
        latestScreenshot: null,
        result: null,
        extractedData: null,
        error: null,
      });
      return next;
    });

    return executionId;
  }, [isDesktop]);

  const cancelTask = useCallback(async (executionId: string) => {
    if (!isDesktop) return;
    await window.operonDesktop!.sandboxed.cancel(executionId);
    setExecutions(prev => {
      const next = new Map(prev);
      const exec = next.get(executionId);
      if (exec) next.set(executionId, { ...exec, status: 'failed', error: 'Cancelled' });
      return next;
    });
  }, [isDesktop]);

  const detectMode = useCallback(async (goal: string, targetApp?: string) => {
    if (!isDesktop) return 'headless';
    const { mode } = await window.operonDesktop!.sandboxed.detectMode(goal, targetApp);
    return mode;
  }, [isDesktop]);

  const removeExecution = useCallback((executionId: string) => {
    setExecutions(prev => {
      const next = new Map(prev);
      next.delete(executionId);
      return next;
    });
  }, []);

  const executionList = Array.from(executions.values());
  const activeCount = executionList.filter(e => e.status === 'running').length;

  return {
    isDesktop,
    executions,
    executionList,
    activeCount,
    startTask,
    cancelTask,
    detectMode,
    removeExecution,
  };
}

/* ═══════════════════════════════════════════════════════════
   useVirtualDisplayAgent — Each agent gets its own invisible
   virtual monitor and can open/switch between multiple apps.

   This is the primary agent for desktop automation. It never
   touches the user's physical screen or cursor.
   ═══════════════════════════════════════════════════════════ */

export interface VDExecution {
  executionId: string;
  goal: string;
  apps: string[];
  status: 'running' | 'completed' | 'failed';
  steps: Array<{ type: string; content?: string; timestamp: string }>;
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
}

export function useVirtualDisplayAgent() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.virtualDisplay;

  const [executions, setExecutions] = useState<Map<string, VDExecution>>(new Map());

  useEffect(() => {
    if (!isDesktop) return;
    const api = window.operonDesktop!.virtualDisplay;
    const unsubs: Array<() => void> = [];

    unsubs.push(api.onStep((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, {
            ...exec,
            steps: [...exec.steps, data.step],
          });
        }
        return next;
      });
    }));

    unsubs.push(api.onScreenshot((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, { ...exec, latestScreenshot: data.screenshot });
        }
        return next;
      });
    }));

    unsubs.push(api.onComplete((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, { ...exec, status: 'completed', result: data.result });
        }
        return next;
      });
    }));

    unsubs.push(api.onError((data) => {
      setExecutions(prev => {
        const next = new Map(prev);
        const exec = next.get(data.executionId);
        if (exec) {
          next.set(data.executionId, { ...exec, status: 'failed', error: data.error });
        }
        return next;
      });
    }));

    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startAgent = useCallback(async (
    goal: string,
    options?: { apps?: string[]; maxTurns?: number }
  ) => {
    if (!isDesktop) return null;

    const { executionId } = await window.operonDesktop!.virtualDisplay.start({
      goal,
      apps: options?.apps,
      maxTurns: options?.maxTurns,
    });

    setExecutions(prev => {
      const next = new Map(prev);
      next.set(executionId, {
        executionId,
        goal,
        apps: options?.apps || [],
        status: 'running',
        steps: [],
        latestScreenshot: null,
        result: null,
        error: null,
      });
      return next;
    });

    return executionId;
  }, [isDesktop]);

  const cancelAgent = useCallback(async (executionId: string) => {
    if (!isDesktop) return;
    await window.operonDesktop!.virtualDisplay.cancel(executionId);
    setExecutions(prev => {
      const next = new Map(prev);
      const exec = next.get(executionId);
      if (exec) next.set(executionId, { ...exec, status: 'failed', error: 'Cancelled' });
      return next;
    });
  }, [isDesktop]);

  const listDisplays = useCallback(async () => {
    if (!isDesktop) return [];
    return window.operonDesktop!.virtualDisplay.listDisplays();
  }, [isDesktop]);

  const removeExecution = useCallback((executionId: string) => {
    setExecutions(prev => {
      const next = new Map(prev);
      next.delete(executionId);
      return next;
    });
  }, []);

  const executionList = Array.from(executions.values());
  const activeCount = executionList.filter(e => e.status === 'running').length;

  return {
    isDesktop,
    executions,
    executionList,
    activeCount,
    startAgent,
    cancelAgent,
    listDisplays,
    removeExecution,
  };
}

/* ═══════════════════════════════════════════════════════════
   useClaudeAgent — Claude Agent SDK powered multi-agent hook

   Each agent gets Claude Code's full capabilities (file editing,
   shell, code search, git) PLUS its own virtual display for
   GUI app control. Multiple agents run concurrently.

   This is the primary hook for the new agent architecture.
   ═══════════════════════════════════════════════════════════ */

export type ClaudeAgentStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  steps: ClaudeAgentStep[];
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  expanded: boolean;
}

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
        if (agent) {
          const steps = [...agent.steps, data.step];
          next.set(data.agentId, { ...agent, steps: steps.length > 200 ? steps.slice(-100) : steps });
        }
        return next;
      });
    }));

    unsubs.push(api.onScreenshot((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (agent) {
          next.set(data.agentId, { ...agent, latestScreenshot: data.screenshot });
        }
        return next;
      });
    }));

    unsubs.push(api.onComplete((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (agent) {
          next.set(data.agentId, { ...agent, status: 'completed', result: data.result });
        }
        return next;
      });
    }));

    unsubs.push(api.onError((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (agent) {
          next.set(data.agentId, { ...agent, status: 'failed', error: data.error });
        }
        return next;
      });
    }));

    unsubs.push(api.onStatusChange((data) => {
      setAgents(prev => {
        const next = new Map(prev);
        const agent = next.get(data.agentId);
        if (agent) {
          next.set(data.agentId, { ...agent, status: data.status });
        }
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
    },
  ) => {
    if (!isDesktop) return null;

    const { agentId } = await window.operonDesktop!.agent.start({
      goal,
      ...options,
    });

    setAgents(prev => {
      const next = new Map(prev);
      next.set(agentId, {
        agentId,
        goal,
        status: 'starting',
        steps: [],
        latestScreenshot: null,
        result: null,
        error: null,
        expanded: true,
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

  return {
    isDesktop,
    agents,
    agentList,
    activeCount,
    startAgent,
    cancelAgent,
    cancelAll,
    removeAgent,
    toggleExpanded,
    clearCompleted,
  };
}
