import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  AlertTriangle,
  Search,
  Calendar,
  Plus,
  MessageSquare,
  Paperclip,
  List,
  Kanban,
  GitBranch,
  Zap,
  Share2,
  SlidersHorizontal,
  UserPlus,
  MoreHorizontal,
  User,
  Eye,
  Bot,
  FileText,
  Headphones,
  PenTool,
  Database,
  Brain,
  Shield,
  Code,
  Mail,
  BarChart3,
  Users,
  Settings2,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Clock,
  Package,
  Tag,
  TrendingUp,
  LogOut,
  Send,
  Wand2,
  PanelLeftClose,
  PanelLeft,
  Play,
  Folder,
  Download,
  Star,
  Mic,
  Cpu,
  Activity,
  Settings,
  Globe,
  CreditCard,
  ShoppingCart,
} from 'lucide-react';
import './CrewOSDashboard.css';
import { DocumentIntelligence } from './DocumentIntelligence';
import { CommunicationsAgent } from './CommunicationsAgent';
import { SalesIntelligence } from './SalesIntelligence';
import { ExecutionLogs } from './ExecutionLogs';
import { ExecutionOutputPanel } from './ExecutionOutputPanel';
import { AgentExecutionViewer } from './AgentExecutionViewer';
import { WorkflowBuilder, AgentSetupWizard } from '../workflow';
import { planToWorkflow } from '../../services/automation/planConverter';
import { useAuth } from '../../contexts/AuthContext';
import { useAgents } from '../../contexts/AgentContext';
import { WorkflowDefinition, DeployedAgent as AutomationAgent } from '../../services/automation';
import type { ExecutionLog, RequiredInputField, ExecutionResult } from '../../services/automation/executionEngine';
import { executeWorkflow } from '../../services/automation/executionEngine';
import {
  searchTemplates,
  importTemplate,
  getCategories,
  type WorkflowTemplate,
  type TemplateSearchResult,
} from '../../services/n8n';
import { UserInputModal } from './UserInputModal';
import { WorkforceDashboard } from '../workforce';
import { OperonConsole, type OperonCallbacks } from '../operon/OperonConsole';
import { MonitoringDashboard } from '../monitoring/MonitoringDashboard';
import { AgentMarketplace } from '../marketplace/AgentMarketplace';

/* ─── TYPES ────────────────────────────────────────────────── */

interface TagInfo {
  label: string;
  className: string;
}

interface Avatar {
  initial: string;
  color: string;
}

type DeployStatus = 'running' | 'idle' | 'error' | 'provisioning';
type BoardColumn = 'active' | 'training' | 'review' | 'deployed';

interface DeployedAgent {
  id: string;
  catalogId: string;
  versionId: string;
  tags: TagInfo[];
  title: string;
  description: string;
  date: string;
  avatars: Avatar[];
  extraAvatars?: number;
  comments?: number;
  attachments?: number;
  image?: 'metrics' | 'chart';
  hasGear?: boolean;
  column: BoardColumn;
  status: DeployStatus;
  version: string;
  uptime?: string;
  accuracy?: string;
  latency?: string;
}

interface AgentVersion {
  id: string;
  version: string;
  releaseDate: string;
  changes: string;
  availability: 'stable' | 'beta' | 'deprecated';
  accuracy?: string;
  latency?: string;
}

interface CatalogAgent {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: 'vision' | 'nlp' | 'code' | 'data' | 'research' | 'workflow' | 'docgen';
  tags: TagInfo[];
  versions: AgentVersion[];
}

/* ─── CATEGORY ICONS (for sidebar) ─────────────────────────── */

const catalogCategoryIcons: Record<string, React.ReactNode> = {
  'Email': <Mail size={14} />,
  'Communication': <MessageSquare size={14} />,
  'Social Media': <Users size={14} />,
  'CRM & Sales': <BarChart3 size={14} />,
  'Productivity': <Layers size={14} />,
  'Development': <Code size={14} />,
  'Finance': <CreditCard size={14} />,
  'E-Commerce': <ShoppingCart size={14} />,
  'File Storage': <Folder size={14} />,
  'Scheduling': <Clock size={14} />,
  'AI & ML': <Brain size={14} />,
  'Database': <Database size={14} />,
  'CMS': <FileText size={14} />,
  'Triggers': <Zap size={14} />,
  'Utilities': <Settings size={14} />,
  'Analytics': <Activity size={14} />,
  'Built-in Agents': <Bot size={14} />,
};

const catalogComplexityColors: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

/* ─── AGENT CATALOG ────────────────────────────────────────── */

const agentCatalog: CatalogAgent[] = [
  /* ─── DOCUMENT GENERATION AGENTS ────────────────────────── */
  {
    id: 'cat-docgen-lease',
    name: 'Commercial Lease Agreement Generator',
    description: 'Generates full commercial lease agreements with rent schedules, CAM charges, build-out provisions, and tenant improvements. 28–42 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'Real Estate', className: 'operonai-tag-workflow' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '5 Feb 2026', changes: 'Multi-jurisdiction support, CAM charge calculations, automated escalation schedules, environmental provisions', availability: 'stable', accuracy: '99.1%', latency: '2.4min' },
      { id: 'v1', version: 'v1.0', releaseDate: '15 Dec 2025', changes: 'Initial release with basic lease generation and rent schedules', availability: 'stable', accuracy: '96.5%', latency: '3.1min' },
    ],
  },
  {
    id: 'cat-docgen-msa',
    name: 'Master Service Agreement Generator',
    description: 'Generates enterprise MSAs with SLAs, IP provisions, indemnification, limitation of liability, and SOW templates. 18–26 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'Legal', className: 'operonai-tag-nlp' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '3 Feb 2026', changes: 'SLA term builder, IP ownership matrix, multi-jurisdiction indemnification clauses, auto-SOW templates', availability: 'stable', accuracy: '98.8%', latency: '1.8min' },
      { id: 'v1', version: 'v1.0', releaseDate: '20 Dec 2025', changes: 'Initial MSA generation with core legal provisions', availability: 'stable', accuracy: '95.0%', latency: '2.5min' },
    ],
  },
  {
    id: 'cat-docgen-invoice',
    name: 'Invoice Package Generator',
    description: 'Generates multi-page invoices with line items, tax calculations, payment terms, and remittance details. 3–8 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'Finance', className: 'operonai-tag-extraction' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '1 Feb 2026', changes: 'Multi-currency support, tax calculation engine, late fee terms, line item parsing', availability: 'stable', accuracy: '99.5%', latency: '0.6min' },
      { id: 'v1', version: 'v1.0', releaseDate: '10 Dec 2025', changes: 'Basic invoice generation with manual line items', availability: 'stable', accuracy: '97.0%', latency: '0.9min' },
    ],
  },
  {
    id: 'cat-docgen-coi',
    name: 'Insurance Certificate (COI) Generator',
    description: 'Generates certificates of insurance with coverage schedules, additional insureds, and endorsement pages. 4–6 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'Compliance', className: 'operonai-tag-classification' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '28 Jan 2026', changes: 'Multi-policy coverage schedules, additional insured endorsements, ACORD-format output', availability: 'stable', accuracy: '99.3%', latency: '0.8min' },
      { id: 'v1', version: 'v1.0', releaseDate: '5 Dec 2025', changes: 'Basic COI generation with standard coverage fields', availability: 'stable', accuracy: '96.8%', latency: '1.2min' },
    ],
  },
  {
    id: 'cat-docgen-vendor',
    name: 'W-9 + Vendor Package Generator',
    description: 'Generates complete vendor onboarding packages: W-9, banking details, compliance attestations, and background check forms. 6–10 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'Compliance', className: 'operonai-tag-workflow' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '25 Jan 2026', changes: 'ACH validation, tax classification logic, compliance attestation builder, background check integration', availability: 'stable', accuracy: '98.9%', latency: '1.1min' },
      { id: 'v1', version: 'v1.0', releaseDate: '12 Dec 2025', changes: 'Basic vendor onboarding form generation', availability: 'stable', accuracy: '95.5%', latency: '1.5min' },
    ],
  },
  {
    id: 'cat-docgen-employment',
    name: 'Employment Agreement Generator',
    description: 'Generates full employment contracts with compensation, equity, non-compete, confidentiality, and benefits schedules. 12–20 pages.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'operonai-tag-generation' },
      { label: 'HR', className: 'operonai-tag-research' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '30 Jan 2026', changes: 'State-specific non-compete rules, equity vesting schedules, benefits package builder, at-will provisions', availability: 'stable', accuracy: '98.5%', latency: '1.6min' },
      { id: 'v1', version: 'v1.0', releaseDate: '18 Dec 2025', changes: 'Initial employment agreement generation with core terms', availability: 'stable', accuracy: '94.8%', latency: '2.0min' },
    ],
  },
  {
    id: 'cat-docgen-replicate',
    name: 'Document Replication Agent',
    description: 'Upload any document template (PDF, DOCX). AI detects variable fields; you map, fill data, and generate new documents with the same structure.',
    category: 'Document Generation',
    icon: 'docgen',
    tags: [
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Template', className: 'crewos-tag-workflow' },
    ],
    versions: [
      { id: 'v1', version: 'v1.0', releaseDate: '14 Feb 2026', changes: 'Upload PDF/DOCX, AI variable detection, field mapping, data entry, PDF generation', availability: 'stable', accuracy: '—', latency: '~10s' },
    ],
  },
  /* ─── COMMUNICATIONS AGENTS ─────────────────────────────── */
  {
    id: 'cat-email',
    name: 'Email Response Agent',
    description: 'Drafts contextual email responses based on conversation history, customer data, and company communication policies.',
    category: 'Communications',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'operonai-tag-nlp' },
      { label: 'Generation', className: 'operonai-tag-generation' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '20 Jan 2026', changes: 'Context-aware threading, tone adaptation, CRM integration', availability: 'stable', accuracy: '—', latency: '680ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '5 Dec 2025', changes: 'Basic email draft generation from templates', availability: 'stable', accuracy: '—', latency: '1.5s' },
    ],
  },
  {
    id: 'cat-sms',
    name: 'SMS Campaign Agent',
    description: 'Generates personalized SMS messages for campaigns, reminders, and follow-ups with compliance guardrails and opt-out handling.',
    category: 'Communications',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'operonai-tag-nlp' },
      { label: 'Workflow', className: 'operonai-tag-workflow' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '4 Feb 2026', changes: 'A/B message variants, TCPA compliance engine, delivery scheduling, opt-out management', availability: 'stable', accuracy: '—', latency: '120ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '12 Jan 2026', changes: 'Basic SMS generation with template personalization', availability: 'stable', accuracy: '—', latency: '250ms' },
    ],
  },
  {
    id: 'cat-chat',
    name: 'Live Chat Agent',
    description: 'Handles real-time customer chat with context-aware responses, escalation detection, and seamless handoff to human agents.',
    category: 'Communications',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'operonai-tag-nlp' },
      { label: 'Classification', className: 'operonai-tag-classification' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '6 Feb 2026', changes: 'Multi-turn context, sentiment-aware escalation, knowledge base integration, agent handoff', availability: 'stable', accuracy: '92.4%', latency: '180ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '15 Dec 2025', changes: 'Basic FAQ answering and ticket creation from chat', availability: 'stable', accuracy: '86.0%', latency: '350ms' },
    ],
  },
  {
    id: 'cat-social',
    name: 'Social Media Response Agent',
    description: 'Monitors and responds to social media mentions, DMs, and comments with brand-consistent messaging and sentiment-aware tone.',
    category: 'Communications',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'operonai-tag-nlp' },
      { label: 'Generation', className: 'operonai-tag-generation' },
    ],
    versions: [
      { id: 'v1', version: 'v1.0', releaseDate: '1 Feb 2026', changes: 'Multi-platform monitoring, sentiment-aware responses, brand voice enforcement, crisis detection', availability: 'stable', accuracy: '—', latency: '450ms' },
    ],
  },
  /* ─── SALES INTELLIGENCE AGENTS ──────────────────────── */
  {
    id: 'cat-lead-scoring',
    name: 'Lead Scoring Agent',
    description: 'AI-powered lead scoring using firmographic data, behavioral signals, and engagement patterns. Predicts conversion probability with 94% accuracy.',
    category: 'Sales Intelligence',
    icon: 'data',
    tags: [
      { label: 'Scoring', className: 'operonai-tag-classification' },
      { label: 'Sales', className: 'operonai-tag-extraction' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '7 Feb 2026', changes: 'Multi-signal scoring, engagement decay modeling, buying committee detection, champion tracking', availability: 'stable', accuracy: '94.2%', latency: '45ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '10 Jan 2026', changes: 'Basic lead scoring with firmographic and behavioral signals', availability: 'stable', accuracy: '88.5%', latency: '80ms' },
    ],
  },
  {
    id: 'cat-deal-forecast',
    name: 'Deal Forecasting Agent',
    description: 'Predicts deal close dates, win probabilities, and revenue forecasts using pipeline velocity analysis and historical patterns.',
    category: 'Sales Intelligence',
    icon: 'data',
    tags: [
      { label: 'Forecasting', className: 'operonai-tag-analysis' },
      { label: 'Sales', className: 'operonai-tag-extraction' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '5 Feb 2026', changes: 'Time-series forecasting, seasonal adjustments, pipeline coverage analysis, quota attainment prediction', availability: 'stable', accuracy: '89.7%', latency: '120ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '15 Dec 2025', changes: 'Basic win probability prediction and close date estimation', availability: 'stable', accuracy: '82.1%', latency: '200ms' },
    ],
  },
  {
    id: 'cat-engagement-analyzer',
    name: 'Engagement Analyzer Agent',
    description: 'Real-time buyer intent analysis across email, website, content, and meeting signals. Identifies buying committee members and tracks engagement depth.',
    category: 'Sales Intelligence',
    icon: 'research',
    tags: [
      { label: 'NLP', className: 'operonai-tag-nlp' },
      { label: 'Sales', className: 'operonai-tag-extraction' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '6 Feb 2026', changes: 'Multi-channel signal aggregation, intent scoring, champion change detection, competitive signal tracking', availability: 'stable', accuracy: '91.3%', latency: '28ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '20 Dec 2025', changes: 'Basic email and website engagement tracking', availability: 'stable', accuracy: '84.7%', latency: '55ms' },
    ],
  },
  {
    id: 'cat-competitive-radar',
    name: 'Competitive Radar Agent',
    description: 'Identifies competitive threats by analyzing deal patterns, pricing page visits, competitor mentions, and market intelligence feeds.',
    category: 'Sales Intelligence',
    icon: 'research',
    tags: [
      { label: 'Research', className: 'operonai-tag-research' },
      { label: 'Classification', className: 'operonai-tag-classification' },
    ],
    versions: [
      { id: 'v1', version: 'v1.0', releaseDate: '1 Feb 2026', changes: 'Competitive mention detection, displacement playbooks, win/loss pattern analysis', availability: 'beta', accuracy: '86.4%', latency: '200ms' },
    ],
  },
  {
    id: 'cat-next-action',
    name: 'Next Best Action Agent',
    description: 'Recommends optimal next steps for each deal based on successful deal progression patterns, channel preferences, and timing analysis.',
    category: 'Sales Intelligence',
    icon: 'workflow',
    tags: [
      { label: 'Recommendation', className: 'operonai-tag-workflow' },
      { label: 'Sales', className: 'operonai-tag-extraction' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '8 Feb 2026', changes: 'Contextual action ranking, timing optimization, multi-threading recommendations, risk mitigation actions', availability: 'stable', accuracy: '88.1%', latency: '85ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '5 Jan 2026', changes: 'Basic next action suggestions based on deal stage', availability: 'stable', accuracy: '79.3%', latency: '150ms' },
    ],
  },
];


/* ─── STATUS HELPERS ───────────────────────────────────────── */

const statusConfig: Record<DeployStatus, { label: string; color: string; bg: string }> = {
  running:      { label: 'Running',      color: '#16a34a', bg: 'rgba(22,163,74,0.10)' },
  idle:         { label: 'Idle',          color: '#9a9ab0', bg: 'rgba(154,154,176,0.10)' },
  error:        { label: 'Error',         color: '#dc2626', bg: 'rgba(220,38,38,0.10)' },
  provisioning: { label: 'Provisioning',  color: '#e07a3a', bg: 'rgba(224,122,58,0.10)' },
};

/* ─── COMPONENT ───────────────────────────────────────────── */

/* ─── URL → Nav mapping ───────────────────────────────────── */

const pathToNav: Record<string, string> = {
  '/': 'agents',
  '/agents': 'agents',
  '/dashboard': 'agents',
  '/comms': 'comms',
  '/docai': 'docai',
  '/docai/replicate': 'docai',
  '/sales': 'sales',
  '/workflow': 'workflow',
  '/logs': 'logs',
  '/workforce': 'workforce',
  '/monitoring': 'monitoring',
  '/marketplace': 'marketplace',
};

const navToPath: Record<string, string> = {
  agents: '/agents',
  comms: '/comms',
  docai: '/docai',
  sales: '/sales',
  workflow: '/workflow',
  logs: '/logs',
  workforce: '/workforce',
  monitoring: '/monitoring',
  marketplace: '/marketplace',
};

export function CrewOSDashboard() {
  const { signOut } = useAuth();
  const { agents: automationAgents, deployNewAgent, loading: agentsLoading, runAgent, pauseAgent, resumeAgent, deleteAgent: deleteAutomationAgent, backendStatus, lastExecutionLogs, createAgentFromPrompt } = useAgents();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDeploying, setIsDeploying] = useState(false);

  // Derive activeNav from URL path (persists on refresh)
  const activeNav = pathToNav[location.pathname] || 'agents';

  // Navigate helper — updates URL instead of local state
  const setActiveNav = useCallback((nav: string) => {
    const path = navToPath[nav] || '/agents';
    navigate(path);
  }, [navigate]);

  const [activeTab, setActiveTab] = useState('board');
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPromptWizard, setShowPromptWizard] = useState(false);
  const [expandedCatalog, setExpandedCatalog] = useState<string | null>(null);
  const [deployingVersion, setDeployingVersion] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarVisibleInWorkflow, setSidebarVisibleInWorkflow] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [isCreatingFromPrompt, setIsCreatingFromPrompt] = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<{
    agentId: string;
    agentName: string;
    success: boolean;
    message: string;
    isReal: boolean;
    nodeDetails?: { name: string; type: string; status: string; isReal: boolean }[];
  } | null>(null);

  // ─── Execution Output Panel state ──────
  const [executionOutputPanel, setExecutionOutputPanel] = useState<{
    agentId: string;
    agentName: string;
    logs: ExecutionLog[];
    success: boolean;
    error?: string;
    isReal: boolean;
  } | null>(null);

  // ─── Vision Agent Execution Viewers (multiple simultaneous) ──────
  const [activeViewers, setActiveViewers] = useState<Array<{
    key: string;
    agentId: string;
    agentName: string;
    task: string;
    url?: string;
    appName?: string;
  }>>([]);

  // ─── Agent Run Results ──────
  const [agentResults, setAgentResults] = useState<Record<string, import('./AgentExecutionViewer').AgentRunResult>>(() => {
    try {
      const saved = localStorage.getItem('gbeta-agent-results');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [viewingResultId, setViewingResultId] = useState<string | null>(null);

  // ─── Unified Catalog state (built-in + n8n automations) ──────
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [templateResults, setTemplateResults] = useState<TemplateSearchResult | null>(null);
  const [templateCategories, setTemplateCategories] = useState<{ name: string; count: number }[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatePage, setTemplatePage] = useState(1);
  const [launchingTemplateId, setLaunchingTemplateId] = useState<string | null>(null);
  const [editWorkflow, setEditWorkflow] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [editWorkflowName, setEditWorkflowName] = useState<string | undefined>(undefined);
  const [editWorkflowKey, setEditWorkflowKey] = useState(0);
  
  // Toast notification state for general feedback
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Paused execution state for user input modal
  const [pausedExecution, setPausedExecution] = useState<{
    agentId: string;
    agentName: string;
    nodeName: string;
    requiredInputs: RequiredInputField[];
    inputPromptMessage?: string;
    executionState: NonNullable<ExecutionResult['executionState']>;
    currentLogs: ExecutionLog[];
  } | null>(null);
  const [isResumingExecution, setIsResumingExecution] = useState(false);

  // Persist agent results to localStorage
  useEffect(() => {
    try { localStorage.setItem('gbeta-agent-results', JSON.stringify(agentResults)); } catch { /* ignore */ }
  }, [agentResults]);

  const handleViewerComplete = useCallback((result: import('./AgentExecutionViewer').AgentRunResult) => {
    setAgentResults(prev => ({ ...prev, [result.agentId]: result }));
  }, []);

  const closeViewer = useCallback((key: string) => {
    setActiveViewers(prev => prev.filter(v => v.key !== key));
  }, []);

  // Handle OAuth callback redirect — auto-switch to Communications page
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected || error) {
      // Navigate to Communications page so the user sees the connection status
      navigate('/comms', { replace: true });
    }
  }, [location.search, navigate]);

  const isDocAI = activeNav === 'docai';
  const isComms = activeNav === 'comms';
  const isSales = activeNav === 'sales';
  const isWorkflow = activeNav === 'workflow';
  const isLogs = activeNav === 'logs';
  const isWorkforce = activeNav === 'workforce';
  const isMonitoring = activeNav === 'monitoring';
  const isMarketplace = activeNav === 'marketplace';

  // State for filtering logs by a specific agent
  const [logsAgentId, setLogsAgentId] = useState<string | undefined>(undefined);

  // Filter agents by column
  const activeAgents = agents.filter(a => a.column === 'active');
  const trainingAgents = agents.filter(a => a.column === 'training');
  const reviewAgents = agents.filter(a => a.column === 'review');
  const deployedAgents = agents.filter(a => a.column === 'deployed');

  // Check if a catalog agent version is already deployed
  const isVersionDeployed = useCallback((catalogId: string, versionId: string) => {
    return agents.some(a => a.catalogId === catalogId && a.versionId === versionId);
  }, [agents]);

  // Deploy an agent from the catalog
  const deployAgent = useCallback((catalog: CatalogAgent, version: AgentVersion) => {
    const newId = `deployed-${Date.now()}`;
    setDeployingVersion(`${catalog.id}-${version.id}`);

    // Simulate a short provisioning delay
    setTimeout(() => {
      const newAgent: DeployedAgent = {
        id: newId,
        catalogId: catalog.id,
        versionId: version.id,
        tags: catalog.tags,
        title: `${catalog.name}`,
        version: version.version,
        description: catalog.description,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        column: 'active',
        status: 'provisioning',
        avatars: [{ initial: 'AM', color: '#e07a3a' }],
        comments: 0,
        attachments: 0,
        accuracy: version.accuracy,
        latency: version.latency,
      };

      setAgents(prev => [newAgent, ...prev]);
      setDeployingVersion(null);

      // After 2s, change status from provisioning to running
      setTimeout(() => {
        setAgents(prev =>
          prev.map(a => a.id === newId ? { ...a, status: 'running' as DeployStatus, uptime: '100%' } : a)
        );
      }, 2000);
    }, 800);
  }, []);

  /* Card click handler — Communications agents go to the comms page */
  const handleCardClick = useCallback((agent: DeployedAgent) => {
    const catAgent = agentCatalog.find(c => c.id === agent.catalogId);
    if (catAgent?.category === 'Communications') {
      setActiveNav('comms');
    } else if (catAgent?.id === 'cat-docgen-replicate') {
      navigate('/docai/replicate');
    } else if (catAgent?.category === 'Document Generation') {
      setActiveNav('docai');
    } else if (catAgent?.category === 'Sales Intelligence') {
      setActiveNav('sales');
    } else {
      setSelectedAgent(agent);
    }
  }, [setActiveNav, navigate]);

  /* Show toast notification helper */
  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToastNotification({ type, message });
    setTimeout(() => setToastNotification(null), 5000);
  }, []);

  /* Handle saving workflow draft to localStorage */
  const handleWorkflowSave = useCallback((workflow: { nodes: any[]; edges: any[] }) => {
    try {
      const draftId = editWorkflowName || `draft-${Date.now()}`;
      const drafts = JSON.parse(localStorage.getItem('workflow_drafts') || '{}');
      drafts[draftId] = {
        workflow,
        name: editWorkflowName || 'Untitled Workflow',
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('workflow_drafts', JSON.stringify(drafts));
      showToast('success', `Workflow "${editWorkflowName || 'Draft'}" saved successfully`);
    } catch (error) {
      console.error('Failed to save workflow draft:', error);
      showToast('error', 'Failed to save workflow draft');
    }
  }, [editWorkflowName, showToast]);

  /* Handle deploying from Workflow Builder */
  const handleWorkflowDeploy = useCallback(async (name: string, description: string, workflow: WorkflowDefinition) => {
    setIsDeploying(true);
    try {
      await deployNewAgent(name, description, workflow, 'Zap', '#e07a3a');
      showToast('success', `Agent "${name}" deployed successfully!`);
      // Navigate back to agents page after successful deploy
      setActiveNav('agents');
    } catch (error: any) {
      console.error('Deploy error:', error);
      showToast('error', `Failed to deploy agent: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  }, [deployNewAgent, setActiveNav, showToast]);

  /* Handle prompt submission for creating agents */
  const handlePromptSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim() || isCreatingFromPrompt) return;

    setIsCreatingFromPrompt(true);
    console.log('Creating agent from prompt:', agentPrompt);

    // Navigate to workflow builder with the prompt
    setTimeout(() => {
      setIsCreatingFromPrompt(false);
      setAgentPrompt('');
      setActiveNav('workflow');
    }, 800);
  }, [agentPrompt, isCreatingFromPrompt, setActiveNav]);

  /* Handle deploying from the prompt wizard (plan-based) */
  const handlePromptWizardDeploy = useCallback(async (plan: any, userInputs: Record<string, string>) => {
    setIsDeploying(true);
    try {
      const workflow = planToWorkflow(plan, userInputs);
      await deployNewAgent(plan.title, plan.description, workflow, 'Zap', '#e07a3a');
      showToast('success', `Agent "${plan.title}" deployed successfully!`);
      setShowPromptWizard(false);
    } catch (error: any) {
      console.error('Wizard deploy error:', error);
      showToast('error', `Failed to deploy: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  }, [deployNewAgent, showToast]);

  /* Handle deploying from the prompt wizard (AI workflow) */
  const handlePromptWizardDeployWorkflow = useCallback(async (
    name: string,
    description: string,
    workflow: WorkflowDefinition,
    _userInputs: Record<string, string>,
  ) => {
    setIsDeploying(true);
    try {
      await deployNewAgent(name, description, workflow, 'Zap', '#e07a3a');
      showToast('success', `Agent "${name}" deployed successfully!`);
      setShowPromptWizard(false);
    } catch (error: any) {
      console.error('Wizard deploy error:', error);
      showToast('error', `Failed to deploy: ${error.message || 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  }, [deployNewAgent, showToast]);

  /* Handle running an automation agent with feedback */
  const handleRunAgent = useCallback(async (agentId: string, resumeState?: {
    completedNodeIds: string[];
    nodeOutputs: Record<string, any>;
    userProvidedInputs?: Record<string, any>;
  }) => {
    const agent = automationAgents.find(a => a.id === agentId);
    if (!agent) return;

    // Any agent with browser nodes gets the embedded vision viewer
    const browserNode = agent.workflow?.nodes?.find(
      (n: any) => n.type === 'vision_browse' || n.type === 'desktop_task' || n.type === 'browser_task'
    );
    if (browserNode && !resumeState) {
      const config = browserNode.config || {};
      // For browser_task nodes, build a task description from the node chain
      const allBrowserNodes = agent.workflow?.nodes?.filter(
        (n: any) => n.type === 'vision_browse' || n.type === 'browser_task' || n.type === 'desktop_task'
      ) || [];
      const taskDescription = config.task
        || allBrowserNodes.map((n: any) => n.config?.description || n.label).join(', then ')
        || agent.name;
      const startUrl = config.url
        || allBrowserNodes.find((n: any) => n.config?.url)?.config?.url
        || '';

      const viewerKey = `${agentId}-${Date.now()}`;
      setActiveViewers(prev => [
        ...prev,
        {
          key: viewerKey,
          agentId,
          agentName: agent.name,
          task: taskDescription,
          url: startUrl,
          appName: config.appName || config.app,
        },
      ]);
      return;
    }
    
    setRunningAgentId(agentId);
    setExecutionResult(null);
    
    try {
      // Execute workflow directly with optional resume state
      const result = await executeWorkflow(
        agentId,
        'local-user',
        agent.workflow,
        'manual',
        {},
        undefined,
        resumeState
      );

      // Check if execution is paused awaiting user input
      if (result.awaitingInput && result.executionState && result.requiredInputs) {
        const pausedNode = agent.workflow.nodes.find(n => n.id === result.pausedAtNodeId);
        setPausedExecution({
          agentId: agent.id,
          agentName: agent.name,
          nodeName: pausedNode?.label || 'Unknown Node',
          requiredInputs: result.requiredInputs,
          inputPromptMessage: result.inputPromptMessage,
          executionState: result.executionState,
          currentLogs: result.logs,
        });
        setRunningAgentId(null);
        return;
      }

      const hasRealExecution = result.logs?.some(l => l.isReal) || false;
      const allSimulated = result.logs?.every(l => !l.isReal) ?? true;
      const completedCount = result.logs?.filter(l => l.status === 'completed').length || 0;
      const failedCount = result.logs?.filter(l => l.status === 'failed').length || 0;
      const skippedCount = result.logs?.filter(l => l.status === 'skipped').length || 0;
      const totalNodes = result.logs?.length || 0;
      const nodeDetails = result.logs?.map(l => ({
        name: l.nodeName,
        type: l.nodeType,
        status: l.status,
        isReal: l.isReal,
      })) || [];

      let message: string;
      if (!result.success) {
        message = `Agent "${agent.name}" failed: ${result.error}`;
      } else if (allSimulated) {
        const summary = `${completedCount}/${totalNodes} nodes completed${failedCount ? `, ${failedCount} failed` : ''}${skippedCount ? `, ${skippedCount} skipped` : ''}`;
        message = `Demo run completed for "${agent.name}" (${summary}). No real actions were taken — connect a backend to execute live automations.`;
      } else {
        message = `Agent "${agent.name}" executed successfully via live APIs! (${completedCount}/${totalNodes} nodes completed)`;
      }

      setExecutionResult({
        agentId: agent.id,
        agentName: agent.name,
        success: result.success,
        message,
        isReal: hasRealExecution,
        nodeDetails,
      });

      // Open the execution output panel with full logs
      setExecutionOutputPanel({
        agentId: agent.id,
        agentName: agent.name,
        logs: result.logs || [],
        success: result.success,
        error: result.error,
        isReal: hasRealExecution,
      });
      
      // Auto-dismiss the toast after 12 seconds (longer for simulated to let users read)
      setTimeout(() => setExecutionResult(null), allSimulated ? 12000 : 8000);
    } catch (err: any) {
      setExecutionResult({
        agentId: agent.id,
        agentName: agent.name,
        success: false,
        message: `Error: ${err.message}`,
        isReal: false,
      });
      setTimeout(() => setExecutionResult(null), 5000);
    } finally {
      setRunningAgentId(null);
    }
  }, [automationAgents]);

  /* Handle resuming execution after user provides input */
  const handleResumeExecution = useCallback(async (userInputs: Record<string, any>) => {
    if (!pausedExecution) return;
    
    setIsResumingExecution(true);
    
    try {
      // Resume with user-provided inputs
      await handleRunAgent(pausedExecution.agentId, {
        completedNodeIds: pausedExecution.executionState.completedNodeIds,
        nodeOutputs: pausedExecution.executionState.nodeOutputs,
        userProvidedInputs: userInputs,
      });
      
      setPausedExecution(null);
    } catch (err: any) {
      showToast('error', `Failed to resume execution: ${err.message}`);
    } finally {
      setIsResumingExecution(false);
    }
  }, [pausedExecution, handleRunAgent, showToast]);

  /* Cancel paused execution */
  const handleCancelExecution = useCallback(() => {
    setPausedExecution(null);
    showToast('info', 'Execution cancelled');
  }, [showToast]);

  /* ─── n8n Automation Template helpers ──────────────────── */

  // Check n8n connection status when catalog opens
  // Load categories once when catalog opens
  useEffect(() => {
    if (showCatalog && templateCategories.length === 0) {
      getCategories().then(cats => setTemplateCategories(cats));
    }
  }, [showCatalog, templateCategories.length]);

  // Search n8n templates whenever search/category/page changes
  useEffect(() => {
    if (!showCatalog) return;
    setTemplatesLoading(true);
    const timer = setTimeout(() => {
      searchTemplates({
        query: catalogSearch || undefined,
        category: catalogCategory !== 'All' && catalogCategory !== 'Built-in Agents' ? catalogCategory : undefined,
        page: templatePage,
        pageSize: 30,
      }).then(result => {
        setTemplateResults(result);
        setTemplatesLoading(false);
      }).catch(() => setTemplatesLoading(false));
    }, 250); // debounce
    return () => clearTimeout(timer);
  }, [showCatalog, catalogSearch, catalogCategory, templatePage]);

  // Reset catalog state when modal closes
  useEffect(() => {
    if (!showCatalog) {
      setCatalogSearch('');
      setCatalogCategory('All');
      setTemplatePage(1);
      setTemplateResults(null);
    }
  }, [showCatalog]);

  // Filter built-in agents based on search and category
  const filteredBuiltinAgents = agentCatalog.filter(agent => {
    const matchesSearch = !catalogSearch || 
      agent.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      agent.description.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      agent.category.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCategory = catalogCategory === 'All' || 
      catalogCategory === 'Built-in Agents' || 
      agent.category === catalogCategory;
    return matchesSearch && matchesCategory;
  });

  // Launch (deploy) an n8n template as a ready-to-run agent
  const handleLaunchTemplate = useCallback(async (template: WorkflowTemplate) => {
    setLaunchingTemplateId(template.id);
    try {
      // Convert n8n JSON → CrewOS WorkflowDefinition (runs natively in our engine)
      const workflow = await importTemplate(template);
      const iconMap: Record<string, string> = {
        'Email': 'Mail', 'Communication': 'MessageSquare', 'CRM': 'Users',
        'Project Management': 'Kanban', 'Data': 'Database', 'AI': 'Brain',
        'DevOps': 'Code', 'Marketing': 'TrendingUp', 'Sales': 'BarChart3',
      };
      const icon = iconMap[template.category] || 'Zap';

      await deployNewAgent(
        template.name,
        template.description || `Automated workflow: ${template.name}`,
        workflow,
        icon,
        '#e07a3a'
      );
      setShowCatalog(false);
      setActiveNav('agents');
    } catch (err) {
      console.error('Failed to launch template:', err);
    } finally {
      setLaunchingTemplateId(null);
    }
  }, [deployNewAgent, setActiveNav]);

  // Edit an n8n template — opens it in the Workflow Builder
  const handleEditTemplate = useCallback(async (template: WorkflowTemplate) => {
    setLaunchingTemplateId(template.id);
    try {
      const workflow = await importTemplate(template);
      // Convert WorkflowDefinition to ReactFlow format
      const rfNodes = workflow.nodes.map((wNode: any, idx: number) => ({
        id: wNode.id,
        type: 'custom',
        position: wNode.position || { x: 400, y: 60 + idx * 140 },
        data: {
          label: wNode.label,
          type: wNode.type,
          description: wNode.description || '',
          config: wNode.config || {},
          appType: wNode.config?.appType,
        },
      }));
      const rfEdges = workflow.edges.map((wEdge: any) => ({
        id: wEdge.id,
        source: wEdge.source,
        target: wEdge.target,
        sourceHandle: wEdge.sourceHandle,
        targetHandle: wEdge.targetHandle,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#e07a3a', strokeWidth: 2 },
      }));
      setEditWorkflow({ nodes: rfNodes, edges: rfEdges });
      setEditWorkflowName(template.name);
      setEditWorkflowKey(prev => prev + 1);
      setShowCatalog(false);
      setActiveNav('workflow');
    } catch (err) {
      console.error('Failed to load template for editing:', err);
    } finally {
      setLaunchingTemplateId(null);
    }
  }, [setActiveNav]);

  /* Card renderer */
  const renderCard = (agent: DeployedAgent) => {
    const st = statusConfig[agent.status];
    return (
    <div className="operonai-card" key={agent.id} onClick={() => handleCardClick(agent)} style={{ cursor: 'pointer' }}>
        {/* Status + Version bar */}
        <div className="operonai-card-status-bar">
          <div className="operonai-card-status-pill" style={{ background: st.bg, color: st.color }}>
            {agent.status === 'running' && <CheckCircle2 size={12} />}
            {agent.status === 'idle' && <Circle size={12} />}
            {agent.status === 'error' && <AlertCircle size={12} />}
            {agent.status === 'provisioning' && <Loader2 size={12} className="operonai-spin" />}
            {st.label}
          </div>
          <span className="operonai-card-version">{agent.version}</span>
          {agent.hasGear && (
            <button className="operonai-card-gear-sm">
              <Settings2 size={13} />
          </button>
          )}
        </div>

        {/* Tags */}
        <div className="operonai-card-tags">
          {agent.tags.map((tag) => (
            <span key={tag.label} className={`operonai-card-tag ${tag.className}`}>
              {tag.label}
            </span>
          ))}
        </div>

      <div className="operonai-card-title">{agent.title}</div>
      <div className="operonai-card-description">{agent.description}</div>

        {/* Metrics row (for agents with data) */}
        {(agent.accuracy || agent.latency || agent.uptime) && (
          <div className="operonai-card-metrics-row">
            {agent.accuracy && agent.accuracy !== '—' && (
              <div className="operonai-card-metric">
                <span className="operonai-card-metric-val">{agent.accuracy}</span>
                <span className="operonai-card-metric-label">Accuracy</span>
              </div>
            )}
            {agent.latency && (
              <div className="operonai-card-metric">
                <span className="operonai-card-metric-val">{agent.latency}</span>
                <span className="operonai-card-metric-label">Latency</span>
              </div>
            )}
            {agent.uptime && (
              <div className="operonai-card-metric">
                <span className="operonai-card-metric-val">{agent.uptime}</span>
                <span className="operonai-card-metric-label">Uptime</span>
              </div>
            )}
          </div>
        )}

      {/* Image preview */}
      {agent.image === 'metrics' && (
        <div className="operonai-card-image operonai-card-image-dark">
          <div className="operonai-card-image-metric">
            <div className="operonai-card-image-metric-value">0.0093</div>
            <div className="operonai-card-image-metric-label">Loss</div>
          </div>
          <div className="operonai-card-image-metric">
            <div className="operonai-card-image-metric-value">94.8%</div>
            <div className="operonai-card-image-metric-label">Accuracy</div>
          </div>
          <div className="operonai-card-image-metric">
            <div className="operonai-card-image-metric-value">12ms</div>
            <div className="operonai-card-image-metric-label">Latency</div>
          </div>
        </div>
      )}

      {agent.image === 'chart' && (
        <div className="operonai-card-image operonai-card-image-chart">
          <div className="operonai-chart-bars">
            <div className="operonai-chart-bar" style={{ height: '45%', background: '#e07a3a' }} />
            <div className="operonai-chart-bar" style={{ height: '65%', background: '#e07a3a' }} />
            <div className="operonai-chart-bar" style={{ height: '80%', background: '#e07a3a' }} />
            <div className="operonai-chart-bar" style={{ height: '55%', background: '#d46b2c' }} />
            <div className="operonai-chart-bar" style={{ height: '90%', background: '#d46b2c' }} />
            <div className="operonai-chart-bar" style={{ height: '70%', background: '#1a1a2e' }} />
            <div className="operonai-chart-bar" style={{ height: '95%', background: '#1a1a2e' }} />
          </div>
          <div className="operonai-chart-label">Training progress — Epoch 8/12</div>
        </div>
      )}

      {/* Date */}
      <div className="operonai-card-date">
          <span className="operonai-card-date-icon"><Calendar size={13} /></span>
        <span>{agent.date}</span>
      </div>

      {/* Footer */}
      <div className="operonai-card-footer">
        <div className="operonai-card-avatars">
          {agent.avatars.map((av) => (
              <div key={av.initial} className="operonai-card-avatar" style={{ background: av.color }}>
              {av.initial}
            </div>
          ))}
          {agent.extraAvatars && (
              <div className="operonai-card-avatar operonai-card-avatar-extra">+{agent.extraAvatars}</div>
          )}
        </div>
        <div className="operonai-card-stats">
          {agent.comments !== undefined && (
            <span className="operonai-card-stat">
                <span className="operonai-card-stat-icon"><MessageSquare size={14} /></span>
              {agent.comments}
            </span>
          )}
          {agent.attachments !== undefined && (
            <span className="operonai-card-stat">
                <span className="operonai-card-stat-icon"><Paperclip size={14} /></span>
              {agent.attachments}
            </span>
          )}
        </div>
      </div>
    </div>
  );
  };

  /* Catalog icon */
  const getCatalogIcon = (icon: string) => {
    switch (icon) {
      case 'vision':   return <Eye size={20} />;
      case 'nlp':      return <Brain size={20} />;
      case 'code':     return <Code size={20} />;
      case 'data':     return <Database size={20} />;
      case 'research': return <Search size={20} />;
      case 'workflow':  return <GitBranch size={20} />;
      case 'docgen':   return <FileText size={20} />;
      default:         return <Bot size={20} />;
    }
  };

  const operonCallbacks: OperonCallbacks = useMemo(() => ({
    navigate: (tab: string) => setActiveNav(tab),
    createAgentFromPrompt,
    runAgent: (agentId: string) => handleRunAgent(agentId),
    pauseAgent,
    resumeAgent,
    deleteAgent: deleteAutomationAgent,
    openCatalog: () => setShowCatalog(true),
    getAgents: () => automationAgents.map(a => ({
      id: a.id,
      name: a.name,
      status: a.status,
      description: a.description,
    })),
    getCurrentTab: () => activeNav,
  }), [setActiveNav, createAgentFromPrompt, handleRunAgent, pauseAgent, resumeAgent, deleteAutomationAgent, automationAgents, activeNav]);

  return (
    <div className={`operonai-app ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isWorkflow ? 'workflow-active' : ''} ${isWorkflow && sidebarVisibleInWorkflow ? 'sidebar-visible' : ''}`}>
        {/* ──────── SIDEBAR ──────── */}
        <aside className={`operonai-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Collapse/Expand Toggle */}
          <button 
            className="operonai-sidebar-toggle"
            onClick={(e) => { e.stopPropagation(); setSidebarCollapsed(!sidebarCollapsed); }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          
          {/* Logo */}
          <div className="operonai-logo">
            <div className="operonai-logo-icon">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="4" fill="#e07a3a"/>
                <line x1="18" y1="2" x2="18" y2="10" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="18" y1="26" x2="18" y2="34" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="2" y1="18" x2="10" y2="18" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="26" y1="18" x2="34" y2="18" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="6.69" y1="6.69" x2="12.35" y2="12.35" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="23.65" y1="23.65" x2="29.31" y2="29.31" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="6.69" y1="29.31" x2="12.35" y2="23.65" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="23.65" y1="12.35" x2="29.31" y2="6.69" stroke="#e07a3a" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="operonai-logo-text">OperonAI</span>
          </div>

          {/* Menu */}
          <div className="operonai-sidebar-section">
            <div className="operonai-sidebar-label">Menu</div>

            <button
              className={`operonai-nav-item ${activeNav === 'agents' ? 'active' : ''}`}
              onClick={() => setActiveNav('agents')}
            >
              <span className="operonai-nav-item-icon"><Bot size={18} /></span>
              <span className="operonai-nav-item-text">Agents</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'comms' ? 'active' : ''}`}
              onClick={() => setActiveNav('comms')}
            >
              <span className="operonai-nav-item-icon"><Mail size={18} /></span>
              <span className="operonai-nav-item-text">Communications</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'docai' ? 'active' : ''}`}
              onClick={() => setActiveNav('docai')}
            >
              <span className="operonai-nav-item-icon"><FileText size={18} /></span>
              <span className="operonai-nav-item-text">Document AI</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveNav('sales')}
            >
              <span className="operonai-nav-item-icon"><TrendingUp size={18} /></span>
              <span className="operonai-nav-item-text">Sales Intelligence</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveNav('workflow')}
            >
              <span className="operonai-nav-item-icon"><GitBranch size={18} /></span>
              <span className="operonai-nav-item-text">Automation Builder</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'logs' ? 'active' : ''}`}
              onClick={() => { setLogsAgentId(undefined); setActiveNav('logs'); }}
            >
              <span className="operonai-nav-item-icon"><Activity size={18} /></span>
              <span className="operonai-nav-item-text">Execution Logs</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'workforce' ? 'active' : ''}`}
              onClick={() => setActiveNav('workforce')}
            >
              <span className="operonai-nav-item-icon"><Users size={18} /></span>
              <span className="operonai-nav-item-text">Workforce</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveNav('monitoring')}
            >
              <span className="operonai-nav-item-icon"><Activity size={18} /></span>
              <span className="operonai-nav-item-text">Monitoring</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'marketplace' ? 'active' : ''}`}
              onClick={() => setActiveNav('marketplace')}
            >
              <span className="operonai-nav-item-icon"><ShoppingCart size={18} /></span>
              <span className="operonai-nav-item-text">Marketplace</span>
            </button>

            <button
              className="operonai-nav-item operonai-nav-logout"
              onClick={signOut}
            >
              <span className="operonai-nav-item-icon"><LogOut size={18} /></span>
              <span className="operonai-nav-item-text">Log Out</span>
            </button>
          </div>

          <div className="operonai-sidebar-spacer" />
        </aside>

        {/* ──────── MAIN CONTENT ──────── */}
        <div className="operonai-container">

        {/* Communications Agent View */}
        {isComms && <CommunicationsAgent />}

        {/* Document Intelligence View */}
        {isDocAI && (
          <DocumentIntelligence
            initialView={location.pathname === '/docai/replicate' ? 'replicate' : undefined}
          />
        )}

        {/* Sales Intelligence View */}
        {isSales && <SalesIntelligence />}

        {/* Workflow Builder View */}
        {isWorkflow && (
          <WorkflowBuilder
            key={editWorkflowKey}
            onSave={handleWorkflowSave}
            onClose={() => {
              setActiveNav('agents');
              setSidebarVisibleInWorkflow(false);
              setEditWorkflow(null);
              setEditWorkflowName(undefined);
            }}
            initialWorkflow={editWorkflow || undefined}
            initialName={editWorkflowName}
            onToggleSidebar={() => setSidebarVisibleInWorkflow(!sidebarVisibleInWorkflow)}
            onDeploy={handleWorkflowDeploy}
            isDeploying={isDeploying}
          />
        )}

        {/* Execution Logs View */}
        {isLogs && (
          <ExecutionLogs
            agentId={logsAgentId}
            onBack={() => { setLogsAgentId(undefined); setActiveNav('agents'); }}
          />
        )}

        {/* Workforce Dashboard View */}
        {isWorkforce && (
          <WorkforceDashboard />
        )}

        {/* Monitoring Dashboard View */}
        {isMonitoring && (
          <MonitoringDashboard />
        )}

        {/* Agent Marketplace View */}
        {isMarketplace && (
          <AgentMarketplace />
        )}

        {/* Agent Workforce View (Home) */}
        {!isDocAI && !isComms && !isSales && !isWorkflow && !isLogs && !isWorkforce && !isMonitoring && !isMarketplace && (
        <div className="operonai-main">
          {/* Workforce Header */}
          <div className="aw-header">
            <div className="aw-header-left">
              <h1 className="aw-title">Agent Workforce</h1>
              <p className="aw-subtitle">Manage and monitor your deployed AI agents</p>
            </div>
            <OperonConsole callbacks={operonCallbacks} />
          </div>

          {/* Tabs + Search */}
          <div className="aw-toolbar">
            <div className="aw-tabs">
              <button
                className={`aw-tab ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
              >
                <List size={15} />
                List
              </button>
              <button
                className={`aw-tab ${activeTab === 'board' ? 'active' : ''}`}
                onClick={() => setActiveTab('board')}
              >
                <Kanban size={15} />
                Board
              </button>
              <button
                className={`aw-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => setActiveTab('calendar')}
              >
                <Calendar size={15} />
                Calendar
              </button>
            </div>

            <button className="aw-new-agent-btn" onClick={() => setShowCatalog(true)}>
              <Plus size={16} />
              New agent
            </button>

            <div className="aw-search-area">
              <div className="aw-search-box">
                <Search size={15} />
                <input type="text" placeholder="Search agent" />
              </div>
              <button className="aw-toolbar-icon-btn" title="Filter">
                <SlidersHorizontal size={16} />
              </button>
              <button className="aw-toolbar-btn-text" title="Invite team members">
                <UserPlus size={16} />
                <span>Invite team members</span>
              </button>
              <button className="aw-toolbar-icon-btn" title="More options">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Execution result toast */}
          {executionResult && (
            <div className={`operonai-execution-toast ${
              !executionResult.success ? 'error' : executionResult.isReal ? 'success' : 'simulated'
            }`}>
              <div className="operonai-execution-toast-icon">
                {!executionResult.success ? (
                  <AlertCircle size={18} />
                ) : executionResult.isReal ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
              </div>
              <div className="operonai-execution-toast-content">
                <span className="operonai-execution-toast-message">{executionResult.message}</span>
                {executionResult.isReal ? (
                  <span className="operonai-execution-toast-badge real">✓ Real API Execution</span>
                ) : executionResult.success ? (
                  <span className="operonai-execution-toast-badge demo">⚡ Demo Mode — Simulated Only</span>
                ) : null}
                {executionResult.nodeDetails && executionResult.nodeDetails.length > 0 && (
                  <div className="operonai-execution-node-details">
                    {executionResult.nodeDetails.slice(0, 8).map((node, i) => (
                      <span key={i} className={`operonai-execution-node ${
                        node.status === 'completed' ? (node.isReal ? 'real' : 'simulated') 
                        : node.status === 'failed' ? 'failed' 
                        : 'skipped'
                      }`}>
                        {node.status === 'completed' ? (node.isReal ? '●' : '✓') : node.status === 'failed' ? '✗' : '○'} {node.name}
                      </span>
                    ))}
                    {executionResult.nodeDetails.length > 8 && (
                      <span className="operonai-execution-node simulated">+{executionResult.nodeDetails.length - 8} more</span>
                    )}
                  </div>
                )}
                <div className="operonai-execution-toast-actions">
                  <button
                    className="operonai-execution-view-output-btn"
                    onClick={() => {
                      if (!executionOutputPanel) {
                        const result_logs = executionResult.nodeDetails?.map(nd => ({
                          nodeId: nd.name.toLowerCase().replace(/\s+/g, '-'),
                          nodeName: nd.name,
                          nodeType: nd.type,
                          status: nd.status as 'completed' | 'failed' | 'skipped',
                          isReal: nd.isReal,
                          startedAt: new Date(),
                          input: null,
                          output: null,
                        })) || [];
                        setExecutionOutputPanel({
                          agentId: executionResult.agentId,
                          agentName: executionResult.agentName,
                          logs: result_logs,
                          success: executionResult.success,
                          isReal: executionResult.isReal,
                        });
                      }
                      setExecutionResult(null);
                    }}
                  >
                    <Eye size={13} />
                    View Execution Details
                  </button>
                  <button
                    className="operonai-execution-view-logs-btn"
                    onClick={() => {
                      setLogsAgentId(executionResult.agentId);
                      setActiveNav('logs');
                      setExecutionResult(null);
                    }}
                  >
                    <Activity size={13} />
                    Full Logs →
                  </button>
                </div>
              </div>
              <button className="operonai-execution-toast-close" onClick={() => setExecutionResult(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* General toast notification */}
          {toastNotification && (
            <div className={`operonai-execution-toast ${toastNotification.type}`}>
              <div className="operonai-execution-toast-icon">
                {toastNotification.type === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : toastNotification.type === 'error' ? (
                  <AlertCircle size={18} />
                ) : (
                  <AlertTriangle size={18} />
                )}
              </div>
              <div className="operonai-execution-toast-content">
                <span className="operonai-execution-toast-message">{toastNotification.message}</span>
              </div>
              <button className="operonai-execution-toast-close" onClick={() => setToastNotification(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* My Agents Section */}
          <div className="aw-agents-section">
            <div className="aw-agents-section-header">
              <h3 className="aw-agents-section-title">My Agents</h3>
              <span className="aw-agents-count">{automationAgents.length}</span>
            </div>

            {automationAgents.length === 0 ? (
              <div className="aw-empty-state">
                <div className="aw-empty-icon"><Bot size={32} /></div>
                <h3>No agents deployed yet</h3>
                <p>Create your first agent to get started with automation.</p>
                <button className="aw-new-agent-btn" onClick={() => setShowCatalog(true)}>
                  <Plus size={16} /> New agent
                </button>
              </div>
            ) : activeTab === 'list' ? (
              <div className="aw-agents-list">
                <div className="aw-list-header">
                  <span className="aw-list-col name">Name</span>
                  <span className="aw-list-col status">Status</span>
                  <span className="aw-list-col runs">Runs</span>
                  <span className="aw-list-col last-run">Last Run</span>
                  <span className="aw-list-col actions">Actions</span>
                </div>
                {automationAgents.map((agent: AutomationAgent) => (
                  <div key={agent.id} className="aw-list-row">
                    <span className="aw-list-col name">
                      <div className={`aw-agent-status-dot ${agent.status}`} />
                      <div>
                        <div className="aw-list-agent-name">{agent.name}</div>
                        <div className="aw-list-agent-desc">{agent.description || `Automated workflow`}</div>
                      </div>
                    </span>
                    <span className="aw-list-col status">
                      <span className={`aw-list-status-badge ${agent.status}`}>{agent.status}</span>
                    </span>
                    <span className="aw-list-col runs">{agent.totalExecutions || 0}</span>
                    <span className="aw-list-col last-run">
                      {agent.lastExecutedAt ? new Date(agent.lastExecutedAt).toLocaleDateString() : '—'}
                    </span>
                    <span className="aw-list-col actions">
                      <button className="aw-agent-action-btn run" onClick={() => handleRunAgent(agent.id)} disabled={runningAgentId === agent.id}>
                        {runningAgentId === agent.id ? <Loader2 size={13} className="spinning" /> : <Play size={13} />}
                        {runningAgentId === agent.id ? 'Running...' : 'Run'}
                      </button>
                      <button className="aw-agent-action-btn edit" onClick={() => navigate(`/automation-builder/${agent.id}`)}>
                        <PenTool size={13} />
                      </button>
                      <button className="aw-agent-action-btn pause" onClick={() => agent.status === 'active' ? pauseAgent(agent.id) : resumeAgent(agent.id)}>
                        {agent.status === 'active' ? '⏸' : '▶'}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ) : activeTab === 'calendar' ? (
              <div className="aw-agents-calendar">
                {(() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
                  const today = now.getDate();

                  const agentsByDay: Record<number, AutomationAgent[]> = {};
                  for (const agent of automationAgents) {
                    const d = agent.lastExecutedAt ? new Date(agent.lastExecutedAt) : agent.createdAt ? new Date(agent.createdAt) : null;
                    if (d && d.getFullYear() === year && d.getMonth() === month) {
                      const day = d.getDate();
                      if (!agentsByDay[day]) agentsByDay[day] = [];
                      agentsByDay[day].push(agent);
                    }
                  }

                  return (
                    <>
                      <div className="aw-cal-header">
                        <span className="aw-cal-title">{monthNames[month]} {year}</span>
                      </div>
                      <div className="aw-cal-grid">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                          <div key={d} className="aw-cal-day-header">{d}</div>
                        ))}
                        {Array.from({ length: totalCells }, (_, i) => {
                          const dayNum = i - firstDay + 1;
                          const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
                          const events = inMonth ? agentsByDay[dayNum] : undefined;
                          return (
                            <div key={i} className={`aw-cal-day ${!inMonth ? 'outside' : ''} ${inMonth && dayNum === today ? 'today' : ''}`}>
                              {inMonth && (
                                <>
                                  <span className="aw-cal-day-num">{dayNum}</span>
                                  {events?.map(a => (
                                    <div key={a.id} className={`aw-cal-event ${a.status}`} title={a.name}>
                                      <span className={`aw-agent-status-dot ${a.status}`} />
                                      {a.name}
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="aw-agents-grid">
                {automationAgents.map((agent: AutomationAgent) => {
                  const requiredServices: string[] = [];
                  agent.workflow.nodes.forEach(n => {
                    const config = n.config as any;
                    if (n.type === 'app' && config?.appType) {
                      const appName = config.appType.charAt(0).toUpperCase() + config.appType.slice(1);
                      if (!requiredServices.includes(appName)) requiredServices.push(appName);
                    }
                    if (n.type === 'ai') requiredServices.includes('AI') || requiredServices.push('AI');
                  });

                  const completedTasks = agent.totalExecutions || 0;
                  const totalTasks = 10;

                  return (
                    <div key={agent.id} className="aw-agent-card">
                      <div className={`aw-agent-status-dot ${agent.status}`} />

                      <h4 className="aw-agent-card-name">{agent.name}</h4>
                      <p className="aw-agent-card-desc">
                        {agent.description || `Automated workflow: ${agent.name}`}
                      </p>

                      {/* Subtask progress */}
                      <div className="aw-agent-subtask">
                        <span className="aw-agent-subtask-label">Subtask</span>
                        <span className="aw-agent-subtask-count">{completedTasks}/{totalTasks}</span>
                      </div>
                      <div className="aw-agent-progress-bar">
                        <div
                          className="aw-agent-progress-fill"
                          style={{ width: `${Math.min(100, (completedTasks / totalTasks) * 100)}%` }}
                        />
                      </div>

                      {/* Tags */}
                      <div className="aw-agent-tags">
                        <span className="aw-agent-tag today">Today</span>
                        {requiredServices.slice(0, 2).map(s => (
                          <span key={s} className="aw-agent-tag service">{s}</span>
                        ))}
                      </div>

                      {/* Date & stats */}
                      <div className="aw-agent-card-meta">
                        <span className="aw-agent-meta-date">
                          <Calendar size={12} />
                          {agent.lastExecutedAt ? new Date(agent.lastExecutedAt).toLocaleDateString() : 'Today'}
                        </span>
                        <span className="aw-agent-meta-stat">
                          <Zap size={12} />
                          {agent.totalExecutions || 0}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="aw-agent-card-actions">
                        <button
                          className="aw-agent-action-btn more"
                          title="More options"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        <button
                          className="aw-agent-action-btn run"
                          onClick={() => handleRunAgent(agent.id)}
                          disabled={runningAgentId === agent.id}
                          title="Run agent"
                        >
                          {runningAgentId === agent.id ? (
                            <Loader2 size={13} className="spinning" />
                          ) : (
                            <Play size={13} />
                          )}
                          {runningAgentId === agent.id ? 'Running...' : 'Run'}
                        </button>
                        {agentResults[agent.id] && (
                          <button
                            className="aw-agent-action-btn results"
                            onClick={() => setViewingResultId(agent.id)}
                            title="View last run results"
                          >
                            <Database size={13} />
                            Results
                          </button>
                        )}
                        <button
                          className="aw-agent-action-btn logs"
                          onClick={() => { setLogsAgentId(agent.id); setActiveNav('logs'); }}
                          title="View logs"
                        >
                          <Zap size={13} />
                          Logs
                        </button>
                        <button
                          className="aw-agent-action-btn edit"
                          onClick={() => navigate(`/automation-builder/${agent.id}`)}
                          title="Edit"
                        >
                          <PenTool size={13} />
                          Edit
                        </button>
                        <button
                          className="aw-agent-action-btn pause"
                          onClick={() => agent.status === 'active' ? pauseAgent(agent.id) : resumeAgent(agent.id)}
                          title={agent.status === 'active' ? 'Pause' : 'Resume'}
                        >
                          {agent.status === 'active' ? '⏸' : '▶'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
        )}
        </div>

        {/* ──────── UNIFIED DEPLOY AGENT CATALOG MODAL ──────── */}
        {showCatalog && (
          <div className="operonai-modal-overlay" onClick={() => { setShowCatalog(false); setExpandedCatalog(null); }}>
            <div className="operonai-modal-catalog operonai-modal-catalog-wide" onClick={e => e.stopPropagation()}>
              {/* ─── Header ─── */}
              <div className="operonai-modal-header">
                <div className="operonai-modal-header-left">
                  <div className="operonai-modal-icon">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h2 className="operonai-modal-title">Deploy an Agent</h2>
                    <p className="operonai-modal-subtitle">
                      {agentCatalog.length} built-in agents + {templateResults?.total?.toLocaleString() ?? '3,600+'} automations
                    </p>
                  </div>
                </div>
                <button className="operonai-modal-close" onClick={() => { setShowCatalog(false); setExpandedCatalog(null); }}>
                  <X size={20} />
                </button>
              </div>

              {/* ─── Create from Prompt Banner ─── */}
              <div
                style={{
                  margin: '0 24px',
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #e07a3a 0%, #c05d1e 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onClick={() => { setShowCatalog(false); setShowPromptWizard(true); }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 25px rgba(139, 92, 246, 0.3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wand2 size={20} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>Create Agent from Prompt</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>Describe what you want in plain English — AI builds and deploys it for you</div>
                </div>
                <ChevronRight size={20} color="rgba(255,255,255,0.6)" />
              </div>

              {/* ─── Search Bar + Filters ─── */}
              <div className="oc-search-bar">
                <div className="oc-search-input-wrapper">
                  <Search size={16} className="oc-search-icon" />
                  <input
                    type="text"
                    className="oc-search-input"
                    placeholder={`Search ${agentCatalog.length + (templateResults?.total ?? 3600)}+ agents & automations...`}
                    value={catalogSearch}
                    onChange={(e) => { setCatalogSearch(e.target.value); setTemplatePage(1); }}
                    autoFocus
                  />
                  {catalogSearch && (
                    <button className="oc-search-clear" onClick={() => setCatalogSearch('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* ─── Body: Sidebar + Content Grid ─── */}
              <div className="oc-body">
                {/* Sidebar */}
                <div className="oc-sidebar">
                  <div className="oc-sidebar-title">Categories</div>
                  <button
                    className={`oc-cat-btn ${catalogCategory === 'All' ? 'active' : ''}`}
                    onClick={() => { setCatalogCategory('All'); setTemplatePage(1); }}
                  >
                    <Layers size={14} />
                    <span>All Templates</span>
                    <span className="oc-cat-count">{(templateResults?.total ?? 0) + agentCatalog.length}</span>
                  </button>
                  <button
                    className={`oc-cat-btn ${catalogCategory === 'Built-in Agents' ? 'active' : ''}`}
                    onClick={() => { setCatalogCategory('Built-in Agents'); setTemplatePage(1); }}
                  >
                    <Bot size={14} />
                    <span>Built-in Agents</span>
                    <span className="oc-cat-count">{agentCatalog.length}</span>
                  </button>
                  {templateCategories.map(cat => (
                    <button
                      key={cat.name}
                      className={`oc-cat-btn ${catalogCategory === cat.name ? 'active' : ''}`}
                      onClick={() => { setCatalogCategory(cat.name); setTemplatePage(1); }}
                    >
                      {catalogCategoryIcons[cat.name] || <Folder size={14} />}
                      <span>{cat.name}</span>
                      <span className="oc-cat-count">{cat.count}</span>
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="oc-content">
                  {/* ─── Built-in Agents (card grid) ─── */}
                  {(catalogCategory === 'All' || catalogCategory === 'Built-in Agents') && filteredBuiltinAgents.length > 0 && (
                    <div className="oc-section">
                      <h3 className="oc-section-title">
                        <Bot size={16} /> Built-in Agents
                      </h3>
                      <div className="oc-grid">
                        {filteredBuiltinAgents.map((agent) => {
                          const latestVer = agent.versions[0];
                          const alreadyDeployed = isVersionDeployed(agent.id, latestVer?.id);
                          const isCurrentlyDeploying = deployingVersion === `${agent.id}-${latestVer?.id}`;
                          return (
                            <div key={agent.id} className="oc-card" onClick={() => setExpandedCatalog(expandedCatalog === agent.id ? null : agent.id)}>
                              <div className="oc-card-header">
                                <span className="oc-card-category">
                                  {getCatalogIcon(agent.icon)}
                                  {agent.category}
                                </span>
                                <span className="oc-card-badge-builtin">Built-in</span>
                              </div>
                              <h4 className="oc-card-title">{agent.name}</h4>
                              <p className="oc-card-desc">{agent.description}</p>
                              <div className="oc-card-services">
                                {agent.tags.slice(0, 3).map(t => (
                                  <span key={t.label} className="oc-card-service">{t.label}</span>
                                ))}
                                {agent.tags.length > 3 && (
                                  <span className="oc-card-service oc-more">+{agent.tags.length - 3}</span>
                                )}
                              </div>
                              <div className="oc-card-footer">
                                <span className="oc-card-meta">
                                  <Package size={12} /> {agent.versions.length} ver{agent.versions.length > 1 ? 's' : ''}
                                </span>
                                <span className="oc-card-meta">
                                  <Zap size={12} /> {latestVer?.availability ?? 'stable'}
                                </span>
                                {alreadyDeployed ? (
                                  <span className="oc-card-deployed">
                                    <CheckCircle2 size={12} /> Deployed
                                  </span>
                                ) : (
                                  <button
                                    className="oc-card-action"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (latestVer && !isCurrentlyDeploying) deployAgent(agent, latestVer);
                                    }}
                                    disabled={isCurrentlyDeploying}
                                  >
                                    {isCurrentlyDeploying ? (
                                      <Loader2 size={14} className="operonai-spin" />
                                    ) : (
                                      <><Download size={14} /> Deploy</>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─── Automation Templates (card grid) ─── */}
                  {catalogCategory !== 'Built-in Agents' && (
                    <div className="oc-section">
                      <h3 className="oc-section-title">
                        {catalogSearch ? (
                          <>
                            <Search size={16} />
                            {templateResults?.total ?? 0} results
                            <span className="oc-search-term"> for &ldquo;{catalogSearch}&rdquo;</span>
                          </>
                        ) : (
                          <>
                            <Zap size={16} /> {catalogCategory !== 'All' ? catalogCategory : 'All Automations'}
                          </>
                        )}
                      </h3>

                      {templatesLoading ? (
                        <div className="oc-loading">
                          <Loader2 size={32} className="operonai-spin" />
                          <span>Loading automations…</span>
                        </div>
                      ) : templateResults && templateResults.templates.length > 0 ? (
                        <>
                          <div className="oc-grid">
                            {templateResults.templates.map((tpl, tplIdx) => {
                              const isLaunching = launchingTemplateId === tpl.id;
                              return (
                                <div key={`${tpl.id}_${tplIdx}`} className="oc-card">
                                  <div className="oc-card-header">
                                    <span className="oc-card-category">
                                      {catalogCategoryIcons[tpl.category] || <Folder size={12} />}
                                      {tpl.category}
                                    </span>
                                    <span className="oc-card-complexity" style={{ color: catalogComplexityColors[tpl.complexity] }}>
                                      {tpl.complexity}
                                    </span>
                                  </div>
                                  <h4 className="oc-card-title">{tpl.name}</h4>
                                  <p className="oc-card-desc">
                                    {tpl.description || `Automated workflow: ${tpl.name}. This workflow processes data and performs automated tasks.`}
                                  </p>
                                  <div className="oc-card-services">
                                    {tpl.services.slice(0, 4).map(svc => (
                                      <span key={svc} className="oc-card-service">{svc}</span>
                                    ))}
                                    {tpl.services.length > 4 && (
                                      <span className="oc-card-service oc-more">+{tpl.services.length - 4}</span>
                                    )}
                                  </div>
                                  <div className="oc-card-footer">
                                    <span className="oc-card-meta">
                                      <Cpu size={12} /> {tpl.nodeCount} nodes
                                    </span>
                                    <span className="oc-card-meta">
                                      <Zap size={12} /> {tpl.triggerType || 'manual'}
                                    </span>
                                    <button
                                      className="oc-card-action"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLaunchTemplate(tpl);
                                      }}
                                      disabled={isLaunching}
                                    >
                                      {isLaunching ? (
                                        <Loader2 size={14} className="operonai-spin" />
                                      ) : (
                                        <><Download size={14} /> Use</>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination */}
                          {templateResults.totalPages > 1 && (
                            <div className="oc-pagination">
                              <button
                                className="oc-page-btn"
                                disabled={templatePage <= 1}
                                onClick={() => setTemplatePage(p => Math.max(1, p - 1))}
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <span className="oc-page-info">
                                Page {templatePage} of {templateResults.totalPages}
                              </span>
                              <button
                                className="oc-page-btn"
                                disabled={templatePage >= templateResults.totalPages}
                                onClick={() => setTemplatePage(p => p + 1)}
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      ) : !templatesLoading ? (
                        <div className="oc-empty">
                          <Search size={32} />
                          <p>No automations found{catalogSearch ? ` for "${catalogSearch}"` : ''}</p>
                          <button className="oc-reset-btn" onClick={() => {
                            setCatalogSearch('');
                            setCatalogCategory('All');
                            setTemplatePage(1);
                          }}>
                            Reset Filters
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Empty state for built-in agents */}
                  {catalogCategory === 'Built-in Agents' && filteredBuiltinAgents.length === 0 && (
                    <div className="oc-empty">
                      <Search size={32} />
                      <p>No built-in agents found{catalogSearch ? ` for "${catalogSearch}"` : ''}</p>
                      <button className="oc-reset-btn" onClick={() => { setCatalogSearch(''); setCatalogCategory('All'); }}>
                        Reset Filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── AGENT DETAIL MODAL ──────── */}
        {selectedAgent && (() => {
          const catAgent = agentCatalog.find(c => c.id === selectedAgent.catalogId);
          const selVersion = catAgent?.versions.find(v => v.id === selectedAgent.versionId) || catAgent?.versions[0];
          const st = statusConfig[selectedAgent.status];
          return (
            <div className="operonai-modal-overlay" onClick={() => setSelectedAgent(null)}>
              <div className="operonai-agent-detail-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="operonai-detail-header">
                  <div className="operonai-detail-header-left">
                    <h2 className="operonai-detail-title">{selectedAgent.title}</h2>
                    <div className="operonai-detail-meta">
                      <div className="operonai-card-status-pill" style={{ background: st.bg, color: st.color }}>
                        {selectedAgent.status === 'running' && <CheckCircle2 size={12} />}
                        {selectedAgent.status === 'idle' && <Circle size={12} />}
                        {selectedAgent.status === 'error' && <AlertCircle size={12} />}
                        {selectedAgent.status === 'provisioning' && <Loader2 size={12} className="operonai-spin" />}
                        {st.label}
                      </div>
                      <span className="operonai-detail-version">{selectedAgent.version}</span>
                      <span className="operonai-detail-date"><Calendar size={13} /> Deployed {selectedAgent.date}</span>
                    </div>
                  </div>
                  <button className="operonai-modal-close" onClick={() => setSelectedAgent(null)}>
                    <X size={20} />
                  </button>
                </div>

                {/* Tags */}
                <div className="operonai-detail-tags">
                  {selectedAgent.tags.map(tag => (
                    <span key={tag.label} className={`operonai-card-tag ${tag.className}`}>{tag.label}</span>
                  ))}
                  {catAgent && <span className="operonai-detail-category">{catAgent.category}</span>}
                </div>

                {/* Description */}
                <div className="operonai-detail-section">
                  <h3 className="operonai-detail-section-title">Description</h3>
                  <p className="operonai-detail-description">{selectedAgent.description}</p>
                </div>

                {/* Metrics */}
                {(selectedAgent.accuracy || selectedAgent.latency || selectedAgent.uptime) && (
                  <div className="operonai-detail-section">
                    <h3 className="operonai-detail-section-title">Performance</h3>
                    <div className="operonai-detail-metrics">
                      {selectedAgent.accuracy && selectedAgent.accuracy !== '—' && (
                        <div className="operonai-detail-metric-card">
                          <span className="operonai-detail-metric-val">{selectedAgent.accuracy}</span>
                          <span className="operonai-detail-metric-label">Accuracy</span>
                        </div>
                      )}
                      {selectedAgent.latency && (
                        <div className="operonai-detail-metric-card">
                          <span className="operonai-detail-metric-val">{selectedAgent.latency}</span>
                          <span className="operonai-detail-metric-label">Latency</span>
                        </div>
                      )}
                      {selectedAgent.uptime && (
                        <div className="operonai-detail-metric-card">
                          <span className="operonai-detail-metric-val">{selectedAgent.uptime}</span>
                          <span className="operonai-detail-metric-label">Uptime</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Version Info */}
                {selVersion && (
                  <div className="operonai-detail-section">
                    <h3 className="operonai-detail-section-title">Version Details</h3>
                    <div className="operonai-detail-version-card">
                      <div className="operonai-detail-version-row">
                        <span className="operonai-detail-version-label">Version</span>
                        <span className="operonai-detail-version-value">{selVersion.version}</span>
                      </div>
                      <div className="operonai-detail-version-row">
                        <span className="operonai-detail-version-label">Release Date</span>
                        <span className="operonai-detail-version-value">{selVersion.releaseDate}</span>
                      </div>
                      <div className="operonai-detail-version-row">
                        <span className="operonai-detail-version-label">Availability</span>
                        <span className={`operonai-avail-badge operonai-avail-${selVersion.availability}`}>{selVersion.availability}</span>
                      </div>
                      <div className="operonai-detail-version-row">
                        <span className="operonai-detail-version-label">Changes</span>
                        <span className="operonai-detail-version-value">{selVersion.changes}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team */}
                <div className="operonai-detail-section">
                  <h3 className="operonai-detail-section-title">Team</h3>
                  <div className="operonai-detail-team">
                    {selectedAgent.avatars.map(av => (
                      <div key={av.initial} className="operonai-detail-team-member">
                        <div className="operonai-card-avatar" style={{ background: av.color }}>{av.initial}</div>
                      </div>
                    ))}
                    {selectedAgent.extraAvatars && (
                      <div className="operonai-detail-team-member">
                        <div className="operonai-card-avatar operonai-card-avatar-extra">+{selectedAgent.extraAvatars}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Vision Agent Execution Viewers (multiple simultaneous) */}
      {activeViewers.map((viewer, idx) => (
        <AgentExecutionViewer
          key={viewer.key}
          agentId={viewer.agentId}
          agentName={viewer.agentName}
          task={viewer.task}
          url={viewer.url}
          appName={viewer.appName}
          index={idx}
          onClose={() => closeViewer(viewer.key)}
          onComplete={handleViewerComplete}
        />
      ))}

      {/* Agent Results Modal */}
      {viewingResultId && agentResults[viewingResultId] && (() => {
        const result = agentResults[viewingResultId];
        return (
          <div className="aev-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewingResultId(null); }}>
            <div style={{
              background: '#ffffff',
              borderRadius: 16,
              width: '90%',
              maxWidth: 600,
              maxHeight: '80vh',
              overflow: 'auto',
              padding: '28px 32px',
              color: '#0f172a',
              boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{result.agentName}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    {result.status === 'done' ? 'Completed' : 'Failed'} in {result.totalSteps} steps — {new Date(result.completedAt).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setViewingResultId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 8 }}>Task</div>
                <div style={{ fontSize: 14, color: '#475569', background: '#f8f9fa', padding: '10px 14px', borderRadius: 8, lineHeight: 1.5, border: '1px solid #e5e7eb' }}>{result.task}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 8 }}>
                  {result.status === 'done' ? 'Extracted Data' : 'Error'}
                </div>
                {result.status === 'error' && result.error ? (
                  <div style={{ fontSize: 14, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca' }}>{result.error}</div>
                ) : result.extractedData ? (
                  <pre style={{
                    fontSize: 13,
                    color: '#c05d1e',
                    background: 'rgba(224, 122, 58, 0.06)',
                    padding: '14px 16px',
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 400,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    lineHeight: 1.6,
                    border: '1px solid rgba(224, 122, 58, 0.15)',
                  }}>{JSON.stringify(result.extractedData, null, 2)}</pre>
                ) : (
                  <div style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>No data was extracted</div>
                )}
              </div>

              {result.status === 'done' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(result.extractedData, null, 2));
                    }}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
                      background: '#ffffff', color: '#475569', fontSize: 13, cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={() => setViewingResultId(null)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #e07a3a, #d46b2c)', color: '#fff', fontSize: 13, cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Execution Output Panel (n8n-style) */}
      {executionOutputPanel && (
        <ExecutionOutputPanel
          agentName={executionOutputPanel.agentName}
          logs={executionOutputPanel.logs}
          success={executionOutputPanel.success}
          error={executionOutputPanel.error}
          isReal={executionOutputPanel.isReal}
          onClose={() => setExecutionOutputPanel(null)}
          onViewFullLogs={() => {
            setLogsAgentId(executionOutputPanel.agentId);
            setActiveNav('logs');
            setExecutionOutputPanel(null);
          }}
        />
      )}

      {/* User Input Modal - shown when execution pauses for required input */}
      {pausedExecution && (
        <UserInputModal
          nodeName={pausedExecution.nodeName}
          message={pausedExecution.inputPromptMessage}
          requiredInputs={pausedExecution.requiredInputs}
          onSubmit={handleResumeExecution}
          onCancel={handleCancelExecution}
          isSubmitting={isResumingExecution}
        />
      )}

      {/* Prompt-to-Agent Wizard (accessible from catalog and agents page) */}
      {showPromptWizard && (
        <AgentSetupWizard
          onClose={() => setShowPromptWizard(false)}
          onDeploy={handlePromptWizardDeploy}
          onDeployWorkflow={handlePromptWizardDeployWorkflow}
          isDeploying={isDeploying}
        />
      )}
    </div>
  );
}
