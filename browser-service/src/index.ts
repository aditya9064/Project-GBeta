/* ═══════════════════════════════════════════════════════════
   Browser Automation Service for Cloud Run
   
   Standalone service that handles browser automation tasks
   using Puppeteer with Chrome. Called by the main Firebase
   Functions backend.
   ═══════════════════════════════════════════════════════════ */

import express from 'express';
import cors from 'cors';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

interface SessionState {
  browser: Browser;
  page: Page;
  status: 'running' | 'done' | 'error';
  logs: LogEntry[];
  currentUrl: string;
  currentTitle: string;
  extractedData: any;
  progress: number;
  totalSteps: number;
  error?: string;
  createdAt: Date;
}

interface LogEntry {
  type: string;
  step?: number;
  action?: any;
  message: string;
  timestamp: string;
}

const sessions = new Map<string, SessionState>();
const MAX_SESSIONS = 5;
const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openai;
}

function log(sessionId: string, type: string, message: string, extra?: Partial<LogEntry>) {
  const session = sessions.get(sessionId);
  if (session) {
    session.logs.push({
      type,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }
  console.log(`[${sessionId}] ${type}: ${message}`);
}

async function cleanupOldSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt.getTime() > SESSION_TIMEOUT_MS) {
      try {
        await session.browser.close();
      } catch {}
      sessions.delete(id);
    }
  }
}

async function createSession(sessionId: string): Promise<SessionState> {
  await cleanupOldSessions();
  
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = Array.from(sessions.entries()).reduce((a, b) =>
      a[1].createdAt < b[1].createdAt ? a : b
    );
    try {
      await oldest[1].browser.close();
    } catch {}
    sessions.delete(oldest[0]);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const state: SessionState = {
    browser,
    page,
    status: 'running',
    logs: [],
    currentUrl: '',
    currentTitle: '',
    extractedData: null,
    progress: 0,
    totalSteps: 10,
    createdAt: new Date(),
  };

  sessions.set(sessionId, state);
  return state;
}

/* ─── Vision Agent Logic ──────────────────────────────────── */

async function takeScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
  return buffer.toString('base64');
}

async function getNextAction(
  task: string,
  screenshot: string,
  currentUrl: string,
  history: string[]
): Promise<{ action: string; target?: string; value?: string; done?: boolean; extractedData?: any }> {
  const ai = getOpenAI();

  const historyText = history.length > 0 
    ? `\n\nPrevious actions taken:\n${history.slice(-5).join('\n')}`
    : '';

  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a browser automation agent. Analyze the screenshot and decide the next action to accomplish the task.

Available actions:
- click: Click on an element. Provide target as a description of what to click.
- type: Type text into a field. Provide target (field description) and value (text to type).
- scroll: Scroll the page. Provide target as "up", "down", "left", or "right".
- navigate: Go to a URL. Provide value as the URL.
- extract: Extract data from the page. Provide target as what to extract.
- done: Task is complete. Provide extractedData with any results.
- wait: Wait for page to load. No parameters needed.

Respond with JSON only:
{
  "action": "click|type|scroll|navigate|extract|done|wait",
  "target": "description of element or direction",
  "value": "text to type or URL to navigate",
  "done": true/false,
  "extractedData": {} // any data extracted from the page
}`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Task: ${task}\n\nCurrent URL: ${currentUrl}${historyText}\n\nWhat is the next action?`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${screenshot}` },
          },
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '';
  try {
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { action: 'done', done: true, extractedData: { error: 'Failed to parse AI response' } };
  }
}

async function executeAction(
  page: Page,
  action: { action: string; target?: string; value?: string }
): Promise<boolean> {
  try {
    switch (action.action) {
      case 'click':
        if (action.target) {
          const element = await page.$(action.target);
          if (element) {
            await element.click();
          } else {
            // Try to find by text content
            await page.evaluate((text) => {
              const elements = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'));
              const el = elements.find(e => e.textContent?.toLowerCase().includes(text.toLowerCase()));
              if (el) (el as HTMLElement).click();
            }, action.target);
          }
        }
        break;

      case 'type':
        if (action.target && action.value) {
          await page.evaluate((target, value) => {
            const inputs = Array.from(document.querySelectorAll('input, textarea'));
            const el = inputs.find(e => 
              e.getAttribute('placeholder')?.toLowerCase().includes(target.toLowerCase()) ||
              e.getAttribute('name')?.toLowerCase().includes(target.toLowerCase()) ||
              e.getAttribute('aria-label')?.toLowerCase().includes(target.toLowerCase())
            ) as HTMLInputElement | HTMLTextAreaElement;
            if (el) {
              el.value = value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, action.target, action.value);
        }
        break;

      case 'scroll':
        const direction = action.target || 'down';
        const scrollAmount = direction === 'up' ? -500 : direction === 'down' ? 500 : 0;
        await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
        break;

      case 'navigate':
        if (action.value) {
          await page.goto(action.value, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        break;

      case 'wait':
        await new Promise(r => setTimeout(r, 2000));
        break;

      case 'extract':
      case 'done':
        // No action needed
        break;

      default:
        return false;
    }
    return true;
  } catch (err) {
    console.error('Action failed:', err);
    return false;
  }
}

async function runVisionTask(sessionId: string, task: string, startUrl: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const { page } = session;
  const history: string[] = [];
  const maxSteps = 15;

  try {
    log(sessionId, 'info', `Starting task: ${task}`);
    log(sessionId, 'info', `Navigating to ${startUrl}`);

    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    session.currentUrl = page.url();
    session.currentTitle = await page.title();

    for (let step = 0; step < maxSteps; step++) {
      if (session.status !== 'running') break;

      session.progress = step + 1;
      log(sessionId, 'thinking', `Step ${step + 1}: Analyzing page...`, { step: step + 1 });

      const screenshot = await takeScreenshot(page);
      const action = await getNextAction(task, screenshot, session.currentUrl, history);

      log(sessionId, 'action', `Action: ${action.action}${action.target ? ` on "${action.target}"` : ''}`, {
        step: step + 1,
        action,
      });

      if (action.done || action.action === 'done') {
        session.extractedData = action.extractedData || {};
        session.status = 'done';
        log(sessionId, 'success', 'Task completed');
        break;
      }

      const success = await executeAction(page, action);
      history.push(`${action.action}: ${action.target || action.value || ''} - ${success ? 'success' : 'failed'}`);

      session.currentUrl = page.url();
      session.currentTitle = await page.title();

      await new Promise(r => setTimeout(r, 1000));
    }

    if (session.status === 'running') {
      session.status = 'done';
      log(sessionId, 'info', 'Max steps reached');
    }
  } catch (err: any) {
    session.status = 'error';
    session.error = err.message;
    log(sessionId, 'error', `Task failed: ${err.message}`);
  }
}

/* ─── API Routes ──────────────────────────────────────────── */

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.post('/vision/start', async (req, res) => {
  try {
    const { task, url, sessionId } = req.body;

    if (!task || !url || !sessionId) {
      res.status(400).json({ success: false, error: 'Missing task, url, or sessionId' });
      return;
    }

    const session = await createSession(sessionId);
    log(sessionId, 'info', 'Session created');

    // Run task in background
    runVisionTask(sessionId, task, url).catch(err => {
      console.error('Vision task error:', err);
    });

    res.json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/vision/poll/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const since = parseInt(req.query.since as string) || 0;

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  const newLogs = session.logs.slice(since);

  res.json({
    success: true,
    status: session.status,
    logs: newLogs,
    totalLogs: session.logs.length,
    currentUrl: session.currentUrl,
    currentTitle: session.currentTitle,
    progress: session.progress,
    totalSteps: session.totalSteps,
    extractedData: session.extractedData,
    error: session.error,
  });
});

app.get('/vision/screenshot/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  try {
    const screenshot = await takeScreenshot(session.page);
    res.json({ success: true, screenshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/vision/stop/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return;
  }

  session.status = 'done';
  try {
    await session.browser.close();
  } catch {}
  sessions.delete(sessionId);

  res.json({ success: true });
});

/* ─── Start Server ────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`🌐 Browser Service running on port ${PORT}`);
  console.log(`   Chromium: ${CHROMIUM_PATH}`);
  console.log(`   OpenAI: ${OPENAI_API_KEY ? 'configured' : 'not configured'}`);
});
