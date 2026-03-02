/* ═══════════════════════════════════════════════════════════
   Retry Service Tests
   ═══════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryService } from '../services/retryService.js';

describe('RetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RetryService.resetAllCircuits();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await RetryService.withRetry(fn);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');
      
      const result = await RetryService.withRetry(fn, { initialDelayMs: 10 });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('TIMEOUT'));
      
      const result = await RetryService.withRetry(fn, { 
        maxRetries: 2, 
        initialDelayMs: 10 
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('AUTHENTICATION_FAILED'));
      
      const result = await RetryService.withRetry(fn, { 
        maxRetries: 3, 
        initialDelayMs: 10 
      });
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');
      const onRetry = vi.fn();
      
      await RetryService.withRetry(fn, { 
        initialDelayMs: 10,
        onRetry 
      });
      
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute successfully when circuit is closed', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await RetryService.withCircuitBreaker('test', fn);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should open circuit after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      // Make enough failures to open circuit
      for (let i = 0; i < 5; i++) {
        await RetryService.withCircuitBreaker('test2', fn, { failureThreshold: 5 });
      }
      
      const status = RetryService.getCircuitStatus('test2');
      expect(status?.state).toBe('open');
      
      // Next call should fail immediately
      const result = await RetryService.withCircuitBreaker('test2', fn);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Circuit breaker');
    });

    it('should close circuit after successful requests in half-open state', async () => {
      const key = 'test3';
      const fn = vi.fn()
        .mockRejectedValue(new Error('fail'));
      
      const circuitConfig = { 
        failureThreshold: 5,
        timeoutMs: 50,
        successThreshold: 2,
        halfOpenRequests: 5,
      };
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await RetryService.withCircuitBreaker(key, fn, circuitConfig);
      }
      
      // Verify it's open
      expect(RetryService.getCircuitStatus(key)?.state).toBe('open');
      
      // Wait for timeout to transition to half-open
      await new Promise(r => setTimeout(r, 60));
      
      // Now succeed - need enough successes to meet threshold
      const successFn = vi.fn().mockResolvedValue('success');
      for (let i = 0; i < 2; i++) {
        await RetryService.withCircuitBreaker(key, successFn, circuitConfig);
      }
      
      const status = RetryService.getCircuitStatus(key);
      expect(status?.state).toBe('closed');
    });
  });

  describe('categorizeError', () => {
    it('should categorize authentication errors as fatal', () => {
      const result = RetryService.categorizeError(new Error('Authentication failed'));
      expect(result.category).toBe('fatal');
    });

    it('should categorize timeout errors as retryable', () => {
      const result = RetryService.categorizeError(new Error('Request timeout'));
      expect(result.category).toBe('retryable');
    });

    it('should categorize quota errors as escalate', () => {
      const result = RetryService.categorizeError(new Error('Quota exceeded'));
      expect(result.category).toBe('escalate');
    });

    it('should categorize warnings as ignore', () => {
      const result = RetryService.categorizeError(new Error('Deprecation warning'));
      expect(result.category).toBe('ignore');
    });
  });

  describe('createResilientFunction', () => {
    it('should create a wrapped function with retry', async () => {
      const original = vi.fn()
        .mockRejectedValueOnce(new Error('TIMEOUT'))
        .mockResolvedValueOnce('success');
      
      const resilient = RetryService.createResilientFunction(
        original,
        'test-fn',
        { initialDelayMs: 10 }
      );
      
      const result = await resilient();
      expect(result).toBe('success');
      expect(original).toHaveBeenCalledTimes(2);
    });
  });
});
