/* ═══════════════════════════════════════════════════════════
   Automation API Client
   
   Frontend service for the automation workflow engine.
   Calls the real backend endpoints to execute workflow nodes
   (send emails, post Slack messages, run AI prompts, etc.)
   
   Falls back gracefully when the backend is unavailable,
   returning simulated results for demo mode.
   ═══════════════════════════════════════════════════════════ */

import { log } from '../../utils/logger';
import { getAuthHeaders } from '../../lib/firebase';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');

/* ─── Types ───────────────────────────────────────────── */

export interface AutomationStatus {
  gmail: { connected: boolean; email?: string };
  slack: { connected: boolean; workspace?: string };
  ai: { configured: boolean };
  browser?: { available: boolean; engine?: string; activeSessions?: number };
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  action: string;
  to: string;
  subject: string;
  timestamp: string;
}

export interface GmailReadResult {
  action: string;
  count: number;
  emails: {
    id: string;
    from: string;
    fromEmail: string;
    subject: string;
    preview: string;
    fullMessage: string;
    receivedAt: string;
    priority: string;
    attachments?: { name: string; size: string }[];
  }[];
  timestamp: string;
}

export interface SlackSendResult {
  success: boolean;
  action: string;
  channel: string;
  message: string;
  timestamp: string;
}

export interface AIProcessResult {
  response: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: string;
}

export interface HttpResult {
  status: number;
  statusText: string;
  data: any;
  timestamp: string;
}

/* ─── Generic fetch wrapper ────────────────────────────── */

async function autoFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { ...authHeaders, ...(options?.headers as Record<string, string>) },
    });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error — backend may not be running',
    };
  }
}

/* ─── Backend health check for automation ──────────────── */

let _backendAvailable: boolean | null = null;

export async function checkAutomationBackend(): Promise<AutomationStatus | null> {
  try {
    const result = await autoFetch<AutomationStatus>('/automation/status');
    if (result.success && result.data) {
      _backendAvailable = true;
      return result.data;
    }
    _backendAvailable = false;
    return null;
  } catch {
    _backendAvailable = false;
    return null;
  }
}

export function isBackendAvailable(): boolean {
  return _backendAvailable === true;
}

/* ═══ GMAIL ═══════════════════════════════════════════════ */

export const AutomationGmailAPI = {
  /** Send a new email */
  async send(to: string, subject: string, body: string): Promise<GmailSendResult | null> {
    const result = await autoFetch<GmailSendResult>('/automation/gmail/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Gmail send failed:', result.error);
    return null;
  },

  /** Reply to an existing email */
  async reply(messageId: string, body: string): Promise<{ success: boolean } | null> {
    const result = await autoFetch<{ action: string }>('/automation/gmail/reply', {
      method: 'POST',
      body: JSON.stringify({ messageId, body }),
    });
    if (result.success) return { success: true };
    log.error('[AutomationAPI] Gmail reply failed:', result.error);
    return null;
  },

  /** Read recent emails from inbox */
  async read(maxResults = 10): Promise<GmailReadResult | null> {
    const result = await autoFetch<GmailReadResult>(`/automation/gmail/read?maxResults=${maxResults}`);
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Gmail read failed:', result.error);
    return null;
  },
};

/* ═══ SLACK ═══════════════════════════════════════════════ */

export const AutomationSlackAPI = {
  /** Send a message to a Slack channel */
  async send(channel: string, message: string, threadTs?: string): Promise<SlackSendResult | null> {
    const result = await autoFetch<SlackSendResult>('/automation/slack/send', {
      method: 'POST',
      body: JSON.stringify({ channel, message, threadTs }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Slack send failed:', result.error);
    return null;
  },
};

/* ═══ AI (OpenAI) ═════════════════════════════════════════ */

export const AutomationAIAPI = {
  /** Process input with AI */
  async process(
    prompt: string,
    options?: {
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      input?: any;
    }
  ): Promise<AIProcessResult | null> {
    const result = await autoFetch<AIProcessResult>('/automation/ai/process', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        systemPrompt: options?.systemPrompt,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        input: options?.input,
      }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] AI process failed:', result.error);
    return null;
  },
};

/* ═══ HTTP (Generic) ═════════════════════════════════════ */

export const AutomationHttpAPI = {
  /** Make an HTTP request via the backend proxy */
  async request(
    url: string,
    method = 'GET',
    headers?: Record<string, string>,
    body?: any
  ): Promise<HttpResult | null> {
    const result = await autoFetch<HttpResult>('/automation/http', {
      method: 'POST',
      body: JSON.stringify({ url, method, headers, body }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] HTTP request failed:', result.error);
    return null;
  },
};

/* ═══ NOTION ══════════════════════════════════════════════ */

export interface NotionPageResult {
  pageId: string;
  url?: string;
  title?: string;
  properties?: Record<string, any>;
  timestamp: string;
}

export interface NotionQueryResult {
  results: any[];
  hasMore: boolean;
  nextCursor?: string;
  timestamp: string;
}

export const AutomationNotionAPI = {
  /** Create a new page in a Notion database */
  async createPage(
    databaseId: string,
    properties: Record<string, any>,
    content?: string
  ): Promise<NotionPageResult | null> {
    const result = await autoFetch<NotionPageResult>('/automation/notion/pages', {
      method: 'POST',
      body: JSON.stringify({ databaseId, properties, content }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Notion createPage failed:', result.error);
    return null;
  },

  /** Update an existing Notion page */
  async updatePage(
    pageId: string,
    properties: Record<string, any>
  ): Promise<NotionPageResult | null> {
    const result = await autoFetch<NotionPageResult>(`/automation/notion/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Notion updatePage failed:', result.error);
    return null;
  },

  /** Get a Notion page by ID */
  async getPage(pageId: string): Promise<NotionPageResult | null> {
    const result = await autoFetch<NotionPageResult>(`/automation/notion/pages/${pageId}`);
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Notion getPage failed:', result.error);
    return null;
  },

  /** Query a Notion database */
  async queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: any[]
  ): Promise<NotionQueryResult | null> {
    const result = await autoFetch<NotionQueryResult>('/automation/notion/databases/query', {
      method: 'POST',
      body: JSON.stringify({ databaseId, filter, sorts }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Notion queryDatabase failed:', result.error);
    return null;
  },

  /** Append blocks to a page */
  async appendBlocks(
    pageId: string,
    blocks: any[]
  ): Promise<{ success: boolean; blockIds?: string[] } | null> {
    const result = await autoFetch<{ blockIds: string[] }>(`/automation/notion/blocks/${pageId}/children`, {
      method: 'PATCH',
      body: JSON.stringify({ children: blocks }),
    });
    if (result.success && result.data) return { success: true, blockIds: result.data.blockIds };
    log.error('[AutomationAPI] Notion appendBlocks failed:', result.error);
    return null;
  },
};

/* ═══ BROWSER (Puppeteer) ════════════════════════════════ */

export interface BrowserActionResult {
  success: boolean;
  action: string;
  data?: any;
  screenshot?: string;
  error?: string;
  url?: string;
  title?: string;
  timestamp: string;
}

export const AutomationBrowserAPI = {
  async createSession(sessionId: string, opts?: {
    headless?: boolean;
    width?: number;
    height?: number;
  }): Promise<{ sessionId: string; status: string } | null> {
    const result = await autoFetch<{ sessionId: string; status: string }>('/browser/session', {
      method: 'POST',
      body: JSON.stringify({ sessionId, ...opts }),
    });
    if (result.success && result.data) return result.data;
    log.error('[AutomationAPI] Browser session create failed:', result.error);
    return null;
  },

  async closeSession(sessionId: string): Promise<boolean> {
    const result = await autoFetch(`/browser/session/${sessionId}`, { method: 'DELETE' });
    return result.success;
  },

  async listSessions(): Promise<any[]> {
    const result = await autoFetch<any[]>('/browser/sessions');
    if (result.success && result.data) return result.data;
    return [];
  },

  async action(sessionId: string, action: string, params: Record<string, any> = {}): Promise<BrowserActionResult | null> {
    const result = await autoFetch<BrowserActionResult>('/browser/action', {
      method: 'POST',
      body: JSON.stringify({ sessionId, action, ...params }),
    });
    if (result.success && result.data) return result.data;
    log.error(`[AutomationAPI] Browser action "${action}" failed:`, result.error);
    return null;
  },

  async screenshot(sessionId: string, fullPage = false): Promise<string | null> {
    const result = await autoFetch<{ screenshot: string }>(`/browser/screenshot/${sessionId}?fullPage=${fullPage}`);
    if (result.success && result.data) return result.data.screenshot;
    return null;
  },

  async getStatus(): Promise<{ available: boolean; engine: string; activeSessions: number } | null> {
    const result = await autoFetch<{ available: boolean; engine: string; activeSessions: number }>('/browser/status');
    if (result.success && result.data) return result.data;
    return null;
  },
};



