/* ═══════════════════════════════════════════════════════════
   Express App — Shared between Firebase Functions & local dev
   ═══════════════════════════════════════════════════════════ */

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { messagesRouter } from './routes/messages.js';
import { connectionsRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';
import { automationRouter } from './routes/automation.js';
import { documentsRouter } from './routes/documents.js';

export const app = express();

/* ─── Middleware ────────────────────────────────────────── */

// Allow CORS from frontend URL and Firebase hosting
const allowedOrigins = [
  config.frontendUrl,
  'https://gbeta-a7ea6.web.app',
  'https://gbeta-a7ea6.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001', // Firebase emulator
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or Firebase health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

/* ─── Routes ───────────────────────────────────────────── */

app.use('/api/messages', messagesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/automation', automationRouter);
app.use('/api/documents', documentsRouter);

/* ─── Health check ─────────────────────────────────────── */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'firebase-functions',
    services: {
      ai_engine: !!config.openai.apiKey ? 'configured' : 'needs_api_key',
      gmail: !!config.google.clientId ? 'configured' : 'needs_credentials',
      slack: !!config.slack.botToken ? 'configured' : 'needs_bot_token',
      teams: !!config.microsoft.clientId ? 'configured' : 'needs_credentials',
    },
  });
});

