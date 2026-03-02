/* ═══════════════════════════════════════════════════════════
   Escalation Service — Frontend API for escalation management
   ═══════════════════════════════════════════════════════════ */

const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export type EscalationType = 'execution_failure' | 'low_confidence' | 'flagged_content' | 'manual_review' | 'approval_required' | 'budget_exceeded';
export type EscalationStatus = 'pending' | 'in_review' | 'resolved' | 'dismissed' | 'auto_resolved';
export type EscalationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Escalation {
  id: string;
  type: EscalationType;
  status: EscalationStatus;
  priority: EscalationPriority;
  
  agentId?: string;
  agentName?: string;
  crewId?: string;
  crewName?: string;
  executionId?: string;
  nodeId?: string;
  nodeName?: string;
  
  title: string;
  description: string;
  errorMessage?: string;
  context?: Record<string, unknown>;
  
  originalOutput?: unknown;
  suggestedAction?: string;
  reviewerNotes?: string;
  resolution?: string;
  resolvedBy?: string;
  
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  dueBy?: string;
  
  assignedTo?: string;
  userId: string;
}

export interface EscalationFilters {
  status?: EscalationStatus[];
  type?: EscalationType[];
  priority?: EscalationPriority[];
  agentId?: string;
  crewId?: string;
  userId?: string;
  assignedTo?: string;
}

export interface EscalationSummary {
  total: number;
  pending: number;
  inReview: number;
  resolved: number;
  byPriority: { priority: EscalationPriority; count: number }[];
  byType: { type: EscalationType; count: number }[];
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
}

export const EscalationService = {
  /** List escalations with filters */
  async list(filters: EscalationFilters = {}, limit = 50): Promise<Escalation[]> {
    const params = new URLSearchParams();
    
    if (filters.status?.length) params.set('status', filters.status.join(','));
    if (filters.type?.length) params.set('type', filters.type.join(','));
    if (filters.priority?.length) params.set('priority', filters.priority.join(','));
    if (filters.agentId) params.set('agentId', filters.agentId);
    if (filters.crewId) params.set('crewId', filters.crewId);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    params.set('limit', String(limit));
    
    return apiRequest<Escalation[]>(`/api/escalations?${params.toString()}`);
  },

  /** Get single escalation */
  async get(id: string): Promise<Escalation> {
    return apiRequest<Escalation>(`/api/escalations/${id}`);
  },

  /** Get summary stats */
  async getSummary(userId?: string): Promise<EscalationSummary> {
    const params = userId ? `?userId=${userId}` : '';
    return apiRequest<EscalationSummary>(`/api/escalations/summary${params}`);
  },

  /** Create new escalation */
  async create(data: Omit<Escalation, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Escalation> {
    return apiRequest<Escalation>('/api/escalations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** Update escalation */
  async update(id: string, updates: Partial<Escalation>): Promise<Escalation> {
    return apiRequest<Escalation>(`/api/escalations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /** Resolve escalation */
  async resolve(id: string, resolution: string, resolvedBy: string, reviewerNotes?: string): Promise<Escalation> {
    return apiRequest<Escalation>(`/api/escalations/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, resolvedBy, reviewerNotes }),
    });
  },

  /** Dismiss escalation */
  async dismiss(id: string, reason: string, dismissedBy: string): Promise<Escalation> {
    return apiRequest<Escalation>(`/api/escalations/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason, dismissedBy }),
    });
  },

  /** Assign escalation */
  async assign(id: string, assignedTo: string): Promise<Escalation> {
    return apiRequest<Escalation>(`/api/escalations/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedTo }),
    });
  },

  /** Delete escalation */
  async delete(id: string): Promise<void> {
    await apiRequest<void>(`/api/escalations/${id}`, {
      method: 'DELETE',
    });
  },

  /** Create escalation from execution failure */
  createFromFailure(
    executionId: string,
    agentId: string,
    agentName: string,
    errorMessage: string,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<Escalation> {
    return this.create({
      type: 'execution_failure',
      priority: 'medium',
      title: `Execution failed: ${agentName}`,
      description: `Agent "${agentName}" failed during execution.`,
      agentId,
      agentName,
      executionId,
      errorMessage,
      context,
      userId,
    });
  },

  /** Create escalation for manual review */
  createForReview(
    title: string,
    description: string,
    agentId: string,
    agentName: string,
    userId: string,
    originalOutput?: unknown
  ): Promise<Escalation> {
    return this.create({
      type: 'manual_review',
      priority: 'medium',
      title,
      description,
      agentId,
      agentName,
      originalOutput,
      userId,
    });
  },

  /** Get priority color */
  getPriorityColor(priority: EscalationPriority): string {
    switch (priority) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#6b7280';
    }
  },

  /** Get type label */
  getTypeLabel(type: EscalationType): string {
    switch (type) {
      case 'execution_failure': return 'Execution Failure';
      case 'low_confidence': return 'Low Confidence';
      case 'flagged_content': return 'Flagged Content';
      case 'manual_review': return 'Manual Review';
      case 'approval_required': return 'Approval Required';
      case 'budget_exceeded': return 'Budget Exceeded';
    }
  },

  /** Get status label */
  getStatusLabel(status: EscalationStatus): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'in_review': return 'In Review';
      case 'resolved': return 'Resolved';
      case 'dismissed': return 'Dismissed';
      case 'auto_resolved': return 'Auto-Resolved';
    }
  },
};
