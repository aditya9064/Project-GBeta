/* @deprecated — Use ClaudeAgent (claudeAgent.ts) instead.
   ClaudeAgent runs on its own virtual display (never touches the
   user's screen) and has built-in Bash tool for headless tasks.

   ═══════════════════════════════════════════════════════════
   Sandboxed Agent — Runs tasks WITHOUT taking over the user's screen

   The core problem: ComputerUseAgent uses the physical cursor
   (cliclick) and captures the full screen, preventing the user
   from doing their own work.

   Solution — two isolation modes:

   1. "headless" (web tasks) — Delegates to the server's
      VisionAgent + Puppeteer. The agent gets its own invisible
      browser instance. Zero interference with the user.

   2. "window" (native app tasks) — Uses per-window screenshots
      via `screencapture -l <windowID>` (no focus steal) and
      AppleScript for input (no physical cursor movement).
      Brief mutex-locked focus switch only for mouse clicks
      that can't be done via Accessibility API.

   The user keeps full control of their screen, cursor, and
   keyboard the entire time.
   ═══════════════════════════════════════════════════════════ */

import { promisify } from 'util';
import { exec } from 'child_process';
import electron from 'electron';
const { desktopCapturer } = electron;
import {
  InputMutex,
  appKeystroke,
  appKeyCombo,
  appSpecialKey,
  activateApp,
} from './inputMutex.js';

import {
  buildExpertiseSystemPrompt,
  getAppExpertise,
  getCaptureSettings,
  generateWorkflowPlan,
  planToPromptContext,
} from './appExpertise.js';

const execAsync = promisify(exec);

export type SandboxMode = 'headless' | 'window';

export interface SandboxedStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'status';
  content?: string;
  screenshot?: string;
  url?: string;
  timestamp: string;
}

export interface SandboxedCallbacks {
  executionId: string;
  goal: string;
  mode: SandboxMode;
  targetApp?: string;
  startUrl?: string;
  serverUrl: string;
  inputMutex?: InputMutex;
  onStep: (step: SandboxedStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string, extractedData?: any) => void;
  onError: (error: Error) => void;
}

/* ─── URL / web-task detection ─────────────────────────── */

const WEB_INDICATORS = [
  /go\s+to\s+(https?:\/\/|www\.|[\w-]+\.(com|org|net|io|dev|app|ai))/i,
  /open\s+(https?:\/\/|www\.|[\w-]+\.(com|org|net|io|dev|app|ai))/i,
  /navigate\s+to/i,
  /search\s+(on\s+)?(google|bing|amazon|ebay|youtube)/i,
  /browse\s/i,
  /website/i,
  /web\s*page/i,
  /amazon|google|youtube|twitter|facebook|reddit|linkedin|github/i,
  /https?:\/\//i,
  /add\s+to\s+cart/i,
  /buy\s+on/i,
  /look\s+up.*online/i,
  /check\s+(the\s+)?(price|weather|news|stock)/i,
];

const NATIVE_INDICATORS = [
  /calculator/i,
  /finder/i,
  /terminal/i,
  /xcode/i,
  /notes\s*app/i,
  /system\s*preferences/i,
  /system\s*settings/i,
  /preview/i,
  /keynote/i,
  /pages\s/i,
  /numbers\s/i,
  /photos\s*app/i,
  /music\s*app/i,
  /mail\s*app/i,
  /figma/i,
  /photoshop/i,
  /illustrator/i,
  /after\s*effects/i,
  /premiere/i,
  /unity/i,
  /blender/i,
  /sketch/i,
  /davinci\s*resolve/i,
  /resolve/i,
  /logic\s*pro/i,
  /final\s*cut/i,
  /cinema\s*4d/i,
  /c4d/i,
  /unreal/i,
  /ableton/i,
];

export function detectTaskMode(goal: string, targetApp?: string): SandboxMode {
  if (targetApp) {
    const browserApps = ['chrome', 'safari', 'firefox', 'arc', 'brave', 'edge'];
    if (browserApps.some(b => targetApp.toLowerCase().includes(b))) {
      return 'headless';
    }
    return 'window';
  }

  if (NATIVE_INDICATORS.some(p => p.test(goal))) return 'window';
  if (WEB_INDICATORS.some(p => p.test(goal))) return 'headless';

  return 'headless';
}

function extractUrl(goal: string): string {
  const urlMatch = goal.match(/(https?:\/\/[^\s,]+)/i);
  if (urlMatch) return urlMatch[1];

  const domainMatch = goal.match(/(www\.[\w.-]+\.\w+|[\w-]+\.(com|org|net|io|dev|app|ai))/i);
  if (domainMatch) return `https://${domainMatch[1]}`;

  const siteMap: Record<string, string> = {
    amazon: 'https://www.amazon.com',
    google: 'https://www.google.com',
    youtube: 'https://www.youtube.com',
    github: 'https://www.github.com',
    twitter: 'https://twitter.com',
    reddit: 'https://www.reddit.com',
    linkedin: 'https://www.linkedin.com',
    ebay: 'https://www.ebay.com',
    walmart: 'https://www.walmart.com',
    target: 'https://www.target.com',
  };

  for (const [name, url] of Object.entries(siteMap)) {
    if (goal.toLowerCase().includes(name)) return url;
  }

  return 'https://www.google.com';
}

/* ═══════════════════════════════════════════════════════════
   Headless Mode — Web tasks via server's VisionAgent API
   ═══════════════════════════════════════════════════════════ */

async function runHeadless(cb: SandboxedCallbacks): Promise<void> {
  const startUrl = cb.startUrl || extractUrl(cb.goal);

  cb.onStep({
    type: 'status',
    content: `Starting headless browser → ${startUrl}`,
    timestamp: new Date().toISOString(),
  });

  const response = await fetch(`${cb.serverUrl}/api/browser/vision/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: cb.goal,
      url: startUrl,
      sessionId: cb.executionId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${await response.text()}`);
  }

  const startData = await response.json();
  if (!startData.success) {
    throw new Error(startData.error || 'Failed to start vision task');
  }

  cb.onStep({
    type: 'status',
    content: 'Agent is working in a hidden browser — your screen is free.',
    url: startUrl,
    timestamp: new Date().toISOString(),
  });

  let logOffset = 0;
  const maxPolls = 150;
  let polls = 0;

  while (polls < maxPolls) {
    await new Promise(r => setTimeout(r, 2000));
    polls++;

    try {
      // Poll session state
      const pollRes = await fetch(
        `${cb.serverUrl}/api/browser/vision/poll/${cb.executionId}?since=${logOffset}`
      );
      if (!pollRes.ok) continue;

      const state = await pollRes.json();
      if (!state.success) continue;

      // Process new logs
      if (state.logs && Array.isArray(state.logs)) {
        for (const log of state.logs) {
          cb.onStep({
            type: log.type === 'error' ? 'error' : log.type === 'step' ? 'action' : 'thinking',
            content: log.message || log.text,
            url: log.url,
            timestamp: log.timestamp || new Date().toISOString(),
          });
        }
        logOffset = state.totalLogs || (logOffset + state.logs.length);
      }

      // Grab latest screenshot
      try {
        const ssRes = await fetch(
          `${cb.serverUrl}/api/browser/vision/screenshot/${cb.executionId}`
        );
        if (ssRes.ok) {
          const ssData = await ssRes.json();
          if (ssData.success && ssData.screenshot) {
            cb.onScreenshot(`data:image/png;base64,${ssData.screenshot}`);
          }
        }
      } catch { /* screenshot poll is best-effort */ }

      if (state.status === 'done') {
        cb.onComplete(
          state.extractedData
            ? `Task completed in ${state.progress || 0} steps.`
            : `Task completed in ${state.progress || 0} steps.`,
          state.extractedData
        );
        return;
      }

      if (state.status === 'error' || state.status === 'failed') {
        throw new Error(state.error || 'Agent encountered an error');
      }
    } catch (pollErr: any) {
      if (pollErr.message.includes('Agent encountered')) throw pollErr;
    }
  }

  cb.onComplete('Task timed out after 5 minutes. It may be partially complete.');
}

/* ═══════════════════════════════════════════════════════════
   Window Mode — Native apps with per-window isolation
   Uses screencapture -l and AppleScript (no cursor takeover)
   ═══════════════════════════════════════════════════════════ */

async function getWindowId(appName: string): Promise<number | null> {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to tell process "${appName}" to get id of front window'`,
      { timeout: 5000 }
    );
    return parseInt(stdout.trim(), 10) || null;
  } catch {
    // Fallback: use CGWindowListCopyWindowInfo via Python
    try {
      const { stdout } = await execAsync(
        `python3 -c "
import Quartz
windows = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
    Quartz.kCGNullWindowID
)
for w in windows:
    name = w.get('kCGWindowOwnerName', '')
    if '${appName}'.lower() in name.lower():
        print(w.get('kCGWindowNumber', 0))
        break
"`,
        { timeout: 5000 }
      );
      return parseInt(stdout.trim(), 10) || null;
    } catch {
      return null;
    }
  }
}

async function captureWindowById(windowId: number, targetWidth: number): Promise<string> {
  const tmpPath = `/tmp/operon-window-${windowId}-${Date.now()}.jpg`;
  try {
    await execAsync(`screencapture -l ${windowId} -x -t jpg "${tmpPath}"`, {
      timeout: 10000,
    });

    const { stdout: sizeOut } = await execAsync(
      `sips -g pixelWidth -g pixelHeight "${tmpPath}" 2>/dev/null | grep pixel`,
      { timeout: 5000 }
    );
    const widthMatch = sizeOut.match(/pixelWidth:\s*(\d+)/);
    const origWidth = widthMatch ? parseInt(widthMatch[1], 10) : targetWidth;

    if (origWidth > targetWidth) {
      await execAsync(
        `sips --resampleWidth ${targetWidth} "${tmpPath}" >/dev/null 2>&1`,
        { timeout: 5000 }
      );
    }

    const { stdout: b64 } = await execAsync(`base64 -i "${tmpPath}"`, {
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
    });

    return b64.replace(/\s/g, '');
  } finally {
    execAsync(`rm -f "${tmpPath}"`).catch(() => {});
  }
}

async function captureWindowFallback(appName: string, targetWidth: number): Promise<string> {
  let sources: Electron.DesktopCapturerSource[];
  try {
    sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 2048, height: 2048 },
    });
  } catch {
    throw new Error(`Cannot capture window for ${appName}`);
  }

  const appLower = appName.toLowerCase();
  const source = sources.find(s => s.name.toLowerCase().includes(appLower));
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error(`No window found for "${appName}"`);
  }

  const { width: cw, height: ch } = source.thumbnail.getSize();
  const outW = Math.min(targetWidth, cw);
  const outH = Math.max(1, Math.round(ch * (outW / cw)));
  const resized = source.thumbnail.resize({ width: outW, height: outH, quality: 'good' });
  return Buffer.from(resized.toJPEG(65)).toString('base64');
}

/**
 * Get the window's on-screen position so we can convert window-relative
 * coordinates to screen-absolute ones for AppleScript click events.
 */
async function getWindowBounds(appName: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to tell process "${appName}" to get {position, size} of front window'`,
      { timeout: 5000 }
    );
    const nums = stdout.trim().split(',').map(s => parseInt(s.trim(), 10));
    if (nums.length >= 4) {
      return { x: nums[0], y: nums[1], w: nums[2], h: nums[3] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Click inside a window using AppleScript "click at" — does NOT move the
 * physical cursor or steal focus from the user's current app.
 *
 * Coordinates are window-relative; we convert to the process-level
 * coordinate system that "click at {x, y}" expects.
 *
 * Falls back to cliclick + brief focus-switch only if AppleScript click fails.
 */
async function clickInWindow(
  appName: string,
  x: number,
  y: number,
  clickType: 'single' | 'double' = 'single',
  mutex?: InputMutex
): Promise<void> {
  // Try AppleScript AX click first (no cursor movement, no focus steal)
  try {
    const clickCmd = clickType === 'double'
      ? `click at {${x}, ${y}}\nclick at {${x}, ${y}}`
      : `click at {${x}, ${y}}`;

    await execAsync(
      `osascript -e 'tell application "System Events" to tell process "${appName}" to ${clickCmd}'`,
      { timeout: 5000 }
    );
    return;
  } catch {
    // AppleScript "click at" can fail for some apps — fall back below
  }

  // Fallback: convert to screen coords and use CGEvent via Python (no focus steal)
  const bounds = await getWindowBounds(appName);
  if (bounds) {
    try {
      const screenX = bounds.x + x;
      const screenY = bounds.y + y;
      const clickCount = clickType === 'double' ? 2 : 1;
      await execAsync(
        `python3 -c "
import Quartz, time
pt = Quartz.CGPointMake(${screenX}, ${screenY})
for i in range(${clickCount}):
    down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, pt, Quartz.kCGMouseButtonLeft)
    up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, pt, Quartz.kCGMouseButtonLeft)
    Quartz.CGEventSetIntegerValueField(down, Quartz.kCGMouseEventClickState, i+1)
    Quartz.CGEventSetIntegerValueField(up, Quartz.kCGMouseEventClickState, i+1)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)
    if i < ${clickCount - 1}: time.sleep(0.05)
"`,
        { timeout: 5000 }
      );
      return;
    } catch {
      // Fall through to cliclick
    }
  }

  // Last resort: cliclick (moves cursor, brief focus steal)
  if (mutex) await mutex.acquire();
  try {
    await activateApp(appName);
    await new Promise(r => setTimeout(r, 80));
    const cliCmd = clickType === 'double' ? `dc:${x},${y}` : `c:${x},${y}`;
    await execAsync(`cliclick ${cliCmd}`, { timeout: 5000 });
  } finally {
    if (mutex) mutex.release();
  }
}

async function runWindowMode(cb: SandboxedCallbacks): Promise<void> {
  const appName = cb.targetApp!;
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const anthropic = new Anthropic();

  cb.onStep({
    type: 'status',
    content: `Starting window-isolated agent for "${appName}"...`,
    timestamp: new Date().toISOString(),
  });

  // Ensure app is running
  try {
    await execAsync(`open -a "${appName}"`, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
  } catch {
    throw new Error(`Could not open "${appName}"`);
  }

  const expertise = getAppExpertise(appName);
  const captureConfig = getCaptureSettings(appName);
  const TARGET_WIDTH = captureConfig.targetWidth;
  const JPEG_QUALITY = captureConfig.jpegQuality;
  const MAX_TURNS = 30;
  const messages: any[] = [{ role: 'user', content: cb.goal }];

  if (expertise) {
    console.log(`[Sandbox:${appName}] Professional mode: ${expertise.role}`);
  }

  const basePrompt = `You control ONLY the "${appName}" app on macOS. Your view is a screenshot of ONLY the "${appName}" window (not the whole screen).

CRITICAL: The user is actively working on other apps at the same time. You must NEVER interfere with their work.

ABSOLUTE PROHIBITIONS:
- NEVER use Spotlight (Cmd+Space). The app is already open for you.
- NEVER use Cmd+Tab, Mission Control, or any system-wide shortcuts.
- NEVER try to open other apps, Finder, or any app besides "${appName}".
- NEVER use global keyboard shortcuts that would affect other apps.

RULES:
1. Prefer keyboard shortcuts over clicking — keyboard goes directly to "${appName}" without affecting the user's cursor.
2. Coordinates are relative to the "${appName}" window (top-left = 0,0).
3. Be efficient — don't waste turns.
4. The app is already running and visible. Start working on the task immediately.
5. When done, state what you accomplished.

ENVIRONMENT: macOS, ${TARGET_WIDTH}px-wide window view, "${appName}" is already open.`;

  let finalSystemPrompt = expertise
    ? buildExpertiseSystemPrompt(expertise.appName, basePrompt, cb.goal)
    : `${basePrompt}\nGOAL: ${cb.goal}`;

  // For professional apps, generate a workflow plan
  if (expertise) {
    cb.onStep({
      type: 'thinking',
      content: `Planning professional ${expertise.role} workflow...`,
      timestamp: new Date().toISOString(),
    });

    try {
      const plan = await generateWorkflowPlan(
        expertise.appName,
        cb.goal,
        async (msgs) => {
          const res = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: msgs,
          });
          return res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
        },
      );

      if (plan && plan.steps.length > 0) {
        finalSystemPrompt = `${finalSystemPrompt}\n${planToPromptContext(plan)}`;
        cb.onStep({
          type: 'thinking',
          content: `Workflow plan: ${plan.steps.length} steps. Tools: ${plan.requiredTools.join(', ')}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn(`[Sandbox:${appName}] Workflow planning failed:`, e);
    }
  }

  let turn = 0;

  while (turn < MAX_TURNS) {
    turn++;
    cb.onStep({
      type: 'thinking',
      content: `Turn ${turn}/${MAX_TURNS} — analyzing window...`,
      timestamp: new Date().toISOString(),
    });

    // Capture window screenshot
    let screenshot: string;
    const windowId = await getWindowId(appName);
    try {
      if (windowId) {
        screenshot = await captureWindowById(windowId, TARGET_WIDTH);
      } else {
        screenshot = await captureWindowFallback(appName, TARGET_WIDTH);
      }
    } catch {
      screenshot = await captureWindowFallback(appName, TARGET_WIDTH);
    }

    cb.onScreenshot(`data:image/jpeg;base64,${screenshot}`);

    // Prune old screenshots to save tokens
    for (let i = 0; i < messages.length - 4; i++) {
      const msg = messages[i];
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (let j = 0; j < msg.content.length; j++) {
          const item = msg.content[j];
          if (item.type === 'tool_result' && Array.isArray(item.content)) {
            if (item.content.some((c: any) => c.type === 'image')) {
              msg.content[j] = {
                type: 'tool_result',
                tool_use_id: item.tool_use_id,
                content: '[screenshot omitted]',
              };
            }
          }
        }
      }
    }

    const response = await anthropic.beta.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [{ type: 'text', text: finalSystemPrompt, cache_control: { type: 'ephemeral' } } as any],
      tools: [{
        type: 'computer_20250124' as any,
        name: 'computer',
        display_width_px: TARGET_WIDTH,
        display_height_px: 768,
        display_number: 0,
        cache_control: { type: 'ephemeral' },
      } as any],
      messages,
      betas: ['computer-use-2025-01-24', 'prompt-caching-2024-07-31'],
    } as any);

    const content = response.content;
    messages.push({ role: 'assistant', content });

    let hasToolUse = false;
    const toolResults: any[] = [];

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        cb.onStep({
          type: 'thinking',
          content: block.text,
          timestamp: new Date().toISOString(),
        });
      }

      if (block.type === 'tool_use') {
        hasToolUse = true;
        const action = block.input as any;

        if (action.action === 'screenshot' || action.action === 'cursor_position') {
          const img = windowId
            ? await captureWindowById(windowId, TARGET_WIDTH)
            : await captureWindowFallback(appName, TARGET_WIDTH);
          cb.onScreenshot(`data:image/jpeg;base64,${img}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }],
          });
        } else if (action.action === 'type' && action.text) {
          cb.onStep({ type: 'action', content: `Type: "${action.text.slice(0, 50)}"`, timestamp: new Date().toISOString() });
          await appKeystroke(appName, action.text);
          await new Promise(r => setTimeout(r, 100));
          const img = windowId
            ? await captureWindowById(windowId, TARGET_WIDTH)
            : await captureWindowFallback(appName, TARGET_WIDTH);
          cb.onScreenshot(`data:image/jpeg;base64,${img}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }],
          });
        } else if (action.action === 'key' && action.text) {
          // Block global shortcuts that would interfere with the user
          const keyLower = action.text.toLowerCase().replace(/\s/g, '');
          const blockedCombos = [
            'super+space', 'cmd+space', 'command+space', 'meta+space',
            'super+tab', 'cmd+tab', 'command+tab', 'meta+tab',
            'ctrl+up', 'control+up',    // Mission Control
            'ctrl+down', 'control+down', // App Exposé
          ];
          if (blockedCombos.some(b => keyLower === b.replace(/\s/g, ''))) {
            cb.onStep({
              type: 'action',
              content: `Blocked global shortcut: ${action.text} — use only ${appName}-scoped actions`,
              timestamp: new Date().toISOString(),
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `That shortcut (${action.text}) is blocked because it would interfere with the user. The app "${appName}" is already open — work within it directly.`,
              is_error: true,
            });
            continue;
          }

          cb.onStep({ type: 'action', content: `Key: ${action.text}`, timestamp: new Date().toISOString() });
          const combo = action.text.split('+').map((k: string) => k.trim());
          if (combo.length === 1) {
            await appSpecialKey(appName, combo[0]);
          } else {
            const mods: string[] = [];
            let mainKey = '';
            for (const part of combo) {
              const lower = part.toLowerCase();
              if (['cmd', 'command', 'super', 'meta'].includes(lower)) mods.push('command');
              else if (['ctrl', 'control'].includes(lower)) mods.push('control');
              else if (['alt', 'option'].includes(lower)) mods.push('option');
              else if (lower === 'shift') mods.push('shift');
              else mainKey = part;
            }
            if (mainKey) await appKeyCombo(appName, mainKey, mods);
          }
          await new Promise(r => setTimeout(r, 80));
          const img = windowId
            ? await captureWindowById(windowId, TARGET_WIDTH)
            : await captureWindowFallback(appName, TARGET_WIDTH);
          cb.onScreenshot(`data:image/jpeg;base64,${img}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }],
          });
        } else if (
          ['left_click', 'right_click', 'double_click', 'mouse_move', 'scroll', 'left_click_drag'].includes(action.action)
          && action.coordinate
        ) {
          const desc = `${action.action} at (${action.coordinate.join(', ')})`;
          cb.onStep({ type: 'action', content: desc, timestamp: new Date().toISOString() });

          // Brief focus-switch for mouse actions (< 100ms interruption)
          const [x, y] = action.coordinate;
          const clickType = action.action === 'double_click' ? 'double' : 'single';
          if (action.action === 'mouse_move') {
            // No-op for window mode — cursor stays with user
          } else if (action.action === 'scroll') {
            // Use AppleScript scroll (no cursor needed)
            const dir = action.scroll_direction || 'down';
            const amt = action.scroll_amount || 3;
            const keyCode = dir === 'up' ? 126 : 125; // arrow key codes
            for (let i = 0; i < amt; i++) {
              await execAsync(
                `osascript -e 'tell application "System Events" to tell process "${appName}" to key code ${keyCode}'`
              );
            }
          } else {
            await clickInWindow(appName, x, y, clickType, cb.inputMutex);
          }

          await new Promise(r => setTimeout(r, 150));
          const img = windowId
            ? await captureWindowById(windowId, TARGET_WIDTH)
            : await captureWindowFallback(appName, TARGET_WIDTH);
          cb.onScreenshot(`data:image/jpeg;base64,${img}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }],
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Unknown action: ${action.action}`,
            is_error: true,
          });
        }
      }
    }

    if (!hasToolUse) {
      const finalText = content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      cb.onComplete(finalText || 'Task completed.');
      return;
    }

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    }
  }

  cb.onComplete(`Reached max turns (${MAX_TURNS}). Task may be partially complete.`);
}

/* ═══════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════ */

export class SandboxedAgent {
  private abortControllers = new Map<string, AbortController>();

  async execute(callbacks: SandboxedCallbacks): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(callbacks.executionId, controller);

    try {
      if (callbacks.mode === 'headless') {
        await runHeadless(callbacks);
      } else {
        await runWindowMode(callbacks);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        callbacks.onError(err);
      }
    } finally {
      this.abortControllers.delete(callbacks.executionId);
    }
  }

  cancel(executionId: string): void {
    const controller = this.abortControllers.get(executionId);
    controller?.abort();
  }
}
