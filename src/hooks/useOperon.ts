import { useCallback, useRef, useState } from 'react';
import { queryOperon, type OperonQueryResult, type OperonQueryOptions, type OperonAction } from '../services/operon/api';

export type OperonMessageRole = 'user' | 'operon';

export interface OperonMessage {
  id: string;
  role: OperonMessageRole;
  text: string;
  timestamp: string;
  actions?: OperonAction[];
}

export interface PendingAction {
  action: OperonAction;
  resultId: string;
}

interface UseOperonState {
  messages: OperonMessage[];
  lastResult: OperonQueryResult | null;
  loading: boolean;
  error: string | null;
  pendingAction: PendingAction | null;
  sendMessage: (text: string, options?: OperonQueryOptions) => Promise<OperonQueryResult | null>;
  clearPendingAction: () => void;
}

export function useOperon(initialMessages: OperonMessage[] = []): UseOperonState {
  const [messages, setMessages] = useState<OperonMessage[]>(initialMessages);
  const [lastResult, setLastResult] = useState<OperonQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const loadingRef = useRef(false);

  const sendMessage = useCallback(async (text: string, options?: OperonQueryOptions): Promise<OperonQueryResult | null> => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return null;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const userMessage: OperonMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const result = await queryOperon(trimmed, options);

      const operonMessage: OperonMessage = {
        id: result.id,
        role: 'operon',
        text: result.reply,
        timestamp: result.timestamp,
        actions: result.actions,
      };

      setMessages(prev => [...prev, operonMessage]);
      setLastResult(result);

      const awaitingConfirmation = result.actions.find(a => a.status === 'awaiting_confirmation');
      if (awaitingConfirmation) {
        setPendingAction({ action: awaitingConfirmation, resultId: result.id });
      } else {
        setPendingAction(null);
      }

      return result;
    } catch (err: any) {
      const message = err?.message || 'Operon request failed';
      setError(message);
      return null;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const clearPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    messages,
    lastResult,
    loading,
    error,
    pendingAction,
    sendMessage,
    clearPendingAction,
  };
}
