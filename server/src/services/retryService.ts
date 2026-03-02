/* ═══════════════════════════════════════════════════════════
   Retry Service — Resilient execution with retry logic
   
   Provides exponential backoff retry, circuit breaker pattern,
   and intelligent error handling for agent executions.
   ═══════════════════════════════════════════════════════════ */

import { logger } from './logger.js';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  halfOpenRequests: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalDelayMs: number;
  finalError?: Error;
}

type CircuitState = 'closed' | 'open' | 'half-open';

const circuitBreakers = new Map<string, {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}>();

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'RATE_LIMIT',
    'TEMPORARY_ERROR',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
  nonRetryableErrors: [
    'INVALID_API_KEY',
    'AUTHENTICATION_FAILED',
    '401',
    '403',
    'VALIDATION_ERROR',
    'NOT_FOUND',
  ],
};

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30000,
  halfOpenRequests: 1,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: Error, config: RetryConfig): boolean {
  const errorString = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
  // Check non-retryable errors first
  for (const nonRetryable of config.nonRetryableErrors || []) {
    if (errorString.includes(nonRetryable.toLowerCase()) || 
        errorName.includes(nonRetryable.toLowerCase())) {
      return false;
    }
  }
  
  // Check retryable errors
  for (const retryable of config.retryableErrors || []) {
    if (errorString.includes(retryable.toLowerCase()) || 
        errorName.includes(retryable.toLowerCase())) {
      return true;
    }
  }
  
  // Default: retry on network errors
  return errorString.includes('network') || 
         errorString.includes('timeout') ||
         errorString.includes('connection');
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

export const RetryService = {
  /** Execute function with retry logic */
  async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<RetryResult<T>> {
    const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | undefined;
    let attempts = 0;
    let totalDelayMs = 0;
    
    while (attempts <= fullConfig.maxRetries) {
      attempts++;
      
      try {
        const result = await fn();
        return {
          success: true,
          data: result,
          attempts,
          totalDelayMs,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // Check if we should retry
        if (attempts > fullConfig.maxRetries) {
          break;
        }
        
        if (!isRetryableError(lastError, fullConfig)) {
          logger.warn(`🚫 Non-retryable error: ${lastError.message}`);
          break;
        }
        
        // Calculate delay
        const delay = calculateDelay(attempts, fullConfig);
        totalDelayMs += delay;
        
        logger.info(`🔄 Retry ${attempts}/${fullConfig.maxRetries} after ${delay}ms: ${lastError.message}`);
        fullConfig.onRetry?.(attempts, lastError, delay);
        
        await sleep(delay);
      }
    }
    
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      attempts,
      totalDelayMs,
      finalError: lastError,
    };
  },

  /** Execute with circuit breaker pattern */
  async withCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    config: Partial<CircuitBreakerConfig> = {}
  ): Promise<RetryResult<T>> {
    const fullConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    
    // Get or create circuit breaker state
    let breaker = circuitBreakers.get(key);
    if (!breaker) {
      breaker = {
        state: 'closed',
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        halfOpenRequests: 0,
      };
      circuitBreakers.set(key, breaker);
    }
    
    // Check circuit state
    if (breaker.state === 'open') {
      // Check if timeout has elapsed
      if (Date.now() - breaker.lastFailureTime >= fullConfig.timeoutMs) {
        breaker.state = 'half-open';
        breaker.halfOpenRequests = 0;
        logger.info(`⚡ Circuit breaker ${key}: transitioning to half-open`);
      } else {
        return {
          success: false,
          error: `Circuit breaker ${key} is open`,
          attempts: 0,
          totalDelayMs: 0,
        };
      }
    }
    
    // In half-open state, limit requests
    if (breaker.state === 'half-open') {
      if (breaker.halfOpenRequests >= fullConfig.halfOpenRequests) {
        return {
          success: false,
          error: `Circuit breaker ${key} is half-open, limiting requests`,
          attempts: 0,
          totalDelayMs: 0,
        };
      }
      breaker.halfOpenRequests++;
    }
    
    try {
      const result = await fn();
      
      // Record success
      breaker.successes++;
      breaker.failures = 0;
      
      if (breaker.state === 'half-open' && breaker.successes >= fullConfig.successThreshold) {
        breaker.state = 'closed';
        breaker.successes = 0;
        logger.info(`✅ Circuit breaker ${key}: closed after successful requests`);
      }
      
      return {
        success: true,
        data: result,
        attempts: 1,
        totalDelayMs: 0,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Record failure
      breaker.failures++;
      breaker.successes = 0;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failures >= fullConfig.failureThreshold) {
        breaker.state = 'open';
        logger.warn(`⚡ Circuit breaker ${key}: opened after ${breaker.failures} failures`);
      } else if (breaker.state === 'half-open') {
        breaker.state = 'open';
        logger.warn(`⚡ Circuit breaker ${key}: re-opened due to failure in half-open state`);
      }
      
      return {
        success: false,
        error: error.message,
        attempts: 1,
        totalDelayMs: 0,
        finalError: error,
      };
    }
  },

  /** Combined retry with circuit breaker */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    retryConfig: Partial<RetryConfig> = {},
    circuitConfig: Partial<CircuitBreakerConfig> = {}
  ): Promise<RetryResult<T>> {
    return this.withCircuitBreaker(key, async () => {
      const result = await this.withRetry(fn, retryConfig);
      if (!result.success) {
        throw result.finalError || new Error(result.error);
      }
      return result.data!;
    }, circuitConfig);
  },

  /** Get circuit breaker status */
  getCircuitStatus(key: string): { state: CircuitState; failures: number } | null {
    const breaker = circuitBreakers.get(key);
    if (!breaker) return null;
    return { state: breaker.state, failures: breaker.failures };
  },

  /** Reset circuit breaker */
  resetCircuit(key: string): void {
    circuitBreakers.delete(key);
    logger.info(`🔄 Circuit breaker ${key}: reset`);
  },

  /** Reset all circuit breakers */
  resetAllCircuits(): void {
    circuitBreakers.clear();
    logger.info('🔄 All circuit breakers reset');
  },

  /** Get all circuit breaker statuses */
  getAllCircuitStatuses(): Map<string, { state: CircuitState; failures: number }> {
    const statuses = new Map();
    for (const [key, breaker] of circuitBreakers) {
      statuses.set(key, { state: breaker.state, failures: breaker.failures });
    }
    return statuses;
  },

  /** Categorize error for appropriate handling */
  categorizeError(error: Error): {
    category: 'retryable' | 'fatal' | 'escalate' | 'ignore';
    suggestion: string;
  } {
    const msg = error.message.toLowerCase();
    
    // Fatal errors
    if (msg.includes('authentication') || msg.includes('invalid api key') || msg.includes('unauthorized')) {
      return { category: 'fatal', suggestion: 'Check API credentials' };
    }
    if (msg.includes('validation') || msg.includes('invalid input')) {
      return { category: 'fatal', suggestion: 'Fix input data' };
    }
    
    // Retryable errors
    if (msg.includes('timeout') || msg.includes('rate limit') || msg.includes('temporary')) {
      return { category: 'retryable', suggestion: 'Will retry automatically' };
    }
    if (msg.includes('network') || msg.includes('connection')) {
      return { category: 'retryable', suggestion: 'Network issue, will retry' };
    }
    
    // Escalate
    if (msg.includes('quota') || msg.includes('limit exceeded') || msg.includes('budget')) {
      return { category: 'escalate', suggestion: 'Resource limits reached, requires human intervention' };
    }
    
    // Ignore (non-critical)
    if (msg.includes('warning') || msg.includes('deprecated')) {
      return { category: 'ignore', suggestion: 'Non-critical warning' };
    }
    
    // Default to escalate
    return { category: 'escalate', suggestion: 'Unknown error type, review needed' };
  },

  /** Create wrapper for any async function with built-in retry */
  createResilientFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    key: string,
    retryConfig?: Partial<RetryConfig>,
    circuitConfig?: Partial<CircuitBreakerConfig>
  ): T {
    const resilientFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const result = await this.execute(key, () => fn(...args), retryConfig, circuitConfig);
      if (!result.success) {
        throw result.finalError || new Error(result.error);
      }
      return result.data as ReturnType<T>;
    };
    
    return resilientFn as T;
  },
};
