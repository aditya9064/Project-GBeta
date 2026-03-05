/* ═══════════════════════════════════════════════════════════
   Webhook Routes
   
   API endpoints for managing webhooks.
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { WebhookService } from '../services/webhookService.js';
import { logger } from '../services/logger.js';
import { validate } from '../middleware/validate.js';
import { webhookCreateSchema, webhookUpdateSchema } from '../middleware/schemas.js';

export const webhooksRouter = Router();

/**
 * GET /api/webhooks
 * List webhooks
 */
webhooksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const direction = req.query.direction as 'inbound' | 'outbound' | undefined;
    const createdBy = req.query.createdBy as string | undefined;
    const enabled = req.query.enabled !== undefined 
      ? req.query.enabled === 'true' 
      : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const webhooks = await WebhookService.list({ direction, createdBy, enabled }, limit);
    
    // Mask secrets in response
    const maskedWebhooks = webhooks.map(w => ({
      ...w,
      secret: w.secret.substring(0, 10) + '...',
    }));
    
    res.json({ success: true, data: maskedWebhooks });
  } catch (err) {
    logger.error('List webhooks error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list webhooks',
    });
  }
});

/**
 * GET /api/webhooks/:id
 * Get a specific webhook
 */
webhooksRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const webhook = await WebhookService.get(req.params.id as string);

    if (!webhook) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }

    res.json({ 
      success: true, 
      data: {
        ...webhook,
        secret: webhook.secret.substring(0, 10) + '...',
      }
    });
  } catch (err) {
    logger.error('Get webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get webhook',
    });
  }
});

/**
 * POST /api/webhooks
 * Create a webhook
 */
webhooksRouter.post('/', validate(webhookCreateSchema), async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      direction,
      url,
      method,
      headers,
      events,
      filters,
      targetAgentId,
      targetWorkflowId,
      transformPayload,
      enabled,
      retryConfig,
      createdBy,
      teamId,
    } = req.body;

    const webhook = await WebhookService.create({
      name,
      description,
      direction,
      url,
      method,
      headers,
      events,
      filters,
      targetAgentId,
      targetWorkflowId,
      transformPayload,
      enabled: enabled !== false,
      retryConfig,
      createdBy,
      teamId,
    });

    logger.info(`🪝 Webhook created: ${name}`, { webhookId: webhook.id });
    res.status(201).json({ success: true, data: webhook });
  } catch (err) {
    logger.error('Create webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create webhook',
    });
  }
});

/**
 * PUT /api/webhooks/:id
 * Update a webhook
 */
webhooksRouter.put('/:id', validate(webhookUpdateSchema), async (req: Request, res: Response) => {
  try {
    const webhook = await WebhookService.update(req.params.id as string, req.body);

    if (!webhook) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }

    res.json({ success: true, data: webhook });
  } catch (err) {
    logger.error('Update webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update webhook',
    });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook
 */
webhooksRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await WebhookService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete webhook',
    });
  }
});

/**
 * POST /api/webhooks/:id/regenerate-secret
 * Regenerate webhook secret
 */
webhooksRouter.post('/:id/regenerate-secret', async (req: Request, res: Response) => {
  try {
    const secret = await WebhookService.regenerateSecret(req.params.id as string);

    if (!secret) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }

    res.json({ success: true, data: { secret } });
  } catch (err) {
    logger.error('Regenerate secret error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to regenerate secret',
    });
  }
});

/**
 * GET /api/webhooks/:id/logs
 * Get webhook execution logs
 */
webhooksRouter.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await WebhookService.getLogs(req.params.id as string, limit);

    res.json({ success: true, data: logs });
  } catch (err) {
    logger.error('Get webhook logs error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get logs',
    });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook
 */
webhooksRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const webhook = await WebhookService.get(req.params.id as string);

    if (!webhook) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }

    if (webhook.direction === 'outbound') {
      const testPayload = {
        test: true,
        message: 'This is a test webhook payload',
        timestamp: new Date().toISOString(),
      };
      
      await WebhookService.sendOutbound(webhook, 'custom', testPayload);
      res.json({ success: true, message: 'Test webhook sent' });
    } else {
      res.json({ 
        success: true, 
        message: 'Inbound webhook ready',
        endpoint: `/api/webhooks/incoming/${webhook.endpoint}`,
      });
    }
  } catch (err) {
    logger.error('Test webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to test webhook',
    });
  }
});

/**
 * POST /api/webhooks/incoming/:endpoint
 * Handle inbound webhook
 */
webhooksRouter.post('/incoming/:endpoint', async (req: Request, res: Response) => {
  try {
    const endpoint = req.params.endpoint as string;
    const headers: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      }
    }
    
    const result = await WebhookService.processInbound(endpoint, req.body, headers);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, received: true });
  } catch (err) {
    logger.error('Process inbound webhook error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process webhook',
    });
  }
});
