/* ═══════════════════════════════════════════════════════════
   Project GBeta — Communications AI Agent Backend
   
   Express server that provides:
   - Unified inbox API (Gmail + Slack + Teams)
   - Custom AI response engine
   - OAuth connection management
   ═══════════════════════════════════════════════════════════ */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { messagesRouter } from './routes/messages.js';
import { connectionsRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';

const app = express();

/* ─── Middleware ────────────────────────────────────────── */

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

/* ─── Routes ───────────────────────────────────────────── */

app.use('/api/messages', messagesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/ai', aiRouter);

/* ─── Health check ─────────────────────────────────────── */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ai_engine: !!config.openai.apiKey ? 'configured' : 'needs_api_key',
      gmail: !!config.google.clientId ? 'configured' : 'needs_credentials',
      slack: !!config.slack.botToken ? 'configured' : 'needs_bot_token',
      teams: !!config.microsoft.clientId ? 'configured' : 'needs_credentials',
    },
  });
});

/* ─── Start ────────────────────────────────────────────── */

app.listen(config.port, () => {
  console.log(`\n🚀 Communications AI Agent Server`);
  console.log(`   Running on http://localhost:${config.port}`);
  console.log(`   Frontend:  ${config.frontendUrl}\n`);
  console.log(`   Services:`);
  console.log(`   ├─ AI Engine:  ${config.openai.apiKey ? '✅ Ready' : '⚠️  Set OPENAI_API_KEY'}`);
  console.log(`   ├─ Gmail:     ${config.google.clientId ? '✅ Ready' : '⚠️  Set GOOGLE_CLIENT_ID'}`);
  console.log(`   ├─ Slack:     ${config.slack.botToken ? '✅ Ready' : '⚠️  Set SLACK_BOT_TOKEN'}`);
  console.log(`   └─ Teams:     ${config.microsoft.clientId ? '✅ Ready' : '⚠️  Set MS_CLIENT_ID'}`);
  console.log(`\n   API routes:`);
  console.log(`   ├─ GET  /api/messages`);
  console.log(`   ├─ POST /api/messages/:id/draft`);
  console.log(`   ├─ POST /api/messages/:id/send`);
  console.log(`   ├─ POST /api/messages/sync`);
  console.log(`   ├─ POST /api/messages/draft-all`);
  console.log(`   ├─ GET  /api/connections`);
  console.log(`   ├─ POST /api/ai/analyze`);
  console.log(`   ├─ POST /api/ai/generate`);
  console.log(`   └─ GET  /api/health\n`);
});

export default app;

