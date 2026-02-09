/* ═══════════════════════════════════════════════════════════
   AI Engine Routes
   
   POST /api/ai/analyze   — Analyze a message (intent, sentiment, etc.)
   POST /api/ai/generate  — Generate a response for arbitrary text
   GET  /api/ai/config    — Get AI engine configuration
   PUT  /api/ai/config    — Update AI engine configuration
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { AIEngine } from '../services/ai-engine.js';
import { StyleAnalyzer } from '../services/style-analyzer.js';
import type { UnifiedMessage, AIResponseConfig } from '../types.js';

const router = Router();

/* ─── POST /api/ai/analyze ─────────────────────────────── */

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const message = req.body.message as UnifiedMessage;
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    // Use quick analysis (heuristic) for speed, or full analysis with AI
    const useAI = req.query.full === 'true';
    const analysis = useAI
      ? await AIEngine.analyze(message)
      : AIEngine.quickAnalyze(message);

    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
});

/* ─── POST /api/ai/generate ────────────────────────────── */

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { message, feedback } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const result = feedback
      ? await AIEngine.regenerateWithFeedback(message, feedback)
      : await AIEngine.generateResponse(message);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    });
  }
});

/* ─── GET /api/ai/config ──────────────────────────────── */

router.get('/config', (_req: Request, res: Response) => {
  res.json({ success: true, data: AIEngine.getConfig() });
});

/* ─── PUT /api/ai/config ──────────────────────────────── */

router.put('/config', (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<AIResponseConfig>;
    AIEngine.updateConfig(updates);
    res.json({ success: true, data: AIEngine.getConfig() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update config',
    });
  }
});

/* ─── POST /api/ai/analyze-style ──────────────────────── */

router.post('/analyze-style', async (req: Request, res: Response) => {
  try {
    const messages = req.body.messages as UnifiedMessage[];
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: 'Messages array is required' });
      return;
    }

    const { profiles, result } = await StyleAnalyzer.analyzeMessages(messages);

    // Store profiles in the AI engine for future draft generation
    AIEngine.setStyleProfiles(profiles);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Style analysis failed',
    });
  }
});

export { router as aiRouter };

