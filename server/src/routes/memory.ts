/* ═══════════════════════════════════════════════════════════
   Memory API Routes
   
   Exposes the memory system via REST API following
   claude-mem's 3-layer search pattern:
   
   POST /sessions          → start a memory session
   POST /sessions/:id/end  → end session + auto-summarize
   POST /observe            → capture an observation
   GET  /search             → Layer 1: compact index
   GET  /timeline           → Layer 2: chronological context
   POST /details            → Layer 3: full observation data
   GET  /context            → get context for new session
   GET  /sessions           → list user sessions
   GET  /sessions/:id       → get session with observations
   GET  /stats              → memory statistics
   ═══════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { Memory } from '../services/memory/index.js';
import { logger } from '../services/logger.js';
import type { ObservationInput, SummaryInput, SearchQuery } from '../services/memory/types.js';

export const memoryRouter = Router();

/* ─── Session Management ──────────────────────────────── */

memoryRouter.post('/sessions', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { agentType, project, userPrompt, title, metadata, sessionId } = req.body;
    if (!agentType || !userPrompt) {
      return res.status(400).json({ error: 'agentType and userPrompt are required' });
    }

    const session = await Memory.startSession({
      userId,
      agentType,
      project,
      userPrompt,
      title,
      metadata,
      sessionId,
    });

    res.json({ success: true, session });
  } catch (err) {
    logger.error(`[Memory API] Start session error: ${err}`);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

memoryRouter.post('/sessions/:id/end', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const summary: SummaryInput | undefined = req.body.summary;

    const result = await Memory.endSession(id, summary);
    res.json({ success: true, summary: result });
  } catch (err) {
    logger.error(`[Memory API] End session error: ${err}`);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

memoryRouter.get('/sessions', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const sessions = await Memory.getSessions(userId, limit, offset);
    res.json({ success: true, sessions });
  } catch (err) {
    logger.error(`[Memory API] List sessions error: ${err}`);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

memoryRouter.get('/sessions/:id', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const [session, observations, summary] = await Promise.all([
      Memory.startSession({ userId, agentType: '', userPrompt: '', sessionId: id }),
      Memory.getSessionObservations(id),
      Memory.getSessionSummary(id),
    ]);

    res.json({ success: true, session, observations, summary });
  } catch (err) {
    logger.error(`[Memory API] Get session error: ${err}`);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/* ─── Observation Capture ─────────────────────────────── */

memoryRouter.post('/observe', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { sessionId, project, observation, promptNumber } = req.body;
    if (!sessionId || !observation?.type || !observation?.title) {
      return res.status(400).json({
        error: 'sessionId and observation (with type, title) are required',
      });
    }

    const result = await Memory.observe(
      sessionId,
      userId,
      project || 'default',
      observation as ObservationInput,
      promptNumber
    );

    res.json({ success: true, observation: result });
  } catch (err) {
    logger.error(`[Memory API] Observe error: ${err}`);
    res.status(500).json({ error: 'Failed to store observation' });
  }
});

/* ─── Search (3-Layer Pattern) ────────────────────────── */

memoryRouter.get('/search', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const query: SearchQuery = {
      query: (req.query.q as string) || '',
      userId,
      project: req.query.project as string,
      type: req.query.type as any,
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    };

    if (!query.query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await Memory.search(query);
    res.json({ success: true, results, count: results.length });
  } catch (err) {
    logger.error(`[Memory API] Search error: ${err}`);
    res.status(500).json({ error: 'Failed to search memory' });
  }
});

memoryRouter.get('/timeline', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const aroundObservationId = req.query.observationId as string;
    const aroundTimestamp = req.query.timestamp
      ? parseInt(req.query.timestamp as string)
      : undefined;
    const windowMs = req.query.windowMs
      ? parseInt(req.query.windowMs as string)
      : undefined;
    const limit = parseInt(req.query.limit as string) || 30;

    const entries = await Memory.timeline(userId, {
      aroundObservationId,
      aroundTimestamp,
      windowMs,
      limit,
    });

    res.json({ success: true, timeline: entries, count: entries.length });
  } catch (err) {
    logger.error(`[Memory API] Timeline error: ${err}`);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

memoryRouter.post('/details', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const observations = await Memory.getDetails(ids);
    res.json({ success: true, observations });
  } catch (err) {
    logger.error(`[Memory API] Details error: ${err}`);
    res.status(500).json({ error: 'Failed to get observation details' });
  }
});

/* ─── Context Generation ──────────────────────────────── */

memoryRouter.get('/context', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const project = req.query.project as string;
    const agentType = req.query.agentType as string;
    const query = req.query.q as string;
    const maxObservations = req.query.maxObservations
      ? parseInt(req.query.maxObservations as string)
      : undefined;
    const maxSummaries = req.query.maxSummaries
      ? parseInt(req.query.maxSummaries as string)
      : undefined;

    const context = await Memory.getContext(userId, {
      project,
      agentType,
      query,
      maxObservations,
      maxSummaries,
    });

    res.json({ success: true, context });
  } catch (err) {
    logger.error(`[Memory API] Context error: ${err}`);
    res.status(500).json({ error: 'Failed to generate context' });
  }
});

memoryRouter.get('/context/prompt', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const project = req.query.project as string;
    const maxTokens = parseInt(req.query.maxTokens as string) || 2000;

    const promptContext = await Memory.getPromptContext(userId, project, maxTokens);
    res.json({ success: true, promptContext });
  } catch (err) {
    logger.error(`[Memory API] Prompt context error: ${err}`);
    res.status(500).json({ error: 'Failed to generate prompt context' });
  }
});

/* ─── Stats ───────────────────────────────────────────── */

memoryRouter.get('/stats', async (req, res) => {
  try {
    const userId = (req as any).uid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const stats = await Memory.getStats(userId);
    res.json({ success: true, stats });
  } catch (err) {
    logger.error(`[Memory API] Stats error: ${err}`);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
