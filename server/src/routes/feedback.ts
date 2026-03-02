/* ═══════════════════════════════════════════════════════════
   Feedback Routes — Collect and analyze execution feedback

   POST   /api/feedback                — Submit execution feedback
   GET    /api/feedback/agent/:agentId — Get feedback for an agent
   GET    /api/feedback/crew/:crewId   — Get feedback for a crew
   GET    /api/feedback/patterns/:agentId — Get improvement patterns
   GET    /api/feedback/stats/:agentId — Get aggregate stats
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { FeedbackStore, type ExecutionFeedback } from '../services/feedbackStore.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── POST /api/feedback — Submit feedback ─────────────────── */

router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      id, 
      executionId, 
      agentId, 
      crewId, 
      userId,
      outcome, 
      userCorrections, 
      rating, 
      feedbackText 
    } = req.body;

    if (!executionId || !agentId || !outcome) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: executionId, agentId, outcome' 
      });
      return;
    }

    const validOutcomes = ['success', 'failure', 'partial', 'user_corrected'];
    if (!validOutcomes.includes(outcome)) {
      res.status(400).json({ 
        success: false, 
        error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` 
      });
      return;
    }

    const feedback: ExecutionFeedback = {
      id: id || `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      executionId,
      agentId,
      outcome,
      timestamp: new Date().toISOString(),
    };
    
    // Only add optional fields if they have values
    if (crewId) feedback.crewId = crewId;
    if (userId) feedback.userId = userId;
    if (userCorrections) feedback.userCorrections = userCorrections;
    if (rating !== undefined) feedback.rating = Number(rating);
    if (feedbackText) feedback.feedbackText = feedbackText;

    await FeedbackStore.save(feedback);

    logger.info(`📝 Feedback submitted for agent ${agentId}: ${outcome}`);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    logger.error('Feedback submit error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit feedback',
    });
  }
});

/* ─── GET /api/feedback/agent/:agentId — Get agent feedback ── */

router.get('/agent/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = String(req.params.agentId);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    
    const feedback = await FeedbackStore.getByAgent(agentId, limit);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    logger.error('Get agent feedback error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get feedback',
    });
  }
});

/* ─── GET /api/feedback/crew/:crewId — Get crew feedback ───── */

router.get('/crew/:crewId', async (req: Request, res: Response) => {
  try {
    const crewId = String(req.params.crewId);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    
    const feedback = await FeedbackStore.getByCrew(crewId, limit);

    res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    logger.error('Get crew feedback error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get feedback',
    });
  }
});

/* ─── GET /api/feedback/patterns/:agentId — Get patterns ───── */

router.get('/patterns/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = String(req.params.agentId);
    const patterns = await FeedbackStore.analyzePatterns(agentId);

    res.json({
      success: true,
      data: patterns,
    });
  } catch (err) {
    logger.error('Get patterns error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to analyze patterns',
    });
  }
});

/* ─── GET /api/feedback/stats/:agentId — Get aggregate stats ── */

router.get('/stats/:agentId', async (req: Request, res: Response) => {
  try {
    const agentId = String(req.params.agentId);
    const stats = await FeedbackStore.getStats(agentId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    logger.error('Get stats error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get stats',
    });
  }
});

export { router as feedbackRouter };
