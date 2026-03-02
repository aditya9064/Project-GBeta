/* ═══════════════════════════════════════════════════════════
   Performance Utilities
   
   Memoization, debouncing, throttling, and other performance
   optimization utilities.
   ═══════════════════════════════════════════════════════════ */

/**
 * Creates a memoized version of a function with a cache
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxCacheSize?: number;
    ttlMs?: number;
    keyFn?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const { maxCacheSize = 100, ttlMs, keyFn } = options;
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    
    if (cached) {
      if (!ttlMs || Date.now() - cached.timestamp < ttlMs) {
        return cached.value;
      }
      cache.delete(key);
    }
    
    const result = fn(...args);
    
    // Enforce cache size limit
    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    
    cache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }) as T;
}

/**
 * Debounce function - delays execution until after wait ms have elapsed
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void; flush: () => void } {
  const { leading = false, trailing = true } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T>;
  
  const debounced = (...args: Parameters<T>): ReturnType<T> => {
    lastArgs = args;
    
    const shouldCallNow = leading && !timeoutId;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (trailing && lastArgs) {
        lastResult = fn(...lastArgs);
      }
    }, waitMs);
    
    if (shouldCallNow) {
      lastResult = fn(...args);
    }
    
    return lastResult;
  };
  
  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      timeoutId = null;
      lastResult = fn(...lastArgs);
    }
  };
  
  return debounced as T & { cancel: () => void; flush: () => void };
}

/**
 * Throttle function - limits execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void } {
  const { leading = true, trailing = true } = options;
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T>;
  
  const throttled = (...args: Parameters<T>): ReturnType<T> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    lastArgs = args;
    
    if (timeSinceLastCall >= limitMs && leading) {
      lastCallTime = now;
      lastResult = fn(...args);
      return lastResult;
    }
    
    if (!timeoutId && trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
          lastResult = fn(...lastArgs);
        }
      }, limitMs - timeSinceLastCall);
    }
    
    return lastResult;
  };
  
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return throttled as T & { cancel: () => void };
}

/**
 * Request idle callback with fallback
 */
export function requestIdleCallback(
  callback: () => void,
  options: { timeout?: number } = {}
): number {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, options);
  }
  return window.setTimeout(callback, options.timeout || 1) as unknown as number;
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Batch multiple operations for better performance
 */
export function batchOperations<T>(
  operations: (() => T)[],
  batchSize = 10,
  delayBetweenBatchesMs = 0
): Promise<T[]> {
  return new Promise((resolve) => {
    const results: T[] = [];
    let currentIndex = 0;
    
    function processBatch() {
      const batch = operations.slice(currentIndex, currentIndex + batchSize);
      
      for (const op of batch) {
        results.push(op());
      }
      
      currentIndex += batchSize;
      
      if (currentIndex < operations.length) {
        if (delayBetweenBatchesMs > 0) {
          setTimeout(processBatch, delayBetweenBatchesMs);
        } else {
          requestIdleCallback(processBatch);
        }
      } else {
        resolve(results);
      }
    }
    
    processBatch();
  });
}

/**
 * Measure performance of a function
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  fn: T,
  label: string
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }) as T;
}

/**
 * Create a lazy initializer for expensive computations
 */
export function lazy<T>(factory: () => T): () => T {
  let value: T | undefined;
  let initialized = false;
  
  return () => {
    if (!initialized) {
      value = factory();
      initialized = true;
    }
    return value!;
  };
}

/**
 * Deep compare two objects for equality (optimized)
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;
  
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key])) return false;
  }
  
  return true;
}

/**
 * Shallow compare for React.memo
 */
export function shallowEqual<T extends Record<string, unknown>>(
  objA: T,
  objB: T
): boolean {
  if (objA === objB) return true;
  
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false;
  }
  
  return true;
}

/**
 * Pool for reusing objects to reduce GC pressure
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  
  constructor(options: {
    factory: () => T;
    reset?: (obj: T) => void;
    maxSize?: number;
    initialSize?: number;
  }) {
    this.factory = options.factory;
    this.reset = options.reset || (() => {});
    this.maxSize = options.maxSize || 100;
    
    // Pre-populate pool
    for (let i = 0; i < (options.initialSize || 0); i++) {
      this.pool.push(this.factory());
    }
  }
  
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }
  
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }
  
  clear(): void {
    this.pool = [];
  }
  
  get size(): number {
    return this.pool.length;
  }
}
