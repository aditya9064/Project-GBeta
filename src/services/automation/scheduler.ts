export interface ScheduleConfig {
  frequency: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  intervalMinutes?: number;
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
  }
}

function computeNextRun(config: ScheduleConfig, after: Date = new Date()): Date {
  const now = after.getTime();

  if (config.frequency === 'minutely') {
    return new Date(now + (config.intervalMinutes ?? 1) * 60_000);
  }

  if (config.frequency === 'hourly') {
    const next = new Date(after);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  const [hours, minutes] = parseTime(config.time);

  if (config.frequency === 'daily') {
    const next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (config.frequency === 'weekly') {
    const targetDay = config.dayOfWeek ?? 0;
    const next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
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
    const next = new Date(after);
    next.setHours(hours, minutes, 0, 0);
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
