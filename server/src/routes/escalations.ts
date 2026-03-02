/* ═══════════════════════════════════════════════════════════
   Escalation Routes — Human-in-the-loop review queue
   
   GET    /api/escalations              — List escalations
   GET    /api/escalations/:id          — Get single escalation
   GET    /api/escalations/summary      — Get summary stats
   POST   /api/escalations              — Create escalation
   PUT    /api/escalations/:id          — Update escalation
   POST   /api/escalations/:id/resolve  — Resolve escalation
   POST   /api/escalations/:id/dismiss  — Dismiss escalation
   POST   /api/escalations/:id/assign   — Assign to user
   DELETE /api/escalations/:id          — Delete escalation
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { 
  EscalationStore, 
  type EscalationType, 
  type EscalationStatus, 
  type EscalationPriority 
} from '../services/escalationStore.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/escalations/summary — Summary stats ─────────── */

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const summary = await EscalationStore.getSummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    logger.error('Get escalation summary error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get summary',
    });
  }
});

/* ─── GET /api/escalations — List escalations ─────────────── */

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const priority = req.query.priority as string | undefined;
    const agentId = req.query.agentId as string | undefined;
    const crewId = req.query.crewId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const limit = req.query.limit as string | undefined;

    const filters = {
      status: status ? status.split(',') as EscalationStatus[] : undefined,
      type: type ? type.split(',') as EscalationType[] : undefined,
      priority: priority ? priority.split(',') as EscalationPriority[] : undefined,
      agentId,
      crewId,
      userId,
      assignedTo,
    };

    const escalations = await EscalationStore.list(filters, Number(limit) || 50);

    res.json({
      success: true,
      data: escalations,
    });
  } catch (err) {
    logger.error('List escalations error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list escalations',
    });
  }
});

/* ─── GET /api/escalations/:id — Get single escalation ─────── */

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const escalation = await EscalationStore.get(req.params.id as string);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Get escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get escalation',
    });
  }
});

/* ─── POST /api/escalations — Create escalation ────────────── */

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      type,
      priority,
      title,
      description,
      agentId,
      agentName,
      crewId,
      crewName,
      executionId,
      nodeId,
      nodeName,
      errorMessage,
      context,
      originalOutput,
      suggestedAction,
      dueBy,
      userId,
    } = req.body;

    if (!type || !title || !description || !userId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: type, title, description, userId',
      });
      return;
    }

    const escalation = await EscalationStore.create({
      type,
      status: 'pending',
      priority: priority || 'medium',
      title,
      description,
      agentId,
      agentName,
      crewId,
      crewName,
      executionId,
      nodeId,
      nodeName,
      errorMessage,
      context,
      originalOutput,
      suggestedAction,
      dueBy,
      userId,
    });

    logger.info(`🚨 New escalation: ${title} [${priority || 'medium'}]`);

    res.status(201).json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Create escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create escalation',
    });
  }
});

/* ─── PUT /api/escalations/:id — Update escalation ─────────── */

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const escalation = await EscalationStore.update(req.params.id as string, updates);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found',
      });
      return;
    }

    res.json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Update escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update escalation',
    });
  }
});

/* ─── POST /api/escalations/:id/resolve — Resolve escalation ─ */

router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolution, resolvedBy, reviewerNotes } = req.body;

    if (!resolution || !resolvedBy) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: resolution, resolvedBy',
      });
      return;
    }

    const escalation = await EscalationStore.resolve(
      req.params.id as string,
      resolution,
      resolvedBy,
      reviewerNotes
    );

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found',
      });
      return;
    }

    logger.info(`✅ Escalation resolved: ${escalation.title}`);

    res.json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Resolve escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to resolve escalation',
    });
  }
});

/* ─── POST /api/escalations/:id/dismiss — Dismiss escalation ─ */

router.post('/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const { reason, dismissedBy } = req.body;

    if (!reason || !dismissedBy) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: reason, dismissedBy',
      });
      return;
    }

    const escalation = await EscalationStore.dismiss(
      req.params.id as string,
      reason,
      dismissedBy
    );

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found',
      });
      return;
    }

    logger.info(`🗑️ Escalation dismissed: ${escalation.title}`);

    res.json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Dismiss escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dismiss escalation',
    });
  }
});

/* ─── POST /api/escalations/:id/assign — Assign escalation ─── */

router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { assignedTo } = req.body;

    if (!assignedTo) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: assignedTo',
      });
      return;
    }

    const escalation = await EscalationStore.assign(req.params.id as string, assignedTo);

    if (!escalation) {
      res.status(404).json({
        success: false,
        error: 'Escalation not found',
      });
      return;
    }

    logger.info(`👤 Escalation assigned: ${escalation.title} -> ${assignedTo}`);

    res.json({
      success: true,
      data: escalation,
    });
  } catch (err) {
    logger.error('Assign escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to assign escalation',
    });
  }
});

/* ─── DELETE /api/escalations/:id — Delete escalation ──────── */

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await EscalationStore.delete(req.params.id as string);

    res.json({
      success: true,
    });
  } catch (err) {
    logger.error('Delete escalation error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete escalation',
    });
  }
});

export { router as escalationsRouter };
