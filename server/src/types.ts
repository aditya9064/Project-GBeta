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

/* ─── Style Analysis ──────────────────────────────────── */

export interface StyleProfile {
  contactId: string;
  contactName: string;
  contactEmail?: string;
  /** Communication style characteristics (NO content stored) */
  formality: 'very_formal' | 'formal' | 'neutral' | 'casual' | 'very_casual';
  averageLength: 'brief' | 'moderate' | 'detailed';
  emojiUsage: 'none' | 'minimal' | 'moderate' | 'frequent';
  greetingStyle: string;
  closingStyle: string;
  vocabularyLevel: 'simple' | 'moderate' | 'advanced' | 'technical';
  sentenceStructure: 'short_direct' | 'balanced' | 'complex_detailed';
  usesSlang: boolean;
  usesBulletPoints: boolean;
  typicalCategories: string[];
  relationship: RelationshipType;
  analyzedAt: Date;
  messageCount: number;

  /* ── Granular style fingerprint (for >90% voice accuracy) ── */

  /** Does the user use contractions? ("don't" vs "do not") */
  usesContractions: boolean;
  /** Capitalization style: "standard", "all_lower", "sentence_case", "title_case" */
  capitalization: 'standard' | 'all_lower' | 'sentence_case' | 'title_case';
  /** Punctuation habits */
  punctuation: {
    /** Uses exclamation marks? e.g. "Sounds great!" */
    exclamationFrequency: 'never' | 'rare' | 'moderate' | 'frequent';
    /** Uses ellipsis? e.g. "well..." */
    usesEllipsis: boolean;
    /** Uses em-dashes? e.g. "the project — our top priority — needs..." */
    usesEmDash: boolean;
    /** Ends questions with ? or leaves them as statements */
    questionMarkUsage: 'always' | 'sometimes' | 'rarely';
    /** Uses semicolons in compound sentences */
    usesSemicolons: boolean;
    /** Uses parenthetical asides */
    usesParentheses: boolean;
  };
  /** Common transitional phrases the user uses (e.g. "that said", "moving forward", "to be honest") */
  commonTransitions: string[];
  /** Common filler/hedge phrases (e.g. "I think", "maybe", "just", "probably") */
  hedgeWords: string[];
  /** How the user refers to themselves: "I" heavy, "we" (team-oriented), avoids pronouns */
  pronounPreference: 'i_focused' | 'we_focused' | 'mixed' | 'avoids_pronouns';
  /** Does the user ask questions back? (engagement style) */
  asksFollowUpQuestions: boolean;
  /** Humor/personality indicators */
  humorStyle: 'none' | 'dry_wit' | 'casual_jokes' | 'playful' | 'sarcastic';
  /** Paragraph structure: single block, short paragraphs, spaced-out */
  paragraphStyle: 'single_block' | 'short_paragraphs' | 'well_structured' | 'one_liners';
  /** Response time awareness: does the user apologize for late replies, reference timing? */
  timeAwareness: boolean;
  /** Action-orientation: does the user typically end with next steps / action items? */
  endsWithActionItems: boolean;
  /** Acknowledgment style: how the user acknowledges receipt ("Got it", "Thanks for sharing", "Noted") */
  acknowledgmentStyle: string;
  /** Typical sign-off name (e.g. "John", "J", full name, or none) */
  signOffName: string;
  /** Average words per message (precise number) */
  avgWordsPerMessage: number;
  /** Average sentences per message */
  avgSentencesPerMessage: number;
  /** Channel-specific tone override (user may be casual on Slack but formal in email) */
  channelOverride?: 'email' | 'slack' | 'teams';
  /** Overall style confidence (0-100 — how sure we are about this profile) */
  styleConfidence: number;
  /** Number of distinct style samples analyzed */
  sampleCount: number;
}

export interface StyleAnalysisResult {
  profilesCreated: number;
  messagesAnalyzed: number;
  overallConfidence: number;
  contacts: { name: string; email?: string; messageCount: number; confidence: number }[];
}

/* ─── VIP Contacts ────────────────────────────────────── */

export interface VIPContact {
  id: string;
  name: string;
  email?: string;
  channel?: Channel;
  addedAt: Date;
  reason?: string;
}

export interface ApprovalRequest {
  id: string;
  messageId: string;
  originalFrom: string;
  originalPreview: string;
  originalChannel: Channel;
  aiDraft: string;
  confidence: number;
  createdAt: Date;
  status: 'pending' | 'approved' | 'reviewed' | 'cancelled';
}

