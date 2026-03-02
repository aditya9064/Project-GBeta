import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertCircle, Mic, MicOff, Volume2, VolumeX,
  Send, X, MessageSquare, ChevronDown, Check, XCircle,
} from 'lucide-react';
import { useOperon } from '../../hooks/useOperon';
import { useOperonVoice, type VoiceState } from '../../hooks/useOperonVoice';
import type { OperonAction } from '../../services/operon/api';

export interface OperonCallbacks {
  navigate: (tab: string) => void;
  createAgentFromPrompt: (prompt: string) => Promise<{ success: boolean; agent?: any; error?: string }>;
  runAgent: (agentId: string) => void;
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  openCatalog: () => void;
  getAgents: () => Array<{ id: string; name: string; status: string; description?: string }>;
  getCurrentTab: () => string;
}

interface OperonConsoleProps {
  userId?: string;
  callbacks?: OperonCallbacks;
}

interface McqPopup {
  question: string;
  options: string[];
}

const STATE_LABELS: Record<VoiceState, string> = {
  off: 'Click mic to activate',
  idle: 'Listening for "Hey Operon"...',
  wake_detected: 'Yes?',
  capturing: '',
  processing: 'Thinking...',
  responding: 'Speaking...',
};

export function OperonConsole({ userId, callbacks }: OperonConsoleProps) {
  const { messages, loading, error, pendingAction, sendMessage, clearPendingAction } = useOperon();
  const voice = useOperonVoice();
  const [input, setInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [mcqPopup, setMcqPopup] = useState<McqPopup | null>(null);
  const [otherInput, setOtherInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenIdRef = useRef<string | null>(null);
  const lastProcessedResultRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, expanded]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'operon') return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    if (voiceEnabled && voice.voiceState !== 'off') {
      voice.setResponding(last.text);
    }
  }, [messages, voiceEnabled, voice]);

  useEffect(() => {
    if (loading && voice.voiceState === 'capturing') {
      voice.setProcessing();
    }
  }, [loading, voice]);

  const buildContext = useCallback(() => {
    if (!callbacks) return undefined;
    const agents = callbacks.getAgents();
    return {
      currentTab: callbacks.getCurrentTab(),
      deployedAgents: agents.map(a => ({
        id: a.id, name: a.name, status: a.status, description: a.description,
      })),
      agentCount: agents.length,
    };
  }, [callbacks]);

  const resolveAgentId = useCallback((params: Record<string, any>): string | null => {
    if (params.agentId) return params.agentId;
    if (params.agentName && callbacks) {
      const agents = callbacks.getAgents();
      const match = agents.find(a =>
        a.name.toLowerCase().includes(params.agentName.toLowerCase())
      );
      return match?.id || null;
    }
    return null;
  }, [callbacks]);

  const executeAction = useCallback(async (action: OperonAction) => {
    if (!callbacks) return;
    try {
      switch (action.type) {
        case 'navigate': {
          const tab = action.params.tab;
          if (tab) { callbacks.navigate(tab); setActionStatus(`Navigated to ${tab}`); }
          break;
        }
        case 'create_agent': {
          const prompt = action.params.prompt;
          if (prompt) {
            setActionStatus('Creating agent...');
            const result = await callbacks.createAgentFromPrompt(prompt);
            setActionStatus(result.success ? `Agent "${result.agent?.name || 'New Agent'}" created!` : `Failed: ${result.error}`);
          }
          break;
        }
        case 'run_agent': {
          const id = resolveAgentId(action.params);
          if (id) { callbacks.runAgent(id); setActionStatus('Running agent...'); }
          else setActionStatus('Agent not found');
          break;
        }
        case 'pause_agent': {
          const id = resolveAgentId(action.params);
          if (id) { await callbacks.pauseAgent(id); setActionStatus('Agent paused'); }
          break;
        }
        case 'resume_agent': {
          const id = resolveAgentId(action.params);
          if (id) { await callbacks.resumeAgent(id); setActionStatus('Agent resumed'); }
          break;
        }
        case 'delete_agent': {
          const id = resolveAgentId(action.params);
          if (id) { await callbacks.deleteAgent(id); setActionStatus('Agent deleted'); }
          break;
        }
        case 'open_catalog': {
          callbacks.openCatalog();
          setActionStatus('Catalog opened');
          break;
        }
        default: break;
      }
    } catch (err: any) {
      setActionStatus(`Error: ${err.message || 'Action failed'}`);
    }
    setTimeout(() => setActionStatus(null), 3000);
  }, [callbacks, resolveAgentId]);

  const processResult = useCallback(async (result: any) => {
    if (!result || lastProcessedResultRef.current === result.id) return;
    lastProcessedResultRef.current = result.id;

    const actions: OperonAction[] = result.actions || [];

    // Check for clarification — show MCQ popup
    const clarification = actions.find((a: OperonAction) => a.type === 'ask_clarification');
    if (clarification) {
      const question = clarification.params.question || result.reply || 'What would you like to do?';
      let options: string[] = Array.isArray(clarification.params.options) ? clarification.params.options : [];
      if (options.length === 0) options = ['Option 1', 'Option 2', 'Option 3'];
      if (!options.some(o => o.toLowerCase().includes('other'))) {
        options.push('Other...');
      }
      setMcqPopup({ question, options });
      return;
    }

    // Auto-execute safe actions
    const autoActions = actions.filter(
      (a: OperonAction) => a.status === 'planned' && ['navigate', 'open_catalog'].includes(a.type)
    );
    for (const action of autoActions) await executeAction(action);
  }, [executeAction]);

  const doSend = useCallback(async (text: string) => {
    const context = buildContext();
    const result = await sendMessage(text, { userId, context });
    if (result) await processResult(result);
  }, [sendMessage, userId, buildContext, processResult]);

  // Voice result handler
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string }>).detail;
      if (!detail?.text) return;
      void doSend(detail.text);
    };
    window.addEventListener('operon-voice-result', handler as EventListener);
    return () => window.removeEventListener('operon-voice-result', handler as EventListener);
  }, [doSend]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await doSend(text);
  };

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    await executeAction(pendingAction.action);
    clearPendingAction();
  }, [pendingAction, executeAction, clearPendingAction]);

  const handleDeny = useCallback(async () => {
    clearPendingAction();
    await doSend('cancel');
  }, [clearPendingAction, doSend]);

  const handleMcqSelect = useCallback(async (option: string) => {
    if (option.toLowerCase() === 'other...') return;
    setMcqPopup(null);
    await doSend(option);
  }, [doSend]);

  const handleMcqOtherSubmit = useCallback(async () => {
    if (!otherInput.trim()) return;
    const text = otherInput.trim();
    setOtherInput('');
    setMcqPopup(null);
    await doSend(text);
  }, [otherInput, doSend]);

  const handleMcqDismiss = useCallback(() => {
    setMcqPopup(null);
  }, []);

  const handleMicToggle = useCallback(() => {
    if (voice.voiceState === 'off') voice.activate();
    else voice.deactivate();
  }, [voice]);

  const statusText = (): string => {
    if (actionStatus) return actionStatus;
    if (loading) return 'Thinking...';
    if (error || voice.error) return error || voice.error || '';
    if (voice.voiceState === 'capturing' && voice.interimTranscript) return voice.interimTranscript;
    if (voice.voiceState !== 'off') return STATE_LABELS[voice.voiceState];
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'operon') return last.text;
    }
    return STATE_LABELS.off;
  };

  const isAlwaysOn = voice.voiceState !== 'off';
  const isActive = voice.voiceState === 'wake_detected' || voice.voiceState === 'capturing';
  const isWorking = voice.voiceState === 'processing' || loading;
  const isResponding = voice.voiceState === 'responding';

  return (
    <div className="operon-voice-wrapper">
      <div className={`operon-voice-bar ${isActive ? 'active' : ''} ${isWorking ? 'working' : ''} ${isResponding ? 'responding' : ''} ${isAlwaysOn ? 'always-on' : ''} ${actionStatus ? 'action-done' : ''}`}>
        {isActive && <div className="operon-voice-bar-glow" />}

        <div className="operon-voice-bar-content">
          {voice.supported && (
            <button
              type="button"
              className={`operon-vb-mic ${isAlwaysOn ? 'on' : ''} ${isActive ? 'active' : ''} ${voice.voiceState === 'wake_detected' ? 'wake' : ''}`}
              onClick={handleMicToggle}
              aria-label={isAlwaysOn ? 'Deactivate voice' : 'Activate voice'}
            >
              {isAlwaysOn ? <Mic size={16} /> : <MicOff size={16} />}
              {isActive && <span className="operon-vb-mic-pulse" />}
              {voice.voiceState === 'idle' && <span className="operon-vb-mic-idle-ring" />}
            </button>
          )}

          <div className="operon-vb-status">
            {isWorking && <Loader2 size={14} className="operon-vb-spinner" />}
            {(error || voice.error) && !isWorking && <AlertCircle size={14} className="operon-vb-error-icon" />}
            <span className={`operon-vb-text ${isActive ? 'transcript' : ''} ${actionStatus ? 'action-status' : ''} ${voice.voiceState === 'idle' ? 'idle-hint' : ''}`}>
              {statusText()}
            </span>
          </div>

          {pendingAction && (
            <div className="operon-vb-confirm">
              <button className="operon-vb-confirm-yes" onClick={handleConfirm} title="Confirm">
                <Check size={14} /> Yes
              </button>
              <button className="operon-vb-confirm-no" onClick={handleDeny} title="Cancel">
                <XCircle size={14} /> No
              </button>
            </div>
          )}

          {!pendingAction && !isActive && (
            <form className="operon-vb-input-form" onSubmit={handleSubmit}>
              <input
                className="operon-vb-input"
                placeholder="Ask Operon..."
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="operon-vb-send" disabled={loading || !input.trim()}>
                <Send size={14} />
              </button>
            </form>
          )}

          <div className="operon-vb-controls">
            <button
              type="button"
              className={`operon-vb-ctrl ${voiceEnabled ? 'on' : ''}`}
              onClick={() => setVoiceEnabled(v => !v)}
              title={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              type="button"
              className={`operon-vb-ctrl ${expanded ? 'on' : ''}`}
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Close chat' : 'Open chat'}
            >
              {expanded ? <ChevronDown size={14} /> : <MessageSquare size={14} />}
              {messages.length > 0 && !expanded && (
                <span className="operon-vb-badge">{messages.length}</span>
              )}
            </button>
          </div>
        </div>

        {isActive && <div className="operon-voice-bar-wave" />}
        {voice.voiceState === 'idle' && <div className="operon-voice-bar-idle" />}
        {isResponding && <div className="operon-voice-bar-responding" />}
      </div>

      {/* ── MCQ Popup ── */}
      {mcqPopup && (
        <div className="operon-mcq-overlay" onClick={handleMcqDismiss}>
          <div className="operon-mcq-popup" onClick={e => e.stopPropagation()}>
            <div className="operon-mcq-header">
              <div className="operon-mcq-icon">?</div>
              <h3 className="operon-mcq-question">{mcqPopup.question}</h3>
              <button className="operon-mcq-close" onClick={handleMcqDismiss}>
                <X size={16} />
              </button>
            </div>
            <div className="operon-mcq-options">
              {mcqPopup.options.map((option, i) => {
                const isOther = option.toLowerCase().includes('other');
                return (
                  <div key={i} className="operon-mcq-option-wrapper">
                    <button
                      className={`operon-mcq-option ${isOther ? 'other' : ''}`}
                      onClick={() => handleMcqSelect(option)}
                    >
                      <span className="operon-mcq-option-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="operon-mcq-option-text">{option}</span>
                    </button>
                    {isOther && (
                      <div className="operon-mcq-other-input">
                        <input
                          type="text"
                          placeholder="Type your answer..."
                          value={otherInput}
                          onChange={e => setOtherInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleMcqOtherSubmit()}
                          autoFocus
                        />
                        <button
                          className="operon-mcq-other-send"
                          onClick={handleMcqOtherSubmit}
                          disabled={!otherInput.trim()}
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Chat panel ── */}
      {expanded && (
        <div className="operon-chat-panel">
          <div className="operon-chat-header">
            <span className="operon-chat-title">Operon Chat</span>
            <button className="operon-chat-close" onClick={() => setExpanded(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="operon-chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="operon-chat-empty">
                <p>No messages yet. Say "Hey Operon" or type a question.</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`operon-chat-msg ${msg.role}`}>
                {msg.role === 'operon' && <div className="operon-chat-avatar">O</div>}
                <div className="operon-chat-bubble">
                  {msg.text}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="operon-chat-actions">
                      {msg.actions.map(a => (
                        <span key={a.id} className={`operon-chat-action-tag ${a.type}`}>
                          {a.type.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="operon-chat-msg operon">
                <div className="operon-chat-avatar">O</div>
                <div className="operon-chat-bubble operon-chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
