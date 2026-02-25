import type { Webhook } from './types';

const STORAGE_KEY = 'operon_webhooks';
const WEBHOOK_BASE_URL = import.meta.env.VITE_WEBHOOK_URL || `${window.location.origin}/api/webhooks`;

function loadAll(): Webhook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((w: any) => ({
      ...w,
      createdAt: new Date(w.createdAt),
      lastTriggeredAt: w.lastTriggeredAt ? new Date(w.lastTriggeredAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveAll(webhooks: Webhook[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(webhooks));
}

function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export const WebhookService = {
  register(agentId: string, userId: string): Webhook {
    const all = loadAll();
    const existing = all.find(w => w.agentId === agentId);
    if (existing) return existing;

    const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const webhook: Webhook = {
      id,
      agentId,
      userId,
      url: `${WEBHOOK_BASE_URL}/${id}`,
      secret: generateSecret(),
      isActive: true,
      createdAt: new Date(),
    };

    all.push(webhook);
    saveAll(all);
    return webhook;
  },

  getByAgent(agentId: string): Webhook | null {
    return loadAll().find(w => w.agentId === agentId) || null;
  },

  getById(webhookId: string): Webhook | null {
    return loadAll().find(w => w.id === webhookId) || null;
  },

  getAll(): Webhook[] {
    return loadAll();
  },

  deactivate(webhookId: string): void {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (wh) {
      wh.isActive = false;
      saveAll(all);
    }
  },

  activate(webhookId: string): void {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (wh) {
      wh.isActive = true;
      saveAll(all);
    }
  },

  markTriggered(webhookId: string): void {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (wh) {
      wh.lastTriggeredAt = new Date();
      saveAll(all);
    }
  },

  delete(webhookId: string): void {
    const all = loadAll();
    saveAll(all.filter(w => w.id !== webhookId));
  },

  deleteByAgent(agentId: string): void {
    const all = loadAll();
    saveAll(all.filter(w => w.agentId !== agentId));
  },

  validateSignature(payload: string, signature: string, secret: string): boolean {
    // HMAC-SHA256 verification would happen server-side
    // For client-side demo, we do a basic check
    return signature === secret.substring(0, 16);
  },

  async simulateIncoming(webhookId: string, payload: any): Promise<{ success: boolean; agentId?: string }> {
    const wh = this.getById(webhookId);
    if (!wh) return { success: false };
    if (!wh.isActive) return { success: false };

    this.markTriggered(webhookId);

    // The actual execution is handled by whoever listens for webhook events
    // We dispatch a custom event that the AgentContext can listen to
    window.dispatchEvent(new CustomEvent('webhook-trigger', {
      detail: { webhookId: wh.id, agentId: wh.agentId, payload },
    }));

    return { success: true, agentId: wh.agentId };
  },
};
