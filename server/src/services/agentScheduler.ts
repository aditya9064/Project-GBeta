/* ═══════════════════════════════════════════════════════════
   Server-Side Agent Scheduler

   Runs as a Firebase scheduled function (every minute) to:
   1. Poll for new emails and trigger email-based agents
   2. Execute cron/schedule-based agents
   3. Track seen emails in Firestore to avoid duplicates

   This replaces the browser-based scheduler entirely.
   ═══════════════════════════════════════════════════════════ */

import { getFirestore } from 'firebase-admin/firestore';
import { GmailService } from './gmail.service.js';
import { SlackService } from './slack.service.js';
import { AgentStore, type StoredAgent } from './agentStore.js';
import { AgentExecutor } from './agentExecutor.js';
import { logger } from './logger.js';

const SCHEDULER_STATE_DOC = 'scheduler_state/email_polling';
const MAX_SEEN_IDS = 500;

interface SchedulerState {
  lastSeenEmailIds: string[];
  lastPollAt: string;
  initialized: boolean;
}

async function getSchedulerState(): Promise<SchedulerState> {
  const db = getFirestore();
  const doc = await db.doc(SCHEDULER_STATE_DOC).get();
  if (doc.exists) return doc.data() as SchedulerState;
  return { lastSeenEmailIds: [], lastPollAt: '', initialized: false };
}

async function saveSchedulerState(state: SchedulerState): Promise<void> {
  const db = getFirestore();
  await db.doc(SCHEDULER_STATE_DOC).set(state);
}

function getEmailAgents(agents: StoredAgent[]): StoredAgent[] {
  return agents.filter(a => {
    if (a.status !== 'active') return false;
    const triggerNode = a.workflow?.nodes?.find((n: any) => n.type === 'trigger');
    if (!triggerNode) return false;
    const cfg = triggerNode.config as any;
    // Check for various email trigger configurations:
    // - triggerType: 'email' (standard)
    // - triggerType: 'gmail' (n8n import)
    // - appType: 'gmail' (app node as trigger)
    const isEmailTrigger = 
      cfg?.triggerType === 'email' ||
      cfg?.triggerType === 'gmail' ||
      cfg?.appType === 'gmail' ||
      a.triggerType === 'email' ||
      a.triggerType === 'gmail';
    return isEmailTrigger;
  });
}

function getScheduledAgents(agents: StoredAgent[]): StoredAgent[] {
  return agents.filter(a => {
    if (a.status !== 'active') return false;
    return a.triggerType === 'schedule';
  });
}

function shouldRunSchedule(agent: StoredAgent): boolean {
  const triggerNode = agent.workflow?.nodes?.find((n: any) => n.type === 'trigger');
  const schedule = triggerNode?.config?.schedule || agent.triggerConfig?.schedule;
  if (!schedule) return false;

  const now = new Date();
  const lastRun = agent.lastExecutedAt ? new Date(agent.lastExecutedAt) : null;

  switch (schedule.frequency) {
    case 'minutely':
      return !lastRun || (now.getTime() - lastRun.getTime()) >= 60_000;
    case 'hourly':
      return !lastRun || (now.getTime() - lastRun.getTime()) >= 3600_000;
    case 'daily': {
      if (!lastRun) return true;
      const lastDay = lastRun.toDateString();
      const today = now.toDateString();
      return lastDay !== today;
    }
    case 'weekly':
      return !lastRun || (now.getTime() - lastRun.getTime()) >= 7 * 86400_000;
    default:
      return !lastRun || (now.getTime() - lastRun.getTime()) >= 3600_000;
  }
}

export async function runScheduledTick(): Promise<{
  emailsChecked: number;
  newEmails: number;
  agentsTriggered: number;
  scheduledRuns: number;
  errors: string[];
}> {
  const result = {
    emailsChecked: 0,
    newEmails: 0,
    agentsTriggered: 0,
    scheduledRuns: 0,
    errors: [] as string[],
  };

  try {
    // Restore service connections
    await Promise.all([
      GmailService.restoreFromStore(),
      SlackService.restoreFromStore(),
    ]);

    const allAgents = await AgentStore.getActive();
    if (allAgents.length === 0) {
      logger.info('Scheduler: No active agents');
      return result;
    }

    logger.info(`Scheduler tick: ${allAgents.length} active agent(s)`);

    // ── 1. Email-triggered agents ──

    const emailAgents = getEmailAgents(allAgents);
    if (emailAgents.length > 0) {
      const gmailConn = GmailService.getConnection();
      if (gmailConn.status === 'connected') {
        await processEmailTriggers(emailAgents, result);
      } else {
        logger.info('Scheduler: Gmail not connected, skipping email triggers');
        result.errors.push('Gmail not connected');
      }
    }

    // ── 2. Schedule-triggered agents ──

    const scheduledAgents = getScheduledAgents(allAgents);
    for (const agent of scheduledAgents) {
      if (shouldRunSchedule(agent)) {
        try {
          logger.info(`Scheduler: Running scheduled agent "${agent.name}"`);
          await AgentExecutor.execute(agent, 'schedule', {
            scheduledAt: new Date().toISOString(),
          });
          result.scheduledRuns++;
        } catch (err: any) {
          logger.error(`Scheduler: Failed to run "${agent.name}"`, { error: err.message });
          result.errors.push(`${agent.name}: ${err.message}`);
        }
      }
    }

  } catch (err: any) {
    logger.error('Scheduler tick error', { error: err.message });
    result.errors.push(err.message);
  }

  return result;
}

async function processEmailTriggers(
  emailAgents: StoredAgent[],
  result: { emailsChecked: number; newEmails: number; agentsTriggered: number; errors: string[] },
): Promise<void> {
  try {
    const messages = await GmailService.fetchMessages(20);
    result.emailsChecked = messages.length;

    const state = await getSchedulerState();
    const seenIds = new Set(state.lastSeenEmailIds);

    if (!state.initialized) {
      // First run: seed with current email IDs so we only trigger on NEW emails
      const currentIds = messages.map(m => m.externalId);
      await saveSchedulerState({
        lastSeenEmailIds: currentIds.slice(-MAX_SEEN_IDS),
        lastPollAt: new Date().toISOString(),
        initialized: true,
      });
      logger.info(`Scheduler: Seeded with ${currentIds.length} existing emails`);
      return;
    }

    const newEmails = messages.filter(m => !seenIds.has(m.externalId));
    result.newEmails = newEmails.length;

    if (newEmails.length === 0) {
      await saveSchedulerState({
        ...state,
        lastPollAt: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Scheduler: ${newEmails.length} new email(s) detected`);

    // Update seen IDs
    const allSeenIds = [...state.lastSeenEmailIds, ...newEmails.map(m => m.externalId)].slice(-MAX_SEEN_IDS);
    await saveSchedulerState({
      lastSeenEmailIds: allSeenIds,
      lastPollAt: new Date().toISOString(),
      initialized: true,
    });

    // Trigger matching agents
    for (const agent of emailAgents) {
      const triggerNode = agent.workflow?.nodes?.find((n: any) => n.type === 'trigger');
      const emailFilter = triggerNode?.config?.emailFilter;

      const matchingEmails = newEmails.filter(email => {
        if (emailFilter?.from && !email.fromEmail?.toLowerCase().includes(emailFilter.from.toLowerCase())) return false;
        if (emailFilter?.subject && !email.subject?.toLowerCase().includes(emailFilter.subject.toLowerCase())) return false;
        return true;
      });

      if (matchingEmails.length === 0) continue;

      logger.info(`Scheduler: Triggering "${agent.name}" with ${matchingEmails.length} email(s)`);

      for (const email of matchingEmails) {
        try {
          await AgentExecutor.execute(agent, 'email', {
            email: {
              id: email.externalId,
              from: email.from,
              fromEmail: email.fromEmail,
              subject: email.subject,
              body: email.fullMessage || email.preview,
              preview: email.preview,
              receivedAt: email.receivedAt,
            },
            from: email.from,
            fromEmail: email.fromEmail,
            subject: email.subject,
            body: email.fullMessage || email.preview,
            messageId: email.externalId,
            receivedAt: email.receivedAt,
          });
          result.agentsTriggered++;
        } catch (err: any) {
          logger.error(`Scheduler: Agent "${agent.name}" failed`, { error: err.message });
          result.errors.push(`${agent.name}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    logger.error('Scheduler email poll error', { error: err.message });
    result.errors.push(`Email poll: ${err.message}`);
  }
}
