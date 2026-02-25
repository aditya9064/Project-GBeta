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
import { BrowserService } from '../services/browser.service.js';

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

export { router as browserRouter };
