/* ═══════════════════════════════════════════════════════════
   Gmail Integration Service
   
   Handles OAuth2 authentication and Gmail API operations:
   - Generate OAuth consent URL
   - Exchange authorization code for tokens
   - Fetch inbox messages
   - Send replies
   - Mark messages as read/archived
   ═══════════════════════════════════════════════════════════ */

import { google, gmail_v1 } from 'googleapis';
import { config } from '../config.js';
import type { UnifiedMessage, ChannelConnection, Attachment } from '../types.js';

const { OAuth2 } = google.auth;

/* ─── State ────────────────────────────────────────────── */

let oauth2Client = new OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

let gmailClient: gmail_v1.Gmail | null = null;
let connectionState: ChannelConnection = {
  channel: 'email',
  status: 'disconnected',
};

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

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
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

function extractEmailBody(payload: gmail_v1.Schema$MessagePart): string {
  // Try to get text/plain body directly
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // For multipart messages, recurse through parts
  if (payload.parts) {
    // Prefer text/plain over text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fall back to HTML (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    }
    // Recursively check nested multipart
    for (const part of payload.parts) {
      const result = extractEmailBody(part);
      if (result) return result;
    }
  }

  return '';
}

function extractAttachments(payload: gmail_v1.Schema$MessagePart): Attachment[] {
  const attachments: Attachment[] = [];

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          name: part.filename,
          size: part.body?.size ? formatBytes(part.body.size) : 'Unknown',
          mimeType: part.mimeType || undefined,
        });
      }
      // Recurse for nested parts
      attachments.push(...extractAttachments(part));
    }
  }

  return attachments;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getHeaderValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

/* ─── Public API ───────────────────────────────────────── */

export const GmailService = {
  /** Generate the OAuth2 consent URL for Gmail */
  getAuthUrl(): string {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [...config.google.scopes],
      prompt: 'consent',
    });
  },

  /** Exchange an authorization code for tokens and initialize the Gmail client */
  async handleCallback(code: string): Promise<ChannelConnection> {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get user profile
      const profile = await gmailClient.users.getProfile({ userId: 'me' });

      connectionState = {
        channel: 'email',
        status: 'connected',
        accountEmail: profile.data.emailAddress || undefined,
        accountName: profile.data.emailAddress?.split('@')[0] || undefined,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        scopes: [...config.google.scopes],
      };

      return connectionState;
    } catch (err) {
      connectionState = {
        channel: 'email',
        status: 'error',
        error: err instanceof Error ? err.message : 'Authentication failed',
      };
      throw err;
    }
  },

  /** Set tokens directly (e.g. from stored refresh token) */
  async setTokens(tokens: { access_token?: string; refresh_token?: string }): Promise<void> {
    oauth2Client.setCredentials(tokens);
    gmailClient = google.gmail({ version: 'v1', auth: oauth2Client });

    const profile = await gmailClient.users.getProfile({ userId: 'me' });
    connectionState = {
      channel: 'email',
      status: 'connected',
      accountEmail: profile.data.emailAddress || undefined,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    };
  },

  /** Fetch recent inbox messages and convert to UnifiedMessage format */
  async fetchMessages(maxResults = 20): Promise<UnifiedMessage[]> {
    if (!gmailClient) throw new Error('Gmail not connected');

    const listRes = await gmailClient.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      q: 'is:unread OR is:important',
    });

    if (!listRes.data.messages) return [];

    const messages: UnifiedMessage[] = [];

    for (const msg of listRes.data.messages) {
      try {
        const detail = await gmailClient.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = detail.data.payload?.headers;
        const from = getHeaderValue(headers, 'From');
        const subject = getHeaderValue(headers, 'Subject');
        const date = getHeaderValue(headers, 'Date');

        // Parse sender name from "Name <email>" format
        const nameMatch = from.match(/^"?([^"<]+)"?\s*<?/);
        const senderName = nameMatch ? nameMatch[1].trim() : from.split('@')[0];

        const body = detail.data.payload ? extractEmailBody(detail.data.payload) : '';
        const attachments = detail.data.payload ? extractAttachments(detail.data.payload) : [];
        const receivedDate = date ? new Date(date) : new Date();

        // Thread count
        const threadId = detail.data.threadId;
        let threadCount = 1;
        if (threadId) {
          try {
            const thread = await gmailClient.users.threads.get({
              userId: 'me',
              id: threadId,
              format: 'minimal',
            });
            threadCount = thread.data.messages?.length || 1;
          } catch { /* ignore */ }
        }

        messages.push({
          id: `gmail-${msg.id}`,
          externalId: msg.id!,
          channel: 'email',
          from: senderName,
          fromEmail: from,
          fromInitial: getInitials(senderName),
          fromColor: generateColor(senderName),
          subject: subject || '(No Subject)',
          preview: body.slice(0, 200).replace(/\n/g, ' '),
          fullMessage: body,
          receivedAt: receivedDate,
          receivedTime: receivedDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          relativeTime: getRelativeTime(receivedDate),
          priority: detail.data.labelIds?.includes('IMPORTANT') ? 'high' : 'medium',
          status: 'pending',
          starred: detail.data.labelIds?.includes('STARRED') || false,
          attachments: attachments.length > 0 ? attachments : undefined,
          threadCount: threadCount > 1 ? threadCount : undefined,
          metadata: {
            threadId,
            labelIds: detail.data.labelIds,
            snippet: detail.data.snippet,
          },
        });
      } catch (err) {
        console.error(`Error fetching Gmail message ${msg.id}:`, err);
      }
    }

    connectionState.lastSyncAt = new Date();
    connectionState.messageCount = messages.length;
    return messages;
  },

  /** Send a reply to an email */
  async sendReply(messageId: string, replyBody: string): Promise<boolean> {
    if (!gmailClient) throw new Error('Gmail not connected');

    // Get the original message to build reply headers
    const original = await gmailClient.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = original.data.payload?.headers;
    const to = getHeaderValue(headers, 'From');
    const subject = getHeaderValue(headers, 'Subject');
    const messageIdHeader = getHeaderValue(headers, 'Message-ID');
    const references = getHeaderValue(headers, 'References');

    // Build RFC 2822 email
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const emailLines = [
      `To: ${to}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${messageIdHeader}`,
      `References: ${references ? `${references} ` : ''}${messageIdHeader}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      replyBody,
    ];

    const rawEmail = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawEmail,
        threadId: original.data.threadId || undefined,
      },
    });

    return true;
  },

  /** Get current connection status */
  getConnection(): ChannelConnection {
    return connectionState;
  },

  /** Disconnect Gmail */
  disconnect(): void {
    oauth2Client = new OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    gmailClient = null;
    connectionState = {
      channel: 'email',
      status: 'disconnected',
    };
  },
};

