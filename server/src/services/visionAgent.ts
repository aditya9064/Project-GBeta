/* ═══════════════════════════════════════════════════════════
   Vision Agent — AI-Powered Screen Understanding & Control

   Runs headless Puppeteer. Session state (screenshots, logs)
   is stored in memory and the frontend polls for updates.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../config.js';
import { BrowserService } from './browser.service.js';
import { logger } from './logger.js';
import { Memory } from './memory/index.js';

/* ─── Types ──────────────────────────────────────────────── */

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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

const MAX_VISION_SESSIONS = 20;
const sessionStates = new Map<string, VisionSessionState>();

export function getSessionState(sessionId: string): VisionSessionState | null {
  return sessionStates.get(sessionId) || null;
}

/* ─── Desktop Task Runner ────────────────────────────────
   Three isolation modes for desktop agents:

   1. "fullscreen" (default) — Each agent gets a full-size
      window. screencapture -l captures each window's full
      content even when overlapping. Input uses brief focus
      switch (~100ms) via the action mutex.

   2. "spaces" — Each agent runs on a separate macOS Space
      (virtual desktop). Full isolation, no interference.

   3. "docker" — Each agent runs in a Docker container with
      Xvfb virtual display. Complete isolation with its own
      screen, keyboard, and mouse. Best for heavy parallel use.
   ────────────────────────────────────────────────────────── */

export type DesktopIsolationMode = 'fullscreen' | 'spaces' | 'docker';
let currentIsolationMode: DesktopIsolationMode = 'fullscreen';

export function setDesktopIsolationMode(mode: DesktopIsolationMode) { currentIsolationMode = mode; }
export function getDesktopIsolationMode() { return currentIsolationMode; }

const MAX_PARALLEL_DESKTOP = 4;

interface DesktopQueueEntry {
  sessionId: string;
  task: string;
  appName?: string;
  status: 'queued' | 'running' | 'done' | 'error';
  queuedAt: number;
  startedAt?: number;
  position: number;
}

const desktopQueue: DesktopQueueEntry[] = [];

export function getDesktopQueueStatus(): { running: number; queued: number; maxParallel: number; queue: DesktopQueueEntry[] } {
  const running = desktopQueue.filter(e => e.status === 'running').length;
  const queued = desktopQueue.filter(e => e.status === 'queued').length;
  return { running, queued, maxParallel: MAX_PARALLEL_DESKTOP, queue: desktopQueue.filter(e => e.status === 'queued' || e.status === 'running') };
}

async function processDesktopQueue(): Promise<void> {
  const runningCount = desktopQueue.filter(e => e.status === 'running').length;
  if (runningCount >= MAX_PARALLEL_DESKTOP) return;

  const next = desktopQueue.find(e => e.status === 'queued');
  if (!next) return;

  next.status = 'running';
  next.startedAt = Date.now();

  const state = getOrCreateState(next.sessionId);
  const runningNow = desktopQueue.filter(e => e.status === 'running').length;
  const modeLabel = currentIsolationMode === 'docker' ? 'Docker container' : currentIsolationMode === 'spaces' ? 'macOS Space' : 'full-screen window';
  log(next.sessionId, {
    type: 'status',
    message: runningNow > 1
      ? `Desktop task starting in ${modeLabel} mode (${runningNow} agents active, each isolated)`
      : `Desktop task starting (${modeLabel} mode)...`,
  });

  // Run in background — don't block queue processing
  (async () => {
    try {
      const result = currentIsolationMode === 'docker'
        ? await VisionAgent.executeDesktopTaskInDocker(next.task, next.appName, next.sessionId)
        : await VisionAgent.executeDesktopTask(next.task, next.appName, undefined, next.sessionId);
      state.status = result.success ? 'done' : 'error';
      state.extractedData = result.extractedData;
      state.progress = result.totalSteps;
      state.totalSteps = result.totalSteps;
      if (result.error) { state.error = result.error; }
      log(next.sessionId, { type: 'status', message: result.success ? 'Desktop task completed' : `Desktop task failed: ${result.error}` });
      next.status = result.success ? 'done' : 'error';
    } catch (err: any) {
      state.status = 'error';
      state.error = err.message;
      log(next.sessionId, { type: 'error', message: err.message });
      next.status = 'error';
    } finally {
      // Clean up old entries
      const cutoff = Date.now() - 5 * 60 * 1000;
      const toRemove = desktopQueue.filter(e => (e.status === 'done' || e.status === 'error') && (e.startedAt || e.queuedAt) < cutoff);
      toRemove.forEach(e => { const idx = desktopQueue.indexOf(e); if (idx >= 0) desktopQueue.splice(idx, 1); });
      // A slot freed up — process next queued task
      processDesktopQueue();
    }
  })();

  // Try launching more in parallel if slots available
  processDesktopQueue();
}

export function enqueueDesktopTask(sessionId: string, task: string, appName?: string): { position: number; queueLength: number } {
  const entry: DesktopQueueEntry = {
    sessionId,
    task,
    appName,
    status: 'queued',
    queuedAt: Date.now(),
    position: desktopQueue.filter(e => e.status === 'queued').length + 1,
  };
  desktopQueue.push(entry);

  const runningCount = desktopQueue.filter(e => e.status === 'running').length;
  const queuedCount = desktopQueue.filter(e => e.status === 'queued').length;

  if (runningCount >= MAX_PARALLEL_DESKTOP) {
    log(sessionId, { type: 'status', message: `Queued — ${MAX_PARALLEL_DESKTOP} agents already running (max parallel). Your task will start when a slot opens.` });
  }

  processDesktopQueue();
  return { position: entry.position, queueLength: queuedCount };
}

export function getLatestScreenshot(sessionId: string): string | null {
  return sessionStates.get(sessionId)?.screenshot || null;
}

function getOrCreateState(sid: string): VisionSessionState {
  let state = sessionStates.get(sid);
  if (!state) {
    if (sessionStates.size >= MAX_VISION_SESSIONS) {
      const oldest = Array.from(sessionStates.entries()).reduce((a, b) =>
        a[1].lastUpdated < b[1].lastUpdated ? a : b
      );
      sessionStates.delete(oldest[0]);
    }
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

const STEPS_PER_BATCH = 25;
const MAX_STEPS_ABSOLUTE = 100;

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
      logger.error('[VisionAgent] Background task error', { error: err instanceof Error ? err.message : String(err) });
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

    logger.info(`\n[VisionAgent] Starting task: "${task}"`);
    logger.info(`   URL: ${startUrl}`);

    try {
      await BrowserService.createSession(sid, { headless: true, width: 1280, height: 900 });
      log(sid, { type: 'status', message: `Navigating to ${startUrl}...` });
      state.currentUrl = startUrl;

      const navResult = await BrowserService.navigate(sid, startUrl, { waitUntil: 'domcontentloaded' });
      if (!navResult.success) throw new Error(`Failed to navigate: ${navResult.error}`);

      state.currentUrl = navResult.url || startUrl;
      state.currentTitle = navResult.title || '';
      logger.info(`   Navigated to: ${navResult.url}`);

      await new Promise(r => setTimeout(r, 3000));

      // Initial screenshot
      const initSS = await BrowserService.screenshot(sid, { fullPage: false });
      const initShot = initSS.screenshot || initSS.data?.screenshot;
      if (initShot) state.screenshot = initShot;

      // Agent loop
      let consecutiveSameUrl = 0;
      let lastUrl = navResult.url || startUrl;

      let currentStepLimit = STEPS_PER_BATCH;
      let taskDone = false;

      for (let step = 1; step <= MAX_STEPS_ABSOLUTE; step++) {
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

        if (currentPageUrl === lastUrl && step > 1) {
          consecutiveSameUrl++;
        } else {
          consecutiveSameUrl = 0;
          lastUrl = currentPageUrl;
        }

        log(sid, { type: 'thinking', step, message: `Analyzing page (step ${step})...` });

        let action = await this.getNextAction(openai, task, screenshot, pageCtx, steps, step);

        if (consecutiveSameUrl >= 4 && action.action === 'click') {
          logger.info(`   [Recovery] Agent stuck on ${currentPageUrl} after ${consecutiveSameUrl} clicks — forcing navigate`);
          log(sid, { type: 'status', step, message: `Auto-recovery: clicks not navigating, trying direct URL...` });
          action = await this.getRecoveryAction(openai, task, pageCtx, steps);
        }

        steps.push({ step, action, url: currentPageUrl, title: pageText.data?.title, timestamp: new Date().toISOString() });
        logger.info(`   Step ${step}: ${action.action} — ${action.reason}`);

        log(sid, { type: 'step', step, action, message: action.reason || action.action, url: currentPageUrl, title: pageText.data?.title });

        if (action.action === 'done') {
          state.extractedData = action.extractedData || null;
          state.status = 'done';
          log(sid, { type: 'done', step, message: `Task completed in ${step} steps` });
          logger.info(`   Task complete in ${step} steps`);
          taskDone = true;
          break;
        }

        if (action.action === 'fail') {
          state.status = 'error';
          state.error = action.reason;
          log(sid, { type: 'error', step, message: action.reason });
          taskDone = true;
          break;
        }

        await this.executeAction(sid, action);
        await new Promise(r => setTimeout(r, 800));

        const postSS = await BrowserService.screenshot(sid, { fullPage: false });
        const postShot = postSS.screenshot || postSS.data?.screenshot;
        if (postShot) state.screenshot = postShot;

        // Auto-extend: when reaching the batch limit, check if the task is done
        if (step >= currentStepLimit && step < MAX_STEPS_ABSOLUTE) {
          log(sid, { type: 'status', step, message: `Reached ${currentStepLimit} steps — task not finished yet, continuing...` });
          logger.info(`   [Auto-extend] Batch limit ${currentStepLimit} reached, extending by ${STEPS_PER_BATCH}`);
          currentStepLimit += STEPS_PER_BATCH;
        }
      }

      if (!taskDone && state.status === 'running') {
        state.status = 'done';
        log(sid, { type: 'done', message: `Reached absolute max (${MAX_STEPS_ABSOLUTE} steps) — stopping` });
      }

    } catch (err: any) {
      logger.error(`   [VisionAgent] Error: ${err.message}`);
      state.status = 'error';
      state.error = err.message;
      log(sid, { type: 'error', message: err.message });
    } finally {
      try { await BrowserService.closeSession(sid); } catch { /* ignore */ }

      // ─── Memory Capture ──────────────────────────────────
      try {
        const finalState = sessionStates.get(sid);
        if (finalState) {
          const memSession = await Memory.startSession({
            userId: 'system',
            agentType: 'vision',
            project: 'default',
            userPrompt: task,
            sessionId: `vision-mem-${sid}`,
          });

          for (const logEntry of finalState.logs.slice(-20)) {
            if (logEntry.type === 'step' && logEntry.action) {
              await Memory.observe(memSession.id, 'system', 'default', {
                type: 'action',
                title: `Vision Step ${logEntry.step}: ${logEntry.action.action}`,
                subtitle: logEntry.action.reason,
                narrative: logEntry.message,
                concepts: ['vision', logEntry.action.action, task.split(' ').slice(0, 3).join('-')],
              });
            }
          }

          await Memory.endSession(memSession.id, {
            request: task,
            completed: finalState.status === 'done' ? `Task completed in ${finalState.progress} steps` : undefined,
            learned: finalState.extractedData ? JSON.stringify(finalState.extractedData).slice(0, 500) : undefined,
            notes: finalState.error || undefined,
          });
        }
      } catch (memErr) {
        logger.warn(`[Memory] Vision agent capture failed: ${memErr}`);
      }

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

    const userPrompt = `TASK: ${task}\n\nCURRENT STATE:\n${pageContext}\n\nStep ${currentStep}. Take as many steps as needed to complete the task — do NOT rush or stop early.${historyStr}${stuckWarning}\n\nAnalyze the screenshot and decide the next action. Return ONLY valid JSON.`;

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
      logger.error(`   [VisionAgent] AI error at step ${currentStep}: ${err.message}`);
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

  /* ═══════════════════════════════════════════════════════════
     Desktop Agent — Window-Isolated Parallel Execution

     Each agent targets a SPECIFIC app window. This enables
     multiple desktop agents to run in parallel because:

     1. Screenshots capture only that window (screencapture -l <windowID>)
     2. Clicks are translated from window-relative to screen-absolute
     3. Key events target the specific application process
     4. Each agent's window is non-overlapping (auto-tiled)

     The AI sees a screenshot of just its window and returns
     coordinates relative to that window. We translate those
     to absolute screen coordinates before executing.
     ═══════════════════════════════════════════════════════════ */

  private static activeDesktopAgents = new Map<string, { appName: string; windowId: number; bounds: WindowBounds; pid: number }>();

  private static desktopAgentsPaused = false;
  private static actionMutex = Promise.resolve();

  static pauseDesktopAgents() { this.desktopAgentsPaused = true; }
  static resumeDesktopAgents() { this.desktopAgentsPaused = false; }
  static get isDesktopPaused() { return this.desktopAgentsPaused; }

  private static async waitIfPaused(): Promise<void> {
    while (this.desktopAgentsPaused) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  private static async withActionLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const next = new Promise<void>(r => { release = r; });
    const prev = this.actionMutex;
    this.actionMutex = next;
    await prev;
    try { return await fn(); } finally { release!(); }
  }

  static async executeDesktopTask(task: string, appName?: string, _onEvent?: any, sessionId?: string): Promise<VisionAgentResult> {
    const openai = getOpenAI();
    const startTime = Date.now();
    const steps: VisionStep[] = [];
    let extractedData: any = null;
    const sid = sessionId || `desktop-${Date.now()}`;

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      if (appName) {
        // Launch the app if not running, but don't steal focus — use `open -gj`
        await execAsync(`open -gj -a "${appName}" 2>/dev/null || osascript -e 'tell application "${appName}" to activate'`);
        await new Promise(r => setTimeout(r, 2000));
      }

      const targetApp = appName || await this.getFrontmostApp();
      const windowId = await this.getWindowId(targetApp);
      const bounds = await this.getWindowBounds(targetApp);
      const pid = await this.getAppPid(targetApp);

      if (windowId && bounds) {
        await this.positionWindowForAgent(targetApp, sid);
        const updatedBounds = await this.getWindowBounds(targetApp);
        if (updatedBounds) {
          this.activeDesktopAgents.set(sid, { appName: targetApp, windowId, bounds: updatedBounds, pid: pid || 0 });
        }
      }

      const agentCtx = this.activeDesktopAgents.get(sid);

      let currentStepLimit = STEPS_PER_BATCH;

      for (let step = 1; step <= MAX_STEPS_ABSOLUTE; step++) {
        await this.waitIfPaused();

        const screenshot = agentCtx?.windowId
          ? await this.captureWindowScreenshot(agentCtx.windowId)
          : await this.captureDesktopScreenshot();

        const action = await this.getNextAction(openai, task, screenshot, `Desktop. App: ${targetApp}. Window-isolated mode.`, steps, step);
        steps.push({ step, action, timestamp: new Date().toISOString() });

        if (action.action === 'done') { extractedData = action.extractedData; break; }
        if (action.action === 'fail') break;

        await this.waitIfPaused();

        await this.withActionLock(async () => {
          await this.executeDesktopAction(action, agentCtx || undefined);
        });
        await new Promise(r => setTimeout(r, 800));

        if (step >= currentStepLimit && step < MAX_STEPS_ABSOLUTE) {
          logger.info(`[Desktop] Auto-extend: batch limit ${currentStepLimit} reached, task not done — continuing`);
          currentStepLimit += STEPS_PER_BATCH;
        }
      }

      return { success: !!extractedData, task, steps, extractedData, totalSteps: steps.length, durationMs: Date.now() - startTime };
    } catch (err: any) {
      return { success: false, task, steps, extractedData: null, totalSteps: steps.length, durationMs: Date.now() - startTime, error: err.message };
    } finally {
      this.activeDesktopAgents.delete(sid);
    }
  }

  private static async getAppPid(appName: string): Promise<number | null> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      const { stdout } = await promisify(exec)(
        `osascript -e 'tell application "System Events" to get unix id of process "${appName}"'`
      );
      const pid = parseInt(stdout.trim(), 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  private static async getFrontmostApp(): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      const { stdout } = await promisify(exec)(
        `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`
      );
      return stdout.trim();
    } catch {
      return 'Finder';
    }
  }

  private static async getWindowId(appName: string): Promise<number | null> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      // Use Python + Quartz framework to get CGWindowID for the app
      const pyScript = `
import Quartz, sys
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
for w in wl:
    owner = w.get('kCGWindowOwnerName', '')
    layer = w.get('kCGWindowLayer', 999)
    if owner == sys.argv[1] and layer == 0:
        print(w.get('kCGWindowNumber', 0))
        break
`.trim();
      const { stdout } = await promisify(exec)(
        `python3 -c "${pyScript.replace(/"/g, '\\"')}" "${appName}"`
      );
      const id = parseInt(stdout.trim(), 10);
      return isNaN(id) || id === 0 ? null : id;
    } catch (err) {
      logger.warn(`[Desktop] Could not get windowId for ${appName}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private static async getWindowBounds(appName: string): Promise<WindowBounds | null> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    try {
      const script = `
        tell application "System Events"
          tell process "${appName}"
            set winPos to position of window 1
            set winSize to size of window 1
            return (item 1 of winPos as text) & "," & (item 2 of winPos as text) & "," & (item 1 of winSize as text) & "," & (item 2 of winSize as text)
          end tell
        end tell`;
      const { stdout } = await promisify(exec)(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      const parts = stdout.trim().split(',').map(Number);
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
      return null;
    } catch {
      return null;
    }
  }

  private static async positionWindowForAgent(appName: string, _sessionId: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // In fullscreen mode: maximize the window. screencapture -l captures each
    // window's full content even when windows overlap, so no tiling needed.
    const screenW = 1920;
    const screenH = 1080;
    const x = 0, y = 25, w = screenW, h = screenH - 25;

    try {
      await execAsync(`osascript -e 'tell application "System Events" to tell process "${appName}" to set position of window 1 to {${x}, ${y}}'`);
      await execAsync(`osascript -e 'tell application "System Events" to tell process "${appName}" to set size of window 1 to {${w}, ${h}}'`);
    } catch (err) {
      logger.warn(`[Desktop] Could not position window for ${appName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private static async captureWindowScreenshot(windowId: number): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const { readFileSync, unlinkSync } = await import('fs');
    const tmpPath = `/tmp/gbeta-win-${windowId}-${Date.now()}.png`;
    try {
      await promisify(exec)(`screencapture -x -l ${windowId} ${tmpPath}`);
      const buffer = readFileSync(tmpPath);
      unlinkSync(tmpPath);
      return buffer.toString('base64');
    } catch {
      return this.captureDesktopScreenshot();
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

  private static async saveFrontmostApp(): Promise<string | null> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const { stdout } = await promisify(exec)(
        `osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`
      );
      return stdout.trim();
    } catch { return null; }
  }

  private static async restoreFrontmostApp(appName: string | null): Promise<void> {
    if (!appName) return;
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(exec)(`osascript -e 'tell application "${appName}" to activate'`);
    } catch { /* best effort */ }
  }

  private static async executeDesktopAction(
    action: VisionAction,
    agentCtx?: { appName: string; windowId: number; bounds: WindowBounds; pid?: number },
  ): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    switch (action.action) {
      case 'click':
        if (action.x !== undefined && action.y !== undefined) {
          const absX = agentCtx?.bounds ? agentCtx.bounds.x + action.x : action.x;
          const absY = agentCtx?.bounds ? agentCtx.bounds.y + action.y : action.y;

          if (agentCtx?.appName) {
            // Brief focus switch: bring agent window to front, click, restore user's app
            const userApp = await this.saveFrontmostApp();
            await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to set frontmost to true'`).catch(() => {});
            await new Promise(r => setTimeout(r, 50));

            const py = `
import Quartz, sys, time
x, y = int(sys.argv[1]), int(sys.argv[2])
pt = (x, y)
down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, pt, Quartz.kCGMouseButtonLeft)
up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, pt, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
time.sleep(0.05)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)`;
            await execAsync(`python3 -c "${py.replace(/"/g, '\\"')}" ${absX} ${absY}`).catch(() => {});
            await new Promise(r => setTimeout(r, 50));
            await this.restoreFrontmostApp(userApp);
          } else {
            const py = `
import Quartz, sys, time
x, y = int(sys.argv[1]), int(sys.argv[2])
pt = (x, y)
down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, pt, Quartz.kCGMouseButtonLeft)
up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, pt, Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
time.sleep(0.05)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)`;
            await execAsync(`python3 -c "${py.replace(/"/g, '\\"')}" ${absX} ${absY}`).catch(() => {});
          }
        }
        break;

      case 'type':
        if (action.text) {
          if (agentCtx?.appName) {
            // Brief focus switch for typing, then restore
            const userApp = await this.saveFrontmostApp();
            await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to set frontmost to true'`).catch(() => {});
            await new Promise(r => setTimeout(r, 30));

            const py = `
import Quartz, sys, time
text = sys.argv[1]
for ch in text:
    kd = Quartz.CGEventCreateKeyboardEvent(None, 0, True)
    ku = Quartz.CGEventCreateKeyboardEvent(None, 0, False)
    Quartz.CGEventKeyboardSetUnicodeString(kd, len(ch), ch)
    Quartz.CGEventKeyboardSetUnicodeString(ku, len(ch), ch)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, kd)
    time.sleep(0.008)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, ku)
    time.sleep(0.008)`;
            await execAsync(`python3 -c '${py.replace(/'/g, "'\\''")}' '${action.text.replace(/'/g, "'\\''")}'`).catch(async () => {
              await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to keystroke "${esc(action.text!)}"'`).catch(() => {});
            });
            await new Promise(r => setTimeout(r, 30));
            await this.restoreFrontmostApp(userApp);
          } else {
            await execAsync(`osascript -e 'tell application "System Events" to keystroke "${esc(action.text)}"'`);
          }
        }
        break;

      case 'press_key':
        if (action.key) {
          const keyCodeMap: Record<string, number> = {
            Enter: 36, Return: 36, Tab: 48, Escape: 53, Backspace: 51,
            Delete: 51, Space: 49, Up: 126, Down: 125, Left: 123, Right: 124,
          };
          const keyCode = keyCodeMap[action.key] ?? -1;

          if (agentCtx?.appName) {
            const userApp = await this.saveFrontmostApp();
            await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to set frontmost to true'`).catch(() => {});
            await new Promise(r => setTimeout(r, 30));

            if (keyCode >= 0) {
              const py = `
import Quartz, time
kd = Quartz.CGEventCreateKeyboardEvent(None, ${keyCode}, True)
ku = Quartz.CGEventCreateKeyboardEvent(None, ${keyCode}, False)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, kd)
time.sleep(0.02)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, ku)`;
              await execAsync(`python3 -c '${py}'`).catch(() => {});
            } else {
              await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to keystroke "${esc(action.key.toLowerCase())}"'`).catch(() => {});
            }
            await new Promise(r => setTimeout(r, 30));
            await this.restoreFrontmostApp(userApp);
          } else if (keyCode >= 0) {
            const py = `
import Quartz, time
kd = Quartz.CGEventCreateKeyboardEvent(None, ${keyCode}, True)
ku = Quartz.CGEventCreateKeyboardEvent(None, ${keyCode}, False)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, kd)
time.sleep(0.02)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, ku)`;
            await execAsync(`python3 -c '${py}'`).catch(() => {});
          }
        }
        break;

      case 'scroll': {
        const scrollAmount = action.direction === 'down' ? -5 : 5;
        if (agentCtx?.appName && agentCtx.bounds) {
          const userApp = await this.saveFrontmostApp();
          await execAsync(`osascript -e 'tell application "System Events" to tell process "${esc(agentCtx.appName)}" to set frontmost to true'`).catch(() => {});
          await new Promise(r => setTimeout(r, 30));
          const cx = agentCtx.bounds.x + Math.floor(agentCtx.bounds.width / 2);
          const cy = agentCtx.bounds.y + Math.floor(agentCtx.bounds.height / 2);
          const py = `
import Quartz
evt = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 1, ${scrollAmount})
Quartz.CGEventSetLocation(evt, (${cx}, ${cy}))
Quartz.CGEventPost(Quartz.kCGHIDEventTap, evt)`;
          await execAsync(`python3 -c '${py}'`).catch(() => {});
          await new Promise(r => setTimeout(r, 30));
          await this.restoreFrontmostApp(userApp);
        } else {
          const py = `
import Quartz
evt = Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 1, ${scrollAmount})
Quartz.CGEventPost(Quartz.kCGHIDEventTap, evt)`;
          await execAsync(`python3 -c '${py}'`).catch(() => {});
        }
        break;
      }

      case 'navigate':
        if (action.url && agentCtx?.appName) {
          await execAsync(`osascript -e 'tell application "${esc(agentCtx.appName)}" to open location "${esc(action.url)}"'`).catch(() => {});
        }
        break;

      case 'wait':
        await new Promise(r => setTimeout(r, Math.min(action.waitMs || 2000, 10000)));
        break;
    }
  }

  /* ─── Docker Container Isolation ────────────────────────
     Each agent gets a Docker container with Xvfb (virtual display),
     a window manager, and VNC. The agent captures screenshots from
     the container's virtual display and sends input via xdotool.
     Complete isolation — each agent has its own screen, keyboard, mouse.
     ────────────────────────────────────────────────────────── */

  static async executeDesktopTaskInDocker(task: string, appName?: string, sessionId?: string): Promise<VisionAgentResult> {
    const openai = getOpenAI();
    const startTime = Date.now();
    const steps: VisionStep[] = [];
    let extractedData: any = null;
    const sid = sessionId || `docker-${Date.now()}`;
    const containerName = `gbeta-agent-${sid}`;
    const vncPort = 5900 + Math.floor(Math.random() * 100);
    const displayNum = Math.floor(Math.random() * 100) + 10;

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      // Start container with virtual display
      await execAsync(`docker run -d --name ${containerName} \
        -e DISPLAY=:${displayNum} \
        -p ${vncPort}:5900 \
        --shm-size=2g \
        ubuntu:22.04 bash -c "
          apt-get update -qq && apt-get install -y -qq xvfb x11vnc xdotool fluxbox imagemagick scrot > /dev/null 2>&1;
          Xvfb :${displayNum} -screen 0 1920x1080x24 &
          sleep 1;
          DISPLAY=:${displayNum} fluxbox &
          DISPLAY=:${displayNum} x11vnc -display :${displayNum} -nopw -forever -shared &
          ${appName ? `DISPLAY=:${displayNum} ${appName.toLowerCase()} &` : ''}
          sleep infinity
        "`);

      await new Promise(r => setTimeout(r, 5000));

      let currentStepLimit = STEPS_PER_BATCH;

      for (let step = 1; step <= MAX_STEPS_ABSOLUTE; step++) {
        await this.waitIfPaused();

        const tmpPath = `/tmp/gbeta-docker-${sid}-${step}.png`;
        await execAsync(`docker exec ${containerName} bash -c "DISPLAY=:${displayNum} scrot -o /tmp/screen.png" && docker cp ${containerName}:/tmp/screen.png ${tmpPath}`);
        const { readFileSync, unlinkSync } = await import('fs');
        const screenshot = readFileSync(tmpPath).toString('base64');
        try { unlinkSync(tmpPath); } catch {}

        const action = await this.getNextAction(openai, task, screenshot, `Linux virtual desktop (Docker). Isolated display :${displayNum}.`, steps, step);
        steps.push({ step, action, timestamp: new Date().toISOString() });

        if (action.action === 'done') { extractedData = action.extractedData; break; }
        if (action.action === 'fail') break;

        switch (action.action) {
          case 'click':
            if (action.x !== undefined && action.y !== undefined)
              await execAsync(`docker exec ${containerName} bash -c "DISPLAY=:${displayNum} xdotool mousemove ${action.x} ${action.y} click 1"`).catch(() => {});
            break;
          case 'type':
            if (action.text)
              await execAsync(`docker exec ${containerName} bash -c "DISPLAY=:${displayNum} xdotool type --delay 20 '${action.text.replace(/'/g, "'\\''")}'"`).catch(() => {});
            break;
          case 'press_key':
            if (action.key) {
              const keyMap: Record<string, string> = { Enter: 'Return', Tab: 'Tab', Escape: 'Escape', Backspace: 'BackSpace', Space: 'space', Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right' };
              const k = keyMap[action.key] || action.key;
              await execAsync(`docker exec ${containerName} bash -c "DISPLAY=:${displayNum} xdotool key ${k}"`).catch(() => {});
            }
            break;
          case 'scroll':
            await execAsync(`docker exec ${containerName} bash -c "DISPLAY=:${displayNum} xdotool click ${action.direction === 'down' ? 5 : 4}"`).catch(() => {});
            break;
          case 'wait':
            await new Promise(r => setTimeout(r, Math.min(action.waitMs || 2000, 10000)));
            break;
        }

        await new Promise(r => setTimeout(r, 800));

        if (step >= currentStepLimit && step < MAX_STEPS_ABSOLUTE) {
          logger.info(`[Docker] Auto-extend: batch limit ${currentStepLimit} reached, task not done — continuing`);
          currentStepLimit += STEPS_PER_BATCH;
        }
      }

      return { success: !!extractedData, task, steps, extractedData, totalSteps: steps.length, durationMs: Date.now() - startTime };
    } catch (err: any) {
      return { success: false, task, steps, extractedData: null, totalSteps: steps.length, durationMs: Date.now() - startTime, error: err.message };
    } finally {
      // Clean up container
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      promisify(exec)(`docker rm -f ${containerName}`).catch(() => {});
    }
  }
}
