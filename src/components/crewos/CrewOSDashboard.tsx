import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Layers,
  AlertTriangle,
  Settings,
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
  Rocket,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Package,
  Tag,
  TrendingUp,
  LogOut,
} from 'lucide-react';
import './CrewOSDashboard.css';
import { DocumentIntelligence } from './DocumentIntelligence';
import { CommunicationsAgent } from './CommunicationsAgent';
import { SalesIntelligence } from './SalesIntelligence';
import { WorkflowBuilder } from '../workflow';
import { useAuth } from '../../contexts/AuthContext';

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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Real Estate', className: 'crewos-tag-workflow' },
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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Legal', className: 'crewos-tag-nlp' },
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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Finance', className: 'crewos-tag-extraction' },
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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Compliance', className: 'crewos-tag-classification' },
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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'Compliance', className: 'crewos-tag-workflow' },
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
      { label: 'Doc Gen', className: 'crewos-tag-generation' },
      { label: 'HR', className: 'crewos-tag-research' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '30 Jan 2026', changes: 'State-specific non-compete rules, equity vesting schedules, benefits package builder, at-will provisions', availability: 'stable', accuracy: '98.5%', latency: '1.6min' },
      { id: 'v1', version: 'v1.0', releaseDate: '18 Dec 2025', changes: 'Initial employment agreement generation with core terms', availability: 'stable', accuracy: '94.8%', latency: '2.0min' },
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
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Generation', className: 'crewos-tag-generation' },
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
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Workflow', className: 'crewos-tag-workflow' },
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
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Classification', className: 'crewos-tag-classification' },
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
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Generation', className: 'crewos-tag-generation' },
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
      { label: 'Scoring', className: 'crewos-tag-classification' },
      { label: 'Sales', className: 'crewos-tag-extraction' },
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
      { label: 'Forecasting', className: 'crewos-tag-analysis' },
      { label: 'Sales', className: 'crewos-tag-extraction' },
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
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Sales', className: 'crewos-tag-extraction' },
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
      { label: 'Research', className: 'crewos-tag-research' },
      { label: 'Classification', className: 'crewos-tag-classification' },
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
      { label: 'Recommendation', className: 'crewos-tag-workflow' },
      { label: 'Sales', className: 'crewos-tag-extraction' },
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
  '/comms': 'comms',
  '/docai': 'docai',
  '/sales': 'sales',
  '/workflow': 'workflow',
  '/overview': 'overview',
  '/activity': 'activity',
  '/escalations': 'escalations',
  '/settings': 'settings',
};

const navToPath: Record<string, string> = {
  agents: '/',
  comms: '/comms',
  docai: '/docai',
  sales: '/sales',
  workflow: '/workflow',
  overview: '/overview',
  activity: '/activity',
  escalations: '/escalations',
  settings: '/settings',
};

export function CrewOSDashboard() {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
    } else if (catAgent?.category === 'Document Generation') {
      setActiveNav('docai');
    } else if (catAgent?.category === 'Sales Intelligence') {
      setActiveNav('sales');
    } else {
      setSelectedAgent(agent);
    }
  }, [setActiveNav]);

  /* Card renderer */
  const renderCard = (agent: DeployedAgent) => {
    const st = statusConfig[agent.status];
    return (
    <div className="crewos-card" key={agent.id} onClick={() => handleCardClick(agent)} style={{ cursor: 'pointer' }}>
        {/* Status + Version bar */}
        <div className="crewos-card-status-bar">
          <div className="crewos-card-status-pill" style={{ background: st.bg, color: st.color }}>
            {agent.status === 'running' && <CheckCircle2 size={12} />}
            {agent.status === 'idle' && <Circle size={12} />}
            {agent.status === 'error' && <AlertCircle size={12} />}
            {agent.status === 'provisioning' && <Loader2 size={12} className="crewos-spin" />}
            {st.label}
          </div>
          <span className="crewos-card-version">{agent.version}</span>
          {agent.hasGear && (
            <button className="crewos-card-gear-sm">
              <Settings2 size={13} />
          </button>
          )}
        </div>

        {/* Tags */}
        <div className="crewos-card-tags">
          {agent.tags.map((tag) => (
            <span key={tag.label} className={`crewos-card-tag ${tag.className}`}>
              {tag.label}
            </span>
          ))}
        </div>

      <div className="crewos-card-title">{agent.title}</div>
      <div className="crewos-card-description">{agent.description}</div>

        {/* Metrics row (for agents with data) */}
        {(agent.accuracy || agent.latency || agent.uptime) && (
          <div className="crewos-card-metrics-row">
            {agent.accuracy && agent.accuracy !== '—' && (
              <div className="crewos-card-metric">
                <span className="crewos-card-metric-val">{agent.accuracy}</span>
                <span className="crewos-card-metric-label">Accuracy</span>
              </div>
            )}
            {agent.latency && (
              <div className="crewos-card-metric">
                <span className="crewos-card-metric-val">{agent.latency}</span>
                <span className="crewos-card-metric-label">Latency</span>
              </div>
            )}
            {agent.uptime && (
              <div className="crewos-card-metric">
                <span className="crewos-card-metric-val">{agent.uptime}</span>
                <span className="crewos-card-metric-label">Uptime</span>
              </div>
            )}
          </div>
        )}

      {/* Image preview */}
      {agent.image === 'metrics' && (
        <div className="crewos-card-image crewos-card-image-dark">
          <div className="crewos-card-image-metric">
            <div className="crewos-card-image-metric-value">0.0093</div>
            <div className="crewos-card-image-metric-label">Loss</div>
          </div>
          <div className="crewos-card-image-metric">
            <div className="crewos-card-image-metric-value">94.8%</div>
            <div className="crewos-card-image-metric-label">Accuracy</div>
          </div>
          <div className="crewos-card-image-metric">
            <div className="crewos-card-image-metric-value">12ms</div>
            <div className="crewos-card-image-metric-label">Latency</div>
          </div>
        </div>
      )}

      {agent.image === 'chart' && (
        <div className="crewos-card-image crewos-card-image-chart">
          <div className="crewos-chart-bars">
            <div className="crewos-chart-bar" style={{ height: '45%', background: '#e07a3a' }} />
            <div className="crewos-chart-bar" style={{ height: '65%', background: '#e07a3a' }} />
            <div className="crewos-chart-bar" style={{ height: '80%', background: '#e07a3a' }} />
            <div className="crewos-chart-bar" style={{ height: '55%', background: '#d46b2c' }} />
            <div className="crewos-chart-bar" style={{ height: '90%', background: '#d46b2c' }} />
            <div className="crewos-chart-bar" style={{ height: '70%', background: '#1a1a2e' }} />
            <div className="crewos-chart-bar" style={{ height: '95%', background: '#1a1a2e' }} />
          </div>
          <div className="crewos-chart-label">Training progress — Epoch 8/12</div>
        </div>
      )}

      {/* Date */}
      <div className="crewos-card-date">
          <span className="crewos-card-date-icon"><Calendar size={13} /></span>
        <span>{agent.date}</span>
      </div>

      {/* Footer */}
      <div className="crewos-card-footer">
        <div className="crewos-card-avatars">
          {agent.avatars.map((av) => (
              <div key={av.initial} className="crewos-card-avatar" style={{ background: av.color }}>
              {av.initial}
            </div>
          ))}
          {agent.extraAvatars && (
              <div className="crewos-card-avatar crewos-card-avatar-extra">+{agent.extraAvatars}</div>
          )}
        </div>
        <div className="crewos-card-stats">
          {agent.comments !== undefined && (
            <span className="crewos-card-stat">
                <span className="crewos-card-stat-icon"><MessageSquare size={14} /></span>
              {agent.comments}
            </span>
          )}
          {agent.attachments !== undefined && (
            <span className="crewos-card-stat">
                <span className="crewos-card-stat-icon"><Paperclip size={14} /></span>
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
    <div className="crewos-app">
        {/* ──────── SIDEBAR (floating panel) ──────── */}
        <aside className="crewos-sidebar">
          {/* Logo */}
          <div className="crewos-logo">
            <div className="crewos-logo-icon">
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
            <span className="crewos-logo-text">CrewOS</span>
          </div>

          {/* Menu */}
          <div className="crewos-sidebar-section">
            <div className="crewos-sidebar-label">Menu</div>

            <button
              className={`crewos-nav-item ${activeNav === 'agents' ? 'active' : ''}`}
              onClick={() => setActiveNav('agents')}
            >
              <span className="crewos-nav-item-icon"><Bot size={18} /></span>
              <span className="crewos-nav-item-text">Agents</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveNav('overview')}
            >
              <span className="crewos-nav-item-icon"><LayoutDashboard size={18} /></span>
              <span className="crewos-nav-item-text">Overview</span>
              <span className="crewos-badge">12</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveNav('activity')}
            >
              <span className="crewos-nav-item-icon"><Activity size={18} /></span>
              <span className="crewos-nav-item-text">Activity</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'comms' ? 'active' : ''}`}
              onClick={() => setActiveNav('comms')}
            >
              <span className="crewos-nav-item-icon"><Mail size={18} /></span>
              <span className="crewos-nav-item-text">Communications</span>
              <span className="crewos-badge">8</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'docai' ? 'active' : ''}`}
              onClick={() => setActiveNav('docai')}
            >
              <span className="crewos-nav-item-icon"><FileText size={18} /></span>
              <span className="crewos-nav-item-text">Document AI</span>
              <span className="crewos-badge">6</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveNav('sales')}
            >
              <span className="crewos-nav-item-icon"><TrendingUp size={18} /></span>
              <span className="crewos-nav-item-text">Sales Intelligence</span>
              <span className="crewos-badge">5</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'workflow' ? 'active' : ''}`}
              onClick={() => setActiveNav('workflow')}
            >
              <span className="crewos-nav-item-icon"><GitBranch size={18} /></span>
              <span className="crewos-nav-item-text">Automation Builder</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'escalations' ? 'active' : ''}`}
              onClick={() => setActiveNav('escalations')}
            >
              <span className="crewos-nav-item-icon"><AlertTriangle size={18} /></span>
              <span className="crewos-nav-item-text">Escalations</span>
              <span className="crewos-badge">3</span>
            </button>

            <button
              className={`crewos-nav-item ${activeNav === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveNav('settings')}
            >
              <span className="crewos-nav-item-icon"><Settings size={18} /></span>
              <span className="crewos-nav-item-text">Settings</span>
            </button>

            <button
              className="crewos-nav-item crewos-nav-logout"
              onClick={signOut}
            >
              <span className="crewos-nav-item-icon"><LogOut size={18} /></span>
              <span className="crewos-nav-item-text">Log Out</span>
            </button>
          </div>

          {/* Pipelines */}
          <div className="crewos-sidebar-section">
            <div className="crewos-sidebar-label">
              <span>Pipelines</span>
              <button className="crewos-sidebar-label-action"><Plus size={14} /></button>
            </div>

            <button className="crewos-project-item">
              <div className="crewos-project-icon" style={{ background: 'rgba(224,122,58,0.15)', color: '#e07a3a' }}>
                <FileText size={13} />
              </div>
              <span className="crewos-nav-item-text">Invoice Processing</span>
              <span className="crewos-badge">4</span>
            </button>

            <button className="crewos-project-item">
              <div className="crewos-project-icon" style={{ background: 'rgba(224,122,58,0.12)', color: '#e07a3a' }}>
                <Headphones size={13} />
              </div>
              <span className="crewos-nav-item-text">Support Triage</span>
            </button>

            <button className="crewos-project-item">
              <div className="crewos-project-icon" style={{ background: 'rgba(212,107,44,0.12)', color: '#d46b2c' }}>
                <PenTool size={13} />
              </div>
              <span className="crewos-nav-item-text">Content Generation</span>
            </button>

            <button className="crewos-project-item">
              <div className="crewos-project-icon" style={{ background: 'rgba(26,26,46,0.1)', color: '#1a1a2e' }}>
                <Database size={13} />
              </div>
              <span className="crewos-nav-item-text">Data Extraction</span>
            </button>
          </div>

          {/* Members */}
          <div className="crewos-sidebar-section">
            <div className="crewos-sidebar-label">
              <span>Members</span>
              <button className="crewos-sidebar-label-action"><Plus size={14} /></button>
            </div>

            {members.map((m) => (
              <button className="crewos-member-item" key={m.name}>
                <div className="crewos-member-avatar" style={{ background: m.color }}>{m.initial}</div>
                <div className="crewos-member-info">
                  <span className="crewos-member-name">{m.name}</span>
                  {m.time && <span className="crewos-member-time">{m.time}</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="crewos-sidebar-spacer" />
        </aside>

        {/* ──────── MAIN CONTENT (floating panel) ──────── */}
        <div className="crewos-container">

        {/* Dashboard Home View */}
        {isHome && (
          <DashboardHome
            agents={agents.map(a => ({
              id: a.id,
              name: a.title,
              description: a.description,
              status: a.status,
              category: agentCatalog.find(c => c.id === a.catalogId)?.category || 'AI Agent',
              accuracy: a.accuracy,
              latency: a.latency,
              icon: (() => {
                const cat = agentCatalog.find(c => c.id === a.catalogId);
                if (cat?.category === 'Communications') return 'mail' as const;
                if (cat?.category === 'Document Generation') return 'file' as const;
                if (cat?.category === 'Sales Intelligence') return 'chart' as const;
                return 'bot' as const;
              })(),
              createdAt: a.date,
            }))}
            onCreateAgent={() => setShowCatalog(true)}
            onPromptSubmit={(prompt) => {
              console.log('Creating agent from prompt:', prompt);
              // Navigate to workflow builder with the prompt
              setActiveNav('workflow');
            }}
            onNavigateToWorkflow={() => setActiveNav('workflow')}
            onNavigateToAgents={() => setActiveNav('agents')}
            onAgentClick={(agent) => {
              const fullAgent = agents.find(a => a.id === agent.id);
              if (fullAgent) {
                handleCardClick(fullAgent);
              }
            }}
          />
        )}

        {/* Communications Agent View */}
        {isComms && <CommunicationsAgent />}

        {/* Document Intelligence View */}
        {isDocAI && <DocumentIntelligence />}

        {/* Sales Intelligence View */}
        {isSales && <SalesIntelligence />}

        {/* Workflow Builder View */}
        {isWorkflow && (
          <WorkflowBuilder
            onSave={(workflow) => {
              console.log('Workflow saved:', workflow);
              // You can save to your backend here
            }}
            onClose={() => {
              setActiveNav('home');
            }}
          />
        )}

        {/* Agent Workforce View */}
        {!isHome && !isDocAI && !isComms && !isSales && !isWorkflow && (
        <div className="crewos-main">
          {/* Header */}
          <div className="crewos-header">
            <div className="crewos-header-left">
              <h1 className="crewos-header-title">Agent Workforce</h1>

              <div className="crewos-tabs">
                <button
                  className={`crewos-tab ${activeTab === 'list' ? 'active' : ''}`}
                  onClick={() => setActiveTab('list')}
                >
                  <span className="crewos-tab-icon"><List size={15} /></span>
                  List
                </button>
                <button
                  className={`crewos-tab ${activeTab === 'board' ? 'active' : ''}`}
                  onClick={() => setActiveTab('board')}
                >
                  <span className="crewos-tab-icon"><Kanban size={15} /></span>
                  Board
                </button>
                <button
                  className={`crewos-tab ${activeTab === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActiveNav('workflow')}
                >
                  <span className="crewos-tab-icon"><GitBranch size={15} /></span>
                  Workflow
                </button>
              </div>
            </div>

            <div className="crewos-header-right">
              <button className="crewos-btn crewos-btn-primary" onClick={() => setShowCatalog(true)}>
                <span className="crewos-btn-icon"><Plus size={16} /></span>
                Agent
              </button>
              <button 
                className="crewos-btn crewos-btn-secondary"
                onClick={() => setActiveNav('workflow')}
              >
                <span className="crewos-btn-icon"><Zap size={15} /></span>
                Automate
              </button>
              <button className="crewos-btn crewos-btn-secondary">
                <span className="crewos-btn-icon"><Share2 size={15} /></span>
                Share
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="crewos-search-row">
            <div className="crewos-search-input">
              <span className="crewos-search-input-icon"><Search size={17} /></span>
              <input type="text" placeholder="Search agents..." />
            </div>

            <div className="crewos-filters">
              <button className="crewos-filter-item">
                <span className="crewos-filter-icon"><SlidersHorizontal size={14} /></span>
                Sort by
              </button>
              <button className="crewos-filter-item">
                <span className="crewos-filter-icon"><Eye size={14} /></span>
                Filters
              </button>
              <button className="crewos-filter-item">
                <span className="crewos-filter-icon"><User size={14} /></span>
                Me
              </button>
              <button className="crewos-filter-item">
                <span className="crewos-filter-icon"><BarChart3 size={14} /></span>
                Show
              </button>
            </div>
          </div>

          {/* Kanban Board */}
          {agents.length === 0 ? (
            <div className="crewos-empty-state">
              <div className="crewos-empty-glow" />
              <div className="crewos-empty-icon">
                <Sparkles size={32} />
              </div>
              <h2 className="crewos-empty-title">Your AI workforce starts here</h2>
              <p className="crewos-empty-description">
                Deploy your first agent from the catalog and watch it appear on your board. Build, train, and scale your AI team.
              </p>
              <button className="crewos-empty-cta" onClick={() => setShowCatalog(true)}>
                <Rocket size={18} />
                <span>Deploy Your First Agent</span>
                <ArrowRight size={16} />
              </button>
              <div className="crewos-empty-hints">
                <div className="crewos-empty-hint">
                  <div className="crewos-empty-hint-icon"><Bot size={16} /></div>
                  <div>
                    <div className="crewos-empty-hint-title">Choose from 20+ agents</div>
                    <div className="crewos-empty-hint-desc">Invoice processing, support triage, content generation, and more</div>
                  </div>
                </div>
                <div className="crewos-empty-hint">
                  <div className="crewos-empty-hint-icon"><Layers size={16} /></div>
                  <div>
                    <div className="crewos-empty-hint-title">Version control built-in</div>
                    <div className="crewos-empty-hint-desc">Pick the exact version you need — stable, beta, or latest</div>
                  </div>
                </div>
                <div className="crewos-empty-hint">
                  <div className="crewos-empty-hint-icon"><Zap size={16} /></div>
                  <div>
                    <div className="crewos-empty-hint-title">Instant deployment</div>
                    <div className="crewos-empty-hint-desc">Agents go live in seconds and start processing immediately</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="crewos-kanban">
            <div className="crewos-columns">
              {/* Active */}
              <div className="crewos-column">
                <div className="crewos-cards">
                  {activeAgents.map(renderCard)}
                </div>
              </div>

              {/* Training */}
              <div className="crewos-column">
                <div className="crewos-cards">
                  {trainingAgents.map(renderCard)}
                </div>
              </div>

              {/* Review */}
              <div className="crewos-column">
                <div className="crewos-cards">
                  {reviewAgents.map(renderCard)}
                </div>
              </div>

              {/* Deployed */}
              <div className="crewos-column">
                <div className="crewos-cards">
                  {deployedAgents.map(renderCard)}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
        )}
        </div>

        {/* ──────── DEPLOY AGENT CATALOG MODAL ──────── */}
        {showCatalog && (
          <div className="crewos-modal-overlay" onClick={() => { setShowCatalog(false); setExpandedCatalog(null); }}>
            <div className="crewos-modal-catalog" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="crewos-modal-header">
                <div className="crewos-modal-header-left">
                  <div className="crewos-modal-icon">
                    <Rocket size={20} />
                  </div>
                  <div>
                    <h2 className="crewos-modal-title">Deploy an Agent</h2>
                    <p className="crewos-modal-subtitle">Select an AI model and version to deploy to your workforce</p>
                  </div>
                </div>
                <button className="crewos-modal-close" onClick={() => { setShowCatalog(false); setExpandedCatalog(null); }}>
                  <X size={20} />
                </button>
              </div>

              {/* Agent List */}
              <div className="crewos-catalog-list">
                {agentCatalog.map((agent) => {
                  const isExpanded = expandedCatalog === agent.id;
                  return (
                    <div key={agent.id} className={`crewos-catalog-item ${isExpanded ? 'expanded' : ''}`}>
                      {/* Agent Row */}
                      <button
                        className="crewos-catalog-row"
                        onClick={() => setExpandedCatalog(isExpanded ? null : agent.id)}
                      >
                        <div className="crewos-catalog-agent-icon">
                          {getCatalogIcon(agent.icon)}
                        </div>
                        <div className="crewos-catalog-agent-info">
                          <div className="crewos-catalog-agent-name">{agent.name}</div>
                          <div className="crewos-catalog-agent-desc">{agent.description}</div>
                          <div className="crewos-catalog-agent-tags">
                            {agent.tags.map(t => (
                              <span key={t.label} className={`crewos-card-tag ${t.className}`}>{t.label}</span>
                            ))}
                            <span className="crewos-catalog-version-count">
                              <Package size={11} />
                              {agent.versions.length} version{agent.versions.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} className={`crewos-catalog-chevron ${isExpanded ? 'rotated' : ''}`} />
                      </button>

                      {/* Expanded Versions */}
                      {isExpanded && (
                        <div className="crewos-catalog-versions">
                          {agent.versions.map((ver) => {
                            const alreadyDeployed = isVersionDeployed(agent.id, ver.id);
                            const isDeploying = deployingVersion === `${agent.id}-${ver.id}`;
                            return (
                              <div key={ver.id} className="crewos-catalog-version-row">
                                <div className="crewos-catalog-version-left">
                                  <div className="crewos-catalog-version-header">
                                    <span className="crewos-catalog-version-tag">{ver.version}</span>
                                    <span className={`crewos-catalog-avail crewos-avail-${ver.availability}`}>
                                      {ver.availability}
                                    </span>
                                    <span className="crewos-catalog-version-date">
                                      <Clock size={11} /> {ver.releaseDate}
                                    </span>
                                  </div>
                                  <div className="crewos-catalog-version-changes">{ver.changes}</div>
                                  {(ver.accuracy || ver.latency) && (
                                    <div className="crewos-catalog-version-metrics">
                                      {ver.accuracy && <span>Accuracy: <strong>{ver.accuracy}</strong></span>}
                                      {ver.latency && <span>Latency: <strong>{ver.latency}</strong></span>}
                                    </div>
                                  )}
                                </div>
                                <div className="crewos-catalog-version-action">
                                  {alreadyDeployed ? (
                                    <span className="crewos-catalog-deployed-badge">
                                      <CheckCircle2 size={14} /> Deployed
                                    </span>
                                  ) : ver.availability === 'deprecated' ? (
                                    <span className="crewos-catalog-deprecated-badge">Deprecated</span>
                                  ) : isDeploying ? (
                                    <button className="crewos-catalog-deploy-btn deploying" disabled>
                                      <Loader2 size={14} className="crewos-spin" />
                                      Deploying…
                                    </button>
                                  ) : (
                                    <button
                                      className="crewos-catalog-deploy-btn"
                                      onClick={() => deployAgent(agent, ver)}
                                    >
                                      <Rocket size={14} />
                                      Deploy
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <div className="crewos-modal-overlay" onClick={() => setSelectedAgent(null)}>
              <div className="crewos-agent-detail-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="crewos-detail-header">
                  <div className="crewos-detail-header-left">
                    <h2 className="crewos-detail-title">{selectedAgent.title}</h2>
                    <div className="crewos-detail-meta">
                      <div className="crewos-card-status-pill" style={{ background: st.bg, color: st.color }}>
                        {selectedAgent.status === 'running' && <CheckCircle2 size={12} />}
                        {selectedAgent.status === 'idle' && <Circle size={12} />}
                        {selectedAgent.status === 'error' && <AlertCircle size={12} />}
                        {selectedAgent.status === 'provisioning' && <Loader2 size={12} className="crewos-spin" />}
                        {st.label}
                      </div>
                      <span className="crewos-detail-version">{selectedAgent.version}</span>
                      <span className="crewos-detail-date"><Calendar size={13} /> Deployed {selectedAgent.date}</span>
                    </div>
                  </div>
                  <button className="crewos-modal-close" onClick={() => setSelectedAgent(null)}>
                    <X size={20} />
                  </button>
                </div>

                {/* Tags */}
                <div className="crewos-detail-tags">
                  {selectedAgent.tags.map(tag => (
                    <span key={tag.label} className={`crewos-card-tag ${tag.className}`}>{tag.label}</span>
                  ))}
                  {catAgent && <span className="crewos-detail-category">{catAgent.category}</span>}
                </div>

                {/* Description */}
                <div className="crewos-detail-section">
                  <h3 className="crewos-detail-section-title">Description</h3>
                  <p className="crewos-detail-description">{selectedAgent.description}</p>
                </div>

                {/* Metrics */}
                {(selectedAgent.accuracy || selectedAgent.latency || selectedAgent.uptime) && (
                  <div className="crewos-detail-section">
                    <h3 className="crewos-detail-section-title">Performance</h3>
                    <div className="crewos-detail-metrics">
                      {selectedAgent.accuracy && selectedAgent.accuracy !== '—' && (
                        <div className="crewos-detail-metric-card">
                          <span className="crewos-detail-metric-val">{selectedAgent.accuracy}</span>
                          <span className="crewos-detail-metric-label">Accuracy</span>
                        </div>
                      )}
                      {selectedAgent.latency && (
                        <div className="crewos-detail-metric-card">
                          <span className="crewos-detail-metric-val">{selectedAgent.latency}</span>
                          <span className="crewos-detail-metric-label">Latency</span>
                        </div>
                      )}
                      {selectedAgent.uptime && (
                        <div className="crewos-detail-metric-card">
                          <span className="crewos-detail-metric-val">{selectedAgent.uptime}</span>
                          <span className="crewos-detail-metric-label">Uptime</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Version Info */}
                {selVersion && (
                  <div className="crewos-detail-section">
                    <h3 className="crewos-detail-section-title">Version Details</h3>
                    <div className="crewos-detail-version-card">
                      <div className="crewos-detail-version-row">
                        <span className="crewos-detail-version-label">Version</span>
                        <span className="crewos-detail-version-value">{selVersion.version}</span>
                      </div>
                      <div className="crewos-detail-version-row">
                        <span className="crewos-detail-version-label">Release Date</span>
                        <span className="crewos-detail-version-value">{selVersion.releaseDate}</span>
                      </div>
                      <div className="crewos-detail-version-row">
                        <span className="crewos-detail-version-label">Availability</span>
                        <span className={`crewos-avail-badge crewos-avail-${selVersion.availability}`}>{selVersion.availability}</span>
                      </div>
                      <div className="crewos-detail-version-row">
                        <span className="crewos-detail-version-label">Changes</span>
                        <span className="crewos-detail-version-value">{selVersion.changes}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team */}
                <div className="crewos-detail-section">
                  <h3 className="crewos-detail-section-title">Team</h3>
                  <div className="crewos-detail-team">
                    {selectedAgent.avatars.map(av => (
                      <div key={av.initial} className="crewos-detail-team-member">
                        <div className="crewos-card-avatar" style={{ background: av.color }}>{av.initial}</div>
                      </div>
                    ))}
                    {selectedAgent.extraAvatars && (
                      <div className="crewos-detail-team-member">
                        <div className="crewos-card-avatar crewos-card-avatar-extra">+{selectedAgent.extraAvatars}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
