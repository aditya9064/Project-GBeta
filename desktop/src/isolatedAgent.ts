/* @deprecated — Use ClaudeAgent (claudeAgent.ts) + AgentManager (agentManager.ts) instead.
   The Claude Agent SDK provides the agent loop, built-in tools (file editing,
   shell, search, git), and custom display tools via MCP — replacing this
   entire file with ~150 lines of code.

   ═══════════════════════════════════════════════════════════
   Isolated Agent — True per-agent isolation with its own
   screen, keyboard, mouse, and clipboard.

   Each agent gets:
   1. Its own virtual display (invisible macOS monitor)
   2. Its own window for each app (even if another agent
      uses the same app — each gets a separate window)
   3. Window-targeted input: keyboard via AXRaise + AppleScript,
      mouse via CGEvent at virtual display coordinates
   4. Per-agent clipboard (named NSPasteboard)

   Two agents can both use Figma simultaneously — each has
   its own Figma window on its own virtual display.
   ═══════════════════════════════════════════════════════════ */

import { VirtualDisplayManager, type VirtualDisplay } from './virtualDisplayManager.js';
import {
  appKeystroke,
  appKeyCombo,
  appSpecialKey,
} from './inputMutex.js';
import {
  buildExpertiseSystemPrompt,
  getAppExpertise,
  findExpertiseFromGoal,
  generateWorkflowPlan,
  planToPromptContext,
  type AppExpertiseProfile,
} from './appExpertise.js';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/* When the Swift server is running, we route all native operations
   through it (zero subprocess overhead). When it's not, we fall
   back to Python/osascript subprocesses. This flag is checked
   once per method call. */

/* ─── Types ──────────────────────────────────────────────── */

export interface IsolatedAgentCallbacks {
  executionId: string;
  goal: string;
  apps?: string[];
  maxTurns?: number;
  onStep: (step: IsolatedStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
}

export interface IsolatedStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'status';
  content?: string;
  screenshot?: string;
  timestamp: string;
}

interface OwnedWindow {
  appName: string;
  windowId: number;
  title: string;
}

interface AgentEnvironment {
  display: VirtualDisplay | null;
  windows: Map<string, OwnedWindow>;
  activeApp: string | null;
  clipboardName: string;
}

const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 900;

/* ═══════════════════════════════════════════════════════════
   IsolatedAgent
   ═══════════════════════════════════════════════════════════ */

export class IsolatedAgent {
  private displayManager: VirtualDisplayManager;
  private abortControllers = new Map<string, AbortController>();
  private environments = new Map<string, AgentEnvironment>();

  constructor(displayManager: VirtualDisplayManager) {
    this.displayManager = displayManager;
  }

  async execute(cb: IsolatedAgentCallbacks): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(cb.executionId, controller);

    const env: AgentEnvironment = {
      display: null,
      windows: new Map(),
      activeApp: null,
      clipboardName: `operon-agent-${cb.executionId}`,
    };
    this.environments.set(cb.executionId, env);

    try {
      cb.onStep({ type: 'status', content: 'Creating isolated environment...', timestamp: new Date().toISOString() });

      if (this.displayManager.isRunning) {
        env.display = await this.displayManager.createDisplay({
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          name: `Agent-${cb.executionId.slice(0, 12)}`,
        });
        cb.onStep({
          type: 'status',
          content: `Virtual display ready (${TARGET_WIDTH}×${TARGET_HEIGHT} at offset ${env.display.bounds.x})`,
          timestamp: new Date().toISOString(),
        });
      } else {
        cb.onStep({
          type: 'status',
          content: 'Virtual display server unavailable — using window-level isolation',
          timestamp: new Date().toISOString(),
        });
      }

      if (cb.apps && cb.apps.length > 0) {
        for (const appName of cb.apps) {
          await this.openAppWindow(appName, env, cb);
        }
      }

      await this.runAgentLoop(cb, env, controller);

    } catch (err: any) {
      if (!controller.signal.aborted) {
        cb.onError(err);
      }
    } finally {
      await this.cleanup(env);
      this.environments.delete(cb.executionId);
      this.abortControllers.delete(cb.executionId);
    }
  }

  /* ─── Open an app in a NEW window for this agent ────────── */

  private async openAppWindow(
    appName: string,
    env: AgentEnvironment,
    cb: IsolatedAgentCallbacks,
  ): Promise<OwnedWindow> {
    const key = appName.toLowerCase();
    const existing = env.windows.get(key);
    if (existing) return existing;

    cb.onStep({ type: 'status', content: `Opening ${appName} (new window)...`, timestamp: new Date().toISOString() });

    // Fast path: use the Swift server (single JSON-RPC call, handles
    // open + Cmd+N + window-diff + move-to-display internally)
    if (this.displayManager.isRunning) {
      try {
        const result = await this.displayManager.openAppWindow(
          appName,
          env.display?.displayId,
        );
        const owned: OwnedWindow = { appName, windowId: result.windowId, title: result.title };
        env.windows.set(key, owned);
        env.activeApp = appName;
        cb.onStep({ type: 'status', content: `${appName} ready (window ${result.windowId})`, timestamp: new Date().toISOString() });
        return owned;
      } catch {
        // Fall through to subprocess path
      }
    }

    // Slow fallback: Python/osascript subprocesses
    const windowsBefore = await this.getAppWindowIds(appName);

    try {
      await execAsync(`open -a "${appName}"`, { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
    } catch {
      throw new Error(`Could not open "${appName}"`);
    }

    try {
      await execAsync(
        `osascript -e 'tell application "System Events" to tell process "${appName}" to keystroke "n" using command down'`,
        { timeout: 5000 },
      );
      await new Promise(r => setTimeout(r, 800));
    } catch { /* some apps don't support Cmd+N */ }

    const windowsAfter = await this.getAppWindowIds(appName);

    const beforeSet = new Set(windowsBefore.map(w => w.id));
    let newWindow: { id: number; title: string } | undefined;
    for (const w of windowsAfter) {
      if (!beforeSet.has(w.id)) { newWindow = w; break; }
    }
    if (!newWindow && windowsAfter.length > 0) {
      newWindow = windowsAfter[0];
    }
    if (!newWindow) throw new Error(`No window found for "${appName}"`);

    if (env.display) {
      const b = env.display.bounds;
      await this.moveWindow(newWindow.id, appName, b.x, b.y, b.width, b.height);
    }

    const owned: OwnedWindow = { appName, windowId: newWindow.id, title: newWindow.title };
    env.windows.set(key, owned);
    env.activeApp = appName;

    cb.onStep({ type: 'status', content: `${appName} ready (window ${newWindow.id})`, timestamp: new Date().toISOString() });
    return owned;
  }

  /* ─── Window queries ──────────────────────────────────── */

  private async getAppWindowIds(appName: string): Promise<Array<{ id: number; title: string }>> {
    if (this.displayManager.isRunning) {
      try {
        const windows = await this.displayManager.listAppWindows(appName);
        return windows.map(w => ({ id: w.windowId, title: w.title }));
      } catch { /* fall through */ }
    }
    try {
      const { stdout } = await execAsync(
        `python3 -c "
import Quartz, json
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll | Quartz.kCGWindowListExcludeDesktopElements, Quartz.kCGNullWindowID)
out = []
for w in wl:
    o = w.get('kCGWindowOwnerName','')
    if '${appName}'.lower() in o.lower() and w.get('kCGWindowLayer',99)==0 and w.get('kCGWindowNumber',0)>0:
        out.append({'id':int(w['kCGWindowNumber']),'title':str(w.get('kCGWindowName',''))})
print(json.dumps(out))"`,
        { timeout: 5000 },
      );
      return JSON.parse(stdout.trim());
    } catch {
      return [];
    }
  }

  private async getWindowBounds(windowId: number): Promise<{ x: number; y: number; w: number; h: number } | null> {
    if (this.displayManager.isRunning) {
      try {
        const windows = await this.displayManager.listAppWindows('');
        const w = windows.find(win => win.windowId === windowId);
        if (w) return { x: w.bounds.x, y: w.bounds.y, w: w.bounds.width, h: w.bounds.height };
      } catch { /* fall through */ }
    }
    try {
      const { stdout } = await execAsync(
        `python3 -c "
import Quartz, json
for w in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll, Quartz.kCGNullWindowID):
    if w.get('kCGWindowNumber',0)==${windowId}:
        b=w.get('kCGWindowBounds',{})
        print(json.dumps({'x':int(b.get('X',0)),'y':int(b.get('Y',0)),'w':int(b.get('Width',0)),'h':int(b.get('Height',0))}))
        break"`,
        { timeout: 5000 },
      );
      return JSON.parse(stdout.trim());
    } catch {
      return null;
    }
  }

  /* ─── Move a window by its CGWindowID ──────────────────── */

  private async moveWindow(
    windowId: number, appName: string,
    x: number, y: number, width: number, height: number,
  ): Promise<void> {
    if (this.displayManager.isRunning) {
      try {
        await this.displayManager.moveWindowById(windowId, x, y, width, height);
        return;
      } catch { /* fall through */ }
    }
    try {
      await execAsync(
        `python3 -c "
import Quartz
from ApplicationServices import *
import AppKit
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll, Quartz.kCGNullWindowID)
pid = None
for w in wl:
    if w.get('kCGWindowNumber',0)==${windowId}:
        pid = w.get('kCGWindowOwnerPID',0); break
if not pid: exit(1)
app = AXUIElementCreateApplication(pid)
err, wins = AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, None)
if err or not wins: exit(1)
for ax in wins:
    p = AppKit.NSValue.valueWithPoint_(AppKit.NSPoint(${x},${y}))
    s = AppKit.NSValue.valueWithSize_(AppKit.NSSize(${width},${height}))
    AXUIElementSetAttributeValue(ax, kAXPositionAttribute, p)
    AXUIElementSetAttributeValue(ax, kAXSizeAttribute, s)
    break"`,
        { timeout: 8000 },
      );
    } catch {
      try {
        await execAsync(
          `osascript -e 'tell application "System Events" to tell process "${appName}" to set position of window 1 to {${x},${y}}' -e 'tell application "System Events" to tell process "${appName}" to set size of window 1 to {${width},${height}}'`,
          { timeout: 5000 },
        );
      } catch { /* best effort */ }
    }
  }

  /* ─── Raise a specific window within its app (AXRaise) ── */

  private async raiseWindow(windowId: number, appName: string): Promise<void> {
    if (this.displayManager.isRunning) {
      try { await this.displayManager.raiseWindow(windowId); return; }
      catch { /* fall through */ }
    }
    try {
      await execAsync(
        `python3 -c "
import Quartz
from ApplicationServices import *
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll, Quartz.kCGNullWindowID)
pid = None
for w in wl:
    if w.get('kCGWindowNumber',0)==${windowId}:
        pid = w.get('kCGWindowOwnerPID',0); break
if not pid: exit(1)
app = AXUIElementCreateApplication(pid)
err, wins = AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, None)
if err or not wins: exit(1)
AXUIElementPerformAction(wins[0], kAXRaiseAction)"`,
        { timeout: 5000 },
      );
    } catch {
      try {
        await execAsync(
          `osascript -e 'tell application "System Events" to tell process "${appName}" to perform action "AXRaise" of window 1'`,
          { timeout: 5000 },
        );
      } catch { /* best effort */ }
    }
  }

  /* ─── Screenshot: capture this agent's view ────────────── */

  private async captureAgentView(env: AgentEnvironment): Promise<string> {
    if (env.display && this.displayManager.isRunning) {
      try {
        const cap = await this.displayManager.captureDisplay(env.display.displayId, 0.5);
        return cap.base64;
      } catch { /* fall through */ }
    }

    const active = env.activeApp ? env.windows.get(env.activeApp.toLowerCase()) : null;
    if (active) return this.captureWindowById(active.windowId);

    for (const [, w] of env.windows) return this.captureWindowById(w.windowId);

    throw new Error('No window to capture');
  }

  private async captureWindowById(windowId: number): Promise<string> {
    // Fast path: Swift server captures and encodes in-process
    if (this.displayManager.isRunning) {
      try {
        const cap = await this.displayManager.captureWindow(windowId, 0.5);
        return cap.base64;
      } catch { /* fall through */ }
    }

    // Slow fallback: 3 subprocess calls (screencapture + sips + base64)
    const tmp = `/tmp/operon-iso-${windowId}-${Date.now()}.jpg`;
    try {
      await execAsync(`screencapture -l ${windowId} -x -t jpg "${tmp}"`, { timeout: 10000 });

      const { stdout: sizeOut } = await execAsync(
        `sips -g pixelWidth "${tmp}" 2>/dev/null | grep pixelWidth`,
        { timeout: 5000 },
      );
      const origW = parseInt(sizeOut.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10) || TARGET_WIDTH;
      if (origW > TARGET_WIDTH) {
        await execAsync(`sips --resampleWidth ${TARGET_WIDTH} "${tmp}" >/dev/null 2>&1`, { timeout: 5000 });
      }

      const { stdout: b64 } = await execAsync(`base64 -i "${tmp}"`, { timeout: 10000, maxBuffer: 10 * 1024 * 1024 });
      return b64.replace(/\s/g, '');
    } finally {
      execAsync(`rm -f "${tmp}"`).catch(() => {});
    }
  }

  /* ─── Input: all keyboard goes through the agent's raised window ─ */

  private async sendKeystroke(env: AgentEnvironment, text: string): Promise<void> {
    if (!env.activeApp) throw new Error('No active app');
    const w = env.windows.get(env.activeApp.toLowerCase());
    if (w) { await this.raiseWindow(w.windowId, env.activeApp); }
    if (this.displayManager.isRunning) {
      await this.displayManager.typeToProcess(env.activeApp, text);
    } else {
      await appKeystroke(env.activeApp, text);
    }
  }

  private async sendKeyCombo(env: AgentEnvironment, key: string, modifiers: string[]): Promise<void> {
    if (!env.activeApp) throw new Error('No active app');
    const w = env.windows.get(env.activeApp.toLowerCase());
    if (w) { await this.raiseWindow(w.windowId, env.activeApp); }
    if (this.displayManager.isRunning) {
      await this.displayManager.keyToProcess(env.activeApp, key, modifiers);
    } else {
      await appKeyCombo(env.activeApp, key, modifiers);
    }
  }

  private async sendSpecialKey(env: AgentEnvironment, keyName: string): Promise<void> {
    if (!env.activeApp) throw new Error('No active app');
    const w = env.windows.get(env.activeApp.toLowerCase());
    if (w) { await this.raiseWindow(w.windowId, env.activeApp); }
    if (this.displayManager.isRunning) {
      await this.displayManager.keyToProcess(env.activeApp, keyName);
    } else {
      await appSpecialKey(env.activeApp, keyName);
    }
  }

  /* ─── Input: mouse clicks at virtual display coordinates ── */

  private async sendClick(
    env: AgentEnvironment,
    x: number, y: number,
    opts?: { count?: number; button?: 'left' | 'right' },
  ): Promise<void> {
    let screenX = x;
    let screenY = y;

    if (env.display) {
      screenX = env.display.bounds.x + x;
      screenY = env.display.bounds.y + y;
    } else {
      const active = env.activeApp ? env.windows.get(env.activeApp.toLowerCase()) : null;
      if (active) {
        const bounds = await this.getWindowBounds(active.windowId);
        if (bounds) { screenX = bounds.x + x; screenY = bounds.y + y; }
      }
    }

    // Both paths use the Swift server when available (fast path covers
    // non-virtual-display scenarios too)
    if (this.displayManager.isRunning) {
      await this.displayManager.click(screenX, screenY, opts);
    } else {
      const count = opts?.count ?? 1;
      const isRight = opts?.button === 'right';
      await execAsync(
        `python3 -c "
import Quartz, time
pt = Quartz.CGPointMake(${screenX},${screenY})
dt = ${isRight ? 'Quartz.kCGEventRightMouseDown' : 'Quartz.kCGEventLeftMouseDown'}
ut = ${isRight ? 'Quartz.kCGEventRightMouseUp' : 'Quartz.kCGEventLeftMouseUp'}
btn = ${isRight ? 'Quartz.kCGMouseButtonRight' : 'Quartz.kCGMouseButtonLeft'}
for i in range(${count}):
    d = Quartz.CGEventCreateMouseEvent(None,dt,pt,btn)
    u = Quartz.CGEventCreateMouseEvent(None,ut,pt,btn)
    Quartz.CGEventSetIntegerValueField(d,Quartz.kCGMouseEventClickState,i+1)
    Quartz.CGEventSetIntegerValueField(u,Quartz.kCGMouseEventClickState,i+1)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap,d)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap,u)
    if i<${count - 1}: time.sleep(0.05)"`,
        { timeout: 5000 },
      );
    }
  }

  /* ─── Clipboard: per-agent named pasteboard ────────────── */

  async clipboardWrite(env: AgentEnvironment, text: string): Promise<void> {
    if (this.displayManager.isRunning) {
      await this.displayManager.clipboardWrite(env.clipboardName, text);
      return;
    }
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    await execAsync(
      `python3 -c "
import AppKit
pb=AppKit.NSPasteboard.pasteboardWithName_('${env.clipboardName}')
pb.clearContents()
pb.setString_forType_('${escaped}',AppKit.NSPasteboardTypeString)"`,
      { timeout: 5000 },
    );
  }

  async clipboardRead(env: AgentEnvironment): Promise<string> {
    if (this.displayManager.isRunning) {
      return this.displayManager.clipboardRead(env.clipboardName);
    }
    try {
      const { stdout } = await execAsync(
        `python3 -c "
import AppKit
pb=AppKit.NSPasteboard.pasteboardWithName_('${env.clipboardName}')
print(pb.stringForType_(AppKit.NSPasteboardTypeString) or '')"`,
        { timeout: 5000 },
      );
      return stdout.trim();
    } catch {
      return '';
    }
  }

  /* ─── The agentic loop ─────────────────────────────────── */

  private async runAgentLoop(
    cb: IsolatedAgentCallbacks,
    env: AgentEnvironment,
    controller: AbortController,
  ): Promise<void> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();

    const maxTurns = cb.maxTurns || 40;
    const messages: any[] = [{ role: 'user', content: cb.goal }];

    const appsContext = env.windows.size > 0
      ? `Apps already open on YOUR display: ${[...env.windows.values()].map(w => w.appName).join(', ')}.`
      : 'No apps are open yet. Use the app_manager tool to open any apps you need.';

    let primaryExpertise: AppExpertiseProfile | null = null;
    for (const [, w] of env.windows) {
      primaryExpertise = getAppExpertise(w.appName);
      if (primaryExpertise) break;
    }
    if (!primaryExpertise) primaryExpertise = findExpertiseFromGoal(cb.goal);

    const basePrompt = `You are an expert macOS automation agent with your own FULLY ISOLATED environment.
You have your own virtual display, keyboard, mouse, and clipboard. Other agents may be running
simultaneously — they CANNOT see or affect your environment, and you cannot affect theirs.
The user CANNOT see your display. You have full, unrestricted control.

${appsContext}

MULTI-APP SUPPORT: Open additional apps using the app_manager tool. Each app gets its own
dedicated window on YOUR display. Even if another agent is using the same app, your window
is completely separate.

ISOLATION GUARANTEES:
- Your virtual display: ${TARGET_WIDTH}×${TARGET_HEIGHT}, only you can see/interact with it
- Your keyboard input goes ONLY to your windows (via AXRaise + targeted AppleScript)
- Your mouse clicks happen ONLY at your display coordinates (via CGEvent)
- Your clipboard is private (named pasteboard: ${env.clipboardName})
- Other agents using the SAME app have SEPARATE windows on SEPARATE displays

WORKFLOW:
1. Think about which apps and steps are needed.
2. Open apps using app_manager (each gets a new window on your display).
3. Work through the task using the computer tool.
4. Switch between apps using app_manager.
5. When done, clearly state what you accomplished.

RULES:
1. Prefer keyboard shortcuts over mouse clicks for speed.
2. Coordinates are relative to YOUR ${TARGET_WIDTH}×${TARGET_HEIGHT} display (0,0 = top-left).
3. Be efficient — don't repeat failed actions more than twice.
4. Do NOT use Cmd+Tab or Spotlight — use app_manager to switch apps.
5. When done, state results clearly.

ENVIRONMENT: macOS, ${TARGET_WIDTH}×${TARGET_HEIGHT} isolated display.`;

    const systemPrompt = primaryExpertise
      ? buildExpertiseSystemPrompt(primaryExpertise.appName, basePrompt, cb.goal)
      : `${basePrompt}\nGOAL: ${cb.goal}`;

    let finalSystemPrompt = systemPrompt;

    if (primaryExpertise) {
      cb.onStep({ type: 'thinking', content: `Planning ${primaryExpertise.role} workflow...`, timestamp: new Date().toISOString() });
      try {
        const plan = await generateWorkflowPlan(
          primaryExpertise.appName,
          cb.goal,
          async (msgs) => {
            const res = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: msgs });
            return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
          },
        );
        if (plan && plan.steps.length > 0) {
          finalSystemPrompt = `${systemPrompt}\n${planToPromptContext(plan)}`;
          cb.onStep({ type: 'thinking', content: `Plan: ${plan.steps.length} steps, tools: ${plan.requiredTools.join(', ')}`, timestamp: new Date().toISOString() });
        }
      } catch { /* proceed without plan */ }
    }

    const tools: any[] = [
      {
        type: 'computer_20250124',
        name: 'computer',
        display_width_px: TARGET_WIDTH,
        display_height_px: TARGET_HEIGHT,
        display_number: 0,
        cache_control: { type: 'ephemeral' },
      },
      {
        name: 'app_manager',
        description: `Manage apps on your isolated display. Each app opens in its own dedicated window.
- "open": Open an app in a NEW window on your display. Provide "app_name".
- "switch": Bring an already-open app's window to the front. Provide "app_name".
- "list": List all apps currently on your display.
- "close": Close your window for an app. Provide "app_name".`,
        input_schema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['open', 'switch', 'list', 'close'] },
            app_name: { type: 'string', description: 'App name (e.g., "Safari", "Notes", "Figma")' },
          },
          required: ['action'],
        },
      },
    ];

    let turn = 0;

    while (turn < maxTurns && !controller.signal.aborted) {
      turn++;
      cb.onStep({ type: 'thinking', content: `Turn ${turn}/${maxTurns}`, timestamp: new Date().toISOString() });

      pruneOldScreenshots(messages);

      const response = await anthropic.beta.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [{ type: 'text', text: finalSystemPrompt, cache_control: { type: 'ephemeral' } } as any],
        tools,
        messages,
        betas: ['computer-use-2025-01-24', 'prompt-caching-2024-07-31'],
      } as any);

      const content = response.content;
      messages.push({ role: 'assistant', content });

      let hasToolUse = false;
      const toolResults: any[] = [];

      for (const block of content) {
        if (controller.signal.aborted) break;

        if (block.type === 'text' && block.text) {
          cb.onStep({ type: 'thinking', content: block.text, timestamp: new Date().toISOString() });
        }

        if (block.type === 'tool_use') {
          hasToolUse = true;

          if (block.name === 'app_manager') {
            const result = await this.handleAppManager(block.input as any, env, cb);
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          } else {
            try {
              await this.executeComputerAction(block.input as any, env, cb);
              // Swift server ops are synchronous; only need brief
              // settle time for UI rendering, not process startup
              await sleep(this.displayManager.isRunning ? 50 : 150);
              const screenshot = await this.captureAgentView(env);
              cb.onScreenshot(`data:image/jpeg;base64,${screenshot}`);
              toolResults.push({
                type: 'tool_result', tool_use_id: block.id,
                content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshot } }],
              });
            } catch (err: any) {
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Action failed: ${err.message}`, is_error: true });
            }
          }
        }
      }

      if (!hasToolUse) {
        const finalText = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
        cb.onComplete(finalText || 'Task completed.');
        return;
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    }

    if (turn >= maxTurns) {
      cb.onComplete(`Reached max turns (${maxTurns}). Task may be partially complete.`);
    }
  }

  /* ─── App Manager tool handler ──────────────────────────── */

  private async handleAppManager(
    input: { action: string; app_name?: string },
    env: AgentEnvironment,
    cb: IsolatedAgentCallbacks,
  ): Promise<string> {
    switch (input.action) {
      case 'open': {
        if (!input.app_name) return 'Error: app_name is required';
        try {
          const w = await this.openAppWindow(input.app_name, env, cb);
          return `Opened "${input.app_name}" in a new window (ID: ${w.windowId}) on your display. It is now active.`;
        } catch (err: any) {
          return `Failed to open "${input.app_name}": ${err.message}`;
        }
      }

      case 'switch': {
        if (!input.app_name) return 'Error: app_name is required';
        const w = env.windows.get(input.app_name.toLowerCase());
        if (!w) return `"${input.app_name}" is not open. Use "open" first.`;
        await this.raiseWindow(w.windowId, input.app_name);
        env.activeApp = input.app_name;
        cb.onStep({ type: 'action', content: `Switched to ${input.app_name}`, timestamp: new Date().toISOString() });
        return `Switched to "${input.app_name}" (window ${w.windowId}).`;
      }

      case 'list': {
        const apps = [...env.windows.values()];
        if (apps.length === 0) return 'No apps open on your display.';
        return apps
          .map(w => w.appName === env.activeApp ? `• ${w.appName} [active] (window ${w.windowId})` : `• ${w.appName} (window ${w.windowId})`)
          .join('\n');
      }

      case 'close': {
        if (!input.app_name) return 'Error: app_name is required';
        const w = env.windows.get(input.app_name.toLowerCase());
        if (!w) return `"${input.app_name}" is not open on your display.`;

        // Cmd+W to close the window (works in most apps)
        if (this.displayManager.isRunning) {
          try {
            await this.displayManager.raiseWindow(w.windowId);
            await this.displayManager.keyToProcess(input.app_name, 'w', ['command']);
          } catch { /* best effort */ }
        } else {
          try {
            await execAsync(
              `python3 -c "
import Quartz
from ApplicationServices import *
wl=Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll,Quartz.kCGNullWindowID)
pid=None
for w in wl:
    if w.get('kCGWindowNumber',0)==${w.windowId}: pid=w.get('kCGWindowOwnerPID',0); break
if pid:
    app=AXUIElementCreateApplication(pid)
    e,wins=AXUIElementCopyAttributeValue(app,kAXWindowsAttribute,None)
    if not e and wins:
        e2,btn=AXUIElementCopyAttributeValue(wins[0],kAXCloseButtonAttribute,None)
        if not e2 and btn: AXUIElementPerformAction(btn,kAXPressAction)"`,
              { timeout: 5000 },
            );
          } catch {
            try {
              await execAsync(
                `osascript -e 'tell application "System Events" to tell process "${input.app_name}" to click button 1 of window 1'`,
                { timeout: 5000 },
              );
            } catch { /* best effort */ }
          }
        }

        env.windows.delete(input.app_name.toLowerCase());
        if (env.activeApp?.toLowerCase() === input.app_name.toLowerCase()) {
          const remaining = [...env.windows.values()];
          env.activeApp = remaining.length > 0 ? remaining[remaining.length - 1].appName : null;
        }
        return `Closed "${input.app_name}" window.`;
      }

      default:
        return `Unknown action: "${input.action}". Use "open", "switch", "list", or "close".`;
    }
  }

  /* ─── Execute a computer_use action ─────────────────────── */

  private async executeComputerAction(
    action: any,
    env: AgentEnvironment,
    cb: IsolatedAgentCallbacks,
  ): Promise<void> {
    switch (action.action) {
      case 'screenshot':
      case 'cursor_position':
        break;

      case 'type': {
        if (!action.text) break;
        cb.onStep({ type: 'action', content: `Type: "${action.text.slice(0, 50)}"`, timestamp: new Date().toISOString() });
        await this.sendKeystroke(env, action.text);
        break;
      }

      case 'key': {
        if (!action.text) break;
        const keyLower = action.text.toLowerCase().replace(/\s/g, '');
        const blocked = ['super+space', 'cmd+space', 'command+space', 'super+tab', 'cmd+tab', 'command+tab'];
        if (blocked.some(b => keyLower === b.replace(/\s/g, ''))) {
          throw new Error(`Blocked: ${action.text} — use app_manager to switch apps`);
        }

        cb.onStep({ type: 'action', content: `Key: ${action.text}`, timestamp: new Date().toISOString() });
        const parts = action.text.split('+').map((k: string) => k.trim());
        if (parts.length === 1) {
          await this.sendSpecialKey(env, parts[0]);
        } else {
          const mods: string[] = [];
          let mainKey = '';
          for (const p of parts) {
            const l = p.toLowerCase();
            if (['cmd', 'command', 'super', 'meta'].includes(l)) mods.push('command');
            else if (['ctrl', 'control'].includes(l)) mods.push('control');
            else if (['alt', 'option'].includes(l)) mods.push('option');
            else if (l === 'shift') mods.push('shift');
            else mainKey = p;
          }
          if (mainKey) await this.sendKeyCombo(env, mainKey, mods);
        }
        break;
      }

      case 'left_click': {
        if (!action.coordinate) break;
        cb.onStep({ type: 'action', content: `Click at (${action.coordinate.join(', ')})`, timestamp: new Date().toISOString() });
        await this.sendClick(env, action.coordinate[0], action.coordinate[1]);
        break;
      }

      case 'right_click': {
        if (!action.coordinate) break;
        cb.onStep({ type: 'action', content: `Right-click at (${action.coordinate.join(', ')})`, timestamp: new Date().toISOString() });
        await this.sendClick(env, action.coordinate[0], action.coordinate[1], { button: 'right' });
        break;
      }

      case 'double_click': {
        if (!action.coordinate) break;
        cb.onStep({ type: 'action', content: `Double-click at (${action.coordinate.join(', ')})`, timestamp: new Date().toISOString() });
        await this.sendClick(env, action.coordinate[0], action.coordinate[1], { count: 2 });
        break;
      }

      case 'triple_click':
      case 'middle_click': {
        if (!action.coordinate) break;
        const count = action.action === 'triple_click' ? 3 : 1;
        cb.onStep({ type: 'action', content: `${action.action} at (${action.coordinate.join(', ')})`, timestamp: new Date().toISOString() });
        await this.sendClick(env, action.coordinate[0], action.coordinate[1], { count });
        break;
      }

      case 'mouse_move':
        break;

      case 'left_click_drag': {
        if (!action.start_coordinate || !action.coordinate) break;
        cb.onStep({ type: 'action', content: `Drag (${action.start_coordinate.join(',')}) → (${action.coordinate.join(',')})`, timestamp: new Date().toISOString() });
        if (env.display && this.displayManager.isRunning) {
          const b = env.display.bounds;
          await this.displayManager.drag(
            b.x + action.start_coordinate[0], b.y + action.start_coordinate[1],
            b.x + action.coordinate[0], b.y + action.coordinate[1],
          );
        }
        break;
      }

      case 'scroll': {
        const dir = action.scroll_direction || 'down';
        const amount = action.scroll_amount || 3;
        cb.onStep({ type: 'action', content: `Scroll ${dir} ×${amount}`, timestamp: new Date().toISOString() });

        if (env.display && this.displayManager.isRunning) {
          const cx = action.coordinate
            ? env.display.bounds.x + action.coordinate[0]
            : env.display.bounds.x + TARGET_WIDTH / 2;
          const cy = action.coordinate
            ? env.display.bounds.y + action.coordinate[1]
            : env.display.bounds.y + TARGET_HEIGHT / 2;
          const dy = dir === 'up' ? amount * 30 : dir === 'down' ? -amount * 30 : 0;
          const dx = dir === 'left' ? amount * 30 : dir === 'right' ? -amount * 30 : 0;
          await this.displayManager.scroll(cx, cy, dy, dx);
        } else if (env.activeApp) {
          const keyName = dir === 'up' ? 'up' : 'down';
          for (let i = 0; i < amount; i++) {
            if (this.displayManager.isRunning) {
              await this.displayManager.keyToProcess(env.activeApp, keyName);
            } else {
              const keyCode = dir === 'up' ? 126 : 125;
              await execAsync(`osascript -e 'tell application "System Events" to tell process "${env.activeApp}" to key code ${keyCode}'`);
            }
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  /* ─── Cleanup ──────────────────────────────────────────── */

  private async cleanup(env: AgentEnvironment): Promise<void> {
    if (env.display) {
      try { await this.displayManager.destroyDisplay(env.display.displayId); } catch {}
    }
    // Don't close app windows — the app may be shared. macOS moves
    // orphaned windows (from destroyed displays) to the main display.
  }

  cancel(executionId: string): void {
    this.abortControllers.get(executionId)?.abort();
  }
}

/* ─── Helpers ───────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function pruneOldScreenshots(messages: any[], keep = 2): void {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue;
    count++;
    if (count <= keep) continue;
    for (let j = 0; j < msg.content.length; j++) {
      const item = msg.content[j];
      if (item.type === 'tool_result' && Array.isArray(item.content)) {
        if (item.content.some((c: any) => c.type === 'image')) {
          msg.content[j] = { type: 'tool_result', tool_use_id: item.tool_use_id, content: '[screenshot omitted]' };
        }
      }
    }
  }
}
