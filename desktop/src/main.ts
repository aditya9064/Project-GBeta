/* ═══════════════════════════════════════════════════════════
   OperonAI Desktop — Electron Main Process

   Runs the Claude Agent SDK locally on the user's machine
   with Computer Use capability for native app control.

   Architecture:
   ┌─────────────────────────────────────────────┐
   │  Electron Main Process                      │
   │  ├── Claude Agent SDK (agentic loop)        │
   │  ├── Virtual Display (per-agent isolation)  │
   │  ├── Swarm Orchestrator (task DAG)          │
   │  └── IPC Bridge → Renderer                  │
   ├─────────────────────────────────────────────┤
   │  Renderer (BrowserWindow)                   │
   │  └── OperonAI Web UI (loaded from server)   │
   └─────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════ */

import electron from 'electron';
const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = electron;
import { VirtualDisplayManager } from './virtualDisplayManager.js';
import { AgentManager } from './agentManager.js';
import type { PermissionMode } from './claudeAgent.js';
import type { StartSwarmArgs } from './agentManager.js';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(import.meta.dirname, '../../server/.env') });

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

const displayManager = new VirtualDisplayManager();
let agentManager: AgentManager | null = null;

const WEB_UI_URL = process.env.OPERON_UI_URL || 'http://localhost:5177';

/* ─── Create Main Window ─────────────────────────────────── */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(WEB_UI_URL);

  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Desktop] Failed to load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ─── IPC Handlers ───────────────────────────────────────── */

function setupIPC() {
  ipcMain.handle('computer-use:screenshot', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: screen.getPrimaryDisplay().workAreaSize,
    });
    const primaryScreen = sources[0];
    if (!primaryScreen) return null;
    return primaryScreen.thumbnail.toDataURL();
  });

  ipcMain.handle('get-platform-info', () => ({
    platform: process.platform,
    arch: process.arch,
    screenSize: screen.getPrimaryDisplay().workAreaSize,
    displays: screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
    })),
  }));

  /* ─── Agent Manager (lazy init) ────────────────────────── */

  function getAgentManager(): AgentManager {
    if (!agentManager) {
      agentManager = new AgentManager(displayManager, {
        onStep: (agentId, step) => {
          mainWindow?.webContents.send('agent:step', { agentId, step });
        },
        onScreenshot: (agentId, screenshot) => {
          mainWindow?.webContents.send('agent:screenshot', { agentId, screenshot });
        },
        onComplete: (agentId, result) => {
          mainWindow?.webContents.send('agent:complete', { agentId, result });
        },
        onError: (agentId, error) => {
          mainWindow?.webContents.send('agent:error', { agentId, error });
        },
        onStatusChange: (agentId, status) => {
          mainWindow?.webContents.send('agent:status', { agentId, status });
        },
        onSwarmTaskUpdate: (swarmId, taskId, task) => {
          mainWindow?.webContents.send('swarm:task-update', { swarmId, taskId, task });
        },
        onSwarmStatus: (swarmId, status) => {
          mainWindow?.webContents.send('swarm:status', { swarmId, status });
        },
        onSwarmWorkerSpawned: (swarmId, workerId, taskId, taskTitle) => {
          mainWindow?.webContents.send('swarm:worker-spawned', { swarmId, workerId, taskId, taskTitle });
        },
        onSwarmWorkerFinished: (swarmId, workerId, taskId, status, result) => {
          mainWindow?.webContents.send('swarm:worker-finished', { swarmId, workerId, taskId, status, result });
        },
        onSwarmOrchestratorStep: (swarmId, step) => {
          mainWindow?.webContents.send('swarm:orchestrator-step', { swarmId, step });
        },
        onSwarmWorkerStep: (swarmId, workerId, taskId, step) => {
          mainWindow?.webContents.send('swarm:worker-step', { swarmId, workerId, taskId, step });
        },
      });
    }
    return agentManager;
  }

  /* ─── Claude Agent SDK IPC (single agents) ─────────────── */

  ipcMain.handle('agent:start', async (_event, args: {
    goal: string;
    maxTurns?: number;
    workingDirectory?: string;
    enableGui?: boolean;
    systemPrompt?: string;
    permissionMode?: PermissionMode;
    isolateFilesystem?: boolean;
  }) => {
    console.log('[Agent] Start:', args.goal.slice(0, 100));
    const mgr = getAgentManager();

    try { await mgr.ensureDisplayServer(); } catch (err: any) {
      console.warn('[Agent] Display server failed, GUI tools unavailable:', err.message);
    }

    try {
      const agentId = mgr.startAgent(args);
      return { agentId };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('agent:start-queued', async (_event, args: {
    goal: string;
    maxTurns?: number;
    workingDirectory?: string;
    enableGui?: boolean;
    systemPrompt?: string;
    permissionMode?: PermissionMode;
    isolateFilesystem?: boolean;
  }) => {
    console.log('[Agent] Start (queued):', args.goal.slice(0, 100));
    const mgr = getAgentManager();

    try { await mgr.ensureDisplayServer(); } catch (err: any) {
      console.warn('[Agent] Display server failed, GUI tools unavailable:', err.message);
    }

    try {
      const agentId = await mgr.startAgentQueued(args);
      return { agentId };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('agent:list', async () => {
    return getAgentManager().listAgents();
  });

  ipcMain.handle('agent:status', async (_event, args: { agentId: string }) => {
    return getAgentManager().getAgentStatus(args.agentId);
  });

  ipcMain.handle('agent:cancel', async (_event, args: { agentId: string }) => {
    return { success: getAgentManager().cancelAgent(args.agentId) };
  });

  ipcMain.handle('agent:cancel-all', async () => {
    return { cancelled: getAgentManager().cancelAll() };
  });

  ipcMain.handle('agent:active-count', async () => {
    return { count: getAgentManager().getActiveCount() };
  });

  ipcMain.handle('agent:queued-count', async () => {
    return { count: getAgentManager().getQueuedCount() };
  });

  ipcMain.handle('agent:remove', async (_event, args: { agentId: string }) => {
    return { success: getAgentManager().removeAgent(args.agentId) };
  });

  /* ─── Swarm IPC (orchestrated multi-agent teams) ──────── */

  ipcMain.handle('swarm:start', async (_event, args: StartSwarmArgs) => {
    console.log('[Swarm] Start:', args.goal.slice(0, 100));
    const mgr = getAgentManager();

    try { await mgr.ensureDisplayServer(); } catch (err: any) {
      console.warn('[Swarm] Display server failed, GUI tools unavailable:', err.message);
    }

    try {
      const swarmId = mgr.startSwarm(args);
      return { swarmId };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('swarm:status', async (_event, args: { swarmId: string }) => {
    return getAgentManager().getSwarmStatus(args.swarmId);
  });

  ipcMain.handle('swarm:list', async () => {
    return getAgentManager().listSwarms();
  });

  ipcMain.handle('swarm:cancel', async (_event, args: { swarmId: string }) => {
    return { success: getAgentManager().cancelSwarm(args.swarmId) };
  });

  ipcMain.handle('swarm:tasks', async (_event, args: { swarmId: string }) => {
    return getAgentManager().getSwarmTasks(args.swarmId);
  });

  ipcMain.handle('swarm:remove', async (_event, args: { swarmId: string }) => {
    return { success: getAgentManager().removeSwarm(args.swarmId) };
  });
}

/* ─── App Lifecycle ──────────────────────────────────────── */

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  displayManager.stop().catch(() => {});
});
