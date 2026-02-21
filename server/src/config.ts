import 'dotenv/config';

// Auto-detect production (Firebase Cloud Functions) vs local development
// K_SERVICE is set by Cloud Run (which Firebase Functions v2 uses under the hood)
const isProduction = !!process.env.K_SERVICE;
const PROD_URL = 'https://gbeta-a7ea6.web.app';
const LOCAL_URL = 'http://localhost:3001';

// In production, always use the Firebase Hosting URL for redirects
// In development, use .env values or fall back to localhost
function redirectUri(path: string): string {
  if (isProduction) return `${PROD_URL}${path}`;
  return `${LOCAL_URL}${path}`;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // Gmail / Google
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: redirectUri('/api/connections/gmail/callback'),
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  },

  // Slack OAuth — User Token Flow (per-user access to their own Slack)
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    redirectUri: redirectUri('/api/connections/slack/callback'),
    botToken: process.env.SLACK_BOT_TOKEN || '',
    // User token scopes — allows access to the user's own messages across all workspaces
    // These are requested via user_scope parameter, NOT scope (which is for bot tokens)
    userScopes: [
      'channels:read',           // View public channels user is in
      'channels:history',        // Read messages in public channels
      'groups:read',             // View private channels user is in
      'groups:history',          // Read messages in private channels
      'im:read',                 // View direct message channels
      'im:history',              // Read direct messages
      'mpim:read',               // View group DM channels
      'mpim:history',            // Read group DM messages
      'users:read',              // View user profiles
      'users:read.email',        // View user email addresses
      'chat:write',              // Send messages (for AI replies)
      'reactions:read',          // View reactions on messages
      'reactions:write',         // Add reactions to messages
    ],
    // Legacy bot scopes (kept for backward compatibility if needed)
    scopes: [],
  },

  // Microsoft Teams / Graph
  microsoft: {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    tenantId: process.env.MS_TENANT_ID || '',
    redirectUri: redirectUri('/api/connections/teams/callback'),
    scopes: [
      'https://graph.microsoft.com/Chat.Read',
      'https://graph.microsoft.com/Chat.ReadWrite',
      'https://graph.microsoft.com/ChannelMessage.Read.All',
      'https://graph.microsoft.com/User.Read',
    ],
  },

  // n8n — Self-hosted automation engine
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || '',
  },

  // Firebase (project ID is auto-detected in Cloud Functions runtime)
  firebase: {
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'gbeta-a7ea6',
  },

  // Frontend URL (for CORS & redirects)
  frontendUrl: isProduction ? PROD_URL : (process.env.FRONTEND_URL || 'http://localhost:5173'),
} as const;
