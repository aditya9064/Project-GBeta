/* ═══════════════════════════════════════════════════════════
   APM API Routes
   
   Endpoints for monitoring dashboard and alerts.
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { APM, DEFAULT_DASHBOARDS } from '../services/apm.js';
import { logger } from '../services/logger.js';

export const apmRouter = Router();

/**
 * GET /api/apm/dashboard
 * Get dashboard summary for UI
 */
apmRouter.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const summary = await APM.getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('Failed to get dashboard summary', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get dashboard summary' 
    });
  }
});

/**
 * GET /api/apm/dashboards
 * Get available dashboard configurations
 */
apmRouter.get('/dashboards', (_req: Request, res: Response) => {
  res.json({ success: true, data: DEFAULT_DASHBOARDS });
});

/**
 * GET /api/apm/metrics
 * Get list of available metrics
 */
apmRouter.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = APM.getAvailableMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    logger.error('Failed to get available metrics', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get available metrics' 
    });
  }
});

/**
 * GET /api/apm/metrics/:name
 * Get aggregated metrics for a specific metric
 */
apmRouter.get('/metrics/:name', (req: Request, res: Response) => {
  try {
    const metricName = req.params.name as string;
    const windowMs = req.query.window ? parseInt(req.query.window as string, 10) : 60000;
    
    const aggregated = APM.getAggregatedMetrics(metricName, windowMs);
    
    if (!aggregated) {
      res.status(404).json({ success: false, error: 'Metric not found or no data' });
      return;
    }
    
    res.json({ success: true, data: aggregated });
  } catch (err) {
    logger.error('Failed to get metric data', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get metric data' 
    });
  }
});

/**
 * GET /api/apm/metrics/:name/timeseries
 * Get time series data for charting
 */
apmRouter.get('/metrics/:name/timeseries', (req: Request, res: Response) => {
  try {
    const metricName = req.params.name as string;
    const windowMs = req.query.window ? parseInt(req.query.window as string, 10) : 3600000;
    const bucketMs = req.query.bucket ? parseInt(req.query.bucket as string, 10) : 60000;
    
    const timeSeries = APM.getTimeSeries(metricName, windowMs, undefined, bucketMs);
    
    res.json({ success: true, data: timeSeries });
  } catch (err) {
    logger.error('Failed to get time series data', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get time series data' 
    });
  }
});

/**
 * GET /api/apm/alerts
 * Get all alert rules
 */
apmRouter.get('/alerts', (_req: Request, res: Response) => {
  try {
    const rules = APM.getAlertRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    logger.error('Failed to get alert rules', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get alert rules' 
    });
  }
});

/**
 * GET /api/apm/alerts/states
 * Get current alert states
 */
apmRouter.get('/alerts/states', (_req: Request, res: Response) => {
  try {
    const states = APM.getAlertStates();
    res.json({ success: true, data: states });
  } catch (err) {
    logger.error('Failed to get alert states', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get alert states' 
    });
  }
});

/**
 * POST /api/apm/alerts
 * Create or update an alert rule
 */
apmRouter.post('/alerts', (req: Request, res: Response) => {
  try {
    const rule = req.body;
    
    if (!rule.id || !rule.name || !rule.metric || !rule.condition || rule.threshold === undefined) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: id, name, metric, condition, threshold' 
      });
      return;
    }
    
    APM.setAlertRule({
      ...rule,
      enabled: rule.enabled !== false,
      cooldown: rule.cooldown || 300,
      notifyChannels: rule.notifyChannels || ['log'],
    });
    
    logger.info('Alert rule created/updated', { alertId: rule.id, alertName: rule.name });
    
    res.json({ success: true, data: rule });
  } catch (err) {
    logger.error('Failed to create alert rule', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to create alert rule' 
    });
  }
});

/**
 * DELETE /api/apm/alerts/:id
 * Delete an alert rule
 */
apmRouter.delete('/alerts/:id', (req: Request, res: Response) => {
  try {
    const alertId = req.params.id as string;
    
    APM.deleteAlertRule(alertId);
    
    logger.info('Alert rule deleted', { alertId });
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to delete alert rule', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to delete alert rule' 
    });
  }
});

/**
 * GET /api/apm/system
 * Get system metrics
 */
apmRouter.get('/system', (_req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    res.json({
      success: true,
      data: {
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
          external: memUsage.external,
          usedPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    });
  } catch (err) {
    logger.error('Failed to get system metrics', { error: err });
    res.status(500).json({ 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get system metrics' 
    });
  }
});
