import type { Webhook } from './types';

const STORAGE_KEY = 'operon_webhooks';
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const WEBHOOK_BASE_URL = import.meta.env.VITE_WEBHOOK_URL || `${window.location.origin}/api/webhooks`;

let _backendAvailable: boolean | null = null;

async function checkBackend(): Promise<boolean> {
  if (_backendAvailable !== null) return _backendAvailable;
  try {
    const res = await fetch(`${API_BASE}/webhooks/status`, { method: 'GET' });
    _backendAvailable = res.ok;
  } catch {
    _backendAvailable = false;
  }
  return _backendAvailable;
}

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
  async register(agentId: string, userId: string): Promise<Webhook> {
    const all = loadAll();
    const existing = all.find(w => w.agentId === agentId);
    if (existing) return existing;

    const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const secret = generateSecret();
    
    // Try to register with backend for real webhook support
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        const res = await fetch(`${API_BASE}/webhooks/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, agentId, userId, secret }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.webhook) {
            const webhook: Webhook = {
              ...data.webhook,
              createdAt: new Date(data.webhook.createdAt),
            };
            all.push(webhook);
            saveAll(all);
            console.log(`[Webhook] Registered with backend: ${webhook.url}`);
            return webhook;
          }
        }
      } catch (err) {
        console.warn('[Webhook] Backend registration failed, using local mode:', err);
      }
    }

    // Fallback to local webhook (demo mode)
    const webhook: Webhook = {
      id,
      agentId,
      userId,
      url: `${WEBHOOK_BASE_URL}/${id}`,
      secret,
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

  async deactivate(webhookId: string): Promise<void> {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (!wh) return;

    // Try backend deactivation
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        await fetch(`${API_BASE}/webhooks/${webhookId}/deactivate`, { method: 'POST' });
      } catch { /* non-fatal */ }
    }

    wh.isActive = false;
    saveAll(all);
  },

  async activate(webhookId: string): Promise<void> {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (!wh) return;

    // Try backend activation
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        await fetch(`${API_BASE}/webhooks/${webhookId}/activate`, { method: 'POST' });
      } catch { /* non-fatal */ }
    }

    wh.isActive = true;
    saveAll(all);
  },

  markTriggered(webhookId: string): void {
    const all = loadAll();
    const wh = all.find(w => w.id === webhookId);
    if (wh) {
      wh.lastTriggeredAt = new Date();
      saveAll(all);
    }
  },

  async delete(webhookId: string): Promise<void> {
    // Try backend deletion
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        await fetch(`${API_BASE}/webhooks/${webhookId}`, { method: 'DELETE' });
      } catch { /* non-fatal */ }
    }

    const all = loadAll();
    saveAll(all.filter(w => w.id !== webhookId));
  },

  async deleteByAgent(agentId: string): Promise<void> {
    const all = loadAll();
    const toDelete = all.filter(w => w.agentId === agentId);
    
    // Try backend deletion
    const backendUp = await checkBackend();
    if (backendUp) {
      for (const wh of toDelete) {
        try {
          await fetch(`${API_BASE}/webhooks/${wh.id}`, { method: 'DELETE' });
        } catch { /* non-fatal */ }
      }
    }

    saveAll(all.filter(w => w.agentId !== agentId));
  },

  async validateSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    // Try backend validation (proper HMAC-SHA256)
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        const res = await fetch(`${API_BASE}/webhooks/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload, signature, secret }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.valid === true;
        }
      } catch { /* fall through to local check */ }
    }

    // Fallback: local basic check (demo mode)
    return signature === secret.substring(0, 16);
  },

  async simulateIncoming(webhookId: string, payload: any): Promise<{ success: boolean; agentId?: string }> {
    const wh = this.getById(webhookId);
    if (!wh) return { success: false };
    if (!wh.isActive) return { success: false };

    this.markTriggered(webhookId);

    // Try to trigger via backend
    const backendUp = await checkBackend();
    if (backendUp) {
      try {
        const res = await fetch(`${API_BASE}/webhooks/${webhookId}/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        });
        if (res.ok) {
          return { success: true, agentId: wh.agentId };
        }
      } catch { /* fall through to local trigger */ }
    }

    // Fallback: local event dispatch (demo mode)
    window.dispatchEvent(new CustomEvent('webhook-trigger', {
      detail: { webhookId: wh.id, agentId: wh.agentId, payload },
    }));

    return { success: true, agentId: wh.agentId };
  },

  /** Check if backend webhook support is available */
  async isBackendAvailable(): Promise<boolean> {
    return checkBackend();
  },

  /** Reset backend availability cache (for testing) */
  resetBackendCache(): void {
    _backendAvailable = null;
  },
};
