import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Zap,
  Brain,
  Shield,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Settings2,
  ChevronRight,
  ChevronDown,
  Mail,
  Phone,
  Globe,
  Building2,
  User,
  Star,
  Flame,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  FileText,
  ExternalLink,
  Lightbulb,
  Award,
  Briefcase,
  MapPin,
  Hash,
  Percent,
  Play,
  Pause,
  MoreHorizontal,
  X,
} from 'lucide-react';
import './SalesIntelligence.css';

/* ─── TYPES ──────────────────────────────────────────────── */

interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  phone?: string;
  location: string;
  avatar: string;
  avatarColor: string;
  score: number;
  scoreChange: number;
  scoreTrend: 'up' | 'down' | 'stable';
  stage: 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  dealValue: number;
  probability: number;
  expectedClose: string;
  lastActivity: string;
  lastActivityType: 'email' | 'call' | 'meeting' | 'website';
  engagementScore: number;
  signals: Signal[];
  nextAction: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  source: string;
  industry: string;
  companySize: string;
  tags: string[];
}

interface Signal {
  id: string;
  type: 'email_open' | 'website_visit' | 'content_download' | 'pricing_page' | 'demo_request' | 'competitor_mention' | 'budget_signal' | 'champion_change' | 'meeting_scheduled';
  description: string;
  timestamp: string;
  impact: 'positive' | 'negative' | 'neutral';
  strength: number;
}

interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  conversionRate: number;
  avgDays: number;
  color: string;
}

interface Forecast {
  month: string;
  committed: number;
  bestCase: number;
  pipeline: number;
  target: number;
}

interface AIInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'action' | 'trend';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  relatedDeals: string[];
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  type: 'scoring' | 'forecast' | 'engagement' | 'competitive' | 'recommendation';
  status: 'deployed' | 'training' | 'fine-tuning';
  accuracy: number;
  latency: string;
  trainingSamples: string;
  lastTrained: string;
}

/* ─── SAMPLE DATA ────────────────────────────────────────── */

const sampleLeads: Lead[] = [
  {
    id: 'l1', name: 'Sarah Chen', company: 'TechFlow Systems', title: 'VP of Engineering',
    email: 'sarah.chen@techflow.io', phone: '+1 (415) 555-0189', location: 'San Francisco, CA',
    avatar: 'SC', avatarColor: '#e07a3a', score: 94, scoreChange: 8, scoreTrend: 'up',
    stage: 'negotiation', dealValue: 285000, probability: 85, expectedClose: 'Feb 28, 2026',
    lastActivity: '2 hours ago', lastActivityType: 'email', engagementScore: 92,
    signals: [
      { id: 's1', type: 'pricing_page', description: 'Viewed enterprise pricing 3 times this week', timestamp: '2h ago', impact: 'positive', strength: 9 },
      { id: 's2', type: 'demo_request', description: 'Requested technical demo for team of 15', timestamp: '1d ago', impact: 'positive', strength: 10 },
      { id: 's3', type: 'champion_change', description: 'New CTO started — previously used our product at Stripe', timestamp: '3d ago', impact: 'positive', strength: 8 },
    ],
    nextAction: 'Send custom ROI analysis — they asked about integration costs',
    nextActionPriority: 'high', source: 'Inbound Demo', industry: 'SaaS', companySize: '200-500', tags: ['Enterprise', 'Fast-Track'],
  },
  {
    id: 'l2', name: 'Marcus Johnson', company: 'Apex Financial Group', title: 'Director of Operations',
    email: 'marcus.j@apexfin.com', location: 'New York, NY',
    avatar: 'MJ', avatarColor: '#1a1a2e', score: 87, scoreChange: 3, scoreTrend: 'up',
    stage: 'proposal', dealValue: 420000, probability: 65, expectedClose: 'Mar 15, 2026',
    lastActivity: '5 hours ago', lastActivityType: 'meeting', engagementScore: 78,
    signals: [
      { id: 's4', type: 'budget_signal', description: 'Q2 budget approval cycle starts next week', timestamp: '5h ago', impact: 'positive', strength: 8 },
      { id: 's5', type: 'competitor_mention', description: 'Also evaluating Competitor X — demo scheduled', timestamp: '1d ago', impact: 'negative', strength: 7 },
      { id: 's6', type: 'content_download', description: 'Downloaded ROI calculator and case study', timestamp: '2d ago', impact: 'positive', strength: 6 },
    ],
    nextAction: 'Schedule competitive displacement call — address Competitor X concerns',
    nextActionPriority: 'high', source: 'Conference Lead', industry: 'Financial Services', companySize: '500-1000', tags: ['Enterprise', 'Competitive'],
  },
  {
    id: 'l3', name: 'Priya Patel', company: 'HealthBridge Solutions', title: 'Head of IT',
    email: 'priya@healthbridge.com', phone: '+1 (312) 555-0234', location: 'Chicago, IL',
    avatar: 'PP', avatarColor: '#d46b2c', score: 76, scoreChange: -4, scoreTrend: 'down',
    stage: 'qualified', dealValue: 165000, probability: 45, expectedClose: 'Apr 1, 2026',
    lastActivity: '2 days ago', lastActivityType: 'email', engagementScore: 54,
    signals: [
      { id: 's7', type: 'email_open', description: 'Opened proposal email but didn\'t respond', timestamp: '2d ago', impact: 'neutral', strength: 4 },
      { id: 's8', type: 'champion_change', description: 'Primary contact on PTO until next week', timestamp: '3d ago', impact: 'negative', strength: 6 },
      { id: 's9', type: 'website_visit', description: 'Team member visited security compliance page', timestamp: '4d ago', impact: 'positive', strength: 5 },
    ],
    nextAction: 'Re-engage when Priya returns — prepare HIPAA compliance brief',
    nextActionPriority: 'medium', source: 'Partner Referral', industry: 'Healthcare', companySize: '100-200', tags: ['Mid-Market', 'Healthcare'],
  },
  {
    id: 'l4', name: 'Alex Rodriguez', company: 'Velocity Logistics', title: 'CEO',
    email: 'alex@velocitylog.com', location: 'Austin, TX',
    avatar: 'AR', avatarColor: '#3a3a52', score: 91, scoreChange: 12, scoreTrend: 'up',
    stage: 'proposal', dealValue: 350000, probability: 70, expectedClose: 'Mar 5, 2026',
    lastActivity: '1 hour ago', lastActivityType: 'call', engagementScore: 88,
    signals: [
      { id: 's10', type: 'demo_request', description: 'CEO personally attended product demo', timestamp: '1h ago', impact: 'positive', strength: 10 },
      { id: 's11', type: 'pricing_page', description: 'CFO viewed annual pricing comparison', timestamp: '4h ago', impact: 'positive', strength: 8 },
      { id: 's12', type: 'budget_signal', description: 'Mentioned $500K earmarked for digital transformation', timestamp: '1d ago', impact: 'positive', strength: 9 },
    ],
    nextAction: 'Send proposal with custom implementation timeline — CEO wants to move fast',
    nextActionPriority: 'high', source: 'Outbound SDR', industry: 'Logistics', companySize: '200-500', tags: ['Enterprise', 'CEO-Led'],
  },
  {
    id: 'l5', name: 'Emily Watson', company: 'Creative Dynamics', title: 'Marketing Director',
    email: 'emily.w@creativedyn.com', location: 'Los Angeles, CA',
    avatar: 'EW', avatarColor: '#7C3AED', score: 62, scoreChange: -2, scoreTrend: 'down',
    stage: 'qualified', dealValue: 85000, probability: 30, expectedClose: 'May 1, 2026',
    lastActivity: '5 days ago', lastActivityType: 'website', engagementScore: 35,
    signals: [
      { id: 's13', type: 'website_visit', description: 'Brief website visit — 2 pages, 45 seconds', timestamp: '5d ago', impact: 'neutral', strength: 2 },
      { id: 's14', type: 'email_open', description: 'Opened 1 of last 3 emails sent', timestamp: '5d ago', impact: 'negative', strength: 3 },
    ],
    nextAction: 'Consider nurture sequence — engagement dropping. Not ready for direct outreach.',
    nextActionPriority: 'low', source: 'Content Download', industry: 'Marketing', companySize: '50-100', tags: ['SMB', 'Nurture'],
  },
  {
    id: 'l6', name: 'David Kim', company: 'NexGen Retail', title: 'CTO',
    email: 'dkim@nexgenretail.com', phone: '+1 (206) 555-0178', location: 'Seattle, WA',
    avatar: 'DK', avatarColor: '#059669', score: 83, scoreChange: 5, scoreTrend: 'up',
    stage: 'negotiation', dealValue: 520000, probability: 75, expectedClose: 'Feb 20, 2026',
    lastActivity: '30 min ago', lastActivityType: 'meeting', engagementScore: 85,
    signals: [
      { id: 's15', type: 'meeting_scheduled', description: 'Contract review meeting scheduled for tomorrow', timestamp: '30m ago', impact: 'positive', strength: 9 },
      { id: 's16', type: 'budget_signal', description: 'Legal team reviewing MSA — procurement approved budget', timestamp: '1d ago', impact: 'positive', strength: 10 },
      { id: 's17', type: 'content_download', description: 'Downloaded security whitepaper and API docs', timestamp: '2d ago', impact: 'positive', strength: 7 },
    ],
    nextAction: 'Prepare negotiation brief — they want volume discount on 3-year term',
    nextActionPriority: 'high', source: 'Referral', industry: 'Retail', companySize: '1000+', tags: ['Enterprise', 'Closing'],
  },
];

const pipelineStages: PipelineStage[] = [
  { id: 'ps1', name: 'Prospect', count: 42, value: 2100000, conversionRate: 68, avgDays: 12, color: '#9a9ab0' },
  { id: 'ps2', name: 'Qualified', count: 28, value: 3640000, conversionRate: 54, avgDays: 18, color: '#e07a3a' },
  { id: 'ps3', name: 'Proposal', count: 15, value: 2850000, conversionRate: 72, avgDays: 14, color: '#d46b2c' },
  { id: 'ps4', name: 'Negotiation', count: 8, value: 1940000, conversionRate: 88, avgDays: 10, color: '#1a1a2e' },
  { id: 'ps5', name: 'Closed Won', count: 24, value: 4200000, conversionRate: 100, avgDays: 0, color: '#059669' },
];

const forecasts: Forecast[] = [
  { month: 'Feb 2026', committed: 1200000, bestCase: 1800000, pipeline: 3200000, target: 1500000 },
  { month: 'Mar 2026', committed: 680000, bestCase: 1400000, pipeline: 4100000, target: 1500000 },
  { month: 'Apr 2026', committed: 200000, bestCase: 900000, pipeline: 3800000, target: 1500000 },
];

const aiInsights: AIInsight[] = [
  {
    id: 'ai1', type: 'risk',
    title: 'Deal Stall Alert: HealthBridge Solutions',
    description: 'Engagement dropped 38% this week. Primary champion on PTO. Competitor Y recently onboarded their industry peer. Risk of deal slipping to Q3.',
    impact: '$165K at risk', confidence: 87, relatedDeals: ['l3'],
  },
  {
    id: 'ai2', type: 'opportunity',
    title: 'Fast-Track: Velocity Logistics Ready to Close',
    description: 'CEO engagement score 88/100, budget confirmed ($500K), legal reviewing MSA. Pattern matches 92% of deals that closed within 2 weeks at this stage.',
    impact: '$350K potential', confidence: 92, relatedDeals: ['l4'],
  },
  {
    id: 'ai3', type: 'action',
    title: 'Competitive Displacement Needed: Apex Financial',
    description: 'Competitor X demo scheduled. Send displacement battle card. Historical win rate vs Competitor X: 67% when addressed before proposal stage.',
    impact: '$420K at risk', confidence: 78, relatedDeals: ['l2'],
  },
  {
    id: 'ai4', type: 'trend',
    title: 'Pipeline Velocity Up 23% This Month',
    description: 'Deals are moving 23% faster through qualification to proposal. Key driver: new demo automation reduced time-to-value demos by 40%. Recommend scaling outbound targeting.',
    impact: '+$800K projected', confidence: 85, relatedDeals: [],
  },
  {
    id: 'ai5', type: 'opportunity',
    title: 'NexGen Retail: Upsell Detected',
    description: 'CTO downloaded API docs and security whitepaper. Pattern suggests platform-tier interest. Similar accounts expanded 2.1x within 6 months.',
    impact: '$520K → $1.1M potential', confidence: 74, relatedDeals: ['l6'],
  },
];

const models: ModelInfo[] = [
  {
    id: 'sm1', name: 'LeadScorer — Propensity Model',
    description: 'Multi-signal lead scoring model trained on 85K historical deals. Analyzes firmographic data, behavioral signals, engagement patterns, and buying intent indicators to predict conversion probability.',
    type: 'scoring', status: 'deployed', accuracy: 94.2, latency: '45ms', trainingSamples: '85K deals', lastTrained: '1 day ago',
  },
  {
    id: 'sm2', name: 'DealForecaster — Revenue Prediction',
    description: 'Time-series forecasting model that predicts deal close dates and win probabilities. Factors in pipeline velocity, stage duration, engagement decay, and seasonal patterns.',
    type: 'forecast', status: 'deployed', accuracy: 89.7, latency: '120ms', trainingSamples: '120K outcomes', lastTrained: '3 days ago',
  },
  {
    id: 'sm3', name: 'EngagementAnalyzer — Buyer Intent',
    description: 'Real-time engagement scoring across email, website, content, and meeting signals. Identifies buying committee members, tracks multi-threading depth, and detects champion changes.',
    type: 'engagement', status: 'deployed', accuracy: 91.3, latency: '28ms', trainingSamples: '2.1M signals', lastTrained: '6 hours ago',
  },
  {
    id: 'sm4', name: 'CompetitiveRadar — Win/Loss Predictor',
    description: 'Identifies competitive threats by analyzing deal patterns, pricing page visits, competitor mentions in communications, and market intelligence feeds.',
    type: 'competitive', status: 'fine-tuning', accuracy: 86.4, latency: '200ms', trainingSamples: '45K competitive deals', lastTrained: 'In progress',
  },
  {
    id: 'sm5', name: 'ActionEngine — Next Best Action',
    description: 'Recommendation model that suggests optimal next steps for each deal. Trained on sequences of successful deal progressions, channel preferences, and timing patterns.',
    type: 'recommendation', status: 'deployed', accuracy: 88.1, latency: '85ms', trainingSamples: '60K action sequences', lastTrained: '2 days ago',
  },
];

/* ─── HELPERS ────────────────────────────────────────────── */

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const getScoreColor = (score: number): string => {
  if (score >= 85) return '#059669';
  if (score >= 70) return '#e07a3a';
  if (score >= 50) return '#D97706';
  return '#DC2626';
};

const getScoreLabel = (score: number): string => {
  if (score >= 85) return 'Hot';
  if (score >= 70) return 'Warm';
  if (score >= 50) return 'Cool';
  return 'Cold';
};

const getSignalIcon = (type: Signal['type']) => {
  switch (type) {
    case 'email_open': return <Mail size={13} />;
    case 'website_visit': return <Globe size={13} />;
    case 'content_download': return <FileText size={13} />;
    case 'pricing_page': return <DollarSign size={13} />;
    case 'demo_request': return <Play size={13} />;
    case 'competitor_mention': return <AlertTriangle size={13} />;
    case 'budget_signal': return <DollarSign size={13} />;
    case 'champion_change': return <Users size={13} />;
    case 'meeting_scheduled': return <Calendar size={13} />;
    default: return <Activity size={13} />;
  }
};

const getInsightIcon = (type: AIInsight['type']) => {
  switch (type) {
    case 'risk': return <AlertTriangle size={16} />;
    case 'opportunity': return <TrendingUp size={16} />;
    case 'action': return <Zap size={16} />;
    case 'trend': return <LineChart size={16} />;
    default: return <Lightbulb size={16} />;
  }
};

const getInsightColor = (type: AIInsight['type']) => {
  switch (type) {
    case 'risk': return { bg: '#FEE2E2', color: '#DC2626', border: 'rgba(220,38,38,0.15)' };
    case 'opportunity': return { bg: '#D1FAE5', color: '#059669', border: 'rgba(5,150,105,0.15)' };
    case 'action': return { bg: '#FEF3C7', color: '#D97706', border: 'rgba(217,119,6,0.15)' };
    case 'trend': return { bg: '#EDE9FE', color: '#7C3AED', border: 'rgba(124,58,237,0.15)' };
    default: return { bg: '#f0f0f6', color: '#3a3a52', border: 'rgba(0,0,0,0.06)' };
  }
};

const getStageLabel = (stage: Lead['stage']): string => {
  const map: Record<string, string> = {
    prospect: 'Prospect', qualified: 'Qualified', proposal: 'Proposal',
    negotiation: 'Negotiation', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
  };
  return map[stage] || stage;
};

/* ─── COMPONENT ──────────────────────────────────────────── */

type ActiveView = 'dashboard' | 'leads' | 'pipeline' | 'models';

export function SalesIntelligence() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'value' | 'activity'>('score');
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const scoringRef = useRef(false);

  // Simulated scoring run
  const handleRunScoring = useCallback(() => {
    if (isScoring) return;
    setIsScoring(true);
    scoringRef.current = true;
    setScoringProgress(0);

    const interval = setInterval(() => {
      setScoringProgress(prev => {
        if (prev >= 100 || !scoringRef.current) {
          clearInterval(interval);
          setIsScoring(false);
          scoringRef.current = false;
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 300);
  }, [isScoring]);

  // Filtered and sorted leads
  const filteredLeads = sampleLeads
    .filter(lead => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return lead.name.toLowerCase().includes(q) || lead.company.toLowerCase().includes(q) || lead.industry.toLowerCase().includes(q);
      }
      return true;
    })
    .filter(lead => filterStage === 'all' || lead.stage === filterStage)
    .sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'value') return b.dealValue - a.dealValue;
      return 0; // activity sort by default order
    });

  // Summary metrics
  const totalPipeline = sampleLeads.reduce((sum, l) => sum + l.dealValue, 0);
  const weightedPipeline = sampleLeads.reduce((sum, l) => sum + (l.dealValue * l.probability / 100), 0);
  const avgScore = Math.round(sampleLeads.reduce((sum, l) => sum + l.score, 0) / sampleLeads.length);
  const hotLeads = sampleLeads.filter(l => l.score >= 85).length;

  /* ─── DASHBOARD VIEW ─────────────────────────────────────── */
  const renderDashboard = () => (
    <div className="sales-dashboard-view">
      {/* KPI Cards */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'rgba(224,122,58,0.1)', color: '#e07a3a' }}>
            <DollarSign size={22} />
          </div>
          <div className="sales-kpi-content">
            <span className="sales-kpi-value">{formatCurrency(totalPipeline)}</span>
            <span className="sales-kpi-label">Total Pipeline</span>
          </div>
          <div className="sales-kpi-change positive">
            <ArrowUpRight size={14} />
            <span>+18%</span>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669' }}>
            <Target size={22} />
          </div>
          <div className="sales-kpi-content">
            <span className="sales-kpi-value">{formatCurrency(weightedPipeline)}</span>
            <span className="sales-kpi-label">Weighted Pipeline</span>
          </div>
          <div className="sales-kpi-change positive">
            <ArrowUpRight size={14} />
            <span>+12%</span>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'rgba(26,26,46,0.08)', color: '#1a1a2e' }}>
            <Flame size={22} />
          </div>
          <div className="sales-kpi-content">
            <span className="sales-kpi-value">{hotLeads}</span>
            <span className="sales-kpi-label">Hot Leads (85+)</span>
          </div>
          <div className="sales-kpi-change positive">
            <ArrowUpRight size={14} />
            <span>+2</span>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED' }}>
            <Brain size={22} />
          </div>
          <div className="sales-kpi-content">
            <span className="sales-kpi-value">{avgScore}</span>
            <span className="sales-kpi-label">Avg Lead Score</span>
          </div>
          <div className="sales-kpi-change positive">
            <ArrowUpRight size={14} />
            <span>+5pts</span>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="sales-insights-section">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <Sparkles size={18} />
            <h3>AI Insights</h3>
            <span className="sales-section-badge">{aiInsights.length} active</span>
          </div>
          <button className="sales-btn-secondary" onClick={handleRunScoring}>
            <RefreshCw size={14} className={isScoring ? 'sales-spin' : ''} />
            <span>{isScoring ? 'Scoring...' : 'Re-Score All'}</span>
          </button>
        </div>

        {isScoring && (
          <div className="sales-scoring-bar">
            <div className="sales-scoring-progress">
              <div className="sales-scoring-fill" style={{ width: `${Math.min(scoringProgress, 100)}%` }} />
            </div>
            <span className="sales-scoring-label">
              Analyzing {Math.min(Math.round(scoringProgress), 100)}% — scoring {sampleLeads.length} leads across {models.length} models
            </span>
          </div>
        )}

        <div className="sales-insights-grid">
          {aiInsights.map(insight => {
            const colors = getInsightColor(insight.type);
            const isExpanded = expandedInsight === insight.id;
            return (
              <div
                key={insight.id}
                className={`sales-insight-card ${isExpanded ? 'expanded' : ''}`}
                style={{ borderLeftColor: colors.color }}
                onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
              >
                <div className="sales-insight-header">
                  <div className="sales-insight-icon" style={{ background: colors.bg, color: colors.color }}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="sales-insight-info">
                    <span className="sales-insight-type" style={{ color: colors.color }}>
                      {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                    </span>
                    <h4>{insight.title}</h4>
                  </div>
                  <div className="sales-insight-meta">
                    <span className="sales-insight-confidence">{insight.confidence}%</span>
                    <span className="sales-insight-impact">{insight.impact}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="sales-insight-expanded">
                    <p>{insight.description}</p>
                    {insight.relatedDeals.length > 0 && (
                      <div className="sales-insight-deals">
                        <span>Related:</span>
                        {insight.relatedDeals.map(dealId => {
                          const deal = sampleLeads.find(l => l.id === dealId);
                          return deal ? (
                            <button
                              key={dealId}
                              className="sales-insight-deal-link"
                              onClick={(e) => { e.stopPropagation(); setSelectedLead(deal); setActiveView('leads'); }}
                            >
                              {deal.company}
                              <ExternalLink size={11} />
                            </button>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Forecast Section */}
      <div className="sales-forecast-section">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <BarChart3 size={18} />
            <h3>Revenue Forecast</h3>
          </div>
        </div>
        <div className="sales-forecast-grid">
          {forecasts.map(f => {
            const commitPct = Math.round((f.committed / f.target) * 100);
            const bestPct = Math.round((f.bestCase / f.target) * 100);
            return (
              <div key={f.month} className="sales-forecast-card">
                <div className="sales-forecast-month">{f.month}</div>
                <div className="sales-forecast-target">
                  Target: <strong>{formatCurrency(f.target)}</strong>
                </div>
                <div className="sales-forecast-bars">
                  <div className="sales-forecast-bar-row">
                    <span className="sales-forecast-bar-label">Committed</span>
                    <div className="sales-forecast-bar-track">
                      <div className="sales-forecast-bar-fill committed" style={{ width: `${Math.min(commitPct, 100)}%` }} />
                    </div>
                    <span className="sales-forecast-bar-value">{formatCurrency(f.committed)}</span>
                  </div>
                  <div className="sales-forecast-bar-row">
                    <span className="sales-forecast-bar-label">Best Case</span>
                    <div className="sales-forecast-bar-track">
                      <div className="sales-forecast-bar-fill best-case" style={{ width: `${Math.min(bestPct, 100)}%` }} />
                    </div>
                    <span className="sales-forecast-bar-value">{formatCurrency(f.bestCase)}</span>
                  </div>
                  <div className="sales-forecast-bar-row">
                    <span className="sales-forecast-bar-label">Pipeline</span>
                    <div className="sales-forecast-bar-track">
                      <div className="sales-forecast-bar-fill pipeline" style={{ width: `${Math.min(Math.round((f.pipeline / f.target) * 100), 100)}%` }} />
                    </div>
                    <span className="sales-forecast-bar-value">{formatCurrency(f.pipeline)}</span>
                  </div>
                </div>
                <div className="sales-forecast-status">
                  {commitPct >= 100 ? (
                    <span className="sales-forecast-on-track"><CheckCircle2 size={13} /> On Track</span>
                  ) : commitPct >= 70 ? (
                    <span className="sales-forecast-close"><TrendingUp size={13} /> Close — need {formatCurrency(f.target - f.committed)}</span>
                  ) : (
                    <span className="sales-forecast-gap"><AlertTriangle size={13} /> Gap: {formatCurrency(f.target - f.committed)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Deals */}
      <div className="sales-top-deals-section">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <Award size={18} />
            <h3>Top Deals to Watch</h3>
          </div>
          <button className="sales-btn-secondary" onClick={() => setActiveView('leads')}>
            View All <ArrowRight size={14} />
          </button>
        </div>
        <div className="sales-top-deals-grid">
          {sampleLeads.filter(l => l.score >= 80).slice(0, 4).map(lead => (
            <div
              key={lead.id}
              className="sales-top-deal-card"
              onClick={() => { setSelectedLead(lead); setActiveView('leads'); }}
            >
              <div className="sales-top-deal-header">
                <div className="sales-top-deal-avatar" style={{ background: lead.avatarColor }}>
                  {lead.avatar}
                </div>
                <div className="sales-top-deal-info">
                  <span className="sales-top-deal-company">{lead.company}</span>
                  <span className="sales-top-deal-name">{lead.name} · {lead.title}</span>
                </div>
                <div className="sales-top-deal-score" style={{ color: getScoreColor(lead.score) }}>
                  {lead.score}
                </div>
              </div>
              <div className="sales-top-deal-metrics">
                <span><DollarSign size={12} /> {formatCurrency(lead.dealValue)}</span>
                <span><Percent size={12} /> {lead.probability}%</span>
                <span><Calendar size={12} /> {lead.expectedClose}</span>
              </div>
              <div className="sales-top-deal-action">
                <Zap size={12} />
                <span>{lead.nextAction}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ─── LEADS VIEW ─────────────────────────────────────────── */
  const renderLeadsView = () => (
    <div className="sales-leads-view">
      {/* Controls */}
      <div className="sales-leads-controls">
        <div className="sales-leads-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search leads, companies, industries..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="sales-search-clear" onClick={() => setSearchQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="sales-leads-filters">
          <select
            className="sales-filter-select"
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
          >
            <option value="all">All Stages</option>
            <option value="prospect">Prospect</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
          </select>
          <select
            className="sales-filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="score">Sort by Score</option>
            <option value="value">Sort by Value</option>
            <option value="activity">Sort by Activity</option>
          </select>
        </div>
      </div>

      {/* Content split */}
      <div className="sales-leads-content">
        {/* Lead List */}
        <div className="sales-lead-list">
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              className={`sales-lead-item ${selectedLead?.id === lead.id ? 'selected' : ''}`}
              onClick={() => setSelectedLead(lead)}
            >
              <div className="sales-lead-item-left">
                <div className="sales-lead-avatar" style={{ background: lead.avatarColor }}>
                  {lead.avatar}
                </div>
                <div className="sales-lead-item-content">
                  <div className="sales-lead-item-top">
                    <span className="sales-lead-name">{lead.name}</span>
                    <span className="sales-lead-time">{lead.lastActivity}</span>
                  </div>
                  <span className="sales-lead-company">{lead.company} · {lead.title}</span>
                  <div className="sales-lead-item-bottom">
                    <span className="sales-lead-value">{formatCurrency(lead.dealValue)}</span>
                    <span className={`sales-lead-stage stage-${lead.stage}`}>{getStageLabel(lead.stage)}</span>
                    {lead.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="sales-lead-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sales-lead-score-col">
                <div className="sales-lead-score-ring" style={{ borderColor: getScoreColor(lead.score) }}>
                  <span style={{ color: getScoreColor(lead.score) }}>{lead.score}</span>
                </div>
                <span className="sales-lead-score-label" style={{ color: getScoreColor(lead.score) }}>
                  {getScoreLabel(lead.score)}
                </span>
                {lead.scoreChange !== 0 && (
                  <span className={`sales-lead-score-change ${lead.scoreTrend === 'up' ? 'positive' : 'negative'}`}>
                    {lead.scoreTrend === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {lead.scoreTrend === 'up' ? '+' : ''}{lead.scoreChange}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Lead Detail */}
        <div className="sales-lead-detail">
          {selectedLead ? (
            <>
              {/* Detail Header */}
              <div className="sales-detail-header">
                <div className="sales-detail-header-top">
                  <div className="sales-detail-avatar" style={{ background: selectedLead.avatarColor }}>
                    {selectedLead.avatar}
                  </div>
                  <div className="sales-detail-header-info">
                    <h3>{selectedLead.name}</h3>
                    <span className="sales-detail-title">{selectedLead.title} at {selectedLead.company}</span>
                    <div className="sales-detail-contact-row">
                      <span><Mail size={12} /> {selectedLead.email}</span>
                      {selectedLead.phone && <span><Phone size={12} /> {selectedLead.phone}</span>}
                      <span><MapPin size={12} /> {selectedLead.location}</span>
                    </div>
                  </div>
                  <div className="sales-detail-score-block">
                    <div className="sales-detail-score-big" style={{ color: getScoreColor(selectedLead.score) }}>
                      {selectedLead.score}
                    </div>
                    <span className="sales-detail-score-change" style={{ color: selectedLead.scoreTrend === 'up' ? '#059669' : '#DC2626' }}>
                      {selectedLead.scoreTrend === 'up' ? '↑' : '↓'} {Math.abs(selectedLead.scoreChange)} pts
                    </span>
                    <span className="sales-detail-score-label">Lead Score</span>
                  </div>
                </div>
                <div className="sales-detail-badges">
                  <span className={`sales-detail-stage stage-${selectedLead.stage}`}>{getStageLabel(selectedLead.stage)}</span>
                  <span className="sales-detail-badge">
                    <DollarSign size={12} /> {formatCurrency(selectedLead.dealValue)}
                  </span>
                  <span className="sales-detail-badge">
                    <Target size={12} /> {selectedLead.probability}% probability
                  </span>
                  <span className="sales-detail-badge">
                    <Calendar size={12} /> Close: {selectedLead.expectedClose}
                  </span>
                  <span className="sales-detail-badge">
                    <Building2 size={12} /> {selectedLead.industry} · {selectedLead.companySize}
                  </span>
                </div>
              </div>

              {/* Next Best Action */}
              <div className={`sales-next-action priority-${selectedLead.nextActionPriority}`}>
                <div className="sales-next-action-header">
                  <Zap size={15} />
                  <span>AI Recommended Next Action</span>
                  <span className={`sales-action-priority ${selectedLead.nextActionPriority}`}>
                    {selectedLead.nextActionPriority.toUpperCase()}
                  </span>
                </div>
                <p>{selectedLead.nextAction}</p>
              </div>

              {/* Engagement & Signals */}
              <div className="sales-detail-section">
                <div className="sales-detail-section-header">
                  <Activity size={14} />
                  <span>Engagement Signals</span>
                  <span className="sales-engagement-score">
                    Engagement: <strong>{selectedLead.engagementScore}/100</strong>
                  </span>
                </div>
                <div className="sales-signals-list">
                  {selectedLead.signals.map(signal => (
                    <div key={signal.id} className={`sales-signal-item impact-${signal.impact}`}>
                      <div className="sales-signal-icon">
                        {getSignalIcon(signal.type)}
                      </div>
                      <div className="sales-signal-content">
                        <span className="sales-signal-desc">{signal.description}</span>
                        <span className="sales-signal-time">{signal.timestamp}</span>
                      </div>
                      <div className="sales-signal-strength">
                        <div className="sales-signal-bars">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className={`sales-signal-bar ${i <= Math.ceil(signal.strength / 2) ? 'active' : ''}`}
                              style={{ background: i <= Math.ceil(signal.strength / 2) ? (signal.impact === 'positive' ? '#059669' : signal.impact === 'negative' ? '#DC2626' : '#D97706') : undefined }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="sales-detail-tags">
                {selectedLead.tags.map(tag => (
                  <span key={tag} className="sales-detail-tag">{tag}</span>
                ))}
                <span className="sales-detail-tag source">Source: {selectedLead.source}</span>
              </div>
            </>
          ) : (
            <div className="sales-detail-empty">
              <Target size={48} />
              <h3>Select a Lead</h3>
              <p>Choose a lead to view AI-powered insights, engagement signals, and recommended actions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ─── PIPELINE VIEW ──────────────────────────────────────── */
  const renderPipelineView = () => (
    <div className="sales-pipeline-view">
      {/* Pipeline Funnel */}
      <div className="sales-funnel-section">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <PieChart size={18} />
            <h3>Pipeline Funnel</h3>
          </div>
        </div>
        <div className="sales-funnel">
          {pipelineStages.map((stage, i) => {
            const maxValue = Math.max(...pipelineStages.map(s => s.value));
            const widthPct = Math.max((stage.value / maxValue) * 100, 20);
            return (
              <div key={stage.id} className="sales-funnel-stage">
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{ width: `${widthPct}%`, background: stage.color }}
                  >
                    <span className="sales-funnel-bar-label">{stage.name}</span>
                    <span className="sales-funnel-bar-value">{formatCurrency(stage.value)}</span>
                  </div>
                </div>
                <div className="sales-funnel-metrics">
                  <span className="sales-funnel-count">{stage.count} deals</span>
                  <span className="sales-funnel-conversion">
                    {i < pipelineStages.length - 1 && (
                      <>{stage.conversionRate}% →</>
                    )}
                  </span>
                  {stage.avgDays > 0 && <span className="sales-funnel-days">~{stage.avgDays}d avg</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Health */}
      <div className="sales-pipeline-health">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <Activity size={18} />
            <h3>Pipeline Health Metrics</h3>
          </div>
        </div>
        <div className="sales-health-grid">
          <div className="sales-health-card">
            <div className="sales-health-icon" style={{ background: '#D1FAE5', color: '#059669' }}>
              <TrendingUp size={20} />
            </div>
            <div className="sales-health-content">
              <span className="sales-health-value">23%</span>
              <span className="sales-health-label">Pipeline Velocity Increase</span>
              <span className="sales-health-detail">Deals moving 23% faster month-over-month</span>
            </div>
          </div>
          <div className="sales-health-card">
            <div className="sales-health-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <Clock size={20} />
            </div>
            <div className="sales-health-content">
              <span className="sales-health-value">34 days</span>
              <span className="sales-health-label">Avg Sales Cycle</span>
              <span className="sales-health-detail">Down from 42 days last quarter</span>
            </div>
          </div>
          <div className="sales-health-card">
            <div className="sales-health-icon" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
              <Percent size={20} />
            </div>
            <div className="sales-health-content">
              <span className="sales-health-value">32%</span>
              <span className="sales-health-label">Win Rate</span>
              <span className="sales-health-detail">Up from 27% — AI scoring improved targeting</span>
            </div>
          </div>
          <div className="sales-health-card">
            <div className="sales-health-icon" style={{ background: 'rgba(224,122,58,0.1)', color: '#e07a3a' }}>
              <DollarSign size={20} />
            </div>
            <div className="sales-health-content">
              <span className="sales-health-value">{formatCurrency(280000)}</span>
              <span className="sales-health-label">Avg Deal Size</span>
              <span className="sales-health-detail">15% increase from enterprise focus</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Conversion Analysis */}
      <div className="sales-conversion-section">
        <div className="sales-section-header">
          <div className="sales-section-header-left">
            <ArrowRight size={18} />
            <h3>Stage Conversion Analysis</h3>
          </div>
        </div>
        <div className="sales-conversion-flow">
          {pipelineStages.slice(0, -1).map((stage, i) => {
            const next = pipelineStages[i + 1];
            return (
              <div key={stage.id} className="sales-conversion-step">
                <div className="sales-conversion-from">
                  <span className="sales-conversion-stage-name">{stage.name}</span>
                  <span className="sales-conversion-stage-count">{stage.count} deals</span>
                </div>
                <div className="sales-conversion-arrow">
                  <div className="sales-conversion-rate">{stage.conversionRate}%</div>
                  <ArrowRight size={16} />
                  <div className="sales-conversion-loss">{100 - stage.conversionRate}% drop</div>
                </div>
                <div className="sales-conversion-to">
                  <span className="sales-conversion-stage-name">{next.name}</span>
                  <span className="sales-conversion-stage-count">{next.count} deals</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  /* ─── MODELS VIEW ────────────────────────────────────────── */
  const renderModelsView = () => (
    <div className="sales-models-view">
      {/* Architecture Banner */}
      <div className="sales-arch-banner">
        <div className="sales-arch-banner-content">
          <div className="sales-arch-banner-icon">
            <Brain size={28} />
          </div>
          <div className="sales-arch-banner-text">
            <h3>Sales Intelligence Model Stack</h3>
            <p>5 specialized models analyze leads, predict outcomes, detect buying signals, and recommend actions. No generic AI — every model is trained on real sales data.</p>
          </div>
          <div className="sales-arch-stats">
            <div className="sales-arch-stat">
              <span className="sales-arch-stat-value">5</span>
              <span className="sales-arch-stat-label">Models</span>
            </div>
            <div className="sales-arch-stat">
              <span className="sales-arch-stat-value">2.4M</span>
              <span className="sales-arch-stat-label">Signals Processed</span>
            </div>
            <div className="sales-arch-stat">
              <span className="sales-arch-stat-value">94%</span>
              <span className="sales-arch-stat-label">Score Accuracy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Diagram */}
      <div className="sales-model-pipeline">
        <div className="sales-model-pipeline-label">Scoring Pipeline</div>
        <div className="sales-model-pipeline-steps">
          {['Ingest Signals', 'Score Lead', 'Predict Close', 'Detect Threats', 'Recommend Action'].map((step, i) => (
            <div key={step} className="sales-model-pipeline-step">
              <div className={`sales-model-pipeline-dot ${i < 4 ? 'active' : ''}`}>
                {i < 4 ? <CheckCircle2 size={12} /> : <Loader2 size={12} className="sales-spin" />}
              </div>
              <span>{step}</span>
              {i < 4 && <ArrowRight size={14} className="sales-model-pipeline-arrow" />}
            </div>
          ))}
        </div>
      </div>

      {/* Model Cards */}
      <div className="sales-models-grid">
        {models.map(model => {
          const isExpanded = expandedModel === model.id;
          const typeLabels: Record<string, { label: string; className: string }> = {
            scoring: { label: 'Scoring', className: 'sales-model-type-scoring' },
            forecast: { label: 'Forecasting', className: 'sales-model-type-forecast' },
            engagement: { label: 'Engagement', className: 'sales-model-type-engagement' },
            competitive: { label: 'Competitive', className: 'sales-model-type-competitive' },
            recommendation: { label: 'Actions', className: 'sales-model-type-actions' },
          };
          const statusLabels: Record<string, { label: string; className: string }> = {
            deployed: { label: 'Deployed', className: 'sales-model-status-deployed' },
            training: { label: 'Training', className: 'sales-model-status-training' },
            'fine-tuning': { label: 'Fine-tuning', className: 'sales-model-status-finetuning' },
          };
          const typeInfo = typeLabels[model.type];
          const statusInfo = statusLabels[model.status];

          return (
            <div
              key={model.id}
              className={`sales-model-card ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedModel(isExpanded ? null : model.id)}
            >
              <div className="sales-model-card-header">
                <div className="sales-model-card-tags">
                  <span className={`sales-model-type-badge ${typeInfo.className}`}>{typeInfo.label}</span>
                  <span className={`sales-model-status-badge ${statusInfo.className}`}>
                    {model.status === 'deployed' ? <CheckCircle2 size={11} /> : <Loader2 size={11} className="sales-spin" />}
                    {statusInfo.label}
                  </span>
                </div>
              </div>
              <h4 className="sales-model-name">{model.name}</h4>
              <p className="sales-model-desc">{model.description}</p>
              <div className="sales-model-metrics">
                <div className="sales-model-metric">
                  <span className="sales-model-metric-value">{model.accuracy}%</span>
                  <span className="sales-model-metric-label">Accuracy</span>
                </div>
                <div className="sales-model-metric">
                  <span className="sales-model-metric-value">{model.latency}</span>
                  <span className="sales-model-metric-label">Latency</span>
                </div>
                <div className="sales-model-metric">
                  <span className="sales-model-metric-value">{model.trainingSamples}</span>
                  <span className="sales-model-metric-label">Trained On</span>
                </div>
                <div className="sales-model-metric">
                  <span className="sales-model-metric-value">{model.lastTrained}</span>
                  <span className="sales-model-metric-label">Last Trained</span>
                </div>
              </div>
              {isExpanded && (
                <div className="sales-model-expanded">
                  <div className="sales-model-progress-section">
                    <h5>Training Progress</h5>
                    <div className="sales-model-progress-bar">
                      <div className="sales-model-progress-fill" style={{ width: model.status === 'deployed' ? '100%' : '72%' }} />
                    </div>
                    <span className="sales-model-progress-label">
                      {model.status === 'deployed' ? 'Production ready' : 'Epoch 9/12 — ETA 2.1h'}
                    </span>
                  </div>
                  <div className="sales-model-actions">
                    <button className="sales-model-action-btn"><RefreshCw size={14} /> Retrain</button>
                    <button className="sales-model-action-btn"><BarChart3 size={14} /> Metrics</button>
                    <button className="sales-model-action-btn"><Settings2 size={14} /> Config</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="sales-page">
      {/* Header */}
      <div className="sales-header">
        <div className="sales-header-left">
          <h1 className="sales-header-title">Sales Intelligence</h1>
          <div className="sales-header-tabs">
            <button
              className={`sales-header-tab ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <BarChart3 size={15} />
              Dashboard
            </button>
            <button
              className={`sales-header-tab ${activeView === 'leads' ? 'active' : ''}`}
              onClick={() => setActiveView('leads')}
            >
              <Users size={15} />
              Leads
            </button>
            <button
              className={`sales-header-tab ${activeView === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveView('pipeline')}
            >
              <TrendingUp size={15} />
              Pipeline
            </button>
            <button
              className={`sales-header-tab ${activeView === 'models' ? 'active' : ''}`}
              onClick={() => setActiveView('models')}
            >
              <Brain size={15} />
              AI Models
            </button>
          </div>
        </div>
        <div className="sales-header-right">
          <button className="sales-btn-primary" onClick={handleRunScoring}>
            <Sparkles size={16} />
            Score All Leads
          </button>
          <button className="sales-btn-secondary">
            <RefreshCw size={15} />
            Sync CRM
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="sales-content">
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'leads' && renderLeadsView()}
        {activeView === 'pipeline' && renderPipelineView()}
        {activeView === 'models' && renderModelsView()}
      </div>
    </div>
  );
}





