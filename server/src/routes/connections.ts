/* ═══════════════════════════════════════════════════════════
   Connection Routes — OAuth flows for Gmail, Slack, Teams
   
   GET  /api/connections           — List all connection statuses
   GET  /api/connections/gmail     — Start Gmail OAuth flow
   GET  /api/connections/gmail/callback — OAuth callback
   POST /api/connections/slack     — Connect Slack (bot token)
   GET  /api/connections/teams     — Start Teams OAuth flow
   GET  /api/connections/teams/callback — OAuth callback
   DELETE /api/connections/:channel — Disconnect a channel
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { GmailService } from '../services/gmail.service.js';
import { SlackService } from '../services/slack.service.js';
import { TeamsService } from '../services/teams.service.js';
import { config } from '../config.js';
import type { ChannelConnection, APIResponse } from '../types.js';

const router = Router();

/* ─── Middleware: Restore tokens from Firestore ────────── */
/* Cloud Functions are stateless — tokens stored in-memory
   are lost across invocations. This middleware restores
   them from Firestore before every connections request. */

router.use(async (_req: Request, _res: Response, next: Function) => {
  await Promise.all([
    GmailService.restoreFromStore(),
    SlackService.restoreFromStore(),
    TeamsService.restoreFromStore(),
  ]);
  next();
});

/* ─── GET /api/connections ─────────────────────────────── */

router.get('/', (_req: Request, res: Response) => {
  const connections: ChannelConnection[] = [
    GmailService.getConnection(),
    SlackService.getConnection(),
    TeamsService.getConnection(),
  ];

  res.json({
    success: true,
    data: connections,
  } as APIResponse<ChannelConnection[]>);
});

/* ═══ GMAIL ════════════════════════════════════════════════ */

/** Start the Gmail OAuth2 flow — redirects user to Google consent screen */
router.get('/gmail', (_req: Request, res: Response) => {
  try {
    const authUrl = GmailService.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate auth URL',
    });
  }
});

/** Gmail OAuth callback */
router.get('/gmail/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ success: false, error: 'Missing authorization code' });
    return;
  }

  try {
    const connection = await GmailService.handleCallback(code);
    // Redirect back to the frontend Communications page
    res.redirect(`${config.frontendUrl}/comms?connected=gmail`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}/comms?error=gmail_auth_failed`);
  }
});

/* ═══ SLACK ════════════════════════════════════════════════ */

/** Start the Slack OAuth2 flow — returns auth URL (or redirects) */
router.get('/slack', (_req: Request, res: Response) => {
  try {
    const authUrl = SlackService.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    // If OAuth not configured, fall back to suggesting bot token
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate Slack auth URL',
    });
  }
});

/** Slack OAuth callback */
router.get('/slack/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    res.redirect(`${config.frontendUrl}/comms?error=slack_auth_denied`);
    return;
  }

  if (!code) {
    res.status(400).json({ success: false, error: 'Missing authorization code' });
    return;
  }

  try {
    await SlackService.handleCallback(code);
    res.redirect(`${config.frontendUrl}/comms?connected=slack`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}/comms?error=slack_auth_failed`);
  }
});

/** Connect Slack using a user token (fallback for direct token method) */
router.post('/slack', async (req: Request, res: Response) => {
  const { userToken, botToken } = req.body; // Support both names for backward compat
  const token = userToken || botToken;

  try {
    const connection = await SlackService.connect(token);
    res.json({ success: true, data: connection });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to connect Slack',
    });
  }
});

/* ═══ TEAMS ════════════════════════════════════════════════ */

/** Start the Teams/Microsoft OAuth2 flow */
router.get('/teams', (_req: Request, res: Response) => {
  try {
    const authUrl = TeamsService.getAuthUrl();
    res.json({ success: true, data: { authUrl } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate auth URL',
    });
  }
});

/** Teams OAuth callback */
router.get('/teams/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).json({ success: false, error: 'Missing authorization code' });
    return;
  }

  try {
    const connection = await TeamsService.handleCallback(code);
    res.redirect(`${config.frontendUrl}/comms?connected=teams`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}/comms?error=teams_auth_failed`);
  }
});

/* ═══ DISCONNECT ═══════════════════════════════════════════ */

router.delete('/:channel', (req: Request, res: Response) => {
  const channel = req.params.channel;

  switch (channel) {
    case 'gmail':
    case 'email':
      GmailService.disconnect();
      break;
    case 'slack':
      SlackService.disconnect();
      break;
    case 'teams':
      TeamsService.disconnect();
      break;
    default:
      res.status(400).json({ success: false, error: `Unknown channel: ${channel}` });
      return;
  }

  res.json({ success: true, message: `${channel} disconnected` });
});

export { router as connectionsRouter };
