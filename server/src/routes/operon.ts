/* ═══════════════════════════════════════════════════════════
   Operon Routes — Manager / Twin Agent API

   POST /api/operon/query  — Send a query to Operon
   GET  /api/operon/logs   — Fetch recent Operon logs for a user
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { OperonService } from '../services/operonService.js';

const router = Router();

const operonQuerySchema = z.object({
  userId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1, 'Message is required').max(8000),
  context: z.any().optional(),
});

router.post('/query', validate(operonQuerySchema), async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, message, context } = req.body;

    const result = await OperonService.handleQuery({
      userId,
      sessionId,
      message,
      context,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Operon query failed';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string | undefined) || 'anonymous';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const logs = OperonService.getLogsForUser(userId, limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch Operon logs';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export { router as operonRouter };

