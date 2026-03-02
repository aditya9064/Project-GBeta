/* ═══════════════════════════════════════════════════════════
   Virtual List Hook
   
   Provides windowed rendering for large lists to improve
   performance by only rendering visible items.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number;
  containerHeight?: number;
}

interface VirtualListItem<T> {
  item: T;
  index: number;
  style: React.CSSProperties;
}

interface UseVirtualListReturn<T> {
  virtualItems: VirtualListItem<T>[];
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
}

export function useVirtualList<T>(
  items: T[],
  options: UseVirtualListOptions
): UseVirtualListReturn<T> {
  const { itemHeight, overscan = 3, containerHeight: fixedHeight } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(fixedHeight || 400);

  // Handle scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle resize
  useEffect(() => {
    if (fixedHeight) {
      setContainerHeight(fixedHeight);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedHeight]);

  // Calculate visible range
  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

    const virtualItems: VirtualListItem<T>[] = [];
    
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute',
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      });
    }

    return { startIndex, endIndex, virtualItems, totalHeight };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  const totalHeight = items.length * itemHeight;

  // Scroll to specific index
  const scrollToIndex = useCallback(
    (index: number, align: 'start' | 'center' | 'end' = 'start') => {
      const container = containerRef.current;
      if (!container) return;

      let scrollOffset: number;

      switch (align) {
        case 'start':
          scrollOffset = index * itemHeight;
          break;
        case 'center':
          scrollOffset = index * itemHeight - containerHeight / 2 + itemHeight / 2;
          break;
        case 'end':
          scrollOffset = index * itemHeight - containerHeight + itemHeight;
          break;
      }

      container.scrollTop = Math.max(0, Math.min(scrollOffset, totalHeight - containerHeight));
    },
    [itemHeight, containerHeight, totalHeight]
  );

  return {
    virtualItems,
    totalHeight,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    scrollToIndex,
  };
}

/**
 * Simple virtualized list for variable height items
 * Uses estimated height and measures actual heights
 */
export function useVirtualListDynamic<T>(
  items: T[],
  options: {
    estimatedItemHeight: number;
    overscan?: number;
    getItemKey?: (item: T, index: number) => string;
  }
) {
  const { estimatedItemHeight, overscan = 3, getItemKey } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const measuredHeights = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const getItemHeight = useCallback(
    (item: T, index: number): number => {
      const key = getItemKey?.(item, index) || String(index);
      return measuredHeights.current.get(key) || estimatedItemHeight;
    },
    [estimatedItemHeight, getItemKey]
  );

  const measureItem = useCallback(
    (item: T, index: number, element: HTMLElement) => {
      const key = getItemKey?.(item, index) || String(index);
      const height = element.getBoundingClientRect().height;
      if (measuredHeights.current.get(key) !== height) {
        measuredHeights.current.set(key, height);
      }
    },
    [getItemKey]
  );

  const { virtualItems, totalHeight } = useMemo(() => {
    let totalHeight = 0;
    const itemOffsets: number[] = [];

    for (let i = 0; i < items.length; i++) {
      itemOffsets.push(totalHeight);
      totalHeight += getItemHeight(items[i], i);
    }

    // Find start index using binary search
    let startIndex = 0;
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (itemOffsets[mid] < scrollTop) {
        startIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    startIndex = Math.max(0, startIndex - overscan);

    // Find end index
    let endIndex = startIndex;
    let accumulatedHeight = itemOffsets[startIndex] || 0;

    while (endIndex < items.length && accumulatedHeight < scrollTop + containerHeight) {
      accumulatedHeight += getItemHeight(items[endIndex], endIndex);
      endIndex++;
    }

    endIndex = Math.min(items.length - 1, endIndex + overscan);

    const virtualItems: (VirtualListItem<T> & { measureRef: (el: HTMLElement | null) => void })[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const item = items[i];
      virtualItems.push({
        item,
        index: i,
        style: {
          position: 'absolute',
          top: itemOffsets[i],
          left: 0,
          right: 0,
          minHeight: getItemHeight(item, i),
        },
        measureRef: (el: HTMLElement | null) => {
          if (el) measureItem(item, i, el);
        },
      });
    }

    return { virtualItems, totalHeight };
  }, [items, scrollTop, containerHeight, overscan, getItemHeight, measureItem]);

  return {
    virtualItems,
    totalHeight,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
  };
}
