/* ═══════════════════════════════════════════════════════════
   Crew Service — Frontend API client for crew management
   
   Provides CRUD operations for crews and real-time updates
   via Firestore onSnapshot when available.
   ═══════════════════════════════════════════════════════════ */

// In production, use relative /api paths. In dev, VITE_API_URL points to localhost:3001
const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export type CrewMemberRole = 'manager' | 'specialist' | 'reviewer' | 'qa';
export type CrewMemberPermission = 'execute' | 'delegate' | 'review' | 'approve';

export interface CrewMember {
  agentId: string;
  agentName: string;
  role: CrewMemberRole;
  joinedAt: string;
  permissions: CrewMemberPermission[];
}

export interface CrewSettings {
  supervisionLevel: 'none' | 'light' | 'strict';
  requireReviewForOutput: boolean;
  escalationEnabled: boolean;
  escalationThreshold: number;
  maxConcurrentTasks: number;
}

export interface CrewStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgDurationMs: number;
  lastExecutedAt?: string;
}

export interface Crew {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: CrewMember[];
  sharedContext: Record<string, unknown>;
  settings: CrewSettings;
  stats: CrewStats;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

export interface CreateCrewInput {
  name: string;
  description?: string;
  members?: CrewMember[];
  settings?: Partial<CrewSettings>;
  userId?: string;
}

export interface UpdateCrewInput {
  name?: string;
  description?: string;
  settings?: Partial<CrewSettings>;
  status?: 'active' | 'archived';
}

export interface AddMemberInput {
  agentId: string;
  agentName: string;
  role?: CrewMemberRole;
  permissions?: CrewMemberPermission[];
}

export interface UpdateMemberInput {
  role?: CrewMemberRole;
  permissions?: CrewMemberPermission[];
}

export interface CrewExecutionRequest {
  goal: string;
  inputData?: Record<string, unknown>;
}

export interface CrewExecutionInfo {
  crewId: string;
  crewName: string;
  goal: string;
  inputData?: Record<string, unknown>;
  manager: string;
  specialists: string[];
  reviewers: string[];
  settings: CrewSettings;
  startedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const result: ApiResponse<T> = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'API request failed');
  }
  
  return result.data as T;
}

export const CrewService = {
  /** Create a new crew */
  async create(input: CreateCrewInput): Promise<Crew> {
    return apiRequest<Crew>('/api/crews', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** Get all crews for the current user */
  async list(userId?: string): Promise<Crew[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return apiRequest<Crew[]>(`/api/crews${query}`);
  },

  /** Get a specific crew by ID */
  async get(crewId: string): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}`);
  },

  /** Update a crew */
  async update(crewId: string, input: UpdateCrewInput): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /** Archive (soft delete) a crew */
  async archive(crewId: string): Promise<void> {
    await apiRequest<void>(`/api/crews/${crewId}`, {
      method: 'DELETE',
    });
  },

  /** Add a member to a crew */
  async addMember(crewId: string, input: AddMemberInput): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}/members`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** Remove a member from a crew */
  async removeMember(crewId: string, agentId: string): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}/members/${agentId}`, {
      method: 'DELETE',
    });
  },

  /** Update a member's role or permissions */
  async updateMember(
    crewId: string,
    agentId: string,
    input: UpdateMemberInput
  ): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}/members/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /** Update shared context */
  async updateContext(
    crewId: string,
    context: Record<string, unknown>
  ): Promise<Crew> {
    return apiRequest<Crew>(`/api/crews/${crewId}/context`, {
      method: 'PUT',
      body: JSON.stringify({ context }),
    });
  },

  /** Start crew execution (returns execution info for crewExecutor) */
  async startExecution(
    crewId: string,
    request: CrewExecutionRequest
  ): Promise<CrewExecutionInfo> {
    return apiRequest<CrewExecutionInfo>(`/api/crews/${crewId}/execute`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /** Get default settings for a new crew */
  getDefaultSettings(): CrewSettings {
    return {
      supervisionLevel: 'light',
      requireReviewForOutput: false,
      escalationEnabled: true,
      escalationThreshold: 2,
      maxConcurrentTasks: 3,
    };
  },

  /** Get default permissions for a role */
  getDefaultPermissions(role: CrewMemberRole): CrewMemberPermission[] {
    switch (role) {
      case 'manager':
        return ['execute', 'delegate', 'review', 'approve'];
      case 'reviewer':
        return ['review', 'approve'];
      case 'qa':
        return ['review'];
      case 'specialist':
      default:
        return ['execute'];
    }
  },

  /** Calculate crew health score based on stats */
  calculateHealthScore(crew: Crew): number {
    const { stats } = crew;
    if (stats.totalExecutions === 0) return 100;
    
    const successRate = stats.successfulExecutions / stats.totalExecutions;
    return Math.round(successRate * 100);
  },

  /** Get role icon name */
  getRoleIcon(role: CrewMemberRole): string {
    switch (role) {
      case 'manager':
        return 'crown';
      case 'specialist':
        return 'wrench';
      case 'reviewer':
        return 'eye';
      case 'qa':
        return 'shield-check';
      default:
        return 'user';
    }
  },

  /** Get role color */
  getRoleColor(role: CrewMemberRole): string {
    switch (role) {
      case 'manager':
        return '#f59e0b';
      case 'specialist':
        return '#3b82f6';
      case 'reviewer':
        return '#8b5cf6';
      case 'qa':
        return '#10b981';
      default:
        return '#6b7280';
    }
  },
};
