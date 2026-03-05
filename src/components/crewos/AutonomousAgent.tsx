import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Square,
  ChevronDown,
  ChevronRight,
  Wrench,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Coins,
  Zap,
  RotateCcw,
  User,
  ArrowLeft,
} from 'lucide-react';
import { useAutonomousAgent, type ExecutionStep, type ChatMessage } from '../../hooks/useAutonomousAgent';
import './AutonomousAgent.css';

const SUGGESTIONS = [
  'Read my latest emails and summarize the urgent ones',
  'Search the web for the latest AI news and write a brief',
  'Draft a follow-up email to my last meeting attendees',
  'Analyze my recent Slack messages and list action items',
];

export function AutonomousAgent({ onClose }: { onClose?: () => void } = {}) {
  const agent = useAutonomousAgent();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [agent.messages, agent.currentSteps, scrollToBottom]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (agent.status === 'awaiting_user') {
      agent.sendMessage(trimmed);
    } else if (agent.status === 'idle' || agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled') {
      agent.sendGoal(trimmed);
    }
    setInput('');
  }, [input, agent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSuggestion = useCallback((suggestion: string) => {
    agent.sendGoal(suggestion);
  }, [agent]);

  const isInputDisabled = agent.status === 'running' || agent.status === 'awaiting_approval';
  const showCancel = agent.status === 'running' || agent.status === 'awaiting_approval' || agent.status === 'awaiting_user';

  const statusLabel: Record<string, string> = {
    idle: 'Ready',
    running: 'Thinking...',
    awaiting_approval: 'Needs approval',
    awaiting_user: 'Awaiting response',
    completed: 'Done',
    failed: 'Error',
    cancelled: 'Cancelled',
  };

  return (
    <div className="autonomous-agent">
      {/* Header */}
      <div className="aa-header">
        <div className="aa-header-left">
          {onClose && (
            <button className="aa-back-btn" onClick={onClose} title="Back to agents">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="aa-header-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="aa-header-title">Autonomous Agent</div>
            <div className="aa-header-subtitle">Give me a goal and I'll figure out how to do it</div>
          </div>
        </div>
        <div className="aa-header-right">
          {agent.totalTokens > 0 && (
            <div className="aa-stats">
              <span className="aa-stat"><Zap size={12} /> {agent.totalTokens.toLocaleString()} tokens</span>
              <span className="aa-stat"><Coins size={12} /> ${agent.totalCost.toFixed(4)}</span>
            </div>
          )}
          <span className={`aa-status ${agent.status}`}>
            <span className="aa-status-dot" />
            {statusLabel[agent.status] || agent.status}
          </span>
          {agent.messages.length > 0 && (
            <button className="aa-reset-btn" onClick={agent.reset}>
              <RotateCcw size={14} /> New
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="aa-messages">
        {agent.messages.length === 0 && agent.status === 'idle' && (
          <div className="aa-empty">
            <div className="aa-empty-icon">
              <Sparkles size={28} />
            </div>
            <h3>Autonomous Agent</h3>
            <p>
              Describe any goal and I'll autonomously use tools — Gmail, Slack, browser, APIs, code execution — to accomplish it. I'll ask for approval before taking high-risk actions.
            </p>
            <div className="aa-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="aa-suggestion" onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {agent.messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Live Steps (during execution) */}
        {agent.currentSteps.length > 0 && agent.status === 'running' && (
          <div className="aa-live-steps">
            {agent.currentSteps.slice(-5).map((step, i) => (
              <LiveStep key={step.id || i} step={step} />
            ))}
          </div>
        )}

        {/* Approval Banner */}
        {agent.pendingApproval && (
          <ApprovalBanner
            approval={agent.pendingApproval}
            onApprove={() => agent.approve(true)}
            onDeny={() => agent.approve(false)}
          />
        )}

        {/* Question Banner */}
        {agent.pendingQuestion && (
          <div className="aa-approval">
            <div className="aa-approval-header">
              <MessageSquare size={16} /> Agent needs your input
            </div>
            <div className="aa-approval-details">{agent.pendingQuestion}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="aa-input-area">
        <form className="aa-input-form" onSubmit={handleSubmit}>
          <div className="aa-input-wrapper">
            <textarea
              ref={inputRef}
              className="aa-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                agent.status === 'awaiting_user'
                  ? 'Type your response...'
                  : agent.status === 'running'
                    ? 'Agent is working...'
                    : 'Describe your goal...'
              }
              disabled={isInputDisabled}
              rows={1}
            />
          </div>
          {showCancel ? (
            <button type="button" className="aa-cancel-btn" onClick={agent.cancel} title="Cancel">
              <Square size={18} />
            </button>
          ) : (
            <button type="submit" className="aa-send-btn" disabled={!input.trim() || isInputDisabled}>
              <Send size={18} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────── */

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showSteps, setShowSteps] = useState(false);

  return (
    <div className={`aa-msg ${message.role}`}>
      <div className="aa-msg-avatar">
        {message.role === 'user' ? <User size={16} /> :
         message.role === 'assistant' ? <Sparkles size={16} /> :
         <AlertTriangle size={16} />}
      </div>
      <div className="aa-msg-body">
        <div className="aa-msg-content">{message.content}</div>
        {message.steps && message.steps.length > 0 && (
          <>
            <button className="aa-steps-toggle" onClick={() => setShowSteps(!showSteps)}>
              {showSteps ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {message.steps.length} step{message.steps.length !== 1 ? 's' : ''} executed
            </button>
            {showSteps && (
              <div className="aa-steps-list">
                {message.steps.map((step, i) => (
                  <StepCard key={step.id || i} step={step} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StepCard({ step }: { step: ExecutionStep }) {
  const icons: Record<string, React.ReactNode> = {
    thinking: <Brain size={14} color="#e07a3a" />,
    tool_call: <Wrench size={14} color="#3b82f6" />,
    approval_required: <AlertTriangle size={14} color="#f59e0b" />,
    ask_user: <MessageSquare size={14} color="#10b981" />,
    error: <XCircle size={14} color="#ef4444" />,
    done: <CheckCircle2 size={14} color="#10b981" />,
    user_message: <User size={14} color="#e07a3a" />,
  };

  let label = step.type;
  let detail = step.content || '';

  if (step.type === 'tool_call' && step.toolName) {
    label = step.toolName;
    if (step.toolResult) {
      const preview = typeof step.toolResult === 'string'
        ? step.toolResult
        : JSON.stringify(step.toolResult, null, 2);
      detail = preview.length > 300 ? preview.substring(0, 300) + '...' : preview;
    } else if (step.toolArgs) {
      detail = JSON.stringify(step.toolArgs, null, 2);
    }
  }

  return (
    <div className={`aa-step ${step.type}`}>
      <div className="aa-step-icon">{icons[step.type] || <Zap size={14} />}</div>
      <div className="aa-step-content">
        <div className="aa-step-label">{label}</div>
        {detail && <div className="aa-step-detail">{detail}</div>}
      </div>
      {step.durationMs !== undefined && (
        <div className="aa-step-duration">{step.durationMs}ms</div>
      )}
    </div>
  );
}

function LiveStep({ step }: { step: ExecutionStep }) {
  const icons: Record<string, React.ReactNode> = {
    thinking: <Loader2 size={14} color="#e07a3a" className="aa-pulse" />,
    tool_call: <Wrench size={14} color="#3b82f6" />,
  };

  return (
    <div className="aa-live-step">
      <div className="aa-step-icon">{icons[step.type] || <Loader2 size={14} className="aa-pulse" />}</div>
      <div className="aa-step-content">
        <div className="aa-step-label">{step.toolName || step.type}</div>
        {step.content && <div className="aa-step-detail">{step.content}</div>}
      </div>
      {step.durationMs !== undefined && (
        <div className="aa-step-duration">{step.durationMs}ms</div>
      )}
    </div>
  );
}

function ApprovalBanner({
  approval,
  onApprove,
  onDeny,
}: {
  approval: { toolName: string; toolArgs: Record<string, any>; riskLevel: string; description: string };
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="aa-approval">
      <div className="aa-approval-header">
        <AlertTriangle size={16} /> Approval Required — {approval.riskLevel} risk
      </div>
      <div className="aa-approval-details">
        The agent wants to execute <strong>{approval.toolName}</strong>: {approval.description}
      </div>
      <div className="aa-approval-tool">
        {JSON.stringify(approval.toolArgs, null, 2)}
      </div>
      <div className="aa-approval-actions">
        <button className="aa-approve-btn" onClick={onApprove}>
          <CheckCircle2 size={14} /> Approve
        </button>
        <button className="aa-deny-btn" onClick={onDeny}>
          <XCircle size={14} /> Deny
        </button>
      </div>
    </div>
  );
}
