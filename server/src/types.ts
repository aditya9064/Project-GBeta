/* ═══════════════════════════════════════════════════════════
   Shared types for the Communications AI Agent backend
   ═══════════════════════════════════════════════════════════ */

export type Channel = 'email' | 'slack' | 'teams';
export type MessageStatus = 'pending' | 'ai_drafted' | 'approved' | 'sent' | 'escalated';
export type Priority = 'high' | 'medium' | 'low';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

/* ─── Message ──────────────────────────────────────────── */

export interface Attachment {
  name: string;
  size: string;
  mimeType?: string;
  url?: string;
}

export interface UnifiedMessage {
  id: string;
  externalId: string; // ID from the source platform
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
  receivedAt: Date;
  receivedTime: string;
  relativeTime: string;
  priority: Priority;
  status: MessageStatus;
  aiDraft?: string;
  aiConfidence?: number;
  starred: boolean;
  attachments?: Attachment[];
  threadCount?: number;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: 'user' | 'contact' | 'ai';
  content: string;
  timestamp: Date;
  channel: Channel;
}

/* ─── AI Engine ────────────────────────────────────────── */

export type MessageIntent =
  | 'approval_request'
  | 'question'
  | 'information_sharing'
  | 'action_required'
  | 'follow_up'
  | 'social'
  | 'complaint'
  | 'scheduling'
  | 'technical_issue'
  | 'partnership';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'urgent';
export type Tone = 'formal' | 'professional' | 'casual' | 'friendly' | 'technical';
export type RelationshipType = 'manager' | 'peer' | 'direct_report' | 'external_client' | 'vendor' | 'unknown';

export interface MessageAnalysis {
  intent: MessageIntent;
  sentiment: Sentiment;
  tone: Tone;
  urgency: number; // 0-10
  topics: string[];
  entities: string[];
  requiresAction: boolean;
  suggestedPriority: Priority;
  keyPoints: string[];
  relationship: RelationshipType;
}

export interface AIResponseConfig {
  /** User's preferred name for signatures */
  userName: string;
  /** User's role/title */
  userRole: string;
  /** Company name */
  companyName: string;
  /** Default tone per channel */
  channelTones: Record<Channel, Tone>;
  /** Custom instructions from the user */
  customInstructions: string;
  /** Whether to include signature */
  includeSignature: boolean;
  /** Max response length in words */
  maxResponseLength: number;
  /** Context about the organization */
  orgContext: string;
}

export interface GeneratedResponse {
  draft: string;
  confidence: number;
  analysis: MessageAnalysis;
  reasoning: string;
  alternativeResponses?: string[];
  suggestedActions?: string[];
}

/* ─── Connection ───────────────────────────────────────── */

export interface ChannelConnection {
  channel: Channel;
  status: ConnectionStatus;
  accountEmail?: string;
  accountName?: string;
  connectedAt?: Date;
  lastSyncAt?: Date;
  messageCount?: number;
  error?: string;
  scopes?: string[];
}

/* ─── API Responses ────────────────────────────────────── */

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MessagesResponse {
  messages: UnifiedMessage[];
  total: number;
  channels: Record<Channel, number>;
}

export interface DraftResponse {
  messageId: string;
  draft: GeneratedResponse;
}

