// Proactive Agent — Background awareness that surfaces insights
//
// Unlike reactive triggers (email arrives → run workflow), the proactive agent
// continuously scans data sources and reasons about what the user should know.
//
// Examples:
//   - "3 unanswered emails from your boss over 2 days"
//   - "Invoice #4521 is due tomorrow and hasn't been sent"
//   - "Meeting with Acme Corp in 2 hours — pulled latest sales data"

import {
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationAIAPI,
} from './automationApi';
import { EnhancedMemoryService } from './enhancedMemory';

export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';
export type InsightCategory = 'email' | 'calendar' | 'task' | 'pattern' | 'anomaly';

export interface ProactiveInsight {
  id: string;
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  description: string;
  suggestedAction?: string;
  data?: any;
  createdAt: Date;
  expiresAt?: Date;
  dismissed: boolean;
  actionTaken: boolean;
}

type InsightHandler = (insight: ProactiveInsight) => void;

interface ProactiveAgentState {
  isRunning: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  lastScanAt: Date | null;
  insights: ProactiveInsight[];
  handlers: Set<InsightHandler>;
  scanCount: number;
  lastEmailIds: Set<string>;
  emailResponseTimes: Map<string, { from: string; receivedAt: Date; replied: boolean }>;
}

const state: ProactiveAgentState = {
  isRunning: false,
  intervalId: null,
  lastScanAt: null,
  insights: [],
  handlers: new Set(),
  scanCount: 0,
  lastEmailIds: new Set(),
  emailResponseTimes: new Map(),
};

const SCAN_INTERVAL_MS = 5 * 60_000; // 5 minutes
const INSIGHT_STORAGE_KEY = 'proactive_insights';
const PROACTIVE_AGENT_ID = 'proactive-awareness-agent';

function loadInsights(): ProactiveInsight[] {
  try {
    const raw = localStorage.getItem(INSIGHT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((i: any) => ({
      ...i,
      createdAt: new Date(i.createdAt),
      expiresAt: i.expiresAt ? new Date(i.expiresAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveInsights(insights: ProactiveInsight[]): void {
  const trimmed = insights.slice(-100);
  try {
    localStorage.setItem(INSIGHT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

function generateId(): string {
  return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function addInsight(insight: Omit<ProactiveInsight, 'id' | 'createdAt' | 'dismissed' | 'actionTaken'>): ProactiveInsight {
  const existing = state.insights.find(
    i => i.title === insight.title && !i.dismissed && !i.actionTaken,
  );
  if (existing) return existing;

  const full: ProactiveInsight = {
    ...insight,
    id: generateId(),
    createdAt: new Date(),
    dismissed: false,
    actionTaken: false,
  };

  state.insights.push(full);
  saveInsights(state.insights);

  for (const handler of state.handlers) {
    try { handler(full); } catch { /* ignore */ }
  }

  return full;
}

// ═══ SCAN FUNCTIONS ═════════════════════════════════════════

async function scanEmails(): Promise<void> {
  if (!isBackendAvailable()) return;

  try {
    const result = await AutomationGmailAPI.read(20);
    if (!result?.emails) return;

    const now = new Date();

    // Track new emails and detect unanswered patterns
    const unansweredByPerson: Map<string, { count: number; oldest: Date; emails: any[] }> = new Map();

    for (const email of result.emails) {
      const from = email.fromEmail || email.from || '';
      const receivedAt = new Date(email.receivedAt || now);
      const ageHours = (now.getTime() - receivedAt.getTime()) / (1000 * 60 * 60);

      if (!state.emailResponseTimes.has(email.id)) {
        state.emailResponseTimes.set(email.id, {
          from,
          receivedAt,
          replied: false,
        });
      }

      // Track unanswered emails older than 4 hours
      if (ageHours > 4 && !state.emailResponseTimes.get(email.id)?.replied) {
        const existing = unansweredByPerson.get(from) || { count: 0, oldest: now, emails: [] };
        existing.count++;
        if (receivedAt < existing.oldest) existing.oldest = receivedAt;
        existing.emails.push(email);
        unansweredByPerson.set(from, existing);
      }
    }

    // Generate insights for senders with multiple unanswered emails
    for (const [sender, data] of unansweredByPerson) {
      if (data.count >= 2) {
        const ageHours = Math.round((now.getTime() - data.oldest.getTime()) / (1000 * 60 * 60));
        const ageDays = Math.floor(ageHours / 24);
        const ageStr = ageDays > 0 ? `${ageDays} day(s)` : `${ageHours} hours`;

        addInsight({
          category: 'email',
          priority: data.count >= 3 ? 'high' : 'medium',
          title: `${data.count} unanswered emails from ${sender.split('@')[0]}`,
          description: `You have ${data.count} unanswered emails from ${sender} spanning ${ageStr}. The oldest was received ${ageStr} ago.`,
          suggestedAction: `Draft replies to ${sender}`,
          data: {
            sender,
            count: data.count,
            subjects: data.emails.map((e: any) => e.subject).slice(0, 5),
          },
        });
      }
    }

    // Store facts about frequent senders in semantic memory
    const senderCounts = new Map<string, number>();
    for (const email of result.emails) {
      const from = email.fromEmail || email.from || '';
      senderCounts.set(from, (senderCounts.get(from) || 0) + 1);
    }

    for (const [sender, count] of senderCounts) {
      if (count >= 3) {
        await EnhancedMemoryService.storeFact(PROACTIVE_AGENT_ID, {
          category: 'pattern',
          subject: sender,
          predicate: 'emails_frequently',
          object: { recentCount: count, lastScan: now.toISOString() },
          confidence: 0.7,
          source: 'email_scan',
        });
      }
    }
  } catch (err: any) {
    console.warn('[Proactive] Email scan failed:', err.message);
  }
}

async function scanForPatterns(): Promise<void> {
  if (!isBackendAvailable()) return;

  try {
    const recentEpisodes = await EnhancedMemoryService.getRecentEpisodes(PROACTIVE_AGENT_ID, 50);
    const failures = recentEpisodes.filter(e => e.outcome === 'failure');

    if (failures.length >= 3) {
      const recentFailures = failures.slice(0, 5);
      const commonEntities = findCommonEntities(recentFailures.map(f => f.relatedEntities));

      if (commonEntities.length > 0) {
        addInsight({
          category: 'anomaly',
          priority: 'high',
          title: `Recurring failures involving ${commonEntities[0]}`,
          description: `${failures.length} recent failures involve "${commonEntities[0]}". This may indicate a systemic issue.`,
          suggestedAction: `Review and fix workflows related to ${commonEntities[0]}`,
          data: {
            failureCount: failures.length,
            commonEntities,
            recentErrors: recentFailures.map(f => f.summary),
          },
        });
      }
    }
  } catch (err: any) {
    console.warn('[Proactive] Pattern scan failed:', err.message);
  }
}

function findCommonEntities(entityLists: string[][]): string[] {
  if (entityLists.length === 0) return [];
  const counts = new Map<string, number>();
  for (const list of entityLists) {
    for (const entity of list) {
      counts.set(entity, (counts.get(entity) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([entity]) => entity);
}

async function analyzeInsightsWithAI(): Promise<void> {
  if (!isBackendAvailable()) return;

  const activeInsights = state.insights.filter(i => !i.dismissed && !i.actionTaken);
  if (activeInsights.length === 0) return;

  const insightSummary = activeInsights
    .map(i => `- [${i.priority}] ${i.title}: ${i.description}`)
    .join('\n');

  try {
    const result = await AutomationAIAPI.process(
      `You are a proactive executive assistant. Given these active insights about the user's work, suggest which one is most urgent and why. Keep it to 2-3 sentences.\n\nInsights:\n${insightSummary}`,
      { model: 'gpt-4', temperature: 0.3, maxTokens: 200 },
    );

    if (result?.response) {
      const summary = typeof result.response === 'string'
        ? result.response
        : result.response.result || JSON.stringify(result.response);

      await EnhancedMemoryService.recordEpisode(PROACTIVE_AGENT_ID, {
        eventType: 'decision',
        summary: `AI prioritization: ${summary}`,
        outcome: 'success',
        details: { insightCount: activeInsights.length, aiSummary: summary },
        relatedEntities: activeInsights.map(i => i.category),
        importance: 0.6,
      });
    }
  } catch {
    // AI analysis is optional; swallow errors
  }
}

async function runScan(): Promise<void> {
  state.scanCount++;
  state.lastScanAt = new Date();

  console.log(`[Proactive] Running scan #${state.scanCount}`);

  await Promise.allSettled([
    scanEmails(),
    scanForPatterns(),
  ]);

  // AI analysis every 3rd scan
  if (state.scanCount % 3 === 0) {
    await analyzeInsightsWithAI();
  }

  // Expire old insights
  const now = new Date();
  state.insights = state.insights.filter(i => {
    if (i.expiresAt && new Date(i.expiresAt) < now) return false;
    const ageMs = now.getTime() - new Date(i.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000 && i.priority === 'low') return false;
    if (ageMs > 48 * 60 * 60 * 1000 && i.priority === 'medium') return false;
    return true;
  });
  saveInsights(state.insights);
}

// ═══ PUBLIC API ═════════════════════════════════════════════

export const ProactiveAgent = {
  start(): void {
    if (state.isRunning) return;

    state.insights = loadInsights();
    state.isRunning = true;

    console.log('[Proactive] Background awareness agent started');

    // Initial scan after a short delay
    setTimeout(() => runScan(), 5000);

    state.intervalId = setInterval(() => runScan(), SCAN_INTERVAL_MS);
  },

  stop(): void {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.isRunning = false;
    console.log('[Proactive] Background awareness agent stopped');
  },

  isRunning(): boolean {
    return state.isRunning;
  },

  onInsight(handler: InsightHandler): () => void {
    state.handlers.add(handler);
    return () => { state.handlers.delete(handler); };
  },

  getInsights(filter?: { category?: InsightCategory; priority?: InsightPriority; active?: boolean }): ProactiveInsight[] {
    let results = [...state.insights];

    if (filter?.category) results = results.filter(i => i.category === filter.category);
    if (filter?.priority) results = results.filter(i => i.priority === filter.priority);
    if (filter?.active) results = results.filter(i => !i.dismissed && !i.actionTaken);

    return results.sort((a, b) => {
      const priorityOrder: Record<InsightPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  dismissInsight(insightId: string): void {
    const insight = state.insights.find(i => i.id === insightId);
    if (insight) {
      insight.dismissed = true;
      saveInsights(state.insights);
    }
  },

  markActionTaken(insightId: string): void {
    const insight = state.insights.find(i => i.id === insightId);
    if (insight) {
      insight.actionTaken = true;
      saveInsights(state.insights);
    }
  },

  triggerScan(): void {
    runScan();
  },

  getStatus(): {
    running: boolean;
    lastScan: Date | null;
    scanCount: number;
    activeInsights: number;
    totalInsights: number;
  } {
    return {
      running: state.isRunning,
      lastScan: state.lastScanAt,
      scanCount: state.scanCount,
      activeInsights: state.insights.filter(i => !i.dismissed && !i.actionTaken).length,
      totalInsights: state.insights.length,
    };
  },
};
