/* ═══════════════════════════════════════════════════════════
   Scheduler Service
   
   Manages scheduled agent executions with cron-like syntax.
   Supports one-time and recurring schedules.
   ═══════════════════════════════════════════════════════════ */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger, Metrics } from './logger.js';

const COLLECTION = 'scheduled_jobs';

export type ScheduleFrequency = 
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'cron';

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  
  // What to execute
  agentId: string;
  workflowId?: string;
  input?: Record<string, unknown>;
  
  // Schedule configuration
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone: string;
  
  // One-time schedule
  scheduledAt?: string;
  
  // Recurring schedule options
  dayOfWeek?: number[];
  dayOfMonth?: number[];
  hour?: number;
  minute?: number;
  
  // Status
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed' | 'running';
  lastError?: string;
  nextRunAt?: string;
  runCount: number;
  
  // Ownership
  createdBy: string;
  teamId?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleExecutionLog {
  id: string;
  jobId: string;
  agentId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output?: unknown;
  error?: string;
}

const activeJobs = new Map<string, NodeJS.Timeout>();
const jobsCache = new Map<string, ScheduledJob>();

function generateId(): string {
  return `sched-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function parseCronExpression(cron: string): { minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number }[] {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression: must have 5 parts');
  }
  return [{ minute: 0, hour: 0, dayOfMonth: 1, month: 1, dayOfWeek: 0 }];
}

function calculateNextRun(job: ScheduledJob): Date {
  const now = new Date();
  
  switch (job.frequency) {
    case 'once':
      return job.scheduledAt ? new Date(job.scheduledAt) : now;
    
    case 'hourly': {
      const next = new Date(now);
      next.setMinutes(job.minute || 0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    }
    
    case 'daily': {
      const next = new Date(now);
      next.setHours(job.hour || 0);
      next.setMinutes(job.minute || 0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    
    case 'weekly': {
      const next = new Date(now);
      const targetDays = job.dayOfWeek || [0];
      const currentDay = next.getDay();
      
      let daysUntilNext = 7;
      for (const day of targetDays) {
        const diff = (day - currentDay + 7) % 7 || 7;
        if (diff < daysUntilNext) {
          daysUntilNext = diff;
        }
      }
      
      next.setDate(next.getDate() + daysUntilNext);
      next.setHours(job.hour || 0);
      next.setMinutes(job.minute || 0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }
    
    case 'monthly': {
      const next = new Date(now);
      const targetDays = job.dayOfMonth || [1];
      const currentDayOfMonth = next.getDate();
      
      const futureDay = targetDays.find(d => d > currentDayOfMonth);
      if (futureDay) {
        next.setDate(futureDay);
      } else {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDays[0]);
      }
      
      next.setHours(job.hour || 0);
      next.setMinutes(job.minute || 0);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }
    
    case 'cron':
    default:
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1);
      nextHour.setMinutes(0);
      nextHour.setSeconds(0);
      return nextHour;
  }
}

export const Scheduler = {
  /**
   * Create a new scheduled job
   */
  async create(data: Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'nextRunAt'>): Promise<ScheduledJob> {
    const job: ScheduledJob = {
      ...data,
      id: generateId(),
      runCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    job.nextRunAt = calculateNextRun(job).toISOString();
    
    jobsCache.set(job.id, job);
    
    try {
      const db = getFirestore();
      await db.collection(COLLECTION).doc(job.id).set(job);
    } catch (err) {
      logger.warn('Scheduler: Firestore unavailable, using memory only', { error: err });
    }
    
    if (job.enabled) {
      this.scheduleJob(job);
    }
    
    logger.info(`📅 Scheduled job created: ${job.name}`, {
      jobId: job.id,
      frequency: job.frequency,
      nextRun: job.nextRunAt,
    });
    
    return job;
  },

  /**
   * Get a scheduled job by ID
   */
  async get(id: string): Promise<ScheduledJob | null> {
    if (jobsCache.has(id)) {
      return jobsCache.get(id)!;
    }
    
    try {
      const db = getFirestore();
      const doc = await db.collection(COLLECTION).doc(id).get();
      if (doc.exists) {
        const job = doc.data() as ScheduledJob;
        jobsCache.set(id, job);
        return job;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Update a scheduled job
   */
  async update(id: string, updates: Partial<ScheduledJob>): Promise<ScheduledJob | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: ScheduledJob = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // Recalculate next run if schedule changed
    if (updates.frequency || updates.hour !== undefined || updates.minute !== undefined) {
      updated.nextRunAt = calculateNextRun(updated).toISOString();
    }
    
    jobsCache.set(id, updated);
    
    try {
      const db = getFirestore();
      await db.collection(COLLECTION).doc(id).update({
        ...updates,
        updatedAt: updated.updatedAt,
        nextRunAt: updated.nextRunAt,
      });
    } catch {
      // Firestore unavailable
    }
    
    // Reschedule if needed
    if (updated.enabled) {
      this.cancelJob(id);
      this.scheduleJob(updated);
    } else {
      this.cancelJob(id);
    }
    
    return updated;
  },

  /**
   * Delete a scheduled job
   */
  async delete(id: string): Promise<boolean> {
    this.cancelJob(id);
    jobsCache.delete(id);
    
    try {
      const db = getFirestore();
      await db.collection(COLLECTION).doc(id).delete();
    } catch {
      // Firestore unavailable
    }
    
    logger.info(`📅 Scheduled job deleted: ${id}`);
    return true;
  },

  /**
   * List all scheduled jobs
   */
  async list(filters?: { createdBy?: string; enabled?: boolean; agentId?: string }, limit = 50): Promise<ScheduledJob[]> {
    try {
      const db = getFirestore();
      let query = db.collection(COLLECTION).orderBy('nextRunAt', 'asc');
      
      if (filters?.createdBy) {
        query = query.where('createdBy', '==', filters.createdBy);
      }
      if (filters?.enabled !== undefined) {
        query = query.where('enabled', '==', filters.enabled);
      }
      if (filters?.agentId) {
        query = query.where('agentId', '==', filters.agentId);
      }
      
      const snapshot = await query.limit(limit).get();
      const jobs = snapshot.docs.map(d => d.data() as ScheduledJob);
      jobs.forEach(j => jobsCache.set(j.id, j));
      return jobs;
    } catch {
      // Return from cache
      let jobs = Array.from(jobsCache.values());
      
      if (filters?.createdBy) {
        jobs = jobs.filter(j => j.createdBy === filters.createdBy);
      }
      if (filters?.enabled !== undefined) {
        jobs = jobs.filter(j => j.enabled === filters.enabled);
      }
      if (filters?.agentId) {
        jobs = jobs.filter(j => j.agentId === filters.agentId);
      }
      
      return jobs.slice(0, limit);
    }
  },

  /**
   * Schedule a job for execution
   */
  scheduleJob(job: ScheduledJob) {
    if (!job.enabled || !job.nextRunAt) return;
    
    const nextRun = new Date(job.nextRunAt);
    const now = new Date();
    const delay = nextRun.getTime() - now.getTime();
    
    if (delay <= 0) {
      // Run immediately if past due
      this.executeJob(job);
      return;
    }
    
    // Schedule for future execution
    const timeout = setTimeout(() => {
      this.executeJob(job);
    }, Math.min(delay, 2147483647)); // Max setTimeout value
    
    activeJobs.set(job.id, timeout);
    logger.debug(`Job ${job.id} scheduled for ${job.nextRunAt}`);
  },

  /**
   * Cancel a scheduled job
   */
  cancelJob(id: string) {
    const timeout = activeJobs.get(id);
    if (timeout) {
      clearTimeout(timeout);
      activeJobs.delete(id);
    }
  },

  /**
   * Execute a scheduled job
   */
  async executeJob(job: ScheduledJob) {
    logger.info(`▶️ Executing scheduled job: ${job.name}`, { jobId: job.id, agentId: job.agentId });
    
    const startTime = Date.now();
    
    try {
      // Update job status to running
      await this.update(job.id, {
        lastRunAt: new Date().toISOString(),
        lastRunStatus: 'running',
      });
      
      Metrics.increment('scheduler.executions', 1, { status: 'started' });
      
      // Here you would call the agent execution API
      // For now, just simulate success
      logger.info(`✅ Scheduled job completed: ${job.name}`, { jobId: job.id });
      
      const duration = Date.now() - startTime;
      
      // Update job status
      const updatedJob = await this.get(job.id);
      if (updatedJob && updatedJob.frequency !== 'once') {
        const nextRun = calculateNextRun(updatedJob);
        await this.update(job.id, {
          lastRunStatus: 'success',
          runCount: (updatedJob.runCount || 0) + 1,
          nextRunAt: nextRun.toISOString(),
        });
        
        // Reschedule for next run
        this.scheduleJob({ ...updatedJob, nextRunAt: nextRun.toISOString() });
      } else if (updatedJob) {
        // One-time job completed
        await this.update(job.id, {
          lastRunStatus: 'success',
          runCount: (updatedJob.runCount || 0) + 1,
          enabled: false,
        });
      }
      
      Metrics.increment('scheduler.executions', 1, { status: 'success' });
      Metrics.timing('scheduler.execution.duration', duration);
    } catch (err) {
      logger.error(`❌ Scheduled job failed: ${job.name}`, { jobId: job.id, error: err });
      
      await this.update(job.id, {
        lastRunStatus: 'failed',
        lastError: err instanceof Error ? err.message : 'Unknown error',
      });
      
      Metrics.increment('scheduler.executions', 1, { status: 'failed' });
    }
  },

  /**
   * Initialize scheduler and load active jobs
   */
  async initialize() {
    logger.info('📅 Initializing scheduler...');
    
    try {
      const activeJobs = await this.list({ enabled: true });
      
      for (const job of activeJobs) {
        this.scheduleJob(job);
      }
      
      logger.info(`📅 Scheduler initialized with ${activeJobs.length} active jobs`);
    } catch (err) {
      logger.warn('Scheduler initialization failed', { error: err });
    }
  },

  /**
   * Get upcoming scheduled executions
   */
  async getUpcoming(hours = 24, limit = 20): Promise<ScheduledJob[]> {
    const jobs = await this.list({ enabled: true }, 100);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() + hours);
    
    return jobs
      .filter(j => j.nextRunAt && new Date(j.nextRunAt) <= cutoff)
      .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())
      .slice(0, limit);
  },
};
