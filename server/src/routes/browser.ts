/* ═══════════════════════════════════════════════════════════
   Browser Automation Routes — Puppeteer-backed
   
   REST endpoints that the frontend's execution engine calls
   to control headful Chrome sessions. Each agent/execution
   gets its own browser window so it never disturbs the user.
   
   POST /api/browser/session          — Create / resume session
   DELETE /api/browser/session/:id    — Close a session
   GET  /api/browser/sessions         — List active sessions
   POST /api/browser/action           — Run a browser action
   GET  /api/browser/screenshot/:id   — Get current screenshot
   GET  /api/browser/status           — Service health
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import { visionStartSchema } from '../middleware/schemas.js';
import { BrowserService } from '../services/browser.service.js';
import { VisionAgent, getSessionState, getLatestScreenshot } from '../services/visionAgent.js';

const router = Router();

/* ─── POST /api/browser/session — Create or resume ─── */

router.post('/session', async (req: Request, res: Response) => {
  try {
    const { sessionId, headless, width, height } = req.body;
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing "sessionId"' });
      return;
    }

    const session = await BrowserService.createSession(sessionId, { headless, width, height });
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        url: session.currentUrl,
        createdAt: session.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Browser session create error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create browser session',
    });
  }
});

/* ─── DELETE /api/browser/session/:id — Close ─────── */

router.delete('/session/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await BrowserService.closeSession(id);
    res.json({ success: true, data: { sessionId: id, closed: true } });
  } catch (err) {
    console.error('Browser session close error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to close session',
    });
  }
});

/* ─── GET /api/browser/sessions — List active ─────── */

router.get('/sessions', (_req: Request, res: Response) => {
  const sessions = BrowserService.listSessions();
  res.json({ success: true, data: sessions });
});

/* ─── POST /api/browser/action — Execute an action ── */

router.post('/action', async (req: Request, res: Response) => {
  try {
    const { sessionId, action, ...params } = req.body;

    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing "sessionId"' });
      return;
    }
    if (!action) {
      res.status(400).json({ success: false, error: 'Missing "action"' });
      return;
    }

    let result;

    switch (action) {
      case 'navigate':
        result = await BrowserService.navigate(sessionId, params.url, { waitUntil: params.waitUntil });
        break;

      case 'click':
        result = await BrowserService.click(sessionId, params.selector, { waitForNav: params.waitForNav });
        break;

      case 'type':
        result = await BrowserService.type(sessionId, params.selector, params.text || params.value || '', {
          clearFirst: params.clearFirst,
          delay: params.delay,
        });
        break;

      case 'select':
        result = await BrowserService.select(sessionId, params.selector, params.value);
        break;

      case 'scroll':
        result = await BrowserService.scroll(sessionId, params.direction, params.pixels);
        break;

      case 'wait':
        result = await BrowserService.waitFor(sessionId, params.selector || params.ms || 1000);
        break;

      case 'screenshot':
        result = await BrowserService.screenshot(sessionId, { fullPage: params.fullPage });
        break;

      case 'extract':
        result = await BrowserService.extract(sessionId, params.selector, params.attribute);
        break;

      case 'submit':
        result = await BrowserService.submit(sessionId, params.selector);
        break;

      case 'login':
        result = await BrowserService.login(sessionId, params.url, {
          usernameSelector: params.usernameSelector || '#email',
          passwordSelector: params.passwordSelector || '#password',
          username: params.username,
          password: params.password,
          submitSelector: params.submitSelector,
        });
        break;

      case 'search':
        result = await BrowserService.search(
          sessionId,
          params.url,
          params.searchSelector || 'input[type="search"], input[name="q"], #search',
          params.query || params.value || '',
          params.submitSelector,
        );
        break;

      case 'evaluate':
        result = await BrowserService.evaluate(sessionId, params.script);
        break;

      case 'page_info':
        result = await BrowserService.getPageInfo(sessionId);
        break;

      case 'click_at':
        result = await BrowserService.clickAt(sessionId, params.x, params.y);
        break;

      case 'type_text':
        result = await BrowserService.typeText(sessionId, params.text || params.value || '', { pressEnter: params.pressEnter });
        break;

      case 'press_key':
        result = await BrowserService.pressKey(sessionId, params.key);
        break;

      case 'page_text':
        result = await BrowserService.getPageText(sessionId);
        break;

      default:
        res.status(400).json({ success: false, error: `Unknown browser action: "${action}"` });
        return;
    }

    res.json({ success: result.success, data: result });
  } catch (err) {
    console.error('Browser action error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Browser action failed',
    });
  }
});

/* ─── GET /api/browser/screenshot/:id — Quick grab ── */

router.get('/screenshot/:id', async (req: Request, res: Response) => {
  try {
    const result = await BrowserService.screenshot(String(req.params.id), {
      fullPage: req.query.fullPage === 'true',
    });

    if (result.success && result.screenshot) {
      res.json({ success: true, data: { screenshot: result.screenshot } });
    } else {
      res.status(404).json({ success: false, error: result.error || 'No screenshot available' });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Screenshot failed',
    });
  }
});

/* ─── GET /api/browser/status — Service health ─────── */

router.get('/status', (_req: Request, res: Response) => {
  const sessions = BrowserService.listSessions();
  res.json({
    success: true,
    data: {
      available: true,
      engine: 'puppeteer',
      activeSessions: sessions.length,
      sessions,
    },
  });
});

/* ═══ VISION AGENT ═══════════════════════════════════════ */

/**
 * GET /api/browser/vision/screenshot/:sessionId — poll latest screenshot
 */
router.get('/vision/screenshot/:sessionId', (req: Request, res: Response) => {
  const screenshot = getLatestScreenshot(String(req.params.sessionId));
  if (screenshot) {
    res.json({ success: true, screenshot });
  } else {
    res.json({ success: false, screenshot: null });
  }
});

/**
 * POST /api/browser/vision/task  — non-streaming (for server-side executor)
 */
router.post('/vision/task', async (req: Request, res: Response) => {
  try {
    const { task, url, sessionId } = req.body;
    if (!task) { res.status(400).json({ success: false, error: 'Missing "task"' }); return; }
    if (!url) { res.status(400).json({ success: false, error: 'Missing "url"' }); return; }

    const result = await VisionAgent.executeTask(task, url, sessionId);
    res.json({
      success: result.success,
      data: { ...result, steps: result.steps.map(s => ({ ...s, screenshot: undefined })) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Vision task failed' });
  }
});

router.post('/vision/desktop', async (req: Request, res: Response) => {
  try {
    const { task, appName } = req.body;
    if (!task) { res.status(400).json({ success: false, error: 'Missing "task"' }); return; }

    const result = await VisionAgent.executeDesktopTask(task, appName);
    res.json({
      success: result.success,
      data: { ...result, steps: result.steps.map(s => ({ ...s, screenshot: undefined })) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Desktop task failed' });
  }
});

/**
 * POST /api/browser/vision/start — Start a vision task (returns immediately)
 */
router.post('/vision/start', validate(visionStartSchema), (req: Request, res: Response) => {
  const { task, url, appName, sessionId } = req.body;
  if (!url && !appName) { res.status(400).json({ success: false, error: 'Missing "url" or "appName"' }); return; }

  const sid = sessionId || `vision-${Date.now()}`;
  console.log(`[Vision] Starting task: "${task}" url="${url || 'desktop'}" session="${sid}"`);

  VisionAgent.startTask(task, url, sid);

  res.json({ success: true, sessionId: sid });
});

/**
 * GET /api/browser/vision/poll/:sessionId — Poll session state (logs, status, url)
 * Query param: ?since=<logIndex> to get only new logs
 */
router.get('/vision/poll/:sessionId', (req: Request, res: Response) => {
  const state = getSessionState(String(req.params.sessionId));
  if (!state) {
    res.json({ success: false, error: 'Session not found' });
    return;
  }

  const since = parseInt(req.query.since as string) || 0;

  res.json({
    success: true,
    status: state.status,
    progress: state.progress,
    totalSteps: state.totalSteps,
    currentUrl: state.currentUrl,
    currentTitle: state.currentTitle,
    extractedData: state.extractedData,
    error: state.error,
    logs: state.logs.slice(since),
    logOffset: since,
    totalLogs: state.logs.length,
  });
});

export { router as browserRouter };
