/* ═══════════════════════════════════════════════════════════
   Automation Workflow Routes — Real execution endpoints
   
   These endpoints are called by the frontend's automation
   execution engine to perform REAL actions (send emails,
   post Slack messages, run AI prompts, etc.)
   
   GET  /api/automation/status         — Check connected services
   POST /api/automation/gmail/send     — Send a new email
   POST /api/automation/gmail/reply    — Reply to an email
   GET  /api/automation/gmail/read     — Read recent emails
   POST /api/automation/slack/send     — Send a Slack message
   POST /api/automation/ai/process     — Process with AI (OpenAI)
   POST /api/automation/http           — Make an HTTP request
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { GmailService } from '../services/gmail.service.js';
import { SlackService } from '../services/slack.service.js';
import { AIEngine } from '../services/ai-engine.js';

const router = Router();

/* ─── Middleware: Restore tokens from Firestore ────────── */

router.use(async (_req: Request, _res: Response, next: Function) => {
  await Promise.all([
    GmailService.restoreFromStore(),
    SlackService.restoreFromStore(),
  ]);
  next();
});

/* ─── GET /api/automation/status ──────────────────────── */
/** Returns which services are connected and ready for use */

router.get('/status', (_req: Request, res: Response) => {
  const gmailConn = GmailService.getConnection();
  const slackConn = SlackService.getConnection();

  res.json({
    success: true,
    data: {
      gmail: {
        connected: gmailConn.status === 'connected',
        email: gmailConn.accountEmail,
      },
      slack: {
        connected: slackConn.status === 'connected',
        workspace: slackConn.accountName,
      },
      ai: {
        configured: !!process.env.OPENAI_API_KEY,
      },
      browser: {
        available: true,
        engine: 'puppeteer',
      },
    },
  });
});

/* ═══ GMAIL ═══════════════════════════════════════════════ */

/** Send a new email */
router.post('/gmail/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !to.trim()) {
      res.status(400).json({ success: false, error: 'Missing "to" field — provide a valid email address' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      res.status(400).json({ success: false, error: `Invalid To header: "${to}". Provide a valid email address (e.g. user@example.com)` });
      return;
    }
    if (!subject) {
      res.status(400).json({ success: false, error: 'Missing "subject" field' });
      return;
    }

    const gmailConn = GmailService.getConnection();
    if (gmailConn.status !== 'connected') {
      res.status(400).json({ success: false, error: 'Gmail is not connected. Please connect Gmail first via /api/connections/gmail' });
      return;
    }

    const result = await GmailService.sendNewEmail(to, subject, body || '');
    res.json({
      success: true,
      data: {
        ...result,
        action: 'send',
        to,
        subject,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation Gmail send error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    });
  }
});

/** Reply to an existing email */
router.post('/gmail/reply', async (req: Request, res: Response) => {
  try {
    const { messageId, body } = req.body;

    if (!messageId) {
      res.status(400).json({ success: false, error: 'Missing "messageId" field' });
      return;
    }
    if (!body) {
      res.status(400).json({ success: false, error: 'Missing "body" field' });
      return;
    }

    const gmailConn = GmailService.getConnection();
    if (gmailConn.status !== 'connected') {
      res.status(400).json({ success: false, error: 'Gmail is not connected' });
      return;
    }

    const success = await GmailService.sendReply(messageId, body);
    res.json({
      success,
      data: {
        action: 'reply',
        messageId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation Gmail reply error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reply to email',
    });
  }
});

/** Read recent emails from inbox */
router.get('/gmail/read', async (req: Request, res: Response) => {
  try {
    const gmailConn = GmailService.getConnection();
    if (gmailConn.status !== 'connected') {
      res.status(400).json({ success: false, error: 'Gmail is not connected' });
      return;
    }

    const emails = await GmailService.fetchMessages();
    res.json({
      success: true,
      data: {
        action: 'read',
        count: emails.length,
        emails: emails.map(e => ({
          id: e.externalId,
          from: e.from,
          fromEmail: e.fromEmail,
          subject: e.subject,
          preview: e.preview,
          fullMessage: e.fullMessage,
          receivedAt: e.receivedAt,
          priority: e.priority,
          attachments: e.attachments,
        })),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation Gmail read error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to read emails',
    });
  }
});

/* ═══ SLACK ═══════════════════════════════════════════════ */

/** Send a message to a Slack channel */
router.post('/slack/send', async (req: Request, res: Response) => {
  try {
    const { channel, message, threadTs } = req.body;

    if (!channel) {
      res.status(400).json({ success: false, error: 'Missing "channel" field' });
      return;
    }
    if (!message) {
      res.status(400).json({ success: false, error: 'Missing "message" field' });
      return;
    }

    const slackConn = SlackService.getConnection();
    if (slackConn.status !== 'connected') {
      res.status(400).json({ success: false, error: 'Slack is not connected. Please connect Slack first via /api/connections/slack' });
      return;
    }

    const success = await SlackService.sendReply(channel, message, threadTs);
    res.json({
      success,
      data: {
        action: 'send_message',
        channel,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation Slack send error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send Slack message',
    });
  }
});

/* ═══ AI (OpenAI) ═════════════════════════════════════════ */

/** Process input with AI */
router.post('/ai/process', async (req: Request, res: Response) => {
  try {
    const { prompt, systemPrompt, model, temperature, maxTokens, input } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Missing "prompt" field' });
      return;
    }

    const result = await AIEngine.processAutomation(
      prompt,
      systemPrompt,
      input,
      { model, temperature, maxTokens }
    );

    res.json({
      success: true,
      data: {
        ...result,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation AI process error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'AI processing failed',
    });
  }
});

/* ═══ HTTP (Generic Request) ═════════════════════════════ */

/** Make an HTTP request (proxy through backend) */
router.post('/http', async (req: Request, res: Response) => {
  try {
    const { url, method, headers, body } = req.body;

    if (!url) {
      res.status(400).json({ success: false, error: 'Missing "url" field' });
      return;
    }

    // Reject n8n template expressions (e.g. {{ $env.WEBHOOK_URL }})
    if (/\{\{.*\}\}/.test(url)) {
      res.status(400).json({
        success: false,
        error: `URL contains unresolved template expression: "${url}". Please configure the URL with an actual value.`,
        _templateExpression: true,
      });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({
        success: false,
        error: `Invalid URL: "${url}". Please provide a valid HTTP/HTTPS URL.`,
      });
      return;
    }

    const fetchMethod = (method || 'GET').toUpperCase();
    const fetchOptions: RequestInit = {
      method: fetchMethod,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
    };

    if (fetchMethod !== 'GET' && fetchMethod !== 'HEAD' && body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    let responseData: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    res.json({
      success: response.ok,
      data: {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Automation HTTP request error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'HTTP request failed',
    });
  }
});

export { router as automationRouter };

