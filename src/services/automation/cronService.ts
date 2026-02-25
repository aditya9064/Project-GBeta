import type { CronSchedule } from './types';

const STORAGE_KEY = 'operon_cron_schedules';

function loadAll(): CronSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((s: any) => ({
      ...s,
      lastRunAt: s.lastRunAt ? new Date(s.lastRunAt) : undefined,
      nextRunAt: s.nextRunAt ? new Date(s.nextRunAt) : undefined,
      createdAt: new Date(s.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveAll(schedules: CronSchedule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const values: number[] = [];
  const parts = field.split(',');

  for (const part of parts) {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const stepNum = parseInt(step);
      let start = min;
      let end = max;
      if (range !== '*') {
        if (range.includes('-')) {
          [start, end] = range.split('-').map(Number);
        } else {
          start = parseInt(range);
        }
      }
      for (let i = start; i <= end; i += stepNum) values.push(i);
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) values.push(i);
    } else {
      values.push(parseInt(part));
    }
  }

  return values.filter(v => v >= min && v <= max);
}

export function getNextCronRun(expression: string, after: Date = new Date(), timezone?: string): Date | null {
  try {
    const parts = expression.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const [minStr, hourStr, domStr, monStr, dowStr] = parts;

    const minutes = parseCronField(minStr, 0, 59);
    const hours = parseCronField(hourStr, 0, 23);
    const daysOfMonth = parseCronField(domStr, 1, 31);
    const months = parseCronField(monStr, 1, 12);
    const daysOfWeek = parseCronField(dowStr, 0, 6);

    const candidate = new Date(after.getTime() + 60000);
    candidate.setSeconds(0, 0);

    for (let i = 0; i < 525600; i++) {
      const min = candidate.getMinutes();
      const hour = candidate.getHours();
      const dom = candidate.getDate();
      const mon = candidate.getMonth() + 1;
      const dow = candidate.getDay();

      if (
        minutes.includes(min) &&
        hours.includes(hour) &&
        daysOfMonth.includes(dom) &&
        months.includes(mon) &&
        daysOfWeek.includes(dow)
      ) {
        return candidate;
      }

      candidate.setMinutes(candidate.getMinutes() + 1);
    }

    return null;
  } catch {
    return null;
  }
}

export function shouldRunNow(expression: string, lastRunAt?: Date): boolean {
  const now = new Date();
  const next = getNextCronRun(expression, lastRunAt || new Date(now.getTime() - 120000));
  if (!next) return false;
  return next.getTime() <= now.getTime();
}

export function cronToHuman(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return expression;

  const [min, hour, dom, mon, dow] = parts;

  if (min === '0' && hour !== '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Daily at ${hour.padStart(2, '0')}:00`;
  }
  if (min !== '*' && hour !== '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  }
  if (dom === '*' && mon === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNames = parseCronField(dow, 0, 6).map(d => days[d]).join(', ');
    return `Every ${dayNames} at ${hour === '*' ? 'every hour' : `${hour.padStart(2, '0')}:${min === '*' ? '00' : min.padStart(2, '0')}`}`;
  }
  if (min.includes('/')) {
    const step = min.split('/')[1];
    return `Every ${step} minutes`;
  }
  if (hour.includes('/')) {
    const step = hour.split('/')[1];
    return `Every ${step} hours`;
  }
  return expression;
}

export function frequencyToCron(frequency: string, time?: string, dayOfWeek?: number, dayOfMonth?: number): string {
  const [h, m] = (time || '09:00').split(':').map(Number);

  switch (frequency) {
    case 'minutely': return '* * * * *';
    case 'hourly': return '0 * * * *';
    case 'daily': return `${m || 0} ${h || 9} * * *`;
    case 'weekly': return `${m || 0} ${h || 9} * * ${dayOfWeek ?? 1}`;
    case 'monthly': return `${m || 0} ${h || 9} ${dayOfMonth ?? 1} * *`;
    default: return frequency;
  }
}

type ScheduleCallback = (schedule: CronSchedule) => void;
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _callback: ScheduleCallback | null = null;

export const CronService = {
  register(agentId: string, expression: string, timezone = 'UTC'): CronSchedule {
    const all = loadAll();
    const existing = all.find(s => s.agentId === agentId);
    if (existing) {
      existing.expression = expression;
      existing.timezone = timezone;
      existing.enabled = true;
      existing.nextRunAt = getNextCronRun(expression) || undefined;
      saveAll(all);
      return existing;
    }

    const schedule: CronSchedule = {
      id: `cron-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      expression,
      timezone,
      enabled: true,
      nextRunAt: getNextCronRun(expression) || undefined,
      createdAt: new Date(),
    };

    all.push(schedule);
    saveAll(all);
    return schedule;
  },

  getByAgent(agentId: string): CronSchedule | null {
    return loadAll().find(s => s.agentId === agentId) || null;
  },

  getAll(): CronSchedule[] {
    return loadAll();
  },

  enable(agentId: string): void {
    const all = loadAll();
    const s = all.find(s => s.agentId === agentId);
    if (s) {
      s.enabled = true;
      s.nextRunAt = getNextCronRun(s.expression) || undefined;
      saveAll(all);
    }
  },

  disable(agentId: string): void {
    const all = loadAll();
    const s = all.find(s => s.agentId === agentId);
    if (s) {
      s.enabled = false;
      saveAll(all);
    }
  },

  markRun(agentId: string): void {
    const all = loadAll();
    const s = all.find(s => s.agentId === agentId);
    if (s) {
      s.lastRunAt = new Date();
      s.nextRunAt = getNextCronRun(s.expression) || undefined;
      saveAll(all);
    }
  },

  delete(agentId: string): void {
    const all = loadAll();
    saveAll(all.filter(s => s.agentId !== agentId));
  },

  getDueSchedules(): CronSchedule[] {
    const now = new Date();
    return loadAll().filter(s => {
      if (!s.enabled) return false;
      return shouldRunNow(s.expression, s.lastRunAt);
    });
  },

  startPolling(callback: ScheduleCallback, intervalMs = 30000): void {
    if (_intervalId) return;
    _callback = callback;

    const poll = () => {
      const due = this.getDueSchedules();
      for (const schedule of due) {
        this.markRun(schedule.agentId);
        _callback?.(schedule);
      }
    };

    poll();
    _intervalId = setInterval(poll, intervalMs);
  },

  stopPolling(): void {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    _callback = null;
  },
};
