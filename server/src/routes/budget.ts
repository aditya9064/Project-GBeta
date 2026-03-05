/* ═══════════════════════════════════════════════════════════
   Budget Routes — Cost tracking and budget management
   
   GET    /api/budget/:userId           — Get user budget
   PUT    /api/budget/:userId           — Update budget settings
   GET    /api/budget/:userId/summary   — Get spending summary
   GET    /api/budget/:userId/entries   — Get cost entries
   POST   /api/budget/:userId/cost      — Record a cost entry
   GET    /api/budget/:userId/can-execute — Check if execution allowed
   POST   /api/budget/:userId/agent/:agentId — Set agent budget
   POST   /api/budget/:userId/crew/:crewId   — Set crew budget
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { BudgetStore } from '../services/budgetStore.js';
import { logger } from '../services/logger.js';
import { validate } from '../middleware/validate.js';
import { budgetUpdateSchema, budgetRecordCostSchema, budgetSetLimitSchema, budgetCalculateSchema } from '../middleware/schemas.js';

const router = Router();

/* ─── GET /api/budget/:userId — Get user budget ────────────── */

router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const budget = await BudgetStore.getBudget(req.params.userId as string);
    res.json({ success: true, data: budget });
  } catch (err) {
    logger.error('Get budget error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get budget',
    });
  }
});

/* ─── PUT /api/budget/:userId — Update budget settings ─────── */

router.put('/:userId', validate(budgetUpdateSchema), async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const budget = await BudgetStore.updateBudget(req.params.userId as string, updates);
    res.json({ success: true, data: budget });
  } catch (err) {
    logger.error('Update budget error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update budget',
    });
  }
});

/* ─── GET /api/budget/:userId/summary — Spending summary ───── */

router.get('/:userId/summary', async (req: Request, res: Response) => {
  try {
    const summary = await BudgetStore.getSpendingSummary(req.params.userId as string);
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('Get summary error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get summary',
    });
  }
});

/* ─── GET /api/budget/:userId/entries — Cost entries ───────── */

router.get('/:userId/entries', async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const limit = parseInt((req.query.limit as string) || '100', 10);
    
    const entries = await BudgetStore.getCostEntries(req.params.userId as string, since, limit);
    res.json({ success: true, data: entries });
  } catch (err) {
    logger.error('Get entries error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get entries',
    });
  }
});

/* ─── POST /api/budget/:userId/cost — Record cost entry ────── */

router.post('/:userId/cost', validate(budgetRecordCostSchema), async (req: Request, res: Response) => {
  try {
    const { agentId, agentName, crewId, crewName, executionId, category, amount, description, metadata } = req.body;
    
    const entry = await BudgetStore.recordCost({
      userId: req.params.userId as string,
      agentId,
      agentName,
      crewId,
      crewName,
      executionId,
      category,
      amount: Number(amount),
      description,
      metadata,
    });
    
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    logger.error('Record cost error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record cost',
    });
  }
});

/* ─── GET /api/budget/:userId/can-execute — Check if allowed ─ */

router.get('/:userId/can-execute', async (req: Request, res: Response) => {
  try {
    const estimatedCost = Number((req.query.cost as string) || 0);
    const agentId = req.query.agentId as string | undefined;
    const crewId = req.query.crewId as string | undefined;
    
    const result = await BudgetStore.canExecute(req.params.userId as string, estimatedCost, agentId, crewId);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Can execute check error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check budget',
    });
  }
});

/* ─── POST /api/budget/:userId/agent/:agentId — Set agent budget */

router.post('/:userId/agent/:agentId', validate(budgetSetLimitSchema), async (req: Request, res: Response) => {
  try {
    const { budget } = req.body;
    
    await BudgetStore.setAgentBudget(req.params.userId as string, req.params.agentId as string, Number(budget));
    res.json({ success: true });
  } catch (err) {
    logger.error('Set agent budget error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to set agent budget',
    });
  }
});

/* ─── POST /api/budget/:userId/crew/:crewId — Set crew budget ─ */

router.post('/:userId/crew/:crewId', validate(budgetSetLimitSchema), async (req: Request, res: Response) => {
  try {
    const { budget } = req.body;
    
    await BudgetStore.setCrewBudget(req.params.userId as string, req.params.crewId as string, Number(budget));
    res.json({ success: true });
  } catch (err) {
    logger.error('Set crew budget error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to set crew budget',
    });
  }
});

/* ─── POST /api/budget/calculate — Calculate token cost ─────── */

router.post('/calculate', validate(budgetCalculateSchema), async (req: Request, res: Response) => {
  try {
    const { model, inputTokens, outputTokens } = req.body;
    
    const cost = BudgetStore.calculateTokenCost(model, Number(inputTokens), Number(outputTokens));
    res.json({ success: true, data: { cost } });
  } catch (err) {
    logger.error('Calculate cost error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to calculate cost',
    });
  }
});

export { router as budgetRouter };
