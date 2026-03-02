/* ═══════════════════════════════════════════════════════════
   Security Middleware
   
   Input sanitization, XSS protection, and security headers.
   ═══════════════════════════════════════════════════════════ */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger, Metrics } from '../services/logger.js';

/**
 * Sanitize string by removing potentially dangerous characters
 */
function sanitizeString(input: string): string {
  return input
    // Remove null bytes
    .replace(/\0/g, '')
    // Encode HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Check for potential SQL injection patterns
 */
function hasSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i,
    /('|--|;|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i,
  ];
  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for potential NoSQL injection patterns
 */
function hasNoSQLInjection(input: string): boolean {
  const noSQLPatterns = [
    /\$where/i,
    /\$gt|\$lt|\$ne|\$eq|\$regex/i,
    /\{\s*['"]\$[a-z]+['"]/i,
  ];
  return noSQLPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for potential XSS patterns
 */
function hasXSS(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /expression\s*\(/i,
    /vbscript:/i,
  ];
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Check for path traversal attempts
 */
function hasPathTraversal(input: string): boolean {
  const patterns = [
    /\.\.\//,
    /\.\.%2f/i,
    /%2e%2e%2f/i,
    /\.\.\\/,
  ];
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate input doesn't contain injection patterns
 */
function validateInput(input: unknown, path: string = ''): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (typeof input === 'string') {
    if (hasSQLInjection(input)) {
      issues.push(`Potential SQL injection at ${path}`);
    }
    if (hasNoSQLInjection(input)) {
      issues.push(`Potential NoSQL injection at ${path}`);
    }
    if (hasXSS(input)) {
      issues.push(`Potential XSS at ${path}`);
    }
    if (hasPathTraversal(input)) {
      issues.push(`Potential path traversal at ${path}`);
    }
  } else if (Array.isArray(input)) {
    input.forEach((item, index) => {
      const result = validateInput(item, `${path}[${index}]`);
      issues.push(...result.issues);
    });
  } else if (input && typeof input === 'object') {
    for (const [key, value] of Object.entries(input)) {
      const result = validateInput(value, `${path}.${key}`);
      issues.push(...result.issues);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

/**
 * Input sanitization middleware
 */
export function inputSanitizationMiddleware(options: {
  sanitize?: boolean;
  validate?: boolean;
  blockOnIssues?: boolean;
} = {}): RequestHandler {
  const { sanitize = true, validate = true, blockOnIssues = false } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate input
    if (validate) {
      const bodyValidation = validateInput(req.body, 'body');
      const queryValidation = validateInput(req.query, 'query');
      const paramsValidation = validateInput(req.params, 'params');
      
      const allIssues = [
        ...bodyValidation.issues,
        ...queryValidation.issues,
        ...paramsValidation.issues,
      ];
      
      if (allIssues.length > 0) {
        logger.warn('Potential injection detected', {
          issues: allIssues,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        
        Metrics.increment('security.injection_attempts', 1, {
          path: req.path,
          type: allIssues[0].includes('SQL') ? 'sql' : 
                allIssues[0].includes('NoSQL') ? 'nosql' :
                allIssues[0].includes('XSS') ? 'xss' : 'path_traversal',
        });
        
        if (blockOnIssues) {
          return res.status(400).json({
            success: false,
            error: 'Invalid input detected',
            correlationId: req.correlationId,
          });
        }
      }
    }
    
    // Sanitize input (only body - query is read-only in Express 5+)
    if (sanitize) {
      req.body = sanitizeObject(req.body);
    }
    
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for API
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    
    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // HSTS (if HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
  };
}

/**
 * API key validation middleware
 */
export function apiKeyValidationMiddleware(options: {
  headerName?: string;
  queryParam?: string;
  required?: boolean;
  validateFn?: (key: string) => Promise<{ valid: boolean; userId?: string }>;
} = {}): RequestHandler {
  const { 
    headerName = 'x-api-key', 
    queryParam = 'api_key',
    required = true,
    validateFn,
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers[headerName] as string || req.query[queryParam] as string;
    
    if (!apiKey) {
      if (required) {
        Metrics.increment('security.api_key_missing', 1);
        return res.status(401).json({
          success: false,
          error: 'API key required',
        });
      }
      return next();
    }
    
    // Basic format validation
    if (apiKey.length < 16 || apiKey.length > 256) {
      Metrics.increment('security.api_key_invalid_format', 1);
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
      });
    }
    
    // Custom validation
    if (validateFn) {
      try {
        const result = await validateFn(apiKey);
        if (!result.valid) {
          logger.warn('Invalid API key used', { ip: req.ip });
          Metrics.increment('security.api_key_invalid', 1);
          return res.status(401).json({
            success: false,
            error: 'Invalid API key',
          });
        }
        // Attach user ID to request
        if (result.userId) {
          (req as any).userId = result.userId;
        }
      } catch (err) {
        logger.error('API key validation error', { error: err });
        return res.status(500).json({
          success: false,
          error: 'Authentication error',
        });
      }
    }
    
    next();
  };
}

/**
 * Request ID validation (ensure valid UUIDs/IDs)
 */
export function validateIdParam(paramName: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    
    const idStr = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    
    if (!idStr) {
      return res.status(400).json({
        success: false,
        error: `Missing ${paramName} parameter`,
      });
    }
    
    // Allow alphanumeric, hyphens, underscores (common ID formats)
    const validIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
    
    if (!validIdPattern.test(idStr)) {
      logger.warn('Invalid ID format', { paramName, id: idStr.substring(0, 50) });
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
      });
    }
    
    next();
  };
}

/**
 * Sensitive data masking for logging
 */
export function maskSensitiveData(obj: unknown): unknown {
  const sensitiveKeys = [
    'password', 'secret', 'token', 'api_key', 'apiKey',
    'authorization', 'auth', 'credential', 'private_key',
    'ssn', 'credit_card', 'creditCard', 'cvv',
  ];
  
  if (typeof obj === 'string') return obj;
  if (!obj || typeof obj !== 'object') return obj;
  
  const masked: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));
    
    if (isSensitive && typeof value === 'string') {
      masked[key] = value.length > 4 
        ? `${value.substring(0, 2)}${'*'.repeat(Math.min(value.length - 4, 10))}${value.substring(value.length - 2)}`
        : '****';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
