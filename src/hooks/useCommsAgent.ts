/* ═══════════════════════════════════════════════════════════
   useCommsAgent — React hook for the Communications Agent
   
   Manages:
   - Message fetching & real-time state
   - Connection status for Gmail, Slack, Teams
   - AI draft generation & sending
   - Backend health check with graceful fallback to mock data
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessagesAPI,
  ConnectionsAPI,
  AIAPI,
  checkBackendHealth,
  type UnifiedMessage,
  type ChannelConnection,
  type Channel,
  type MessageStatus,
  type Priority,
  type AIConfig,
  type GeneratedDraft,
} from '../services/commsApi';

/* ─── Types ────────────────────────────────────────────── */

export interface CommsAgentState {
  // Messages
  messages: UnifiedMessage[];
  selectedMessage: UnifiedMessage | null;
  totalMessages: number;
  channelCounts: Record<Channel, number>;

  // Filters
  activeChannel: Channel | 'all';
  searchQuery: string;
  filterPriority: Priority | 'all';
  filterStatus: MessageStatus | 'all';

  // Connections
  connections: ChannelConnection[];

  // AI
  aiConfig: AIConfig | null;
  isGenerating: boolean;
  lastAnalysis: GeneratedDraft | null;

  // UI state
  isLoading: boolean;
  isSyncing: boolean;
  backendConnected: boolean;
  error: string | null;
}

export interface CommsAgentActions {
  // Message actions
  selectMessage: (msg: UnifiedMessage | null) => void;
  starMessage: (id: string) => void;
  updateMessageStatus: (id: string, status: MessageStatus) => void;
  updateMessageDraft: (id: string, draft: string) => void;

  // Filter actions
  setActiveChannel: (ch: Channel | 'all') => void;
  setSearchQuery: (q: string) => void;
  setFilterPriority: (p: Priority | 'all') => void;
  setFilterStatus: (s: MessageStatus | 'all') => void;

  // Backend actions
  syncMessages: () => Promise<void>;
  generateDraft: (messageId: string, feedback?: string) => Promise<GeneratedDraft | null>;
  sendMessage: (messageId: string, draft?: string) => Promise<boolean>;
  autoDraftAll: () => Promise<void>;

  // Connection actions
  connectGmail: () => Promise<void>;
  connectSlack: (token: string) => Promise<void>;
  connectTeams: () => Promise<void>;
  disconnectChannel: (channel: Channel) => Promise<void>;
  refreshConnections: () => Promise<void>;

  // AI config
  updateAIConfig: (config: Partial<AIConfig>) => Promise<void>;
}

/* ─── Mock data fallback ───────────────────────────────── */

const MOCK_MESSAGES: UnifiedMessage[] = [
  {
    id: 'msg-1', externalId: 'ext-1', channel: 'email',
    from: 'Jennifer Walsh', fromEmail: 'jennifer@company.com',
    fromInitial: 'JW', fromColor: '#7C3AED',
    subject: 'Q1 Budget Approval Request',
    preview: 'Hi team, I need approval on the Q1 budget allocation for the AI infrastructure upgrade...',
    fullMessage: 'Hi team,\n\nI need approval on the Q1 budget allocation for the AI infrastructure upgrade. We\'re looking at $45,000 for GPU clusters and $12,000 for additional API credits.\n\nThe breakdown is as follows:\n- 4x NVIDIA A100 GPU rental: $32,000\n- Cloud storage expansion: $8,000\n- API credits (OpenAI, Anthropic): $12,000\n- Monitoring tools: $5,000\n\nPlease review and let me know if you have any questions. I need approval by Friday.\n\nBest regards,\nJennifer Walsh\nVP of Engineering',
    receivedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    receivedTime: '10:34 AM', relativeTime: '2 min ago',
    priority: 'high', status: 'ai_drafted', starred: true,
    aiDraft: 'Hi Jennifer,\n\nThank you for the detailed budget breakdown. The Q1 allocation for AI infrastructure looks well-justified given our scaling needs.\n\nI\'ve reviewed the line items:\n- GPU cluster rental aligns with our projected compute requirements\n- API credit allocation matches our current usage trends\n- Monitoring tools investment will help with cost optimization\n\nI\'m approving this request. Please proceed with procurement and keep me updated on the timeline.\n\nBest regards',
    aiConfidence: 94,
    attachments: [{ name: 'Q1_Budget_AI_Infra.xlsx', size: '245 KB' }],
    threadCount: 3,
  },
  {
    id: 'msg-2', externalId: 'ext-2', channel: 'slack',
    from: 'David Park', fromInitial: 'DP', fromColor: '#3B82F6',
    slackChannel: '#engineering',
    preview: 'Hey everyone, the CI/CD pipeline is failing on the staging branch...',
    fullMessage: 'Hey everyone, the CI/CD pipeline is failing on the staging branch. Looks like a dependency conflict with the new auth module. @team can someone take a look? Tests were passing locally but the Docker build is choking on node_modules resolution.',
    receivedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    receivedTime: '10:28 AM', relativeTime: '8 min ago',
    priority: 'high', status: 'ai_drafted', starred: false,
    aiDraft: 'Hey David, I\'ll take a look at the pipeline issue. Based on the error, it seems like a version mismatch.\n\nQuick fix to try:\n1. Clear the Docker cache: `docker builder prune`\n2. Update the lockfile: `npm ci --legacy-peer-deps`\n3. Check if the auth module specifies a peer dependency we\'re not meeting\n\nI\'ll dig into the logs and update the thread.',
    aiConfidence: 87, threadCount: 7,
  },
  {
    id: 'msg-3', externalId: 'ext-3', channel: 'teams',
    from: 'Sarah Chen', fromInitial: 'SC', fromColor: '#e07a3a',
    teamsChannel: 'Product Launch',
    preview: 'Team, the client demo for Acme Corp is scheduled for Thursday...',
    fullMessage: 'Team, the client demo for Acme Corp is scheduled for Thursday at 2 PM EST. Can everyone confirm availability? We need to showcase:\n\n1. Document AI pipeline\n2. Agent workforce dashboard\n3. Real-time analytics\n\nPlease prepare your sections by Wednesday EOD.',
    receivedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    receivedTime: '10:21 AM', relativeTime: '15 min ago',
    priority: 'medium', status: 'ai_drafted', starred: false,
    aiDraft: 'Hi Sarah,\n\nConfirmed — I\'m available for the Thursday 2 PM EST demo.\n\nI\'ll prepare the technical walkthrough covering:\n- Document AI pipeline architecture\n- Agent workforce dashboard with live monitoring\n- Real-time analytics with performance metrics\n\nEverything will be ready by Wednesday EOD.',
    aiConfidence: 91, threadCount: 4,
  },
  {
    id: 'msg-4', externalId: 'ext-4', channel: 'email',
    from: 'Marcus Johnson', fromInitial: 'MJ', fromColor: '#1a1a2e',
    subject: 'Re: Partnership Proposal — DataFlow Inc.',
    preview: 'Following up on our call last week. DataFlow is interested in integrating their ETL pipeline...',
    fullMessage: 'Hi,\n\nFollowing up on our call last week. DataFlow Inc. is interested in integrating their ETL pipeline with our AI agent platform. They\'re proposing a revenue-sharing model:\n\n- 70/30 split on joint enterprise deals\n- Shared API access for data transformation\n- Co-marketing at 3 industry events this year\n\nTheir CTO wants to schedule a technical deep-dive next week. Are you available Tuesday or Wednesday?\n\nBest,\nMarcus',
    receivedAt: new Date(Date.now() - 32 * 60000).toISOString(),
    receivedTime: '10:04 AM', relativeTime: '32 min ago',
    priority: 'medium', status: 'pending', starred: true,
    attachments: [{ name: 'DataFlow_Partnership_Brief.pdf', size: '1.2 MB' }, { name: 'Revenue_Model.xlsx', size: '89 KB' }],
  },
  {
    id: 'msg-5', externalId: 'ext-5', channel: 'slack',
    from: 'Priya Patel', fromInitial: 'PP', fromColor: '#d46b2c',
    slackChannel: '#design',
    preview: 'Sharing the updated mockups for the agent configuration panel...',
    fullMessage: 'Sharing the updated mockups for the agent configuration panel. Let me know your thoughts:\n\n1. Agent type selection → capabilities config → testing sandbox\n2. Simplified the 5-step wizard down to 3 steps\n3. Added inline validation and preview\n\nFigma link: [Updated Agent Config Mockups]\n\nWould love feedback by tomorrow.',
    receivedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    receivedTime: '9:36 AM', relativeTime: '1 hr ago',
    priority: 'low', status: 'pending', starred: false, threadCount: 2,
  },
  {
    id: 'msg-6', externalId: 'ext-6', channel: 'teams',
    from: 'Alex Rodriguez', fromInitial: 'AR', fromColor: '#3a3a52',
    teamsChannel: 'Security',
    preview: 'Heads up — our SOC2 audit is next month. I need all teams to complete the security checklist...',
    fullMessage: 'Heads up — our SOC2 audit is scheduled for March 15th. I need all teams to complete the security compliance checklist by March 1st.\n\nKey items:\n- Access control review for all production systems\n- Encryption audit for data at rest and in transit\n- Incident response plan update\n- Vendor security assessment for 3rd party integrations\n\nPlease assign an owner from each team.',
    receivedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    receivedTime: '8:36 AM', relativeTime: '2 hrs ago',
    priority: 'high', status: 'pending', starred: false,
  },
  {
    id: 'msg-7', externalId: 'ext-7', channel: 'email',
    from: 'Lisa Nguyen', fromInitial: 'LN', fromColor: '#EC4899',
    subject: 'Interview Panel — Sr. ML Engineer',
    preview: 'Can you join the interview panel for the Sr. ML Engineer candidate this Wednesday?',
    fullMessage: 'Hi,\n\nCan you join the interview panel for the Sr. ML Engineer candidate this Wednesday at 3 PM?\n\nThe candidate has 8 years of experience with PyTorch, TensorFlow, MLOps pipelines, and NLP.\n\nResume attached. Your focus would be on the system design round.\n\nThanks,\nLisa Nguyen\nHead of Talent',
    receivedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    receivedTime: '7:36 AM', relativeTime: '3 hrs ago',
    priority: 'medium', status: 'sent', starred: false,
    aiDraft: 'Hi Lisa,\n\nYes, I\'m available for the Wednesday 3 PM interview panel. I\'ll review the resume beforehand.\n\nFor the system design round, I\'ll prepare questions around:\n- Designing a real-time ML inference pipeline\n- Model serving architecture at scale\n- Feature store design and management\n\nPlease send the calendar invite.',
    aiConfidence: 96,
    attachments: [{ name: 'Candidate_Resume.pdf', size: '340 KB' }],
  },
  {
    id: 'msg-8', externalId: 'ext-8', channel: 'slack',
    from: 'Tom Bradley', fromInitial: 'TB', fromColor: '#10B981',
    slackChannel: '#random',
    preview: 'Who\'s in for team lunch on Friday? Thinking of trying that new ramen place...',
    fullMessage: 'Who\'s in for team lunch on Friday? 🍜 Thinking of trying that new ramen place on 5th street. They apparently have amazing tonkotsu ramen. Let me know by Thursday so I can make a reservation!',
    receivedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    receivedTime: '6:36 AM', relativeTime: '4 hrs ago',
    priority: 'low', status: 'ai_drafted', starred: false,
    aiDraft: 'Count me in! 🍜 Ramen sounds great. I\'m free Friday at noon — let me know the time and I\'ll be there.',
    aiConfidence: 98, threadCount: 12,
  },
];

/* ─── Hook ─────────────────────────────────────────────── */

export function useCommsAgent(): [CommsAgentState, CommsAgentActions] {
  const [messages, setMessages] = useState<UnifiedMessage[]>(MOCK_MESSAGES);
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<GeneratedDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeChannel, setActiveChannel] = useState<Channel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<MessageStatus | 'all'>('all');

  const checkedBackend = useRef(false);

  // Check backend health on mount
  useEffect(() => {
    if (checkedBackend.current) return;
    checkedBackend.current = true;

    checkBackendHealth().then(({ ok }) => {
      setBackendConnected(ok);
      if (ok) {
        // Fetch real data from backend
        loadFromBackend();
      }
      // If backend is not available, we keep using mock data
    });
  }, []);

  // Auto-select first message
  useEffect(() => {
    if (!selectedMessage && messages.length > 0) {
      setSelectedMessage(messages[0]);
    }
  }, [messages]);

  /** Load messages & connections from the backend */
  const loadFromBackend = useCallback(async () => {
    setIsLoading(true);
    try {
      const [msgData, conns, config] = await Promise.all([
        MessagesAPI.getMessages(),
        ConnectionsAPI.getConnections(),
        AIAPI.getConfig(),
      ]);

      if (msgData && msgData.messages.length > 0) {
        setMessages(msgData.messages);
      }
      setConnections(conns);
      if (config) setAiConfig(config);
    } catch (err) {
      console.warn('Backend fetch failed, using mock data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Computed values
  const filteredMessages = messages.filter(m => {
    if (activeChannel !== 'all' && m.channel !== activeChannel) return false;
    if (filterPriority !== 'all' && m.priority !== filterPriority) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.from.toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q) ||
        m.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const channelCounts: Record<Channel, number> = {
    email: messages.filter(m => m.channel === 'email').length,
    slack: messages.filter(m => m.channel === 'slack').length,
    teams: messages.filter(m => m.channel === 'teams').length,
  };

  /* ─── Actions ──────────────────────────────────────── */

  const selectMessage = useCallback((msg: UnifiedMessage | null) => {
    setSelectedMessage(msg);
  }, []);

  const starMessage = useCallback((id: string) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, starred: !m.starred } : m)
    );
    setSelectedMessage(prev =>
      prev && prev.id === id ? { ...prev, starred: !prev.starred } : prev
    );
    if (backendConnected) {
      const msg = messages.find(m => m.id === id);
      if (msg) MessagesAPI.updateMessage(id, { starred: !msg.starred });
    }
  }, [messages, backendConnected]);

  const updateMessageStatus = useCallback((id: string, status: MessageStatus) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, status } : m)
    );
    setSelectedMessage(prev =>
      prev && prev.id === id ? { ...prev, status } : prev
    );
    if (backendConnected) {
      MessagesAPI.updateMessage(id, { status });
    }
  }, [backendConnected]);

  const updateMessageDraft = useCallback((id: string, draft: string) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, aiDraft: draft } : m)
    );
    setSelectedMessage(prev =>
      prev && prev.id === id ? { ...prev, aiDraft: draft } : prev
    );
    if (backendConnected) {
      MessagesAPI.updateMessage(id, { aiDraft: draft } as any);
    }
  }, [backendConnected]);

  const syncMessages = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      if (backendConnected) {
        const result = await MessagesAPI.sync();
        if (result) {
          const msgData = await MessagesAPI.getMessages();
          if (msgData) setMessages(msgData.messages);
        }
      }
    } catch (err) {
      setError('Failed to sync messages');
    } finally {
      setIsSyncing(false);
    }
  }, [backendConnected]);

  const generateDraft = useCallback(async (
    messageId: string,
    feedback?: string
  ): Promise<GeneratedDraft | null> => {
    setIsGenerating(true);
    setError(null);
    try {
      if (backendConnected) {
        const result = await MessagesAPI.generateDraft(messageId, feedback);
        if (result) {
          setMessages(prev =>
            prev.map(m => m.id === messageId
              ? { ...m, aiDraft: result.draft, aiConfidence: result.confidence, status: 'ai_drafted' as MessageStatus }
              : m
            )
          );
          setSelectedMessage(prev =>
            prev && prev.id === messageId
              ? { ...prev, aiDraft: result.draft, aiConfidence: result.confidence, status: 'ai_drafted' as MessageStatus }
              : prev
          );
          setLastAnalysis(result);
          return result;
        }
      } else {
        // Local fallback: simulate AI draft generation
        await new Promise(r => setTimeout(r, 1500));
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
          const draft = generateLocalDraft(msg);
          const confidence = Math.floor(Math.random() * 15) + 82;
          setMessages(prev =>
            prev.map(m => m.id === messageId
              ? { ...m, aiDraft: draft, aiConfidence: confidence, status: 'ai_drafted' as MessageStatus }
              : m
            )
          );
          setSelectedMessage(prev =>
            prev && prev.id === messageId
              ? { ...prev, aiDraft: draft, aiConfidence: confidence, status: 'ai_drafted' as MessageStatus }
              : prev
          );
          return { draft, confidence, analysis: {} as any, reasoning: 'Generated locally' };
        }
      }
      return null;
    } catch (err) {
      setError('Failed to generate draft');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [backendConnected, messages]);

  const sendMessage = useCallback(async (messageId: string, draft?: string): Promise<boolean> => {
    try {
      if (backendConnected) {
        const sent = await MessagesAPI.sendDraft(messageId, draft);
        if (sent) {
          updateMessageStatus(messageId, 'sent');
        }
        return sent;
      } else {
        // Local: just update status
        updateMessageStatus(messageId, 'sent');
        return true;
      }
    } catch {
      setError('Failed to send message');
      return false;
    }
  }, [backendConnected, updateMessageStatus]);

  const autoDraftAll = useCallback(async () => {
    setIsGenerating(true);
    try {
      if (backendConnected) {
        await MessagesAPI.autoDraftAll();
        const msgData = await MessagesAPI.getMessages();
        if (msgData) setMessages(msgData.messages);
      } else {
        // Local fallback: generate drafts for all pending
        const pending = messages.filter(m => m.status === 'pending');
        for (const msg of pending) {
          await generateDraft(msg.id);
        }
      }
    } catch {
      setError('Failed to auto-draft messages');
    } finally {
      setIsGenerating(false);
    }
  }, [backendConnected, messages, generateDraft]);

  // Connection actions
  const connectGmail = useCallback(async () => {
    if (!backendConnected) return;
    const authUrl = await ConnectionsAPI.connectGmail();
    if (authUrl) window.open(authUrl, '_blank', 'width=600,height=700');
  }, [backendConnected]);

  const connectSlack = useCallback(async (token: string) => {
    if (!backendConnected) return;
    await ConnectionsAPI.connectSlack(token);
    const conns = await ConnectionsAPI.getConnections();
    setConnections(conns);
  }, [backendConnected]);

  const connectTeams = useCallback(async () => {
    if (!backendConnected) return;
    const authUrl = await ConnectionsAPI.connectTeams();
    if (authUrl) window.open(authUrl, '_blank', 'width=600,height=700');
  }, [backendConnected]);

  const disconnectChannel = useCallback(async (channel: Channel) => {
    if (!backendConnected) return;
    await ConnectionsAPI.disconnect(channel);
    const conns = await ConnectionsAPI.getConnections();
    setConnections(conns);
  }, [backendConnected]);

  const refreshConnections = useCallback(async () => {
    if (!backendConnected) return;
    const conns = await ConnectionsAPI.getConnections();
    setConnections(conns);
  }, [backendConnected]);

  const updateAIConfig = useCallback(async (config: Partial<AIConfig>) => {
    if (backendConnected) {
      const updated = await AIAPI.updateConfig(config);
      if (updated) setAiConfig(updated);
    }
  }, [backendConnected]);

  const state: CommsAgentState = {
    messages: filteredMessages,
    selectedMessage,
    totalMessages: messages.length,
    channelCounts,
    activeChannel,
    searchQuery,
    filterPriority,
    filterStatus,
    connections,
    aiConfig,
    isGenerating,
    lastAnalysis,
    isLoading,
    isSyncing,
    backendConnected,
    error,
  };

  const actions: CommsAgentActions = {
    selectMessage,
    starMessage,
    updateMessageStatus,
    updateMessageDraft,
    setActiveChannel,
    setSearchQuery,
    setFilterPriority,
    setFilterStatus,
    syncMessages,
    generateDraft,
    sendMessage,
    autoDraftAll,
    connectGmail,
    connectSlack,
    connectTeams,
    disconnectChannel,
    refreshConnections,
    updateAIConfig,
  };

  return [state, actions];
}

/* ─── Local draft generation (when backend unavailable) ── */

function generateLocalDraft(msg: UnifiedMessage): string {
  const name = msg.from.split(' ')[0];
  const isEmail = msg.channel === 'email';
  const greeting = isEmail ? `Hi ${name},\n\n` : '';
  const closing = isEmail ? '\n\nBest regards' : '';
  const text = msg.fullMessage.toLowerCase();

  if (text.includes('approve') || text.includes('budget')) {
    return `${greeting}Thank you for the detailed breakdown. I've reviewed the items and they align with our current priorities.\n\nLet me coordinate with the team and get back to you with a decision by end of day.${closing}`;
  }
  if (text.includes('pipeline') || text.includes('error') || text.includes('bug')) {
    return `${greeting}I'll take a look at this right away. A few things to try:\n\n1. Clear cached state and retry\n2. Check the logs for more specific errors\n3. Verify recent configuration changes\n\nI'll update once I have more details.${closing}`;
  }
  if (text.includes('demo') || text.includes('meeting') || text.includes('schedule')) {
    return `${greeting}Confirmed — I'm available and will have everything prepared ahead of time.\n\nLet me know if there's any specific focus area you'd like me to cover.${closing}`;
  }
  if (text.includes('lunch') || text.includes('social') || text.includes('fun')) {
    return `Count me in! Sounds great. 👍`;
  }
  return `${greeting}Thank you for your message. I've reviewed the details and will follow up shortly with a comprehensive response.${closing}`;
}

