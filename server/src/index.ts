/* ═══════════════════════════════════════════════════════════
   Project GBeta — Communications AI Agent Backend
   
   Firebase Cloud Function (v2) that provides:
   - Unified inbox API (Gmail + Slack + Teams)
   - Custom AI response engine
   - OAuth connection management
   
   Deployed via: firebase deploy --only functions
   ═══════════════════════════════════════════════════════════ */

import { onRequest } from 'firebase-functions/v2/https';
import { app } from './app.js';

/* ═══════════════════════════════════════════════════════════
   Firebase Cloud Function Export
   
   The Express app is wrapped as a Firebase Cloud Function.
   Firebase Hosting rewrites route /api/** requests to this
   function, so everything stays on the same domain — no CORS
   issues in production.
   ═══════════════════════════════════════════════════════════ */

export const api = onRequest(
  {
    // Allow generous timeout for AI operations + bulk email fetching
    timeoutSeconds: 300,
    // 512MB for processing large inboxes
    memory: '512MiB',
    // Allow unauthenticated access (Firebase Hosting rewrites need this)
    invoker: 'public',
  },
  app
);
