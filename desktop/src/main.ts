/* ═══════════════════════════════════════════════════════════
   OperonAI Desktop — Electron Main Process

   Runs the Claude Agent SDK locally on the user's machine
   with Computer Use capability for native app control.

   Architecture:
   ┌─────────────────────────────────────────────┐
   │  Electron Main Process                      │
   │  ├── Claude Agent SDK (agentic loop)        │
   │  ├── Computer Use (screenshot + input)      │
   │  ├── MCP Tools (Gmail, Slack, etc.)         │
   │  └── IPC Bridge → Renderer                  │
   ├─────────────────────────────────────────────┤
   │  Renderer (BrowserWindow)                   │
   │  └── OperonAI Web UI (loaded from server)   │
   └─────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════ */

import electron from 'electron';
const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = electron;
import { ComputerUseAgent } from './computerUseAgent.js';
import { AgentOrchestrator } from './agentOrchestrator.js';
import { SandboxedAgent, detectTaskMode } from './sandboxedAgent.js';
import { InputMutex } from './inputMutex.js';
import { VirtualDisplayManager } from './virtualDisplayManager.js';
import { VirtualDisplayAgent } from './virtualDisplayAgent.js';
import { AgentPool } from './agentPool.js';
import { AgentManager } from './agentManager.js';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(import.meta.dirname, '../../server/.env') });

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let computerAgent: ComputerUseAgent | null = null;
let orchestrator: AgentOrchestrator | null = null;
let sandboxedAgent: SandboxedAgent | null = null;
const sharedMutex = new InputMutex();

const displayManager = new VirtualDisplayManager();
let vdAgent: VirtualDisplayAgent | null = null;
let agentPool: AgentPool | null = null;
let agentManager: AgentManager | null = null;

const WEB_UI_URL = process.env.OPERON_UI_URL || 'http://localhost:5177';
const SERVER_URL = process.env.OPERON_SERVER_URL || 'http://localhost:3001';

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

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Desktop] Failed to load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ─── IPC Handlers ───────────────────────────────────────── */

function setupIPC() {
  ipcMain.handle('computer-use:start', async (_event, args: {
    goal: string;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    allowedApps?: string[];
  }) => {
    console.log('[Desktop] Computer Use start:', args.goal);
    console.log('[Desktop] ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);

    // Route through virtual display agent — each task gets its own
    // invisible display, never touching the user's screen or cursor
    console.log('[Desktop] Routing to virtual display agent (multi-app capable)');

    if (!displayManager.isRunning) {
      await displayManager.start();
    }
    if (!vdAgent) {
      vdAgent = new VirtualDisplayAgent(displayManager);
    }

    const executionId = `desktop-${Date.now()}`;

    vdAgent.execute({
      executionId,
      goal: args.goal,
      apps: args.allowedApps,
      maxTurns: args.maxTurns || 40,
      onStep: (step) => {
        console.log(`[Desktop:vd] ${step.type}:`, step.content?.slice(0, 120));
        mainWindow?.webContents.send('computer-use:step', { executionId, step });
      },
      onScreenshot: (screenshot) => {
        mainWindow?.webContents.send('computer-use:screenshot', { executionId, screenshot });
      },
      onComplete: (result) => {
        console.log('[Desktop:vd] Complete:', result.slice(0, 200));
        mainWindow?.webContents.send('computer-use:complete', { executionId, result });
      },
      onError: (error) => {
        console.error('[Desktop:vd] Error:', error.message);
        mainWindow?.webContents.send('computer-use:error', { executionId, error: error.message });
      },
    });

    return { executionId, mode: 'virtual-display' };
  });

  ipcMain.handle('computer-use:approve', async (_event, args: { executionId: string; approved: boolean }) => {
    computerAgent?.resolveApproval(args.executionId, args.approved);
    if (args.approved && mainWindow) {
      mainWindow.minimize();
    }
    return { success: true };
  });

  ipcMain.handle('computer-use:cancel', async (_event, args: { executionId: string }) => {
    computerAgent?.cancel(args.executionId);
    return { success: true };
  });

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

  /* ─── Multi-Agent IPC Handlers ──────────────────────────── */

  function getOrchestrator(): AgentOrchestrator {
    if (!orchestrator) {
      orchestrator = new AgentOrchestrator(SERVER_URL, {
        onStep: (executionId, step) => {
          mainWindow?.webContents.send('multi-agent:step', { executionId, step });
        },
        onScreenshot: (executionId, screenshot) => {
          mainWindow?.webContents.send('multi-agent:screenshot', { executionId, screenshot });
        },
        onComplete: (executionId, result) => {
          mainWindow?.webContents.send('multi-agent:complete', { executionId, result });
        },
        onError: (executionId, error) => {
          mainWindow?.webContents.send('multi-agent:error', { executionId, error });
        },
        onApprovalRequired: (executionId, action) => {
          mainWindow?.restore();
          mainWindow?.focus();
          mainWindow?.webContents.send('multi-agent:approval', { executionId, action });
        },
        onStatusChange: (executionId, status) => {
          mainWindow?.webContents.send('multi-agent:status', { executionId, status });
        },
      });
    }
    return orchestrator;
  }

  ipcMain.handle('multi-agent:start', async (_event, args: {
    goal: string;
    targetApp: string;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
  }) => {
    console.log('[Desktop] Multi-Agent start:', args.targetApp, '→', args.goal);
    const orch = getOrchestrator();
    const executionId = orch.startAgent(args);
    return { executionId };
  });

  ipcMain.handle('multi-agent:list', async () => {
    return getOrchestrator().getStatus();
  });

  ipcMain.handle('multi-agent:cancel', async (_event, args: { executionId: string }) => {
    return { success: getOrchestrator().cancelAgent(args.executionId) };
  });

  ipcMain.handle('multi-agent:cancel-all', async () => {
    const count = getOrchestrator().cancelAll();
    return { cancelled: count };
  });

  ipcMain.handle('multi-agent:approve', async (_event, args: { executionId: string; approved: boolean }) => {
    const success = getOrchestrator().approveAgent(args.executionId, args.approved);
    if (args.approved && mainWindow) {
      mainWindow.minimize();
    }
    return { success };
  });

  /* ─── Sandboxed Agent IPC (no screen takeover) ──────────── */

  ipcMain.handle('sandboxed:start', async (_event, args: {
    goal: string;
    targetApp?: string;
    startUrl?: string;
    mode?: 'headless' | 'window' | 'auto';
  }) => {
    const mode = args.mode === 'auto' || !args.mode
      ? detectTaskMode(args.goal, args.targetApp)
      : args.mode;

    console.log(`[Sandboxed] Starting (${mode}):`, args.goal);

    if (!sandboxedAgent) {
      sandboxedAgent = new SandboxedAgent();
    }

    const executionId = `sandbox-${mode}-${Date.now()}`;

    sandboxedAgent.execute({
      executionId,
      goal: args.goal,
      mode,
      targetApp: args.targetApp,
      startUrl: args.startUrl,
      serverUrl: SERVER_URL,
      inputMutex: mode === 'window' ? sharedMutex : undefined,
      onStep: (step) => {
        console.log(`[Sandboxed:${mode}] ${step.type}:`, step.content?.slice(0, 120));
        mainWindow?.webContents.send('sandboxed:step', { executionId, step });
      },
      onScreenshot: (screenshot) => {
        mainWindow?.webContents.send('sandboxed:screenshot', { executionId, screenshot });
      },
      onComplete: (result, extractedData) => {
        console.log(`[Sandboxed:${mode}] Complete:`, result.slice(0, 200));
        mainWindow?.webContents.send('sandboxed:complete', { executionId, result, extractedData });
      },
      onError: (error) => {
        console.error(`[Sandboxed:${mode}] Error:`, error.message);
        mainWindow?.webContents.send('sandboxed:error', { executionId, error: error.message });
      },
    });

    return { executionId, mode };
  });

  ipcMain.handle('sandboxed:cancel', async (_event, args: { executionId: string }) => {
    sandboxedAgent?.cancel(args.executionId);
    return { success: true };
  });

  ipcMain.handle('sandboxed:detect-mode', async (_event, args: { goal: string; targetApp?: string }) => {
    return { mode: detectTaskMode(args.goal, args.targetApp) };
  });

  /* ─── Virtual Display Agent IPC (own display per agent) ── */

  ipcMain.handle('vd-agent:start', async (_event, args: {
    goal: string;
    apps?: string[];
    maxTurns?: number;
  }) => {
    const appsLabel = args.apps?.length ? ` [${args.apps.join(', ')}]` : ' [auto]';
    console.log(`[VD-Agent] Starting:${appsLabel}`, args.goal);

    if (!displayManager.isRunning) {
      await displayManager.start();
    }

    if (!vdAgent) {
      vdAgent = new VirtualDisplayAgent(displayManager);
    }

    const executionId = `vd-${Date.now()}`;

    vdAgent.execute({
      executionId,
      goal: args.goal,
      apps: args.apps,
      maxTurns: args.maxTurns || 40,
      onStep: (step) => {
        console.log(`[VD-Agent] ${step.type}:`, step.content?.slice(0, 120));
        mainWindow?.webContents.send('vd-agent:step', { executionId, step });
      },
      onScreenshot: (screenshot) => {
        mainWindow?.webContents.send('vd-agent:screenshot', { executionId, screenshot });
      },
      onComplete: (result) => {
        console.log('[VD-Agent] Complete:', result.slice(0, 200));
        mainWindow?.webContents.send('vd-agent:complete', { executionId, result });
      },
      onError: (error) => {
        console.error('[VD-Agent] Error:', error.message);
        mainWindow?.webContents.send('vd-agent:error', { executionId, error: error.message });
      },
    });

    return { executionId };
  });

  ipcMain.handle('vd-agent:cancel', async (_event, args: { executionId: string }) => {
    vdAgent?.cancel(args.executionId);
    return { success: true };
  });

  ipcMain.handle('vd-agent:list-displays', async () => {
    if (!displayManager.isRunning) return [];
    return displayManager.listDisplays();
  });

  /* ─── Agent Pool IPC (fully-isolated parallel agents) ─── */
  /* Each agent gets its own virtual display, its own window
     per app, its own clipboard. Multiple agents can use the
     same app without any conflicts. */

  function getAgentPool(): AgentPool {
    if (!agentPool) {
      agentPool = new AgentPool(displayManager, {
        onStep: (executionId, step) => {
          mainWindow?.webContents.send('agent-pool:step', { executionId, step });
        },
        onScreenshot: (executionId, screenshot) => {
          mainWindow?.webContents.send('agent-pool:screenshot', { executionId, screenshot });
        },
        onComplete: (executionId, result) => {
          mainWindow?.webContents.send('agent-pool:complete', { executionId, result });
        },
        onError: (executionId, error) => {
          mainWindow?.webContents.send('agent-pool:error', { executionId, error });
        },
        onStatusChange: (executionId, status) => {
          mainWindow?.webContents.send('agent-pool:status', { executionId, status });
        },
      });
    }
    return agentPool;
  }

  ipcMain.handle('agent-pool:start', async (_event, args: {
    goal: string;
    apps?: string[];
    maxTurns?: number;
  }) => {
    console.log('[AgentPool] IPC start:', args.goal.slice(0, 80));
    const pool = getAgentPool();

    try { await pool.ensureDisplayServer(); } catch (err: any) {
      console.warn('[AgentPool] Display server failed to start, agents will use window-level isolation:', err.message);
    }

    const executionId = pool.startAgent(args);
    return { executionId };
  });

  ipcMain.handle('agent-pool:list', async () => {
    return getAgentPool().getStatus();
  });

  ipcMain.handle('agent-pool:status', async (_event, args: { executionId: string }) => {
    return getAgentPool().getAgentStatus(args.executionId);
  });

  ipcMain.handle('agent-pool:cancel', async (_event, args: { executionId: string }) => {
    return { success: getAgentPool().cancelAgent(args.executionId) };
  });

  ipcMain.handle('agent-pool:cancel-all', async () => {
    return { cancelled: getAgentPool().cancelAll() };
  });

  ipcMain.handle('agent-pool:active-count', async () => {
    return { count: getAgentPool().getActiveCount() };
  });

  /* ─── Claude Agent SDK IPC (hybrid code+GUI agents) ────── */
  /* Each agent gets Claude Code's full capabilities (file
     editing, shell, search, git) PLUS its own virtual display
     for GUI app control. Powered by @anthropic-ai/claude-agent-sdk. */

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
      });
    }
    return agentManager;
  }

  ipcMain.handle('agent:start', async (_event, args: {
    goal: string;
    maxTurns?: number;
    workingDirectory?: string;
    enableGui?: boolean;
    systemPrompt?: string;
  }) => {
    console.log('[Agent] Start:', args.goal.slice(0, 100));
    const mgr = getAgentManager();

    try { await mgr.ensureDisplayServer(); } catch (err: any) {
      console.warn('[Agent] Display server failed, GUI tools unavailable:', err.message);
    }

    const agentId = mgr.startAgent(args);
    return { agentId };
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

  ipcMain.handle('agent:remove', async (_event, args: { agentId: string }) => {
    return { success: getAgentManager().removeAgent(args.agentId) };
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
