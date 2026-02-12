/* ═══════════════════════════════════════════════════════════
   Microsoft Teams Integration Service
   
   Uses MSAL + Microsoft Graph API to:
   - Authenticate via OAuth2
   - Fetch chat and channel messages
   - Send replies
   - List teams and channels
   ═══════════════════════════════════════════════════════════ */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { config } from '../config.js';
import { TokenStore } from './tokenStore.js';
import type { UnifiedMessage, ChannelConnection } from '../types.js';

/* ─── State ────────────────────────────────────────────── */

let msalClient: ConfidentialClientApplication | null = null;
let graphClient: Client | null = null;
let accessToken: string | null = null;
let connectionState: ChannelConnection = {
  channel: 'teams',
  status: 'disconnected',
};

/* ─── Helpers ──────────────────────────────────────────── */

function generateColor(name: string): string {
  const colors = ['#7C3AED', '#3B82F6', '#e07a3a', '#1a1a2e', '#d46b2c', '#EC4899', '#10B981', '#6264A7'];
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

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/** Initialize MSAL client */
function ensureMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.microsoft.clientId,
        clientSecret: config.microsoft.clientSecret,
        authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`,
      },
    });
  }
  return msalClient;
}

/** Create a Graph client with the current access token */
function createGraphClient(token: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

/* ─── Public API ───────────────────────────────────────── */

export const TeamsService = {
  /** Restore tokens from Firestore if not already connected in-memory */
  async restoreFromStore(): Promise<void> {
    if (connectionState.status === 'connected' && graphClient) return;

    const stored = await TokenStore.load('teams');
    if (!stored) return;

    try {
      const token = stored.tokens.accessToken as string;
      if (!token) return;

      accessToken = token;
      graphClient = createGraphClient(token);
      connectionState = stored.connection as unknown as ChannelConnection;
      console.log('🔄 Teams: Restored tokens from Firestore');
    } catch (err) {
      console.error('❌ Teams: Failed to restore tokens:', err);
    }
  },

  /** Generate the OAuth2 authorization URL */
  getAuthUrl(): string {
    const msal = ensureMsalClient();
    const authUrl = `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${config.microsoft.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(config.microsoft.redirectUri)}` +
      `&scope=${encodeURIComponent(config.microsoft.scopes.join(' '))}` +
      `&response_mode=query`;
    return authUrl;
  },

  /** Exchange authorization code for tokens */
  async handleCallback(code: string): Promise<ChannelConnection> {
    const msal = ensureMsalClient();

    try {
      const tokenResponse = await msal.acquireTokenByCode({
        code,
        scopes: [...config.microsoft.scopes],
        redirectUri: config.microsoft.redirectUri,
      });

      accessToken = tokenResponse.accessToken;
      graphClient = createGraphClient(accessToken);

      // Get user profile
      const me = await graphClient.api('/me').get();

      connectionState = {
        channel: 'teams',
        status: 'connected',
        accountEmail: me.mail || me.userPrincipalName,
        accountName: me.displayName,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        scopes: [...config.microsoft.scopes],
      };

      // Persist tokens to Firestore
      await TokenStore.save('teams',
        { accessToken: tokenResponse.accessToken },
        connectionState as unknown as Record<string, unknown>
      );

      return connectionState;
    } catch (err) {
      connectionState = {
        channel: 'teams',
        status: 'error',
        error: err instanceof Error ? err.message : 'Authentication failed',
      };
      throw err;
    }
  },

  /** Set access token directly */
  async setToken(token: string): Promise<void> {
    accessToken = token;
    graphClient = createGraphClient(token);

    const me = await graphClient.api('/me').get();
    connectionState = {
      channel: 'teams',
      status: 'connected',
      accountEmail: me.mail || me.userPrincipalName,
      accountName: me.displayName,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    };
  },

  /** Fetch recent Teams messages (from chats and channels) */
  async fetchMessages(limit = 20): Promise<UnifiedMessage[]> {
    if (!graphClient) throw new Error('Teams not connected');

    const messages: UnifiedMessage[] = [];

    try {
      /* ── 1. Fetch 1:1 and group chat messages ────── */
      const chatsResponse = await graphClient
        .api('/me/chats')
        .top(20)
        .orderby('lastMessagePreview/createdDateTime desc')
        .get();

      for (const chat of (chatsResponse.value || []).slice(0, Math.ceil(limit / 2))) {
        try {
          const messagesResponse = await graphClient
            .api(`/me/chats/${chat.id}/messages`)
            .top(5)
            .orderby('createdDateTime desc')
            .get();

          for (const msg of messagesResponse.value || []) {
            if (!msg.body?.content) continue;
            if (msg.messageType !== 'message') continue;

            const senderName = msg.from?.user?.displayName || 'Unknown';
            const body = msg.body.contentType === 'html'
              ? stripHtml(msg.body.content)
              : msg.body.content;
            const timestamp = new Date(msg.createdDateTime);

            // Determine chat name
            let teamsChannel = chat.topic || 'Direct Message';
            if (chat.chatType === 'group') {
              teamsChannel = chat.topic || 'Group Chat';
            }

            messages.push({
              id: `teams-${chat.id}-${msg.id}`,
              externalId: msg.id,
              channel: 'teams',
              from: senderName,
              fromEmail: msg.from?.user?.email,
              fromInitial: getInitials(senderName),
              fromColor: generateColor(senderName),
              teamsChannel,
              preview: body.slice(0, 200),
              fullMessage: body,
              receivedAt: timestamp,
              receivedTime: timestamp.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }),
              relativeTime: getRelativeTime(timestamp),
              priority: body.toLowerCase().includes('urgent') ? 'high' : 'medium',
              status: 'pending',
              starred: msg.importance === 'high',
              metadata: {
                chatId: chat.id,
                messageId: msg.id,
                chatType: chat.chatType,
              },
            });
          }
        } catch (err) {
          console.error(`Error fetching messages from chat ${chat.id}:`, err);
        }
      }

      /* ── 2. Fetch channel messages from joined teams ── */
      try {
        const teamsResponse = await graphClient.api('/me/joinedTeams').get();

        for (const team of (teamsResponse.value || []).slice(0, 5)) {
          const channelsResponse = await graphClient
            .api(`/teams/${team.id}/channels`)
            .get();

          for (const channel of (channelsResponse.value || []).slice(0, 3)) {
            try {
              const channelMsgs = await graphClient
                .api(`/teams/${team.id}/channels/${channel.id}/messages`)
                .top(5)
                .orderby('createdDateTime desc')
                .get();

              for (const msg of channelMsgs.value || []) {
                if (!msg.body?.content) continue;
                if (msg.messageType !== 'message') continue;

                const senderName = msg.from?.user?.displayName || 'Unknown';
                const body = msg.body.contentType === 'html'
                  ? stripHtml(msg.body.content)
                  : msg.body.content;
                const timestamp = new Date(msg.createdDateTime);

                messages.push({
                  id: `teams-ch-${channel.id}-${msg.id}`,
                  externalId: msg.id,
                  channel: 'teams',
                  from: senderName,
                  fromEmail: msg.from?.user?.email,
                  fromInitial: getInitials(senderName),
                  fromColor: generateColor(senderName),
                  teamsChannel: `${team.displayName} · ${channel.displayName}`,
                  preview: body.slice(0, 200),
                  fullMessage: body,
                  receivedAt: timestamp,
                  receivedTime: timestamp.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  }),
                  relativeTime: getRelativeTime(timestamp),
                  priority: msg.importance === 'high' ? 'high' : 'medium',
                  status: 'pending',
                  starred: msg.importance === 'high',
                  metadata: {
                    teamId: team.id,
                    channelId: channel.id,
                    messageId: msg.id,
                  },
                });
              }
            } catch (err) {
              console.error(`Error fetching channel messages:`, err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
      }

      // Sort by time (newest first) and limit
      messages.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

      connectionState.lastSyncAt = new Date();
      connectionState.messageCount = messages.length;
      return messages.slice(0, limit);
    } catch (err) {
      console.error('Error fetching Teams messages:', err);
      throw err;
    }
  },

  /** Send a reply to a Teams chat message */
  async sendReply(chatId: string, text: string): Promise<boolean> {
    if (!graphClient) throw new Error('Teams not connected');

    await graphClient.api(`/me/chats/${chatId}/messages`).post({
      body: {
        content: text,
        contentType: 'text',
      },
    });

    return true;
  },

  /** Send a reply to a Teams channel message */
  async sendChannelReply(
    teamId: string,
    channelId: string,
    messageId: string,
    text: string
  ): Promise<boolean> {
    if (!graphClient) throw new Error('Teams not connected');

    await graphClient
      .api(`/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`)
      .post({
        body: {
          content: text,
          contentType: 'text',
        },
      });

    return true;
  },

  /** Get current connection status */
  getConnection(): ChannelConnection {
    return connectionState;
  },

  /** Disconnect */
  disconnect(): void {
    graphClient = null;
    accessToken = null;
    connectionState = {
      channel: 'teams',
      status: 'disconnected',
    };
    TokenStore.delete('teams').catch(() => {});
  }
};

