/* ═══════════════════════════════════════════════════════════
   Structured Logger — JSON-formatted action logs for
   observability and debugging.

   Every agent action is logged with:
   - timestamp
   - agentId / swarmId
   - taskId (if applicable)
   - actionType (plan, spawn, execute, complete, fail, retry, etc.)
   - status (success, error, info)
   - duration (for timed actions)
   - error details (if applicable)
   - metadata (tool name, step count, etc.)

   Logs go to stdout in JSON lines format for easy ingestion
   by monitoring tools. In production, these can be piped to
   a log aggregator.
   ═══════════════════════════════════════════════════════════ */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  action: string;
  agentId?: string;
  swarmId?: string;
  taskId?: string;
  status?: 'success' | 'error' | 'info' | 'warning';
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class StructuredLogger {
  private minLevel: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  log(entry: StructuredLogEntry): void {
    if (LOG_LEVEL_ORDER[entry.level] < LOG_LEVEL_ORDER[this.minLevel]) return;

    const line = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    });

    switch (entry.level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  }

  agent(action: string, agentId: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'agent',
      action,
      agentId,
      ...details,
    });
  }

  swarm(action: string, swarmId: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'swarm',
      action,
      swarmId,
      ...details,
    });
  }

  task(action: string, swarmId: string, taskId: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'task',
      action,
      swarmId,
      taskId,
      ...details,
    });
  }

  worker(action: string, swarmId: string, agentId: string, taskId: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'worker',
      action,
      swarmId,
      agentId,
      taskId,
      ...details,
    });
  }

  system(action: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'system',
      action,
      ...details,
    });
  }

  error(component: string, action: string, error: string, details?: Partial<StructuredLogEntry>): void {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      action,
      status: 'error',
      error,
      ...details,
    });
  }

  timed<T>(component: string, action: string, fn: () => Promise<T>, details?: Partial<StructuredLogEntry>): Promise<T> {
    const start = Date.now();
    return fn().then(
      (result) => {
        this.log({
          timestamp: new Date().toISOString(),
          level: 'info',
          component,
          action,
          status: 'success',
          durationMs: Date.now() - start,
          ...details,
        });
        return result;
      },
      (err) => {
        this.log({
          timestamp: new Date().toISOString(),
          level: 'error',
          component,
          action,
          status: 'error',
          durationMs: Date.now() - start,
          error: err.message,
          ...details,
        });
        throw err;
      },
    );
  }
}

export const logger = new StructuredLogger();
