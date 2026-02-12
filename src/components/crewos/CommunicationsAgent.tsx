import { useState, useCallback, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  Users,
  Search,
  Filter,
  Send,
  RefreshCw,
  Sparkles,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit3,
  Copy,
  RotateCcw,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Zap,
  Eye,
  Bot,
  Hash,
  Paperclip,
  X,
  Settings2,
  Link2,
  Unlink,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Brain,
  Target,
  TrendingUp,
  Shield,
  Loader2,
  Wifi,
  WifiOff,
  ArrowUpRight,
  BarChart3,
  Lightbulb,
  MessageCircle,
  Plus,
  UserPlus,
  Crown,
  AtSign,
  Layers,
} from 'lucide-react';
import { useCommsAgent } from '../../hooks/useCommsAgent';
import { ApprovalPopup, VIPNotificationPopup } from './ApprovalPopup';
import type { Channel, MessageStatus, Priority } from '../../services/commsApi';
import './CommunicationsAgent.css';
import './ApprovalPopup.css';

/* ─── Helpers ──────────────────────────────────────────── */

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail size={16} />,
  slack: <Hash size={16} />,
  teams: <Users size={16} />,
};

const channelLabels: Record<string, string> = {
  email: 'Email',
  slack: 'Slack',
  teams: 'Teams',
};

const channelColors: Record<string, string> = {
  email: '#3B82F6',
  slack: '#E01E5A',
  teams: '#6264A7',
};

const priorityColors: Record<Priority, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
};

const statusLabels: Record<MessageStatus, string> = {
  pending: 'Pending AI',
  ai_drafted: 'AI Drafted',
  approved: 'Approved',
  sent: 'Sent',
  escalated: 'Needs Your Input',
};

const statusIcons: Record<MessageStatus, React.ReactNode> = {
  pending: <Clock size={13} />,
  ai_drafted: <Sparkles size={13} />,
  approved: <CheckCircle size={13} />,
  sent: <Send size={13} />,
  escalated: <AlertCircle size={13} />,
};

/* ─── Component ────────────────────────────────────────── */

export function CommunicationsAgent() {
  const [state, actions] = useCommsAgent();
  const location = useLocation();
  const navigate = useNavigate();

  /* ── Local UI state ──────────────────────────────────── */
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showVIPPanel, setShowVIPPanel] = useState(false);

  // Handle OAuth callback (check for ?connected=gmail|slack|teams or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected || error) {
      // Refresh connections to get updated status
      if (state.backendConnected) {
        actions.refreshConnections();
        // Also sync messages to get new ones from the connected account
        actions.syncMessages();
      }

      // Clean up URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, state.backendConnected, actions, navigate, location.pathname]);

  const {
    messages,
    selectedMessage,
    totalMessages,
    channelCounts,
    activeChannel,
    searchQuery,
    filterPriority,
    filterStatus,
    connections,
    isGenerating,
    lastAnalysis,
    approvalQueue,
    vipContacts,
    vipNotifications,
    styleProfiles,
    isAnalyzingStyle,
    styleAnalyzed,
    channelGroups,
    individualMessages,
    expandedGroupId,
    expandedImportance,
    isLoading,
    isSyncing,
    backendConnected,
    error,
  } = state;

  // Compute unique contacts from messages (for VIP suggestions)
  const uniqueContacts = useMemo(() => {
    const seen = new Map<string, { name: string; email?: string; channel: Channel }>();
    for (const msg of messages) {
      const key = msg.fromEmail || msg.from;
      if (!seen.has(key)) {
        seen.set(key, { name: msg.from, email: msg.fromEmail, channel: msg.channel as Channel });
      }
    }
    // Filter out already-VIP contacts
    return Array.from(seen.values()).filter(
      c => !vipContacts.some(v => v.name === c.name)
    );
  }, [messages, vipContacts]);

  // Stats
  const allMessages = messages;
  const pendingCount = allMessages.filter(m => m.status === 'pending').length;
  const draftedCount = allMessages.filter(m => m.status === 'ai_drafted').length;
  const sentCount = allMessages.filter(m => m.status === 'sent').length;

  /* ── Handlers ────────────────────────────────────────── */

  const handleSelectMessage = useCallback((msg: any) => {
    actions.selectMessage(msg);
    setEditingDraft(false);
    setDraftText(msg.aiDraft || '');
  }, [actions]);

  const handleGenerateAIDraft = useCallback(async (msgId: string) => {
    await actions.generateDraft(msgId);
  }, [actions]);

  const handleRegenerateDraft = useCallback(async (msgId: string) => {
    await actions.generateDraft(msgId, 'Please provide a different approach');
  }, [actions]);

  const handleApproveDraft = useCallback((msgId: string) => {
    actions.updateMessageStatus(msgId, 'approved');
  }, [actions]);

  const handleSendDraft = useCallback(async (msgId: string) => {
    await actions.sendMessage(msgId);
  }, [actions]);

  const handleToggleStar = useCallback((msgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    actions.starMessage(msgId);
  }, [actions]);

  const handleSaveDraft = useCallback(() => {
    if (!selectedMessage) return;
    actions.updateMessageDraft(selectedMessage.id, draftText);
    setEditingDraft(false);
  }, [selectedMessage, draftText, actions]);

  const channelTabs: { id: Channel | 'all'; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'all', label: 'All Channels', icon: <Zap size={15} />, count: totalMessages },
    { id: 'email', label: 'Email', icon: <Mail size={15} />, count: channelCounts.email },
    { id: 'slack', label: 'Slack', icon: <MessageSquare size={15} />, count: channelCounts.slack },
    { id: 'teams', label: 'Teams', icon: <Users size={15} />, count: channelCounts.teams },
  ];

  const hasConnections = connections.some(c => c.status === 'connected');
  const isEmpty = messages.length === 0 && !hasConnections;

  return (
    <div className="comms-agent">
      {/* ─── HEADER ─────────────────────────────────── */}
      <div className="comms-header">
        <div className="comms-header-left">
          <h1 className="comms-title">Communications Agent</h1>
          {!isEmpty && (
            <>
              <div className="comms-header-stats">
                <div className="comms-stat">
                  <span className="comms-stat-dot" style={{ background: '#EF4444' }} />
                  <span className="comms-stat-count">{pendingCount}</span>
                  <span className="comms-stat-label">Pending</span>
                </div>
                <div className="comms-stat">
                  <span className="comms-stat-dot" style={{ background: '#8B5CF6' }} />
                  <span className="comms-stat-count">{draftedCount}</span>
                  <span className="comms-stat-label">AI Drafted</span>
                </div>
                <div className="comms-stat">
                  <span className="comms-stat-dot" style={{ background: '#10B981' }} />
                  <span className="comms-stat-count">{sentCount}</span>
                  <span className="comms-stat-label">Sent</span>
                </div>
              </div>

              {/* Backend status indicator */}
              <div className={`comms-backend-status ${backendConnected ? 'connected' : ''}`}>
                {backendConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                <span>{backendConnected ? 'Live' : 'Demo Mode'}</span>
              </div>
            </>
          )}
        </div>

        <div className="comms-header-right">
          <button
            className={`comms-btn comms-btn-secondary ${showConnections ? 'active' : ''}`}
            onClick={() => { setShowConnections(!showConnections); setShowAIInsights(false); setShowVIPPanel(false); }}
            title="Manage Connections"
          >
            <Link2 size={15} />
            <span>Connections</span>
          </button>
          {!isEmpty && (
            <>
              <button
                className={`comms-btn comms-btn-secondary ${showVIPPanel ? 'active' : ''}`}
                onClick={() => { setShowVIPPanel(!showVIPPanel); setShowConnections(false); setShowAIInsights(false); }}
                title="VIP Contacts"
              >
                <Crown size={15} />
                <span>VIP Contacts</span>
                {vipContacts.length > 0 && (
                  <span className="comms-vip-header-count">{vipContacts.length}</span>
                )}
              </button>
              <button
                className={`comms-btn comms-btn-secondary ${showAIInsights ? 'active' : ''}`}
                onClick={() => { setShowAIInsights(!showAIInsights); setShowConnections(false); setShowVIPPanel(false); }}
                title="AI Engine Settings"
              >
                <Brain size={15} />
                <span>AI Engine</span>
              </button>
              <button
                className="comms-btn comms-btn-secondary"
                onClick={() => actions.syncMessages()}
                disabled={isSyncing}
              >
                <RefreshCw size={15} className={isSyncing ? 'comms-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
              <button
                className="comms-btn comms-btn-primary"
                onClick={() => actions.autoDraftAll()}
                disabled={isGenerating}
              >
                <Bot size={15} />
                <span>{isGenerating ? 'Drafting...' : 'Auto-Draft All'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── CONNECTIONS PANEL ────────────────────────── */}
      {showConnections && (
        <div className="comms-connections-panel">
          <div className="comms-connections-header">
            <h3><Link2 size={16} /> Channel Connections</h3>
            <p>Connect your accounts to sync real messages. The AI engine will analyze and draft responses.</p>
          </div>
          <div className="comms-connections-grid">
            {/* Gmail */}
            <div className="comms-connection-card">
              <div className="comms-connection-icon" style={{ background: '#EA4335' }}>
                <Mail size={20} />
              </div>
              <div className="comms-connection-info">
                <h4>Gmail</h4>
                <p>Google OAuth2 · Gmail API</p>
                {connections.find(c => c.channel === 'email')?.status === 'connected' ? (
                  <span className="comms-connection-status connected">
                    <CheckCircle size={12} /> Connected
                    {connections.find(c => c.channel === 'email')?.accountEmail &&
                      ` · ${connections.find(c => c.channel === 'email')?.accountEmail}`
                    }
                  </span>
                ) : (
                  <span className="comms-connection-status">Not connected</span>
                )}
              </div>
              <button
                className={`comms-connection-btn ${connections.find(c => c.channel === 'email')?.status === 'connected' ? 'disconnect' : ''}`}
                onClick={() => {
                  const conn = connections.find(c => c.channel === 'email');
                  if (conn?.status === 'connected') {
                    actions.disconnectChannel('email');
                  } else {
                    actions.connectGmail();
                  }
                }}
              >
                {connections.find(c => c.channel === 'email')?.status === 'connected' ?
                  <><Unlink size={13} /> Disconnect</> :
                  <><Link2 size={13} /> Connect</>
                }
              </button>
            </div>

            {/* Slack */}
            <div className="comms-connection-card">
              <div className="comms-connection-icon" style={{ background: '#4A154B' }}>
                <Hash size={20} />
              </div>
              <div className="comms-connection-info">
                <h4>Slack</h4>
                <p>OAuth · Add to Slack</p>
                {connections.find(c => c.channel === 'slack')?.status === 'connected' ? (
                  <span className="comms-connection-status connected">
                    <CheckCircle size={12} /> Connected
                    {connections.find(c => c.channel === 'slack')?.accountName &&
                      ` · ${connections.find(c => c.channel === 'slack')?.accountName}`
                    }
                  </span>
                ) : (
                  <span className="comms-connection-status">Not connected</span>
                )}
              </div>
              <button
                className={`comms-connection-btn ${connections.find(c => c.channel === 'slack')?.status === 'connected' ? 'disconnect' : ''}`}
                onClick={() => {
                  const conn = connections.find(c => c.channel === 'slack');
                  if (conn?.status === 'connected') {
                    actions.disconnectChannel('slack');
                  } else {
                    actions.connectSlack();
                  }
                }}
              >
                {connections.find(c => c.channel === 'slack')?.status === 'connected' ?
                  <><Unlink size={13} /> Disconnect</> :
                  <><Link2 size={13} /> Add to Slack</>
                }
              </button>
            </div>

            {/* Teams */}
            <div className="comms-connection-card">
              <div className="comms-connection-icon" style={{ background: '#6264A7' }}>
                <Users size={20} />
              </div>
              <div className="comms-connection-info">
                <h4>Microsoft Teams</h4>
                <p>Microsoft Graph API · OAuth2</p>
                {connections.find(c => c.channel === 'teams')?.status === 'connected' ? (
                  <span className="comms-connection-status connected">
                    <CheckCircle size={12} /> Connected
                    {connections.find(c => c.channel === 'teams')?.accountName &&
                      ` · ${connections.find(c => c.channel === 'teams')?.accountName}`
                    }
                  </span>
                ) : (
                  <span className="comms-connection-status">Not connected</span>
                )}
              </div>
              <button
                className={`comms-connection-btn ${connections.find(c => c.channel === 'teams')?.status === 'connected' ? 'disconnect' : ''}`}
                onClick={() => {
                  const conn = connections.find(c => c.channel === 'teams');
                  if (conn?.status === 'connected') {
                    actions.disconnectChannel('teams');
                  } else {
                    actions.connectTeams();
                  }
                }}
              >
                {connections.find(c => c.channel === 'teams')?.status === 'connected' ?
                  <><Unlink size={13} /> Disconnect</> :
                  <><Link2 size={13} /> Connect</>
                }
              </button>
            </div>
          </div>

          {!backendConnected && (
            <div className="comms-connections-note">
              <Lightbulb size={14} />
              <span>
                <strong>Demo Mode:</strong> The backend server isn't running. Start it with{' '}
                <code>cd server && npm install && npm run dev</code> to enable live integrations.
                You'll also need to add your API keys to <code>server/.env</code>.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── STYLE ANALYSIS (inside connections panel) ── */}
      {showConnections && (
        <div className="comms-style-section">
          {!styleAnalyzed && !isAnalyzingStyle && (
            <div className="comms-style-banner">
              <div className="comms-style-banner-icon">
                <Sparkles size={18} />
              </div>
              <div className="comms-style-banner-info">
                <h4>Learn Your Communication Style</h4>
                <p>We'll analyze how you write to different people — tone, formality, greeting style, and language patterns. <strong>We never store message content</strong>, only style characteristics.</p>
              </div>
              <button className="comms-btn comms-btn-primary" onClick={() => actions.analyzeStyle()}>
                <Brain size={15} />
                <span>Analyze Style</span>
              </button>
            </div>
          )}
          {isAnalyzingStyle && (
            <div className="comms-style-analyzing">
              <Loader2 size={20} className="comms-spin" />
              <div>
                <h4>Analyzing your communication style...</h4>
                <p>Learning tone, formality, and language patterns. No message content is stored.</p>
              </div>
            </div>
          )}
          {styleAnalyzed && styleProfiles.length > 0 && (
            <div className="comms-style-complete">
              <div className="comms-style-complete-header">
                <CheckCircle size={16} />
                <span>Style learned for <strong>{styleProfiles.length}</strong> contacts — AI drafts will now match your writing style</span>
              </div>
              <div className="comms-style-profiles-grid">
                {styleProfiles.slice(0, 6).map(profile => (
                  <div key={profile.contactName} className="comms-style-profile-card">
                    <div className="comms-style-profile-top">
                      <span className="comms-style-profile-name">{profile.contactName}</span>
                      <span className={`comms-style-confidence ${profile.styleConfidence >= 90 ? 'high' : profile.styleConfidence >= 70 ? 'medium' : 'low'}`}>
                        {profile.styleConfidence}%
                      </span>
                    </div>
                    <div className="comms-style-profile-traits">
                      <span className="comms-style-trait">{profile.formality}</span>
                      <span className="comms-style-trait">{profile.averageLength}</span>
                      <span className="comms-style-trait">{profile.usesContractions ? 'contractions' : 'formal'}</span>
                      <span className="comms-style-trait">{profile.paragraphStyle.replace(/_/g, ' ')}</span>
                      {profile.emojiUsage !== 'none' && (
                        <span className="comms-style-trait">{profile.emojiUsage} emoji</span>
                      )}
                      {profile.humorStyle !== 'none' && (
                        <span className="comms-style-trait">{profile.humorStyle.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    <div className="comms-style-profile-detail">
                      <span>Greeting: "{profile.greetingStyle}" · Closing: "{profile.closingStyle}"</span>
                    </div>
                    <div className="comms-style-profile-detail">
                      <span>~{profile.avgWordsPerMessage} words/msg · {profile.messageCount} messages analyzed</span>
                    </div>
                  </div>
                ))}
              </div>
              {styleProfiles.length > 6 && (
                <div className="comms-style-more">
                  +{styleProfiles.length - 6} more profiles
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── VIP CONTACTS PANEL ────────────────────────── */}
      {showVIPPanel && (
        <div className="comms-vip-panel">
          <div className="comms-vip-panel-header">
            <h3><Crown size={16} /> VIP Contacts</h3>
            <p>Messages from VIP contacts won't be auto-replied to. You'll get a notification to handle them personally.</p>
          </div>

          {vipContacts.length > 0 && (
            <div className="comms-vip-list">
              {vipContacts.map(contact => (
                <div key={contact.id} className="comms-vip-item">
                  <div className="comms-vip-avatar" style={{ background: contact.avatarColor }}>
                    {contact.initials}
                  </div>
                  <div className="comms-vip-info">
                    <span className="comms-vip-name">{contact.name}</span>
                    {contact.email && <span className="comms-vip-email">{contact.email}</span>}
                  </div>
                  <button
                    className="comms-vip-remove-btn"
                    onClick={() => actions.removeVIPContact(contact.id)}
                    title="Remove VIP"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {vipContacts.length === 0 && (
            <div className="comms-vip-empty">
              <Shield size={28} />
              <p>No VIP contacts yet. Add people you want to handle personally.</p>
            </div>
          )}

          <div className="comms-vip-add-section">
            <h4><UserPlus size={14} /> Add from your contacts</h4>
            <div className="comms-vip-suggestions">
              {uniqueContacts.slice(0, 12).map(c => (
                <button
                  key={c.name}
                  className="comms-vip-suggestion-btn"
                  onClick={() => actions.addVIPContact(c)}
                >
                  <Plus size={12} />
                  <span>{c.name}</span>
                </button>
              ))}
              {uniqueContacts.length === 0 && (
                <span className="comms-vip-no-suggestions">All contacts are already VIP</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── AI ENGINE PANEL ──────────────────────────── */}
      {showAIInsights && (
        <div className="comms-ai-engine-panel">
          <div className="comms-ai-engine-header">
            <h3><Brain size={16} /> AI Response Engine</h3>
            <p>Custom multi-stage pipeline: Analyze → Context → Strategy → Generate → Score</p>
          </div>

          <div className="comms-ai-pipeline">
            <div className="comms-ai-stage">
              <div className="comms-ai-stage-icon" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
                <Target size={16} />
              </div>
              <div className="comms-ai-stage-info">
                <h4>1. Message Analysis</h4>
                <p>Intent classification, sentiment detection, urgency scoring, entity extraction</p>
              </div>
            </div>
            <div className="comms-ai-stage-arrow"><ChevronRight size={14} /></div>

            <div className="comms-ai-stage">
              <div className="comms-ai-stage-icon" style={{ background: '#DBEAFE', color: '#2563EB' }}>
                <BarChart3 size={16} />
              </div>
              <div className="comms-ai-stage-info">
                <h4>2. Context Building</h4>
                <p>Sender relationship, conversation history, org context, user preferences</p>
              </div>
            </div>
            <div className="comms-ai-stage-arrow"><ChevronRight size={14} /></div>

            <div className="comms-ai-stage">
              <div className="comms-ai-stage-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <Lightbulb size={16} />
              </div>
              <div className="comms-ai-stage-info">
                <h4>3. Strategy Selection</h4>
                <p>Channel-specific tone, intent-based response templates, common-sense rules</p>
              </div>
            </div>
            <div className="comms-ai-stage-arrow"><ChevronRight size={14} /></div>

            <div className="comms-ai-stage">
              <div className="comms-ai-stage-icon" style={{ background: '#FCE7F3', color: '#DB2777' }}>
                <Sparkles size={16} />
              </div>
              <div className="comms-ai-stage-info">
                <h4>4. Draft Generation</h4>
                <p>GPT-4o powered with custom system prompts, user voice matching, safety guardrails</p>
              </div>
            </div>
            <div className="comms-ai-stage-arrow"><ChevronRight size={14} /></div>

            <div className="comms-ai-stage">
              <div className="comms-ai-stage-icon" style={{ background: '#D1FAE5', color: '#059669' }}>
                <Shield size={16} />
              </div>
              <div className="comms-ai-stage-info">
                <h4>5. Quality Scoring</h4>
                <p>Key-point coverage, tone alignment, length check, safety validation</p>
              </div>
            </div>
          </div>

          <div className="comms-ai-features">
            <h4>Common Sense Rules</h4>
            <div className="comms-ai-rules">
              <div className="comms-ai-rule">
                <Shield size={13} />
                <span>Never auto-approves budgets or large commitments</span>
              </div>
              <div className="comms-ai-rule">
                <Clock size={13} />
                <span>Won't commit to hard deadlines without user confirmation</span>
              </div>
              <div className="comms-ai-rule">
                <Target size={13} />
                <span>Adapts tone per channel — formal for email, casual for Slack</span>
              </div>
              <div className="comms-ai-rule">
                <Brain size={13} />
                <span>Learns from user edits to improve future responses</span>
              </div>
              <div className="comms-ai-rule">
                <AlertCircle size={13} />
                <span>Flags suspicious or unusual requests for human review</span>
              </div>
              <div className="comms-ai-rule">
                <MessageCircle size={13} />
                <span>Considers conversation history and relationship context</span>
              </div>
            </div>
          </div>

          {/* Show last analysis if available */}
          {lastAnalysis && (
            <div className="comms-ai-last-analysis">
              <h4><TrendingUp size={13} /> Last Analysis</h4>
              <div className="comms-ai-analysis-details">
                <span>Intent: <strong>{lastAnalysis.analysis?.intent?.replace(/_/g, ' ')}</strong></span>
                <span>Confidence: <strong>{lastAnalysis.confidence}%</strong></span>
                <span>Sentiment: <strong>{lastAnalysis.analysis?.sentiment}</strong></span>
                <span>Urgency: <strong>{lastAnalysis.analysis?.urgency}/10</strong></span>
              </div>
              <p className="comms-ai-reasoning">{lastAnalysis.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── EMPTY STATE (no connections) ──────────────── */}
      {isEmpty && !showConnections && (
        <div className="comms-empty-state">
          <div className="comms-empty-icon">
            <Mail size={48} />
          </div>
          <h2 className="comms-empty-title">Connect your accounts</h2>
          <p className="comms-empty-description">
            Link your email, Slack, or Teams accounts to let the AI agent manage your communications. Messages will appear here once connected.
          </p>
          <div className="comms-empty-channels">
            <div className="comms-empty-channel">
              <div className="comms-empty-channel-icon" style={{ background: '#EA4335' }}>
                <Mail size={20} />
              </div>
              <span>Gmail</span>
            </div>
            <div className="comms-empty-channel">
              <div className="comms-empty-channel-icon" style={{ background: '#4A154B' }}>
                <Hash size={20} />
              </div>
              <span>Slack</span>
            </div>
            <div className="comms-empty-channel">
              <div className="comms-empty-channel-icon" style={{ background: '#6264A7' }}>
                <Users size={20} />
              </div>
              <span>Teams</span>
            </div>
          </div>
          <button
            className="comms-btn comms-btn-primary comms-empty-btn"
            onClick={() => { setShowConnections(true); setShowAIInsights(false); setShowVIPPanel(false); }}
          >
            <Link2 size={16} />
            <span>Connect Your Accounts</span>
          </button>
        </div>
      )}

      {/* ─── CHANNEL TABS ────────────────────────────── */}
      {!isEmpty && (<>
      <div className="comms-channels-row">
        <div className="comms-channel-tabs">
          {channelTabs.map(tab => (
            <button
              key={tab.id}
              className={`comms-channel-tab ${activeChannel === tab.id ? 'active' : ''}`}
              onClick={() => actions.setActiveChannel(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="comms-channel-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="comms-toolbar">
          <div className="comms-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => actions.setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="comms-search-clear" onClick={() => actions.setSearchQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
          <button
            className={`comms-filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} />
            <span>Filter</span>
          </button>
        </div>
      </div>

      {/* ─── FILTER BAR ──────────────────────────────── */}
      {showFilters && (
        <div className="comms-filter-bar">
          <div className="comms-filter-group">
            <label>Priority:</label>
            <div className="comms-filter-options">
              {(['all', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  className={`comms-filter-option ${filterPriority === p ? 'active' : ''}`}
                  onClick={() => actions.setFilterPriority(p)}
                >
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="comms-filter-group">
            <label>Status:</label>
            <div className="comms-filter-options">
              {(['all', 'pending', 'ai_drafted', 'sent'] as const).map(s => (
                <button
                  key={s}
                  className={`comms-filter-option ${filterStatus === s ? 'active' : ''}`}
                  onClick={() => actions.setFilterStatus(s)}
                >
                  {s === 'all' ? 'All' : statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ERROR BAR ───────────────────────────────── */}
      {error && (
        <div className="comms-error-bar">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={() => {}}>×</button>
        </div>
      )}

      {/* ─── CONTENT AREA ────────────────────────────── */}
      <div className="comms-content">
        {/* ─── MESSAGE LIST ──────────────────────────── */}
        <div className="comms-list">
          {isLoading ? (
            <div className="comms-list-empty">
              <Loader2 size={32} className="comms-spin" />
              <h3>Loading messages...</h3>
            </div>
          ) : messages.length === 0 ? (
            <div className="comms-list-empty">
              <Mail size={40} />
              <h3>No messages found</h3>
              <p>Try adjusting your filters or connect your accounts</p>
            </div>
          ) : (
            <>
              {/* ── Channel Group Summaries ─────────────── */}
              {channelGroups.length > 0 && (
                <div className="comms-channel-groups">
                  <div className="comms-channel-groups-header">
                    <Layers size={13} />
                    <span>Group Channels</span>
                    <span className="comms-channel-groups-count">
                      {channelGroups.reduce((sum, g) => sum + g.relevantMessages.length, 0)} mentions
                    </span>
                  </div>
                  {channelGroups.map(group => {
                    const isExpanded = expandedGroupId === group.id;
                    const expandedMsgs = isExpanded && expandedImportance
                      ? group[expandedImportance]
                      : [];

                    return (
                      <div key={group.id} className={`comms-group-card ${isExpanded ? 'expanded' : ''}`}>
                        {/* Group header */}
                        <div className="comms-group-card-header">
                          <div className="comms-group-card-icon" style={{ background: channelColors[group.channel] }}>
                            {channelIcons[group.channel]}
                          </div>
                          <div className="comms-group-card-info">
                            <div className="comms-group-card-title">
                              {channelLabels[group.channel]} · {group.channelName}
                            </div>
                            <div className="comms-group-card-meta">
                              <AtSign size={11} />
                              <span>
                                <strong>{group.relevantMessages.length}</strong> messages mention you
                              </span>
                              <span className="comms-group-card-total">
                                ({group.totalInChannel} total in channel)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Importance breakdown */}
                        <div className="comms-group-importance">
                          {group.high.length > 0 && (
                            <div
                              className={`comms-importance-row ${isExpanded && expandedImportance === 'high' ? 'active' : ''}`}
                              onClick={() => actions.expandGroup(group.id, 'high')}
                            >
                              <span className="comms-importance-dot" style={{ background: '#EF4444' }} />
                              <span className="comms-importance-count">{group.high.length}</span>
                              <span className="comms-importance-label">High importance</span>
                              <span className="comms-importance-tag needs-input">
                                <AlertCircle size={10} /> Needs your input
                              </span>
                              <span className="comms-importance-view-btn">
                                {isExpanded && expandedImportance === 'high' ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                                View
                              </span>
                            </div>
                          )}
                          {group.medium.length > 0 && (
                            <div
                              className={`comms-importance-row ${isExpanded && expandedImportance === 'medium' ? 'active' : ''}`}
                              onClick={() => actions.expandGroup(group.id, 'medium')}
                            >
                              <span className="comms-importance-dot" style={{ background: '#F59E0B' }} />
                              <span className="comms-importance-count">{group.medium.length}</span>
                              <span className="comms-importance-label">Medium importance</span>
                              <span className="comms-importance-tag ai-ready">
                                <Sparkles size={10} /> AI drafts ready
                              </span>
                              <span className="comms-importance-view-btn">
                                {isExpanded && expandedImportance === 'medium' ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                                View
                              </span>
                            </div>
                          )}
                          {group.low.length > 0 && (
                            <div
                              className={`comms-importance-row ${isExpanded && expandedImportance === 'low' ? 'active' : ''}`}
                              onClick={() => actions.expandGroup(group.id, 'low')}
                            >
                              <span className="comms-importance-dot" style={{ background: '#10B981' }} />
                              <span className="comms-importance-count">{group.low.length}</span>
                              <span className="comms-importance-label">Low importance</span>
                              <span className="comms-importance-tag ai-ready">
                                <Sparkles size={10} /> AI drafts ready
                              </span>
                              <span className="comms-importance-view-btn">
                                {isExpanded && expandedImportance === 'low' ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                                View
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expanded messages */}
                        {isExpanded && expandedMsgs.length > 0 && (
                          <div className="comms-group-expanded-messages">
                            {expandedMsgs.map(msg => (
                              <div
                                key={msg.id}
                                className={`comms-group-msg-item ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                                onClick={() => handleSelectMessage(msg)}
                              >
                                <div className="comms-group-msg-avatar" style={{ background: msg.fromColor }}>
                                  {msg.fromInitial}
                                </div>
                                <div className="comms-group-msg-content">
                                  <div className="comms-group-msg-top">
                                    <span className="comms-group-msg-from">{msg.from}</span>
                                    <span className="comms-group-msg-time">{msg.relativeTime}</span>
                                  </div>
                                  <p className="comms-group-msg-preview">{msg.preview}</p>
                                  <div className="comms-group-msg-badges">
                                    <span className={`comms-status-badge status-${msg.status}`}>
                                      {statusIcons[msg.status]}
                                      <span>{statusLabels[msg.status]}</span>
                                    </span>
                                    {msg.status === 'escalated' && (
                                      <span className="comms-needs-input-badge">
                                        <AlertCircle size={10} /> Respond manually
                                      </span>
                                    )}
                                    {msg.aiDraft && (
                                      <span className="comms-ai-ready-badge">
                                        <Sparkles size={10} /> AI draft
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Separator between groups and individual msgs ── */}
              {channelGroups.length > 0 && individualMessages.length > 0 && (
                <div className="comms-list-separator">
                  <Mail size={12} />
                  <span>Direct Messages</span>
                </div>
              )}

              {/* ── Individual Messages (non-group) ──────── */}
              {individualMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`comms-list-item ${selectedMessage?.id === msg.id ? 'selected' : ''} ${
                    msg.status === 'pending' ? 'unread' : ''
                  }`}
                  onClick={() => handleSelectMessage(msg)}
                >
                  <div className="comms-list-item-left">
                    <div className="comms-list-avatar" style={{ background: msg.fromColor }}>
                      {msg.fromInitial}
                    </div>
                    <div className="comms-list-item-content">
                      <div className="comms-list-item-top">
                        <span className="comms-list-from">{msg.from}</span>
                        <div className="comms-list-meta">
                          <span
                            className="comms-list-channel-badge"
                            style={{ color: channelColors[msg.channel] }}
                          >
                            {channelIcons[msg.channel]}
                            <span>{channelLabels[msg.channel]}</span>
                          </span>
                          <span className="comms-list-time">{msg.relativeTime}</span>
                        </div>
                      </div>
                      {msg.subject && <div className="comms-list-subject">{msg.subject}</div>}
                      {msg.slackChannel && (
                        <div className="comms-list-channel-name">
                          <Hash size={12} /> {msg.slackChannel}
                        </div>
                      )}
                      {msg.teamsChannel && (
                        <div className="comms-list-channel-name">
                          <Users size={12} /> {msg.teamsChannel}
                        </div>
                      )}
                      <div className="comms-list-preview">{msg.preview}</div>
                      <div className="comms-list-item-bottom">
                        {actions.isVIP(msg.from) || (msg.fromEmail && actions.isVIP(msg.fromEmail)) ? (
                          <span className="comms-vip-badge">
                            <Crown size={10} />
                            <span>VIP</span>
                          </span>
                        ) : null}
                        <span className={`comms-status-badge status-${msg.status}`}>
                          {statusIcons[msg.status]}
                          <span>{statusLabels[msg.status]}</span>
                        </span>
                        <span
                          className="comms-priority-dot"
                          style={{ background: priorityColors[msg.priority] }}
                          title={`${msg.priority} priority`}
                        />
                        {msg.attachments && msg.attachments.length > 0 && (
                          <span className="comms-list-attachment-count">
                            <Paperclip size={12} />
                            {msg.attachments.length}
                          </span>
                        )}
                        {msg.threadCount && (
                          <span className="comms-list-thread-count">
                            <MessageSquare size={12} />
                            {msg.threadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`comms-star-btn ${msg.starred ? 'starred' : ''}`}
                    onClick={e => handleToggleStar(msg.id, e)}
                  >
                    <Star size={14} fill={msg.starred ? '#F59E0B' : 'none'} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ─── MESSAGE DETAIL ────────────────────────── */}
        <div className="comms-detail">
          {selectedMessage ? (
            <>
              {/* Detail Header */}
              <div className="comms-detail-header">
                <div className="comms-detail-header-top">
                  <div className="comms-detail-from-row">
                    <div
                      className="comms-detail-avatar"
                      style={{ background: selectedMessage.fromColor }}
                    >
                      {selectedMessage.fromInitial}
                    </div>
                    <div className="comms-detail-from-info">
                      <span className="comms-detail-from">{selectedMessage.from}</span>
                      <span className="comms-detail-time">
                        {selectedMessage.receivedTime} · {selectedMessage.relativeTime}
                      </span>
                    </div>
                  </div>
                  <div className="comms-detail-actions">
                    <button className="comms-detail-action" title="Archive"><Archive size={16} /></button>
                    <button className="comms-detail-action" title="Delete"><Trash2 size={16} /></button>
                    <button className="comms-detail-action" title="More"><MoreHorizontal size={16} /></button>
                  </div>
                </div>
                <div className="comms-detail-badges">
                  <span
                    className="comms-detail-channel"
                    style={{
                      background: `${channelColors[selectedMessage.channel]}15`,
                      color: channelColors[selectedMessage.channel],
                    }}
                  >
                    {channelIcons[selectedMessage.channel]}
                    <span>
                      {channelLabels[selectedMessage.channel]}
                      {selectedMessage.slackChannel && ` · ${selectedMessage.slackChannel}`}
                      {selectedMessage.teamsChannel && ` · ${selectedMessage.teamsChannel}`}
                    </span>
                  </span>
                  <span
                    className="comms-detail-priority"
                    style={{
                      background: `${priorityColors[selectedMessage.priority]}15`,
                      color: priorityColors[selectedMessage.priority],
                    }}
                  >
                    <AlertCircle size={13} />
                    <span>{selectedMessage.priority.charAt(0).toUpperCase() + selectedMessage.priority.slice(1)} Priority</span>
                  </span>
                  <span className={`comms-status-badge status-${selectedMessage.status}`}>
                    {statusIcons[selectedMessage.status]}
                    <span>{statusLabels[selectedMessage.status]}</span>
                  </span>
                </div>
                {selectedMessage.subject && (
                  <h2 className="comms-detail-subject">{selectedMessage.subject}</h2>
                )}
              </div>

              {/* Original Message */}
              <div className="comms-detail-body">
                <div className="comms-detail-section">
                  <div className="comms-detail-section-header">
                    <Eye size={14} />
                    <span>Original Message</span>
                  </div>
                  <div className="comms-detail-message">
                    {selectedMessage.fullMessage.split('\n').map((line, i) => (
                      <p key={i}>{line || '\u00A0'}</p>
                    ))}
                  </div>
                  {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                    <div className="comms-detail-attachments">
                      {selectedMessage.attachments.map(att => (
                        <div key={att.name} className="comms-attachment-chip">
                          <Paperclip size={13} />
                          <span className="comms-attachment-name">{att.name}</span>
                          <span className="comms-attachment-size">{att.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Draft */}
                <div className="comms-detail-section comms-ai-section">
                  <div className="comms-detail-section-header">
                    <Sparkles size={14} />
                    <span>AI Draft Response</span>
                    {selectedMessage.aiConfidence && (
                      <span className="comms-ai-confidence">
                        {selectedMessage.aiConfidence}% confidence
                      </span>
                    )}
                    {backendConnected && (
                      <span className="comms-ai-live-badge">
                        <Wifi size={10} /> Live AI
                      </span>
                    )}
                  </div>

                  {selectedMessage.status === 'pending' && !isGenerating ? (
                    <div className="comms-ai-empty">
                      <Bot size={32} />
                      <p>No AI draft generated yet</p>
                      <button
                        className="comms-btn comms-btn-primary"
                        onClick={() => handleGenerateAIDraft(selectedMessage.id)}
                      >
                        <Sparkles size={15} />
                        <span>Generate AI Draft</span>
                      </button>
                    </div>
                  ) : isGenerating ? (
                    <div className="comms-ai-generating">
                      <div className="comms-ai-spinner" />
                      <div className="comms-ai-generating-text">
                        <span>AI is composing a response...</span>
                        <span className="comms-ai-generating-detail">
                          Analyzing intent → Building context → Generating draft
                        </span>
                      </div>
                    </div>
                  ) : selectedMessage.aiDraft ? (
                    <>
                      {editingDraft ? (
                        <div className="comms-ai-editor">
                          <textarea
                            className="comms-ai-textarea"
                            value={draftText}
                            onChange={e => setDraftText(e.target.value)}
                            rows={8}
                          />
                          <div className="comms-ai-editor-actions">
                            <button
                              className="comms-btn comms-btn-secondary"
                              onClick={() => setEditingDraft(false)}
                            >
                              Cancel
                            </button>
                            <button className="comms-btn comms-btn-primary" onClick={handleSaveDraft}>
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="comms-ai-draft">
                          {selectedMessage.aiDraft.split('\n').map((line, i) => (
                            <p key={i}>{line || '\u00A0'}</p>
                          ))}
                        </div>
                      )}

                      {/* Draft Actions */}
                      {!editingDraft && selectedMessage.status !== 'sent' && (
                        <div className="comms-ai-actions">
                          <button
                            className="comms-ai-action-btn edit"
                            onClick={() => {
                              setDraftText(selectedMessage.aiDraft || '');
                              setEditingDraft(true);
                            }}
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="comms-ai-action-btn regenerate"
                            onClick={() => handleRegenerateDraft(selectedMessage.id)}
                          >
                            <RotateCcw size={14} />
                            <span>Regenerate</span>
                          </button>
                          <button
                            className="comms-ai-action-btn copy"
                            onClick={() => navigator.clipboard.writeText(selectedMessage.aiDraft || '')}
                          >
                            <Copy size={14} />
                            <span>Copy</span>
                          </button>
                          <div className="comms-ai-actions-divider" />
                          {selectedMessage.status === 'ai_drafted' && (
                            <button
                              className="comms-ai-action-btn approve"
                              onClick={() => handleApproveDraft(selectedMessage.id)}
                            >
                              <CheckCircle size={14} />
                              <span>Approve</span>
                            </button>
                          )}
                          {(selectedMessage.status === 'ai_drafted' ||
                            selectedMessage.status === 'approved') && (
                            <button
                              className="comms-ai-action-btn send"
                              onClick={() => handleSendDraft(selectedMessage.id)}
                            >
                              <Send size={14} />
                              <span>Send</span>
                            </button>
                          )}
                        </div>
                      )}

                      {selectedMessage.status === 'sent' && (
                        <div className="comms-sent-banner">
                          <CheckCircle size={16} />
                          <span>Response sent successfully</span>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="comms-detail-empty">
              <Mail size={48} />
              <h3>Select a message</h3>
              <p>Choose a message from the list to view details and AI-generated responses</p>
            </div>
          )}
        </div>
      </div>
      </>)}

      {/* ─── NOTIFICATION STACK (fixed bottom-right) ──── */}
      {(vipNotifications.length > 0 || approvalQueue.length > 0) && (
        <div className="notification-stack">
          {vipNotifications.map(notif => (
            <VIPNotificationPopup
              key={notif.id}
              notification={notif}
              onView={(id) => actions.viewVIPNotification(id)}
              onDismiss={(id) => actions.dismissVIPNotification(id)}
            />
          ))}
          {approvalQueue.length > 0 && (
            <ApprovalPopup
              items={approvalQueue}
              onApprove={(id) => actions.approveItem(id)}
              onReview={(id) => actions.reviewItem(id)}
              onCancel={(id) => actions.cancelItem(id)}
            />
          )}
        </div>
      )}
    </div>
  );
}
