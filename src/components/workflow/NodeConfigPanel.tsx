import { useState, useEffect, useCallback } from 'react';
import { X, Trash2, Settings, Save, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { WorkflowNode, availableApps, knowledgeBaseTypes, triggerTypes, actionTypes } from './WorkflowBuilder';
import { checkAutomationBackend } from '../../services/automation/automationApi';
import { AgentBus } from '../../services/automation/agentBus';
import type { AutomationStatus } from '../../services/automation/automationApi';
import './NodeConfigPanel.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onClose: () => void;
  onUpdate: (node: WorkflowNode) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description || '');
  const [config, setConfig] = useState<Record<string, any>>(node.data.config || {});
  const [connectionStatus, setConnectionStatus] = useState<AutomationStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    setLabel(node.data.label);
    setDescription(node.data.description || '');
    setConfig(node.data.config || {});
  }, [node]);

  // Check connection status when an app node is opened
  useEffect(() => {
    if (node.data.type === 'app') {
      checkStatus();
    }
  }, [node.data.type]);

  const checkStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const status = await checkAutomationBackend();
      setConnectionStatus(status);
    } catch {
      setConnectionStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  const handleSave = () => {
    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...node.data,
        label,
        description,
        config,
      },
    };
    onUpdate(updatedNode);
  };

  const handleAppChange = (appId: string) => {
    const app = availableApps.find(a => a.id === appId);
    if (app) {
      setLabel(app.name);
      // Initialize app-specific config structure
      const newConfig: Record<string, any> = { appType: appId };
      if (appId === 'gmail') {
        newConfig.gmail = { action: 'send', to: '', subject: '', body: '' };
      } else if (appId === 'slack') {
        newConfig.slack = { action: 'send_message', channel: '', message: '' };
      }
      setConfig(newConfig);
    }
  };

  const handleKnowledgeBaseChange = (kbId: string) => {
    const kb = knowledgeBaseTypes.find(k => k.id === kbId);
    if (kb) {
      setLabel(kb.name);
      setConfig({ ...config, knowledgeBaseId: kbId });
    }
  };

  const handleTriggerChange = (triggerId: string) => {
    const trigger = triggerTypes.find(t => t.id === triggerId);
    if (trigger) {
      setLabel(trigger.name);
      setConfig({ ...config, triggerType: triggerId });
    }
  };

  const handleActionChange = (actionId: string) => {
    const action = actionTypes.find(a => a.id === actionId);
    if (action) {
      setLabel(action.name);
      setConfig({ ...config, actionType: actionId });
    }
  };

  const connectGmail = async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/gmail`);
      const json = await res.json();
      if (json.success && json.data?.authUrl) {
        window.open(json.data.authUrl, '_blank', 'width=600,height=700');
      } else {
        alert('Failed to get Gmail auth URL. Make sure the backend is running and Google OAuth credentials are configured.');
      }
    } catch {
      alert('Cannot reach backend. Please start the server (cd server && npm run dev) and ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in server/.env');
    }
  };

  const connectSlack = async () => {
    try {
      const res = await fetch(`${API_BASE}/connections/slack`);
      const json = await res.json();
      if (json.success && json.data?.authUrl) {
        window.open(json.data.authUrl, '_blank', 'width=600,height=700');
      } else {
        alert('Failed to get Slack auth URL. Make sure the backend is running and Slack OAuth credentials are configured.');
      }
    } catch {
      alert('Cannot reach backend. Please start the server.');
    }
  };

  // Get connection status for the current app
  const appId = node.data.appType || config.appType;
  const isGmail = appId === 'gmail';
  const isSlack = appId === 'slack';
  const gmailConnected = connectionStatus?.gmail?.connected;
  const slackConnected = connectionStatus?.slack?.connected;

  return (
    <div className="node-config-panel">
      <div className="node-config-header">
        <div className="node-config-header-left">
          <Settings size={18} />
          <span>Configure Node</span>
        </div>
        <button className="node-config-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="node-config-content">
        {/* Basic Info */}
        <div className="node-config-section">
          <label className="node-config-label">Label</label>
          <input
            type="text"
            className="node-config-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="node-config-section">
          <label className="node-config-label">Description</label>
          <textarea
            className="node-config-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* ─── APP NODE CONFIG ─── */}
        {node.data.type === 'app' && (
          <>
            <div className="node-config-section">
              <label className="node-config-label">App</label>
              <select
                className="node-config-select"
                value={appId || ''}
                onChange={(e) => handleAppChange(e.target.value)}
              >
                {availableApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ─── Connection Status ─── */}
            {(isGmail || isSlack) && (
              <div className="node-config-section">
                <label className="node-config-label">Connection</label>
                <div className="node-config-connection-status">
                  {checkingStatus ? (
                    <div className="connection-badge checking">
                      <Loader2 size={14} className="spin" />
                      <span>Checking…</span>
                    </div>
                  ) : isGmail ? (
                    gmailConnected ? (
                      <div className="connection-badge connected">
                        <CheckCircle size={14} />
                        <span>Gmail connected{connectionStatus?.gmail?.email ? ` (${connectionStatus.gmail.email})` : ''}</span>
                      </div>
                    ) : (
                      <div className="connection-badge disconnected">
                        <AlertCircle size={14} />
                        <span>Gmail not connected</span>
                        <button className="connect-btn" onClick={connectGmail}>
                          <ExternalLink size={12} />
                          Connect
                        </button>
                      </div>
                    )
                  ) : isSlack ? (
                    slackConnected ? (
                      <div className="connection-badge connected">
                        <CheckCircle size={14} />
                        <span>Slack connected{connectionStatus?.slack?.workspace ? ` (${connectionStatus.slack.workspace})` : ''}</span>
                      </div>
                    ) : (
                      <div className="connection-badge disconnected">
                        <AlertCircle size={14} />
                        <span>Slack not connected</span>
                        <button className="connect-btn" onClick={connectSlack}>
                          <ExternalLink size={12} />
                          Connect
                        </button>
                      </div>
                    )
                  ) : null}
                  {!checkingStatus && (
                    <button className="refresh-status-btn" onClick={checkStatus} title="Refresh status">
                      ↻
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ─── Gmail-Specific Config ─── */}
            {isGmail && (
              <>
                <div className="node-config-section">
                  <label className="node-config-label">Gmail Action</label>
                  <select
                    className="node-config-select"
                    value={config.gmail?.action || 'send'}
                    onChange={(e) => setConfig({
                      ...config,
                      appType: 'gmail',
                      gmail: { ...(config.gmail || {}), action: e.target.value },
                    })}
                  >
                    <option value="send">Send Email</option>
                    <option value="read">Read Emails</option>
                    <option value="reply">Reply to Email</option>
                    <option value="label">Apply Label</option>
                    <option value="archive">Archive Email</option>
                  </select>
                </div>

                {config.gmail?.action === 'send' && (
                  <>
                    <div className="node-config-section">
                      <label className="node-config-label">To</label>
                      <input
                        type="email"
                        className="node-config-input"
                        value={config.gmail?.to || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          appType: 'gmail',
                          gmail: { ...(config.gmail || {}), action: 'send', to: e.target.value },
                        })}
                        placeholder="recipient@example.com (or use {{input.email}})"
                      />
                    </div>
                    <div className="node-config-section">
                      <label className="node-config-label">Subject</label>
                      <input
                        type="text"
                        className="node-config-input"
                        value={config.gmail?.subject || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          appType: 'gmail',
                          gmail: { ...(config.gmail || {}), action: 'send', subject: e.target.value },
                        })}
                        placeholder="Email subject"
                      />
                    </div>
                    <div className="node-config-section">
                      <label className="node-config-label">Body</label>
                      <textarea
                        className="node-config-textarea"
                        value={config.gmail?.body || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          appType: 'gmail',
                          gmail: { ...(config.gmail || {}), action: 'send', body: e.target.value },
                        })}
                        rows={5}
                        placeholder="Email body (you can use {{input.data}} for dynamic content)"
                      />
                    </div>
                  </>
                )}

                {config.gmail?.action === 'read' && (
                  <div className="node-config-section">
                    <label className="node-config-label">Search Query (optional)</label>
                    <input
                      type="text"
                      className="node-config-input"
                      value={config.gmail?.query || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        appType: 'gmail',
                        gmail: { ...(config.gmail || {}), action: 'read', query: e.target.value },
                      })}
                      placeholder="e.g. is:unread from:example.com"
                    />
                  </div>
                )}

                {config.gmail?.action === 'reply' && (
                  <div className="node-config-section">
                    <label className="node-config-label">Reply Body</label>
                    <textarea
                      className="node-config-textarea"
                      value={config.gmail?.body || ''}
                      onChange={(e) => setConfig({
                        ...config,
                        appType: 'gmail',
                        gmail: { ...(config.gmail || {}), action: 'reply', body: e.target.value },
                      })}
                      rows={5}
                      placeholder="Reply message body (use {{input.messageId}} for the original message)"
                    />
                  </div>
                )}

                {!gmailConnected && !checkingStatus && connectionStatus !== null && (
                  <div className="node-config-info-box warning">
                    <AlertCircle size={14} />
                    <span>
                      Gmail is not connected. The agent will run in <strong>simulated mode</strong> until you connect Gmail via the button above.
                    </span>
                  </div>
                )}

                {connectionStatus === null && !checkingStatus && (
                  <div className="node-config-info-box info">
                    <AlertCircle size={14} />
                    <span>
                      Backend is offline. Gmail actions will be <strong>simulated</strong> in demo mode. Start the server to use real Gmail.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ─── Slack-Specific Config ─── */}
            {isSlack && (
              <>
                <div className="node-config-section">
                  <label className="node-config-label">Slack Action</label>
                  <select
                    className="node-config-select"
                    value={config.slack?.action || 'send_message'}
                    onChange={(e) => setConfig({
                      ...config,
                      appType: 'slack',
                      slack: { ...(config.slack || {}), action: e.target.value },
                    })}
                  >
                    <option value="send_message">Send Message</option>
                    <option value="read_messages">Read Messages</option>
                  </select>
                </div>

                {config.slack?.action === 'send_message' && (
                  <>
                    <div className="node-config-section">
                      <label className="node-config-label">Channel</label>
                      <input
                        type="text"
                        className="node-config-input"
                        value={config.slack?.channel || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          appType: 'slack',
                          slack: { ...(config.slack || {}), action: 'send_message', channel: e.target.value },
                        })}
                        placeholder="#general or channel ID"
                      />
                    </div>
                    <div className="node-config-section">
                      <label className="node-config-label">Message</label>
                      <textarea
                        className="node-config-textarea"
                        value={config.slack?.message || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          appType: 'slack',
                          slack: { ...(config.slack || {}), action: 'send_message', message: e.target.value },
                        })}
                        rows={4}
                        placeholder="Message text (use {{input.data}} for dynamic content)"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ─── KNOWLEDGE NODE ─── */}
        {node.data.type === 'knowledge' && (
          <div className="node-config-section">
            <label className="node-config-label">Knowledge Base</label>
            <select
              className="node-config-select"
              value={node.data.knowledgeBaseId || ''}
              onChange={(e) => handleKnowledgeBaseChange(e.target.value)}
            >
              {knowledgeBaseTypes.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ─── TRIGGER NODE ─── */}
        {node.data.type === 'trigger' && (
          <>
            <div className="node-config-section">
              <label className="node-config-label">Trigger Type</label>
              <select
                className="node-config-select"
                value={config.triggerType || ''}
                onChange={(e) => handleTriggerChange(e.target.value)}
              >
                {triggerTypes.map((trigger) => (
                  <option key={trigger.id} value={trigger.id}>
                    {trigger.name}
                  </option>
                ))}
              </select>
            </div>

            {config.triggerType === 'schedule' && (
              <div className="node-config-section">
                <label className="node-config-label">Frequency</label>
                <select
                  className="node-config-select"
                  value={config.frequency || 'daily'}
                  onChange={(e) => setConfig({ ...config, frequency: e.target.value })}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            {config.triggerType === 'webhook' && (
              <div className="node-config-section">
                <label className="node-config-label">Webhook URL</label>
                <input
                  type="text"
                  className="node-config-input"
                  value={config.webhookUrl || ''}
                  readOnly
                  placeholder="URL will be generated after deployment"
                />
              </div>
            )}
          </>
        )}

        {/* ─── ACTION NODE ─── */}
        {node.data.type === 'action' && (
          <div className="node-config-section">
            <label className="node-config-label">Action Type</label>
            <select
              className="node-config-select"
              value={config.actionType || ''}
              onChange={(e) => handleActionChange(e.target.value)}
            >
              {actionTypes.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ─── BROWSER TASK NODE ─── */}
        {node.data.type === 'browser_task' && (
          <>
            <div className="node-config-section">
              <label className="node-config-label">Browser Action</label>
              <select
                className="node-config-select"
                value={config.action || 'navigate'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
              >
                <option value="navigate">Navigate to URL</option>
                <option value="click">Click Element</option>
                <option value="type">Type Text</option>
                <option value="search">Search</option>
                <option value="login">Login</option>
                <option value="add_to_cart">Add to Cart</option>
                <option value="checkout">Checkout</option>
                <option value="submit">Submit Form</option>
                <option value="extract">Extract Data</option>
                <option value="screenshot">Take Screenshot</option>
                <option value="scroll">Scroll</option>
                <option value="wait">Wait</option>
                <option value="select">Select Option</option>
                <option value="custom">Custom Action</option>
              </select>
            </div>

            {(config.action === 'navigate' || config.action === 'login') && (
              <div className="node-config-section">
                <label className="node-config-label">URL</label>
                <input
                  type="url"
                  className="node-config-input"
                  value={config.url || ''}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://www.example.com"
                />
              </div>
            )}

            {(config.action === 'click' || config.action === 'type' || config.action === 'extract' || config.action === 'select') && (
              <div className="node-config-section">
                <label className="node-config-label">CSS Selector</label>
                <input
                  type="text"
                  className="node-config-input"
                  value={config.selector || ''}
                  onChange={(e) => setConfig({ ...config, selector: e.target.value })}
                  placeholder="#element-id or .class-name"
                />
              </div>
            )}

            {(config.action === 'type' || config.action === 'search' || config.action === 'select') && (
              <div className="node-config-section">
                <label className="node-config-label">Value</label>
                <input
                  type="text"
                  className="node-config-input"
                  value={config.value || ''}
                  onChange={(e) => setConfig({ ...config, value: e.target.value })}
                  placeholder="Text to type or value to select"
                />
              </div>
            )}

            <div className="node-config-section">
              <label className="node-config-label">Description</label>
              <textarea
                className="node-config-textarea"
                value={config.description || ''}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Describe what this browser step does..."
                rows={2}
              />
            </div>

            <div className="node-config-section">
              <label className="node-config-label">
                <input
                  type="checkbox"
                  checked={config.requiresConfirmation || false}
                  onChange={(e) => setConfig({ ...config, requiresConfirmation: e.target.checked })}
                  style={{ marginRight: 8 }}
                />
                Pause for user confirmation before executing
              </label>
            </div>

            <div className="node-config-info-box info">
              <AlertCircle size={14} />
              <span>
                Browser tasks run in a <strong>separate window</strong> so they don't disturb your work.
                They require the CrewOS companion service for real execution.
              </span>
            </div>
          </>
        )}

        {/* ─── AI NODE ─── */}
        {node.data.type === 'ai' && (
          <>
            <div className="node-config-section">
              <label className="node-config-label">AI Prompt</label>
              <textarea
                className="node-config-textarea"
                value={config.prompt || ''}
                onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                placeholder="Describe what the AI should do with the input data..."
                rows={5}
              />
            </div>
            <div className="node-config-section">
              <label className="node-config-label">System Prompt (optional)</label>
              <textarea
                className="node-config-textarea"
                value={config.systemPrompt || ''}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                placeholder="Set AI persona / instructions..."
                rows={3}
              />
            </div>
            <div className="node-config-section">
              <label className="node-config-label">Model</label>
              <select
                className="node-config-select"
                value={config.model || 'gpt-4'}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div className="node-config-section">
              <label className="node-config-label">Temperature ({config.temperature ?? 0.7})</label>
              <input
                type="range"
                className="node-config-range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature ?? 0.7}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              />
              <div className="node-config-range-labels">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </>
        )}

        {/* ─── MEMORY NODE ─── */}
        {node.data.type === 'memory' && (
          <>
            <div className="node-config-section">
              <label className="node-config-label">Action</label>
              <select
                className="node-config-select"
                value={config.action || 'write'}
                onChange={(e) => setConfig({ ...config, action: e.target.value })}
              >
                <option value="write">Write to Memory</option>
                <option value="read">Read from Memory</option>
                <option value="search">Search Memory</option>
                <option value="delete">Delete from Memory</option>
              </select>
            </div>

            <div className="node-config-section">
              <label className="node-config-label">Scope</label>
              <select
                className="node-config-select"
                value={config.scope || 'agent'}
                onChange={(e) => setConfig({ ...config, scope: e.target.value })}
              >
                <option value="session">Session (this execution only)</option>
                <option value="agent">Agent (persists across executions)</option>
                <option value="shared">Shared (visible to all agents)</option>
              </select>
            </div>

            {(config.action === 'write' || config.action === 'read' || config.action === 'delete') && (
              <div className="node-config-section">
                <label className="node-config-label">Key</label>
                <input
                  type="text"
                  className="node-config-input"
                  value={config.key || ''}
                  onChange={(e) => setConfig({ ...config, key: e.target.value })}
                  placeholder="e.g. last_summary, user_preference"
                />
              </div>
            )}

            {config.action === 'write' && (
              <>
                <div className="node-config-section">
                  <label className="node-config-label">Value (leave empty to store input data)</label>
                  <textarea
                    className="node-config-textarea"
                    value={typeof config.value === 'string' ? config.value : ''}
                    onChange={(e) => setConfig({ ...config, value: e.target.value || undefined })}
                    placeholder="Static value, or leave empty to save the incoming node data"
                    rows={3}
                  />
                </div>
                <div className="node-config-section">
                  <label className="node-config-label">Expire After (minutes, 0 = never)</label>
                  <input
                    type="number"
                    className="node-config-input"
                    value={config.ttlMinutes || 0}
                    onChange={(e) => setConfig({ ...config, ttlMinutes: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </>
            )}

            {config.action === 'search' && (
              <div className="node-config-section">
                <label className="node-config-label">Search Query</label>
                <input
                  type="text"
                  className="node-config-input"
                  value={config.query || ''}
                  onChange={(e) => setConfig({ ...config, query: e.target.value })}
                  placeholder="Keywords to search in stored memory"
                />
              </div>
            )}

            <div className="node-config-info-box info">
              <AlertCircle size={14} />
              <span>
                {config.scope === 'session' && 'Session memory is discarded after this execution ends.'}
                {config.scope === 'agent' && 'Agent memory persists across all future executions of this agent.'}
                {config.scope === 'shared' && 'Shared memory is readable and writable by all deployed agents.'}
              </span>
            </div>
          </>
        )}

        {/* ─── AGENT CALL NODE ─── */}
        {node.data.type === 'agent_call' && (() => {
          const registeredAgents = AgentBus.listAgents();
          return (
            <>
              <div className="node-config-section">
                <label className="node-config-label">Target Agent</label>
                <select
                  className="node-config-select"
                  value={config.targetAgentId || ''}
                  onChange={(e) => {
                    const selected = registeredAgents.find(a => a.agentId === e.target.value);
                    setConfig({
                      ...config,
                      targetAgentId: e.target.value,
                      targetAgentName: selected?.name || '',
                    });
                  }}
                >
                  <option value="">Select an agent...</option>
                  {registeredAgents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.name} {agent.status !== 'active' ? `(${agent.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {config.targetAgentId && (() => {
                const target = registeredAgents.find(a => a.agentId === config.targetAgentId);
                return target ? (
                  <div className="node-config-info-box info">
                    <AlertCircle size={14} />
                    <span>
                      <strong>{target.name}</strong>
                      {target.description ? ` — ${target.description}` : ''}
                      {target.capabilities.length > 0 && (
                        <><br />Capabilities: {target.capabilities.join(', ')}</>
                      )}
                    </span>
                  </div>
                ) : null;
              })()}

              <div className="node-config-section">
                <label className="node-config-label">
                  <input
                    type="checkbox"
                    checked={config.passInput !== false}
                    onChange={(e) => setConfig({ ...config, passInput: e.target.checked })}
                    style={{ marginRight: 8 }}
                  />
                  Pass current data as input to target agent
                </label>
              </div>

              <div className="node-config-section">
                <label className="node-config-label">
                  <input
                    type="checkbox"
                    checked={config.waitForResult !== false}
                    onChange={(e) => setConfig({ ...config, waitForResult: e.target.checked })}
                    style={{ marginRight: 8 }}
                  />
                  Wait for result before continuing
                </label>
              </div>

              <div className="node-config-section">
                <label className="node-config-label">Timeout (seconds)</label>
                <input
                  type="number"
                  className="node-config-input"
                  value={config.timeoutSeconds || 30}
                  onChange={(e) => setConfig({ ...config, timeoutSeconds: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={300}
                />
              </div>

              {registeredAgents.length === 0 && (
                <div className="node-config-info-box warning">
                  <AlertCircle size={14} />
                  <span>
                    No agents are deployed yet. Deploy at least one other agent to enable agent-to-agent calls.
                  </span>
                </div>
              )}
            </>
          );
        })()}
      </div>

      <div className="node-config-footer">
        <button className="node-config-btn node-config-btn-danger" onClick={onDelete}>
          <Trash2 size={16} />
          Delete
        </button>
        <button className="node-config-btn node-config-btn-primary" onClick={handleSave}>
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
}
