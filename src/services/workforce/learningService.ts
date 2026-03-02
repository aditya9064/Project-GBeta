/* ═══════════════════════════════════════════════════════════
   Learning Service — Analyze feedback and generate improvements
   
   Uses feedback patterns to suggest prompt improvements,
   identify skill gaps, and track agent development over time.
   ═══════════════════════════════════════════════════════════ */

import { FeedbackService, type FeedbackPattern, type ExecutionFeedback } from './feedbackService';

export interface PromptImprovement {
  type: 'system_prompt' | 'user_prompt' | 'few_shot_example' | 'constraint';
  suggestion: string;
  rationale: string;
  confidence: number;
  basedOn: string[];
}

export interface SkillAssessment {
  skillName: string;
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  recentPerformance: number[];
}

export interface AgentLearningProfile {
  agentId: string;
  agentName: string;
  overallScore: number;
  skills: SkillAssessment[];
  suggestedImprovements: PromptImprovement[];
  recentProgress: { date: string; score: number }[];
  strengths: string[];
  weaknesses: string[];
  lastUpdated: string;
}

export interface LearningInsight {
  type: 'improvement' | 'regression' | 'opportunity' | 'achievement';
  title: string;
  description: string;
  agentId?: string;
  metric?: string;
  change?: number;
  timestamp: string;
}

const LEARNING_STORAGE_KEY = 'workforce_learning_profiles';

function getStoredProfiles(): Record<string, AgentLearningProfile> {
  try {
    const stored = localStorage.getItem(LEARNING_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeProfiles(profiles: Record<string, AgentLearningProfile>): void {
  try {
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Ignore storage errors
  }
}

export const LearningService = {
  /**
   * Analyze feedback and generate learning profile for an agent
   */
  async analyzeAgent(agentId: string, agentName: string): Promise<AgentLearningProfile> {
    const summary = await FeedbackService.getSummary(agentId);
    const patterns = summary.patterns;
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(summary);
    
    // Generate skill assessments
    const skills = this.assessSkills(summary, patterns);
    
    // Generate improvement suggestions
    const suggestedImprovements = this.generateImprovements(patterns, summary.recentFeedback);
    
    // Identify strengths and weaknesses
    const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(patterns, skills);
    
    // Track progress over time
    const existingProfile = this.getProfile(agentId);
    const recentProgress = existingProfile?.recentProgress || [];
    recentProgress.push({ date: new Date().toISOString().split('T')[0], score: overallScore });
    
    // Keep last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const filteredProgress = recentProgress.filter(
      p => new Date(p.date) >= thirtyDaysAgo
    ).slice(-30);
    
    const profile: AgentLearningProfile = {
      agentId,
      agentName,
      overallScore,
      skills,
      suggestedImprovements,
      recentProgress: filteredProgress,
      strengths,
      weaknesses,
      lastUpdated: new Date().toISOString(),
    };
    
    // Store profile
    const profiles = getStoredProfiles();
    profiles[agentId] = profile;
    storeProfiles(profiles);
    
    return profile;
  },

  /**
   * Get stored learning profile
   */
  getProfile(agentId: string): AgentLearningProfile | null {
    const profiles = getStoredProfiles();
    return profiles[agentId] || null;
  },

  /**
   * Get agent profile with default if not exists (for UI display)
   */
  getAgentProfile(agentId: string, agentName: string): AgentLearningProfile {
    const existing = this.getProfile(agentId);
    if (existing) return existing;
    
    // Return default profile for agents without feedback yet
    return {
      agentId,
      agentName,
      overallScore: 50,
      skills: [
        { skillName: 'Accuracy', level: 'developing', score: 50, trend: 'stable', recentPerformance: [] },
        { skillName: 'Reliability', level: 'developing', score: 50, trend: 'stable', recentPerformance: [] },
        { skillName: 'Efficiency', level: 'developing', score: 50, trend: 'stable', recentPerformance: [] },
      ],
      suggestedImprovements: [],
      recentProgress: [],
      strengths: [],
      weaknesses: [],
      lastUpdated: new Date().toISOString(),
    };
  },

  /**
   * Get all learning profiles
   */
  getAllProfiles(): AgentLearningProfile[] {
    const profiles = getStoredProfiles();
    return Object.values(profiles);
  },

  /**
   * Calculate overall agent score (0-100)
   */
  calculateOverallScore(summary: Awaited<ReturnType<typeof FeedbackService.getSummary>>): number {
    const { outcomeDistribution, averageRating, correctionRate, totalFeedback } = summary;
    
    if (totalFeedback === 0) return 50;
    
    const total = Object.values(outcomeDistribution).reduce((sum, v) => sum + v, 0);
    const successRate = total > 0 
      ? (outcomeDistribution.success + outcomeDistribution.partial * 0.5) / total 
      : 0;
    
    // Weighted scoring
    const successWeight = 0.4;
    const ratingWeight = 0.3;
    const correctionWeight = 0.3;
    
    const successScore = successRate * 100;
    const ratingScore = (averageRating / 5) * 100;
    const correctionScore = (1 - correctionRate) * 100;
    
    return Math.round(
      successScore * successWeight +
      ratingScore * ratingWeight +
      correctionScore * correctionWeight
    );
  },

  /**
   * Assess skills based on feedback patterns
   */
  assessSkills(
    summary: Awaited<ReturnType<typeof FeedbackService.getSummary>>,
    patterns: FeedbackPattern[]
  ): SkillAssessment[] {
    const skills: SkillAssessment[] = [];
    
    // Accuracy skill
    const { outcomeDistribution, totalFeedback } = summary;
    const total = Object.values(outcomeDistribution).reduce((sum, v) => sum + v, 0);
    const accuracyScore = total > 0 
      ? ((outcomeDistribution.success / total) * 100)
      : 50;
    
    skills.push({
      skillName: 'Accuracy',
      level: this.scoreToLevel(accuracyScore),
      score: Math.round(accuracyScore),
      trend: 'stable',
      recentPerformance: [],
    });
    
    // Consistency skill (based on correction rate)
    const consistencyScore = (1 - summary.correctionRate) * 100;
    skills.push({
      skillName: 'Consistency',
      level: this.scoreToLevel(consistencyScore),
      score: Math.round(consistencyScore),
      trend: 'stable',
      recentPerformance: [],
    });
    
    // User satisfaction skill
    const satisfactionScore = summary.averageRating > 0 
      ? (summary.averageRating / 5) * 100 
      : 50;
    skills.push({
      skillName: 'User Satisfaction',
      level: this.scoreToLevel(satisfactionScore),
      score: Math.round(satisfactionScore),
      trend: 'stable',
      recentPerformance: [],
    });
    
    // Error handling skill (inverse of failure rate)
    const failureRate = total > 0 ? outcomeDistribution.failure / total : 0;
    const errorHandlingScore = (1 - failureRate) * 100;
    skills.push({
      skillName: 'Error Handling',
      level: this.scoreToLevel(errorHandlingScore),
      score: Math.round(errorHandlingScore),
      trend: 'stable',
      recentPerformance: [],
    });
    
    return skills;
  },

  /**
   * Convert score to skill level
   */
  scoreToLevel(score: number): SkillAssessment['level'] {
    if (score >= 90) return 'expert';
    if (score >= 70) return 'proficient';
    if (score >= 50) return 'developing';
    return 'novice';
  },

  /**
   * Generate improvement suggestions based on patterns
   */
  generateImprovements(
    patterns: FeedbackPattern[],
    recentFeedback: ExecutionFeedback[]
  ): PromptImprovement[] {
    const improvements: PromptImprovement[] = [];
    
    // Analyze common failures
    const failures = patterns.filter(p => p.type === 'common_failure');
    for (const failure of failures) {
      improvements.push({
        type: 'system_prompt',
        suggestion: `Add explicit error handling for: ${failure.description}`,
        rationale: `${failure.frequency} failures recorded with this pattern`,
        confidence: Math.min(0.9, 0.5 + failure.frequency * 0.1),
        basedOn: failure.examples.slice(0, 2),
      });
    }
    
    // Analyze improvement opportunities (corrections)
    const opportunities = patterns.filter(p => p.type === 'improvement_opportunity');
    for (const opp of opportunities) {
      improvements.push({
        type: 'few_shot_example',
        suggestion: `Add examples showing correct output for "${opp.description}"`,
        rationale: `Users frequently correct this field (${opp.frequency} times)`,
        confidence: Math.min(0.85, 0.4 + opp.frequency * 0.15),
        basedOn: opp.examples.slice(0, 3),
      });
    }
    
    // Analyze recent negative feedback
    const negativeFeedback = recentFeedback.filter(
      f => f.rating !== undefined && f.rating <= 2 && f.feedbackText
    );
    if (negativeFeedback.length > 0) {
      const commonWords = this.extractCommonTerms(
        negativeFeedback.map(f => f.feedbackText!).filter(Boolean)
      );
      if (commonWords.length > 0) {
        improvements.push({
          type: 'constraint',
          suggestion: `Add constraints addressing: ${commonWords.slice(0, 3).join(', ')}`,
          rationale: `These terms appear frequently in negative feedback`,
          confidence: 0.6,
          basedOn: negativeFeedback.slice(0, 2).map(f => f.feedbackText!),
        });
      }
    }
    
    return improvements.slice(0, 5);
  },

  /**
   * Extract common terms from feedback texts
   */
  extractCommonTerms(texts: string[]): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'it', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'to', 'of', 'in', 'for', 'on', 'with',
      'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
      'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
      'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'they', 'we',
    ]);
    
    const wordCounts: Record<string, number> = {};
    
    for (const text of texts) {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
      
      for (const word of words) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
    
    return Object.entries(wordCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 10);
  },

  /**
   * Identify strengths and weaknesses
   */
  identifyStrengthsWeaknesses(
    patterns: FeedbackPattern[],
    skills: SkillAssessment[]
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    // From patterns
    for (const pattern of patterns) {
      if (pattern.type === 'strength') {
        strengths.push(pattern.description);
      } else if (pattern.type === 'common_failure') {
        weaknesses.push(`Frequent failures: ${pattern.description}`);
      } else if (pattern.type === 'improvement_opportunity') {
        weaknesses.push(`Needs improvement: ${pattern.description}`);
      }
    }
    
    // From skills
    for (const skill of skills) {
      if (skill.level === 'expert') {
        strengths.push(`${skill.skillName}: Expert level (${skill.score}%)`);
      } else if (skill.level === 'novice') {
        weaknesses.push(`${skill.skillName}: Needs development (${skill.score}%)`);
      }
    }
    
    return {
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
    };
  },

  /**
   * Generate learning insights across all agents
   */
  async generateInsights(): Promise<LearningInsight[]> {
    const profiles = this.getAllProfiles();
    const insights: LearningInsight[] = [];
    
    for (const profile of profiles) {
      // Check for recent improvements
      if (profile.recentProgress.length >= 2) {
        const recent = profile.recentProgress.slice(-7);
        const firstScore = recent[0].score;
        const lastScore = recent[recent.length - 1].score;
        const change = lastScore - firstScore;
        
        if (change >= 10) {
          insights.push({
            type: 'improvement',
            title: `${profile.agentName} is improving`,
            description: `Score increased by ${change}% over the last week`,
            agentId: profile.agentId,
            metric: 'overall_score',
            change,
            timestamp: new Date().toISOString(),
          });
        } else if (change <= -10) {
          insights.push({
            type: 'regression',
            title: `${profile.agentName} needs attention`,
            description: `Score decreased by ${Math.abs(change)}% over the last week`,
            agentId: profile.agentId,
            metric: 'overall_score',
            change,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      // Check for opportunities
      if (profile.suggestedImprovements.length > 0) {
        const topImprovement = profile.suggestedImprovements[0];
        if (topImprovement.confidence >= 0.7) {
          insights.push({
            type: 'opportunity',
            title: `Improvement opportunity for ${profile.agentName}`,
            description: topImprovement.suggestion,
            agentId: profile.agentId,
            timestamp: new Date().toISOString(),
          });
        }
      }
      
      // Check for achievements
      if (profile.overallScore >= 90 && profile.skills.some(s => s.level === 'expert')) {
        insights.push({
          type: 'achievement',
          title: `${profile.agentName} reached expert level`,
          description: `Overall score: ${profile.overallScore}% with expert-level skills`,
          agentId: profile.agentId,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return insights.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 10);
  },

  /**
   * Clear learning data for an agent
   */
  clearAgentData(agentId: string): void {
    const profiles = getStoredProfiles();
    delete profiles[agentId];
    storeProfiles(profiles);
  },
};
