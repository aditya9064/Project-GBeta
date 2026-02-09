import { useState, useCallback, useEffect } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import './CrewOSDashboard.css';
import { DocumentIntelligence } from './DocumentIntelligence';
import { CommunicationsAgent } from './CommunicationsAgent';
import { SettingsPage } from './SettingsPage';

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
  {
    id: 'cat-invoice',
    name: 'Invoice Processing Agent',
    description: 'Extracts line items, amounts, and vendor data from uploaded invoices using custom LayoutLMv3 model.',
    category: 'Document AI',
    icon: 'vision',
    tags: [
      { label: 'Vision', className: 'crewos-tag-vision' },
      { label: 'Extraction', className: 'crewos-tag-extraction' },
    ],
    versions: [
      { id: 'v3', version: 'v3.0', releaseDate: '3 Feb 2026', changes: 'LayoutLMv3 backbone, 12K labeled samples, multi-currency support', availability: 'stable', accuracy: '98.7%', latency: '45ms' },
      { id: 'v2', version: 'v2.1', releaseDate: '12 Jan 2026', changes: 'Improved table extraction, better handling of multi-page invoices', availability: 'stable', accuracy: '96.2%', latency: '62ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '1 Dec 2025', changes: 'Initial release with basic line item extraction', availability: 'deprecated', accuracy: '91.0%', latency: '120ms' },
    ],
  },
  {
    id: 'cat-triage',
    name: 'Support Triage Agent',
    description: 'Classifies incoming support tickets by category, severity, and intent. Routes to appropriate team members.',
    category: 'NLP',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Classification', className: 'crewos-tag-classification' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '1 Feb 2026', changes: 'Multi-label classification, intent chaining, auto-escalation rules', availability: 'stable', accuracy: '95.1%', latency: '18ms' },
      { id: 'v1', version: 'v1.2', releaseDate: '10 Jan 2026', changes: 'Added severity scoring and SLA prediction', availability: 'stable', accuracy: '92.4%', latency: '25ms' },
    ],
  },
  {
    id: 'cat-content',
    name: 'Content Writer Agent',
    description: 'Generates blog posts, social media copy, and marketing content fine-tuned on brand voice and style guidelines.',
    category: 'Generation',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Generation', className: 'crewos-tag-generation' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '5 Feb 2026', changes: 'GPT-4 backbone, brand voice fine-tuning, multi-format output', availability: 'beta', accuracy: '—', latency: '1.2s' },
      { id: 'v1', version: 'v1.0', releaseDate: '15 Dec 2025', changes: 'Initial release with blog and social media generation', availability: 'stable', accuracy: '—', latency: '2.1s' },
    ],
  },
  {
    id: 'cat-code',
    name: 'Code Review Agent',
    description: 'Analyzes pull requests for bugs, security vulnerabilities, and style violations. Trained on your codebase.',
    category: 'Development',
    icon: 'code',
    tags: [
      { label: 'Dev', className: 'crewos-tag-dev' },
      { label: 'Analysis', className: 'crewos-tag-analysis' },
    ],
    versions: [
      { id: 'v3', version: 'v3.0', releaseDate: '3 Feb 2026', changes: 'Security vuln detection, codebase-aware context, auto-fix suggestions', availability: 'beta', accuracy: '89.3%', latency: '3.4s' },
      { id: 'v2', version: 'v2.0', releaseDate: '20 Jan 2026', changes: 'Multi-language support, custom rule engine, PR summary generation', availability: 'stable', accuracy: '86.1%', latency: '4.2s' },
      { id: 'v1', version: 'v1.0', releaseDate: '5 Dec 2025', changes: 'Basic bug detection and style checking', availability: 'deprecated', accuracy: '78.5%', latency: '6.8s' },
    ],
  },
  {
    id: 'cat-compliance',
    name: 'Compliance Monitor Agent',
    description: 'Monitors transactions for regulatory compliance and AML patterns. Flags suspicious activity for human review.',
    category: 'Compliance',
    icon: 'workflow',
    tags: [
      { label: 'Classification', className: 'crewos-tag-classification' },
      { label: 'NLP', className: 'crewos-tag-nlp' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '28 Jan 2026', changes: 'Real-time streaming, expanded AML patterns, regulatory update sync', availability: 'stable', accuracy: '97.6%', latency: '8ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '12 Dec 2025', changes: 'Basic transaction monitoring and flag generation', availability: 'stable', accuracy: '94.2%', latency: '15ms' },
    ],
  },
  {
    id: 'cat-contract',
    name: 'Contract Review Agent',
    description: 'Analyzes legal contracts, identifies key clauses, flags risks, and extracts critical terms and obligations.',
    category: 'Document AI',
    icon: 'nlp',
    tags: [
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Workflow', className: 'crewos-tag-workflow' },
    ],
    versions: [
      { id: 'v1', version: 'v1.2', releaseDate: '6 Feb 2026', changes: 'Clause comparison, risk scoring, obligation timeline extraction', availability: 'stable', accuracy: '93.8%', latency: '890ms' },
      { id: 'v0', version: 'v1.0', releaseDate: '18 Jan 2026', changes: 'Initial release with clause identification and risk flagging', availability: 'stable', accuracy: '90.1%', latency: '1.1s' },
    ],
  },
  {
    id: 'cat-receipt',
    name: 'Receipt Scanner Agent',
    description: 'Processes expense receipts from photos, extracts merchant, amount, date, and category with high accuracy.',
    category: 'Document AI',
    icon: 'vision',
    tags: [
      { label: 'Extraction', className: 'crewos-tag-extraction' },
      { label: 'Vision', className: 'crewos-tag-vision' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '2 Feb 2026', changes: 'Multi-receipt batch processing, 98.5% accuracy, auto-categorization', availability: 'stable', accuracy: '98.5%', latency: '32ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '10 Dec 2025', changes: 'Single receipt OCR and field extraction', availability: 'deprecated', accuracy: '94.0%', latency: '85ms' },
    ],
  },
  {
    id: 'cat-research',
    name: 'Research Analyst Agent',
    description: 'Compiles market research reports from multiple data sources with automated analysis, synthesis, and citations.',
    category: 'Research',
    icon: 'research',
    tags: [
      { label: 'Research', className: 'crewos-tag-research' },
      { label: 'NLP', className: 'crewos-tag-nlp' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '24 Jan 2026', changes: 'Multi-source aggregation, citation verification, executive summary gen', availability: 'stable', accuracy: '—', latency: '12s' },
      { id: 'v1', version: 'v1.0', releaseDate: '1 Dec 2025', changes: 'Basic web research and report compilation', availability: 'stable', accuracy: '—', latency: '25s' },
    ],
  },
  {
    id: 'cat-onboarding',
    name: 'Customer Onboarding Agent',
    description: 'Guides new customers through product setup, answers FAQs, and collects required documentation step by step.',
    category: 'Workflow',
    icon: 'workflow',
    tags: [
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Workflow', className: 'crewos-tag-workflow' },
    ],
    versions: [
      { id: 'v1', version: 'v1.1', releaseDate: '23 Jan 2026', changes: 'Adaptive flow engine, multi-language support, document collection', availability: 'stable', accuracy: '—', latency: '200ms' },
      { id: 'v0', version: 'v1.0', releaseDate: '8 Jan 2026', changes: 'Step-by-step onboarding with FAQ integration', availability: 'stable', accuracy: '—', latency: '350ms' },
    ],
  },
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
    id: 'cat-kb',
    name: 'Knowledge Base Agent',
    description: 'Answers employee questions using custom RAG pipeline over internal docs, SOPs, and policy documents.',
    category: 'Knowledge',
    icon: 'data',
    tags: [
      { label: 'RAG', className: 'crewos-tag-rag' },
      { label: 'NLP', className: 'crewos-tag-nlp' },
    ],
    versions: [
      { id: 'v3', version: 'v3.0', releaseDate: '9 Jan 2026', changes: 'Hybrid search, multi-doc reasoning, citation linking, real-time index', availability: 'stable', accuracy: '96.1%', latency: '340ms' },
      { id: 'v2', version: 'v2.0', releaseDate: '15 Dec 2025', changes: 'Improved chunking, better relevance ranking', availability: 'stable', accuracy: '92.0%', latency: '520ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '20 Nov 2025', changes: 'Basic RAG pipeline with document QA', availability: 'deprecated', accuracy: '85.0%', latency: '800ms' },
    ],
  },
  {
    id: 'cat-sentiment',
    name: 'Sentiment Analysis Agent',
    description: 'Analyzes customer feedback, reviews, and survey responses to track sentiment trends and flag critical issues.',
    category: 'Analytics',
    icon: 'data',
    tags: [
      { label: 'NLP', className: 'crewos-tag-nlp' },
      { label: 'Classification', className: 'crewos-tag-classification' },
    ],
    versions: [
      { id: 'v2', version: 'v2.0', releaseDate: '2 Jan 2026', changes: 'Aspect-based sentiment, emotion detection, trend analysis dashboard', availability: 'stable', accuracy: '94.3%', latency: '12ms' },
      { id: 'v1', version: 'v1.0', releaseDate: '10 Nov 2025', changes: 'Basic positive/negative/neutral classification', availability: 'stable', accuracy: '88.5%', latency: '18ms' },
    ],
  },
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
];

/* ─── INITIAL DEPLOYED AGENTS (pre-seeded board) ───────────── */

const initialDeployed: DeployedAgent[] = [
  {
    id: 'a1', catalogId: 'cat-invoice', versionId: 'v3',
    tags: [{ label: 'Vision', className: 'crewos-tag-vision' }, { label: 'Extraction', className: 'crewos-tag-extraction' }],
    title: 'Invoice Processing Agent', version: 'v3.0',
    description: 'Extracts line items, amounts, and vendor data from uploaded invoices using custom LayoutLMv3 model trained on 12K labeled samples',
    date: '3 Feb', column: 'active', status: 'running',
    avatars: [{ initial: 'AM', color: '#e07a3a' }, { initial: 'SC', color: '#e07a3a' }, { initial: 'MJ', color: '#1a1a2e' }],
    extraAvatars: 3, comments: 2, attachments: 1, uptime: '99.8%', accuracy: '98.7%', latency: '45ms',
  },
  {
    id: 'a2', catalogId: 'cat-triage', versionId: 'v2',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Classification', className: 'crewos-tag-classification' }],
    title: 'Support Triage Agent', version: 'v2.0',
    description: 'Classifies incoming support tickets by category, severity, and intent. Routes to appropriate team members automatically',
    date: '1 Feb', column: 'active', status: 'running',
    avatars: [{ initial: 'SC', color: '#e07a3a' }],
    comments: 6, attachments: 2, uptime: '99.5%', accuracy: '95.1%', latency: '18ms',
  },
  {
    id: 'a3', catalogId: 'cat-content', versionId: 'v2',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Generation', className: 'crewos-tag-generation' }],
    title: 'Content Writer Agent', version: 'v2.0',
    description: 'Generates blog posts, social media copy, and marketing content fine-tuned on brand voice and style guidelines',
    date: '5 Feb', column: 'active', status: 'idle',
    avatars: [{ initial: 'PP', color: '#d46b2c' }, { initial: 'AM', color: '#e07a3a' }],
    comments: 8, attachments: 3, accuracy: '—', latency: '1.2s',
  },
  {
    id: 'a4', catalogId: 'cat-compliance', versionId: 'v2',
    tags: [{ label: 'Classification', className: 'crewos-tag-classification' }, { label: 'NLP', className: 'crewos-tag-nlp' }],
    title: 'Compliance Monitor Agent', version: 'v2.0',
    description: 'Monitors transactions for regulatory compliance and AML patterns. Flags suspicious activity for human review',
    date: '28 Jan', column: 'active', status: 'running',
    avatars: [{ initial: 'AR', color: '#3a3a52' }, { initial: 'MJ', color: '#1a1a2e' }],
    comments: 4, attachments: 2, uptime: '99.9%', accuracy: '97.6%', latency: '8ms',
  },
  {
    id: 'a5', catalogId: 'cat-contract', versionId: 'v1',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Workflow', className: 'crewos-tag-workflow' }],
    title: 'Contract Review Agent', version: 'v1.2',
    description: 'Analyzes legal contracts, identifies key clauses, flags risks, and extracts critical terms and obligations automatically',
    date: '6 Feb', column: 'active', status: 'running',
    avatars: [{ initial: 'SC', color: '#e07a3a' }, { initial: 'PP', color: '#d46b2c' }],
    comments: 3, attachments: 1, uptime: '99.2%', accuracy: '93.8%', latency: '890ms',
  },
  {
    id: 'a6', catalogId: 'cat-receipt', versionId: 'v2',
    tags: [{ label: 'Extraction', className: 'crewos-tag-extraction' }, { label: 'Vision', className: 'crewos-tag-vision' }],
    title: 'Receipt Scanner Agent', version: 'v2.0',
    description: 'Processes expense receipts from photos, extracts merchant, amount, date, and category with 98.5% accuracy',
    date: '2 Feb', column: 'active', status: 'error',
    avatars: [{ initial: 'AM', color: '#e07a3a' }],
    comments: 1, attachments: 4, accuracy: '98.5%', latency: '32ms',
  },
  // Training
  {
    id: 't1', catalogId: 'cat-code', versionId: 'v3',
    tags: [{ label: 'Dev', className: 'crewos-tag-dev' }, { label: 'Analysis', className: 'crewos-tag-analysis' }],
    title: 'Code Review Agent', version: 'v3.0',
    description: 'Analyzes pull requests for bugs, security vulnerabilities, and style violations. Trained on your codebase patterns and conventions',
    date: '3 Feb', column: 'training', status: 'provisioning',
    avatars: [{ initial: 'AR', color: '#3a3a52' }, { initial: 'MJ', color: '#1a1a2e' }],
    extraAvatars: 2, comments: 4, attachments: 1, image: 'chart', hasGear: true, accuracy: '89.3%', latency: '3.4s',
  },
  {
    id: 't2', catalogId: 'cat-invoice', versionId: 'v2',
    tags: [{ label: 'Vision', className: 'crewos-tag-vision' }, { label: 'Extraction', className: 'crewos-tag-extraction' }],
    title: 'Document Parser Agent', version: 'v2.1',
    description: 'Extracts structured data from contracts, receipts, and forms. Currently training on 12K labeled document samples',
    date: '30 Jan', column: 'training', status: 'provisioning',
    avatars: [{ initial: 'SC', color: '#e07a3a' }],
    comments: 3, attachments: 2,
  },
  // Review
  {
    id: 'r1', catalogId: 'cat-research', versionId: 'v2',
    tags: [{ label: 'Research', className: 'crewos-tag-research' }, { label: 'NLP', className: 'crewos-tag-nlp' }],
    title: 'Research Analyst Agent', version: 'v2.0',
    description: 'Compiles market research reports from multiple data sources with automated analysis, synthesis, and citations',
    date: '24 Jan', column: 'review', status: 'idle',
    avatars: [{ initial: 'PP', color: '#d46b2c' }, { initial: 'AM', color: '#e07a3a' }, { initial: 'SC', color: '#e07a3a' }],
    extraAvatars: 12, comments: 3, attachments: 1,
  },
  {
    id: 'r2', catalogId: 'cat-onboarding', versionId: 'v1',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Workflow', className: 'crewos-tag-workflow' }],
    title: 'Customer Onboarding Agent', version: 'v1.1',
    description: 'Guides new customers through product setup, answers FAQs, and collects required documentation step by step',
    date: '23 Jan', column: 'review', status: 'idle',
    avatars: [{ initial: 'MJ', color: '#1a1a2e' }, { initial: 'AR', color: '#3a3a52' }],
    image: 'metrics', comments: 5, attachments: 3,
  },
  {
    id: 'r3', catalogId: 'cat-email', versionId: 'v2',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Generation', className: 'crewos-tag-generation' }],
    title: 'Email Response Agent', version: 'v2.0',
    description: 'Drafts contextual email responses based on conversation history, customer data, and company communication policies',
    date: '20 Jan', column: 'review', status: 'idle',
    avatars: [{ initial: 'PP', color: '#d46b2c' }],
    comments: 2, attachments: 1,
  },
  // Deployed
  {
    id: 'd1', catalogId: 'cat-invoice', versionId: 'v2',
    tags: [{ label: 'Vision', className: 'crewos-tag-vision' }, { label: 'Extraction', className: 'crewos-tag-extraction' }],
    title: 'Form Digitizer Agent', version: 'v2.0',
    description: 'Converts handwritten and printed forms into structured digital data with field-level confidence scoring',
    date: '12 Jan', column: 'deployed', status: 'running',
    avatars: [{ initial: 'AM', color: '#e07a3a' }, { initial: 'MJ', color: '#1a1a2e' }],
    extraAvatars: 2, comments: 3, attachments: 1, uptime: '99.9%', accuracy: '97.2%', latency: '55ms',
  },
  {
    id: 'd2', catalogId: 'cat-kb', versionId: 'v3',
    tags: [{ label: 'RAG', className: 'crewos-tag-rag' }, { label: 'NLP', className: 'crewos-tag-nlp' }],
    title: 'Knowledge Base Agent', version: 'v3.0',
    description: 'Answers employee questions using custom RAG pipeline over internal docs, SOPs, and policy documents',
    date: '9 Jan', column: 'deployed', status: 'running',
    avatars: [{ initial: 'SC', color: '#e07a3a' }, { initial: 'PP', color: '#d46b2c' }],
    comments: 5, attachments: 3, uptime: '99.7%', accuracy: '96.1%', latency: '340ms',
  },
  {
    id: 'd3', catalogId: 'cat-research', versionId: 'v1',
    tags: [{ label: 'Research', className: 'crewos-tag-research' }, { label: 'Extraction', className: 'crewos-tag-extraction' }],
    title: 'Competitive Intel Agent', version: 'v1.0',
    description: 'Monitors competitor websites, job postings, and press releases. Generates weekly competitive landscape reports',
    date: '4 Jan', column: 'deployed', status: 'running',
    avatars: [{ initial: 'AR', color: '#3a3a52' }],
    comments: 2, attachments: 1, uptime: '98.5%',
  },
  {
    id: 'd4', catalogId: 'cat-sentiment', versionId: 'v2',
    tags: [{ label: 'NLP', className: 'crewos-tag-nlp' }, { label: 'Classification', className: 'crewos-tag-classification' }],
    title: 'Sentiment Analysis Agent', version: 'v2.0',
    description: 'Analyzes customer feedback, reviews, and survey responses to track sentiment trends and flag critical issues',
    date: '2 Jan', column: 'deployed', status: 'running',
    avatars: [{ initial: 'MJ', color: '#1a1a2e' }, { initial: 'AM', color: '#e07a3a' }],
    comments: 4, attachments: 2, uptime: '99.6%', accuracy: '94.3%', latency: '12ms',
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

type SortField = 'title' | 'date' | 'status' | 'column';
type SortDir = 'asc' | 'desc';

export function CrewOSDashboard() {
  const [activeNav, setActiveNav] = useState('agents');
  const [activeTab, setActiveTab] = useState('board');
  const [agents, setAgents] = useState<DeployedAgent[]>(initialDeployed);
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedCatalog, setExpandedCatalog] = useState<string | null>(null);
  const [deployingVersion, setDeployingVersion] = useState<string | null>(null);
  // Sort & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterColumn, setFilterColumn] = useState<BoardColumn | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DeployStatus | 'all'>('all');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  useEffect(() => {
    const close = () => { setShowSortDropdown(false); setShowFilterDropdown(false); };
    if (showSortDropdown || showFilterDropdown) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [showSortDropdown, showFilterDropdown]);

  const isDocAI = activeNav === 'docai';
  const isComms = activeNav === 'comms';
  const isSettings = activeNav === 'settings';

  // Apply search, filter, then sort to get displayed agents
  const filteredAndSortedAgents = (() => {
    let list = [...agents];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some(t => t.label.toLowerCase().includes(q))
      );
    }
    if (filterColumn !== 'all') {
      list = list.filter(a => a.column === filterColumn);
    }
    if (filterStatus !== 'all') {
      list = list.filter(a => a.status === filterStatus);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'column') cmp = a.column.localeCompare(b.column);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  })();

  // Filter agents by column (for board view)
  const activeAgents = filteredAndSortedAgents.filter(a => a.column === 'active');
  const trainingAgents = filteredAndSortedAgents.filter(a => a.column === 'training');
  const reviewAgents = filteredAndSortedAgents.filter(a => a.column === 'review');
  const deployedAgents = filteredAndSortedAgents.filter(a => a.column === 'deployed');

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

  /* Card renderer */
  const renderCard = (agent: DeployedAgent) => {
    const st = statusConfig[agent.status];
    return (
    <div className="crewos-card" key={agent.id}>
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
              className={`crewos-nav-item ${activeNav === 'agents' ? 'active' : ''}`}
              onClick={() => setActiveNav('agents')}
            >
              <span className="crewos-nav-item-icon"><Bot size={18} /></span>
              <span className="crewos-nav-item-text">Agents</span>
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

        {/* Communications Agent View */}
        {isComms && <CommunicationsAgent />}

        {/* Document Intelligence View */}
        {isDocAI && <DocumentIntelligence />}

        {/* Settings View */}
        {isSettings && <SettingsPage />}

        {/* Agent Workforce View */}
        {!isDocAI && !isComms && !isSettings && (
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
                  onClick={() => setActiveTab('workflow')}
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
              <button className="crewos-btn crewos-btn-secondary">
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
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="crewos-filters">
              <div className="crewos-filter-dropdown-wrap">
                <button
                  type="button"
                  className="crewos-filter-item"
                  onClick={(e) => { e.stopPropagation(); setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}
                  aria-expanded={showSortDropdown}
                >
                  <span className="crewos-filter-icon"><SlidersHorizontal size={14} /></span>
                  Sort by {sortBy}
                  <ChevronDown size={14} className="crewos-filter-chevron" />
                </button>
                {showSortDropdown && (
                  <div className="crewos-filter-menu" onClick={(e) => e.stopPropagation()}>
                    {(['title', 'date', 'status', 'column'] as SortField[]).map((field) => (
                      <button
                        key={field}
                        type="button"
                        className={`crewos-filter-menu-item ${sortBy === field ? 'active' : ''}`}
                        onClick={() => { setSortBy(field); setShowSortDropdown(false); }}
                      >
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </button>
                    ))}
                    <div className="crewos-filter-menu-divider" />
                    <button
                      type="button"
                      className="crewos-filter-menu-item"
                      onClick={() => { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}
                    >
                      Order: {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                    </button>
                  </div>
                )}
              </div>

              <div className="crewos-filter-dropdown-wrap">
                <button
                  type="button"
                  className="crewos-filter-item"
                  onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
                  aria-expanded={showFilterDropdown}
                >
                  <span className="crewos-filter-icon"><Eye size={14} /></span>
                  Filters
                  {(filterColumn !== 'all' || filterStatus !== 'all') && (
                    <span className="crewos-filter-badge">on</span>
                  )}
                  <ChevronDown size={14} className="crewos-filter-chevron" />
                </button>
                {showFilterDropdown && (
                  <div className="crewos-filter-menu crewos-filter-menu-wide" onClick={(e) => e.stopPropagation()}>
                    <div className="crewos-filter-menu-label">Column</div>
                    {(['all', 'active', 'training', 'review', 'deployed'] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={`crewos-filter-menu-item ${filterColumn === col ? 'active' : ''}`}
                        onClick={() => { setFilterColumn(col); }}
                      >
                        {col === 'all' ? 'All columns' : col.charAt(0).toUpperCase() + col.slice(1)}
                      </button>
                    ))}
                    <div className="crewos-filter-menu-divider" />
                    <div className="crewos-filter-menu-label">Status</div>
                    {(['all', 'running', 'idle', 'error', 'provisioning'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`crewos-filter-menu-item ${filterStatus === st ? 'active' : ''}`}
                        onClick={() => { setFilterStatus(st); }}
                      >
                        {st === 'all' ? 'All statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="crewos-filter-menu-item crewos-filter-clear"
                      onClick={() => { setFilterColumn('all'); setFilterStatus('all'); setShowFilterDropdown(false); }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

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

          {/* List View */}
          {activeTab === 'list' && (
            <div className="crewos-list-view">
              <div className="crewos-list-table">
                <div className="crewos-list-thead">
                  <div className="crewos-list-th crewos-list-th-agent">Agent</div>
                  <div className="crewos-list-th">Column</div>
                  <div className="crewos-list-th">Status</div>
                  <div className="crewos-list-th">Version</div>
                  <div className="crewos-list-th">Date</div>
                </div>
                {filteredAndSortedAgents.length === 0 ? (
                  <div className="crewos-list-empty">No agents match your search or filters.</div>
                ) : (
                  filteredAndSortedAgents.map((agent) => {
                    const st = statusConfig[agent.status];
                    return (
                      <div className="crewos-list-row" key={agent.id}>
                        <div className="crewos-list-cell crewos-list-cell-agent">
                          <div className="crewos-list-agent-info">
                            <div className="crewos-list-agent-title">{agent.title}</div>
                            <div className="crewos-list-agent-desc">{agent.description}</div>
                          </div>
                        </div>
                        <div className="crewos-list-cell">
                          <span className={`crewos-list-pill crewos-list-pill-${agent.column}`}>
                            {agent.column}
                          </span>
                        </div>
                        <div className="crewos-list-cell">
                          <span className="crewos-list-status" style={{ background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                        <div className="crewos-list-cell">{agent.version}</div>
                        <div className="crewos-list-cell">{agent.date}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Workflow placeholder */}
          {activeTab === 'workflow' && (
            <div className="crewos-list-view">
              <div className="crewos-list-empty crewos-workflow-placeholder">
                <GitBranch size={48} strokeWidth={1.5} />
                <p>Workflow view</p>
                <span>Pipeline and workflow automation view coming soon.</span>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          {activeTab === 'board' && (
          <div className="crewos-kanban">
            <div className="crewos-columns">
              {/* Active */}
              <div className="crewos-column">
                <div className="crewos-column-header">
                  <span className="crewos-column-dot crewos-dot-active" />
                  <span className="crewos-column-title">Active</span>
                  <span className="crewos-column-count">({activeAgents.length})</span>
                </div>
                <div className="crewos-cards">
                  {activeAgents.map(renderCard)}
                </div>
              </div>

              {/* Training */}
              <div className="crewos-column">
                <div className="crewos-column-header">
                  <span className="crewos-column-dot crewos-dot-training" />
                  <span className="crewos-column-title">Training</span>
                  <span className="crewos-column-count">({trainingAgents.length})</span>
                </div>
                <div className="crewos-cards">
                  {trainingAgents.map(renderCard)}
                </div>
              </div>

              {/* Review */}
              <div className="crewos-column">
                <div className="crewos-column-header">
                  <span className="crewos-column-dot crewos-dot-review" />
                  <span className="crewos-column-title">Review</span>
                  <span className="crewos-column-count">({reviewAgents.length})</span>
                </div>
                <div className="crewos-cards">
                  {reviewAgents.map(renderCard)}
                </div>
              </div>

              {/* Deployed */}
              <div className="crewos-column">
                <div className="crewos-column-header">
                  <span className="crewos-column-dot crewos-dot-deployed" />
                  <span className="crewos-column-title">Deployed</span>
                  <span className="crewos-column-count">({deployedAgents.length})</span>
                </div>
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
    </div>
  );
}
