/* ═══════════════════════════════════════════════════════════
   Analytics Routes — Reports and insights
   
   GET  /api/analytics/quick-stats   — Quick dashboard stats
   GET  /api/analytics/report        — Generate full report
   GET  /api/analytics/report/pdf    — Generate PDF report
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/analytics/quick-stats — Dashboard stats ─────── */

router.get('/quick-stats', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const stats = await AnalyticsService.getQuickStats(userId);
    res.json({ success: true, data: stats });
  } catch (err) {
    logger.error('Get quick stats error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get stats',
    });
  }
});

/* ─── GET /api/analytics/report — Generate report ──────────── */

router.get('/report', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const startDate = (req.query.startDate as string) || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || 
      new Date().toISOString().split('T')[0];

    const report = await AnalyticsService.generateReport({
      userId,
      startDate,
      endDate,
    });

    res.json({ success: true, data: report });
  } catch (err) {
    logger.error('Generate report error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate report',
    });
  }
});

/* ─── GET /api/analytics/report/pdf — Generate PDF ─────────── */

router.get('/report/pdf', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const startDate = (req.query.startDate as string) || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || 
      new Date().toISOString().split('T')[0];

    const report = await AnalyticsService.generateReport({
      userId,
      startDate,
      endDate,
    });

    const markdown = AnalyticsService.reportToMarkdown(report);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=workforce-report-${startDate}-${endDate}.md`);
    res.send(markdown);
  } catch (err) {
    logger.error('Generate PDF error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate PDF',
    });
  }
});

/* ─── GET /api/analytics/report/markdown — Markdown report ── */

router.get('/report/markdown', async (req: Request, res: Response) => {
  try {
    const userId = req.userId || '';
    const startDate = (req.query.startDate as string) || 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || 
      new Date().toISOString().split('T')[0];

    const report = await AnalyticsService.generateReport({
      userId,
      startDate,
      endDate,
    });

    const markdown = AnalyticsService.reportToMarkdown(report);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=workforce-report-${startDate}-${endDate}.md`);
    res.send(markdown);
  } catch (err) {
    logger.error('Generate markdown error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate report',
    });
  }
});

export { router as analyticsRouter };
