/* ═══════════════════════════════════════════════════════════
   Preload Script — Exposes safe IPC bridge to the renderer

   Only the canonical agent:* and swarm:* APIs are exposed.
   ═══════════════════════════════════════════════════════════ */

import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('operonDesktop', {
  isDesktop: true,
  platform: process.platform,

  /* ─── Claude Agent SDK (hybrid code+GUI agents) ─────── */

  agent: {
    start: (args: {
      goal: string;
      maxTurns?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      systemPrompt?: string;
      permissionMode?: string;
      isolateFilesystem?: boolean;
    }) => ipcRenderer.invoke('agent:start', args),

    startQueued: (args: {
      goal: string;
      maxTurns?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      systemPrompt?: string;
      permissionMode?: string;
      isolateFilesystem?: boolean;
    }) => ipcRenderer.invoke('agent:start-queued', args),

    list: () => ipcRenderer.invoke('agent:list') as Promise<any[]>,

    getStatus: (agentId: string) =>
      ipcRenderer.invoke('agent:status', { agentId }),

    cancel: (agentId: string) =>
      ipcRenderer.invoke('agent:cancel', { agentId }),

    cancelAll: () =>
      ipcRenderer.invoke('agent:cancel-all'),

    activeCount: () =>
      ipcRenderer.invoke('agent:active-count') as Promise<{ count: number }>,

    queuedCount: () =>
      ipcRenderer.invoke('agent:queued-count') as Promise<{ count: number }>,

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

  /* ─── Swarm (orchestrated multi-agent teams) ──────────── */

  swarm: {
    start: (args: {
      goal: string;
      maxWorkers?: number;
      maxTurnsOrchestrator?: number;
      maxTurnsWorker?: number;
      workingDirectory?: string;
      enableGui?: boolean;
      permissionMode?: string;
      isolateWorkers?: boolean;
    }) => ipcRenderer.invoke('swarm:start', args),

    getStatus: (swarmId: string) =>
      ipcRenderer.invoke('swarm:status', { swarmId }),

    list: () => ipcRenderer.invoke('swarm:list') as Promise<any[]>,

    cancel: (swarmId: string) =>
      ipcRenderer.invoke('swarm:cancel', { swarmId }),

    getTasks: (swarmId: string) =>
      ipcRenderer.invoke('swarm:tasks', { swarmId }),

    remove: (swarmId: string) =>
      ipcRenderer.invoke('swarm:remove', { swarmId }),

    onTaskUpdate: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:task-update', handler);
      return () => ipcRenderer.removeListener('swarm:task-update', handler);
    },

    onStatus: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:status', handler);
      return () => ipcRenderer.removeListener('swarm:status', handler);
    },

    onWorkerSpawned: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:worker-spawned', handler);
      return () => ipcRenderer.removeListener('swarm:worker-spawned', handler);
    },

    onWorkerFinished: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:worker-finished', handler);
      return () => ipcRenderer.removeListener('swarm:worker-finished', handler);
    },

    onOrchestratorStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:orchestrator-step', handler);
      return () => ipcRenderer.removeListener('swarm:orchestrator-step', handler);
    },

    onWorkerStep: (callback: (data: any) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('swarm:worker-step', handler);
      return () => ipcRenderer.removeListener('swarm:worker-step', handler);
    },
  },

  /* ─── Platform Info ──────────────────────────────────── */

  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
});
