/* ═══════════════════════════════════════════════════════════
   Express App — Shared between Firebase Functions & local dev
   ═══════════════════════════════════════════════════════════ */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger, Health } from './services/logger.js';
import { 
  observabilityMiddleware, 
  errorTrackingMiddleware,
  healthCheckHandler,
  livenessHandler,
  readinessHandler,
  metricsHandler as observabilityMetricsHandler,
  slowRequestMiddleware,
} from './middleware/observability.js';
import {
  inputSanitizationMiddleware,
  securityHeadersMiddleware,
} from './middleware/security.js';
import { messagesRouter } from './routes/messages.js';
import { connectionsRouter } from './routes/connections.js';
import { aiRouter } from './routes/ai.js';
import { automationRouter, agentsRouter } from './routes/automation.js';
import { documentsRouter } from './routes/documents.js';
import { n8nRouter } from './routes/n8n.js';
import { browserRouter } from './routes/browser.js';
import { salesRouter } from './routes/sales.js';
import { computerRouter } from './routes/computer.js';
import { crewsRouter } from './routes/crews.js';
import { feedbackRouter } from './routes/feedback.js';
import { metricsRouter } from './routes/metrics.js';
import { streamRouter } from './routes/stream.js';
import { escalationsRouter } from './routes/escalations.js';
import { budgetRouter } from './routes/budget.js';
import { templatesRouter } from './routes/templates.js';
import { analyticsRouter } from './routes/analytics.js';
import { rbacRouter } from './routes/rbac.js';
import { auditRouter } from './routes/audit.js';
import { apmRouter } from './routes/apm.js';
import { APM } from './services/apm.js';
import { schedulerRouter } from './routes/scheduler.js';
import { webhooksRouter } from './routes/webhooks.js';
import { Scheduler } from './services/scheduler.js';
import { organizationsRouter } from './routes/organizations.js';
import { operonRouter } from './routes/operon.js';

export const app = express();

/* ─── Register Health Checks ────────────────────────────── */

Health.register('firestore', async () => {
  try {
    const { getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (getApps().length > 0) {
      const db = getFirestore();
      await db.collection('agents').limit(1).get();
      return { status: 'pass' };
    }
    return { status: 'warn', message: 'Firebase not initialized' };
  } catch (err) {
    return { status: 'fail', message: err instanceof Error ? err.message : 'Unknown error' };
  }
});

Health.register('openai', async () => {
  return config.openai.apiKey 
    ? { status: 'pass' } 
    : { status: 'warn', message: 'API key not configured' };
});

Health.register('memory', async () => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const ratio = used.heapUsed / used.heapTotal;
  
  if (ratio > 0.9) {
    return { status: 'fail', message: `Memory critical: ${heapUsedMB}MB / ${heapTotalMB}MB` };
  }
  if (ratio > 0.7) {
    return { status: 'warn', message: `Memory high: ${heapUsedMB}MB / ${heapTotalMB}MB` };
  }
  return { status: 'pass', message: `${heapUsedMB}MB / ${heapTotalMB}MB` };
});

/* ─── Middleware ────────────────────────────────────────── */

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

allowedOrigins.push(
  config.frontendUrl,
  'https://operonagent.com',
  'https://www.operonagent.com',
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
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.web.app') ||
      origin.endsWith('.firebaseapp.com') ||
      origin.endsWith('.operonagent.com') ||
      origin === 'https://operonagent.com'
    ) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Security headers
app.use(securityHeadersMiddleware());

// Observability middleware - adds correlation IDs and request logging
app.use(observabilityMiddleware());

// Input sanitization and injection detection
app.use(inputSanitizationMiddleware({ sanitize: true, validate: true, blockOnIssues: false }));

// Slow request detection (warn after 5 seconds)
app.use(slowRequestMiddleware(5000));

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

// Browser/vision polling needs higher limits (polling every 2s = 30/min per session)
const browserLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Browser rate limit exceeded.' },
});

/* ─── Routes ───────────────────────────────────────────── */

app.use('/api/messages', messagesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/automation', automationRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/n8n', n8nRouter);
app.use('/api/browser', browserLimiter, browserRouter);
app.use('/api/sales', salesRouter);
app.use('/api/computer', aiLimiter, computerRouter);
app.use('/api/crews', crewsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/stream', streamRouter);
app.use('/api/escalations', escalationsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/rbac', rbacRouter);
app.use('/api/audit', auditRouter);
app.use('/api/apm', apmRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/organizations', organizationsRouter);

// Start APM collection
APM.start();

// Initialize scheduler
Scheduler.initialize();
app.use('/api/operon', aiLimiter, operonRouter);

/* ─── Health & Observability Endpoints ─────────────────── */

// Kubernetes-style probes
app.get('/healthz', livenessHandler());
app.get('/readyz', readinessHandler());

// Detailed health check
app.get('/api/health', healthCheckHandler());

// Prometheus-compatible metrics endpoint
app.get('/api/observability/metrics', observabilityMetricsHandler());

// Legacy health check for backward compatibility
app.get('/api/health/legacy', async (_req, res) => {
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

/* ─── Error Tracking (must be after routes) ─────────────── */

app.use(errorTrackingMiddleware());

