import { AutomationGmailAPI, isBackendAvailable, checkAutomationBackend } from './automationApi';
import { ExecutionEngine } from './executionEngine';
import type { DeployedAgent } from './types';
import type { ExecutionLog } from './executionEngine';

const POLL_INTERVAL_MS = 60_000; // Check every 60 seconds
const DEMO_USER_ID = 'demo-user-123';

interface SchedulerState {
  intervalId: ReturnType<typeof setInterval> | null;
  lastSeenEmailIds: Set<string>;
  isRunning: boolean;
  lastPollAt: Date | null;
  lastError: string | null;
  totalTriggered: number;
}

type AgentExecutionCallback = (
  agentId: string,
  result: { success: boolean; logs: ExecutionLog[]; output?: any; error?: string },
  triggerData: any
) => void;

type AgentGetter = () => DeployedAgent[];

const schedulerState: SchedulerState = {
  intervalId: null,
  lastSeenEmailIds: new Set(),
  isRunning: false,
  lastPollAt: null,
  lastError: null,
  totalTriggered: 0,
};

let _getAgents: AgentGetter = () => [];
let _onExecution: AgentExecutionCallback = () => {};
let _initialSeedDone = false;

function getEmailTriggerAgents(): DeployedAgent[] {
  return _getAgents().filter(agent => {
    if (agent.status !== 'active') return false;
    const triggerNode = agent.workflow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) return false;
    const cfg = triggerNode.config as any;
    return cfg?.triggerType === 'email';
  });
}

async function pollForNewEmails(): Promise<void> {
  if (!isBackendAvailable()) {
    await checkAutomationBackend();
    if (!isBackendAvailable()) {
      schedulerState.lastError = 'Backend offline';
      return;
    }
  }

  const emailAgents = getEmailTriggerAgents();
  if (emailAgents.length === 0) return;

  try {
    const result = await AutomationGmailAPI.read(20);
    if (!result || !result.emails) {
      schedulerState.lastError = 'Failed to read emails';
      return;
    }

    schedulerState.lastPollAt = new Date();
    schedulerState.lastError = null;

    const currentIds = new Set(result.emails.map(e => e.id));

    if (!_initialSeedDone) {
      schedulerState.lastSeenEmailIds = currentIds;
      _initialSeedDone = true;
      console.log(`📬 Scheduler: Seeded with ${currentIds.size} existing emails — will trigger on NEW emails only`);

      const stored = localStorage.getItem('scheduler_seen_emails');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as string[];
          parsed.forEach(id => schedulerState.lastSeenEmailIds.add(id));
        } catch { /* ignore */ }
      }
      persistSeenEmails();
      return;
    }

    const newEmails = result.emails.filter(e => !schedulerState.lastSeenEmailIds.has(e.id));

    if (newEmails.length === 0) return;

    console.log(`📬 Scheduler: ${newEmails.length} new email(s) detected!`);

    newEmails.forEach(e => schedulerState.lastSeenEmailIds.add(e.id));
    persistSeenEmails();

    for (const agent of emailAgents) {
      const triggerNode = agent.workflow.nodes.find(n => n.type === 'trigger');
      const triggerCfg = triggerNode?.config as any;
      const emailFilter = triggerCfg?.emailFilter;

      const matchingEmails = newEmails.filter(email => {
        if (emailFilter?.from && !email.fromEmail?.toLowerCase().includes(emailFilter.from.toLowerCase())) return false;
        if (emailFilter?.subject && !email.subject?.toLowerCase().includes(emailFilter.subject.toLowerCase())) return false;
        return true;
      });

      if (matchingEmails.length === 0) continue;

      console.log(`🤖 Scheduler: Triggering "${agent.name}" with ${matchingEmails.length} matching email(s)`);

      for (const email of matchingEmails) {
        schedulerState.totalTriggered++;
        try {
          const execResult = await ExecutionEngine.executeWorkflow(
            agent.id,
            DEMO_USER_ID,
            agent.workflow,
            'event',
            {
              emails: [email],
              email,
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              body: email.fullMessage || email.preview,
              receivedAt: email.receivedAt,
              messageId: email.id,
            },
          );

          _onExecution(agent.id, execResult, email);
        } catch (err: any) {
          console.error(`❌ Scheduler: Failed to run "${agent.name}":`, err.message);
          _onExecution(agent.id, { success: false, logs: [], error: err.message }, email);
        }
      }
    }
  } catch (err: any) {
    schedulerState.lastError = err.message;
    console.error('❌ Scheduler poll error:', err.message);
  }
}

function persistSeenEmails(): void {
  try {
    const arr = Array.from(schedulerState.lastSeenEmailIds).slice(-200);
    localStorage.setItem('scheduler_seen_emails', JSON.stringify(arr));
  } catch { /* ignore */ }
}

export const WorkflowScheduler = {
  start(getAgents: AgentGetter, onExecution: AgentExecutionCallback): void {
    if (schedulerState.isRunning) return;

    _getAgents = getAgents;
    _onExecution = onExecution;
    _initialSeedDone = false;

    console.log('⏰ Workflow Scheduler started — polling every', POLL_INTERVAL_MS / 1000, 'seconds');

    pollForNewEmails();

    schedulerState.intervalId = setInterval(pollForNewEmails, POLL_INTERVAL_MS);
    schedulerState.isRunning = true;
  },

  stop(): void {
    if (schedulerState.intervalId) {
      clearInterval(schedulerState.intervalId);
      schedulerState.intervalId = null;
    }
    schedulerState.isRunning = false;
    console.log('⏰ Workflow Scheduler stopped');
  },

  isRunning(): boolean {
    return schedulerState.isRunning;
  },

  getStatus(): {
    running: boolean;
    lastPoll: Date | null;
    lastError: string | null;
    totalTriggered: number;
    trackedEmails: number;
    activeEmailAgents: number;
  } {
    return {
      running: schedulerState.isRunning,
      lastPoll: schedulerState.lastPollAt,
      lastError: schedulerState.lastError,
      totalTriggered: schedulerState.totalTriggered,
      trackedEmails: schedulerState.lastSeenEmailIds.size,
      activeEmailAgents: getEmailTriggerAgents().length,
    };
  },

  triggerNow(): void {
    pollForNewEmails();
  },
};
