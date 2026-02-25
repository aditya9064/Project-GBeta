import { useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { AssistantStatus } from './types';
import './Assistant.css';

type DisplayStatus = AssistantStatus | 'wake-listening';

interface AssistantOrbProps {
  status: DisplayStatus;
  onActivate: () => void;
  onDismiss: () => void;
  lastTranscript: string | null;
  error: string | null;
  alwaysListening?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  idle: '',
  'wake-listening': 'Say "Hey Operon"',
  connecting: 'Connecting...',
  listening: 'Listening...',
  processing: 'Thinking...',
  speaking: 'Speaking...',
  error: '',
};

export function AssistantOrb({ status, onActivate, onDismiss, lastTranscript, error, alwaysListening }: AssistantOrbProps) {
  const showOverlay = status === 'processing' || status === 'speaking' || status === 'listening' || status === 'connecting';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        onActivate();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onActivate]);

  // Muted state
  if (status === 'idle' && alwaysListening === false) {
    return (
      <button
        className="assistant-trigger muted"
        onClick={onActivate}
        aria-label="Voice assistant is muted — click to unmute"
        title="Voice assistant is muted — click to unmute"
      >
        <MicOff size={20} />
      </button>
    );
  }

  // Wake-word listening — ambient indicator showing it's waiting for "Hey Operon"
  if (status === 'wake-listening') {
    return (
      <>
        <button
          className="assistant-trigger ambient wake-listening"
          onClick={onDismiss}
          aria-label='Say "Hey Operon" — click to mute'
          title='Say "Hey Operon" — click to mute'
        >
          <Mic size={20} />
          <span className="assistant-trigger-pulse" />
        </button>

        {lastTranscript && (
          <div className="assistant-ambient-transcript">
            {lastTranscript}
          </div>
        )}
      </>
    );
  }

  // Active overlay for connecting / listening / processing / speaking
  if (showOverlay) {
    return (
      <div className="assistant-overlay">
        <div className="assistant-overlay-backdrop" />

        <div className="assistant-orb-container">
          <div className={`assistant-orb-ring ring-1 ${status}`} />
          <div className={`assistant-orb-ring ring-2 ${status}`} />
          <div className={`assistant-orb-ring ring-3 ${status}`} />

          <button className={`assistant-orb ${status}`} onClick={onDismiss}>
            <div className="assistant-orb-inner">
              {status === 'listening' && (
                <div className="assistant-orb-bars">
                  <span /><span /><span /><span /><span />
                </div>
              )}
              {status === 'speaking' && (
                <div className="assistant-orb-bars speaking">
                  <span /><span /><span /><span /><span />
                </div>
              )}
              {(status === 'processing' || status === 'connecting') && (
                <div className="assistant-orb-dots">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </button>

          <div className={`assistant-orb-label ${status}`}>
            {STATUS_LABELS[status] || ''}
          </div>

          {lastTranscript && (
            <div className="assistant-orb-transcript">
              {lastTranscript}
            </div>
          )}

          {error && (
            <div className="assistant-orb-error">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state — show as ambient with error styling
  if (status === 'error') {
    return (
      <>
        <button
          className="assistant-trigger ambient error"
          onClick={onDismiss}
          aria-label="Voice assistant error — click to mute"
          title={error || 'Voice assistant error'}
        >
          <Mic size={20} />
        </button>
        {error && (
          <div className="assistant-ambient-transcript">
            {error}
          </div>
        )}
      </>
    );
  }

  // Fallback idle
  return (
    <button
      className="assistant-trigger"
      onClick={onActivate}
      aria-label="Voice assistant (Space)"
      title="Voice assistant (Space)"
    >
      <Mic size={20} />
    </button>
  );
}
