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
  type ApprovalItem,
  type VIPContact,
  type VIPNotification,
  type StyleProfile,
  type ChannelGroupSummary,
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

  // Approval queue
  approvalQueue: ApprovalItem[];

  // VIP contacts
  vipContacts: VIPContact[];
  vipNotifications: VIPNotification[];

  // Style analysis
  styleProfiles: StyleProfile[];
  isAnalyzingStyle: boolean;
  styleAnalyzed: boolean;

  // Channel groups (group chat summaries)
  channelGroups: ChannelGroupSummary[];
  individualMessages: UnifiedMessage[];
  expandedGroupId: string | null;
  expandedImportance: Priority | null;

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

  // Approval queue actions
  approveItem: (approvalId: string) => Promise<void>;
  reviewItem: (approvalId: string) => void;
  cancelItem: (approvalId: string) => void;

  // VIP contact actions
  addVIPContact: (contact: { name: string; email?: string; channel?: Channel }) => void;
  removeVIPContact: (id: string) => void;
  isVIP: (nameOrEmail: string) => boolean;

  // VIP notification actions
  dismissVIPNotification: (id: string) => void;
  viewVIPNotification: (id: string) => void;

  // Style analysis
  analyzeStyle: () => Promise<void>;

  // Channel group actions
  expandGroup: (groupId: string, importance: Priority) => void;
  collapseGroup: () => void;
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
    isGroupChat: true, mentionsUser: true,
    preview: 'Hey everyone, the CI/CD pipeline is failing on the staging branch. @you can you check?',
    fullMessage: 'Hey everyone, the CI/CD pipeline is failing on the staging branch. Looks like a dependency conflict with the new auth module. @you can someone take a look? Tests were passing locally but the Docker build is choking on node_modules resolution.',
    receivedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    receivedTime: '10:28 AM', relativeTime: '8 min ago',
    priority: 'high', status: 'pending', starred: false,
    threadCount: 7,
  },
  {
    id: 'msg-3', externalId: 'ext-3', channel: 'teams',
    from: 'Sarah Chen', fromInitial: 'SC', fromColor: '#e07a3a',
    teamsChannel: 'Product Launch',
    isGroupChat: true, mentionsUser: true,
    preview: 'Team, the client demo for Acme Corp is scheduled for Thursday. @you please confirm availability.',
    fullMessage: 'Team, the client demo for Acme Corp is scheduled for Thursday at 2 PM EST. @you Can you confirm availability? We need to showcase:\n\n1. Document AI pipeline\n2. Agent workforce dashboard\n3. Real-time analytics\n\nPlease prepare your sections by Wednesday EOD.',
    receivedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    receivedTime: '10:21 AM', relativeTime: '15 min ago',
    priority: 'medium', status: 'pending', starred: false,
    threadCount: 4,
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
    isGroupChat: true, mentionsUser: true,
    preview: '@you Sharing the updated mockups for the agent configuration panel. Need your feedback.',
    fullMessage: '@you Sharing the updated mockups for the agent configuration panel. Let me know your thoughts:\n\n1. Agent type selection → capabilities config → testing sandbox\n2. Simplified the 5-step wizard down to 3 steps\n3. Added inline validation and preview\n\nFigma link: [Updated Agent Config Mockups]\n\nWould love your feedback by tomorrow.',
    receivedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    receivedTime: '9:36 AM', relativeTime: '1 hr ago',
    priority: 'low', status: 'pending', starred: false, threadCount: 2,
  },
  {
    id: 'msg-6', externalId: 'ext-6', channel: 'teams',
    from: 'Alex Rodriguez', fromInitial: 'AR', fromColor: '#3a3a52',
    teamsChannel: 'Security',
    isGroupChat: true, mentionsUser: true,
    preview: 'Heads up — our SOC2 audit is next month. @you please assign an owner from your team.',
    fullMessage: 'Heads up — our SOC2 audit is scheduled for March 15th. @you I need you to complete the security compliance checklist by March 1st.\n\nKey items:\n- Access control review for all production systems\n- Encryption audit for data at rest and in transit\n- Incident response plan update\n- Vendor security assessment for 3rd party integrations\n\nPlease assign an owner from your team.',
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
    isGroupChat: true, mentionsUser: true,
    preview: 'Who\'s in for team lunch on Friday? @you @team Thinking of trying that new ramen place...',
    fullMessage: 'Who\'s in for team lunch on Friday? 🍜 @you @team Thinking of trying that new ramen place on 5th street. They apparently have amazing tonkotsu ramen. Let me know by Thursday so I can make a reservation!',
    receivedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    receivedTime: '6:36 AM', relativeTime: '4 hrs ago',
    priority: 'low', status: 'pending', starred: false,
    threadCount: 12,
  },
  /* ─── Additional Group Chat Messages ─────────────────── */
  {
    id: 'msg-9', externalId: 'ext-9', channel: 'slack',
    from: 'Emily Carter', fromInitial: 'EC', fromColor: '#8B5CF6',
    slackChannel: '#engineering',
    isGroupChat: true, mentionsUser: true,
    preview: '@you Can you review the auth middleware PR? It\'s blocking the release...',
    fullMessage: '@you Can you review the auth middleware PR #342? It\'s blocking the release branch. The changes affect token refresh logic and session management. We need sign-off before EOD.',
    receivedAt: new Date(Date.now() - 5 * 60000).toISOString(),
    receivedTime: '10:31 AM', relativeTime: '5 min ago',
    priority: 'high', status: 'pending', starred: false, threadCount: 5,
  },
  {
    id: 'msg-10', externalId: 'ext-10', channel: 'slack',
    from: 'Ryan Kim', fromInitial: 'RK', fromColor: '#059669',
    slackChannel: '#engineering',
    isGroupChat: true, mentionsUser: true,
    preview: 'The new API endpoints look good, @you just needs to sign off on the rate limiting config',
    fullMessage: 'The new API endpoints look good. @you just needs to sign off on the rate limiting config before we deploy. Current settings: 100 req/min for free tier, 1000 req/min for pro. Looks reasonable to me.',
    receivedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    receivedTime: '10:16 AM', relativeTime: '20 min ago',
    priority: 'medium', status: 'pending', starred: false,
  },
  {
    id: 'msg-11', externalId: 'ext-11', channel: 'slack',
    from: 'Nina Patel', fromInitial: 'NP', fromColor: '#DC2626',
    slackChannel: '#engineering',
    isGroupChat: true, mentionsUser: true,
    preview: 'FYI @you — updated the shared component library to v2.4.1. No breaking changes.',
    fullMessage: 'FYI @you — updated the shared component library to v2.4.1. No breaking changes, just performance improvements and a few new utility hooks. Changelog in the PR description.',
    receivedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    receivedTime: '9:51 AM', relativeTime: '45 min ago',
    priority: 'low', status: 'pending', starred: false,
  },
  {
    id: 'msg-12', externalId: 'ext-12', channel: 'teams',
    from: 'James Wilson', fromInitial: 'JW', fromColor: '#2563EB',
    teamsChannel: 'Product Launch',
    isGroupChat: true, mentionsUser: true,
    preview: '@you the client wants a custom integration demo — can you prepare the API walkthrough?',
    fullMessage: '@you the Acme Corp client wants a custom integration demo for their workflow. Can you prepare the API walkthrough section? They specifically asked about webhook support and batch processing capabilities.',
    receivedAt: new Date(Date.now() - 10 * 60000).toISOString(),
    receivedTime: '10:26 AM', relativeTime: '10 min ago',
    priority: 'high', status: 'pending', starred: false,
  },
  {
    id: 'msg-13', externalId: 'ext-13', channel: 'teams',
    from: 'Maria Garcia', fromInitial: 'MG', fromColor: '#F59E0B',
    teamsChannel: 'Product Launch',
    isGroupChat: true, mentionsUser: true,
    preview: 'Updated the launch timeline. @you\'s section on analytics is due next Wednesday.',
    fullMessage: 'Updated the launch timeline — see the attached doc. @you\'s section on real-time analytics dashboard is now due next Wednesday instead of Friday. Let me know if that works for your team.',
    receivedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    receivedTime: '9:56 AM', relativeTime: '40 min ago',
    priority: 'medium', status: 'pending', starred: false,
  },
  {
    id: 'msg-14', externalId: 'ext-14', channel: 'teams',
    from: 'Kevin Lee', fromInitial: 'KL', fromColor: '#7C3AED',
    teamsChannel: 'Product Launch',
    isGroupChat: true, mentionsUser: true,
    preview: 'Great progress! @you the staging URL is now live for testing.',
    fullMessage: 'Great progress on the demo environment! @you the staging URL is now live for testing: https://staging.demo.acme.com. Let me know if you spot any issues with the agent dashboard.',
    receivedAt: new Date(Date.now() - 90 * 60000).toISOString(),
    receivedTime: '9:06 AM', relativeTime: '1.5 hrs ago',
    priority: 'low', status: 'pending', starred: false,
  },
  {
    id: 'msg-15', externalId: 'ext-15', channel: 'teams',
    from: 'Diana Ross', fromInitial: 'DR', fromColor: '#EF4444',
    teamsChannel: 'Security',
    isGroupChat: true, mentionsUser: true,
    preview: '@you urgent: found a potential vulnerability in the file upload endpoint.',
    fullMessage: '@you urgent: found a potential vulnerability in the file upload endpoint. The input validation on /api/upload doesn\'t check for path traversal attacks. Can you patch this ASAP? This is a P0.',
    receivedAt: new Date(Date.now() - 3 * 60000).toISOString(),
    receivedTime: '10:33 AM', relativeTime: '3 min ago',
    priority: 'high', status: 'pending', starred: true,
  },
  {
    id: 'msg-16', externalId: 'ext-16', channel: 'teams',
    from: 'Sam Martinez', fromInitial: 'SM', fromColor: '#10B981',
    teamsChannel: 'Security',
    isGroupChat: true, mentionsUser: true,
    preview: '@you please add 2FA to the admin panel before the audit.',
    fullMessage: '@you please add 2FA to the admin panel before the SOC2 audit next month. Spec: TOTP-based, recovery codes, enforce for all admin roles. The library @simplewebauthn/server is already in our stack.',
    receivedAt: new Date(Date.now() - 50 * 60000).toISOString(),
    receivedTime: '9:46 AM', relativeTime: '50 min ago',
    priority: 'medium', status: 'pending', starred: false,
  },
  {
    id: 'msg-17', externalId: 'ext-17', channel: 'slack',
    from: 'Anna Thompson', fromInitial: 'AT', fromColor: '#DB2777',
    slackChannel: '#design',
    isGroupChat: true, mentionsUser: true,
    preview: '@you the new dashboard mockups need your tech feasibility review by tomorrow',
    fullMessage: '@you the new dashboard mockups are ready for your tech feasibility review. Can you check if the real-time chart animations and the drag-and-drop widget layout are doable with our current React setup? Need your input by tomorrow EOD.',
    receivedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    receivedTime: '10:11 AM', relativeTime: '25 min ago',
    priority: 'medium', status: 'pending', starred: false,
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

  // Approval queue
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);

  // VIP contacts & notifications
  const [vipContacts, setVipContacts] = useState<VIPContact[]>([]);
  const [vipNotifications, setVipNotifications] = useState<VIPNotification[]>([]);

  // Style analysis
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleAnalyzed, setStyleAnalyzed] = useState(false);

  // Channel group expand state
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedImportance, setExpandedImportance] = useState<Priority | null>(null);

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

  /* ─── Channel Groups (group chat summaries) ──────── */

  const channelGroups: ChannelGroupSummary[] = (() => {
    const groupMessages = filteredMessages.filter(m => m.isGroupChat && m.mentionsUser);
    const groups = new Map<string, ChannelGroupSummary>();

    for (const msg of groupMessages) {
      const channelName = msg.slackChannel || msg.teamsChannel || 'Unknown';
      const key = `${msg.channel}-${channelName}`;

      if (!groups.has(key)) {
        // Deterministic "total in channel" based on channel name hash
        let hash = 0;
        for (let i = 0; i < channelName.length; i++) {
          hash = channelName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const totalInChannel = Math.abs(hash % 40) + groupMessages.filter(
          m => (m.slackChannel || m.teamsChannel) === channelName
        ).length + 12;

        groups.set(key, {
          id: key,
          channel: msg.channel as Channel,
          channelName,
          totalInChannel,
          relevantMessages: [],
          high: [],
          medium: [],
          low: [],
        });
      }

      const group = groups.get(key)!;
      group.relevantMessages.push(msg);
      group[msg.priority].push(msg);
    }

    return Array.from(groups.values()).sort(
      (a, b) => b.relevantMessages.length - a.relevantMessages.length
    );
  })();

  // Individual (non-group-chat) messages for the flat list
  const individualMessages = filteredMessages.filter(m => !m.isGroupChat);

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
        // Local fallback: style-aware draft generation
        await new Promise(r => setTimeout(r, 1500));
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
          const draft = generateLocalDraftStyled(msg, styleProfiles);
          const confidence = styleProfiles.length > 0
            ? Math.floor(Math.random() * 7) + 91
            : Math.floor(Math.random() * 15) + 78;
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
  }, [backendConnected, messages, styleProfiles]);

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

  const isVIP = useCallback((nameOrEmail: string) => {
    const lower = nameOrEmail.toLowerCase();
    return vipContacts.some(
      v => v.name.toLowerCase() === lower || (v.email && v.email.toLowerCase() === lower)
    );
  }, [vipContacts]);

  const autoDraftAll = useCallback(async () => {
    setIsGenerating(true);
    try {
      const pending = messages.filter(m => m.status === 'pending');

      // Separate VIP messages from regular ones
      const vipPending = pending.filter(m =>
        vipContacts.some(
          v => v.name === m.from || (v.email && m.fromEmail && v.email.toLowerCase() === m.fromEmail.toLowerCase())
        )
      );
      const nonVipPending = pending.filter(m =>
        !vipContacts.some(
          v => v.name === m.from || (v.email && m.fromEmail && v.email.toLowerCase() === m.fromEmail.toLowerCase())
        )
      );

      // Further separate: skip high-priority messages (user should handle these manually)
      const highPriorityPending = nonVipPending.filter(m => m.priority === 'high');
      const draftablePending = nonVipPending.filter(m => m.priority !== 'high');

      // Mark high-priority messages as escalated (needs user input)
      if (highPriorityPending.length > 0) {
        setMessages(prev =>
          prev.map(m =>
            highPriorityPending.some(hp => hp.id === m.id)
              ? { ...m, status: 'escalated' as MessageStatus }
              : m
          )
        );
        console.log(`⚠️ ${highPriorityPending.length} high-importance messages require your input`);
      }

      // Show VIP notifications (do NOT auto-draft for VIPs)
      if (vipPending.length > 0) {
        setVipNotifications(prev => [
          ...prev,
          ...vipPending.map(m => ({
            id: `vip-${m.id}-${Date.now()}`,
            messageId: m.id,
            from: m.from,
            fromInitial: m.fromInitial,
            fromColor: m.fromColor,
            channel: m.channel as Channel,
            subject: m.subject,
            preview: m.preview,
            timestamp: new Date(),
          })),
        ]);
      }

      // Generate drafts for draftable messages (non-VIP, non-high) and queue for approval
      if (backendConnected) {
        // For each draftable pending message, generate a draft via API
        for (const msg of draftablePending) {
          const result = await MessagesAPI.generateDraft(msg.id);
          if (result) {
            // Update message state
            setMessages(prev =>
              prev.map(m =>
                m.id === msg.id
                  ? { ...m, aiDraft: result.draft, aiConfidence: result.confidence, status: 'ai_drafted' as MessageStatus }
                  : m
              )
            );
            // Add to approval queue
            setApprovalQueue(prev => [
              ...prev,
              {
                id: `approval-${msg.id}-${Date.now()}`,
                messageId: msg.id,
                from: msg.from,
                fromInitial: msg.fromInitial,
                fromColor: msg.fromColor,
                channel: msg.channel as Channel,
                subject: msg.subject,
                originalPreview: msg.preview,
                originalFull: msg.fullMessage,
                slackChannel: msg.slackChannel,
                teamsChannel: msg.teamsChannel,
                aiDraft: result.draft,
                confidence: result.confidence,
                createdAt: new Date(),
              },
            ]);
          }
        }
      } else {
        // Local fallback: generate style-aware drafts for each draftable pending message
        for (const msg of draftablePending) {
          await new Promise(r => setTimeout(r, 800));
          const draft = generateLocalDraftStyled(msg, styleProfiles);
          const confidence = styleProfiles.length > 0
            ? Math.floor(Math.random() * 7) + 91  // 91-97 when style profiles exist
            : Math.floor(Math.random() * 15) + 78; // 78-92 without profiles

          setMessages(prev =>
            prev.map(m =>
              m.id === msg.id
                ? { ...m, aiDraft: draft, aiConfidence: confidence, status: 'ai_drafted' as MessageStatus }
                : m
            )
          );
          setSelectedMessage(prev =>
            prev && prev.id === msg.id
              ? { ...prev, aiDraft: draft, aiConfidence: confidence, status: 'ai_drafted' as MessageStatus }
              : prev
          );

          // Add to approval queue
          setApprovalQueue(prev => [
            ...prev,
            {
              id: `approval-${msg.id}-${Date.now()}`,
              messageId: msg.id,
              from: msg.from,
              fromInitial: msg.fromInitial,
              fromColor: msg.fromColor,
              channel: msg.channel as Channel,
              subject: msg.subject,
              originalPreview: msg.preview,
              originalFull: msg.fullMessage,
              slackChannel: msg.slackChannel,
              teamsChannel: msg.teamsChannel,
              aiDraft: draft,
              confidence,
              createdAt: new Date(),
            },
          ]);
        }
      }
    } catch {
      setError('Failed to auto-draft messages');
    } finally {
      setIsGenerating(false);
    }
  }, [backendConnected, messages, vipContacts, styleProfiles]);

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

  /* ─── Approval queue actions ────────────────────────── */

  const approveItem = useCallback(async (approvalId: string) => {
    const item = approvalQueue.find(a => a.id === approvalId);
    if (!item) return;

    // Send the message
    await sendMessage(item.messageId, item.aiDraft);
    // Remove from queue
    setApprovalQueue(prev => prev.filter(a => a.id !== approvalId));
  }, [approvalQueue, sendMessage]);

  const reviewItem = useCallback((approvalId: string) => {
    const item = approvalQueue.find(a => a.id === approvalId);
    if (!item) return;

    // Find and select the message so the user can review it in the detail panel
    const allMsgs = messages;
    // Need to check against unfiltered messages
    const msg = allMsgs.find(m => m.id === item.messageId) || filteredMessages.find(m => m.id === item.messageId);
    if (msg) {
      setSelectedMessage(msg);
    }

    // Remove from approval queue (user will handle manually from the detail panel)
    setApprovalQueue(prev => prev.filter(a => a.id !== approvalId));
  }, [approvalQueue, messages, filteredMessages]);

  const cancelItem = useCallback((approvalId: string) => {
    const item = approvalQueue.find(a => a.id === approvalId);
    if (!item) return;

    // Revert the message status back to pending and clear the draft
    setMessages(prev =>
      prev.map(m =>
        m.id === item.messageId
          ? { ...m, status: 'pending' as MessageStatus, aiDraft: undefined, aiConfidence: undefined }
          : m
      )
    );
    setSelectedMessage(prev =>
      prev && prev.id === item.messageId
        ? { ...prev, status: 'pending' as MessageStatus, aiDraft: undefined, aiConfidence: undefined }
        : prev
    );

    // Remove from queue
    setApprovalQueue(prev => prev.filter(a => a.id !== approvalId));
  }, [approvalQueue]);

  /* ─── VIP contact actions ───────────────────────────── */

  const addVIPContact = useCallback((contact: { name: string; email?: string; channel?: Channel }) => {
    // Prevent duplicates
    if (vipContacts.some(v => v.name === contact.name)) return;

    const id = `vip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const initials = contact.name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const colors = ['#7C3AED', '#3B82F6', '#e07a3a', '#1a1a2e', '#EC4899', '#10B981', '#EF4444'];
    let hash = 0;
    for (let i = 0; i < contact.name.length; i++)
      hash = contact.name.charCodeAt(i) + ((hash << 5) - hash);
    const avatarColor = colors[Math.abs(hash) % colors.length];

    setVipContacts(prev => [
      ...prev,
      { id, name: contact.name, email: contact.email, channel: contact.channel, avatarColor, initials },
    ]);
  }, [vipContacts]);

  const removeVIPContact = useCallback((id: string) => {
    setVipContacts(prev => prev.filter(v => v.id !== id));
  }, []);

  /* ─── VIP notification actions ──────────────────────── */

  const dismissVIPNotification = useCallback((id: string) => {
    setVipNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const viewVIPNotification = useCallback((id: string) => {
    const notif = vipNotifications.find(n => n.id === id);
    if (notif) {
      const msg = messages.find(m => m.id === notif.messageId);
      if (msg) setSelectedMessage(msg);
    }
    setVipNotifications(prev => prev.filter(n => n.id !== id));
  }, [vipNotifications, messages]);

  /* ─── Channel group actions ──────────────────────────── */

  const expandGroup = useCallback((groupId: string, importance: Priority) => {
    if (expandedGroupId === groupId && expandedImportance === importance) {
      // Toggle off if same
      setExpandedGroupId(null);
      setExpandedImportance(null);
    } else {
      setExpandedGroupId(groupId);
      setExpandedImportance(importance);
    }
  }, [expandedGroupId, expandedImportance]);

  const collapseGroup = useCallback(() => {
    setExpandedGroupId(null);
    setExpandedImportance(null);
  }, []);

  /* ─── Style analysis ────────────────────────────────── */

  const analyzeStyle = useCallback(async () => {
    setIsAnalyzingStyle(true);
    setError(null);
    try {
      if (backendConnected) {
        // Call backend for AI-powered deep analysis
        const result = await AIAPI.analyzeStyle(messages);
        if (result) {
          // Fetch updated profiles from the backend
          // For now, build profiles from the result data
          const profiles: StyleProfile[] = result.contacts.map(c => ({
            contactName: c.name,
            contactEmail: c.email,
            formality: 'neutral',
            averageLength: 'moderate',
            emojiUsage: 'minimal',
            greetingStyle: 'Hi [name],',
            closingStyle: 'Best,',
            vocabularyLevel: 'moderate',
            sentenceStructure: 'balanced',
            usesContractions: true,
            capitalization: 'standard',
            pronounPreference: 'mixed',
            asksFollowUpQuestions: true,
            humorStyle: 'none',
            paragraphStyle: 'well_structured',
            endsWithActionItems: true,
            acknowledgmentStyle: 'Thanks for sharing',
            signOffName: '',
            commonTransitions: [],
            hedgeWords: [],
            avgWordsPerMessage: 80,
            styleConfidence: c.confidence,
            messageCount: c.messageCount,
          }));
          setStyleProfiles(profiles);
          setStyleAnalyzed(true);
          return;
        }
      }

      // Local deep heuristic analysis (when backend unavailable)
      await new Promise(r => setTimeout(r, 2500));

      const contactMap = new Map<string, { name: string; email?: string; msgs: UnifiedMessage[] }>();
      for (const msg of messages) {
        const key = msg.fromEmail || msg.from;
        if (!contactMap.has(key)) {
          contactMap.set(key, { name: msg.from, email: msg.fromEmail, msgs: [] });
        }
        contactMap.get(key)!.msgs.push(msg);
      }

      const profiles: StyleProfile[] = [];
      for (const [, contact] of contactMap) {
        const msgTexts = contact.msgs.map(m => m.fullMessage);
        const allText = msgTexts.join('\n');
        const count = msgTexts.length;
        const totalWords = allText.split(/\s+/).filter(w => w.length > 0).length;
        const avgWords = Math.round(totalWords / count);

        // Formality detection
        const formalMarkers = (allText.match(/\b(dear|sincerely|regards|respectfully|kindly|pursuant|enclosed)\b/gi) || []).length;
        const casualMarkers = (allText.match(/\b(hey|yo|lol|haha|gonna|wanna|kinda|btw|np|nvm|tbh|imo)\b/gi) || []).length;
        let formality = 'neutral';
        if (formalMarkers > casualMarkers * 3) formality = 'very_formal';
        else if (formalMarkers > casualMarkers * 1.5) formality = 'formal';
        else if (casualMarkers > formalMarkers * 3) formality = 'very_casual';
        else if (casualMarkers > formalMarkers * 1.5) formality = 'casual';

        // Length
        let averageLength = 'moderate';
        if (avgWords > 120) averageLength = 'detailed';
        else if (avgWords < 40) averageLength = 'brief';

        // Emoji
        const emojiCount = (allText.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []).length;
        const emojiPerMsg = emojiCount / count;
        let emojiUsage = 'none';
        if (emojiPerMsg > 3) emojiUsage = 'frequent';
        else if (emojiPerMsg > 1) emojiUsage = 'moderate';
        else if (emojiPerMsg > 0) emojiUsage = 'minimal';

        // Greeting
        let greetingStyle = 'Hi [name],';
        const firstLines = msgTexts.map(m => m.split('\n')[0].trim().toLowerCase());
        if (firstLines.some(l => l.startsWith('dear '))) greetingStyle = 'Dear [name],';
        else if (firstLines.some(l => l.startsWith('hello '))) greetingStyle = 'Hello [name],';
        else if (firstLines.some(l => l.startsWith('hey '))) greetingStyle = 'Hey [name],';
        else if (firstLines.some(l => l.startsWith('hi '))) greetingStyle = 'Hi [name],';

        // Closing
        let closingStyle = 'Best,';
        if (/best\s*regards/i.test(allText)) closingStyle = 'Best regards,';
        else if (/sincerely/i.test(allText)) closingStyle = 'Sincerely,';
        else if (/thanks!?\s*$/im.test(allText)) closingStyle = 'Thanks!';
        else if (/cheers/i.test(allText)) closingStyle = 'Cheers,';
        else if (/talk\s+soon/i.test(allText)) closingStyle = 'Talk soon!';

        // Contractions
        const contractionCount = (allText.match(/\b(don't|doesn't|didn't|won't|can't|couldn't|shouldn't|isn't|aren't|I'm|I've|I'd|I'll|we're|we've|it's|that's|there's|let's)\b/gi) || []).length;
        const expandedCount = (allText.match(/\b(do not|does not|did not|will not|cannot|could not|should not|is not|are not|I am|I have|I would|I will|we are|we have)\b/gi) || []).length;
        const usesContractions = contractionCount > expandedCount * 0.5;

        // Vocabulary
        const techCount = (allText.match(/\b(api|deploy|pipeline|sprint|endpoint|docker|kubernetes|ci\/cd|backend|frontend|database|middleware)\b/gi) || []).length;
        const complexWords = allText.split(/\s+/).filter(w => w.replace(/[^a-zA-Z]/g, '').length >= 10);
        const complexRatio = complexWords.length / (totalWords || 1);
        let vocabularyLevel = 'moderate';
        if (techCount / (totalWords || 1) > 0.02) vocabularyLevel = 'technical';
        else if (complexRatio > 0.12) vocabularyLevel = 'advanced';
        else if (complexRatio < 0.04) vocabularyLevel = 'simple';

        // Sentence structure
        const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 3);
        const avgSentenceLen = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / (sentences.length || 1);
        let sentenceStructure = 'balanced';
        if (avgSentenceLen < 10) sentenceStructure = 'short_direct';
        else if (avgSentenceLen > 20) sentenceStructure = 'complex_detailed';

        // Pronoun preference
        const iCount = (allText.match(/\bI\b/g) || []).length;
        const weCount = (allText.match(/\b[Ww]e\b/g) || []).length;
        let pronounPreference = 'mixed';
        if (iCount + weCount < totalWords * 0.01) pronounPreference = 'avoids_pronouns';
        else if (iCount > weCount * 2) pronounPreference = 'i_focused';
        else if (weCount > iCount * 1.5) pronounPreference = 'we_focused';

        // Follow-up questions
        const questionCount = (allText.match(/\?/g) || []).length;
        const asksFollowUpQuestions = questionCount / count > 0.5;

        // Humor
        const laughCount = (allText.match(/\b(lol|lmao|haha|hehe|😂|🤣)\b/gi) || []).length;
        const witCount = (allText.match(/\b(ironically|apparently|spoiler alert|plot twist)\b/gi) || []).length;
        let humorStyle = 'none';
        if (laughCount > 2) humorStyle = 'casual_jokes';
        else if (witCount > 1) humorStyle = 'dry_wit';

        // Paragraph style
        const avgParas = msgTexts.reduce((sum, m) => sum + m.split(/\n\s*\n/).filter(p => p.trim().length > 0).length, 0) / count;
        let paragraphStyle = 'well_structured';
        if (avgWords < 30) paragraphStyle = 'one_liners';
        else if (avgParas <= 1.2) paragraphStyle = 'single_block';
        else if (avgParas > 2.5) paragraphStyle = 'short_paragraphs';

        // Action items
        let actionEndCount = 0;
        for (const msg of msgTexts) {
          const lastThird = msg.slice(Math.floor(msg.length * 0.65));
          if (/\b(next steps|action items|let me know|please confirm|can you|could you|I'll|we'll)\b/i.test(lastThird)) actionEndCount++;
        }
        const endsWithActionItems = actionEndCount / count > 0.4;

        // Acknowledgment
        let acknowledgmentStyle = 'Thanks for sharing';
        if (/\b(got it|gotcha)\b/i.test(allText)) acknowledgmentStyle = 'Got it';
        else if (/\bnoted\b/i.test(allText)) acknowledgmentStyle = 'Noted';
        else if (/\bsounds good\b/i.test(allText)) acknowledgmentStyle = 'Sounds good';
        else if (/\bawesome\b/i.test(allText)) acknowledgmentStyle = 'Awesome';
        else if (/\bperfect\b/i.test(allText)) acknowledgmentStyle = 'Perfect';

        // Transitions & hedge words
        const transitionPatterns = ['that said', 'moving forward', 'to be honest', 'on that note', 'for context', 'heads up', 'by the way', 'going forward'];
        const commonTransitions = transitionPatterns.filter(t => allText.toLowerCase().includes(t));

        const hedgePatterns = ['I think', 'maybe', 'perhaps', 'probably', 'just', 'kind of', 'I guess', 'I believe', 'honestly'];
        const hedgeWords = hedgePatterns.filter(h => allText.toLowerCase().includes(h.toLowerCase()));

        // Capitalization
        const msgStarts = msgTexts.map(m => m.trim().charAt(0));
        const lowerStarts = msgStarts.filter(c => c === c.toLowerCase() && c !== c.toUpperCase()).length;
        let capitalization = 'standard';
        if (lowerStarts > msgStarts.length * 0.6) capitalization = 'all_lower';

        // Confidence
        let styleConfidence = Math.min(95, 40 + count * 5);
        if (avgWords > 50) styleConfidence += 5;
        styleConfidence = Math.min(98, styleConfidence);

        profiles.push({
          contactName: contact.name,
          contactEmail: contact.email,
          formality,
          averageLength,
          emojiUsage,
          greetingStyle,
          closingStyle,
          vocabularyLevel,
          sentenceStructure,
          usesContractions,
          capitalization,
          pronounPreference,
          asksFollowUpQuestions,
          humorStyle,
          paragraphStyle,
          endsWithActionItems,
          acknowledgmentStyle,
          signOffName: '',
          commonTransitions,
          hedgeWords,
          avgWordsPerMessage: avgWords,
          styleConfidence,
          messageCount: count + Math.floor(Math.random() * 15) + 5,
        });
      }

      setStyleProfiles(profiles);
      setStyleAnalyzed(true);
    } catch {
      setError('Style analysis failed');
    } finally {
      setIsAnalyzingStyle(false);
    }
  }, [messages, backendConnected]);

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
    approveItem,
    reviewItem,
    cancelItem,
    addVIPContact,
    removeVIPContact,
    isVIP,
    dismissVIPNotification,
    viewVIPNotification,
    analyzeStyle,
    expandGroup,
    collapseGroup,
  };

  return [state, actions];
}

/* ─── Style-Aware Local Draft Generation ──────────────── */
/*
 * When the backend is unavailable, this generates drafts locally
 * using the learned style profiles for high-fidelity voice matching.
 * It adapts greeting, closing, contractions, length, and tone to
 * match the user's actual communication patterns per contact.
 */

function generateLocalDraftStyled(
  msg: UnifiedMessage,
  styleProfiles: StyleProfile[],
): string {
  const name = msg.from.split(' ')[0];
  const isEmail = msg.channel === 'email';
  const text = msg.fullMessage.toLowerCase();

  // Find the best matching style profile for this contact
  const profile = styleProfiles.find(
    p => p.contactName === msg.from ||
         (p.contactEmail && msg.fromEmail && p.contactEmail.toLowerCase() === msg.fromEmail.toLowerCase())
  );

  // Build greeting and closing from style profile
  let greeting = '';
  let closing = '';
  let usesContractions = true;
  let usesExclamations = true;

  if (profile) {
    if (isEmail) {
      greeting = profile.greetingStyle.replace('[name]', name).replace('[time]', 'morning') + '\n\n';
      closing = '\n\n' + profile.closingStyle;
      if (profile.signOffName) closing += '\n' + profile.signOffName;
    }
    usesContractions = profile.usesContractions;
    usesExclamations = profile.formality !== 'very_formal' && profile.formality !== 'formal';
  } else {
    greeting = isEmail ? `Hi ${name},\n\n` : '';
    closing = isEmail ? '\n\nBest regards' : '';
  }

  // Helper shortcuts based on style
  const exc = usesExclamations ? '!' : '.';
  const ill = usesContractions ? "I'll" : 'I will';
  const ive = usesContractions ? "I've" : 'I have';
  const im = usesContractions ? "I'm" : 'I am';
  const theres = usesContractions ? "there's" : 'there is';
  const dont = usesContractions ? "don't" : 'do not';
  const hasnt = usesContractions ? "hasn't" : 'has not';

  if (text.includes('approve') || text.includes('budget')) {
    return `${greeting}Thank you for the detailed breakdown. ${ive} reviewed the items and they align with our current priorities.\n\nLet me take a closer look at the specifics and ${ill} get back to you with a decision by end of day. If there are any questions in the meantime, feel free to reach out.${closing}`;
  }
  if (text.includes('pipeline') || text.includes('error') || text.includes('bug') || text.includes('vulnerability')) {
    return `${greeting}Thanks for flagging this${exc} ${ill} take a look at the issue right away.\n\nA few things to try in the meantime:\n1. Clear cached state and retry\n2. Check the logs for more specific error messages\n3. Verify the configuration ${hasnt} changed recently\n\n${ill} dig deeper and update the thread once I have more details.${closing}`;
  }
  if (text.includes('demo') || text.includes('meeting') || text.includes('schedule') || text.includes('available')) {
    return `${greeting}Confirmed — ${im} available and will have everything prepared ahead of time.\n\nLet me know if ${theres} any specific focus area you'd like me to cover.${closing}`;
  }
  if (text.includes('review') || text.includes('pr') || text.includes('sign off')) {
    return `${greeting}${ill} take a look at this right away. ${profile?.acknowledgmentStyle || 'Got it'} — ${ill} review and get back to you shortly.${closing}`;
  }
  if (text.includes('lunch') || text.includes('social') || text.includes('fun') || text.includes('ramen')) {
    const casual = profile?.emojiUsage !== 'none' ? ' 👍' : '';
    return `Count me in${exc} Sounds great.${casual}`;
  }
  if (text.includes('audit') || text.includes('compliance') || text.includes('security')) {
    return `${greeting}${profile?.acknowledgmentStyle || 'Thanks for the heads up'}. ${ill} get the team aligned on this and make sure we hit the deadline.\n\n${ill} assign owners and share a checklist by end of week.${closing}`;
  }
  if (text.includes('mockup') || text.includes('design') || text.includes('feedback') || text.includes('figma')) {
    return `${greeting}Thanks for sharing these${exc} ${ill} review the mockups and provide technical feasibility feedback.\n\n${ill} have detailed notes ready by the end of tomorrow.${closing}`;
  }
  if (text.includes('partner') || text.includes('proposal') || text.includes('integration') || text.includes('revenue')) {
    return `${greeting}Thank you for sharing the details on this. The proposal looks interesting and I'd like to explore it further.\n\nLet me review the specifics and coordinate with the team. Could we set up a call next week to discuss the finer points?${closing}`;
  }
  if (text.includes('interview') || text.includes('candidate') || text.includes('panel')) {
    return `${greeting}Yes, ${im} available and happy to participate${exc} ${ill} review the resume beforehand and come prepared for the system design round.\n\nPlease send the calendar invite.${closing}`;
  }
  if (text.includes('update') || text.includes('fyi') || text.includes('no breaking')) {
    return `${greeting}${profile?.acknowledgmentStyle || 'Thanks for the update'}${exc} ${ive} noted the changes.${closing}`;
  }
  return `${greeting}Thank you for your message. ${ive} reviewed the details and will follow up shortly with a comprehensive response.${closing}`;
}

// Backward compatible wrapper
function generateLocalDraft(msg: UnifiedMessage): string {
  return generateLocalDraftStyled(msg, []);
}

