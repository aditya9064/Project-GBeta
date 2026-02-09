/* ═══════════════════════════════════════════════════════════
   Slack Integration Service
   
   Uses the Slack Web API with a Bot Token to:
   - Fetch messages from channels the bot is in
   - Post replies and threaded messages
   - List channels and users
   - React to messages
   ═══════════════════════════════════════════════════════════ */

import { WebClient } from '@slack/web-api';
import { config } from '../config.js';
import type { UnifiedMessage, ChannelConnection } from '../types.js';

/* ─── State ────────────────────────────────────────────── */

let slackClient: WebClient | null = null;
let connectionState: ChannelConnection = {
  channel: 'slack',
  status: 'disconnected',
};

// Cache for user info to avoid repeated API calls
const userCache = new Map<string, { name: string; email?: string; avatar?: string }>();
const channelCache = new Map<string, { name: string; topic?: string }>();

/* ─── Helpers ──────────────────────────────────────────── */

function generateColor(name: string): string {
  const colors = ['#7C3AED', '#3B82F6', '#e07a3a', '#1a1a2e', '#d46b2c', '#EC4899', '#10B981', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/** Resolve a Slack user ID to their profile info */
async function resolveUser(userId: string): Promise<{ name: string; email?: string }> {
  if (userCache.has(userId)) return userCache.get(userId)!;
  if (!slackClient) return { name: userId };

  try {
    const result = await slackClient.users.info({ user: userId });
    const user = result.user as any;
    const info = {
      name: user?.real_name || user?.name || userId,
      email: user?.profile?.email,
      avatar: user?.profile?.image_48,
    };
    userCache.set(userId, info);
    return info;
  } catch {
    return { name: userId };
  }
}

/** Resolve a Slack channel ID to its name */
async function resolveChannel(channelId: string): Promise<{ name: string; topic?: string }> {
  if (channelCache.has(channelId)) return channelCache.get(channelId)!;
  if (!slackClient) return { name: channelId };

  try {
    const result = await slackClient.conversations.info({ channel: channelId });
    const channel = result.channel as any;
    const info = {
      name: channel?.name ? `#${channel.name}` : channelId,
      topic: channel?.topic?.value,
    };
    channelCache.set(channelId, info);
    return info;
  } catch {
    return { name: channelId };
  }
}

/** Strip Slack mrkdwn formatting to plain text */
function stripSlackFormatting(text: string): string {
  return text
    .replace(/<@(\w+)>/g, '@user')     // User mentions
    .replace(/<#(\w+)\|([^>]+)>/g, '#$2') // Channel mentions
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2') // Links with labels
    .replace(/<(https?:\/\/[^>]+)>/g, '$1') // Plain links
    .replace(/\*([^*]+)\*/g, '$1')      // Bold
    .replace(/_([^_]+)_/g, '$1')        // Italic
    .replace(/~([^~]+)~/g, '$1')        // Strikethrough
    .replace(/```[\s\S]*?```/g, '[code block]') // Code blocks
    .replace(/`([^`]+)`/g, '$1');       // Inline code
}

/* ─── Public API ───────────────────────────────────────── */

export const SlackService = {
  /** Connect to Slack using a bot token */
  async connect(botToken?: string): Promise<ChannelConnection> {
    const token = botToken || config.slack.botToken;
    if (!token) {
      connectionState = {
        channel: 'slack',
        status: 'error',
        error: 'No bot token provided',
      };
      throw new Error('Slack bot token is required');
    }

    try {
      slackClient = new WebClient(token);

      // Verify the token by calling auth.test
      const authResult = await slackClient.auth.test();

      connectionState = {
        channel: 'slack',
        status: 'connected',
        accountName: (authResult as any).user || 'Slack Bot',
        accountEmail: (authResult as any).team || undefined,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      };

      return connectionState;
    } catch (err) {
      slackClient = null;
      connectionState = {
        channel: 'slack',
        status: 'error',
        error: err instanceof Error ? err.message : 'Connection failed',
      };
      throw err;
    }
  },

  /** Fetch recent messages from channels the bot is in */
  async fetchMessages(limit = 20): Promise<UnifiedMessage[]> {
    if (!slackClient) throw new Error('Slack not connected');

    const messages: UnifiedMessage[] = [];

    try {
      // Get channels the bot is a member of
      const channelsResult = await slackClient.conversations.list({
        types: 'public_channel,private_channel,im,mpim',
        limit: 50,
      });

      const channels = (channelsResult.channels || []) as any[];

      // Fetch recent messages from each channel (up to limit)
      let remaining = limit;

      for (const channel of channels) {
        if (remaining <= 0) break;

        try {
          const historyResult = await slackClient.conversations.history({
            channel: channel.id,
            limit: Math.min(remaining, 10),
          });

          const channelInfo = await resolveChannel(channel.id);

          for (const msg of (historyResult.messages || []) as any[]) {
            // Skip bot messages and system messages
            if (msg.subtype || msg.bot_id) continue;
            if (!msg.text) continue;

            const userInfo = await resolveUser(msg.user || 'unknown');
            const timestamp = new Date(parseFloat(msg.ts) * 1000);
            const plainText = stripSlackFormatting(msg.text);

            // Get thread reply count
            let threadCount: number | undefined;
            if (msg.reply_count && msg.reply_count > 0) {
              threadCount = msg.reply_count;
            }

            messages.push({
              id: `slack-${channel.id}-${msg.ts}`,
              externalId: msg.ts,
              channel: 'slack',
              from: userInfo.name,
              fromEmail: userInfo.email,
              fromInitial: getInitials(userInfo.name),
              fromColor: generateColor(userInfo.name),
              slackChannel: channelInfo.name,
              preview: plainText.slice(0, 200),
              fullMessage: plainText,
              receivedAt: timestamp,
              receivedTime: timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }),
              relativeTime: getRelativeTime(timestamp),
              priority: msg.text.includes('urgent') || msg.text.includes('ASAP') ? 'high' : 'medium',
              status: 'pending',
              starred: false,
              threadCount,
              metadata: {
                channelId: channel.id,
                ts: msg.ts,
                threadTs: msg.thread_ts,
              },
            });

            remaining--;
          }
        } catch (err) {
          console.error(`Error fetching messages from channel ${channel.id}:`, err);
        }
      }

      connectionState.lastSyncAt = new Date();
      connectionState.messageCount = messages.length;
      return messages;
    } catch (err) {
      console.error('Error fetching Slack messages:', err);
      throw err;
    }
  },

  /** Post a reply (threaded if the original was in a thread) */
  async sendReply(
    channelId: string,
    text: string,
    threadTs?: string
  ): Promise<boolean> {
    if (!slackClient) throw new Error('Slack not connected');

    await slackClient.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: threadTs,
    });

    return true;
  },

  /** React to a message with an emoji */
  async addReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    if (!slackClient) throw new Error('Slack not connected');

    await slackClient.reactions.add({
      channel: channelId,
      timestamp,
      name: emoji,
    });
  },

  /** Get current connection status */
  getConnection(): ChannelConnection {
    return connectionState;
  },

  /** Disconnect */
  disconnect(): void {
    slackClient = null;
    userCache.clear();
    channelCache.clear();
    connectionState = {
      channel: 'slack',
      status: 'disconnected',
    };
  },
};

