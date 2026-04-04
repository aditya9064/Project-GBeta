/* ═══════════════════════════════════════════════════════════
   Memory API Client
   
   Frontend service for interacting with the memory system.
   Uses the 3-layer search pattern from claude-mem.
   ═══════════════════════════════════════════════════════════ */

import { auth } from '../lib/firebase';

const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return { 'Content-Type': 'application/json' };
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function memoryRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}/api/memory${endpoint}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Memory API request failed');
  }
  return result;
}

export interface MemorySession {
  id: string;
  userId: string;
  agentType: string;
  project: string;
  userPrompt: string;
  title?: string;
  status: 'active' | 'completed' | 'failed';
  observationCount: number;
  createdAt: string;
  createdAtEpoch: number;
  completedAt?: string;
}

export interface MemoryObservation {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  subtitle?: string;
  narrative?: string;
  facts: string[];
  concepts: string[];
  toolName?: string;
  createdAt: string;
  createdAtEpoch: number;
}

export interface MemorySummary {
  id: string;
  sessionId: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  nextSteps?: string;
  notes?: string;
  createdAt: string;
}

export interface SearchIndexEntry {
  id: string;
  type: string;
  title: string;
  project: string;
  createdAt: string;
  score: number;
}

export interface TimelineEntry {
  timestamp: number;
  type: 'observation' | 'summary' | 'session_start' | 'session_end';
  data: any;
}

export interface MemoryStats {
  totalSessions: number;
  totalObservations: number;
  totalSummaries: number;
  oldestSession?: string;
  newestSession?: string;
}

export interface ContextOutput {
  recentObservations: MemoryObservation[];
  recentSummaries: MemorySummary[];
  relevantContext: string;
  tokenEstimate: number;
  sessionCount: number;
  observationCount: number;
}

export const MemoryApi = {
  async getSessions(limit = 20, offset = 0): Promise<MemorySession[]> {
    const result = await memoryRequest<{ sessions: MemorySession[] }>(
      `/sessions?limit=${limit}&offset=${offset}`
    );
    return result.sessions;
  },

  async getSession(sessionId: string): Promise<{
    session: MemorySession;
    observations: MemoryObservation[];
    summary: MemorySummary | null;
  }> {
    return memoryRequest(`/sessions/${sessionId}`);
  },

  async search(query: string, options: { project?: string; type?: string; limit?: number } = {}): Promise<SearchIndexEntry[]> {
    const params = new URLSearchParams({ q: query });
    if (options.project) params.set('project', options.project);
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', String(options.limit));

    const result = await memoryRequest<{ results: SearchIndexEntry[] }>(
      `/search?${params}`
    );
    return result.results;
  },

  async timeline(options: {
    observationId?: string;
    timestamp?: number;
    windowMs?: number;
    limit?: number;
  } = {}): Promise<TimelineEntry[]> {
    const params = new URLSearchParams();
    if (options.observationId) params.set('observationId', options.observationId);
    if (options.timestamp) params.set('timestamp', String(options.timestamp));
    if (options.windowMs) params.set('windowMs', String(options.windowMs));
    if (options.limit) params.set('limit', String(options.limit));

    const result = await memoryRequest<{ timeline: TimelineEntry[] }>(
      `/timeline?${params}`
    );
    return result.timeline;
  },

  async getDetails(ids: string[]): Promise<MemoryObservation[]> {
    const result = await memoryRequest<{ observations: MemoryObservation[] }>(
      '/details',
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }
    );
    return result.observations;
  },

  async getContext(options: {
    project?: string;
    agentType?: string;
    query?: string;
  } = {}): Promise<ContextOutput> {
    const params = new URLSearchParams();
    if (options.project) params.set('project', options.project);
    if (options.agentType) params.set('agentType', options.agentType);
    if (options.query) params.set('q', options.query);

    const result = await memoryRequest<{ context: ContextOutput }>(
      `/context?${params}`
    );
    return result.context;
  },

  async getStats(): Promise<MemoryStats> {
    const result = await memoryRequest<{ stats: MemoryStats }>('/stats');
    return result.stats;
  },
};
