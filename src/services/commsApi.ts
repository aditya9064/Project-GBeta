/* ═══════════════════════════════════════════════════════════
   Communications API Client
   
   Frontend service for the Communications AI Agent backend.
   
   In production: Uses Firebase Hosting rewrites — /api/*
     requests are routed to the Cloud Function on the same
     domain, so there are ZERO CORS issues.
   
   In dev: Uses Vite proxy → /api/* → localhost:5001
     (Firebase emulator or direct Express server)
   ═══════════════════════════════════════════════════════════ */

// With Firebase Hosting rewrites, /api works in both dev (Vite proxy) and production
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/* ─── Types (mirror of server types) ───────────────────── */

export type Channel = 'email' | 'slack' | 'teams';
export type MessageStatus = 'pending' | 'ai_drafted' | 'approved' | 'sent' | 'escalated';
export type Priority = 'high' | 'medium' | 'low';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface Attachment {
  name: string;
  size: string;
}

export interface UnifiedMessage {
  id: string;
  externalId: string;
  channel: Channel;
  from: string;
  fromEmail?: string;
  fromInitial: string;
  fromColor: string;
  subject?: string;
  slackChannel?: string;
  teamsChannel?: string;
  preview: string;
  fullMessage: string;
  receivedAt: string;
  receivedTime: string;
  relativeTime: string;
  priority: Priority;
  status: MessageStatus;
  aiDraft?: string;
  aiConfidence?: number;
  starred: boolean;
  attachments?: Attachment[];
  threadCount?: number;
  metadata?: Record<string, unknown>;
  /** True if this message came from a group chat / channel (Slack channel, Teams group) */
  isGroupChat?: boolean;
  /** True if the user was mentioned or their name appeared in this group message */
  mentionsUser?: boolean;
}

export interface MessageAnalysis {
  intent: string;
  sentiment: string;
  tone: string;
  urgency: number;
  topics: string[];
  entities: string[];
  requiresAction: boolean;
  suggestedPriority: Priority;
  keyPoints: string[];
  relationship: string;
}

export interface GeneratedDraft {
  draft: string;
  confidence: number;
  analysis: MessageAnalysis;
  reasoning: string;
}

export interface ChannelConnection {
  channel: Channel;
  status: ConnectionStatus;
  accountEmail?: string;
  accountName?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  messageCount?: number;
  error?: string;
}

export interface AIConfig {
  userName: string;
  userRole: string;
  companyName: string;
  channelTones: Record<Channel, string>;
  customInstructions: string;
  includeSignature: boolean;
  maxResponseLength: number;
  orgContext: string;
}

/* ─── VIP & Approval Types ─────────────────────────────── */

export interface VIPContact {
  id: string;
  name: string;
  email?: string;
  channel?: Channel;
  avatarColor: string;
  initials: string;
}

export interface ApprovalItem {
  id: string;
  messageId: string;
  from: string;
  fromInitial: string;
  fromColor: string;
  channel: Channel;
  subject?: string;
  originalPreview: string;
  originalFull: string;
  slackChannel?: string;
  teamsChannel?: string;
  aiDraft: string;
  confidence: number;
  createdAt: Date;
}

export interface VIPNotification {
  id: string;
  messageId: string;
  from: string;
  fromInitial: string;
  fromColor: string;
  channel: Channel;
  subject?: string;
  preview: string;
  timestamp: Date;
}

/* ─── Channel Group Summary (for grouped chat view) ───── */

export interface ChannelGroupSummary {
  id: string;
  channel: Channel;
  channelName: string;
  totalInChannel: number;
  relevantMessages: UnifiedMessage[];
  high: UnifiedMessage[];
  medium: UnifiedMessage[];
  low: UnifiedMessage[];
}

export interface StyleProfile {
  contactName: string;
  contactEmail?: string;
  formality: string;
  averageLength: string;
  emojiUsage: string;
  greetingStyle: string;
  closingStyle: string;
  vocabularyLevel: string;
  sentenceStructure: string;
  usesContractions: boolean;
  capitalization: string;
  pronounPreference: string;
  asksFollowUpQuestions: boolean;
  humorStyle: string;
  paragraphStyle: string;
  endsWithActionItems: boolean;
  acknowledgmentStyle: string;
  signOffName: string;
  commonTransitions: string[];
  hedgeWords: string[];
  avgWordsPerMessage: number;
  styleConfidence: number;
  messageCount: number;
}

/* ─── Generic fetch wrapper ────────────────────────────── */

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/* ─── Messages API ─────────────────────────────────────── */

export const MessagesAPI = {
  /** Fetch all messages with optional filters */
  async getMessages(filters?: {
    channel?: string;
    status?: string;
    priority?: string;
    search?: string;
  }): Promise<{ messages: UnifiedMessage[]; total: number; channels: Record<Channel, number> } | null> {
    const params = new URLSearchParams();
    if (filters?.channel) params.set('channel', filters.channel);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.search) params.set('search', filters.search);

    const qs = params.toString();
    const result = await apiFetch<any>(`/messages${qs ? `?${qs}` : ''}`);
    return result.success ? result.data : null;
  },

  /** Get a single message */
  async getMessage(id: string): Promise<UnifiedMessage | null> {
    const result = await apiFetch<UnifiedMessage>(`/messages/${id}`);
    return result.success ? result.data! : null;
  },

  /** Generate an AI draft for a message */
  async generateDraft(id: string, feedback?: string): Promise<GeneratedDraft | null> {
    const result = await apiFetch<GeneratedDraft>(`/messages/${id}/draft`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
    return result.success ? result.data! : null;
  },

  /** Send a drafted response */
  async sendDraft(id: string, draft?: string): Promise<boolean> {
    const result = await apiFetch(`/messages/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ draft }),
    });
    return result.success;
  },

  /** Update a message (star, status, draft text) */
  async updateMessage(id: string, updates: Partial<UnifiedMessage>): Promise<UnifiedMessage | null> {
    const result = await apiFetch<UnifiedMessage>(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return result.success ? result.data! : null;
  },

  /** Sync messages from all connected channels */
  async sync(): Promise<{ results: any[]; totalMessages: number } | null> {
    const result = await apiFetch<any>('/messages/sync', { method: 'POST' });
    return result.success ? result.data : null;
  },

  /** Auto-draft all pending messages */
  async autoDraftAll(): Promise<{ processed: number; successful: number } | null> {
    const result = await apiFetch<any>('/messages/draft-all', { method: 'POST' });
    return result.success ? result.data : null;
  },
};

/* ─── Connections API ──────────────────────────────────── */

export const ConnectionsAPI = {
  /** Get all connection statuses */
  async getConnections(): Promise<ChannelConnection[]> {
    const result = await apiFetch<ChannelConnection[]>('/connections');
    return result.success && result.data ? result.data : [];
  },

  /** Start Gmail OAuth flow — returns auth URL */
  async connectGmail(): Promise<string | null> {
    const result = await apiFetch<{ authUrl: string }>('/connections/gmail');
    return result.success && result.data ? result.data.authUrl : null;
  },

  /** Start Slack OAuth flow — returns auth URL */
  async connectSlack(): Promise<string | null> {
    const result = await apiFetch<{ authUrl: string }>('/connections/slack');
    return result.success && result.data ? result.data.authUrl : null;
  },

  /** Start Teams OAuth flow — returns auth URL */
  async connectTeams(): Promise<string | null> {
    const result = await apiFetch<{ authUrl: string }>('/connections/teams');
    return result.success && result.data ? result.data.authUrl : null;
  },

  /** Disconnect a channel */
  async disconnect(channel: Channel): Promise<boolean> {
    const result = await apiFetch(`/connections/${channel}`, { method: 'DELETE' });
    return result.success;
  },
};

/* ─── AI Engine API ────────────────────────────────────── */

export const AIAPI = {
  /** Analyze a message */
  async analyze(message: UnifiedMessage, full = false): Promise<MessageAnalysis | null> {
    const result = await apiFetch<MessageAnalysis>(`/ai/analyze${full ? '?full=true' : ''}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return result.success ? result.data! : null;
  },

  /** Generate a response for arbitrary message data */
  async generate(message: UnifiedMessage, feedback?: string): Promise<GeneratedDraft | null> {
    const result = await apiFetch<GeneratedDraft>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ message, feedback }),
    });
    return result.success ? result.data! : null;
  },

  /** Get AI engine config */
  async getConfig(): Promise<AIConfig | null> {
    const result = await apiFetch<AIConfig>('/ai/config');
    return result.success ? result.data! : null;
  },

  /** Update AI engine config */
  async updateConfig(config: Partial<AIConfig>): Promise<AIConfig | null> {
    const result = await apiFetch<AIConfig>('/ai/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return result.success ? result.data! : null;
  },

  /** Analyze user's communication style from messages */
  async analyzeStyle(messages: UnifiedMessage[]): Promise<{
    profilesCreated: number;
    messagesAnalyzed: number;
    overallConfidence: number;
    contacts: { name: string; email?: string; messageCount: number; confidence: number }[];
  } | null> {
    const result = await apiFetch<any>('/ai/analyze-style', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    return result.success ? result.data : null;
  },
};

/* ─── Health check ─────────────────────────────────────── */

export async function checkBackendHealth(): Promise<{
  ok: boolean;
  services: Record<string, string>;
}> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const ok = data.status === 'ok';
    return { ok, services: data.services || {} };
  } catch (err) {
    console.error('❌ Health check failed:', err);
    return { ok: false, services: {} };
  }
}
