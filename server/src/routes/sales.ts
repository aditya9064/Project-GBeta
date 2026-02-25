import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { config } from '../config.js';
import {
  isHubSpotConfigured,
  getLeads,
  getPipeline,
  getDealsForForecast,
  type HubSpotLead,
  type Forecast,
} from '../services/hubspot.service.js';

const router = Router();

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: config.openai.apiKey });
}

/* ─── GET /leads ────────────────────────────────────────── */

router.get('/leads', async (_req: Request, res: Response) => {
  try {
    const leads = await getLeads();
    res.json({ success: true, leads, configured: isHubSpotConfigured() });
  } catch (err: any) {
    console.error('Sales leads error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── GET /leads/:id ────────────────────────────────────── */

router.get('/leads/:id', async (req: Request, res: Response) => {
  try {
    const leads = await getLeads();
    const lead = leads.find(l => l.id === String(req.params.id));
    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found' });
      return;
    }
    res.json({ success: true, lead });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── GET /pipeline ─────────────────────────────────────── */

router.get('/pipeline', async (_req: Request, res: Response) => {
  try {
    const stages = await getPipeline();
    res.json({ success: true, stages, configured: isHubSpotConfigured() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── GET /forecasts ────────────────────────────────────── */

router.get('/forecasts', async (_req: Request, res: Response) => {
  try {
    const deals = await getDealsForForecast();
    const now = new Date();
    const forecasts: Forecast[] = [];

    for (let m = 0; m < 3; m++) {
      const target = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const monthLabel = target.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0);

      const monthDeals = deals.filter(d => {
        if (!d.closeDate) return false;
        const cd = new Date(d.closeDate);
        return cd >= target && cd <= monthEnd;
      });

      const committed = monthDeals
        .filter(d => d.probability >= 80)
        .reduce((s, d) => s + d.amount, 0);
      const bestCase = monthDeals
        .filter(d => d.probability >= 50)
        .reduce((s, d) => s + d.amount, 0);
      const pipeline = monthDeals.reduce((s, d) => s + d.amount, 0);

      forecasts.push({
        month: monthLabel,
        committed,
        bestCase,
        pipeline,
        target: 1500000,
      });
    }

    res.json({ success: true, forecasts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── POST /score ───────────────────────────────────────── */

router.post('/score', async (req: Request, res: Response) => {
  try {
    const leads = await getLeads();
    if (!leads.length) {
      res.json({ success: true, leads: [] });
      return;
    }

    const ai = getOpenAI();
    const leadsSnapshot = leads.map(l => ({
      id: l.id, name: l.name, company: l.company, title: l.title,
      stage: l.stage, dealValue: l.dealValue, probability: l.probability,
      lastActivity: l.lastActivity, engagementScore: l.engagementScore,
      industry: l.industry, companySize: l.companySize,
    }));

    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are a sales intelligence AI. Score each lead 0-100 based on deal value, stage progression, engagement, and fit. Return JSON: { "scores": [{ "id": "...", "score": N, "scoreChange": N, "scoreTrend": "up"|"down"|"stable", "nextAction": "...", "nextActionPriority": "high"|"medium"|"low", "signals": [{"type":"...","description":"...","impact":"positive"|"negative"|"neutral","strength":N}] }] }`,
      }, {
        role: 'user',
        content: `Score these leads:\n${JSON.stringify(leadsSnapshot, null, 2)}`,
      }],
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    const scoreMap = new Map(
      (parsed.scores || []).map((s: any) => [s.id, s]),
    );

    const scoredLeads: HubSpotLead[] = leads.map(l => {
      const aiScore = scoreMap.get(l.id) as any;
      if (!aiScore) return l;
      return {
        ...l,
        score: aiScore.score ?? l.score,
        scoreChange: aiScore.scoreChange ?? 0,
        scoreTrend: aiScore.scoreTrend ?? 'stable',
        nextAction: aiScore.nextAction ?? l.nextAction,
        nextActionPriority: aiScore.nextActionPriority ?? 'medium',
        signals: (aiScore.signals || []).map((s: any, i: number) => ({
          id: `sig-${l.id}-${i}`,
          type: s.type || 'email_open',
          description: s.description || '',
          timestamp: 'Just now',
          impact: s.impact || 'neutral',
          strength: s.strength || 5,
        })),
      };
    });

    res.json({ success: true, leads: scoredLeads });
  } catch (err: any) {
    console.error('Scoring error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── GET /insights ─────────────────────────────────────── */

router.get('/insights', async (_req: Request, res: Response) => {
  try {
    const [leads, stages] = await Promise.all([getLeads(), getPipeline()]);
    const ai = getOpenAI();

    const summary = {
      totalLeads: leads.length,
      totalPipeline: leads.reduce((s, l) => s + l.dealValue, 0),
      stageBreakdown: stages.map(s => ({ name: s.name, count: s.count, value: s.value })),
      topLeads: leads.slice(0, 5).map(l => ({
        name: l.name, company: l.company, stage: l.stage,
        dealValue: l.dealValue, lastActivity: l.lastActivity,
      })),
    };

    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You are a sales analytics AI. Analyze the pipeline and generate actionable insights. Return JSON: { "insights": [{ "id": "ai1", "type": "risk"|"opportunity"|"action"|"trend", "title": "...", "description": "...", "impact": "$XXK ...", "confidence": N, "relatedDeals": [] }] }. Generate 4-6 insights.`,
      }, {
        role: 'user',
        content: `Pipeline data:\n${JSON.stringify(summary, null, 2)}`,
      }],
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    res.json({ success: true, insights: parsed.insights || [] });
  } catch (err: any) {
    console.error('Insights error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── GET /status ───────────────────────────────────────── */

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    configured: isHubSpotConfigured(),
    ai: !!config.openai.apiKey,
  });
});

export { router as salesRouter };
