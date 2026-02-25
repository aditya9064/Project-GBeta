import { useState, useRef, useCallback, useEffect } from 'react';

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export type WakeWordStatus = 'inactive' | 'listening' | 'detected' | 'unsupported';

interface UseWakeWordOptions {
  wakePhrase?: string;
  onWake: () => void;
}

interface UseWakeWordReturn {
  status: WakeWordStatus;
  start: () => void;
  stop: () => void;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const WAKE_VARIANTS = [
  'hey operon',
  'hey opperon',
  'hey operan',
  'hey operron',
  'hey open',
  'hey opera',
  'a operon',
  'hay operon',
  'hey op ron',
];

export function useWakeWord(options: UseWakeWordOptions): UseWakeWordReturn {
  const { wakePhrase = 'hey operon', onWake } = options;
  const [status, setStatus] = useState<WakeWordStatus>(
    SpeechRecognition ? 'inactive' : 'unsupported'
  );

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  const allPhrases = useRef([normalise(wakePhrase), ...WAKE_VARIANTS]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition || activeRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        for (let alt = 0; alt < event.results[i].length; alt++) {
          const transcript = normalise(event.results[i][alt].transcript);
          const matched = allPhrases.current.some(
            (phrase) => transcript.includes(phrase)
          );

          if (matched) {
            setStatus('detected');
            recognition.stop();
            activeRef.current = false;
            onWakeRef.current();
            return;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setStatus('unsupported');
        activeRef.current = false;
        return;
      }
      // For transient errors (network, no-speech), restart automatically
      if (activeRef.current) {
        setTimeout(() => {
          if (activeRef.current) startListening();
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Restart if we're still supposed to be listening
      if (activeRef.current) {
        setTimeout(() => {
          if (activeRef.current) startListening();
        }, 100);
      }
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    setStatus('listening');
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setStatus('inactive');
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { status, start: startListening, stop: stopListening };
}
