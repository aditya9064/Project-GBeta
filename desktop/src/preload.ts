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

  /* ─── Platform Info ──────────────────────────────────── */

  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
});
