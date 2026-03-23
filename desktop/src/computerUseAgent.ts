/* ═══════════════════════════════════════════════════════════
   Computer Use Agent — Claude controls the user's desktop

   Uses the Anthropic API's computer_use tool to let Claude
   see the screen (via screenshots) and control native apps
   (via mouse movements, clicks, keyboard input).

   The agent loop:
   1. Capture screenshot of user's screen
   2. Send to Claude with the computer_use tool
   3. Claude decides: click, type, key combo, scroll, or done
   4. Execute the action on the real desktop
   5. Capture new screenshot → repeat

   Safety:
   - Dangerous actions (purchases, sends, deletes) require
     user approval via IPC to the renderer
   - All actions are logged for audit
   - Budget cap prevents runaway costs
   ═══════════════════════════════════════════════════════════ */

import Anthropic from '@anthropic-ai/sdk';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
import electron from 'electron';
const { screen, desktopCapturer } = electron;

/* ─── Types ──────────────────────────────────────────────── */

export interface ComputerAction {
  action: 'mouse_move' | 'left_click' | 'right_click' | 'double_click' |
          'middle_click' | 'triple_click' | 'type' | 'key' | 'scroll' |
          'screenshot' | 'left_click_drag' | 'cursor_position';
  coordinate?: [number, number];
  text?: string;
  scroll_direction?: 'up' | 'down' | 'left' | 'right';
  scroll_amount?: number;
  start_coordinate?: [number, number];
}

export interface AgentStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'approval';
  content?: string;
  action?: ComputerAction;
  timestamp: string;
}

interface ExecutionCallbacks {
  executionId: string;
  goal: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  allowedApps?: string[];
  onStep: (step: AgentStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
  onApprovalRequired: (action: { description: string; action: ComputerAction }) => void;
}

interface ComputerUseAgentConfig {
  serverUrl: string;
}

const TARGET_WIDTH = 1280;
const JPEG_QUALITY = 60;
const KEEP_SCREENSHOT_TURNS = 2;
const POST_ACTION_DELAY_MS = 200;

/* ─── Dangerous action patterns (require user approval) ─── */

const DANGEROUS_PATTERNS = [
  /place.?order/i, /buy.?now/i, /purchase/i, /checkout/i,
  /confirm.?payment/i, /pay\s/i, /submit.?order/i,
  /send\s/i, /post\s/i, /publish/i, /reply/i,
  /delete/i, /remove/i, /trash/i, /unsubscribe/i,
  /sign.?out/i, /log.?out/i, /disconnect/i,
  /format/i, /erase/i, /reset/i,
];

function isDangerousAction(action: ComputerAction, context: string): boolean {
  if (action.action === 'left_click' || action.action === 'double_click') {
    return DANGEROUS_PATTERNS.some(p => p.test(context));
  }
  if (action.action === 'key') {
    const dangerousKeys = ['Return', 'Enter', 'return', 'enter'];
    if (dangerousKeys.includes(action.text || '')) {
      return DANGEROUS_PATTERNS.some(p => p.test(context));
    }
  }
  return false;
}

/* ─── Computer Use Agent ─────────────────────────────────── */

export class ComputerUseAgent {
  private anthropic: Anthropic;
  private abortControllers = new Map<string, AbortController>();
  private approvalResolvers = new Map<string, (approved: boolean) => void>();
  private config: ComputerUseAgentConfig;

  constructor(agentConfig: ComputerUseAgentConfig) {
    this.config = agentConfig;
    this.anthropic = new Anthropic();
  }

  async execute(callbacks: ExecutionCallbacks): Promise<void> {
    const {
      executionId, goal,
      model = 'claude-sonnet-4-20250514',
      maxTurns = 30,
      maxBudgetUsd = 2.00,
    } = callbacks;

    const controller = new AbortController();
    this.abortControllers.set(executionId, controller);

    const display = screen.getPrimaryDisplay();
    const realWidth = display.size.width;
    const realHeight = display.size.height;

    const declaredWidth = Math.min(realWidth, TARGET_WIDTH);
    const declaredHeight = Math.round(realHeight * (declaredWidth / realWidth));
    const coordScale = realWidth / declaredWidth;

    console.log('[Desktop] Display:', realWidth, 'x', realHeight,
      '→ declared:', declaredWidth, 'x', declaredHeight,
      'coordScale:', coordScale.toFixed(2));

    const toolVersion = 'computer_20250124';
    const betaHeader = 'computer-use-2025-01-24';

    const systemPrompt = `You control the user's macOS computer. You can see the screen, click, type, and use keyboard shortcuts.

RULES:
1. Take a screenshot first to see the current state.
2. Execute one action at a time, then take another screenshot to verify.
3. Be efficient — don't repeat failed actions more than twice.
4. When done, clearly state what you accomplished.
5. NEVER click on, close, minimize, or interact with the "OperonAI" window — that is your own control panel. Ignore it completely. If it is visible, work around it.

KEYBOARD SHORTCUTS (macOS):
- Spotlight: super+space — then type app name and press Return
- Close window: super+w
- Quit app: super+q
- Copy/Paste: super+c / super+v

ENVIRONMENT: macOS, ${declaredWidth}x${declaredHeight} display.

GOAL: ${goal}`;

    const messages: any[] = [
      { role: 'user', content: goal },
    ];

    let totalCost = 0;
    let turn = 0;

    try {
      while (turn < maxTurns && totalCost < maxBudgetUsd) {
        if (controller.signal.aborted) break;

        turn++;
        callbacks.onStep({
          type: 'thinking',
          content: `Turn ${turn}/${maxTurns} — reasoning...`,
          timestamp: new Date().toISOString(),
        });

        pruneOldScreenshots(messages, KEEP_SCREENSHOT_TURNS);

        const response = await this.anthropic.beta.messages.create({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          tools: [
            {
              type: toolVersion as any,
              name: 'computer',
              display_width_px: declaredWidth,
              display_height_px: declaredHeight,
              display_number: 0,
            } as any,
          ],
          messages,
          betas: [betaHeader],
        } as any);

        const usage = (response as any).usage;
        if (usage) {
          const inputCost = (usage.input_tokens / 1_000_000) * 3;
          const outputCost = (usage.output_tokens / 1_000_000) * 15;
          totalCost += inputCost + outputCost;
          console.log('[Desktop] Turn', turn, '— tokens:', usage.input_tokens, 'in /', usage.output_tokens, 'out, cost so far: $' + totalCost.toFixed(4));
        }

        const assistantContent = response.content;
        messages.push({ role: 'assistant', content: assistantContent });

        let hasToolUse = false;
        const toolResults: any[] = [];

        for (const block of assistantContent) {
          if (block.type === 'text' && block.text) {
            callbacks.onStep({
              type: 'thinking',
              content: block.text,
              timestamp: new Date().toISOString(),
            });
          }

          if (block.type === 'tool_use') {
            hasToolUse = true;
            const action = block.input as ComputerAction;
            console.log('[Desktop] Raw tool_use:', JSON.stringify(block.input));

            if (action.action === 'screenshot' || action.action === 'cursor_position') {
              const imgData = await this.captureScreen(declaredWidth);
              callbacks.onScreenshot(`data:image/jpeg;base64,${imgData}`);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: [{
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: imgData },
                }],
              });
            } else {
              callbacks.onStep({
                type: 'action',
                action,
                content: describeAction(action),
                timestamp: new Date().toISOString(),
              });

              const textContext = assistantContent
                .filter((b: any) => b.type === 'text')
                .map((b: any) => b.text)
                .join(' ');

              if (isDangerousAction(action, textContext)) {
                callbacks.onApprovalRequired({
                  description: describeAction(action),
                  action,
                });

                const approved = await this.waitForApproval(executionId, controller.signal);
                if (!approved) {
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: 'Action was denied by the user. Try an alternative approach.',
                    is_error: true,
                  });
                  continue;
                }
              }

              try {
                await this.executeAction(action, coordScale);

                await new Promise(r => setTimeout(r, POST_ACTION_DELAY_MS));
                const imgData = await this.captureScreen(declaredWidth);
                callbacks.onScreenshot(`data:image/jpeg;base64,${imgData}`);

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: [{
                    type: 'image',
                    source: { type: 'base64', media_type: 'image/jpeg', data: imgData },
                  }],
                });
              } catch (err: any) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: `Action failed: ${err.message}`,
                  is_error: true,
                });
              }
            }
          }
        }

        if (!hasToolUse) {
          const finalText = assistantContent
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');

          callbacks.onComplete(finalText || 'Task completed.');
          break;
        }

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        }
      }

      if (turn >= maxTurns) {
        callbacks.onComplete(`Reached maximum turns (${maxTurns}). Task may be partially complete.`);
      }
      if (totalCost >= maxBudgetUsd) {
        callbacks.onComplete(`Reached budget limit ($${maxBudgetUsd}). Task may be partially complete.`);
      }

    } catch (err: any) {
      if (controller.signal.aborted) {
        callbacks.onComplete('Execution cancelled by user.');
      } else {
        callbacks.onError(err);
      }
    } finally {
      this.abortControllers.delete(executionId);
    }
  }

  /* ─── Screen Capture (Electron desktopCapturer → JPEG)
      Uses the same app identity as Screen Recording in System Settings.
      The `screencapture` CLI often fails even when Electron is allowed. ───── */

  private async captureScreen(targetWidth: number): Promise<string> {
    const d = screen.getPrimaryDisplay();
    const { width: sw, height: sh } = d.size;
    const scaleFactor = d.scaleFactor || 1;
    const pixelW = Math.min(4096, Math.max(1, Math.round(sw * scaleFactor)));
    const pixelH = Math.min(4096, Math.max(1, Math.round(sh * scaleFactor)));

    let sources: Electron.DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: pixelW, height: pixelH },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Desktop] desktopCapturer.getSources failed:', msg);
      throw new Error(
        `Screen capture failed: ${msg}. In System Settings → Privacy & Security → Screen Recording, enable the Electron.app from this project: desktop/node_modules/electron/dist/Electron.app — then fully quit and reopen Operon.`
      );
    }

    if (!sources.length) {
      throw new Error(
        'No screen sources from Electron. Re-add Screen Recording for: desktop/node_modules/electron/dist/Electron.app, then restart the app.'
      );
    }

    const displayId = String(d.id);
    const source =
      sources.find((s) => s.display_id === displayId) ?? sources[0];
    const thumb = source.thumbnail;
    if (thumb.isEmpty()) {
      throw new Error(
        'Screen thumbnail was empty. Toggle Screen Recording off/on for this Electron.app, then restart.'
      );
    }

    const { width: cw, height: ch } = thumb.getSize();
    const outH = Math.max(1, Math.round(ch * (targetWidth / cw)));
    const resized = thumb.resize({
      width: targetWidth,
      height: outH,
      quality: 'good',
    });

    const jpegBuffer = resized.toJPEG(JPEG_QUALITY);
    const buf = Buffer.from(jpegBuffer);
    console.log('[Desktop] Screenshot:', buf.length, 'bytes (JPEG q' + JPEG_QUALITY + ',', targetWidth + 'px, desktopCapturer)');
    return buf.toString('base64');
  }

  /* ─── Action Execution (cliclick + AppleScript) ────────── */

  private async executeAction(action: ComputerAction, coordScale: number): Promise<void> {
    const s = (v: number) => Math.round(v * coordScale);
    console.log('[Desktop] Action:', action.action, JSON.stringify(action), 'scale:', coordScale.toFixed(2));

    switch (action.action) {
      case 'mouse_move': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`m:${s(x)},${s(y)}`);
        break;
      }

      case 'left_click': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`c:${s(x)},${s(y)}`);
        break;
      }

      case 'right_click': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`rc:${s(x)},${s(y)}`);
        break;
      }

      case 'double_click': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`dc:${s(x)},${s(y)}`);
        break;
      }

      case 'middle_click': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`c:${s(x)},${s(y)}`);
        break;
      }

      case 'triple_click': {
        if (!action.coordinate) break;
        const [x, y] = action.coordinate;
        await this.cli(`tc:${s(x)},${s(y)}`);
        break;
      }

      case 'type': {
        if (!action.text) break;
        const escaped = action.text.replace(/"/g, '\\"');
        await this.cli(`t:"${escaped}"`);
        break;
      }

      case 'key': {
        if (!action.text) break;
        await this.pressKey(action.text);
        break;
      }

      case 'scroll': {
        const dir = action.scroll_direction || 'down';
        const amount = action.scroll_amount || 3;
        if (action.coordinate) {
          const [x, y] = action.coordinate;
          await this.cli(`m:${s(x)},${s(y)}`);
        }
        for (let i = 0; i < amount; i++) {
          const key = dir === 'up' ? 'arrow-up' : dir === 'down' ? 'arrow-down' : dir === 'left' ? 'arrow-left' : 'arrow-right';
          await this.cli(`kp:${key}`);
        }
        break;
      }

      case 'left_click_drag': {
        if (!action.start_coordinate || !action.coordinate) break;
        const [sx, sy] = action.start_coordinate;
        const [ex, ey] = action.coordinate;
        await this.cli(`dd:${s(sx)},${s(sy)} du:${s(ex)},${s(ey)}`);
        break;
      }

      default:
        console.warn('[Desktop] Unknown action:', action.action);
        break;
    }
  }

  /* ─── Key Press Helpers (macOS) ───────────────────────── */

  private async pressKey(key: string): Promise<void> {
    console.log('[Desktop] pressKey:', key);
    const combo = key.split('+').map(k => k.trim());

    if (combo.length === 1) {
      const mapped = this.mapKey(combo[0]);
      await this.cli(`kp:${mapped}`);
      return;
    }

    const cliModifiers: string[] = [];
    let mainKey = '';

    for (const part of combo) {
      const lower = part.toLowerCase();
      if (['cmd', 'command', 'super', 'meta'].includes(lower)) {
        cliModifiers.push('cmd');
      } else if (['ctrl', 'control'].includes(lower)) {
        cliModifiers.push('ctrl');
      } else if (['alt', 'option'].includes(lower)) {
        cliModifiers.push('alt');
      } else if (lower === 'shift') {
        cliModifiers.push('shift');
      } else if (lower === 'fn') {
        cliModifiers.push('fn');
      } else {
        mainKey = this.mapKey(part);
      }
    }

    if (!mainKey) {
      console.warn('[Desktop] pressKey: no main key found in combo:', key);
      return;
    }

    const keyDowns = cliModifiers.map(m => `kd:${m}`).join(' ');
    const keyUps = cliModifiers.map(m => `ku:${m}`).join(' ');
    const cmd = `${keyDowns} kp:${mainKey} ${keyUps}`.trim();
    console.log('[Desktop] cliclick command:', cmd);
    await this.cli(cmd);
  }

  private mapKey(key: string): string {
    const map: Record<string, string> = {
      'return': 'return', 'enter': 'return',
      'tab': 'tab', 'escape': 'escape', 'esc': 'escape',
      'backspace': 'delete', 'delete': 'fwd-delete',
      'space': 'space',
      'up': 'arrow-up', 'down': 'arrow-down',
      'left': 'arrow-left', 'right': 'arrow-right',
      'home': 'home', 'end': 'end',
      'page_up': 'page-up', 'pageup': 'page-up',
      'page_down': 'page-down', 'pagedown': 'page-down',
      'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4',
      'f5': 'f5', 'f6': 'f6', 'f7': 'f7', 'f8': 'f8',
      'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12',
    };
    return map[key.toLowerCase()] || key.toLowerCase();
  }

  private async cli(args: string): Promise<void> {
    try {
      console.log('[Desktop] cliclick:', args);
      await execAsync(`cliclick ${args}`, { timeout: 10000, encoding: 'utf-8' });
    } catch (err: any) {
      if (err.message?.includes('not permitted') || err.message?.includes('accessibility')) {
        throw new Error(
          'cliclick requires Accessibility permission: System Settings → Privacy & Security → Accessibility → enable Electron, then restart the app.'
        );
      }
      throw new Error(`cliclick failed: ${err.message}`);
    }
  }

  private async runAppleScript(script: string): Promise<void> {
    try {
      await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
        timeout: 10000,
        encoding: 'utf-8',
      });
    } catch (err: any) {
      throw new Error(`AppleScript failed: ${err.message}`);
    }
  }

  /* ─── Approval / Cancellation ─────────────────────────── */

  resolveApproval(executionId: string, approved: boolean): void {
    const resolver = this.approvalResolvers.get(executionId);
    if (resolver) {
      resolver(approved);
      this.approvalResolvers.delete(executionId);
    }
  }

  private waitForApproval(executionId: string, signal: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (signal.aborted) { resolve(false); return; }
      this.approvalResolvers.set(executionId, resolve);
      signal.addEventListener('abort', () => {
        this.approvalResolvers.delete(executionId);
        resolve(false);
      }, { once: true });
    });
  }

  cancel(executionId: string): void {
    const controller = this.abortControllers.get(executionId);
    controller?.abort();
  }
}

/* ─── Helpers ───────────────────────────────────────────── */

function pruneOldScreenshots(messages: any[], keepTurns: number): void {
  let toolResultCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue;

    toolResultCount++;
    if (toolResultCount <= keepTurns) continue;

    for (let j = 0; j < msg.content.length; j++) {
      const item = msg.content[j];
      if (item.type === 'tool_result' && Array.isArray(item.content)) {
        const hasImage = item.content.some((c: any) => c.type === 'image');
        if (hasImage) {
          msg.content[j] = {
            type: 'tool_result',
            tool_use_id: item.tool_use_id,
            content: '[screenshot — omitted to save tokens]',
          };
        }
      }
    }
  }
}

function describeAction(action: ComputerAction): string {
  switch (action.action) {
    case 'mouse_move': return `Move mouse to (${action.coordinate?.join(', ')})`;
    case 'left_click': return `Click at (${action.coordinate?.join(', ')})`;
    case 'right_click': return `Right-click at (${action.coordinate?.join(', ')})`;
    case 'double_click': return `Double-click at (${action.coordinate?.join(', ')})`;
    case 'middle_click': return `Middle-click at (${action.coordinate?.join(', ')})`;
    case 'triple_click': return `Triple-click at (${action.coordinate?.join(', ')})`;
    case 'type': return `Type: "${action.text?.substring(0, 50)}${(action.text?.length || 0) > 50 ? '...' : ''}"`;
    case 'key': return `Press key: ${action.text}`;
    case 'scroll': return `Scroll ${action.scroll_direction || 'down'} x${action.scroll_amount || 3}`;
    case 'screenshot': return 'Capture screenshot';
    case 'cursor_position': return 'Get cursor position';
    case 'left_click_drag': return `Drag from (${action.start_coordinate?.join(', ')}) to (${action.coordinate?.join(', ')})`;
    default: return `Unknown action: ${(action as any).action}`;
  }
}
