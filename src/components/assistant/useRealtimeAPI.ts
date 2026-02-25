import { useState, useRef, useCallback, useEffect } from 'react';
import type { AssistantStatus, ConversationEntry } from './types';
import { buildToolsForSession } from './tools';

const SESSION_ENDPOINT = '/api/realtime/session';

interface UseRealtimeAPIOptions {
  onFunctionCall?: (name: string, args: Record<string, unknown>, callId: string) => Promise<unknown>;
  onTranscript?: (text: string, role: 'user' | 'assistant') => void;
  onError?: (error: string) => void;
  onDisconnect?: () => void;
  onIdle?: () => void;
  systemPrompt?: string;
  alwaysListening?: boolean;
}

interface UseRealtimeAPIReturn {
  status: AssistantStatus;
  conversation: ConversationEntry[];
  startSession: () => Promise<void>;
  endSession: () => void;
  isConnected: boolean;
  error: string | null;
}

let entryIdCounter = 0;
function makeEntryId() {
  return `entry-${Date.now()}-${++entryIdCounter}`;
}

export function useRealtimeAPI(options: UseRealtimeAPIOptions = {}): UseRealtimeAPIReturn {
  const { onFunctionCall, onTranscript, onError, onDisconnect, onIdle, systemPrompt, alwaysListening } = options;

  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pendingFunctionCalls = useRef<Map<string, { name: string; args: string }>>(new Map());
  const functionCallBuffers = useRef<Map<string, string>>(new Map());

  const addConversationEntry = useCallback((entry: Omit<ConversationEntry, 'id' | 'timestamp'>) => {
    const full: ConversationEntry = { ...entry, id: makeEntryId(), timestamp: Date.now() };
    setConversation((prev) => [...prev, full]);
    return full;
  }, []);

  const updateConversationEntry = useCallback((id: string, updates: Partial<ConversationEntry>) => {
    setConversation((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }, []);

  const handleServerEvent = useCallback(
    async (event: any) => {
      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          break;

        case 'conversation.item.input_audio_transcription.completed': {
          const text = event.transcript?.trim();
          if (text) {
            addConversationEntry({ role: 'user', type: 'transcript', text });
            onTranscript?.(text, 'user');
          }
          break;
        }

        case 'response.audio_transcript.delta':
          break;

        case 'response.audio_transcript.done': {
          const text = event.transcript?.trim();
          if (text) {
            addConversationEntry({ role: 'assistant', type: 'transcript', text });
            onTranscript?.(text, 'assistant');
          }
          break;
        }

        case 'response.audio.done':
          if (alwaysListening) {
            setStatus('listening');
          } else {
            setStatus('idle');
            onIdle?.();
          }
          break;

        case 'response.function_call_arguments.delta': {
          const callId = event.call_id;
          if (callId) {
            const current = functionCallBuffers.current.get(callId) || '';
            functionCallBuffers.current.set(callId, current + (event.delta || ''));
          }
          break;
        }

        case 'response.function_call_arguments.done': {
          const callId = event.call_id;
          const name = event.name;
          const argsStr = event.arguments || functionCallBuffers.current.get(callId) || '{}';
          functionCallBuffers.current.delete(callId);

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(argsStr);
          } catch {
            args = {};
          }

          setStatus('processing');

          const entry = addConversationEntry({
            role: 'assistant',
            type: 'action',
            text: `Running ${name}...`,
            action: { tool: name, args, status: 'running' },
          });

          try {
            const result = onFunctionCall
              ? await onFunctionCall(name, args, callId)
              : { success: false, error: 'No handler registered' };

            updateConversationEntry(entry.id, {
              text: `Completed ${name}`,
              action: { tool: name, args, result, status: 'success' },
            });

            if (dcRef.current?.readyState === 'open') {
              dcRef.current.send(
                JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify(result),
                  },
                })
              );
              dcRef.current.send(JSON.stringify({ type: 'response.create' }));
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Tool execution failed';
            updateConversationEntry(entry.id, {
              text: `Failed: ${name}`,
              action: { tool: name, args, result: errorMsg, status: 'error' },
            });

            if (dcRef.current?.readyState === 'open') {
              dcRef.current.send(
                JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({ success: false, error: errorMsg }),
                  },
                })
              );
              dcRef.current.send(JSON.stringify({ type: 'response.create' }));
            }
          }
          break;
        }

        case 'response.created':
          setStatus('processing');
          break;

        case 'response.output_item.added':
          if (event.item?.type === 'message') {
            setStatus('speaking');
          }
          break;

        case 'response.done':
          if (alwaysListening) {
            setStatus((prev) => (prev === 'speaking' ? prev : 'listening'));
          } else {
            setStatus((prev) => {
              if (prev === 'speaking') return prev;
              onIdle?.();
              return 'idle';
            });
          }
          break;

        case 'input_audio_buffer.speech_started':
          setStatus('listening');
          break;

        case 'input_audio_buffer.speech_stopped':
          setStatus('processing');
          break;

        case 'error': {
          const msg = event.error?.message || 'Unknown error';
          setError(msg);
          setStatus('error');
          onError?.(msg);
          addConversationEntry({ role: 'assistant', type: 'error', text: msg });
          break;
        }
      }
    },
    [addConversationEntry, updateConversationEntry, onFunctionCall, onTranscript, onError, onIdle, alwaysListening]
  );

  const startSession = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.addEventListener('open', () => {
        const tools = buildToolsForSession();
        const sessionUpdate: any = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: systemPrompt || buildSystemPrompt(),
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            tools,
          },
        };
        dc.send(JSON.stringify(sessionUpdate));
        setStatus('listening');
      });

      dc.addEventListener('message', (e) => {
        try {
          const event = JSON.parse(e.data);
          handleServerEvent(event);
        } catch {
          // ignore malformed events
        }
      });

      dc.addEventListener('close', () => {
        setStatus('idle');
        if (alwaysListening) onDisconnect?.();
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(SESSION_ENDPOINT, {
        method: 'POST',
        body: offer.sdp,
        headers: { 'Content-Type': 'application/sdp' },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Session creation failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          endSession();
          if (alwaysListening) onDisconnect?.();
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [handleServerEvent, onError, onDisconnect, systemPrompt, alwaysListening]);

  const endSession = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    functionCallBuffers.current.clear();
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return {
    status,
    conversation,
    startSession,
    endSession,
    isConnected: status !== 'idle' && status !== 'error' && status !== 'connecting',
    error,
  };
}

function buildSystemPrompt(): string {
  return `You are Operon, the AI assistant for OperonAI — an AI agent workforce platform.
The user activated you by saying "Hey Operon". Respond immediately to whatever they say next.

You help users manage their AI agents, workflows, communications, and documents through voice commands.

CAPABILITIES:
- Navigate the app (agents page, workflow builder, communications, documents, sales, logs, settings)
- Deploy AI agents from the catalog (document generators, email agents, sales intelligence, etc.)
- Search and filter deployed agents by name, status, or category
- Read and reply to emails and messages
- Run deployed agents

BEHAVIOR:
- Be concise and direct. Users are busy professionals.
- When a request is ambiguous, use ask_clarification to ask which option they want.
- When an action is destructive (deleting, stopping), confirm with the user first.
- After performing an action, briefly confirm what you did.
- If a tool call fails, explain the error simply and suggest alternatives.
- When reading emails, give a brief summary rather than reading the entire content.
- Speak naturally — you're a voice assistant, not a text bot.
- After completing a request, end your response. The session will close and the user will say "Hey Operon" again for the next request.

EXAMPLES:
- "Go to communications" → navigate_to_page(page: "comms")
- "Deploy the invoice generator" → deploy_agent(agent_name: "Invoice Package Generator")
- "Show me my running agents" → search_agents(query: "", status_filter: "running")
- "Read my latest emails" → read_emails(count: 5)
- "Reply to John saying I'll be there" → find the email from John first, then reply
- "Deploy an agent" (ambiguous) → ask_clarification(question: "Which agent would you like to deploy?")`;
}
