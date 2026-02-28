/* ═══════════════════════════════════════════════════════════
   Computer Orchestration API Routes
   
   POST /api/computer/run        — Run a complex task
   GET  /api/computer/status/:id — Get task status
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { ComputerService } from '../services/computer/index.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const computerRunSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(5000),
  context: z.record(z.string(), z.any()).optional(),
});

const computerStatusSchema = z.object({
  taskId: z.string().min(1),
});

router.post('/run', validate(computerRunSchema), async (req: Request, res: Response) => {
  try {
    const { goal, context } = req.body;

    const result = await ComputerService.runTask(goal, context);

    res.json({
      success: result.success,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Computer task failed',
    });
  }
});

router.get('/status/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId: string = (Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId) ?? '';

    const status = ComputerService.getStatus(taskId);

    if (!status) {
      res.status(404).json({
        success: false,
        error: 'Task not found',
      });
      return;
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get task status',
    });
  }
});

export { router as computerRouter };
