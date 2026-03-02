/* ═══════════════════════════════════════════════════════════
   Audit Log API Routes
   
   Endpoints for querying and managing audit logs.
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { AuditLog, AuditCategory, AuditAction, AuditOutcome } from '../services/auditLog.js';
import { logger } from '../services/logger.js';

export const auditRouter = Router();

/**
 * GET /api/audit
 * Query audit logs with filters
 */
auditRouter.get('/', async (req: Request, res: Response) => {
  try {
    const {
      actorId,
      category,
      action,
      outcome,
      resourceType,
      resourceId,
      flaggedOnly,
      startDate,
      endDate,
      limit,
    } = req.query;

    const events = await AuditLog.query({
      actorId: actorId as string,
      category: category as AuditCategory,
      action: action as AuditAction,
      outcome: outcome as AuditOutcome,
      resourceType: resourceType as string,
      resourceId: resourceId as string,
      flaggedOnly: flaggedOnly === 'true',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 100,
    });

    res.json({ success: true, events, count: events.length });
  } catch (err) {
    logger.error('Failed to query audit logs', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to query audit logs' 
    });
  }
});

/**
 * GET /api/audit/flagged
 * Get flagged events requiring review
 */
auditRouter.get('/flagged', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const events = await AuditLog.getFlaggedEvents(limit);

    res.json({ success: true, events, count: events.length });
  } catch (err) {
    logger.error('Failed to get flagged events', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get flagged events' 
    });
  }
});

/**
 * GET /api/audit/high-risk
 * Get recent high-risk events
 */
auditRouter.get('/high-risk', async (req: Request, res: Response) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const events = await AuditLog.getHighRiskEvents(hours, limit);

    res.json({ success: true, events, count: events.length });
  } catch (err) {
    logger.error('Failed to get high-risk events', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get high-risk events' 
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics for a date range
 */
auditRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate 
      ? new Date(req.query.startDate as string) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const endDate = req.query.endDate 
      ? new Date(req.query.endDate as string) 
      : new Date();

    const stats = await AuditLog.getStats(startDate, endDate);

    res.json({ 
      success: true, 
      stats,
      period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    });
  } catch (err) {
    logger.error('Failed to get audit stats', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get audit stats' 
    });
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit trail for a specific user
 */
auditRouter.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const events = await AuditLog.query({
      actorId: userId,
      limit,
    });

    res.json({ success: true, events, count: events.length });
  } catch (err) {
    logger.error('Failed to get user audit trail', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get user audit trail' 
    });
  }
});

/**
 * GET /api/audit/resource/:resourceType/:resourceId
 * Get audit trail for a specific resource
 */
auditRouter.get('/resource/:resourceType/:resourceId', async (req: Request, res: Response) => {
  try {
    const resourceType = req.params.resourceType as string;
    const resourceId = req.params.resourceId as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const events = await AuditLog.query({
      resourceType,
      resourceId,
      limit,
    });

    res.json({ success: true, events, count: events.length });
  } catch (err) {
    logger.error('Failed to get resource audit trail', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get resource audit trail' 
    });
  }
});
