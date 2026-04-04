/* ═══════════════════════════════════════════════════════════
   Virtual Display Agent — Professional-grade multi-app desktop
   automation without touching the user's screen.

   Each agent gets its own invisible virtual monitor and can
   open, switch between, and control MULTIPLE apps as part of
   a single task. The agent has two tools:

   1. computer — Claude's standard vision-based computer control
      (screenshot, click, type, key, scroll, drag)

   2. app_manager — opens new apps, switches between them, and
      lists what's running on the agent's virtual display

   The user's physical screen, cursor, and keyboard are never
   touched. Multiple agents run truly in parallel on separate
   virtual displays.
   ═══════════════════════════════════════════════════════════ */

import { VirtualDisplayManager, type VirtualDisplay } from './virtualDisplayManager.js';
import { appKeystroke, appKeyCombo, appSpecialKey } from './inputMutex.js';
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

export interface VDAgentStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'status';
  content?: string;
  screenshot?: string;
  timestamp: string;
}

export interface VDAgentCallbacks {
  executionId: string;
  goal: string;
  apps?: string[];
  maxTurns?: number;
  onStep: (step: VDAgentStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string) => void;
  onError: (error: Error) => void;
}

const TARGET_WIDTH = 1280;
const TARGET_HEIGHT = 900;

/* ─── Per-agent state for tracking apps on this display ─── */

interface AgentDisplayState {
  display: VirtualDisplay;
  openApps: Set<string>;
  activeApp: string | null;
}

export class VirtualDisplayAgent {
  private displayManager: VirtualDisplayManager;
  private abortControllers = new Map<string, AbortController>();
  private agentStates = new Map<string, AgentDisplayState>();

  constructor(displayManager: VirtualDisplayManager) {
    this.displayManager = displayManager;
  }

  async execute(cb: VDAgentCallbacks): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(cb.executionId, controller);

    let display: VirtualDisplay | null = null;

    try {
      cb.onStep({
        type: 'status',
        content: 'Creating virtual display...',
        timestamp: new Date().toISOString(),
      });

      display = await this.displayManager.createDisplay({
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        name: `Agent ${cb.executionId}`,
      });

      const state: AgentDisplayState = {
        display,
        openApps: new Set(),
        activeApp: null,
      };
      this.agentStates.set(cb.executionId, state);

      cb.onStep({
        type: 'status',
        content: `Virtual display ready (${display.width}x${display.height} at offset ${display.bounds.x})`,
        timestamp: new Date().toISOString(),
      });

      // Pre-open requested apps and move them to the virtual display
      if (cb.apps && cb.apps.length > 0) {
        for (const appName of cb.apps) {
          await this.openAppOnDisplay(appName, state, cb);
        }
      }

      await this.runAgentLoop(cb, state, controller);

    } catch (err: any) {
      if (!controller.signal.aborted) {
        cb.onError(err);
      }
    } finally {
      if (display) {
        try { await this.displayManager.destroyDisplay(display.displayId); } catch {}
      }
      this.agentStates.delete(cb.executionId);
      this.abortControllers.delete(cb.executionId);
    }
  }

  /* ─── Open an app and move it to this agent's virtual display ─── */

  private async openAppOnDisplay(
    appName: string,
    state: AgentDisplayState,
    cb: VDAgentCallbacks,
  ): Promise<void> {
    cb.onStep({
      type: 'status',
      content: `Opening ${appName}...`,
      timestamp: new Date().toISOString(),
    });

    await this.displayManager.openApp(appName, { hide: true });
    await this.displayManager.moveWindowToDisplay(appName, state.display);
    state.openApps.add(appName);
    state.activeApp = appName;

    cb.onStep({
      type: 'status',
      content: `${appName} is now on the virtual display`,
      timestamp: new Date().toISOString(),
    });
  }

  /* ─── Bring an already-open app to front on this display ─── */

  private async switchToApp(
    appName: string,
    state: AgentDisplayState,
  ): Promise<void> {
    if (!state.openApps.has(appName)) {
      await this.displayManager.openApp(appName, { hide: true });
      await this.displayManager.moveWindowToDisplay(appName, state.display);
      state.openApps.add(appName);
    }
    state.activeApp = appName;
    // Move this app's window to the front of the virtual display
    await this.displayManager.moveWindowToDisplay(appName, state.display);
  }

  /* ─── The agent loop: computer_use + app_manager tools ─── */

  private async runAgentLoop(
    cb: VDAgentCallbacks,
    state: AgentDisplayState,
    controller: AbortController,
  ): Promise<void> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();

    const maxTurns = cb.maxTurns || 40;
    const messages: any[] = [{ role: 'user', content: cb.goal }];

    const appsContext = state.openApps.size > 0
      ? `The following apps are already open on your display: ${[...state.openApps].join(', ')}.`
      : 'No apps are open yet. Use the app_manager tool to open any apps you need.';

    // Detect expertise from open apps or from the goal
    let primaryExpertise: AppExpertiseProfile | null = null;
    for (const app of state.openApps) {
      primaryExpertise = getAppExpertise(app);
      if (primaryExpertise) break;
    }
    if (!primaryExpertise) {
      primaryExpertise = findExpertiseFromGoal(cb.goal);
    }

    const basePrompt = `You are an expert macOS automation agent with your own dedicated display.
The user CANNOT see your display and you CANNOT affect their screen. You have full, unrestricted control.

${appsContext}

YOU CAN USE MULTIPLE APPS. If the task requires it, open additional apps using the app_manager tool.
Think about what apps and steps you need BEFORE starting. For example:
- "Research flights and note the prices" → open Safari + Notes
- "Calculate expenses and email the total" → open Calculator + Mail
- "Look up a contact and schedule a meeting" → open Contacts + Calendar
- "Check today's reminders and add to calendar" → open Reminders + Calendar

WORKFLOW:
1. Read the user's goal carefully. Think about which apps and steps are needed.
2. Open the apps you need using app_manager (if not already open).
3. Work through the task step by step using the computer tool.
4. Switch between apps as needed using app_manager.
5. When done, clearly state what you accomplished and any results.

RULES:
1. Prefer keyboard shortcuts over mouse clicks for speed.
2. Coordinates are relative to your ${TARGET_WIDTH}x${TARGET_HEIGHT} display (0,0 = top-left).
3. Be efficient. Don't repeat failed actions more than twice.
4. You can open ANY macOS app — Calculator, Notes, Safari, Mail, Calendar, Terminal, Finder, etc.
5. When switching between apps, use the app_manager tool — do NOT use Cmd+Tab or Spotlight.

ENVIRONMENT: macOS, ${TARGET_WIDTH}x${TARGET_HEIGHT} display.`;

    const systemPrompt = primaryExpertise
      ? buildExpertiseSystemPrompt(primaryExpertise.appName, basePrompt, cb.goal)
      : `${basePrompt}\nGOAL: ${cb.goal}`;

    // For professional apps, generate a workflow plan
    let finalSystemPrompt = systemPrompt;
    if (primaryExpertise) {
      console.log(`[VD-Agent] Professional mode: ${primaryExpertise.role} (${primaryExpertise.appName})`);

      cb.onStep({
        type: 'thinking',
        content: `Planning professional ${primaryExpertise.role} workflow...`,
        timestamp: new Date().toISOString(),
      });

      try {
        const plan = await generateWorkflowPlan(
          primaryExpertise.appName,
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
          finalSystemPrompt = `${systemPrompt}\n${planToPromptContext(plan)}`;
          cb.onStep({
            type: 'thinking',
            content: `Workflow plan: ${plan.steps.length} steps. Tools: ${plan.requiredTools.join(', ')}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('[VD-Agent] Workflow planning failed, proceeding without plan:', e);
      }
    }

    // Two tools: computer_use for screen interaction, app_manager for opening/switching apps
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
        description: `Manage apps on your virtual display. Actions:
- "open": Open a new app and bring it to the front. Provide "app_name".
- "switch": Bring an already-open app to the front. Provide "app_name".
- "list": List all apps currently open on your display. No parameters needed.
- "close": Close an app. Provide "app_name".`,
        input_schema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['open', 'switch', 'list', 'close'],
              description: 'The action to perform',
            },
            app_name: {
              type: 'string',
              description: 'Name of the app (e.g., "Calculator", "Notes", "Safari")',
            },
          },
          required: ['action'],
        },
      },
    ];

    let turn = 0;

    while (turn < maxTurns && !controller.signal.aborted) {
      turn++;
      cb.onStep({
        type: 'thinking',
        content: `Turn ${turn}/${maxTurns}`,
        timestamp: new Date().toISOString(),
      });

      // Prune old screenshots to save tokens
      for (let i = 0; i < messages.length - 4; i++) {
        const msg = messages[i];
        if (msg.role !== 'user' || !Array.isArray(msg.content)) continue;
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
          cb.onStep({
            type: 'thinking',
            content: block.text,
            timestamp: new Date().toISOString(),
          });
        }

        if (block.type === 'tool_use') {
          hasToolUse = true;

          if (block.name === 'app_manager') {
            // Handle app management tool
            const result = await this.handleAppManager(block.input as any, state, cb);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });

          } else {
            // Handle computer_use tool
            const action = block.input as any;
            try {
              await this.executeAction(action, state, cb);

              await new Promise(r => setTimeout(r, 150));
              const capture = await this.displayManager.captureDisplay(state.display.displayId, 0.5);
              cb.onScreenshot(`data:image/jpeg;base64,${capture.base64}`);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: [{
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: capture.base64 },
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

    if (turn >= maxTurns) {
      cb.onComplete(`Reached max turns (${maxTurns}). Task may be partially complete.`);
    }
  }

  /* ─── app_manager tool handler ──────────────────────────── */

  private async handleAppManager(
    input: { action: string; app_name?: string },
    state: AgentDisplayState,
    cb: VDAgentCallbacks,
  ): Promise<string> {
    switch (input.action) {
      case 'open': {
        if (!input.app_name) return 'Error: app_name is required for "open"';
        try {
          await this.openAppOnDisplay(input.app_name, state, cb);
          return `Opened "${input.app_name}" on your display. It is now the active app.`;
        } catch (err: any) {
          return `Failed to open "${input.app_name}": ${err.message}`;
        }
      }

      case 'switch': {
        if (!input.app_name) return 'Error: app_name is required for "switch"';
        try {
          await this.switchToApp(input.app_name, state);
          cb.onStep({
            type: 'action',
            content: `Switched to ${input.app_name}`,
            timestamp: new Date().toISOString(),
          });
          return `Switched to "${input.app_name}". It is now the active app on your display.`;
        } catch (err: any) {
          return `Failed to switch to "${input.app_name}": ${err.message}`;
        }
      }

      case 'list': {
        const apps = [...state.openApps];
        if (apps.length === 0) return 'No apps are open on your display.';
        const lines = apps.map(a =>
          a === state.activeApp ? `• ${a} (active)` : `• ${a}`
        );
        return `Apps on your display:\n${lines.join('\n')}`;
      }

      case 'close': {
        if (!input.app_name) return 'Error: app_name is required for "close"';
        try {
          await execAsync(
            `osascript -e 'tell application "${input.app_name}" to quit'`,
            { timeout: 5000 }
          );
          state.openApps.delete(input.app_name);
          if (state.activeApp === input.app_name) {
            state.activeApp = state.openApps.size > 0
              ? [...state.openApps][state.openApps.size - 1]
              : null;
          }
          cb.onStep({
            type: 'action',
            content: `Closed ${input.app_name}`,
            timestamp: new Date().toISOString(),
          });
          return `Closed "${input.app_name}".`;
        } catch (err: any) {
          return `Failed to close "${input.app_name}": ${err.message}`;
        }
      }

      default:
        return `Unknown action: "${input.action}". Use "open", "switch", "list", or "close".`;
    }
  }

  /* ─── Execute a computer_use action on the virtual display ─ */

  private async executeAction(
    action: any,
    state: AgentDisplayState,
    cb: VDAgentCallbacks,
  ): Promise<void> {
    const bounds = state.display.bounds;

    const toGlobal = (x: number, y: number): [number, number] => [
      bounds.x + x,
      bounds.y + y,
    ];

    switch (action.action) {
      case 'screenshot':
      case 'cursor_position':
        break;

      case 'left_click': {
        if (!action.coordinate) break;
        const [gx, gy] = toGlobal(action.coordinate[0], action.coordinate[1]);
        cb.onStep({ type: 'action', content: `Click at (${action.coordinate[0]}, ${action.coordinate[1]})`, timestamp: new Date().toISOString() });
        await this.displayManager.click(gx, gy);
        await this.updateActiveAppFromClick(state);
        break;
      }

      case 'right_click': {
        if (!action.coordinate) break;
        const [gx, gy] = toGlobal(action.coordinate[0], action.coordinate[1]);
        cb.onStep({ type: 'action', content: `Right-click at (${action.coordinate[0]}, ${action.coordinate[1]})`, timestamp: new Date().toISOString() });
        await this.displayManager.rightClick(gx, gy);
        await this.updateActiveAppFromClick(state);
        break;
      }

      case 'double_click': {
        if (!action.coordinate) break;
        const [gx, gy] = toGlobal(action.coordinate[0], action.coordinate[1]);
        cb.onStep({ type: 'action', content: `Double-click at (${action.coordinate[0]}, ${action.coordinate[1]})`, timestamp: new Date().toISOString() });
        await this.displayManager.doubleClick(gx, gy);
        await this.updateActiveAppFromClick(state);
        break;
      }

      case 'triple_click':
      case 'middle_click': {
        if (!action.coordinate) break;
        const [gx, gy] = toGlobal(action.coordinate[0], action.coordinate[1]);
        const count = action.action === 'triple_click' ? 3 : 1;
        cb.onStep({ type: 'action', content: `${action.action} at (${action.coordinate[0]}, ${action.coordinate[1]})`, timestamp: new Date().toISOString() });
        await this.displayManager.click(gx, gy, { count });
        await this.updateActiveAppFromClick(state);
        break;
      }

      case 'mouse_move': {
        if (!action.coordinate) break;
        const [gx, gy] = toGlobal(action.coordinate[0], action.coordinate[1]);
        await this.displayManager.click(gx, gy, { count: 0 });
        break;
      }

      case 'left_click_drag': {
        if (!action.start_coordinate || !action.coordinate) break;
        const [sx, sy] = toGlobal(action.start_coordinate[0], action.start_coordinate[1]);
        const [ex, ey] = toGlobal(action.coordinate[0], action.coordinate[1]);
        cb.onStep({ type: 'action', content: `Drag (${action.start_coordinate.join(',')}) → (${action.coordinate.join(',')})`, timestamp: new Date().toISOString() });
        await this.displayManager.drag(sx, sy, ex, ey);
        break;
      }

      case 'scroll': {
        const dir = action.scroll_direction || 'down';
        const amount = action.scroll_amount || 3;
        const [sx, sy] = action.coordinate
          ? toGlobal(action.coordinate[0], action.coordinate[1])
          : toGlobal(TARGET_WIDTH / 2, TARGET_HEIGHT / 2);

        const dy = dir === 'up' ? amount * 30 : dir === 'down' ? -amount * 30 : 0;
        const dx = dir === 'left' ? amount * 30 : dir === 'right' ? -amount * 30 : 0;
        cb.onStep({ type: 'action', content: `Scroll ${dir} x${amount}`, timestamp: new Date().toISOString() });
        await this.displayManager.scroll(sx, sy, dy, dx);
        break;
      }

      case 'type': {
        if (!action.text) break;
        cb.onStep({ type: 'action', content: `Type: "${action.text.slice(0, 50)}"`, timestamp: new Date().toISOString() });
        if (state.activeApp) {
          await appKeystroke(state.activeApp, action.text);
        } else {
          const escaped = action.text.replace(/'/g, "'\\''").replace(/"/g, '\\"');
          await execAsync(
            `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`,
            { timeout: 5000 }
          );
        }
        break;
      }

      case 'key': {
        if (!action.text) break;
        cb.onStep({ type: 'action', content: `Key: ${action.text}`, timestamp: new Date().toISOString() });
        await this.pressKey(action.text, state.activeApp);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }

  /* ─── After a click, figure out which app now has focus ──── */

  private async updateActiveAppFromClick(state: AgentDisplayState): Promise<void> {
    try {
      const { stdout } = await execAsync(
        `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`,
        { timeout: 3000 }
      );
      const frontApp = stdout.trim();
      if (state.openApps.has(frontApp)) {
        state.activeApp = frontApp;
      }
    } catch {
      // Best effort — don't fail the action if we can't detect
    }
  }

  /* ─── Send a key combo to the active app ────────────────── */

  private async pressKey(key: string, activeApp: string | null): Promise<void> {
    const combo = key.split('+').map(k => k.trim());

    if (activeApp) {
      if (combo.length === 1) {
        await appSpecialKey(activeApp, combo[0]);
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
        if (mainKey) await appKeyCombo(activeApp, mainKey, mods);
      }
    } else {
      await execAsync(
        `osascript -e 'tell application "System Events" to key code 0'`,
        { timeout: 5000 }
      );
    }
  }

  cancel(executionId: string): void {
    const controller = this.abortControllers.get(executionId);
    controller?.abort();
  }
}
