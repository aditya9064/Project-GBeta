/* ═══════════════════════════════════════════════════════════
   Slack Integration Service — USER TOKEN OAuth
   
   Uses User Token OAuth (not Bot Token) so each user can connect
   their own Slack account and access ALL their messages:
   - Direct messages (DMs)
   - Private channels they're in
   - Public channels they're in
   - Group DMs
   
   This works across ANY workspace the user is part of, without
   requiring them to install a bot to that workspace.
   
   OAuth Flow:
   1. User clicks "Connect Slack" → redirected to Slack consent screen
   2. User authorizes with their personal Slack account
   3. We receive a USER token (xoxp-...) not a bot token (xoxb-...)
   4. User can now access all their personal Slack messages
   ═══════════════════════════════════════════════════════════ */

import { WebClient } from '@slack/web-api';
import { config } from '../config.js';
import { TokenStore } from './tokenStore.js';
import type { UnifiedMessage, ChannelConnection } from '../types.js';

/* ─── State ────────────────────────────────────────────── */

let slackClient: WebClient | null = null;
let currentUserId: string | null = null; // The authenticated user's Slack ID
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
  /** Restore tokens from Firestore if not already connected in-memory */
  async restoreFromStore(): Promise<void> {
    if (connectionState.status === 'connected' && slackClient) return;

    const stored = await TokenStore.load('slack');
    if (!stored) return;

    try {
      const token = stored.tokens.userToken as string;
      if (!token) return;

      slackClient = new WebClient(token);
      currentUserId = (stored.tokens.userId as string) || null;
      connectionState = stored.connection as unknown as ChannelConnection;
      console.log('🔄 Slack: Restored tokens from Firestore');
    } catch (err) {
      console.error('❌ Slack: Failed to restore tokens:', err);
    }
  },

  /** Generate the Slack OAuth2 authorization URL (User Token flow) */
  getAuthUrl(): string {
    const clientId = config.slack.clientId;
    if (!clientId) throw new Error('SLACK_CLIENT_ID is not configured');

    // Use user_scope for user token (personal access to user's Slack)
    // NOT scope (which is for bot tokens that require workspace installation)
    const userScopes = config.slack.userScopes.join(',');
    const redirectUri = encodeURIComponent(config.slack.redirectUri);
    const state = Math.random().toString(36).substring(2, 15); // CSRF protection

    // user_scope parameter requests user token scopes (results in xoxp- token)
    // This allows users to connect their personal Slack without workspace admin approval
    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${userScopes}&redirect_uri=${redirectUri}&state=${state}`;
  },

  /** Handle the OAuth callback — exchange code for USER token */
  async handleCallback(code: string): Promise<ChannelConnection> {
    const clientId = config.slack.clientId;
    const clientSecret = config.slack.clientSecret;
    if (!clientId || !clientSecret) {
      throw new Error('Slack OAuth credentials not configured');
    }

    try {
      // Exchange code for access token using Slack's oauth.v2.access
      const tempClient = new WebClient();
      const oauthResult = await tempClient.oauth.v2.access({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      }) as any;

      if (!oauthResult.ok) {
        throw new Error(oauthResult.error || 'OAuth exchange failed');
      }

      // For USER TOKEN flow, the token is in authed_user.access_token (xoxp-...)
      // NOT in access_token (which would be a bot token xoxb-...)
      const userToken = oauthResult.authed_user?.access_token;
      const userId = oauthResult.authed_user?.id;
      const teamName = oauthResult.team?.name || 'Slack';

      if (!userToken) {
        throw new Error('No user token received. Make sure user_scope is configured in the Slack app.');
      }

      console.log(`✓ Slack user token obtained for user ${userId} in workspace "${teamName}"`);

      // Initialize client with the USER token (allows personal message access)
      slackClient = new WebClient(userToken);
      currentUserId = userId; // Store the user's ID for filtering their own messages

      // Verify and get user info
      const authResult = await slackClient.auth.test() as any;
      
      // Get the user's profile for display name
      let displayName = authResult.user || 'Slack User';
      let email: string | undefined;
      
      try {
        const userInfo = await slackClient.users.info({ user: userId }) as any;
        displayName = userInfo.user?.real_name || userInfo.user?.name || displayName;
        email = userInfo.user?.profile?.email;
      } catch {
        // User info fetch failed, use fallback
      }

      connectionState = {
        channel: 'slack',
        status: 'connected',
        accountName: displayName,
        accountEmail: email || `${teamName} Workspace`,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      };

      // Persist tokens to Firestore
      await TokenStore.save('slack',
        { userToken, userId, teamName },
        connectionState as unknown as Record<string, unknown>
      );

      return connectionState;
    } catch (err) {
      slackClient = null;
      connectionState = {
        channel: 'slack',
        status: 'error',
        error: err instanceof Error ? err.message : 'OAuth failed',
      };
      throw err;
    }
  },

  /** Connect to Slack using a user token (for direct token method / dev) 
   *  Note: For production, use OAuth flow via getAuthUrl() → handleCallback()
   */
  async connect(userToken?: string): Promise<ChannelConnection> {
    const token = userToken || config.slack.botToken;
    if (!token) {
      connectionState = {
        channel: 'slack',
        status: 'error',
        error: 'No Slack token provided',
      };
      throw new Error('Slack user token is required');
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

  /** Fetch recent messages from ALL the user's Slack conversations
   *  (DMs, private channels, public channels, group DMs)
   */
  async fetchMessages(limit = 20): Promise<UnifiedMessage[]> {
    if (!slackClient) throw new Error('Slack not connected');

    const messages: UnifiedMessage[] = [];

    try {
      // Get ALL conversations the user is part of (not just where a bot is added)
      // With user token, this returns ALL their DMs, private channels, etc.
      const channelsResult = await slackClient.conversations.list({
        types: 'public_channel,private_channel,im,mpim',
        limit: 100, // Get more channels since user likely has many
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

  /**
   * Fetch the USER's OWN sent messages for voice learning.
   * This analyzes how the user writes to build their personal style profile.
   */
  async fetchSentMessages(limit = 100): Promise<UnifiedMessage[]> {
    if (!slackClient) throw new Error('Slack not connected');
    
    // Get the current user's ID if we don't have it
    if (!currentUserId) {
      try {
        const authResult = await slackClient.auth.test() as any;
        currentUserId = authResult.user_id;
      } catch {
        throw new Error('Could not determine current user ID');
      }
    }

    const messages: UnifiedMessage[] = [];

    try {
      // Get all conversations the user is part of
      const channelsResult = await slackClient.conversations.list({
        types: 'public_channel,private_channel,im,mpim',
        limit: 100,
      });

      const channels = (channelsResult.channels || []) as any[];
      let remaining = limit;

      for (const channel of channels) {
        if (remaining <= 0) break;

        try {
          // Fetch more messages since we're filtering for user's own
          const historyResult = await slackClient.conversations.history({
            channel: channel.id,
            limit: 100, // Get more to filter
          });

          const channelInfo = await resolveChannel(channel.id);

          for (const msg of (historyResult.messages || []) as any[]) {
            // ONLY include messages from the current user
            if (msg.user !== currentUserId) continue;
            if (!msg.text) continue;
            if (remaining <= 0) break;

            const userInfo = await resolveUser(msg.user);
            const timestamp = new Date(parseFloat(msg.ts) * 1000);
            const plainText = stripSlackFormatting(msg.text);

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
              priority: 'medium',
              status: 'pending',
              starred: false,
              isFromUser: true, // This is the user's own message
              metadata: {
                channelId: channel.id,
                ts: msg.ts,
              },
            });

            remaining--;
          }
        } catch (err) {
          console.error(`Error fetching messages from channel ${channel.id}:`, err);
        }
      }

      console.log(`📧 Slack: Fetched ${messages.length} of user's own messages for voice learning`);
      return messages;
    } catch (err) {
      console.error('Error fetching user sent messages from Slack:', err);
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
    currentUserId = null;
    userCache.clear();
    channelCache.clear();
    connectionState = {
      channel: 'slack',
      status: 'disconnected',
    };
    TokenStore.delete('slack').catch(() => {});
  }
};

