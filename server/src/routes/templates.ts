/* ═══════════════════════════════════════════════════════════
   Template Routes — Agent template library and sharing
   
   GET    /api/templates              — List/search templates
   GET    /api/templates/popular      — Get popular templates
   GET    /api/templates/categories   — Get categories with counts
   GET    /api/templates/:id          — Get single template
   POST   /api/templates              — Create template
   PUT    /api/templates/:id          — Update template
   DELETE /api/templates/:id          — Delete template
   POST   /api/templates/:id/publish  — Publish template
   POST   /api/templates/:id/rate     — Rate template
   POST   /api/templates/:id/use      — Record template usage
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { TemplateStore, type TemplateCategory } from '../services/templateStore.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/templates — List/search templates ───────────── */

router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const tags = req.query.tags as string | undefined;
    const visibility = req.query.visibility as string | undefined;
    const authorId = req.query.authorId as string | undefined;
    const teamId = req.query.teamId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit as string | undefined;

    const filters = {
      category: category as TemplateCategory | undefined,
      tags: tags ? tags.split(',') : undefined,
      visibility: visibility as 'private' | 'team' | 'public' | undefined,
      authorId,
      teamId,
      search,
    };

    const templates = await TemplateStore.list(filters, Number(limit) || 50);
    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error('List templates error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list templates',
    });
  }
});

/* ─── GET /api/templates/popular — Popular templates ───────── */

router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit as string) || 10;
    const templates = await TemplateStore.getPopular(limit);
    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error('Get popular templates error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get popular templates',
    });
  }
});

/* ─── GET /api/templates/top-rated — Top rated templates ──── */

router.get('/top-rated', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit as string) || 10;
    const templates = await TemplateStore.getTopRated(limit);
    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error('Get top rated templates error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get top rated templates',
    });
  }
});

/* ─── GET /api/templates/categories — Category counts ──────── */

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await TemplateStore.getCategoryCounts();
    res.json({ success: true, data: categories });
  } catch (err) {
    logger.error('Get categories error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get categories',
    });
  }
});

/* ─── GET /api/templates/:id — Get single template ─────────── */

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await TemplateStore.get(req.params.id as string);
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    
    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('Get template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get template',
    });
  }
});

/* ─── POST /api/templates — Create template ────────────────── */

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      icon,
      color,
      workflow,
      settings,
      category,
      tags,
      capabilities,
      authorId,
      authorName,
      visibility,
      teamId,
      version,
      changelog,
    } = req.body;

    if (!name || !description || !workflow || !category || !authorId || !authorName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, workflow, category, authorId, authorName',
      });
      return;
    }

    const template = await TemplateStore.create({
      name,
      description,
      icon,
      color,
      workflow,
      settings,
      category,
      tags: tags || [],
      capabilities: capabilities || [],
      authorId,
      authorName,
      visibility: visibility || 'private',
      teamId,
      version: version || '1.0.0',
      changelog,
    });

    logger.info(`📦 Template created: ${name} by ${authorName}`);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    logger.error('Create template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create template',
    });
  }
});

/* ─── PUT /api/templates/:id — Update template ─────────────── */

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const template = await TemplateStore.update(req.params.id as string, updates);
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    
    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('Update template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update template',
    });
  }
});

/* ─── DELETE /api/templates/:id — Delete template ──────────── */

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await TemplateStore.delete(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete template',
    });
  }
});

/* ─── POST /api/templates/:id/publish — Publish template ───── */

router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const template = await TemplateStore.publish(req.params.id as string);
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    
    logger.info(`📢 Template published: ${template.name}`);
    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('Publish template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to publish template',
    });
  }
});

/* ─── POST /api/templates/:id/unpublish — Unpublish template ─ */

router.post('/:id/unpublish', async (req: Request, res: Response) => {
  try {
    const template = await TemplateStore.unpublish(req.params.id as string);
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    
    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('Unpublish template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unpublish template',
    });
  }
});

/* ─── POST /api/templates/:id/rate — Rate template ─────────── */

router.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const { rating } = req.body;
    
    if (rating === undefined || rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
      return;
    }
    
    const template = await TemplateStore.rate(req.params.id as string, Number(rating));
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    
    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('Rate template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to rate template',
    });
  }
});

/* ─── POST /api/templates/:id/use — Record usage ───────────── */

router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    await TemplateStore.recordUsage(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Record usage error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record usage',
    });
  }
});

/* ─── GET /api/templates/featured — Featured templates ──────── */

router.get('/featured', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit as string) || 6;
    const templates = await TemplateStore.getFeatured(limit);
    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error('Get featured templates error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get featured templates',
    });
  }
});

/* ─── GET /api/templates/recent — Recently published ─────────── */

router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit as string) || 10;
    const templates = await TemplateStore.getRecent(limit);
    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error('Get recent templates error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get recent templates',
    });
  }
});

/* ─── POST /api/templates/:id/clone — Clone template ─────────── */

router.post('/:id/clone', async (req: Request, res: Response) => {
  try {
    const { userId, userName } = req.body;

    if (!userId || !userName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userName',
      });
      return;
    }

    const template = await TemplateStore.clone(req.params.id as string, userId, userName);

    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    logger.info(`📋 Template cloned: ${template.name} by ${userName}`);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    logger.error('Clone template error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clone template',
    });
  }
});

/* ─── GET /api/templates/:id/reviews — Get reviews ───────────── */

router.get('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit as string) || 20;
    const reviews = await TemplateStore.getReviews(req.params.id as string, limit);
    res.json({ success: true, data: reviews });
  } catch (err) {
    logger.error('Get reviews error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get reviews',
    });
  }
});

/* ─── POST /api/templates/:id/reviews — Add review ───────────── */

router.post('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { userId, userName, rating, title, content } = req.body;

    if (!userId || !userName || rating === undefined || !title || !content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, userName, rating, title, content',
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      });
      return;
    }

    const review = await TemplateStore.addReview(req.params.id as string, {
      userId,
      userName,
      rating,
      title,
      content,
    });

    logger.info(`📝 Review added to template ${req.params.id} by ${userName}`);
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    logger.error('Add review error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add review',
    });
  }
});

/* ─── POST /api/templates/reviews/:reviewId/helpful — Mark helpful ─ */

router.post('/reviews/:reviewId/helpful', async (req: Request, res: Response) => {
  try {
    const review = await TemplateStore.markReviewHelpful(req.params.reviewId as string);

    if (!review) {
      res.status(404).json({ success: false, error: 'Review not found' });
      return;
    }

    res.json({ success: true, data: review });
  } catch (err) {
    logger.error('Mark review helpful error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to mark review as helpful',
    });
  }
});

export { router as templatesRouter };
