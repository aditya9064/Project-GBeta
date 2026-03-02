/* ═══════════════════════════════════════════════════════════
   Enhanced Structured Logger — Production Observability
   
   Features:
   - Correlation IDs for request tracing
   - Async context propagation
   - Structured JSON logging for Cloud Logging
   - Performance timing helpers
   - Error serialization with stack traces
   ═══════════════════════════════════════════════════════════ */

import { AsyncLocalStorage } from 'async_hooks';

const isProduction = !!process.env.K_SERVICE;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');

// Async context storage for correlation IDs
interface LogContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  agentId?: string;
  executionId?: string;
  sessionId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceId?: string;
  serviceName?: string;
  [key: string]: string | undefined;
}

const contextStorage = new AsyncLocalStorage<LogContext>();

// Generate unique IDs
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

// Serialize errors properly
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).statusCode && { statusCode: (error as any).statusCode },
    };
  }
  return { message: String(error) };
}

// Format log entry
function formatEntry(
  level: LogLevel, 
  message: string, 
  meta?: LogMeta
): string | Record<string, unknown> {
  const context = contextStorage.getStore();
  const timestamp = new Date().toISOString();
  
  const entry: Record<string, unknown> = {
    timestamp,
    severity: level.toUpperCase(),
    message,
    ...context,
    ...(meta || {}),
  };

  // Handle error objects in meta
  if (meta && meta.error) {
    entry.error = serializeError(meta.error);
  }

  if (isProduction) {
    // Cloud Logging compatible format
    return JSON.stringify({
      ...entry,
      'logging.googleapis.com/trace': context?.traceId 
        ? `projects/${process.env.GCLOUD_PROJECT}/traces/${context.traceId}` 
        : undefined,
      'logging.googleapis.com/spanId': context?.spanId,
    });
  }

  // Dev format with colors
  const colors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  const prefix = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }[level];
  
  let output = `${colors[level]}${prefix} [${timestamp.split('T')[1].slice(0, 8)}]${reset} ${message}`;
  
  if (context?.correlationId) {
    output += ` ${'\x1b[90m'}[${context.correlationId.slice(0, 8)}]${reset}`;
  }
  
  const metaObj = meta || {};
  const metaKeys = Object.keys(metaObj).filter(k => k !== 'error');
  if (metaKeys.length > 0) {
    const cleanMeta = Object.fromEntries(metaKeys.map(k => [k, metaObj[k]]));
    output += ` ${'\x1b[90m'}${JSON.stringify(cleanMeta)}${reset}`;
  }
  
  if (meta && meta.error) {
    const err = serializeError(meta.error);
    output += `\n  ${'\x1b[31m'}${err.name}: ${err.message}${reset}`;
    if (err.stack && !isProduction) {
      output += `\n${'\x1b[90m'}${String(err.stack).split('\n').slice(1, 4).join('\n')}${reset}`;
    }
  }
  
  return output;
}

// Type for log metadata - accepts any value that can be spread
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogMeta = Record<string, any> | any;

// Main logger object
export const logger = {
  debug(message: string, meta?: LogMeta) {
    if (shouldLog('debug')) {
      const output = formatEntry('debug', message, meta);
      console.debug(typeof output === 'string' ? output : JSON.stringify(output));
    }
  },
  
  info(message: string, meta?: LogMeta) {
    if (shouldLog('info')) {
      const output = formatEntry('info', message, meta);
      console.log(typeof output === 'string' ? output : JSON.stringify(output));
    }
  },
  
  warn(message: string, meta?: LogMeta) {
    if (shouldLog('warn')) {
      const output = formatEntry('warn', message, meta);
      console.warn(typeof output === 'string' ? output : JSON.stringify(output));
    }
  },
  
  error(message: string, meta?: LogMeta) {
    if (shouldLog('error')) {
      const output = formatEntry('error', message, meta);
      console.error(typeof output === 'string' ? output : JSON.stringify(output));
    }
  },

  // Child logger with additional context
  child(additionalContext: Partial<LogContext>) {
    const currentContext = contextStorage.getStore() || { correlationId: generateId() };
    return {
      debug: (msg: string, meta?: LogMeta) => 
        logger.debug(msg, { ...additionalContext, ...(meta || {}) }),
      info: (msg: string, meta?: LogMeta) => 
        logger.info(msg, { ...additionalContext, ...(meta || {}) }),
      warn: (msg: string, meta?: LogMeta) => 
        logger.warn(msg, { ...additionalContext, ...(meta || {}) }),
      error: (msg: string, meta?: LogMeta) => 
        logger.error(msg, { ...additionalContext, ...(meta || {}) }),
    };
  },

  // Get current context
  getContext(): LogContext | undefined {
    return contextStorage.getStore();
  },

  // Get correlation ID
  getCorrelationId(): string {
    return contextStorage.getStore()?.correlationId || 'no-context';
  },
};

// Context management
export const LogContext = {
  // Run a function with a new context
  run<T>(context: Partial<LogContext>, fn: () => T): T {
    const fullContext: LogContext = {
      correlationId: context.correlationId || generateId(),
      ...context,
    };
    return contextStorage.run(fullContext, fn);
  },

  // Run async with context
  async runAsync<T>(context: Partial<LogContext>, fn: () => Promise<T>): Promise<T> {
    const fullContext: LogContext = {
      correlationId: context.correlationId || generateId(),
      ...context,
    };
    return contextStorage.run(fullContext, fn);
  },

  // Set context values (must be called within a context)
  set(updates: Partial<LogContext>): void {
    const current = contextStorage.getStore();
    if (current) {
      Object.assign(current, updates);
    }
  },

  // Generate new correlation ID
  generateId,

  // Create child span
  createSpan(name: string): { spanId: string; end: () => void; startTime: number } {
    const spanId = generateId();
    const startTime = performance.now();
    const context = contextStorage.getStore();
    
    if (context) {
      context.parentSpanId = context.spanId;
      context.spanId = spanId;
    }

    logger.debug(`Span started: ${name}`, { spanId, spanName: name });

    return {
      spanId,
      startTime,
      end: () => {
        const duration = performance.now() - startTime;
        logger.debug(`Span ended: ${name}`, { 
          spanId, 
          spanName: name, 
          durationMs: Math.round(duration * 100) / 100 
        });
        if (context) {
          context.spanId = context.parentSpanId;
          context.parentSpanId = undefined;
        }
      },
    };
  },
};

// Performance timing helper
export function withTiming<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        logger.debug(`${name} completed`, { durationMs: Math.round(duration * 100) / 100 });
      }) as ReturnType<T>;
    }
    
    const duration = performance.now() - start;
    logger.debug(`${name} completed`, { durationMs: Math.round(duration * 100) / 100 });
    return result;
  }) as T;
}

// Metrics collector for observability
export interface MetricPoint {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent';
  tags?: Record<string, string>;
  timestamp: number;
}

const metricsBuffer: MetricPoint[] = [];
const METRICS_BUFFER_SIZE = 100;
const metricsFlushCallbacks: ((metrics: MetricPoint[]) => void)[] = [];

export const Metrics = {
  // Record a metric
  record(name: string, value: number, unit: MetricPoint['unit'] = 'count', tags?: Record<string, string>) {
    const point: MetricPoint = {
      name,
      value,
      unit,
      tags,
      timestamp: Date.now(),
    };
    
    metricsBuffer.push(point);
    
    // Auto-flush when buffer is full
    if (metricsBuffer.length >= METRICS_BUFFER_SIZE) {
      this.flush();
    }
    
    // Also log in debug mode
    logger.debug(`Metric: ${name}`, { value, unit, ...tags });
  },

  // Record timing
  timing(name: string, durationMs: number, tags?: Record<string, string>) {
    this.record(name, durationMs, 'ms', tags);
  },

  // Increment counter
  increment(name: string, amount = 1, tags?: Record<string, string>) {
    this.record(name, amount, 'count', tags);
  },

  // Gauge (absolute value)
  gauge(name: string, value: number, unit: MetricPoint['unit'] = 'count', tags?: Record<string, string>) {
    this.record(name, value, unit, tags);
  },

  // Histogram (for percentiles)
  histogram(name: string, value: number, unit: MetricPoint['unit'] = 'ms', tags?: Record<string, string>) {
    this.record(`${name}.histogram`, value, unit, tags);
  },

  // Timer helper
  startTimer(name: string, tags?: Record<string, string>): () => void {
    const start = performance.now();
    return () => {
      this.timing(name, performance.now() - start, tags);
    };
  },

  // Flush metrics buffer
  flush(): MetricPoint[] {
    const metrics = [...metricsBuffer];
    metricsBuffer.length = 0;
    
    // Call registered flush callbacks
    for (const callback of metricsFlushCallbacks) {
      try {
        callback(metrics);
      } catch (err) {
        logger.error('Metrics flush callback error', { error: err });
      }
    }
    
    return metrics;
  },

  // Register flush callback (for sending to APM)
  onFlush(callback: (metrics: MetricPoint[]) => void) {
    metricsFlushCallbacks.push(callback);
  },

  // Get current buffer
  getBuffer(): readonly MetricPoint[] {
    return metricsBuffer;
  },
};

// Health check data
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    responseTime?: number;
    lastCheck: string;
  }>;
  uptime: number;
  version: string;
}

const startTime = Date.now();
const healthChecks: Map<string, () => Promise<{ status: 'pass' | 'warn' | 'fail'; message?: string }>> = new Map();

export const Health = {
  // Register a health check
  register(name: string, check: () => Promise<{ status: 'pass' | 'warn' | 'fail'; message?: string }>) {
    healthChecks.set(name, check);
  },

  // Run all health checks
  async check(): Promise<HealthStatus> {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    for (const [name, checkFn] of healthChecks) {
      const startCheck = performance.now();
      try {
        const result = await checkFn();
        checks[name] = {
          ...result,
          responseTime: Math.round(performance.now() - startCheck),
          lastCheck: new Date().toISOString(),
        };
        
        if (result.status === 'fail') overallStatus = 'unhealthy';
        else if (result.status === 'warn' && overallStatus !== 'unhealthy') overallStatus = 'degraded';
      } catch (err) {
        checks[name] = {
          status: 'fail',
          message: err instanceof Error ? err.message : String(err),
          responseTime: Math.round(performance.now() - startCheck),
          lastCheck: new Date().toISOString(),
        };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      checks,
      uptime: Date.now() - startTime,
      version: process.env.npm_package_version || '1.0.0',
    };
  },

  // Quick liveness check
  isAlive(): boolean {
    return true;
  },
};
