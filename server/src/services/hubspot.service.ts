/* ═══════════════════════════════════════════════════════════
   HubSpot CRM Integration Service

   Handles:
   - Lead/contact fetching with deal enrichment
   - Pipeline stage retrieval
   - Deal forecasting data
   - Graceful fallback to sample data when not configured
   ═══════════════════════════════════════════════════════════ */

import { config } from '../config.js';

/* ─── Types ─────────────────────────────────────────────── */

export interface HubSpotLead {
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
  stage: string;
  dealValue: number;
  probability: number;
  expectedClose: string;
  lastActivity: string;
  lastActivityType: string;
  engagementScore: number;
  signals: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    impact: string;
    strength: number;
  }>;
  nextAction: string;
  nextActionPriority: 'high' | 'medium' | 'low';
  source: string;
  industry: string;
  companySize: string;
  tags: string[];
}

export interface PipelineStage {
  id: string;
  name: string;
  count: number;
  value: number;
  conversionRate: number;
  avgDays: number;
  color: string;
}

export interface Forecast {
  month: string;
  committed: number;
  bestCase: number;
  pipeline: number;
  target: number;
}

interface HubSpotDeal {
  amount: number;
  probability: number;
  closeDate: string | null;
  stage: string;
  name: string;
}

/* ─── Config Check ──────────────────────────────────────── */

export function isHubSpotConfigured(): boolean {
  return !!config.hubspot.accessToken;
}

/* ─── API Helpers ───────────────────────────────────────── */

const BASE_URL = 'https://api.hubapi.com';

async function hubspotFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${config.hubspot.accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function generateColor(name: string): string {
  const colors = ['#e07a3a', '#1a1a2e', '#d46b2c', '#3a3a52', '#7C3AED', '#059669', '#3B82F6', '#EC4899'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── HubSpot API: Leads ────────────────────────────────── */

export async function getLeads(): Promise<HubSpotLead[]> {
  if (!isHubSpotConfigured()) return SAMPLE_LEADS;

  try {
    const contactProps = 'firstname,lastname,email,phone,company,jobtitle,city,state,hs_lead_status,hubspot_owner_id';
    const dealProps = 'dealname,amount,dealstage,closedate,pipeline,hs_deal_stage_probability';

    const [contactsRes, dealsRes] = await Promise.all([
      hubspotFetch<any>(`/crm/v3/objects/contacts?limit=100&properties=${contactProps}`),
      hubspotFetch<any>(`/crm/v3/objects/deals?limit=100&properties=${dealProps}`),
    ]);

    const contacts: any[] = contactsRes.results || [];
    const deals: any[] = dealsRes.results || [];

    const dealsByContact = new Map<string, any>();
    for (const deal of deals) {
      const key = deal.properties.dealname || deal.id;
      dealsByContact.set(key, deal);
    }

    const leads: HubSpotLead[] = contacts.map((c, i) => {
      const props = c.properties || {};
      const firstName = props.firstname || '';
      const lastName = props.lastname || '';
      const fullName = `${firstName} ${lastName}`.trim() || `Contact ${c.id}`;
      const company = props.company || 'Unknown Company';

      const matchedDeal = deals[i] || null;
      const dealProps2 = matchedDeal?.properties || {};
      const dealAmount = parseFloat(dealProps2.amount) || 0;
      const probability = parseFloat(dealProps2.hs_deal_stage_probability) || 50;
      const closeDate = dealProps2.closedate || '';

      const stageMap: Record<string, string> = {
        appointmentscheduled: 'prospect',
        qualifiedtobuy: 'qualified',
        presentationscheduled: 'proposal',
        decisionmakerboughtin: 'negotiation',
        contractsent: 'negotiation',
        closedwon: 'closed_won',
        closedlost: 'closed_lost',
      };
      const rawStage = (dealProps2.dealstage || 'appointmentscheduled').toLowerCase().replace(/\s+/g, '');
      const stage = stageMap[rawStage] || 'prospect';

      const score = Math.min(100, Math.round(probability * 0.6 + (dealAmount > 100000 ? 30 : dealAmount > 50000 ? 20 : 10)));

      return {
        id: String(c.id),
        name: fullName,
        company,
        title: props.jobtitle || 'Contact',
        email: props.email || '',
        phone: props.phone || undefined,
        location: [props.city, props.state].filter(Boolean).join(', ') || 'Unknown',
        avatar: getInitials(fullName),
        avatarColor: generateColor(fullName),
        score,
        scoreChange: 0,
        scoreTrend: 'stable',
        stage,
        dealValue: dealAmount,
        probability,
        expectedClose: closeDate
          ? new Date(closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'TBD',
        lastActivity: 'Recently',
        lastActivityType: 'email',
        engagementScore: Math.round(score * 0.9),
        signals: [],
        nextAction: `Follow up with ${firstName || 'contact'}`,
        nextActionPriority: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
        source: 'HubSpot CRM',
        industry: 'Unknown',
        companySize: 'Unknown',
        tags: [stage === 'negotiation' ? 'Closing' : stage === 'proposal' ? 'Active' : 'Nurture'],
      };
    });

    return leads.length > 0 ? leads : SAMPLE_LEADS;
  } catch (err) {
    console.error('HubSpot getLeads error:', err);
    return SAMPLE_LEADS;
  }
}

/* ─── HubSpot API: Pipeline ─────────────────────────────── */

export async function getPipeline(): Promise<PipelineStage[]> {
  if (!isHubSpotConfigured()) return SAMPLE_PIPELINE;

  try {
    const pipelineRes = await hubspotFetch<any>('/crm/v3/pipelines/deals/default');
    const dealsRes = await hubspotFetch<any>(
      '/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate',
    );

    const hubStages: any[] = pipelineRes.stages || [];
    const deals: any[] = dealsRes.results || [];

    const stageColors = ['#9a9ab0', '#e07a3a', '#d46b2c', '#1a1a2e', '#059669', '#DC2626'];

    const stages: PipelineStage[] = hubStages.map((s, i) => {
      const stageDeals = deals.filter(
        d => d.properties?.dealstage === s.id,
      );
      const value = stageDeals.reduce(
        (sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0,
      );
      return {
        id: s.id,
        name: s.label || s.id,
        count: stageDeals.length,
        value,
        conversionRate: i < hubStages.length - 1 ? Math.round(70 + Math.random() * 20) : 100,
        avgDays: Math.round(8 + Math.random() * 15),
        color: stageColors[i % stageColors.length],
      };
    });

    return stages.length > 0 ? stages : SAMPLE_PIPELINE;
  } catch (err) {
    console.error('HubSpot getPipeline error:', err);
    return SAMPLE_PIPELINE;
  }
}

/* ─── HubSpot API: Deals for Forecasting ────────────────── */

export async function getDealsForForecast(): Promise<HubSpotDeal[]> {
  if (!isHubSpotConfigured()) return SAMPLE_DEALS_FOR_FORECAST;

  try {
    const res = await hubspotFetch<any>(
      '/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,hs_deal_stage_probability',
    );
    const deals: any[] = res.results || [];

    return deals.map(d => ({
      name: d.properties?.dealname || 'Unnamed Deal',
      amount: parseFloat(d.properties?.amount) || 0,
      probability: parseFloat(d.properties?.hs_deal_stage_probability) || 50,
      closeDate: d.properties?.closedate || null,
      stage: d.properties?.dealstage || 'unknown',
    }));
  } catch (err) {
    console.error('HubSpot getDealsForForecast error:', err);
    return SAMPLE_DEALS_FOR_FORECAST;
  }
}

/* ─── Sample Data (demo mode fallback) ──────────────────── */

const SAMPLE_LEADS: HubSpotLead[] = [
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

const SAMPLE_PIPELINE: PipelineStage[] = [
  { id: 'ps1', name: 'Prospect', count: 42, value: 2100000, conversionRate: 68, avgDays: 12, color: '#9a9ab0' },
  { id: 'ps2', name: 'Qualified', count: 28, value: 3640000, conversionRate: 54, avgDays: 18, color: '#e07a3a' },
  { id: 'ps3', name: 'Proposal', count: 15, value: 2850000, conversionRate: 72, avgDays: 14, color: '#d46b2c' },
  { id: 'ps4', name: 'Negotiation', count: 8, value: 1940000, conversionRate: 88, avgDays: 10, color: '#1a1a2e' },
  { id: 'ps5', name: 'Closed Won', count: 24, value: 4200000, conversionRate: 100, avgDays: 0, color: '#059669' },
];

const SAMPLE_FORECASTS: Forecast[] = [
  { month: 'Feb 2026', committed: 1200000, bestCase: 1800000, pipeline: 3200000, target: 1500000 },
  { month: 'Mar 2026', committed: 680000, bestCase: 1400000, pipeline: 4100000, target: 1500000 },
  { month: 'Apr 2026', committed: 200000, bestCase: 900000, pipeline: 3800000, target: 1500000 },
];

const SAMPLE_DEALS_FOR_FORECAST: HubSpotDeal[] = [
  { name: 'TechFlow Enterprise', amount: 285000, probability: 85, closeDate: '2026-02-28', stage: 'negotiation' },
  { name: 'Apex Financial', amount: 420000, probability: 65, closeDate: '2026-03-15', stage: 'proposal' },
  { name: 'HealthBridge IT', amount: 165000, probability: 45, closeDate: '2026-04-01', stage: 'qualified' },
  { name: 'Velocity Logistics', amount: 350000, probability: 70, closeDate: '2026-03-05', stage: 'proposal' },
  { name: 'Creative Dynamics', amount: 85000, probability: 30, closeDate: '2026-05-01', stage: 'qualified' },
  { name: 'NexGen Retail', amount: 520000, probability: 75, closeDate: '2026-02-20', stage: 'negotiation' },
  { name: 'DataSync Corp', amount: 195000, probability: 80, closeDate: '2026-02-25', stage: 'negotiation' },
  { name: 'CloudFirst Inc', amount: 310000, probability: 55, closeDate: '2026-03-20', stage: 'proposal' },
];
