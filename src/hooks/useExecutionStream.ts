/* ═══════════════════════════════════════════════════════════
   useExecutionStream — React hook for real-time execution updates
   
   Connects to SSE endpoint for live execution progress.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

export interface ExecutionEvent {
  type: 'node_start' | 'node_complete' | 'node_failed' | 'execution_complete' | 'execution_failed' | 'progress' | 'log';
  executionId: string;
  agentId: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  status?: string;
  progress?: number;
  message?: string;
  output?: any;
  error?: string;
  timestamp: string;
}

export interface ExecutionStreamState {
  connected: boolean;
  events: ExecutionEvent[];
  currentExecutions: Map<string, ExecutionEvent[]>;
  lastEvent: ExecutionEvent | null;
}

interface UseExecutionStreamOptions {
  agentId?: string;
  executionId?: string;
  onEvent?: (event: ExecutionEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  maxEvents?: number;
}

export function useExecutionStream(options: UseExecutionStreamOptions = {}) {
  const { 
    agentId, 
    executionId, 
    onEvent, 
    onConnect, 
    onDisconnect,
    maxEvents = 100 
  } = options;

  const [state, setState] = useState<ExecutionStreamState>({
    connected: false,
    events: [],
    currentExecutions: new Map(),
    lastEvent: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Build URL based on options
    let url = `${BACKEND_URL}/api/stream/executions`;
    if (agentId && executionId) {
      url = `${BACKEND_URL}/api/stream/executions/${agentId}/${executionId}`;
    } else if (agentId) {
      url = `${BACKEND_URL}/api/stream/executions/${agentId}`;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, connected: true }));
      onConnect?.();
    };

    eventSource.onerror = () => {
      setState(prev => ({ ...prev, connected: false }));
      onDisconnect?.();
      
      // Attempt reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connect();
        }
      }, 5000);
    };

    // Handle different event types
    const eventTypes = ['node_start', 'node_complete', 'node_failed', 'execution_complete', 'execution_failed', 'progress', 'log'];
    
    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data: ExecutionEvent = JSON.parse(event.data);
          
          setState(prev => {
            const newEvents = [...prev.events, data];
            if (newEvents.length > maxEvents) {
              newEvents.shift();
            }

            // Update current executions map
            const executions = new Map(prev.currentExecutions);
            const execKey = data.executionId;
            const execEvents = executions.get(execKey) || [];
            execEvents.push(data);
            executions.set(execKey, execEvents);

            // Clean up completed executions after 5 minutes
            if (data.type === 'execution_complete' || data.type === 'execution_failed') {
              setTimeout(() => {
                setState(prev => {
                  const execs = new Map(prev.currentExecutions);
                  execs.delete(execKey);
                  return { ...prev, currentExecutions: execs };
                });
              }, 300000);
            }

            return {
              ...prev,
              events: newEvents,
              currentExecutions: executions,
              lastEvent: data,
            };
          });

          onEvent?.(data);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      });
    }

    return eventSource;
  }, [agentId, executionId, maxEvents, onConnect, onDisconnect, onEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setState(prev => ({ ...prev, connected: false }));
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      events: [],
      currentExecutions: new Map(),
      lastEvent: null,
    }));
  }, []);

  const getExecutionEvents = useCallback((execId: string): ExecutionEvent[] => {
    return state.currentExecutions.get(execId) || [];
  }, [state.currentExecutions]);

  const getRunningExecutions = useCallback((): string[] => {
    const running: string[] = [];
    for (const [execId, events] of state.currentExecutions) {
      const lastEvent = events[events.length - 1];
      if (lastEvent && lastEvent.type !== 'execution_complete' && lastEvent.type !== 'execution_failed') {
        running.push(execId);
      }
    }
    return running;
  }, [state.currentExecutions]);

  return {
    ...state,
    connect,
    disconnect,
    clearEvents,
    getExecutionEvents,
    getRunningExecutions,
  };
}

/**
 * Cancel a running execution
 */
export async function cancelExecution(executionId: string, agentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stream/cancel/${executionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    const result = await res.json();
    return result.success;
  } catch (err) {
    console.error('Failed to cancel execution:', err);
    return false;
  }
}
