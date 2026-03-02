/* ═══════════════════════════════════════════════════════════
   Data Fetching Hook with Caching
   
   Provides optimized data fetching with built-in caching,
   deduplication, and automatic revalidation.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isRevalidating: boolean;
}

interface UseDataFetchOptions<T> {
  cacheKey?: string;
  cacheTTL?: number;
  staleWhileRevalidate?: boolean;
  dedupe?: boolean;
  dedupeInterval?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  refetchInterval?: number;
  retryCount?: number;
  retryDelay?: number;
}

interface UseDataFetchReturn<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isRevalidating: boolean;
  refetch: () => Promise<void>;
  mutate: (data: T | ((prev: T | undefined) => T)) => void;
}

// Global cache for data
const cache = new Map<string, CacheEntry<any>>();

// In-flight requests for deduplication
const inFlight = new Map<string, Promise<any>>();

// Request timestamps for dedupe interval
const lastFetchTime = new Map<string, number>();

/**
 * Custom hook for data fetching with caching and optimization
 */
export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  options: UseDataFetchOptions<T> = {}
): UseDataFetchReturn<T> {
  const {
    cacheKey,
    cacheTTL = 60000, // 1 minute default
    staleWhileRevalidate = true,
    dedupe = true,
    dedupeInterval = 2000,
    onSuccess,
    onError,
    enabled = true,
    refetchInterval,
    retryCount = 0,
    retryDelay = 1000,
  } = options;

  const [data, setData] = useState<T | undefined>(() => {
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        return cached.data;
      }
    }
    return undefined;
  });

  const [error, setError] = useState<Error | undefined>();
  const [isLoading, setIsLoading] = useState(!data);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeWithRetry = useCallback(
    async (attempt = 0): Promise<T> => {
      try {
        return await fetcherRef.current();
      } catch (err) {
        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
          return executeWithRetry(attempt + 1);
        }
        throw err;
      }
    },
    [retryCount, retryDelay]
  );

  const fetch = useCallback(async () => {
    const key = cacheKey;

    // Check dedupe interval
    if (dedupe && key) {
      const lastTime = lastFetchTime.get(key);
      if (lastTime && Date.now() - lastTime < dedupeInterval) {
        const inFlightPromise = inFlight.get(key);
        if (inFlightPromise) {
          return inFlightPromise;
        }
      }
    }

    // Check if we have valid cached data
    if (key) {
      const cached = cache.get(key);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        
        // Fresh cache, no need to refetch
        if (age < cacheTTL) {
          setData(cached.data);
          setIsLoading(false);
          return;
        }

        // Stale cache, show stale data while revalidating
        if (staleWhileRevalidate) {
          setData(cached.data);
          setIsRevalidating(true);
        }
      }
    }

    // Set loading state if no cached data
    if (!data) {
      setIsLoading(true);
    }

    // Create fetch promise
    const fetchPromise = (async () => {
      try {
        const result = await executeWithRetry();
        
        if (mountedRef.current) {
          setData(result);
          setError(undefined);
          setIsLoading(false);
          setIsRevalidating(false);
          onSuccess?.(result);

          // Update cache
          if (key) {
            cache.set(key, {
              data: result,
              timestamp: Date.now(),
              isRevalidating: false,
            });
          }
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        if (mountedRef.current) {
          setError(error);
          setIsLoading(false);
          setIsRevalidating(false);
          onError?.(error);
        }

        throw error;
      } finally {
        if (key) {
          inFlight.delete(key);
        }
      }
    })();

    // Store in-flight promise for deduplication
    if (key) {
      inFlight.set(key, fetchPromise);
      lastFetchTime.set(key, Date.now());
    }

    return fetchPromise;
  }, [cacheKey, cacheTTL, staleWhileRevalidate, dedupe, dedupeInterval, data, executeWithRetry, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      fetch();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, fetch]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const intervalId = setInterval(() => {
      fetch();
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [refetchInterval, enabled, fetch]);

  // Mutate function for optimistic updates
  const mutate = useCallback(
    (newData: T | ((prev: T | undefined) => T)) => {
      setData((prev) => {
        const updated = typeof newData === 'function' 
          ? (newData as (prev: T | undefined) => T)(prev) 
          : newData;
        
        if (cacheKey) {
          cache.set(cacheKey, {
            data: updated,
            timestamp: Date.now(),
            isRevalidating: false,
          });
        }

        return updated;
      });
    },
    [cacheKey]
  );

  return {
    data,
    error,
    isLoading,
    isRevalidating,
    refetch: fetch,
    mutate,
  };
}

/**
 * Clear specific cache entry
 */
export function clearCache(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Prefetch data into cache
 */
export async function prefetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const data = await fetcher();
    cache.set(key, {
      data,
      timestamp: Date.now(),
      isRevalidating: false,
    });
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get cached data without fetching
 */
export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.data;
}

/**
 * Check if cache entry exists and is fresh
 */
export function isCacheFresh(key: string, ttl = 60000): boolean {
  const entry = cache.get(key);
  return entry ? Date.now() - entry.timestamp < ttl : false;
}
