/* ═══════════════════════════════════════════════════════════
   Scheduler Routes
   
   API endpoints for managing scheduled agent executions.
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { Scheduler } from '../services/scheduler.js';
import { logger } from '../services/logger.js';

export const schedulerRouter = Router();

/**
 * GET /api/scheduler/jobs
 * List scheduled jobs
 */
schedulerRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    const createdBy = req.query.createdBy as string | undefined;
    const enabled = req.query.enabled !== undefined 
      ? req.query.enabled === 'true' 
      : undefined;
    const agentId = req.query.agentId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const jobs = await Scheduler.list({ createdBy, enabled, agentId }, limit);
    res.json({ success: true, data: jobs });
  } catch (err) {
    logger.error('List scheduled jobs error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list jobs',
    });
  }
});

/**
 * GET /api/scheduler/jobs/upcoming
 * Get upcoming scheduled executions
 */
schedulerRouter.get('/jobs/upcoming', async (req: Request, res: Response) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 24;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const jobs = await Scheduler.getUpcoming(hours, limit);
    res.json({ success: true, data: jobs });
  } catch (err) {
    logger.error('Get upcoming jobs error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get upcoming jobs',
    });
  }
});

/**
 * GET /api/scheduler/jobs/:id
 * Get a specific job
 */
schedulerRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await Scheduler.get(req.params.id as string);

    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    logger.error('Get job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get job',
    });
  }
});

/**
 * POST /api/scheduler/jobs
 * Create a scheduled job
 */
schedulerRouter.post('/jobs', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      agentId,
      workflowId,
      input,
      frequency,
      cronExpression,
      timezone,
      scheduledAt,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      enabled,
      createdBy,
      teamId,
    } = req.body;

    if (!name || !agentId || !frequency || !createdBy) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, agentId, frequency, createdBy',
      });
      return;
    }

    const job = await Scheduler.create({
      name,
      description,
      agentId,
      workflowId,
      input,
      frequency,
      cronExpression,
      timezone: timezone || 'UTC',
      scheduledAt,
      dayOfWeek,
      dayOfMonth,
      hour,
      minute,
      enabled: enabled !== false,
      createdBy,
      teamId,
    });

    logger.info(`📅 Scheduled job created: ${name}`, { jobId: job.id });
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    logger.error('Create job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create job',
    });
  }
});

/**
 * PUT /api/scheduler/jobs/:id
 * Update a scheduled job
 */
schedulerRouter.put('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await Scheduler.update(req.params.id as string, req.body);

    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    logger.error('Update job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update job',
    });
  }
});

/**
 * DELETE /api/scheduler/jobs/:id
 * Delete a scheduled job
 */
schedulerRouter.delete('/jobs/:id', async (req: Request, res: Response) => {
  try {
    await Scheduler.delete(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete job',
    });
  }
});

/**
 * POST /api/scheduler/jobs/:id/enable
 * Enable a scheduled job
 */
schedulerRouter.post('/jobs/:id/enable', async (req: Request, res: Response) => {
  try {
    const job = await Scheduler.update(req.params.id as string, { enabled: true });

    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    logger.error('Enable job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to enable job',
    });
  }
});

/**
 * POST /api/scheduler/jobs/:id/disable
 * Disable a scheduled job
 */
schedulerRouter.post('/jobs/:id/disable', async (req: Request, res: Response) => {
  try {
    const job = await Scheduler.update(req.params.id as string, { enabled: false });

    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    logger.error('Disable job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to disable job',
    });
  }
});

/**
 * POST /api/scheduler/jobs/:id/run
 * Manually trigger a scheduled job
 */
schedulerRouter.post('/jobs/:id/run', async (req: Request, res: Response) => {
  try {
    const job = await Scheduler.get(req.params.id as string);

    if (!job) {
      res.status(404).json({ success: false, error: 'Job not found' });
      return;
    }

    // Execute immediately
    Scheduler.executeJob(job);

    res.json({ success: true, message: 'Job execution triggered' });
  } catch (err) {
    logger.error('Run job error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to run job',
    });
  }
});
