/* ═══════════════════════════════════════════════════════════
   Autonomous Agent Routes — REST + SSE endpoints

   POST /api/autonomous/run         — Start autonomous execution (SSE stream)
   POST /api/autonomous/:id/approve — Approve or deny a pending action
   POST /api/autonomous/:id/message — Send a follow-up message mid-execution
   POST /api/autonomous/:id/cancel  — Cancel a running execution
   GET  /api/autonomous/:id/status  — Get execution state
   GET  /api/autonomous/active      — List active executions
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate.js';
import {
  autonomousRunSchema,
  autonomousApproveSchema,
  autonomousMessageSchema,
} from '../middleware/schemas.js';
import {
  executeAutonomous,
  resolveApproval,
  sendUserMessage,
  cancelExecution,
  getExecution,
  getActiveExecutions,
  getExecutionHistory,
  getExecutionById,
} from '../services/autonomousExecutor.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── POST /run — Start an autonomous execution with SSE streaming ─── */

router.post('/run', validate(autonomousRunSchema), async (req: Request, res: Response) => {
  const { goal, model, maxIterations, autoApproveRisk, tools, systemPrompt } = req.body;
  const userId = req.userId || 'anonymous';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emit = (event: string, data: Record<string, any>) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Client disconnected
    }
  };

  try {
    const execution = await executeAutonomous(goal, userId, emit, {
      model,
      maxIterations,
      autoApproveRisk,
      tools,
      systemPrompt,
    });

    emit('done', {
      executionId: execution.id,
      status: execution.status,
      totalTokens: execution.totalTokens,
      totalCost: execution.totalCost,
    });
  } catch (err: any) {
    logger.error('[AutonomousRoute] Execution failed:', err);
    emit('error', { error: err.message });
  } finally {
    res.end();
  }
});

/* ─── GET /active — List active executions ─── */

router.get('/active', (req: Request, res: Response) => {
  const userId = req.userId;
  const executions = getActiveExecutions(userId);

  res.json({
    success: true,
    data: executions.map(e => ({
      id: e.id,
      goal: e.goal,
      status: e.status,
      model: e.model,
      stepCount: e.steps.length,
      totalTokens: e.totalTokens,
      totalCost: e.totalCost,
      startedAt: e.startedAt,
    })),
  });
});

/* ─── GET /history — List past executions (Firestore + in-memory) ─── */

router.get('/history', async (req: Request, res: Response) => {
  const userId = req.userId || 'anonymous';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  try {
    const history = await getExecutionHistory(userId, limit);
    res.json({ success: true, data: history });
  } catch (err: any) {
    logger.error('[AutonomousRoute] History fetch failed:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

/* ─── GET /execution/:id — Get full execution details (in-memory or Firestore) ─── */

router.get('/execution/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const execution = await getExecutionById(id);
    if (!execution) {
      res.status(404).json({ success: false, error: 'Execution not found' });
      return;
    }
    res.json({ success: true, data: execution });
  } catch (err: any) {
    logger.error('[AutonomousRoute] Execution fetch failed:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch execution' });
  }
});

/* ─── POST /:id/approve — Approve or deny a pending action ─── */

router.post('/:id/approve', validate(autonomousApproveSchema), (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { approved } = req.body;

  const resolved = resolveApproval(id, approved);
  if (!resolved) {
    res.status(404).json({ success: false, error: 'No pending approval for this execution' });
    return;
  }

  logger.info(`[Autonomous] Approval ${approved ? 'granted' : 'denied'} for ${id}`);
  res.json({ success: true, approved });
});

/* ─── POST /:id/message — Send a message to a running execution ─── */

router.post('/:id/message', validate(autonomousMessageSchema), (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { message } = req.body;

  const sent = sendUserMessage(id, message);
  if (!sent) {
    res.status(404).json({ success: false, error: 'Execution is not awaiting a user message' });
    return;
  }

  logger.info(`[Autonomous] User message sent to ${id}`);
  res.json({ success: true });
});

/* ─── POST /:id/cancel — Cancel execution ─── */

router.post('/:id/cancel', (req: Request, res: Response) => {
  const id = req.params.id as string;

  const cancelled = cancelExecution(id);
  if (!cancelled) {
    res.status(404).json({ success: false, error: 'Execution not found or already completed' });
    return;
  }

  logger.info(`[Autonomous] Execution ${id} cancelled`);
  res.json({ success: true });
});

/* ─── GET /:id/status — Get execution state ─── */

router.get('/:id/status', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const execution = getExecution(id);

  if (!execution) {
    res.status(404).json({ success: false, error: 'Execution not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: execution.id,
      status: execution.status,
      goal: execution.goal,
      model: execution.model,
      stepCount: execution.steps.length,
      totalTokens: execution.totalTokens,
      totalCost: execution.totalCost,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      result: execution.result,
      error: execution.error,
      steps: execution.steps,
    },
  });
});

export { router as autonomousRouter };
