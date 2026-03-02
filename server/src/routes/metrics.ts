/* ═══════════════════════════════════════════════════════════
   Metrics Routes — Agent and crew performance analytics

   GET    /api/metrics/agents          — All agent metrics
   GET    /api/metrics/agents/:id      — Single agent metrics
   GET    /api/metrics/crews/:id       — Crew aggregate metrics
   GET    /api/metrics/summary         — Dashboard summary
   GET    /api/metrics/trends          — Metrics trends over time
   POST   /api/metrics/record          — Record an execution (internal)
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { MetricsStore, type MetricPeriod } from '../services/metricsStore.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/metrics/agents — All agent metrics ──────────── */

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as MetricPeriod) || 'weekly';
    const userId = req.query.userId as string | undefined;
    
    const metrics = await MetricsStore.getAllAgentMetrics(period, userId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    logger.error('Get all metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get metrics',
    });
  }
});

/* ─── GET /api/metrics/agents/:id — Single agent metrics ───── */

router.get('/agents/:id', async (req: Request, res: Response) => {
  try {
    const agentId = String(req.params.id);
    const period = (req.query.period as MetricPeriod) || 'weekly';
    
    const metrics = await MetricsStore.getByAgent(agentId, period);

    if (!metrics) {
      res.json({
        success: true,
        data: {
          agentId,
          period,
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          avgDurationMs: 0,
          minDurationMs: 0,
          maxDurationMs: 0,
          totalCost: 0,
          userCorrections: 0,
          successRate: 0,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    logger.error('Get agent metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get metrics',
    });
  }
});

/* ─── GET /api/metrics/crews — All crew metrics ────────────── */

router.get('/crews', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as MetricPeriod) || 'weekly';
    const metrics = await MetricsStore.getAllCrewMetrics(period);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    logger.error('Get all crew metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get crew metrics',
    });
  }
});

/* ─── GET /api/metrics/crews/:id — Single crew metrics ─────── */

router.get('/crews/:id', async (req: Request, res: Response) => {
  try {
    const crewId = String(req.params.id);
    const period = (req.query.period as MetricPeriod) || 'weekly';
    
    const periodStart = new Date().toISOString().split('T')[0];
    const metricId = `crew_${crewId}_${period}_${periodStart}`;
    const metrics = await MetricsStore.getCrewMetrics(metricId);

    if (!metrics) {
      res.json({
        success: true,
        data: {
          crewId,
          period,
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          avgDurationMs: 0,
          totalCost: 0,
          memberContributions: [],
          successRate: 0,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    logger.error('Get crew metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get metrics',
    });
  }
});

/* ─── GET /api/metrics/summary — Dashboard summary ─────────── */

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const summary = await MetricsStore.getSummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    logger.error('Get summary error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get summary',
    });
  }
});

/* ─── GET /api/metrics/trends — Trends over time ───────────── */

router.get('/trends', async (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const periods = parseInt(String(req.query.periods || '7'), 10);
    
    const trends = await MetricsStore.getTrends(agentId, periods);

    res.json({
      success: true,
      data: trends,
    });
  } catch (err) {
    logger.error('Get trends error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get trends',
    });
  }
});

/* ─── POST /api/metrics/record — Record execution ──────────── */

router.post('/record', async (req: Request, res: Response) => {
  try {
    const { agentId, agentName, success, durationMs, cost, hadCorrections } = req.body;

    if (!agentId || !agentName || success === undefined || durationMs === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: agentId, agentName, success, durationMs',
      });
      return;
    }

    await MetricsStore.recordExecution(
      agentId,
      agentName,
      Boolean(success),
      Number(durationMs),
      Number(cost || 0),
      Boolean(hadCorrections)
    );

    logger.info(`📊 Metrics recorded for ${agentName}: ${success ? 'success' : 'failure'}`);

    res.json({
      success: true,
    });
  } catch (err) {
    logger.error('Record metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record metrics',
    });
  }
});

/* ─── POST /api/metrics/record-crew — Record crew execution ── */

router.post('/record-crew', async (req: Request, res: Response) => {
  try {
    const { crewId, crewName, success, durationMs, cost, memberContributions } = req.body;

    if (!crewId || !crewName || success === undefined || durationMs === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: crewId, crewName, success, durationMs',
      });
      return;
    }

    await MetricsStore.recordCrewExecution(
      crewId,
      crewName,
      Boolean(success),
      Number(durationMs),
      Number(cost || 0),
      memberContributions || []
    );

    logger.info(`📊 Crew metrics recorded for ${crewName}: ${success ? 'success' : 'failure'}`);

    res.json({
      success: true,
    });
  } catch (err) {
    logger.error('Record crew metrics error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record crew metrics',
    });
  }
});

/* ─── GET /api/metrics/executions — Recent executions ──────── */

router.get('/executions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const agentId = req.query.agentId as string | undefined;
    const crewId = req.query.crewId as string | undefined;

    const executions = await MetricsStore.getRecentExecutions(limit, agentId, crewId);

    res.json({
      success: true,
      data: executions,
    });
  } catch (err) {
    logger.error('Get executions error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get executions',
    });
  }
});

/* ─── GET /api/metrics/stats — Execution stats for date range  */

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const startDate = (req.query.startDate as string) || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = (req.query.endDate as string) || new Date().toISOString();

    const stats = await MetricsStore.getExecutionStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    logger.error('Get stats error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get stats',
    });
  }
});

export { router as metricsRouter };
