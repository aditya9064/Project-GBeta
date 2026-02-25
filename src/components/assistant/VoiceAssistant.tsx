import { useState, useCallback, useEffect, useRef } from 'react';
import { useRealtimeAPI } from './useRealtimeAPI';
import { useWakeWord } from './useWakeWord';
import { AssistantOrb } from './AssistantOrb';
import { executeToolCall, registerAppActions, unregisterAppActions } from './ActionExecutor';
import type { AppActions } from './ActionExecutor';

interface VoiceAssistantProps {
  appActions: AppActions;
}

export function VoiceAssistant({ appActions }: VoiceAssistantProps) {
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const transcriptTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  const sessionActiveRef = useRef(false);

  useEffect(() => {
    registerAppActions(appActions);
    return () => unregisterAppActions();
  }, [appActions]);

  const handleFunctionCall = useCallback(
    async (name: string, args: Record<string, unknown>, _callId: string) => {
      return executeToolCall(name, args);
    },
    []
  );

  const handleTranscript = useCallback((text: string, _role: 'user' | 'assistant') => {
    setLastTranscript(text);
    if (transcriptTimer.current) clearTimeout(transcriptTimer.current);
    transcriptTimer.current = setTimeout(() => setLastTranscript(null), 6000);
  }, []);

  const handleSessionIdle = useCallback(() => {
    if (sessionActiveRef.current && mountedRef.current) {
      sessionActiveRef.current = false;
      endSession();
      if (!muted) wakeWord.start();
    }
  }, [muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDisconnect = useCallback(() => {
    sessionActiveRef.current = false;
    if (!muted && mountedRef.current) {
      wakeWord.start();
    }
  }, [muted]); // eslint-disable-line react-hooks/exhaustive-deps

  const { status, startSession, endSession, isConnected, error } =
    useRealtimeAPI({
      onFunctionCall: handleFunctionCall,
      onTranscript: handleTranscript,
      onError: (err) => console.error('Assistant error:', err),
      onDisconnect: handleDisconnect,
      onIdle: handleSessionIdle,
      alwaysListening: false,
    });

  const handleWake = useCallback(() => {
    if (sessionActiveRef.current) return;
    sessionActiveRef.current = true;
    startSession();
  }, [startSession]);

  const wakeWord = useWakeWord({
    wakePhrase: 'hey operon',
    onWake: handleWake,
  });

  // Start wake word listening on mount
  useEffect(() => {
    mountedRef.current = true;
    if (!muted) {
      wakeWord.start();
    }
    return () => {
      mountedRef.current = false;
      wakeWord.stop();
      endSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        wakeWord.stop();
        endSession();
        sessionActiveRef.current = false;
        setLastTranscript(null);
      } else {
        wakeWord.start();
      }
      return next;
    });
  }, [endSession, wakeWord]);

  // Determine the visual status shown to the user
  const displayStatus = (() => {
    if (muted) return 'idle' as const;
    if (sessionActiveRef.current) return status;
    if (wakeWord.status === 'listening') return 'wake-listening' as const;
    if (wakeWord.status === 'detected') return 'connecting' as const;
    if (wakeWord.status === 'unsupported') return 'error' as const;
    return 'idle' as const;
  })();

  return (
    <AssistantOrb
      status={displayStatus}
      onActivate={handleToggleMute}
      onDismiss={handleToggleMute}
      lastTranscript={lastTranscript}
      error={wakeWord.status === 'unsupported' ? 'Speech recognition not supported in this browser' : error}
      alwaysListening={!muted}
    />
  );
}
