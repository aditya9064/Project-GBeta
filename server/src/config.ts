import 'dotenv/config';

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
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/connections/gmail/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  },

  // Slack
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appId: process.env.SLACK_APP_ID || '',
  },

  // Microsoft Teams / Graph
  microsoft: {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    tenantId: process.env.MS_TENANT_ID || '',
    redirectUri: process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/connections/teams/callback',
    scopes: [
      'https://graph.microsoft.com/Chat.Read',
      'https://graph.microsoft.com/Chat.ReadWrite',
      'https://graph.microsoft.com/ChannelMessage.Read.All',
      'https://graph.microsoft.com/User.Read',
    ],
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  // Frontend URL (for CORS & redirects)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;

