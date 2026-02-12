/* ═══════════════════════════════════════════════════════════
   Messages API Routes
   
   GET  /api/messages          — Fetch all messages (unified inbox)
   GET  /api/messages/:id      — Get single message detail
   POST /api/messages/:id/draft — Generate AI draft for a message
   POST /api/messages/:id/send  — Send the approved draft
   PUT  /api/messages/:id      — Update message (star, status, etc.)
   POST /api/messages/sync     — Sync from all connected channels
   POST /api/messages/draft-all — Auto-draft all pending messages
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { GmailService } from '../services/gmail.service.js';
import { SlackService } from '../services/slack.service.js';
import { TeamsService } from '../services/teams.service.js';
import { AIEngine } from '../services/ai-engine.js';
import type { UnifiedMessage, APIResponse, MessagesResponse, Channel } from '../types.js';

const router = Router();

/* ─── Middleware: Restore tokens from Firestore ────────── */

router.use(async (_req: Request, _res: Response, next: Function) => {
  await Promise.all([
    GmailService.restoreFromStore(),
    SlackService.restoreFromStore(),
    TeamsService.restoreFromStore(),
  ]);
  next();
});

/* ─── In-memory message store ──────────────────────────── */

let messageStore: UnifiedMessage[] = [];
let lastSyncTime: Date | null = null;

/**
 * Auto-sync helper — fetches messages from all connected services.
 * Called automatically when the in-memory store is empty (cold start)
 * so that GET /api/messages always returns real data.
 */
async function autoSyncIfEmpty(): Promise<void> {
  if (messageStore.length > 0) return; // Already have messages in memory

  const hasConnected =
    GmailService.getConnection().status === 'connected' ||
    SlackService.getConnection().status === 'connected' ||
    TeamsService.getConnection().status === 'connected';

  if (!hasConnected) return; // No connected services

  console.log('📬 Auto-syncing messages (cold start detected)...');
  const newMessages: UnifiedMessage[] = [];

  // Fetch from Gmail
  if (GmailService.getConnection().status === 'connected') {
    try {
      const emails = await GmailService.fetchMessages(20);
      newMessages.push(...emails);
    } catch (err) {
      console.error('Auto-sync Gmail error:', err);
    }
  }

  // Fetch from Slack
  if (SlackService.getConnection().status === 'connected') {
    try {
      const slackMsgs = await SlackService.fetchMessages(20);
      newMessages.push(...slackMsgs);
    } catch (err) {
      console.error('Auto-sync Slack error:', err);
    }
  }

  // Fetch from Teams
  if (TeamsService.getConnection().status === 'connected') {
    try {
      const teamsMsgs = await TeamsService.fetchMessages(20);
      newMessages.push(...teamsMsgs);
    } catch (err) {
      console.error('Auto-sync Teams error:', err);
    }
  }

  messageStore = newMessages;
  messageStore.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  lastSyncTime = new Date();
  console.log(`📬 Auto-synced ${messageStore.length} messages`);
}

/* ─── GET /api/messages ────────────────────────────────── */

router.get('/', async (req: Request, res: Response) => {
  try {
    // Auto-fetch messages on cold start (stateless Cloud Functions)
    await autoSyncIfEmpty();

    const { channel, status, priority, search, limit } = req.query;

    let filtered = [...messageStore];

    // Apply filters
    if (channel && channel !== 'all') {
      filtered = filtered.filter(m => m.channel === channel);
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(m => m.status === status);
    }
    if (priority && priority !== 'all') {
      filtered = filtered.filter(m => m.priority === priority);
    }
    if (search) {
      const q = (search as string).toLowerCase();
      filtered = filtered.filter(m =>
        m.from.toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q)
      );
    }

    // Sort by received time (newest first)
    filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    if (limit) {
      filtered = filtered.slice(0, parseInt(limit as string, 10));
    }

    const channels: Record<Channel, number> = {
      email: messageStore.filter(m => m.channel === 'email').length,
      slack: messageStore.filter(m => m.channel === 'slack').length,
      teams: messageStore.filter(m => m.channel === 'teams').length,
    };

    const response: APIResponse<MessagesResponse> = {
      success: true,
      data: {
        messages: filtered,
        total: filtered.length,
        channels,
      },
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch messages',
    });
  }
});

/* ─── GET /api/messages/:id ────────────────────────────── */

router.get('/:id', (req: Request, res: Response) => {
  const message = messageStore.find(m => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ success: false, error: 'Message not found' });
    return;
  }
  res.json({ success: true, data: message });
});

/* ─── POST /api/messages/:id/draft ─────────────────────── */

router.post('/:id/draft', async (req: Request, res: Response) => {
  try {
    const message = messageStore.find(m => m.id === req.params.id);
    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    const { feedback } = req.body || {};

    // Generate AI response using the engine
    const result = feedback
      ? await AIEngine.regenerateWithFeedback(message, feedback)
      : await AIEngine.generateResponse(message);

    // Update the message in store
    message.aiDraft = result.draft;
    message.aiConfidence = result.confidence;
    message.status = 'ai_drafted';

    res.json({
      success: true,
      data: {
        messageId: message.id,
        draft: result.draft,
        confidence: result.confidence,
        analysis: result.analysis,
        reasoning: result.reasoning,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate draft',
    });
  }
});

/* ─── POST /api/messages/:id/send ──────────────────────── */

router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const message = messageStore.find(m => m.id === req.params.id);
    if (!message) {
      res.status(404).json({ success: false, error: 'Message not found' });
      return;
    }

    const draftText = req.body?.draft || message.aiDraft;
    if (!draftText) {
      res.status(400).json({ success: false, error: 'No draft to send' });
      return;
    }

    let sent = false;

    switch (message.channel) {
      case 'email':
        sent = await GmailService.sendReply(message.externalId, draftText);
        break;

      case 'slack': {
        const meta = message.metadata as any;
        sent = await SlackService.sendReply(
          meta?.channelId,
          draftText,
          meta?.threadTs || meta?.ts
        );
        break;
      }

      case 'teams': {
        const meta = message.metadata as any;
        if (meta?.teamId && meta?.channelId) {
          sent = await TeamsService.sendChannelReply(
            meta.teamId,
            meta.channelId,
            meta.messageId,
            draftText
          );
        } else if (meta?.chatId) {
          sent = await TeamsService.sendReply(meta.chatId, draftText);
        }
        break;
      }
    }

    if (sent) {
      message.status = 'sent';
    }

    res.json({
      success: sent,
      data: { messageId: message.id, status: message.status },
      message: sent ? 'Response sent successfully' : 'Failed to send',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send message',
    });
  }
});

/* ─── PUT /api/messages/:id ────────────────────────────── */

router.put('/:id', (req: Request, res: Response) => {
  const message = messageStore.find(m => m.id === req.params.id);
  if (!message) {
    res.status(404).json({ success: false, error: 'Message not found' });
    return;
  }

  const { starred, status, aiDraft, priority } = req.body;

  if (starred !== undefined) message.starred = starred;
  if (status) message.status = status;
  if (aiDraft) message.aiDraft = aiDraft;
  if (priority) message.priority = priority;

  res.json({ success: true, data: message });
});

/* ─── POST /api/messages/sync ──────────────────────────── */

router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const results: { channel: string; count: number; error?: string }[] = [];
    const newMessages: UnifiedMessage[] = [];

    // Sync Gmail
    const gmailConn = GmailService.getConnection();
    if (gmailConn.status === 'connected') {
      try {
        const emails = await GmailService.fetchMessages(20);
        newMessages.push(...emails);
        results.push({ channel: 'email', count: emails.length });
      } catch (err) {
        results.push({
          channel: 'email',
          count: 0,
          error: err instanceof Error ? err.message : 'Sync failed',
        });
      }
    }

    // Sync Slack
    const slackConn = SlackService.getConnection();
    if (slackConn.status === 'connected') {
      try {
        const slackMsgs = await SlackService.fetchMessages(20);
        newMessages.push(...slackMsgs);
        results.push({ channel: 'slack', count: slackMsgs.length });
      } catch (err) {
        results.push({
          channel: 'slack',
          count: 0,
          error: err instanceof Error ? err.message : 'Sync failed',
        });
      }
    }

    // Sync Teams
    const teamsConn = TeamsService.getConnection();
    if (teamsConn.status === 'connected') {
      try {
        const teamsMsgs = await TeamsService.fetchMessages(20);
        newMessages.push(...teamsMsgs);
        results.push({ channel: 'teams', count: teamsMsgs.length });
      } catch (err) {
        results.push({
          channel: 'teams',
          count: 0,
          error: err instanceof Error ? err.message : 'Sync failed',
        });
      }
    }

    // Merge: add new messages, update existing ones
    for (const msg of newMessages) {
      const existing = messageStore.find(m => m.externalId === msg.externalId && m.channel === msg.channel);
      if (!existing) {
        messageStore.push(msg);
      }
    }

    // Sort by time
    messageStore.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    lastSyncTime = new Date();

    res.json({
      success: true,
      data: {
        results,
        totalMessages: messageStore.length,
        lastSync: lastSyncTime,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Sync failed',
    });
  }
});

/* ─── POST /api/messages/draft-all ─────────────────────── */

router.post('/draft-all', async (_req: Request, res: Response) => {
  try {
    const pendingMessages = messageStore.filter(m => m.status === 'pending');
    const results: { messageId: string; success: boolean; confidence?: number }[] = [];

    // Process in parallel (max 5 at a time)
    const batches: UnifiedMessage[][] = [];
    for (let i = 0; i < pendingMessages.length; i += 5) {
      batches.push(pendingMessages.slice(i, i + 5));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (msg) => {
          const result = await AIEngine.generateResponse(msg);
          msg.aiDraft = result.draft;
          msg.aiConfidence = result.confidence;
          msg.status = 'ai_drafted';
          return { messageId: msg.id, confidence: result.confidence };
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push({ ...r.value, success: true });
        } else {
          results.push({ messageId: 'unknown', success: false });
        }
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful: results.filter(r => r.success).length,
        results,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Auto-draft failed',
    });
  }
});

export { router as messagesRouter, messageStore };
