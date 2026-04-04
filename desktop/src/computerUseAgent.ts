/* @deprecated — Use ClaudeAgent (claudeAgent.ts) instead.
   The Claude Agent SDK handles the agent loop, tool definitions,
   conversation management, and error recovery automatically.

   ═══════════════════════════════════════════════════════════
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

import {
  InputMutex,
  appKeystroke,
  appKeyCombo,
  appSpecialKey,
  activateApp,
} from './inputMutex.js';

import {
  buildExpertiseSystemPrompt,
  getCaptureSettings,
  getAppExpertise,
  findExpertiseFromGoal,
  generateWorkflowPlan,
  planToPromptContext,
} from './appExpertise.js';

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
  targetApp?: string;
  inputMutex?: InputMutex;
  onStep: (step: AgentStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
  onApprovalRequired: (action: { description: string; action: ComputerAction }) => void;
}

interface ComputerUseAgentConfig {
  serverUrl: string;
}

const DEFAULT_TARGET_WIDTH = 1024;
const DEFAULT_JPEG_QUALITY = 45;
const KEEP_SCREENSHOT_TURNS = 2;
const DEFAULT_POST_ACTION_DELAY_CLICK_MS = 150;
const DEFAULT_POST_ACTION_DELAY_KEY_MS = 80;

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
  private jpegQuality = DEFAULT_JPEG_QUALITY;
  private postActionDelay = DEFAULT_POST_ACTION_DELAY_CLICK_MS;

  constructor(agentConfig: ComputerUseAgentConfig) {
    this.config = agentConfig;
    this.anthropic = new Anthropic();
  }

  async execute(callbacks: ExecutionCallbacks): Promise<void> {
    const {
      executionId, goal,
      model = 'claude-haiku-4-5-20251001',
      maxTurns = 30,
      maxBudgetUsd = 2.00,
      targetApp,
      inputMutex,
    } = callbacks;

    const controller = new AbortController();
    this.abortControllers.set(executionId, controller);

    const expertise = targetApp
      ? getAppExpertise(targetApp)
      : findExpertiseFromGoal(goal);

    this.jpegQuality = expertise?.captureSettings.jpegQuality ?? DEFAULT_JPEG_QUALITY;
    this.postActionDelay = expertise?.captureSettings.postActionDelayMs ?? DEFAULT_POST_ACTION_DELAY_CLICK_MS;

    const captureConfig = expertise
      ? expertise.captureSettings
      : { targetWidth: DEFAULT_TARGET_WIDTH, jpegQuality: DEFAULT_JPEG_QUALITY, postActionDelayMs: DEFAULT_POST_ACTION_DELAY_CLICK_MS };

    const display = screen.getPrimaryDisplay();
    const realWidth = display.size.width;
    const realHeight = display.size.height;

    const declaredWidth = Math.min(realWidth, captureConfig.targetWidth);
    const declaredHeight = Math.round(realHeight * (declaredWidth / realWidth));
    const coordScale = realWidth / declaredWidth;

    const tag = targetApp ? `[Agent:${targetApp}]` : '[Desktop]';
    console.log(tag, 'Display:', realWidth, 'x', realHeight,
      '→ declared:', declaredWidth, 'x', declaredHeight,
      'coordScale:', coordScale.toFixed(2),
      expertise ? `(${expertise.role})` : '(generic)');

    const toolVersion = 'computer_20250124';
    const betaHeader = 'computer-use-2025-01-24';

    const windowContext = targetApp
      ? `You control ONLY the "${targetApp}" window on macOS. Coordinates are relative to this window.`
      : 'You control the user\'s macOS computer to accomplish tasks as fast as possible.';

    const windowRules = targetApp
      ? `8. You are scoped to the "${targetApp}" app. Do NOT open or interact with other apps.
9. The app should already be open. Focus on completing the task within it.`
      : '7. NEVER interact with the "OperonAI" window — it is your control panel.';

    const basePrompt = `${windowContext}

SPEED RULES — follow strictly:
1. ALWAYS prefer keyboard over mouse clicks. Type text directly instead of clicking individual characters/buttons.
2. You may perform MULTIPLE actions before taking a verification screenshot. Only screenshot when you need to see the result.
3. For calculator: type the expression with keyboard (e.g. "1+1") then press Return — do NOT click individual buttons.
4. For opening apps: super+space → type name → Return. Do this as a rapid sequence without screenshots between steps.
5. Be efficient — don't repeat failed actions more than twice.
6. When done, state what you accomplished in one sentence.
${windowRules}

KEYBOARD SHORTCUTS (macOS):
- Spotlight: super+space → type app name → Return
- Close window: super+w | Quit app: super+q
- Copy/Paste: super+c / super+v
- Select all: super+a

ENVIRONMENT: macOS, ${declaredWidth}x${declaredHeight} display.`;

    const systemPrompt = expertise
      ? buildExpertiseSystemPrompt(expertise.appName, basePrompt, goal)
      : `${basePrompt}\nGOAL: ${goal}`;

    let finalSystemPrompt = systemPrompt;

    // For professional apps, generate a workflow plan before executing
    if (expertise) {
      callbacks.onStep({
        type: 'thinking',
        content: `Planning professional ${expertise.role} workflow...`,
        timestamp: new Date().toISOString(),
      });

      try {
        const plan = await generateWorkflowPlan(
          expertise.appName,
          goal,
          async (msgs) => {
            const planResponse = await this.anthropic.messages.create({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2048,
              messages: msgs,
            });
            return planResponse.content
              .filter((b: any) => b.type === 'text')
              .map((b: any) => b.text)
              .join('');
          },
        );

        if (plan && plan.steps.length > 0) {
          const planContext = planToPromptContext(plan);
          finalSystemPrompt = `${systemPrompt}\n${planContext}`;

          callbacks.onStep({
            type: 'thinking',
            content: `Workflow plan: ${plan.steps.length} steps, ~${plan.estimatedTurns} turns. Tools: ${plan.requiredTools.join(', ')}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (planErr) {
        console.warn('[Desktop] Workflow planning failed, proceeding without plan:', planErr);
      }
    }

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
          system: [
            {
              type: 'text',
              text: finalSystemPrompt,
              cache_control: { type: 'ephemeral' },
            } as any,
          ],
          tools: [
            {
              type: toolVersion as any,
              name: 'computer',
              display_width_px: declaredWidth,
              display_height_px: declaredHeight,
              display_number: 0,
              cache_control: { type: 'ephemeral' },
            } as any,
          ],
          messages,
          betas: [betaHeader, 'prompt-caching-2024-07-31'],
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
              const imgData = targetApp
                ? await this.captureWindow(targetApp, declaredWidth, tag)
                : await this.captureScreen(declaredWidth);
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
                if (targetApp) {
                  await this.executeWindowAction(action, coordScale, targetApp, inputMutex, tag);
                } else {
                  await this.executeAction(action, coordScale);
                }

                const delay = (action.action === 'key' || action.action === 'type')
                  ? DEFAULT_POST_ACTION_DELAY_KEY_MS : this.postActionDelay;
                await new Promise(r => setTimeout(r, delay));
                const imgData = targetApp
                  ? await this.captureWindow(targetApp, declaredWidth, tag)
                  : await this.captureScreen(declaredWidth);
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

    const jpegBuffer = resized.toJPEG(this.jpegQuality);
    const buf = Buffer.from(jpegBuffer);
    console.log('[Desktop] Screenshot:', buf.length, 'bytes (JPEG q' + this.jpegQuality + ',', targetWidth + 'px, desktopCapturer)');
    return buf.toString('base64');
  }

  /* ─── Window Capture (per-app screenshot) ──────────────── */

  private async captureWindow(targetApp: string, targetWidth: number, tag: string): Promise<string> {
    let sources: Electron.DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 2048, height: 2048 },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(tag, 'desktopCapturer.getSources(window) failed:', msg);
      throw new Error(`Window capture failed: ${msg}`);
    }

    const appLower = targetApp.toLowerCase();
    const source = sources.find(s => s.name.toLowerCase().includes(appLower));
    if (!source) {
      console.warn(tag, `No window found matching "${targetApp}". Available:`,
        sources.map(s => s.name).join(', '));
      return this.captureScreen(targetWidth);
    }

    const thumb = source.thumbnail;
    if (thumb.isEmpty()) {
      console.warn(tag, `Window thumbnail empty for "${targetApp}", falling back to screen`);
      return this.captureScreen(targetWidth);
    }

    const { width: cw, height: ch } = thumb.getSize();
    const outW = Math.min(targetWidth, cw);
    const outH = Math.max(1, Math.round(ch * (outW / cw)));
    const resized = thumb.resize({ width: outW, height: outH, quality: 'good' });

    const jpegBuffer = resized.toJPEG(this.jpegQuality);
    const buf = Buffer.from(jpegBuffer);
    console.log(tag, 'WindowShot:', buf.length, 'bytes (JPEG q' + this.jpegQuality + ',', outW + 'px,', source.name + ')');
    return buf.toString('base64');
  }

  /* ─── Window-scoped Action Execution (AppleScript for keys, mutex for clicks) ─ */

  private async executeWindowAction(
    action: ComputerAction,
    coordScale: number,
    targetApp: string,
    inputMutex: InputMutex | undefined,
    tag: string,
  ): Promise<void> {
    console.log(tag, 'Action:', action.action, JSON.stringify(action));

    if (action.action === 'type' && action.text) {
      await appKeystroke(targetApp, action.text);
      return;
    }

    if (action.action === 'key' && action.text) {
      await this.pressKeyForApp(action.text, targetApp);
      return;
    }

    if (inputMutex) await inputMutex.acquire();
    try {
      await activateApp(targetApp);
      await this.executeAction(action, coordScale);
    } finally {
      if (inputMutex) inputMutex.release();
    }
  }

  /* ─── Per-app key press via AppleScript ────────────────── */

  private async pressKeyForApp(key: string, appName: string): Promise<void> {
    const combo = key.split('+').map(k => k.trim());

    if (combo.length === 1) {
      await appSpecialKey(appName, combo[0]);
      return;
    }

    const modifiers: string[] = [];
    let mainKey = '';

    for (const part of combo) {
      const lower = part.toLowerCase();
      if (['cmd', 'command', 'super', 'meta'].includes(lower)) {
        modifiers.push('command');
      } else if (['ctrl', 'control'].includes(lower)) {
        modifiers.push('control');
      } else if (['alt', 'option'].includes(lower)) {
        modifiers.push('option');
      } else if (lower === 'shift') {
        modifiers.push('shift');
      } else {
        mainKey = part;
      }
    }

    if (!mainKey) return;
    await appKeyCombo(appName, mainKey, modifiers);
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
