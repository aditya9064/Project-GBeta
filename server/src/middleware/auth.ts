/* ═══════════════════════════════════════════════════════════
   Firebase Auth Middleware — Verifies ID tokens on every request

   Extracts the Bearer token from the Authorization header,
   verifies it with Firebase Admin, and attaches the decoded
   uid to req.userId for downstream route handlers.
   ═══════════════════════════════════════════════════════════ */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger, Metrics } from '../services/logger.js';

interface DecodedIdToken {
  uid: string;
  email?: string;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      firebaseUid?: string;
    }
  }
}

const isProduction = !!process.env.K_SERVICE;

async function verifyToken(token: string): Promise<DecodedIdToken | null> {
  try {
    const { getApps } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    if (getApps().length === 0) {
      if (!isProduction) {
        return { uid: 'dev-user', email: 'dev@localhost' };
      }
      return null;
    }
    return await getAuth().verifyIdToken(token) as DecodedIdToken;
  } catch {
    if (!isProduction) {
      return { uid: 'dev-user', email: 'dev@localhost' };
    }
    return null;
  }
}

/**
 * Middleware that requires a valid Firebase ID token.
 * Skips paths listed in `skipPaths` (health checks, OAuth callbacks).
 */
export function firebaseAuthMiddleware(options: {
  skipPaths?: string[];
  skipPrefixes?: string[];
} = {}): RequestHandler {
  const {
    skipPaths = [],
    skipPrefixes = [],
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (skipPaths.includes(req.path)) return next();
    if (skipPrefixes.some(prefix => req.path.startsWith(prefix))) return next();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (!isProduction) {
        req.userId = 'dev-user';
        req.userEmail = 'dev@localhost';
        req.firebaseUid = 'dev-user';
        return next();
      }
      Metrics.increment('security.auth_missing', 1);
      res.status(401).json({
        success: false,
        error: 'Authentication required. Provide a valid Bearer token.',
      });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = await verifyToken(token);

    if (!decoded) {
      Metrics.increment('security.auth_invalid', 1);
      logger.warn('Invalid or expired auth token', { ip: req.ip, path: req.path });
      res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token.',
      });
      return;
    }

    req.userId = decoded.uid;
    req.userEmail = decoded.email;
    req.firebaseUid = decoded.uid;

    next();
  };
}

/**
 * Optional auth — attaches user info if token is present, but doesn't reject.
 */
export function optionalAuth(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = await verifyToken(authHeader.slice(7));
      if (decoded) {
        req.userId = decoded.uid;
        req.userEmail = decoded.email;
        req.firebaseUid = decoded.uid;
      }
    }
    next();
  };
}
