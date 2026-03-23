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
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(import.meta.dirname, '../../server/.env') });

let mainWindow: InstanceType<typeof BrowserWindow> | null = null;
let computerAgent: ComputerUseAgent | null = null;

const WEB_UI_URL = process.env.OPERON_UI_URL || 'http://localhost:5173';
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

    if (mainWindow) {
      mainWindow.minimize();
    }

    if (!computerAgent) {
      computerAgent = new ComputerUseAgent({
        serverUrl: SERVER_URL,
      });
    }

    const executionId = `desktop-${Date.now()}`;

    computerAgent.execute({
      executionId,
      goal: args.goal,
      model: args.model,
      maxTurns: args.maxTurns || 30,
      maxBudgetUsd: args.maxBudgetUsd || 2.00,
      allowedApps: args.allowedApps,
      onStep: (step) => {
        if (step.type === 'action') {
          console.log('[Desktop] Step: action —', step.content, step.action ? JSON.stringify(step.action) : '');
        } else {
          console.log('[Desktop] Step:', step.type, step.content?.substring(0, 120));
        }
        mainWindow?.webContents.send('computer-use:step', { executionId, step });
      },
      onScreenshot: (_screenshot) => {
        console.log('[Desktop] Screenshot captured');
        mainWindow?.webContents.send('computer-use:screenshot', { executionId, screenshot: _screenshot });
      },
      onComplete: (result) => {
        console.log('[Desktop] Complete:', result.substring(0, 200));
        mainWindow?.restore();
        mainWindow?.webContents.send('computer-use:complete', { executionId, result });
      },
      onError: (error) => {
        console.error('[Desktop] Error:', error.message);
        mainWindow?.restore();
        mainWindow?.webContents.send('computer-use:error', { executionId, error: error.message });
      },
      onApprovalRequired: (action) => {
        console.log('[Desktop] Approval required:', action.description);
        mainWindow?.restore();
        mainWindow?.focus();
        mainWindow?.webContents.send('computer-use:approval', { executionId, action });
      },
    });

    return { executionId };
  });

  ipcMain.handle('computer-use:approve', async (_event, args: { executionId: string; approved: boolean }) => {
    computerAgent?.resolveApproval(args.executionId, args.approved);
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
