import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionType = typeof window.SpeechRecognition | typeof window.webkitSpeechRecognition;

export type VoiceState = 'off' | 'idle' | 'wake_detected' | 'capturing' | 'processing' | 'responding';

const WAKE_PHRASES = ['operon', 'hey operon', 'ok operon', 'a operon', 'hey operator', 'hey auburn'];
const SILENCE_TIMEOUT_MS = 1800;
const WAKE_CHIME_FREQ = 880;
const DONE_CHIME_FREQ = 660;

function playChime(frequency: number, duration = 120, volume = 0.15): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);

    setTimeout(() => ctx.close(), duration + 100);
  } catch {
    // Audio not available
  }
}

function playWakeChime(): void {
  playChime(WAKE_CHIME_FREQ, 100, 0.12);
  setTimeout(() => playChime(WAKE_CHIME_FREQ * 1.5, 150, 0.1), 100);
}

function playDoneChime(): void {
  playChime(DONE_CHIME_FREQ * 1.2, 100, 0.08);
  setTimeout(() => playChime(DONE_CHIME_FREQ, 150, 0.06), 100);
}

function detectWakeWord(text: string): { found: boolean; command: string } {
  const lower = text.toLowerCase().trim();

  for (const phrase of WAKE_PHRASES) {
    if (lower.startsWith(phrase)) {
      const rest = lower.slice(phrase.length).trim();
      const cleanRest = rest.replace(/^[,.\s]+/, '').trim();
      return { found: true, command: cleanRest };
    }
  }

  return { found: false, command: '' };
}

interface UseOperonVoiceState {
  voiceState: VoiceState;
  supported: boolean;
  error: string | null;
  interimTranscript: string | null;
  capturedCommand: string | null;
  activate: () => void;
  deactivate: () => void;
  setProcessing: () => void;
  setResponding: (text: string) => void;
  finishResponding: () => void;
  speak: (text: string) => void;
}

export function useOperonVoice(): UseOperonVoiceState {
  const [voiceState, setVoiceState] = useState<VoiceState>('off');
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string | null>(null);
  const [capturedCommand, setCapturedCommand] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pendingUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const shouldBeListeningRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>('off');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedTextRef = useRef<string>('');
  const lastSpeechTimeRef = useRef<number>(0);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const updateState = useCallback((state: VoiceState) => {
    voiceStateRef.current = state;
    setVoiceState(state);
  }, []);

  const submitCommand = useCallback((text: string) => {
    if (!text.trim()) return;

    clearSilenceTimer();
    setCapturedCommand(text.trim());

    window.dispatchEvent(
      new CustomEvent('operon-voice-result', {
        detail: { text: text.trim() },
      }),
    );

    playDoneChime();
    updateState('processing');
    setInterimTranscript(null);
    capturedTextRef.current = '';
  }, [clearSilenceTimer, updateState]);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (voiceStateRef.current === 'capturing' && capturedTextRef.current.trim()) {
        submitCommand(capturedTextRef.current);
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, submitCommand]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSupported(false);
      return;
    }

    const SpeechRecognitionCtor = (window.SpeechRecognition ||
      window.webkitSpeechRecognition) as SpeechRecognitionType | undefined;

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const current = voiceStateRef.current;

      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      lastSpeechTimeRef.current = Date.now();

      if (current === 'idle') {
        const allText = (finalText + ' ' + interimText).trim();
        const { found, command } = detectWakeWord(allText);

        if (found) {
          playWakeChime();
          updateState('wake_detected');
          setInterimTranscript(null);

          setTimeout(() => {
            if (command) {
              capturedTextRef.current = command;
              setInterimTranscript(command);
              updateState('capturing');
              startSilenceTimer();
            } else {
              updateState('capturing');
              capturedTextRef.current = '';
            }
          }, 200);
          return;
        }

        if (interimText) {
          const { found: interimFound } = detectWakeWord(interimText);
          if (interimFound) {
            setInterimTranscript('...');
          }
        }
        return;
      }

      if (current === 'capturing' || current === 'wake_detected') {
        if (current === 'wake_detected') {
          updateState('capturing');
        }

        if (interimText) {
          capturedTextRef.current = (finalText + ' ' + interimText).trim();
          setInterimTranscript(capturedTextRef.current);
          startSilenceTimer();
        }

        if (finalText.trim()) {
          capturedTextRef.current = finalText.trim();
          setInterimTranscript(capturedTextRef.current);
          startSilenceTimer();
        }
        return;
      }
    };

    recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setError('Microphone access denied.');
        shouldBeListeningRef.current = false;
        updateState('off');
      } else if (ev.error === 'no-speech' || ev.error === 'aborted') {
        // Normal — silence or intentional stop
      } else {
        setError(ev.error || 'Speech recognition error.');
      }
    };

    recognition.onend = () => {
      if (shouldBeListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setError('Failed to resume microphone.');
          shouldBeListeningRef.current = false;
          updateState('off');
        }
      } else {
        updateState('off');
      }
    };

    recognitionRef.current = recognition as SpeechRecognition;

    return () => {
      shouldBeListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [updateState, startSilenceTimer]);

  const activate = useCallback(() => {
    if (!supported || !recognitionRef.current) return;

    if (voiceStateRef.current !== 'off') return;

    setError(null);
    setInterimTranscript(null);
    setCapturedCommand(null);
    capturedTextRef.current = '';

    try {
      shouldBeListeningRef.current = true;
      recognitionRef.current.start();
      updateState('idle');
    } catch {
      setError('Failed to start microphone.');
      shouldBeListeningRef.current = false;
      updateState('off');
    }
  }, [supported, updateState]);

  const deactivate = useCallback(() => {
    shouldBeListeningRef.current = false;
    clearSilenceTimer();
    recognitionRef.current?.stop();
    updateState('off');
    setInterimTranscript(null);
    setCapturedCommand(null);
    capturedTextRef.current = '';
  }, [clearSilenceTimer, updateState]);

  const setProcessing = useCallback(() => {
    updateState('processing');
    clearSilenceTimer();
  }, [updateState, clearSilenceTimer]);

  const setResponding = useCallback((text: string) => {
    updateState('responding');
    speak(text);
  }, [updateState]);

  const finishResponding = useCallback(() => {
    if (shouldBeListeningRef.current) {
      updateState('idle');
      setInterimTranscript(null);
      setCapturedCommand(null);
      capturedTextRef.current = '';
    } else {
      updateState('off');
    }
  }, [updateState]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!text?.trim()) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.05;
    utterance.pitch = 1;

    utterance.onend = () => {
      if (voiceStateRef.current === 'responding') {
        finishResponding();
      }
    };

    pendingUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [finishResponding]);

  return {
    voiceState,
    supported,
    error,
    interimTranscript,
    capturedCommand,
    activate,
    deactivate,
    setProcessing,
    setResponding,
    finishResponding,
    speak,
  };
}
