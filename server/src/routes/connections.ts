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
    // Redirect back to the frontend with success
    res.redirect(`${config.frontendUrl}?connected=gmail`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}?error=gmail_auth_failed`);
  }
});

/* ═══ SLACK ════════════════════════════════════════════════ */

/** Connect Slack using a bot token */
router.post('/slack', async (req: Request, res: Response) => {
  const { botToken } = req.body;

  try {
    const connection = await SlackService.connect(botToken);
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
    res.redirect(`${config.frontendUrl}?connected=teams`);
  } catch (err) {
    res.redirect(`${config.frontendUrl}?error=teams_auth_failed`);
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

