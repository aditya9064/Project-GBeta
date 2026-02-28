/* ═══════════════════════════════════════════════════════════
   Express App — Shared between Firebase Functions & local dev
   ═══════════════════════════════════════════════════════════ */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger } from './services/logger.js';
import { messagesRouter } from './routes/messages.js';
import { connectionsRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';
import { automationRouter, agentsRouter } from './routes/automation.js';
import { documentsRouter } from './routes/documents.js';
import { n8nRouter } from './routes/n8n.js';
import { browserRouter } from './routes/browser.js';
import { salesRouter } from './routes/sales.js';
import { computerRouter } from './routes/computer.js';

export const app = express();

/* ─── Middleware ────────────────────────────────────────── */

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

allowedOrigins.push(
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://localhost:5001',
);

if (process.env.FIREBASE_HOSTING_URL) {
  allowedOrigins.push(process.env.FIREBASE_HOSTING_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Global rate limit: 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter limit for AI / expensive endpoints: 15 per minute
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI rate limit exceeded. Please wait before making more requests.' },
});

/* ─── Routes ───────────────────────────────────────────── */

app.use('/api/messages', messagesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/automation', automationRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/n8n', n8nRouter);
app.use('/api/browser', aiLimiter, browserRouter);
app.use('/api/sales', salesRouter);
app.use('/api/computer', aiLimiter, computerRouter);

/* ─── Health check ─────────────────────────────────────── */

app.get('/api/health', async (_req, res) => {
  let firestoreStatus = 'unknown';
  try {
    const { getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (getApps().length > 0) {
      const db = getFirestore();
      await db.collection('agents').limit(1).get();
      firestoreStatus = 'connected';
    } else {
      firestoreStatus = 'not_initialized';
    }
  } catch {
    firestoreStatus = 'unavailable';
  }

  res.json({
    status: firestoreStatus === 'connected' || firestoreStatus === 'not_initialized' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      ai_engine: config.openai.apiKey ? 'configured' : 'needs_api_key',
      gmail: config.google.clientId ? 'configured' : 'needs_credentials',
      slack: config.slack.botToken ? 'configured' : 'needs_bot_token',
      teams: config.microsoft.clientId ? 'configured' : 'needs_credentials',
      n8n: config.n8n.apiKey ? 'configured' : 'needs_api_key',
      hubspot: config.hubspot.accessToken ? 'configured' : 'needs_access_token',
      browser: 'available',
      firestore: firestoreStatus,
    },
  });
});

