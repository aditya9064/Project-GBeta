/* ═══════════════════════════════════════════════════════════
   Stream Routes — Server-Sent Events for real-time updates
   
   GET /api/stream/executions              — All execution events
   GET /api/stream/executions/:agentId     — Events for specific agent
   GET /api/stream/executions/:agentId/:id — Events for specific execution
   POST /api/stream/cancel/:executionId    — Cancel an execution
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { ExecutionStream } from '../services/executionStream.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/stream/executions — Global execution stream ─── */

router.get('/executions', (req: Request, res: Response) => {
  logger.info('📡 New SSE connection for global execution stream');
  ExecutionStream.subscribeToAll(res);
});

/* ─── GET /api/stream/executions/:agentId — Agent execution stream ─── */

router.get('/executions/:agentId', (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  logger.info(`📡 New SSE connection for agent ${agentId}`);
  ExecutionStream.subscribeToAgent(agentId, res);
});

/* ─── GET /api/stream/executions/:agentId/:id — Specific execution stream ─── */

router.get('/executions/:agentId/:id', (req: Request, res: Response) => {
  const agentId = req.params.agentId as string;
  const id = req.params.id as string;
  logger.info(`📡 New SSE connection for execution ${id}`);
  ExecutionStream.subscribe(id, agentId, res);
});

/* ─── POST /api/stream/cancel/:executionId — Cancel execution ─── */

router.post('/cancel/:executionId', (req: Request, res: Response) => {
  const executionId = req.params.executionId as string;
  const { agentId } = req.body;
  
  if (!agentId) {
    res.status(400).json({ success: false, error: 'agentId is required' });
    return;
  }

  ExecutionStream.cancelExecution(executionId, agentId);
  logger.info(`🛑 Execution ${executionId} cancelled`);
  
  res.json({ success: true, message: 'Cancellation signal sent' });
});

/* ─── GET /api/stream/status — Stream service status ─── */

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      activeClients: ExecutionStream.getActiveClientCount(),
      timestamp: new Date().toISOString(),
    },
  });
});

export { router as streamRouter };
