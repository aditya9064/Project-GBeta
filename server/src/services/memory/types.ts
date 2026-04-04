/* ═══════════════════════════════════════════════════════════
   Memory System — Type Definitions
   
   Adapted from claude-mem's architecture: sessions track
   conversations, observations capture what agents learn,
   and summaries compress sessions for future context.
   ═══════════════════════════════════════════════════════════ */

export type ObservationType =
  | 'decision'
  | 'bugfix'
  | 'feature'
  | 'discovery'
  | 'action'
  | 'error'
  | 'navigation'
  | 'interaction'
  | 'api_call'
  | 'conversation';

export type SessionStatus = 'active' | 'completed' | 'failed';

export interface MemorySession {
  id: string;
  userId: string;
  agentType: string;
  project: string;
  userPrompt: string;
  title?: string;
  status: SessionStatus;
  observationCount: number;
  createdAt: string;
  createdAtEpoch: number;
  completedAt?: string;
  completedAtEpoch?: number;
  metadata?: Record<string, any>;
}

export interface ObservationInput {
  type: ObservationType;
  title: string;
  subtitle?: string;
  narrative?: string;
  facts?: string[];
  concepts?: string[];
  filesRead?: string[];
  filesModified?: string[];
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
}

export interface MemoryObservation {
  id: string;
  sessionId: string;
  userId: string;
  project: string;
  type: ObservationType;
  title: string;
  subtitle?: string;
  narrative?: string;
  facts: string[];
  concepts: string[];
  filesRead: string[];
  filesModified: string[];
  toolName?: string;
  contentHash: string;
  promptNumber?: number;
  createdAt: string;
  createdAtEpoch: number;
}

export interface SummaryInput {
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  nextSteps?: string;
  notes?: string;
}

export interface MemorySummary {
  id: string;
  sessionId: string;
  userId: string;
  project: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  nextSteps?: string;
  notes?: string;
  createdAt: string;
  createdAtEpoch: number;
}

export interface SearchQuery {
  query: string;
  userId: string;
  project?: string;
  agentType?: string;
  type?: ObservationType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  observations: MemoryObservation[];
  summaries: MemorySummary[];
  totalCount: number;
}

export interface TimelineEntry {
  timestamp: number;
  type: 'observation' | 'summary' | 'session_start' | 'session_end';
  data: MemoryObservation | MemorySummary | MemorySession;
}

export interface ContextOutput {
  recentObservations: MemoryObservation[];
  recentSummaries: MemorySummary[];
  relevantContext: string;
  tokenEstimate: number;
  sessionCount: number;
  observationCount: number;
}

export interface MemoryConfig {
  maxObservationsPerContext: number;
  maxSummariesPerContext: number;
  dedupWindowMs: number;
  sessionTtlMs: number;
  maxSessionsPerUser: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxObservationsPerContext: 25,
  maxSummariesPerContext: 5,
  dedupWindowMs: 30_000,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  maxSessionsPerUser: 100,
};
