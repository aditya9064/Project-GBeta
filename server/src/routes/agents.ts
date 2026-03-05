/* ═══════════════════════════════════════════════════════════
   Agent Management Routes — Deploy, manage, and monitor agents

   POST   /api/agents              — Deploy a new agent
   GET    /api/agents              — List user's agents
   GET    /api/agents/:id          — Get agent details
   PUT    /api/agents/:id/status   — Update agent status (activate/pause)
   DELETE /api/agents/:id          — Delete an agent
   POST   /api/agents/:id/run      — Manually trigger an agent
   GET    /api/agents/:id/logs     — Get execution logs for an agent
   GET    /api/agents/logs/recent  — Get all recent execution logs
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { AgentStore, type StoredAgent } from '../services/agentStore.js';
import { AgentExecutor } from '../services/agentExecutor.js';
import { logger } from '../services/logger.js';
import { validate } from '../middleware/validate.js';
import { agentCreateSchema, agentStatusUpdateSchema, agentRunSchema } from '../middleware/schemas.js';

const router = Router();

/* ─── POST /api/agents — Deploy a new agent ─────────────── */

router.post('/', validate(agentCreateSchema), async (req: Request, res: Response) => {
  try {
    const { id, name, description, workflow, triggerType, triggerConfig, userId } = req.body;

    const agent: StoredAgent = {
      id: id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      description: description || '',
      status: 'active',
      userId: userId || req.userId || '',
      workflow,
      triggerType: triggerType || 'manual',
      triggerConfig: triggerConfig || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionCount: 0,
      errorCount: 0,
    };

    await AgentStore.save(agent);

    logger.info(`Agent deployed: "${name}" (${agent.id}) — trigger: ${agent.triggerType}`);

    res.json({
      success: true,
      data: agent,
    });
  } catch (err) {
    logger.error('Agent deploy error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deploy agent',
    });
  }
});

/* ─── GET /api/agents — List agents ─────────────────────── */

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const agents = await AgentStore.getByUser(userId);

    res.json({
      success: true,
      data: agents,
    });
  } catch (err) {
    logger.error('Agent list error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list agents',
    });
  }
});

/* ─── GET /api/agents/logs/recent — Recent execution logs ── */

router.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const logs = await AgentStore.getRecentExecutions(userId, limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    logger.error('Recent logs error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch logs',
    });
  }
});

/* ─── GET /api/agents/:id — Get agent details ───────────── */

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const agent = await AgentStore.get(id);
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    res.json({ success: true, data: agent });
  } catch (err) {
    logger.error('Agent get error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get agent',
    });
  }
});

/* ─── PUT /api/agents/:id/status — Update status ────────── */

router.put('/:id/status', validate(agentStatusUpdateSchema), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    const id = String(req.params.id);
    await AgentStore.updateStatus(id, status);
    logger.info(`Agent ${id} status changed to ${status}`);

    res.json({ success: true, data: { id, status } });
  } catch (err) {
    logger.error('Agent status update error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update agent status',
    });
  }
});

/* ─── DELETE /api/agents/:id — Delete agent ─────────────── */

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await AgentStore.delete(String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    logger.error('Agent delete error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete agent',
    });
  }
});

/* ─── POST /api/agents/:id/run — Manually run an agent ──── */

router.post('/:id/run', validate(agentRunSchema), async (req: Request, res: Response) => {
  try {
    const agent = await AgentStore.get(String(req.params.id));
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    const triggerData = req.body.triggerData || {};
    const record = await AgentExecutor.execute(agent, 'manual', triggerData);

    res.json({
      success: record.status === 'completed',
      data: record,
    });
  } catch (err) {
    logger.error('Agent run error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to run agent',
    });
  }
});

/* ─── GET /api/agents/:id/logs — Execution logs ─────────── */

router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const logs = await AgentStore.getExecutions(String(req.params.id), limit);

    res.json({
      success: true,
      data: logs,
    });
  } catch (err) {
    logger.error('Agent logs error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch agent logs',
    });
  }
});

/* ─── POST /api/agents/scheduler/tick — Run scheduler tick ── */
/* Called by Cloud Scheduler every minute, or manually */

router.post('/scheduler/tick', async (_req: Request, res: Response) => {
  try {
    const { runScheduledTick } = await import('../services/agentScheduler.js');
    logger.info('Scheduler tick via HTTP...');
    const result = await runScheduledTick();
    logger.info('Tick result', { result });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.error('Scheduler tick error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Scheduler tick failed',
    });
  }
});

export { router as agentsRouter };
