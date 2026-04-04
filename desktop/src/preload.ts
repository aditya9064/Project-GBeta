/* ═══════════════════════════════════════════════════════════
   Preload Script — Exposes safe IPC bridge to the renderer

   The renderer (OperonAI web UI) can call these methods to
   control the Computer Use agent running in the main process.
   ═══════════════════════════════════════════════════════════ */

import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('operonDesktop', {
  isDesktop: true,
  platform: process.platform,

  /* ─── Computer Use Agent ─────────────────────────────── */

  computerUse: {
    start: (args: {
      goal: string;
      model?: string;
      maxTurns?: number;
      maxBudgetUsd?: number;
      allowedApps?: string[];
    }) => ipcRenderer.invoke('computer-use:start', args),

    approve: (executionId: string, approved: boolean) =>
      ipcRenderer.invoke('computer-use:approve', { executionId, approved }),

    cancel: (executionId: string) =>
      ipcRenderer.invoke('computer-use:cancel', { executionId }),

    takeScreenshot: () =>
      ipcRenderer.invoke('computer-use:screenshot'),

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('computer-use:step', handler);
      return () => ipcRenderer.removeListener('computer-use:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('computer-use:screenshot', handler);
      return () => ipcRenderer.removeListener('computer-use:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('computer-use:complete', handler);
      return () => ipcRenderer.removeListener('computer-use:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('computer-use:error', handler);
      return () => ipcRenderer.removeListener('computer-use:error', handler);
    },

    onApprovalRequired: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('computer-use:approval', handler);
      return () => ipcRenderer.removeListener('computer-use:approval', handler);
    },
  },

  /* ─── Multi-Agent Orchestrator ───────────────────────── */

  multiAgent: {
    start: (args: {
      goal: string;
      targetApp: string;
      model?: string;
      maxTurns?: number;
      maxBudgetUsd?: number;
    }) => ipcRenderer.invoke('multi-agent:start', args),

    list: () => ipcRenderer.invoke('multi-agent:list') as Promise<any[]>,

    cancel: (executionId: string) =>
      ipcRenderer.invoke('multi-agent:cancel', { executionId }),

    cancelAll: () =>
      ipcRenderer.invoke('multi-agent:cancel-all'),

    approve: (executionId: string, approved: boolean) =>
      ipcRenderer.invoke('multi-agent:approve', { executionId, approved }),

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:step', handler);
      return () => ipcRenderer.removeListener('multi-agent:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:screenshot', handler);
      return () => ipcRenderer.removeListener('multi-agent:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:complete', handler);
      return () => ipcRenderer.removeListener('multi-agent:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:error', handler);
      return () => ipcRenderer.removeListener('multi-agent:error', handler);
    },

    onApprovalRequired: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:approval', handler);
      return () => ipcRenderer.removeListener('multi-agent:approval', handler);
    },

    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('multi-agent:status', handler);
      return () => ipcRenderer.removeListener('multi-agent:status', handler);
    },
  },

  /* ─── Sandboxed Agent (no screen takeover) ────────────── */

  sandboxed: {
    start: (args: {
      goal: string;
      targetApp?: string;
      startUrl?: string;
      mode?: 'headless' | 'window' | 'auto';
    }) => ipcRenderer.invoke('sandboxed:start', args),

    cancel: (executionId: string) =>
      ipcRenderer.invoke('sandboxed:cancel', { executionId }),

    detectMode: (goal: string, targetApp?: string) =>
      ipcRenderer.invoke('sandboxed:detect-mode', { goal, targetApp }) as Promise<{ mode: string }>,

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('sandboxed:step', handler);
      return () => ipcRenderer.removeListener('sandboxed:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('sandboxed:screenshot', handler);
      return () => ipcRenderer.removeListener('sandboxed:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('sandboxed:complete', handler);
      return () => ipcRenderer.removeListener('sandboxed:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('sandboxed:error', handler);
      return () => ipcRenderer.removeListener('sandboxed:error', handler);
    },
  },

  /* ─── Virtual Display Agent (own display per agent) ──── */

  virtualDisplay: {
    start: (args: {
      goal: string;
      apps?: string[];
      maxTurns?: number;
    }) => ipcRenderer.invoke('vd-agent:start', args),

    cancel: (executionId: string) =>
      ipcRenderer.invoke('vd-agent:cancel', { executionId }),

    listDisplays: () =>
      ipcRenderer.invoke('vd-agent:list-displays') as Promise<any[]>,

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('vd-agent:step', handler);
      return () => ipcRenderer.removeListener('vd-agent:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('vd-agent:screenshot', handler);
      return () => ipcRenderer.removeListener('vd-agent:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('vd-agent:complete', handler);
      return () => ipcRenderer.removeListener('vd-agent:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('vd-agent:error', handler);
      return () => ipcRenderer.removeListener('vd-agent:error', handler);
    },
  },

  /* ─── Agent Pool (fully-isolated parallel agents) ────── */
  /* Each agent gets its own virtual display, its own window
     per app, its own keyboard/mouse/clipboard. Multiple
     agents can use the same app without conflicts. */

  agentPool: {
    start: (args: {
      goal: string;
      apps?: string[];
      maxTurns?: number;
    }) => ipcRenderer.invoke('agent-pool:start', args),

    list: () => ipcRenderer.invoke('agent-pool:list') as Promise<any[]>,

    getStatus: (executionId: string) =>
      ipcRenderer.invoke('agent-pool:status', { executionId }),

    cancel: (executionId: string) =>
      ipcRenderer.invoke('agent-pool:cancel', { executionId }),

    cancelAll: () =>
      ipcRenderer.invoke('agent-pool:cancel-all'),

    activeCount: () =>
      ipcRenderer.invoke('agent-pool:active-count') as Promise<{ count: number }>,

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent-pool:step', handler);
      return () => ipcRenderer.removeListener('agent-pool:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent-pool:screenshot', handler);
      return () => ipcRenderer.removeListener('agent-pool:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent-pool:complete', handler);
      return () => ipcRenderer.removeListener('agent-pool:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent-pool:error', handler);
      return () => ipcRenderer.removeListener('agent-pool:error', handler);
    },

    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent-pool:status', handler);
      return () => ipcRenderer.removeListener('agent-pool:status', handler);
    },
  },

  /* ─── Claude Agent SDK (hybrid code+GUI agents) ─────── */
  /* Each agent gets Claude Code's full tool set (file editing,
     shell, search, git) plus its own virtual display for GUI
     app control. Multiple agents run concurrently. */

  agent: {
    start: (args: {
      goal: string;
      maxTurns?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      systemPrompt?: string;
    }) => ipcRenderer.invoke('agent:start', args),

    list: () => ipcRenderer.invoke('agent:list') as Promise<any[]>,

    getStatus: (agentId: string) =>
      ipcRenderer.invoke('agent:status', { agentId }),

    cancel: (agentId: string) =>
      ipcRenderer.invoke('agent:cancel', { agentId }),

    cancelAll: () =>
      ipcRenderer.invoke('agent:cancel-all'),

    activeCount: () =>
      ipcRenderer.invoke('agent:active-count') as Promise<{ count: number }>,

    remove: (agentId: string) =>
      ipcRenderer.invoke('agent:remove', { agentId }),

    onStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:step', handler);
      return () => ipcRenderer.removeListener('agent:step', handler);
    },

    onScreenshot: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:screenshot', handler);
      return () => ipcRenderer.removeListener('agent:screenshot', handler);
    },

    onComplete: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:complete', handler);
      return () => ipcRenderer.removeListener('agent:complete', handler);
    },

    onError: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:error', handler);
      return () => ipcRenderer.removeListener('agent:error', handler);
    },

    onStatusChange: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('agent:status', handler);
      return () => ipcRenderer.removeListener('agent:status', handler);
    },
  },

  /* ─── Platform Info ──────────────────────────────────── */

  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
});
