import { log } from '../../utils/logger';

export interface ScheduleConfig {
  frequency: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  intervalMinutes?: number;
  cronExpression?: string;
}

export interface ScheduleInfo {
  agentId: string;
  schedule: ScheduleConfig;
  nextRun: Date;
  lastRun: Date | null;
  runCount: number;
}

interface StoredSchedule {
  agentId: string;
  schedule: ScheduleConfig;
  nextRun: string;
  lastRun: string | null;
  runCount: number;
}

interface ActiveEntry {
  info: ScheduleInfo;
  timerId: ReturnType<typeof setTimeout>;
  onTrigger: (agentId: string) => void;
}

const STORAGE_KEY = 'crewos_schedules';

function loadStored(): StoredSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStored(entries: Map<string, ActiveEntry>): void {
  const data: StoredSchedule[] = [];
  for (const [, entry] of entries) {
    data.push({
      agentId: entry.info.agentId,
      schedule: entry.info.schedule,
      nextRun: entry.info.nextRun.toISOString(),
      lastRun: entry.info.lastRun?.toISOString() ?? null,
      runCount: entry.info.runCount,
    });
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

function getIntervalMs(config: ScheduleConfig): number {
  switch (config.frequency) {
    case 'minutely':
      return (config.intervalMinutes ?? 1) * 60_000;
    case 'hourly':
      return 3_600_000;
    case 'daily':
      return 86_400_000;
    case 'weekly':
      return 604_800_000;
    case 'monthly':
      return 30 * 86_400_000;
    case 'cron':
      return 60_000;
  }
}

function computeNextRun(config: ScheduleConfig, after: Date = new Date()): Date {
  const now = after.getTime();
  const tz = config.timezone;

  if (config.frequency === 'cron' && config.cronExpression) {
    const next = computeNextCronRun(config.cronExpression, after);
    return tz ? applyTimezone(next, tz) : next;
  }

  if (config.frequency === 'minutely') {
    return new Date(now + (config.intervalMinutes ?? 1) * 60_000);
  }

  if (config.frequency === 'hourly') {
    const next = new Date(after);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return tz ? applyTimezone(next, tz) : next;
  }

  const [hours, minutes] = parseTime(config.time);

  if (config.frequency === 'daily') {
    let next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
    if (tz) next = applyTimezone(next, tz);
    if (next.getTime() <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (config.frequency === 'weekly') {
    const targetDay = config.dayOfWeek ?? 0;
    let next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
    if (tz) next = applyTimezone(next, tz);
    const currentDay = next.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next.getTime() <= now)) {
      daysUntil += 7;
    }
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  if (config.frequency === 'monthly') {
    const targetDate = Math.min(config.dayOfMonth ?? 1, 28);
    let next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
    if (tz) next = applyTimezone(next, tz);
    next.setDate(targetDate);
    if (next.getTime() <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDate);
    }
    return next;
  }

  return new Date(now + 60_000);
}

function parseTime(time?: string): [number, number] {
  if (!time) return [0, 0];
  const parts = time.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return [isNaN(h) ? 0 : h, isNaN(m) ? 0 : m];
}

function getTimezoneOffset(timezone?: string): number {
  if (!timezone) return 0;
  try {
    const now = new Date();
    const localOffset = now.getTimezoneOffset();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const localHour = now.getHours();
    const localMinute = now.getMinutes();
    const tzTotalMinutes = tzHour * 60 + tzMinute;
    const localTotalMinutes = localHour * 60 + localMinute;
    return (tzTotalMinutes - localTotalMinutes + localOffset) * 60_000;
  } catch {
    return 0;
  }
}

function applyTimezone(date: Date, timezone?: string): Date {
  const offset = getTimezoneOffset(timezone);
  return new Date(date.getTime() + offset);
}

function parseCronExpression(cron: string): { minute: number[]; hour: number[]; dayOfMonth: number[]; month: number[]; dayOfWeek: number[] } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const parseField = (field: string, min: number, max: number): number[] => {
    const values: number[] = [];
    
    if (field === '*') {
      for (let i = min; i <= max; i++) values.push(i);
      return values;
    }
    
    const segments = field.split(',');
    for (const segment of segments) {
      if (segment.includes('/')) {
        const [range, stepStr] = segment.split('/');
        const step = parseInt(stepStr, 10);
        let start = min;
        let end = max;
        if (range !== '*') {
          if (range.includes('-')) {
            const [s, e] = range.split('-').map(n => parseInt(n, 10));
            start = s;
            end = e;
          } else {
            start = parseInt(range, 10);
          }
        }
        for (let i = start; i <= end; i += step) values.push(i);
      } else if (segment.includes('-')) {
        const [s, e] = segment.split('-').map(n => parseInt(n, 10));
        for (let i = s; i <= e; i++) values.push(i);
      } else {
        values.push(parseInt(segment, 10));
      }
    }
    
    return values.filter(v => v >= min && v <= max);
  };

  try {
    return {
      minute: parseField(parts[0], 0, 59),
      hour: parseField(parts[1], 0, 23),
      dayOfMonth: parseField(parts[2], 1, 31),
      month: parseField(parts[3], 1, 12),
      dayOfWeek: parseField(parts[4], 0, 6),
    };
  } catch {
    return null;
  }
}

function computeNextCronRun(cron: string, after: Date = new Date()): Date {
  const parsed = parseCronExpression(cron);
  if (!parsed) {
    log.warn(`[Scheduler] Invalid cron expression: ${cron}`);
    return new Date(after.getTime() + 60_000);
  }

  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let iterations = 0; iterations < 525600; iterations++) {
    const month = candidate.getMonth() + 1;
    const dayOfMonth = candidate.getDate();
    const dayOfWeek = candidate.getDay();
    const hour = candidate.getHours();
    const minute = candidate.getMinutes();

    if (!parsed.month.includes(month)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    const dayOfMonthMatches = parsed.dayOfMonth.includes(dayOfMonth);
    const dayOfWeekMatches = parsed.dayOfWeek.includes(dayOfWeek);
    
    if (!dayOfMonthMatches && !dayOfWeekMatches) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }

    if (!parsed.hour.includes(hour)) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }

    if (!parsed.minute.includes(minute)) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }

    return candidate;
  }

  return new Date(after.getTime() + 60_000);
}

const active = new Map<string, ActiveEntry>();

function scheduleTimer(entry: ActiveEntry): void {
  const delay = Math.max(entry.info.nextRun.getTime() - Date.now(), 0);
  entry.timerId = setTimeout(() => fire(entry.info.agentId), delay);
}

function fire(agentId: string): void {
  const entry = active.get(agentId);
  if (!entry) return;

  entry.info.lastRun = new Date();
  entry.info.runCount++;
  entry.info.nextRun = computeNextRun(entry.info.schedule);

  saveStored(active);
  scheduleTimer(entry);

  try {
    entry.onTrigger(agentId);
  } catch {
    // callback errors shouldn't break the scheduler
  }
}

export const AgentScheduler = {
  start(agentId: string, schedule: ScheduleConfig, onTrigger: (agentId: string) => void): void {
    if (active.has(agentId)) {
      this.stop(agentId);
    }

    const nextRun = computeNextRun(schedule);
    const entry: ActiveEntry = {
      info: {
        agentId,
        schedule,
        nextRun,
        lastRun: null,
        runCount: 0,
      },
      timerId: undefined as unknown as ReturnType<typeof setTimeout>,
      onTrigger,
    };

    active.set(agentId, entry);
    scheduleTimer(entry);
    saveStored(active);
  },

  stop(agentId: string): void {
    const entry = active.get(agentId);
    if (!entry) return;
    clearTimeout(entry.timerId);
    active.delete(agentId);
    saveStored(active);
  },

  update(agentId: string, schedule: ScheduleConfig): void {
    const entry = active.get(agentId);
    if (!entry) return;
    clearTimeout(entry.timerId);
    entry.info.schedule = schedule;
    entry.info.nextRun = computeNextRun(schedule);
    scheduleTimer(entry);
    saveStored(active);
  },

  getNextRun(agentId: string): Date | null {
    return active.get(agentId)?.info.nextRun ?? null;
  },

  getActiveSchedules(): ScheduleInfo[] {
    return Array.from(active.values()).map((e) => ({ ...e.info }));
  },

  isScheduled(agentId: string): boolean {
    return active.has(agentId);
  },

  restoreAll(onTrigger: (agentId: string) => void): void {
    const stored = loadStored();
    const now = Date.now();

    for (const item of stored) {
      if (active.has(item.agentId)) continue;

      const nextRunTime = new Date(item.nextRun).getTime();
      const intervalMs = getIntervalMs(item.schedule);
      let nextRun: Date;
      let fireImmediately = false;

      if (nextRunTime <= now) {
        const overdueMs = now - nextRunTime;
        if (overdueMs < intervalMs) {
          fireImmediately = true;
          nextRun = new Date(now);
        } else {
          nextRun = computeNextRun(item.schedule);
        }
      } else {
        nextRun = new Date(item.nextRun);
      }

      const entry: ActiveEntry = {
        info: {
          agentId: item.agentId,
          schedule: item.schedule,
          nextRun,
          lastRun: item.lastRun ? new Date(item.lastRun) : null,
          runCount: item.runCount,
        },
        timerId: undefined as unknown as ReturnType<typeof setTimeout>,
        onTrigger,
      };

      active.set(item.agentId, entry);

      if (fireImmediately) {
        fire(item.agentId);
      } else {
        scheduleTimer(entry);
      }
    }
  },
};
