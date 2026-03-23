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
  Rocket,
  Settings2,
  Mail,
  Globe,
  BarChart3,
  GitBranch,
  Clock,
  History,
  ChevronUp,
  Monitor,
} from 'lucide-react';
import { useAutonomousAgent, type ExecutionStep, type ChatMessage, type ExecutionHistoryItem } from '../../hooks/useAutonomousAgent';
import { useComputerUse } from '../../hooks/useComputerUse';
import './AutonomousAgent.css';

const SUGGESTION_CATEGORIES = [
  {
    label: 'Email',
    icon: Mail,
    suggestions: [
      'Read my latest emails and summarize the urgent ones',
      'Draft a follow-up email to my last meeting attendees',
    ],
  },
  {
    label: 'Web & Research',
    icon: Globe,
    suggestions: [
      'Research competitor pricing on their website',
      'Search the web for the latest AI news and write a brief',
    ],
  },
  {
    label: 'Analysis',
    icon: BarChart3,
    suggestions: [
      'Analyze this quarter\'s sales data and find trends',
      'Summarize my recent Slack messages and list action items',
    ],
  },
  {
    label: 'Automation',
    icon: GitBranch,
    suggestions: [
      'Create a workflow that monitors my inbox and alerts me on Slack',
      'Build an agent that sends a daily standup summary to #engineering',
    ],
  },
];

const MODELS = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', desc: 'Fast & capable' },
  { value: 'claude-opus-4', label: 'Claude Opus 4', desc: 'Most intelligent' },
  { value: 'claude-haiku-3.5', label: 'Claude Haiku 3.5', desc: 'Fastest & cheapest' },
];

interface AutonomousAgentProps {
  onClose?: () => void;
  onDeploy?: (prompt: string) => Promise<void>;
}

export function AutonomousAgent({ onClose, onDeploy }: AutonomousAgentProps = {}) {
  const agent = useAutonomousAgent();
  const computerUse = useComputerUse();
  const [mode, setMode] = useState<'web' | 'desktop'>('web');
  const [input, setInput] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [model, setModel] = useState('claude-sonnet-4');
  const [maxIterations, setMaxIterations] = useState(25);
  const [autoApproveRisk, setAutoApproveRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(scrollToBottom, [agent.messages, agent.currentSteps, scrollToBottom]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    if (mode === 'desktop' && computerUse.isDesktop) {
      computerUse.startTask(trimmed, { model, maxTurns: maxIterations, maxBudgetUsd: 2.00 });
    } else if (agent.status === 'awaiting_user') {
      agent.sendMessage(trimmed);
    } else if (agent.status === 'idle' || agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled') {
      agent.sendGoal(trimmed, { model, maxIterations, autoApproveRisk });
    }
    setInput('');
  }, [input, agent, computerUse, mode, model, maxIterations, autoApproveRisk]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSuggestion = useCallback((suggestion: string) => {
    if (mode === 'desktop' && computerUse.isDesktop) {
      computerUse.startTask(suggestion, { model, maxTurns: maxIterations, maxBudgetUsd: 2.00 });
    } else {
      agent.sendGoal(suggestion, { model, maxIterations, autoApproveRisk });
    }
  }, [agent, computerUse, mode, model, maxIterations, autoApproveRisk]);

  const handleDeploy = useCallback(async () => {
    if (!onDeploy) return;
    const userGoal = agent.messages.find(m => m.role === 'user')?.content;
    if (!userGoal) return;

    setDeploying(true);
    try {
      await onDeploy(userGoal);
      setDeployed(true);
    } catch {
      // handled by parent
    } finally {
      setDeploying(false);
    }
  }, [onDeploy, agent.messages]);

  const canDeploy = onDeploy
    && (agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled')
    && agent.messages.some(m => m.role === 'user')
    && !deployed;

  const isDesktopMode = mode === 'desktop' && computerUse.isDesktop;
  const isInputDisabled = isDesktopMode
    ? computerUse.status === 'running' || computerUse.status === 'awaiting_approval'
    : agent.status === 'running' || agent.status === 'awaiting_approval';
  const showCancel = isDesktopMode
    ? computerUse.status === 'running' || computerUse.status === 'awaiting_approval'
    : agent.status === 'running' || agent.status === 'awaiting_approval' || agent.status === 'awaiting_user';
  const activeStatus = isDesktopMode ? computerUse.status : agent.status;

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
      {/* History Sidebar */}
      {showHistory && (
        <div className="aa-history-sidebar">
          <div className="aa-history-header">
            <History size={16} />
            <span>History</span>
            <button className="aa-history-close" onClick={() => setShowHistory(false)}>
              <XCircle size={16} />
            </button>
          </div>
          <div className="aa-history-list">
            {agent.historyLoading && (
              <div className="aa-history-loading"><Loader2 size={16} className="aa-pulse" /> Loading...</div>
            )}
            {!agent.historyLoading && agent.history.length === 0 && (
              <div className="aa-history-empty">No past executions yet</div>
            )}
            {agent.history.map((item: ExecutionHistoryItem) => (
              <div key={item.id} className={`aa-history-item ${item.status}`}>
                <div className="aa-history-goal">{item.goal}</div>
                <div className="aa-history-meta">
                  <span className={`aa-history-status ${item.status}`}>{item.status}</span>
                  <span>{item.model}</span>
                  <span>{new Date(item.startedAt).toLocaleDateString()}</span>
                </div>
                {item.totalCost > 0 && (
                  <div className="aa-history-cost">
                    <Zap size={10} /> {item.totalTokens.toLocaleString()} tokens &middot; ${item.totalCost.toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="aa-main-area">
        {/* Header */}
        <div className="aa-header">
          <div className="aa-header-left">
            <div className="aa-header-icon">
              {isDesktopMode ? <Monitor size={18} /> : <Sparkles size={18} />}
            </div>
            <div>
              <div className="aa-header-title">{isDesktopMode ? 'Computer Use' : 'Chat Agent'}</div>
              <div className="aa-header-subtitle">
                {isDesktopMode
                  ? 'I can control any app on your computer'
                  : 'Give me a goal and I\'ll figure out how to do it'}
              </div>
            </div>
            {computerUse.isDesktop && (
              <div className="aa-mode-toggle">
                <button
                  className={`aa-mode-btn ${mode === 'web' ? 'active' : ''}`}
                  onClick={() => setMode('web')}
                >
                  <Sparkles size={12} /> Web
                </button>
                <button
                  className={`aa-mode-btn ${mode === 'desktop' ? 'active' : ''}`}
                  onClick={() => setMode('desktop')}
                >
                  <Monitor size={12} /> Desktop
                </button>
              </div>
            )}
          </div>
          <div className="aa-header-right">
            {agent.totalTokens > 0 && !isDesktopMode && (
              <div className="aa-stats">
                <span className="aa-stat"><Zap size={12} /> {agent.totalTokens.toLocaleString()} tokens</span>
                <span className="aa-stat"><Coins size={12} /> ${agent.totalCost.toFixed(4)}</span>
              </div>
            )}
            <span className={`aa-status ${activeStatus}`}>
              <span className="aa-status-dot" />
              {statusLabel[activeStatus] || activeStatus}
            </span>
            <button
              className={`aa-icon-btn ${showHistory ? 'active' : ''}`}
              onClick={() => setShowHistory(!showHistory)}
              title="Execution history"
            >
              <History size={16} />
            </button>
            <button
              className={`aa-icon-btn ${showOptions ? 'active' : ''}`}
              onClick={() => setShowOptions(!showOptions)}
              title="Options"
            >
              <Settings2 size={16} />
            </button>
            {canDeploy && (
              <button className="aa-deploy-btn" onClick={handleDeploy} disabled={deploying}>
                <Rocket size={14} /> {deploying ? 'Deploying...' : 'Deploy as Agent'}
              </button>
            )}
            {deployed && (
              <span className="aa-deployed-badge">
                <CheckCircle2 size={14} /> Deployed
              </span>
            )}
            {(isDesktopMode ? computerUse.steps.length > 0 : agent.messages.length > 0) && (
              <button className="aa-reset-btn" onClick={() => {
                if (isDesktopMode) { computerUse.reset(); } else { agent.reset(); setDeployed(false); }
              }}>
                <RotateCcw size={14} /> New
              </button>
            )}
          </div>
        </div>

        {/* Options Panel */}
        {showOptions && (
          <div className="aa-options-panel">
            <div className="aa-option-group">
              <label className="aa-option-label">Model</label>
              <div className="aa-model-selector">
                {MODELS.map(m => (
                  <button
                    key={m.value}
                    className={`aa-model-btn ${model === m.value ? 'active' : ''}`}
                    onClick={() => setModel(m.value)}
                  >
                    <span className="aa-model-name">{m.label}</span>
                    <span className="aa-model-desc">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="aa-option-row">
              <div className="aa-option-group">
                <label className="aa-option-label">Max Steps</label>
                <select
                  className="aa-option-select"
                  value={maxIterations}
                  onChange={e => setMaxIterations(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25 (default)</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="aa-option-group">
                <label className="aa-option-label">Auto-approve risk</label>
                <select
                  className="aa-option-select"
                  value={autoApproveRisk}
                  onChange={e => setAutoApproveRisk(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low only</option>
                  <option value="medium">Low + Medium</option>
                  <option value="high">All (no prompts)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="aa-messages">
          {isDesktopMode ? (
            <>
              {computerUse.status === 'idle' && computerUse.steps.length === 0 && (
                <div className="aa-empty">
                  <div className="aa-empty-icon">
                    <Monitor size={32} />
                  </div>
                  <h3>Control your computer</h3>
                  <p>
                    I can see your screen, click, type, and use any app.
                    Describe what you want me to do.
                  </p>
                  <div className="aa-suggestion-grid">
                    <div className="aa-suggestion-category">
                      <div className="aa-suggestion-cat-header">
                        <Monitor size={14} />
                        <span>Try these</span>
                      </div>
                      <button className="aa-suggestion" onClick={() => handleSuggestion('Open Calculator from Spotlight')}>
                        Open Calculator from Spotlight
                      </button>
                      <button className="aa-suggestion" onClick={() => handleSuggestion('Open Safari and go to google.com')}>
                        Open Safari and go to google.com
                      </button>
                      <button className="aa-suggestion" onClick={() => handleSuggestion('Take a screenshot and describe what you see')}>
                        Take a screenshot and describe what you see
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Screenshot */}
              {computerUse.latestScreenshot && (
                <div className="aa-screenshot" ref={screenshotRef}>
                  <img
                    src={computerUse.latestScreenshot}
                    alt="Desktop screenshot"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-primary)' }}
                  />
                </div>
              )}

              {/* Computer Use Steps */}
              {computerUse.steps.length > 0 && (
                <div className="aa-live-steps">
                  {computerUse.steps.slice(-8).map((step, i) => (
                    <div key={i} className="aa-live-step">
                      <div className="aa-step-icon">
                        {step.type === 'thinking' ? <Brain size={14} color="#e07a3a" /> :
                         step.type === 'action' ? <Wrench size={14} color="#3b82f6" /> :
                         <Loader2 size={14} className="aa-pulse" />}
                      </div>
                      <div className="aa-step-content">
                        <div className="aa-step-label">{step.type}</div>
                        {step.content && <div className="aa-step-detail">{step.content}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Desktop Approval */}
              {computerUse.pendingApproval && (
                <div className="aa-approval">
                  <div className="aa-approval-header">
                    <AlertTriangle size={16} /> Approval Required
                  </div>
                  <div className="aa-approval-details">{computerUse.pendingApproval.description}</div>
                  <div className="aa-approval-actions">
                    <button className="aa-approve-btn" onClick={() => computerUse.approve(true)}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                    <button className="aa-deny-btn" onClick={() => computerUse.approve(false)}>
                      <XCircle size={14} /> Deny
                    </button>
                  </div>
                </div>
              )}

              {/* Result */}
              {computerUse.result && (
                <div className="aa-msg assistant">
                  <div className="aa-msg-avatar"><Monitor size={16} /></div>
                  <div className="aa-msg-body">
                    <div className="aa-msg-content">{computerUse.result}</div>
                  </div>
                </div>
              )}

              {computerUse.error && (
                <div className="aa-msg system">
                  <div className="aa-msg-avatar"><XCircle size={16} /></div>
                  <div className="aa-msg-body">
                    <div className="aa-msg-content">{computerUse.error}</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {agent.messages.length === 0 && agent.status === 'idle' && (
                <div className="aa-empty">
                  <div className="aa-empty-icon">
                    <Sparkles size={32} />
                  </div>
                  <h3>What can I help you with?</h3>
                  <p>
                    I can execute tasks right now using Gmail, Slack, browser, APIs, and more.
                    When it works, hit <strong>Deploy as Agent</strong> to save it as a reusable automation.
                  </p>
                  <div className="aa-suggestion-grid">
                    {SUGGESTION_CATEGORIES.map(cat => (
                      <div key={cat.label} className="aa-suggestion-category">
                        <div className="aa-suggestion-cat-header">
                          <cat.icon size={14} />
                          <span>{cat.label}</span>
                        </div>
                        {cat.suggestions.map((s, i) => (
                          <button key={i} className="aa-suggestion" onClick={() => handleSuggestion(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agent.messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {agent.currentSteps.length > 0 && agent.status === 'running' && (
                <div className="aa-live-steps">
                  {agent.currentSteps.slice(-5).map((step, i) => (
                    <LiveStep key={step.id || i} step={step} />
                  ))}
                </div>
              )}

              {agent.pendingApproval && (
                <ApprovalBanner
                  approval={agent.pendingApproval}
                  onApprove={() => agent.approve(true)}
                  onDeny={() => agent.approve(false)}
                />
              )}

              {agent.pendingQuestion && (
                <div className="aa-approval">
                  <div className="aa-approval-header">
                    <MessageSquare size={16} /> Agent needs your input
                  </div>
                  <div className="aa-approval-details">{agent.pendingQuestion}</div>
                </div>
              )}
            </>
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
                  isDesktopMode
                    ? (computerUse.status === 'running' ? 'Controlling your computer...' : 'Tell me what to do on your computer...')
                    : agent.status === 'awaiting_user'
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
              <button type="button" className="aa-cancel-btn" onClick={() => isDesktopMode ? computerUse.cancel() : agent.cancel()} title="Cancel">
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
