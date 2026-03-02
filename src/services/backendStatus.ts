/* ═══════════════════════════════════════════════════════════
   Backend Status Service
   
   Centralized service for checking backend availability
   across all agent components. Provides consistent health
   checks with caching to avoid excessive polling.
   ═══════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');

export interface BackendStatus {
  available: boolean;
  configured: boolean;
  lastChecked: Date;
  services: {
    sales?: { connected: boolean };
    documents?: { connected: boolean };
    automation?: { connected: boolean };
    gmail?: { connected: boolean; email?: string };
    slack?: { connected: boolean; workspace?: string };
    notion?: { connected: boolean };
    ai?: { configured: boolean };
    browser?: { available: boolean };
  };
}

let cachedStatus: BackendStatus | null = null;
let lastCheckTime = 0;
const CACHE_DURATION_MS = 30_000;

const statusListeners: Set<(status: BackendStatus) => void> = new Set();

async function checkEndpoint(endpoint: string, timeout = 3000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function checkBackendStatus(force = false): Promise<BackendStatus> {
  const now = Date.now();
  
  if (!force && cachedStatus && now - lastCheckTime < CACHE_DURATION_MS) {
    return cachedStatus;
  }

  const [automationRes, salesRes, documentsRes] = await Promise.all([
    checkEndpoint('/automation/status'),
    checkEndpoint('/sales/status'),
    checkEndpoint('/documents/status'),
  ]);

  const status: BackendStatus = {
    available: automationRes !== null || salesRes !== null || documentsRes !== null,
    configured: false,
    lastChecked: new Date(),
    services: {},
  };

  if (automationRes) {
    status.services.automation = { connected: true };
    status.services.gmail = automationRes.gmail;
    status.services.slack = automationRes.slack;
    status.services.ai = automationRes.ai;
    status.services.browser = automationRes.browser;
    status.services.notion = { connected: !!automationRes.notion?.connected };
    status.configured = true;
  }

  if (salesRes) {
    status.services.sales = { connected: true };
    if (salesRes.configured) status.configured = true;
  }

  if (documentsRes) {
    status.services.documents = { connected: true };
    status.configured = true;
  }

  cachedStatus = status;
  lastCheckTime = now;

  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch { /* ignore listener errors */ }
  }

  return status;
}

export function getBackendStatus(): BackendStatus | null {
  return cachedStatus;
}

export function isBackendAvailable(): boolean {
  return cachedStatus?.available ?? false;
}

export function isServiceAvailable(service: keyof BackendStatus['services']): boolean {
  const svc = cachedStatus?.services[service];
  if (!svc) return false;
  if ('connected' in svc) return svc.connected;
  if ('available' in svc) return svc.available;
  if ('configured' in svc) return svc.configured;
  return false;
}

export function subscribeToStatusChanges(callback: (status: BackendStatus) => void): () => void {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
}

export function startBackgroundHealthCheck(intervalMs = 60_000): () => void {
  let active = true;
  
  const check = async () => {
    if (!active) return;
    await checkBackendStatus(true);
    if (active) {
      setTimeout(check, intervalMs);
    }
  };
  
  check();
  
  return () => {
    active = false;
  };
}

export const BackendStatusService = {
  check: checkBackendStatus,
  get: getBackendStatus,
  isAvailable: isBackendAvailable,
  isServiceAvailable,
  subscribe: subscribeToStatusChanges,
  startBackgroundCheck: startBackgroundHealthCheck,
};
