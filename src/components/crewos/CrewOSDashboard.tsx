import { useState, useCallback, useEffect } from 'react';
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
import { WorkflowBuilder } from '../workflow';
import { useAuth } from '../../contexts/AuthContext';
import { useAgents } from '../../contexts/AgentContext';
import { WorkflowDefinition, DeployedAgent as AutomationAgent } from '../../services/automation';
import type { ExecutionLog } from '../../services/automation/executionEngine';
import {
  searchTemplates,
  importTemplate,
  getCategories,
  type WorkflowTemplate,
  type TemplateSearchResult,
} from '../../services/n8n';

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

const members = [
  { name: 'Aditya Miriyala', initial: 'AM', color: '#e07a3a', time: '08:06:28 for this week' },
  { name: 'Sarah Chen', initial: 'SC', color: '#e07a3a', time: '12:41:07 for this week' },
  { name: 'Marcus Johnson', initial: 'MJ', color: '#1a1a2e', time: '01:56:22 for this week' },
  { name: 'Priya Patel', initial: 'PP', color: '#d46b2c', time: '16:35:59 for this week' },
  { name: 'Alex Rodriguez', initial: 'AR', color: '#3a3a52', time: '' },
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
};

const navToPath: Record<string, string> = {
  agents: '/agents',
  comms: '/comms',
  docai: '/docai',
  sales: '/sales',
  workflow: '/workflow',
  logs: '/logs',
};

export function CrewOSDashboard() {
  const { signOut } = useAuth();
  const { agents: automationAgents, deployNewAgent, loading: agentsLoading, runAgent, pauseAgent, resumeAgent, deleteAgent: deleteAutomationAgent, backendStatus, lastExecutionLogs } = useAgents();
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

  /* Handle deploying from Workflow Builder */
  const handleWorkflowDeploy = useCallback(async (name: string, description: string, workflow: WorkflowDefinition) => {
    setIsDeploying(true);
    try {
      await deployNewAgent(name, description, workflow, 'Zap', '#8b5cf6');
      // Navigate back to agents page after successful deploy
      setActiveNav('agents');
    } catch (error) {
      console.error('Deploy error:', error);
    } finally {
      setIsDeploying(false);
    }
  }, [deployNewAgent, setActiveNav]);

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

  /* Handle running an automation agent with feedback */
  const handleRunAgent = useCallback(async (agentId: string) => {
    const agent = automationAgents.find(a => a.id === agentId);
    if (!agent) return;
    
    setRunningAgentId(agentId);
    setExecutionResult(null);
    
    try {
      const result = await runAgent(agentId);
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
  }, [automationAgents, runAgent]);

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
        '#8b5cf6'
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
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
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
              <span className="operonai-badge">8</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'docai' ? 'active' : ''}`}
              onClick={() => setActiveNav('docai')}
            >
              <span className="operonai-nav-item-icon"><FileText size={18} /></span>
              <span className="operonai-nav-item-text">Document AI</span>
              <span className="operonai-badge">6</span>
            </button>

            <button
              className={`operonai-nav-item ${activeNav === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveNav('sales')}
            >
              <span className="operonai-nav-item-icon"><TrendingUp size={18} /></span>
              <span className="operonai-nav-item-text">Sales Intelligence</span>
              <span className="operonai-badge">5</span>
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
              className="operonai-nav-item operonai-nav-logout"
              onClick={signOut}
            >
              <span className="operonai-nav-item-icon"><LogOut size={18} /></span>
              <span className="operonai-nav-item-text">Log Out</span>
            </button>
          </div>

          {/* Pipelines */}
          <div className="operonai-sidebar-section">
            <div className="operonai-sidebar-label">
              <span>Pipelines</span>
              <button className="operonai-sidebar-label-action"><Plus size={14} /></button>
            </div>

            <button className="operonai-project-item">
              <div className="operonai-project-icon" style={{ background: 'rgba(224,122,58,0.15)', color: '#e07a3a' }}>
                <FileText size={13} />
              </div>
              <span className="operonai-nav-item-text">Invoice Processing</span>
              <span className="operonai-badge">4</span>
            </button>

            <button className="operonai-project-item">
              <div className="operonai-project-icon" style={{ background: 'rgba(224,122,58,0.12)', color: '#e07a3a' }}>
                <Headphones size={13} />
              </div>
              <span className="operonai-nav-item-text">Support Triage</span>
            </button>

            <button className="operonai-project-item">
              <div className="operonai-project-icon" style={{ background: 'rgba(212,107,44,0.12)', color: '#d46b2c' }}>
                <PenTool size={13} />
              </div>
              <span className="operonai-nav-item-text">Content Generation</span>
            </button>

            <button className="operonai-project-item">
              <div className="operonai-project-icon" style={{ background: 'rgba(26,26,46,0.1)', color: '#1a1a2e' }}>
                <Database size={13} />
              </div>
              <span className="operonai-nav-item-text">Data Extraction</span>
            </button>
          </div>

          {/* Members */}
          <div className="operonai-sidebar-section">
            <div className="operonai-sidebar-label">
              <span>Members</span>
              <button className="operonai-sidebar-label-action"><Plus size={14} /></button>
            </div>

            {members.map((m) => (
              <button className="operonai-member-item" key={m.name}>
                <div className="operonai-member-avatar" style={{ background: m.color }}>{m.initial}</div>
                <div className="operonai-member-info">
                  <span className="operonai-member-name">{m.name}</span>
                  {m.time && <span className="operonai-member-time">{m.time}</span>}
                </div>
              </button>
            ))}
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
            onSave={(workflow) => {
              console.log('Workflow saved:', workflow);
            }}
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

        {/* Agent Workforce View (Home) */}
        {!isDocAI && !isComms && !isSales && !isWorkflow && !isLogs && (
        <div className="operonai-main">
          {/* AI Prompt Section */}
          <div className="operonai-prompt-section">
            <div className="operonai-prompt-header">
              <div className="operonai-prompt-badge">
                <Zap size={12} />
                <span>Automation</span>
              </div>
              <h2 className="operonai-prompt-title">
                What would you like to <span className="operonai-gradient-text">automate</span>?
              </h2>
            </div>
            <form className="operonai-prompt-form" onSubmit={handlePromptSubmit}>
              <div className="operonai-prompt-input-wrapper">
                <Wand2 size={18} className="operonai-prompt-input-icon" />
                <input
                  type="text"
                  className="operonai-prompt-input"
                  placeholder="Describe your automation in plain English..."
                  value={agentPrompt}
                  onChange={(e) => setAgentPrompt(e.target.value)}
                  disabled={isCreatingFromPrompt}
                />
                <button
                  type="submit"
                  className={`operonai-prompt-submit ${isCreatingFromPrompt ? 'loading' : ''}`}
                  disabled={!agentPrompt.trim() || isCreatingFromPrompt}
                >
                  {isCreatingFromPrompt ? (
                    <Loader2 size={18} className="operonai-spin" />
                  ) : (
                    <>
                      <span>Create</span>
                      <Send size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Deployed Automation Agents Section */}
          {automationAgents.length > 0 && (
            <div className="operonai-automation-agents-section">
              <div className="operonai-automation-header">
                <div className="operonai-automation-title-row">
                  <Zap size={20} className="operonai-automation-icon" />
                  <h3 className="operonai-automation-title">My Automation Agents</h3>
                  <span className="operonai-automation-count">{automationAgents.length}</span>
                </div>
                <div className="operonai-automation-header-right">
                  <div className={`operonai-backend-badge ${backendStatus ? 'connected' : 'offline'}`}>
                    <div className={`operonai-backend-dot ${backendStatus ? 'connected' : 'offline'}`} />
                    {backendStatus ? 'Live APIs' : 'Demo Mode'}
                  </div>
                  <button 
                    className="operonai-automation-new-btn"
                    onClick={() => setActiveNav('workflow')}
                  >
                    <Plus size={16} />
                    New Workflow
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
                          // Re-open the output panel if it was closed
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
              {/* Demo mode info banner */}
              {!backendStatus && automationAgents.length > 0 && (
                <div className="operonai-demo-banner">
                  <div className="operonai-demo-banner-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="operonai-demo-banner-content">
                    <strong>Demo Mode</strong> — No backend server connected. Running agents will simulate execution with mock data. 
                    To execute real automations (Gmail, Slack, AI), connect a backend server with API keys.
                  </div>
                </div>
              )}
              <div className="operonai-automation-grid">
                {automationAgents.map((agent: AutomationAgent) => {
                  // Detect which services this agent needs
                  const requiredServices: string[] = [];
                  agent.workflow.nodes.forEach(n => {
                    const config = n.config as any;
                    if (n.type === 'app' && config?.appType) {
                      const appName = config.appType.charAt(0).toUpperCase() + config.appType.slice(1);
                      if (!requiredServices.includes(appName)) requiredServices.push(appName);
                    }
                    if (n.type === 'ai') requiredServices.includes('AI') || requiredServices.push('AI');
                  });

                  return (
                  <div key={agent.id} className="operonai-automation-card">
                    <div className="operonai-automation-card-header">
                      <div className={`operonai-automation-card-icon ${agent.status === 'active' ? 'active' : agent.status === 'paused' ? 'paused' : ''}`}>
                        <Zap size={18} />
                      </div>
                      <div className="operonai-automation-card-info">
                        <h4 className="operonai-automation-card-name">{agent.name}</h4>
                        <p className="operonai-automation-card-desc">{agent.description || 'No description'}</p>
                      </div>
                      <div className={`operonai-automation-status operonai-automation-status-${agent.status}`}>
                        {agent.status === 'active' ? (
                          <><CheckCircle2 size={12} /> Active</>
                        ) : agent.status === 'paused' ? (
                          <><Circle size={12} /> Paused</>
                        ) : agent.status === 'error' ? (
                          <><AlertCircle size={12} /> Error</>
                        ) : (
                          <><Clock size={12} /> Draft</>
                        )}
                      </div>
                    </div>
                    {/* Required services */}
                    {requiredServices.length > 0 && (
                      <div className="operonai-automation-services">
                        {requiredServices.map(s => {
                          const isConnected = backendStatus && (
                            (s.toLowerCase() === 'gmail' && backendStatus.gmail.connected) ||
                            (s.toLowerCase() === 'slack' && backendStatus.slack.connected) ||
                            (s.toLowerCase() === 'ai' && backendStatus.ai.configured)
                          );
                          return (
                            <span key={s} className={`operonai-service-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                              {isConnected ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                              {s}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="operonai-automation-card-stats">
                      <div className="operonai-automation-stat">
                        <span className="operonai-automation-stat-value">{agent.workflow.nodes.length}</span>
                        <span className="operonai-automation-stat-label">Nodes</span>
                      </div>
                      <div className="operonai-automation-stat">
                        <span className="operonai-automation-stat-value">{agent.totalExecutions}</span>
                        <span className="operonai-automation-stat-label">Test Runs</span>
                      </div>
                      <div className="operonai-automation-stat">
                        <span className="operonai-automation-stat-value">
                          {agent.lastExecutedAt ? new Date(agent.lastExecutedAt).toLocaleDateString() : '—'}
                        </span>
                        <span className="operonai-automation-stat-label">Last Run</span>
                      </div>
                    </div>
                    <div className="operonai-automation-card-actions">
                      <button 
                        className="operonai-automation-action-btn operonai-automation-run-btn"
                        onClick={() => handleRunAgent(agent.id)}
                        disabled={agent.status !== 'active' || runningAgentId === agent.id}
                        title={runningAgentId === agent.id ? 'Running...' : backendStatus ? 'Run now' : 'Test run (simulated)'}
                      >
                        {runningAgentId === agent.id ? (
                          <><Loader2 size={14} className="operonai-spin" /> Running...</>
                        ) : backendStatus ? (
                          <><Play size={14} /> Run</>
                        ) : (
                          <><Play size={14} /> Test Run</>
                        )}
                      </button>
                      <button
                        className="operonai-automation-action-btn operonai-automation-logs-btn"
                        onClick={() => { setLogsAgentId(agent.id); setActiveNav('logs'); }}
                        title="View execution logs"
                      >
                        <Activity size={14} />
                        Logs
                      </button>
                      {agent.status === 'active' ? (
                        <button 
                          className="operonai-automation-action-btn"
                          onClick={() => pauseAgent(agent.id)}
                          title="Pause agent"
                        >
                          <Circle size={14} />
                          Pause
                        </button>
                      ) : agent.status === 'paused' ? (
                        <button 
                          className="operonai-automation-action-btn"
                          onClick={() => resumeAgent(agent.id)}
                          title="Resume agent"
                        >
                          <Play size={14} />
                          Resume
                        </button>
                      ) : null}
                      <button 
                        className="operonai-automation-action-btn operonai-automation-delete-btn"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this agent?')) {
                            deleteAutomationAgent(agent.id);
                          }
                        }}
                        title="Delete agent"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="operonai-header">
            <div className="operonai-header-left">
              <h1 className="operonai-header-title">Agent Catalog</h1>

              <div className="operonai-tabs">
                <button
                  className={`operonai-tab ${activeTab === 'list' ? 'active' : ''}`}
                  onClick={() => setActiveTab('list')}
                >
                  <span className="operonai-tab-icon"><List size={15} /></span>
                  List
                </button>
                <button
                  className={`operonai-tab ${activeTab === 'board' ? 'active' : ''}`}
                  onClick={() => setActiveTab('board')}
                >
                  <span className="operonai-tab-icon"><Kanban size={15} /></span>
                  Board
                </button>
                <button
                  className={`operonai-tab ${activeTab === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActiveNav('workflow')}
                >
                  <span className="operonai-tab-icon"><GitBranch size={15} /></span>
                  Workflow
                </button>
              </div>
            </div>

            <div className="operonai-header-right">
              <button className="operonai-btn operonai-btn-primary" onClick={() => setShowCatalog(true)}>
                <span className="operonai-btn-icon"><Plus size={16} /></span>
                Deploy Agent
              </button>
              <button 
                className="operonai-btn operonai-btn-secondary"
                onClick={() => setActiveNav('workflow')}
              >
                <span className="operonai-btn-icon"><Zap size={15} /></span>
                Build Workflow
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="operonai-search-row">
            <div className="operonai-search-input">
              <span className="operonai-search-input-icon"><Search size={17} /></span>
              <input type="text" placeholder="Search agents..." />
            </div>

            <div className="operonai-filters">
              <button className="operonai-filter-item">
                <span className="operonai-filter-icon"><SlidersHorizontal size={14} /></span>
                Sort by
              </button>
              <button className="operonai-filter-item">
                <span className="operonai-filter-icon"><Eye size={14} /></span>
                Filters
              </button>
              <button className="operonai-filter-item">
                <span className="operonai-filter-icon"><User size={14} /></span>
                Me
              </button>
            </div>
          </div>

          {/* Kanban Board */}
          {agents.length === 0 ? (
            <div className="operonai-empty-state">
              <div className="operonai-empty-icon">
                <Bot size={28} />
              </div>
              <h2 className="operonai-empty-title">Your AI workforce starts here</h2>
              <p className="operonai-empty-description">
                Deploy your first agent from the catalog and watch it appear on your board. Build, train, and scale your AI team.
              </p>
              <button className="operonai-empty-cta" onClick={() => setShowCatalog(true)}>
                <Plus size={16} />
                <span>Deploy Your First Agent</span>
              </button>
              <div className="operonai-empty-hints">
                <div className="operonai-empty-hint">
                  <div className="operonai-empty-hint-icon"><Bot size={16} /></div>
                  <div>
                    <div className="operonai-empty-hint-title">Choose from 20+ agents</div>
                    <div className="operonai-empty-hint-desc">Invoice processing, support triage, content generation, and more</div>
                  </div>
                </div>
                <div className="operonai-empty-hint">
                  <div className="operonai-empty-hint-icon"><Layers size={16} /></div>
                  <div>
                    <div className="operonai-empty-hint-title">Version control built-in</div>
                    <div className="operonai-empty-hint-desc">Pick the exact version you need — stable, beta, or latest</div>
                  </div>
                </div>
                <div className="operonai-empty-hint">
                  <div className="operonai-empty-hint-icon"><Zap size={16} /></div>
                  <div>
                    <div className="operonai-empty-hint-title">Instant deployment</div>
                    <div className="operonai-empty-hint-desc">Agents go live in seconds and start processing immediately</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="operonai-kanban">
            <div className="operonai-columns">
              {/* Active */}
              <div className="operonai-column">
                <div className="operonai-cards">
                  {activeAgents.map(renderCard)}
                </div>
              </div>

              {/* Training */}
              <div className="operonai-column">
                <div className="operonai-cards">
                  {trainingAgents.map(renderCard)}
                </div>
              </div>

              {/* Review */}
              <div className="operonai-column">
                <div className="operonai-cards">
                  {reviewAgents.map(renderCard)}
                </div>
              </div>

              {/* Deployed */}
              <div className="operonai-column">
                <div className="operonai-cards">
                  {deployedAgents.map(renderCard)}
                </div>
              </div>
            </div>
          </div>
          )}
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
    </div>
  );
}
