/* ═══════════════════════════════════════════════════════════
   Feedback Service — Collect and analyze execution feedback
   
   Captures user ratings, corrections, and outcomes to enable
   agent learning and improvement over time.
   ═══════════════════════════════════════════════════════════ */

// In production, use relative /api paths. In dev, VITE_API_URL points to localhost:3001
const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export type FeedbackOutcome = 'success' | 'failure' | 'partial' | 'user_corrected';

export interface UserCorrection {
  field: string;
  before: string;
  after: string;
}

export interface ExecutionFeedback {
  id: string;
  executionId: string;
  agentId: string;
  crewId?: string;
  outcome: FeedbackOutcome;
  userCorrections?: UserCorrection[];
  rating?: number;
  feedbackText?: string;
  timestamp: string;
}

export interface SubmitFeedbackInput {
  executionId: string;
  agentId: string;
  crewId?: string;
  outcome: FeedbackOutcome;
  userCorrections?: UserCorrection[];
  rating?: number;
  feedbackText?: string;
}

export interface FeedbackPattern {
  type: 'common_failure' | 'improvement_opportunity' | 'strength';
  description: string;
  frequency: number;
  examples: string[];
  suggestedAction?: string;
}

export interface AgentFeedbackSummary {
  agentId: string;
  totalFeedback: number;
  averageRating: number;
  outcomeDistribution: Record<FeedbackOutcome, number>;
  correctionRate: number;
  patterns: FeedbackPattern[];
  recentFeedback: ExecutionFeedback[];
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

// Local storage for offline/demo mode
const FEEDBACK_STORAGE_KEY = 'workforce_feedback';

function getStoredFeedback(): ExecutionFeedback[] {
  try {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeFeedback(feedback: ExecutionFeedback[]): void {
  try {
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(feedback.slice(-500)));
  } catch {
    // Ignore storage errors
  }
}

export const FeedbackService = {
  /** Submit feedback for an execution */
  async submit(input: SubmitFeedbackInput): Promise<ExecutionFeedback> {
    const feedback: ExecutionFeedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ...input,
      timestamp: new Date().toISOString(),
    };

    try {
      return await apiRequest<ExecutionFeedback>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(feedback),
      });
    } catch {
      // Fallback to local storage
      const stored = getStoredFeedback();
      stored.push(feedback);
      storeFeedback(stored);
      return feedback;
    }
  },

  /** Get feedback history for an agent */
  async getForAgent(agentId: string, limit = 50): Promise<ExecutionFeedback[]> {
    try {
      return await apiRequest<ExecutionFeedback[]>(
        `/api/feedback/agent/${agentId}?limit=${limit}`
      );
    } catch {
      // Fallback to local storage
      return getStoredFeedback()
        .filter(f => f.agentId === agentId)
        .slice(-limit);
    }
  },

  /** Get feedback patterns for an agent */
  async getPatterns(agentId: string): Promise<FeedbackPattern[]> {
    try {
      return await apiRequest<FeedbackPattern[]>(
        `/api/feedback/patterns/${agentId}`
      );
    } catch {
      // Analyze local feedback
      return this.analyzePatterns(agentId);
    }
  },

  /** Get feedback summary for an agent */
  async getSummary(agentId: string): Promise<AgentFeedbackSummary> {
    const feedback = await this.getForAgent(agentId, 100);
    const patterns = await this.getPatterns(agentId);

    const outcomeDistribution: Record<FeedbackOutcome, number> = {
      success: 0,
      failure: 0,
      partial: 0,
      user_corrected: 0,
    };

    let totalRating = 0;
    let ratingCount = 0;
    let correctionCount = 0;

    feedback.forEach(f => {
      outcomeDistribution[f.outcome]++;
      if (f.rating !== undefined) {
        totalRating += f.rating;
        ratingCount++;
      }
      if (f.userCorrections && f.userCorrections.length > 0) {
        correctionCount++;
      }
    });

    return {
      agentId,
      totalFeedback: feedback.length,
      averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
      outcomeDistribution,
      correctionRate: feedback.length > 0 ? correctionCount / feedback.length : 0,
      patterns,
      recentFeedback: feedback.slice(-10),
    };
  },

  /** Analyze feedback patterns locally */
  analyzePatterns(agentId: string): FeedbackPattern[] {
    const feedback = getStoredFeedback().filter(f => f.agentId === agentId);
    const patterns: FeedbackPattern[] = [];

    // Analyze failure patterns
    const failures = feedback.filter(f => f.outcome === 'failure');
    if (failures.length >= 3) {
      const failureTexts = failures
        .map(f => f.feedbackText)
        .filter(Boolean) as string[];
      
      patterns.push({
        type: 'common_failure',
        description: `Agent has ${failures.length} recorded failures`,
        frequency: failures.length,
        examples: failureTexts.slice(0, 3),
        suggestedAction: 'Review failure cases and improve error handling',
      });
    }

    // Analyze correction patterns
    const corrections = feedback.filter(
      f => f.userCorrections && f.userCorrections.length > 0
    );
    if (corrections.length >= 2) {
      const correctedFields = corrections.flatMap(
        f => f.userCorrections?.map(c => c.field) || []
      );
      const fieldCounts = correctedFields.reduce((acc, field) => {
        acc[field] = (acc[field] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topField = Object.entries(fieldCounts)
        .sort((a, b) => b[1] - a[1])[0];

      if (topField) {
        patterns.push({
          type: 'improvement_opportunity',
          description: `"${topField[0]}" field frequently corrected`,
          frequency: topField[1],
          examples: corrections
            .flatMap(f => f.userCorrections || [])
            .filter(c => c.field === topField[0])
            .slice(0, 3)
            .map(c => `${c.before} → ${c.after}`),
          suggestedAction: `Improve prompt or logic for "${topField[0]}" generation`,
        });
      }
    }

    // Identify strengths
    const successes = feedback.filter(f => f.outcome === 'success');
    const successRate = feedback.length > 0 
      ? successes.length / feedback.length 
      : 0;
    
    if (successRate >= 0.8 && feedback.length >= 5) {
      patterns.push({
        type: 'strength',
        description: `High success rate: ${Math.round(successRate * 100)}%`,
        frequency: successes.length,
        examples: [],
      });
    }

    return patterns;
  },

  /** Record a user correction (helper for tracking edits) */
  createCorrection(field: string, before: string, after: string): UserCorrection {
    return { field, before, after };
  },

  /** Calculate outcome from success status */
  determineOutcome(
    success: boolean,
    hasCorrections: boolean
  ): FeedbackOutcome {
    if (!success) return 'failure';
    if (hasCorrections) return 'user_corrected';
    return 'success';
  },
};
