/* ═══════════════════════════════════════════════════════════
   Vision Agent — AI-Powered Screen Understanding & Control

   Runs headless Puppeteer. Session state (screenshots, logs)
   is stored in memory and the frontend polls for updates.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../config.js';
import { BrowserService } from './browser.service.js';

/* ─── Types ──────────────────────────────────────────────── */

export interface VisionAction {
  action: 'click' | 'type' | 'scroll' | 'press_key' | 'wait' | 'navigate' | 'done' | 'fail';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  url?: string;
  direction?: 'up' | 'down';
  pixels?: number;
  waitMs?: number;
  reason: string;
  extractedData?: any;
}

export interface VisionStep {
  step: number;
  action: VisionAction;
  screenshot?: string;
  url?: string;
  title?: string;
  timestamp: string;
}

export interface VisionAgentResult {
  success: boolean;
  task: string;
  steps: VisionStep[];
  extractedData: any;
  totalSteps: number;
  durationMs: number;
  error?: string;
  finalScreenshot?: string;
  finalUrl?: string;
}

/* ─── Session State (polled by frontend) ─────────────────── */

export interface SessionLogEntry {
  type: string;
  step?: number;
  action?: VisionAction;
  message: string;
  url?: string;
  title?: string;
  timestamp: string;
}

export interface VisionSessionState {
  screenshot: string | null;
  logs: SessionLogEntry[];
  status: 'running' | 'done' | 'error';
  extractedData: any;
  currentUrl: string;
  currentTitle: string;
  progress: number;
  totalSteps: number;
  error?: string;
  lastUpdated: number;
}

const sessionStates = new Map<string, VisionSessionState>();

export function getSessionState(sessionId: string): VisionSessionState | null {
  return sessionStates.get(sessionId) || null;
}

export function getLatestScreenshot(sessionId: string): string | null {
  return sessionStates.get(sessionId)?.screenshot || null;
}

function getOrCreateState(sid: string): VisionSessionState {
  let state = sessionStates.get(sid);
  if (!state) {
    state = {
      screenshot: null,
      logs: [],
      status: 'running',
      extractedData: null,
      currentUrl: '',
      currentTitle: '',
      progress: 0,
      totalSteps: 25,
      lastUpdated: Date.now(),
    };
    sessionStates.set(sid, state);
  }
  return state;
}

function log(sid: string, entry: Omit<SessionLogEntry, 'timestamp'>) {
  const state = sessionStates.get(sid);
  if (state) {
    state.logs.push({ ...entry, timestamp: new Date().toISOString() });
    state.lastUpdated = Date.now();
  }
}

/* ─── OpenAI Client ──────────────────────────────────────── */

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/* ─── System Prompt ──────────────────────────────────────── */

const VISION_SYSTEM_PROMPT = `You are an AI agent that controls a web browser by looking at screenshots. You help users accomplish tasks on websites by analyzing what's on the screen and deciding what to do next.

You receive a screenshot of the current browser state and a task description. You must return a JSON object with the next action to take.

AVAILABLE ACTIONS:
- click: Click at coordinates {x, y}. Use when you need to click a button, link, menu item, or any element.
- type: Type text. Use after clicking on an input field. Include the text to type.
- scroll: Scroll the page. Specify direction ("up" or "down") and pixels (default 500).
- press_key: Press a keyboard key (e.g. "Enter", "Tab", "Escape", "Backspace").
- navigate: Go to a URL directly.
- wait: Wait for the page to update (specify waitMs, default 2000).
- done: Task is complete. Include extractedData with any data collected.
- fail: Task cannot be completed. Include reason.

COORDINATE SYSTEM:
- The screenshot is 1280x900 pixels.
- {x: 0, y: 0} is the top-left corner.
- Click coordinates should target the CENTER of the element you want to interact with.
- Be precise with coordinates — estimate where the center of buttons, links, and text fields are.

NAVIGATION TIPS:
- If you know a direct URL to the content (e.g. apple.com/mac, amazon.com/s?k=laptops), use "navigate" — it's faster than clicking through menus.
- For well-known sites, construct URLs directly: apple.com/shop/buy-mac/macbook-pro, etc.
- If a navigation click doesn't work (page didn't change), try "navigate" to the URL instead.

RULES:
1. Always analyze the screenshot carefully before deciding on an action.
2. Look for the specific elements mentioned in the task.
3. If a page is loading or appears blank/partially rendered, use "wait" (waitMs: 3000).
4. If you need to scroll to find content, use "scroll" action.
5. After clicking a link or button, the page may change — analyze the new screenshot.
6. When extracting data, collect it progressively and return it all in the "done" action.
7. Be patient — complex sites may need multiple scroll/click/wait cycles.
8. If you see a cookie consent banner or popup, dismiss it first.
9. If the page has navigation menus, use them to find the right section.
10. Maximum 25 steps per task — be efficient.
11. Prefer "navigate" over clicking when you know the target URL — it's faster and more reliable.
12. Read the visible text carefully — prices, product names, and data may already be visible.
13. If the same screenshot appears twice in a row, try a different approach (different click location, scroll, or navigate).

RESPONSE FORMAT (return ONLY valid JSON, no markdown):
{
  "action": "click" | "type" | "scroll" | "press_key" | "navigate" | "wait" | "done" | "fail",
  "x": number (for click),
  "y": number (for click),
  "text": "string" (for type),
  "key": "string" (for press_key),
  "url": "string" (for navigate),
  "direction": "up" | "down" (for scroll),
  "pixels": number (for scroll, default 500),
  "waitMs": number (for wait, default 2000),
  "reason": "Brief explanation of what you're doing and why",
  "extractedData": {} (for done - all collected data)
}`;

const MAX_STEPS = 25;

/* ─── Main Agent ─────────────────────────────────────────── */

export class VisionAgent {

  /**
   * Start a vision task in the background. Returns the sessionId.
   * Frontend polls getSessionState() for updates.
   */
  static startTask(task: string, startUrl: string, sessionId: string): string {
    const sid = sessionId;
    getOrCreateState(sid);
    log(sid, { type: 'status', message: 'Starting browser session...' });

    // Run in background (don't await)
    this.runTask(sid, task, startUrl).catch(err => {
      console.error(`[VisionAgent] Background task error:`, err);
      const state = sessionStates.get(sid);
      if (state) {
        state.status = 'error';
        state.error = err.message;
        log(sid, { type: 'error', message: err.message });
      }
    });

    return sid;
  }

  private static async runTask(sid: string, task: string, startUrl: string): Promise<void> {
    const openai = getOpenAI();
    const state = sessionStates.get(sid)!;
    const steps: VisionStep[] = [];

    console.log(`\n[VisionAgent] Starting task: "${task}"`);
    console.log(`   URL: ${startUrl}`);

    try {
      await BrowserService.createSession(sid, { headless: true, width: 1280, height: 900 });
      log(sid, { type: 'status', message: `Navigating to ${startUrl}...` });
      state.currentUrl = startUrl;

      const navResult = await BrowserService.navigate(sid, startUrl, { waitUntil: 'domcontentloaded' });
      if (!navResult.success) throw new Error(`Failed to navigate: ${navResult.error}`);

      state.currentUrl = navResult.url || startUrl;
      state.currentTitle = navResult.title || '';
      console.log(`   Navigated to: ${navResult.url}`);

      await new Promise(r => setTimeout(r, 3000));

      // Initial screenshot
      const initSS = await BrowserService.screenshot(sid, { fullPage: false });
      const initShot = initSS.screenshot || initSS.data?.screenshot;
      if (initShot) state.screenshot = initShot;

      // Agent loop
      let consecutiveSameUrl = 0;
      let lastUrl = navResult.url || startUrl;

      for (let step = 1; step <= MAX_STEPS; step++) {
        const ssResult = await BrowserService.screenshot(sid, { fullPage: false });
        const screenshot = ssResult.screenshot || ssResult.data?.screenshot;
        if (!ssResult.success || !screenshot) throw new Error('Failed to take screenshot');

        state.screenshot = screenshot;
        state.progress = step;

        const pageText = await BrowserService.getPageText(sid);
        const visibleText = (pageText.data?.text || '').substring(0, 5000);
        const pageCtx = pageText.success
          ? `Current URL: ${pageText.data?.url || 'unknown'}\nPage Title: ${pageText.data?.title || 'unknown'}\nVisible Text (first 5000 chars):\n${visibleText}`
          : '';

        const currentPageUrl = pageText.data?.url || state.currentUrl;
        state.currentUrl = currentPageUrl;
        state.currentTitle = pageText.data?.title || state.currentTitle;

        // Track if clicks are actually navigating
        if (currentPageUrl === lastUrl && step > 1) {
          consecutiveSameUrl++;
        } else {
          consecutiveSameUrl = 0;
          lastUrl = currentPageUrl;
        }

        log(sid, { type: 'thinking', step, message: `Analyzing page (step ${step}/${MAX_STEPS})...` });

        let action = await this.getNextAction(openai, task, screenshot, pageCtx, steps, step);

        // Code-level stuck recovery: if 4+ clicks haven't changed the URL, force a navigate
        if (consecutiveSameUrl >= 4 && action.action === 'click') {
          console.log(`   [Recovery] Agent stuck on ${currentPageUrl} after ${consecutiveSameUrl} clicks — forcing navigate`);
          log(sid, { type: 'status', step, message: `Auto-recovery: clicks not navigating, trying direct URL...` });

          // Ask GPT-4o specifically for a navigate action
          action = await this.getRecoveryAction(openai, task, pageCtx, steps);
        }

        steps.push({ step, action, url: currentPageUrl, title: pageText.data?.title, timestamp: new Date().toISOString() });
        console.log(`   Step ${step}: ${action.action} — ${action.reason}`);

        log(sid, { type: 'step', step, action, message: action.reason || action.action, url: currentPageUrl, title: pageText.data?.title });

        if (action.action === 'done') {
          state.extractedData = action.extractedData || null;
          state.status = 'done';
          log(sid, { type: 'done', step, message: `Task completed in ${step} steps` });
          console.log(`   Task complete in ${step} steps`);
          break;
        }

        if (action.action === 'fail') {
          state.status = 'error';
          state.error = action.reason;
          log(sid, { type: 'error', step, message: action.reason });
          break;
        }

        await this.executeAction(sid, action);
        await new Promise(r => setTimeout(r, 800));

        // Screenshot after action
        const postSS = await BrowserService.screenshot(sid, { fullPage: false });
        const postShot = postSS.screenshot || postSS.data?.screenshot;
        if (postShot) state.screenshot = postShot;
      }

      if (state.status === 'running') {
        state.status = 'done';
        log(sid, { type: 'done', message: `Reached max steps (${MAX_STEPS})` });
      }

    } catch (err: any) {
      console.error(`   [VisionAgent] Error: ${err.message}`);
      state.status = 'error';
      state.error = err.message;
      log(sid, { type: 'error', message: err.message });
    } finally {
      try { await BrowserService.closeSession(sid); } catch { /* ignore */ }
      // Clean up state after 60s
      setTimeout(() => sessionStates.delete(sid), 60_000);
    }
  }

  /**
   * Non-streaming executeTask (for server-side agent executor).
   */
  static async executeTask(
    task: string,
    startUrl: string,
    sessionId?: string,
    _onEvent?: any,
  ): Promise<VisionAgentResult> {
    const sid = sessionId || `vision-${Date.now()}`;
    const startTime = Date.now();

    this.startTask(task, startUrl, sid);

    // Wait for completion by polling the state
    while (true) {
      await new Promise(r => setTimeout(r, 1000));
      const state = sessionStates.get(sid);
      if (!state || state.status !== 'running') break;
      if (Date.now() - startTime > 120_000) break; // 2 min timeout
    }

    const state = sessionStates.get(sid);
    return {
      success: state?.status === 'done',
      task,
      steps: [],
      extractedData: state?.extractedData || null,
      totalSteps: state?.progress || 0,
      durationMs: Date.now() - startTime,
      error: state?.error,
      finalUrl: state?.currentUrl,
    };
  }

  private static async getNextAction(
    openai: OpenAI,
    task: string,
    screenshotBase64: string,
    pageContext: string,
    previousSteps: VisionStep[],
    currentStep: number,
  ): Promise<VisionAction> {
    const stepsRemaining = MAX_STEPS - currentStep;
    const historyStr = previousSteps.length > 0
      ? `\nPREVIOUS ACTIONS (with result URL):\n${previousSteps.slice(-8).map(s => {
          let detail = `  Step ${s.step}: ${s.action.action}`;
          if (s.action.action === 'click') detail += ` at (${s.action.x}, ${s.action.y})`;
          if (s.action.action === 'type') detail += ` "${s.action.text}"`;
          if (s.action.action === 'navigate') detail += ` to ${s.action.url}`;
          detail += ` — ${s.action.reason}`;
          if (s.url) detail += ` → landed on: ${s.url}`;
          return detail;
        }).join('\n')}`
      : '';

    // Detect repeating actions
    const lastThree = previousSteps.slice(-3);
    const isStuck = lastThree.length === 3 && lastThree.every(s =>
      s.action.action === lastThree[0].action.action && s.action.reason === lastThree[0].action.reason
    );
    const stuckWarning = isStuck
      ? `\n\nWARNING: You have repeated the same action 3 times and it is NOT working. You MUST try a completely different approach. Use "navigate" to go directly to a URL, or try clicking at different coordinates, or try scrolling.`
      : '';

    const userPrompt = `TASK: ${task}\n\nCURRENT STATE:\n${pageContext}\n\nStep ${currentStep} of ${MAX_STEPS} (${stepsRemaining} steps remaining).${historyStr}${stuckWarning}\n\nAnalyze the screenshot and decide the next action. Return ONLY valid JSON.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshotBase64}`, detail: 'high' } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '';
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned) as VisionAction;
    } catch (err: any) {
      console.error(`   [VisionAgent] AI error at step ${currentStep}:`, err.message);
      return { action: 'fail', reason: `AI analysis failed: ${err.message}` };
    }
  }

  /**
   * When the agent is stuck (clicks not navigating), ask for a URL-based recovery.
   */
  private static async getRecoveryAction(
    openai: OpenAI,
    task: string,
    pageContext: string,
    previousSteps: VisionStep[],
  ): Promise<VisionAction> {
    const lastActions = previousSteps.slice(-5).map(s =>
      `  ${s.action.action}${s.action.action === 'click' ? ` at (${s.action.x},${s.action.y})` : ''} → ${s.url || 'same page'}`
    ).join('\n');

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a web navigation recovery agent. The main agent has been clicking on page elements but the page URL hasn't changed — the clicks aren't working.

Your job: suggest a DIRECT URL to navigate to that will accomplish the task. 
Think about what URL would contain the needed content. For well-known sites, construct the URL.

Examples:
- apple.com MacBook prices → https://www.apple.com/shop/buy-mac
- amazon.com laptop search → https://www.amazon.com/s?k=laptops
- wikipedia article about AI → https://en.wikipedia.org/wiki/Artificial_intelligence

Return ONLY valid JSON: {"action":"navigate","url":"https://...","reason":"Direct navigation to..."}`,
          },
          {
            role: 'user',
            content: `TASK: ${task}\n\nCURRENT PAGE:\n${pageContext}\n\nFAILED CLICKS:\n${lastActions}\n\nSuggest a direct URL to navigate to. Return ONLY JSON.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || '';
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      return JSON.parse(cleaned) as VisionAction;
    } catch {
      return { action: 'scroll', direction: 'down', pixels: 800, reason: 'Recovery: scrolling to find content' };
    }
  }

  private static async executeAction(sessionId: string, action: VisionAction): Promise<void> {
    switch (action.action) {
      case 'click':
        if (action.x !== undefined && action.y !== undefined) await BrowserService.clickAt(sessionId, action.x, action.y);
        break;
      case 'type':
        if (action.text) await BrowserService.typeText(sessionId, action.text, { pressEnter: false });
        break;
      case 'scroll':
        await BrowserService.scroll(sessionId, action.direction || 'down', action.pixels || 500);
        break;
      case 'press_key':
        if (action.key) await BrowserService.pressKey(sessionId, action.key);
        break;
      case 'navigate':
        if (action.url) {
          await BrowserService.navigate(sessionId, action.url, { waitUntil: 'domcontentloaded' });
          await new Promise(r => setTimeout(r, 2000));
        }
        break;
      case 'wait':
        await new Promise(r => setTimeout(r, Math.min(action.waitMs || 2000, 10000)));
        break;
    }
  }

  static async executeDesktopTask(task: string, appName?: string, _onEvent?: any): Promise<VisionAgentResult> {
    const openai = getOpenAI();
    const startTime = Date.now();
    const steps: VisionStep[] = [];
    let extractedData: any = null;

    try {
      if (appName) {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        await promisify(exec)(`osascript -e 'tell application "${appName}" to activate'`);
        await new Promise(r => setTimeout(r, 2000));
      }

      for (let step = 1; step <= MAX_STEPS; step++) {
        const screenshot = await this.captureDesktopScreenshot();
        const action = await this.getNextAction(openai, task, screenshot, `Desktop. App: ${appName || 'none'}`, steps, step);
        steps.push({ step, action, timestamp: new Date().toISOString() });

        if (action.action === 'done') { extractedData = action.extractedData; break; }
        if (action.action === 'fail') break;

        await this.executeDesktopAction(action);
        await new Promise(r => setTimeout(r, 800));
      }

      return { success: !!extractedData, task, steps, extractedData, totalSteps: steps.length, durationMs: Date.now() - startTime };
    } catch (err: any) {
      return { success: false, task, steps, extractedData: null, totalSteps: steps.length, durationMs: Date.now() - startTime, error: err.message };
    }
  }

  private static async captureDesktopScreenshot(): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFileSync, unlinkSync } = await import('fs');
    const tmpPath = `/tmp/gbeta-desktop-${Date.now()}.png`;
    await promisify(exec)(`screencapture -x ${tmpPath}`);
    const buffer = readFileSync(tmpPath);
    unlinkSync(tmpPath);
    return buffer.toString('base64');
  }

  private static async executeDesktopAction(action: VisionAction): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    switch (action.action) {
      case 'click':
        if (action.x !== undefined && action.y !== undefined) {
          try { await execAsync(`cliclick c:${action.x},${action.y}`); }
          catch { await execAsync(`osascript -e 'tell application "System Events" to click at {${action.x}, ${action.y}}'`); }
        }
        break;
      case 'type':
        if (action.text) await execAsync(`osascript -e 'tell application "System Events" to keystroke "${action.text.replace(/"/g, '\\"')}"'`);
        break;
      case 'press_key':
        if (action.key) {
          const keyMap: Record<string, string> = { Enter: 'return', Tab: 'tab', Escape: 'escape', Backspace: 'delete', Space: 'space' };
          const k = keyMap[action.key] || action.key.toLowerCase();
          await execAsync(`osascript -e 'tell application "System Events" to keystroke "${k}"'`).catch(() => {});
        }
        break;
      case 'scroll':
        await execAsync(`osascript -e 'tell application "System Events" to scroll area 1 of process (name of first process whose frontmost is true) scroll ${action.direction === 'down' ? -5 : 5}'`).catch(() => {});
        break;
      case 'wait':
        await new Promise(r => setTimeout(r, Math.min(action.waitMs || 2000, 10000)));
        break;
    }
  }
}
