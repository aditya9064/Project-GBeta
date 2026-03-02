/* ═══════════════════════════════════════════════════════════
   Webhook Service
   
   Manages inbound and outbound webhooks for agent triggers
   and notifications.
   ═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger, Metrics } from './logger.js';

const WEBHOOKS_COLLECTION = 'webhooks';
const WEBHOOK_LOGS_COLLECTION = 'webhook_logs';

export type WebhookDirection = 'inbound' | 'outbound';
export type WebhookEvent = 
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'crew.started'
  | 'crew.completed'
  | 'escalation.created'
  | 'budget.exceeded'
  | 'custom';

export interface Webhook {
  id: string;
  name: string;
  description?: string;
  
  direction: WebhookDirection;
  
  // Inbound webhook config
  endpoint?: string;
  secret: string;
  
  // Outbound webhook config
  url?: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  
  // Event filtering
  events: WebhookEvent[];
  filters?: {
    agentId?: string[];
    crewId?: string[];
    status?: string[];
  };
  
  // What to trigger (inbound)
  targetAgentId?: string;
  targetWorkflowId?: string;
  transformPayload?: string; // JSON path or template
  
  // Status
  enabled: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  failureCount: number;
  lastError?: string;
  
  // Retry config (outbound)
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
  
  // Ownership
  createdBy: string;
  teamId?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  direction: WebhookDirection;
  event: WebhookEvent;
  timestamp: string;
  
  // Request details
  requestMethod?: string;
  requestUrl?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  
  // Response details
  responseStatus?: number;
  responseBody?: unknown;
  
  // Processing
  duration?: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  error?: string;
  retryCount?: number;
}

const webhooksCache = new Map<string, Webhook>();
const endpointIndex = new Map<string, string>(); // endpoint -> webhookId

function generateId(): string {
  return `wh-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function generateSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

function generateEndpoint(): string {
  return crypto.randomBytes(16).toString('hex');
}

function signPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance = 300
): boolean {
  const parts = signature.split(',');
  const timestamp = parseInt(parts[0]?.split('=')[1] || '0', 10);
  const sig = parts[1]?.split('=')[1] || '';
  
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }
  
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

export const WebhookService = {
  /**
   * Create a new webhook
   */
  async create(data: Omit<Webhook, 'id' | 'secret' | 'endpoint' | 'createdAt' | 'updatedAt' | 'triggerCount' | 'failureCount'>): Promise<Webhook> {
    const webhook: Webhook = {
      ...data,
      id: generateId(),
      secret: generateSecret(),
      endpoint: data.direction === 'inbound' ? generateEndpoint() : undefined,
      triggerCount: 0,
      failureCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    webhooksCache.set(webhook.id, webhook);
    if (webhook.endpoint) {
      endpointIndex.set(webhook.endpoint, webhook.id);
    }
    
    try {
      const db = getFirestore();
      await db.collection(WEBHOOKS_COLLECTION).doc(webhook.id).set(webhook);
    } catch (err) {
      logger.warn('WebhookService: Firestore unavailable', { error: err });
    }
    
    logger.info(`🪝 Webhook created: ${webhook.name}`, {
      webhookId: webhook.id,
      direction: webhook.direction,
      events: webhook.events,
    });
    
    return webhook;
  },

  /**
   * Get webhook by ID
   */
  async get(id: string): Promise<Webhook | null> {
    if (webhooksCache.has(id)) {
      return webhooksCache.get(id)!;
    }
    
    try {
      const db = getFirestore();
      const doc = await db.collection(WEBHOOKS_COLLECTION).doc(id).get();
      if (doc.exists) {
        const webhook = doc.data() as Webhook;
        webhooksCache.set(id, webhook);
        if (webhook.endpoint) {
          endpointIndex.set(webhook.endpoint, webhook.id);
        }
        return webhook;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Get webhook by endpoint
   */
  async getByEndpoint(endpoint: string): Promise<Webhook | null> {
    const webhookId = endpointIndex.get(endpoint);
    if (webhookId) {
      return this.get(webhookId);
    }
    
    try {
      const db = getFirestore();
      const snapshot = await db.collection(WEBHOOKS_COLLECTION)
        .where('endpoint', '==', endpoint)
        .where('enabled', '==', true)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const webhook = snapshot.docs[0].data() as Webhook;
        webhooksCache.set(webhook.id, webhook);
        endpointIndex.set(endpoint, webhook.id);
        return webhook;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Update a webhook
   */
  async update(id: string, updates: Partial<Webhook>): Promise<Webhook | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: Webhook = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    webhooksCache.set(id, updated);
    
    try {
      const db = getFirestore();
      await db.collection(WEBHOOKS_COLLECTION).doc(id).update({
        ...updates,
        updatedAt: updated.updatedAt,
      });
    } catch {
      // Firestore unavailable
    }
    
    return updated;
  },

  /**
   * Delete a webhook
   */
  async delete(id: string): Promise<boolean> {
    const webhook = webhooksCache.get(id);
    if (webhook?.endpoint) {
      endpointIndex.delete(webhook.endpoint);
    }
    webhooksCache.delete(id);
    
    try {
      const db = getFirestore();
      await db.collection(WEBHOOKS_COLLECTION).doc(id).delete();
    } catch {
      // Firestore unavailable
    }
    
    return true;
  },

  /**
   * List webhooks
   */
  async list(filters?: { direction?: WebhookDirection; createdBy?: string; enabled?: boolean }, limit = 50): Promise<Webhook[]> {
    try {
      const db = getFirestore();
      let query = db.collection(WEBHOOKS_COLLECTION).orderBy('createdAt', 'desc');
      
      if (filters?.direction) {
        query = query.where('direction', '==', filters.direction);
      }
      if (filters?.createdBy) {
        query = query.where('createdBy', '==', filters.createdBy);
      }
      if (filters?.enabled !== undefined) {
        query = query.where('enabled', '==', filters.enabled);
      }
      
      const snapshot = await query.limit(limit).get();
      const webhooks = snapshot.docs.map(d => d.data() as Webhook);
      
      webhooks.forEach(w => {
        webhooksCache.set(w.id, w);
        if (w.endpoint) {
          endpointIndex.set(w.endpoint, w.id);
        }
      });
      
      return webhooks;
    } catch {
      let webhooks = Array.from(webhooksCache.values());
      
      if (filters?.direction) {
        webhooks = webhooks.filter(w => w.direction === filters.direction);
      }
      if (filters?.createdBy) {
        webhooks = webhooks.filter(w => w.createdBy === filters.createdBy);
      }
      if (filters?.enabled !== undefined) {
        webhooks = webhooks.filter(w => w.enabled === filters.enabled);
      }
      
      return webhooks.slice(0, limit);
    }
  },

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(id: string): Promise<string | null> {
    const webhook = await this.get(id);
    if (!webhook) return null;
    
    const newSecret = generateSecret();
    await this.update(id, { secret: newSecret });
    
    return newSecret;
  },

  /**
   * Process inbound webhook
   */
  async processInbound(
    endpoint: string,
    payload: unknown,
    headers: Record<string, string>
  ): Promise<{ success: boolean; webhookId?: string; error?: string }> {
    const startTime = Date.now();
    
    const webhook = await this.getByEndpoint(endpoint);
    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }
    
    if (!webhook.enabled) {
      return { success: false, error: 'Webhook is disabled' };
    }
    
    // Verify signature if present
    const signature = headers['x-webhook-signature'] || headers['x-signature'];
    if (signature) {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!verifySignature(payloadStr, signature, webhook.secret)) {
        Metrics.increment('webhook.inbound', 1, { status: 'invalid_signature' });
        return { success: false, error: 'Invalid signature' };
      }
    }
    
    logger.info(`🪝 Inbound webhook received: ${webhook.name}`, {
      webhookId: webhook.id,
      endpoint,
    });
    
    try {
      // Here you would trigger the target agent
      // For now, just log and return success
      
      const duration = Date.now() - startTime;
      
      await this.update(webhook.id, {
        lastTriggeredAt: new Date().toISOString(),
        triggerCount: webhook.triggerCount + 1,
      });
      
      await this.logExecution({
        webhookId: webhook.id,
        direction: 'inbound',
        event: 'custom',
        requestHeaders: headers,
        requestBody: payload,
        status: 'success',
        duration,
      });
      
      Metrics.increment('webhook.inbound', 1, { status: 'success' });
      Metrics.timing('webhook.inbound.duration', duration);
      
      return { success: true, webhookId: webhook.id };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      await this.update(webhook.id, {
        failureCount: webhook.failureCount + 1,
        lastError: errorMsg,
      });
      
      Metrics.increment('webhook.inbound', 1, { status: 'failed' });
      
      return { success: false, webhookId: webhook.id, error: errorMsg };
    }
  },

  /**
   * Trigger outbound webhook
   */
  async triggerOutbound(event: WebhookEvent, payload: unknown): Promise<void> {
    const webhooks = await this.list({ direction: 'outbound', enabled: true });
    const matchingWebhooks = webhooks.filter(w => w.events.includes(event) || w.events.includes('custom'));
    
    for (const webhook of matchingWebhooks) {
      this.sendOutbound(webhook, event, payload);
    }
  },

  /**
   * Send outbound webhook
   */
  async sendOutbound(webhook: Webhook, event: WebhookEvent, payload: unknown): Promise<void> {
    if (!webhook.url) {
      logger.warn('Outbound webhook has no URL', { webhookId: webhook.id });
      return;
    }
    
    const startTime = Date.now();
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });
    
    const signature = signPayload(body, webhook.secret);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': event,
      ...webhook.headers,
    };
    
    try {
      const response = await fetch(webhook.url, {
        method: webhook.method || 'POST',
        headers,
        body,
      });
      
      const duration = Date.now() - startTime;
      const responseBody = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody}`);
      }
      
      await this.update(webhook.id, {
        lastTriggeredAt: new Date().toISOString(),
        triggerCount: webhook.triggerCount + 1,
      });
      
      await this.logExecution({
        webhookId: webhook.id,
        direction: 'outbound',
        event,
        requestMethod: webhook.method || 'POST',
        requestUrl: webhook.url,
        requestHeaders: headers,
        requestBody: payload,
        responseStatus: response.status,
        responseBody: responseBody.slice(0, 1000),
        status: 'success',
        duration,
      });
      
      Metrics.increment('webhook.outbound', 1, { status: 'success', event });
      Metrics.timing('webhook.outbound.duration', duration);
      
      logger.info(`🪝 Outbound webhook sent: ${webhook.name}`, {
        webhookId: webhook.id,
        event,
        status: response.status,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      
      await this.update(webhook.id, {
        failureCount: webhook.failureCount + 1,
        lastError: errorMsg,
      });
      
      await this.logExecution({
        webhookId: webhook.id,
        direction: 'outbound',
        event,
        requestMethod: webhook.method || 'POST',
        requestUrl: webhook.url,
        requestBody: payload,
        status: 'failed',
        error: errorMsg,
      });
      
      Metrics.increment('webhook.outbound', 1, { status: 'failed', event });
      
      logger.error(`🪝 Outbound webhook failed: ${webhook.name}`, {
        webhookId: webhook.id,
        event,
        error: err,
      });
    }
  },

  /**
   * Log webhook execution
   */
  async logExecution(data: Omit<WebhookLog, 'id' | 'timestamp'>): Promise<void> {
    const log: WebhookLog = {
      ...data,
      id: `whl-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    
    try {
      const db = getFirestore();
      await db.collection(WEBHOOK_LOGS_COLLECTION).doc(log.id).set(log);
    } catch {
      // Firestore unavailable
    }
  },

  /**
   * Get webhook logs
   */
  async getLogs(webhookId: string, limit = 50): Promise<WebhookLog[]> {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(WEBHOOK_LOGS_COLLECTION)
        .where('webhookId', '==', webhookId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(d => d.data() as WebhookLog);
    } catch {
      return [];
    }
  },
};
