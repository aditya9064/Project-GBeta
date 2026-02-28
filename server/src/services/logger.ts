/* ═══════════════════════════════════════════════════════════
   Structured Logger — Production-safe logging
   
   Uses JSON output in production, readable format in dev.
   Drop-in replacement for console.log/warn/error.
   ═══════════════════════════════════════════════════════════ */

const isProduction = !!process.env.K_SERVICE;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = isProduction ? 'info' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatMessage(level: LogLevel, message: string, meta?: Record<string, any>): string {
  if (isProduction) {
    return JSON.stringify({ severity: level.toUpperCase(), message, ...meta, timestamp: new Date().toISOString() });
  }
  const prefix = { debug: '🔍', info: 'ℹ️ ', warn: '⚠️ ', error: '❌' }[level];
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: Record<string, any>) {
    if (shouldLog('debug')) console.debug(formatMessage('debug', message, meta));
  },
  info(message: string, meta?: Record<string, any>) {
    if (shouldLog('info')) console.log(formatMessage('info', message, meta));
  },
  warn(message: string, meta?: Record<string, any>) {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, meta));
  },
  error(message: string, meta?: Record<string, any>) {
    if (shouldLog('error')) console.error(formatMessage('error', message, meta));
  },
};
