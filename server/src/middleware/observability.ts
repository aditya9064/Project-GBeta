/* ═══════════════════════════════════════════════════════════
   Observability Middleware
   
   Express middleware for:
   - Request correlation IDs
   - Request/Response logging
   - Performance metrics
   - Error tracking
   ═══════════════════════════════════════════════════════════ */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger, LogContext, Metrics, Health } from '../services/logger.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}

// Header names for distributed tracing
const CORRELATION_ID_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';
const TRACE_ID_HEADER = 'x-cloud-trace-context';

/**
 * Main observability middleware - sets up logging context for each request
 */
export function observabilityMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract or generate correlation ID
    const correlationId = 
      req.headers[CORRELATION_ID_HEADER] as string ||
      req.headers[REQUEST_ID_HEADER] as string ||
      LogContext.generateId();
    
    // Parse Cloud Trace header if present
    let traceId: string | undefined;
    let spanId: string | undefined;
    const traceHeader = req.headers[TRACE_ID_HEADER] as string;
    if (traceHeader) {
      const [trace, span] = traceHeader.split('/');
      traceId = trace;
      spanId = span?.split(';')[0];
    }

    // Store on request object
    req.correlationId = correlationId;
    req.startTime = performance.now();

    // Set response header
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    // Run request in logging context
    LogContext.run(
      {
        correlationId,
        requestId: correlationId,
        traceId,
        spanId: spanId || LogContext.generateId(),
        serviceName: 'operonai-backend',
      },
      () => {
        // Log request start
        logger.info(`${req.method} ${req.path}`, {
          method: req.method,
          path: req.path,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.socket.remoteAddress,
          contentLength: req.headers['content-length'],
        });

        // Track response
        const originalEnd = res.end;
        res.end = function(this: Response, ...args: any[]) {
          const duration = performance.now() - req.startTime;
          
          // Log response
          const logLevel = res.statusCode >= 500 ? 'error' : 
                          res.statusCode >= 400 ? 'warn' : 'info';
          
          logger[logLevel](`${req.method} ${req.path} ${res.statusCode}`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Math.round(duration * 100) / 100,
            contentLength: res.getHeader('content-length'),
          });

          // Record metrics
          Metrics.timing('http.request.duration', duration, {
            method: req.method,
            path: normalizePath(req.path),
            status: String(res.statusCode),
          });
          
          Metrics.increment('http.request.count', 1, {
            method: req.method,
            path: normalizePath(req.path),
            status: String(res.statusCode),
          });

          if (res.statusCode >= 400) {
            Metrics.increment('http.request.errors', 1, {
              method: req.method,
              path: normalizePath(req.path),
              status: String(res.statusCode),
            });
          }

          return originalEnd.apply(this, args as any);
        };

        next();
      }
    );
  };
}

/**
 * Normalize paths to reduce cardinality in metrics
 * e.g., /api/agents/abc123 -> /api/agents/:id
 */
function normalizePath(path: string): string {
  return path
    // UUID pattern
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // MongoDB ObjectId pattern
    .replace(/[0-9a-f]{24}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    // Firebase-style IDs
    .replace(/\/[A-Za-z0-9_-]{20,}/g, '/:id');
}

/**
 * Error tracking middleware - must be registered after routes
 */
export function errorTrackingMiddleware() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    const duration = req.startTime ? performance.now() - req.startTime : 0;
    
    logger.error(`Request failed: ${err.message}`, {
      error: err,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode || 500,
      durationMs: Math.round(duration * 100) / 100,
    });

    Metrics.increment('http.request.unhandled_errors', 1, {
      method: req.method,
      path: normalizePath(req.path),
      errorType: err.name,
    });

    // Don't expose internal errors in production
    const statusCode = (err as any).statusCode || 500;
    const message = statusCode === 500 && process.env.K_SERVICE 
      ? 'Internal server error' 
      : err.message;

    res.status(statusCode).json({
      success: false,
      error: message,
      correlationId: req.correlationId,
    });
  };
}

/**
 * Health check endpoint handler
 */
export function healthCheckHandler() {
  return async (req: Request, res: Response) => {
    const health = await Health.check();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  };
}

/**
 * Liveness probe handler (for k8s)
 */
export function livenessHandler() {
  return (req: Request, res: Response) => {
    res.status(Health.isAlive() ? 200 : 503).json({ status: Health.isAlive() ? 'alive' : 'dead' });
  };
}

/**
 * Readiness probe handler (for k8s)
 */
export function readinessHandler() {
  return async (req: Request, res: Response) => {
    const health = await Health.check();
    const ready = health.status !== 'unhealthy';
    res.status(ready ? 200 : 503).json({ ready, status: health.status });
  };
}

/**
 * Metrics endpoint handler
 */
export function metricsHandler() {
  return (req: Request, res: Response) => {
    const metrics = Metrics.flush();
    
    // Prometheus-style text format
    if (req.accepts('text/plain')) {
      const lines = metrics.map(m => {
        const tags = m.tags ? Object.entries(m.tags).map(([k, v]) => `${k}="${v}"`).join(',') : '';
        const name = m.name.replace(/\./g, '_');
        return `${name}{${tags}} ${m.value} ${m.timestamp}`;
      });
      res.type('text/plain').send(lines.join('\n'));
      return;
    }
    
    // JSON format
    res.json({ metrics });
  };
}

/**
 * Request body size limiting middleware with logging
 */
export function bodySizeLimitMiddleware(maxSizeKB: number = 1024): RequestHandler {
  const maxBytes = maxSizeKB * 1024;
  
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;
    
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        logger.warn('Request body too large', {
          size,
          maxSize: maxBytes,
          path: req.path,
        });
        res.status(413).json({
          success: false,
          error: `Request body exceeds ${maxSizeKB}KB limit`,
        });
        req.destroy();
      }
    });
    
    next();
  };
}

/**
 * Slow request detection middleware
 */
export function slowRequestMiddleware(thresholdMs: number = 5000): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        elapsedMs: thresholdMs,
      });
      
      Metrics.increment('http.request.slow', 1, {
        method: req.method,
        path: normalizePath(req.path),
      });
    }, thresholdMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}
