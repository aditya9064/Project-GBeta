/* ═══════════════════════════════════════════════════════════
   Document Replication Agent — Upload, Analyze, Generate
   
   POST /api/documents/upload   — Upload file (base64), analyze, return templateId + fields
   POST /api/documents/analyze — Analyze only (file URL or base64)
   POST /api/documents/generate — Generate PDF from templateId + field mappings + data
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { logger } from '../services/logger.js';
import {
  extractText,
  detectVariablesWithOpenAI,
  type DetectedField,
} from '../services/document-analyzer.js';
import {
  generatePdfFromFields,
  replicatePdfFromOriginal,
  type FieldMapping,
} from '../services/document-generator.js';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';

let db: FirebaseFirestore.Firestore | null = null;
try {
  if (getApps().length === 0) initializeApp();
  db = getFirestore();
} catch { /* Firestore unavailable - use in-memory */ }

const router = Router();

/** In-memory store for uploaded templates (MVP). Key: templateId, value: { buffer, fields, fileName } */
const templateStore = new Map<
  string,
  { buffer: Buffer; fields: DetectedField[]; fileName: string; createdAt: number }
>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpired() {
  const now = Date.now();
  for (const [id, v] of templateStore.entries()) {
    if (now - v.createdAt > TTL_MS) templateStore.delete(id);
  }
}

/* ─── POST /upload ──────────────────────────────────────── */
/**
 * Upload document: accept base64 file, extract text, run AI detection, store in memory, return templateId + fields.
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    pruneExpired();
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ success: false, error: 'Request body must be JSON with fileBase64 and fileName' });
      return;
    }
    const { fileBase64, fileName, mimeType, userId } = req.body as {
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      userId?: string;
    };
    if (!fileBase64 || !fileName) {
      res.status(400).json({ success: false, error: 'fileBase64 and fileName are required' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'File too large (max 10MB)' });
      return;
    }
    if (buffer.length === 0) {
      res.status(400).json({ success: false, error: 'Invalid file: decoded size is 0' });
      return;
    }

    let text: string;
    let pages: number;
    try {
      const extracted = await extractText(buffer, mimeType || 'application/octet-stream');
      text = extracted.text ?? '';
      pages = extracted.pages ?? 1;
    } catch (extractErr) {
      const msg = extractErr instanceof Error ? extractErr.message : 'Text extraction failed';
      logger.error('Upload extractText error', { error: extractErr });
      res.status(500).json({ success: false, error: `Extraction failed: ${msg}` });
      return;
    }

    const structure = { pages, extractedText: text.slice(0, 5000) };

    let fields: DetectedField[];
    try {
      fields = await detectVariablesWithOpenAI(text, fileName);
    } catch (aiErr) {
      logger.warn('AI detection failed, using fallback fields', { error: aiErr });
      fields = [];
    }
    if (fields.length === 0 && text.trim()) {
      fields = [{
        id: `field-0-${Date.now()}`,
        name: 'Document Content',
        type: 'text',
        page: 1,
        confidence: 0.5,
        aiSuggested: true,
        userConfirmed: false,
        sampleValue: text.slice(0, 200).trim() || undefined,
      }];
    }

    const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    templateStore.set(templateId, {
      buffer,
      fields,
      fileName,
      createdAt: Date.now(),
    });

    const templateMeta = {
      id: templateId,
      userId: userId || 'anonymous',
      originalFileName: fileName,
      originalFormat: mimeType?.includes('pdf') ? 'pdf' : mimeType?.includes('word') ? 'docx' : 'txt',
      storageUrl: '',
      createdAt: new Date().toISOString(),
      fields,
      structure,
    };

    if (db) {
      try {
        await db.collection('documentTemplates').doc(templateId).set(templateMeta);
      } catch (fsErr) {
        logger.warn('Firestore template persist failed (non-fatal)', { error: fsErr });
      }
    }

    res.json({
      success: true,
      templateId,
      template: templateMeta,
      fields,
      structure,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('Documents upload error', { error: err });
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

/* ─── POST /analyze ─────────────────────────────────────── */
/**
 * Analyze only: same as upload but does not store. Returns fields + structure.
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { fileBase64, fileName, mimeType } = req.body as {
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
    };
    if (!fileBase64 || !fileName) {
      res.status(400).json({ success: false, error: 'fileBase64 and fileName are required' });
      return;
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const { text, pages } = await extractText(buffer, mimeType || 'application/octet-stream');
    const structure = { pages, extractedText: text.slice(0, 5000) };
    const fields = await detectVariablesWithOpenAI(text, fileName);

    res.json({
      success: true,
      fields,
      structure,
    });
  } catch (err) {
    logger.error('Documents analyze error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
});

/* ─── POST /generate ─────────────────────────────────────── */
/**
 * Generate PDF from templateId + field mappings + data.
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    pruneExpired();
    const { templateId, fieldMappings, data, outputFormat, fileName } = req.body as {
      templateId?: string;
      fieldMappings?: Array<{ id: string; name: string; type?: string; page?: number }>;
      data?: Record<string, string>;
      outputFormat?: string;
      fileName?: string;
    };

    if (!templateId || !fieldMappings?.length) {
      res.status(400).json({
        success: false,
        error: 'templateId and fieldMappings are required',
      });
      return;
    }

    const stored = templateStore.get(templateId);
    const mappings: FieldMapping[] = fieldMappings.map((f) => {
      const storedField = stored?.fields?.find((sf) => sf.id === f.id);
      return {
        id: f.id,
        name: f.name,
        type: f.type || 'text',
        page: f.page,
        sampleValue: storedField?.sampleValue ?? (f as { sampleValue?: string }).sampleValue,
      };
    });
    const dataRecord = typeof data === 'object' && data !== null ? data : {};
    const outFileName = fileName || `Generated_${templateId}_${Date.now()}.pdf`;
    const format = (outputFormat || 'pdf').toLowerCase();

    if (format !== 'pdf') {
      res.status(400).json({
        success: false,
        error: 'Only PDF output is supported in MVP',
      });
      return;
    }

    const useReplicate =
      stored?.buffer &&
      stored.buffer.length > 0 &&
      mappings.some((m) => m.sampleValue && (dataRecord[m.id] ?? dataRecord[m.name] ?? '').trim() !== '');

    const pdfBuffer = useReplicate
      ? await replicatePdfFromOriginal(
          stored.buffer,
          mappings,
          dataRecord,
          stored.fileName || outFileName
        )
      : await generatePdfFromFields(
          mappings,
          dataRecord,
          stored?.fileName || outFileName
        );
    const base64 = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64}`;

    res.json({
      success: true,
      generatedUrl: dataUrl,
      fileName: outFileName.replace(/\.pdf$/i, '') + '.pdf',
    });
  } catch (err) {
    logger.error('Documents generate error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    });
  }
});

/* ─── POST /generate-doc — AI-powered document generation ─── */

import { generateFullDocument, isDocGenAvailable } from '../services/document-gen.service.js';

router.post('/generate-doc', async (req: Request, res: Response) => {
  try {
    if (!isDocGenAvailable()) {
      res.status(503).json({ success: false, error: 'OpenAI not configured for document generation' });
      return;
    }

    const { templateId, answers } = req.body as { templateId?: string; answers?: Record<string, string> };
    if (!templateId || !answers) {
      res.status(400).json({ success: false, error: 'templateId and answers are required' });
      return;
    }

    const document = await generateFullDocument(templateId, answers);

    res.json({
      success: true,
      document: {
        id: document.id,
        templateId: document.templateId,
        templateName: document.templateName,
        category: document.category,
        sections: document.sections,
        totalPages: document.totalPages,
        generatedAt: document.generatedAt,
        generationTimeMs: document.generationTimeMs,
        validation: document.validation,
        pdfBase64: document.pdfBase64,
      },
    });
  } catch (err) {
    logger.error('Document generate-doc error', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Document generation failed',
    });
  }
});

router.get('/generate-doc/status', (_req: Request, res: Response) => {
  res.json({ success: true, available: isDocGenAvailable() });
});

/* ─── POST /templates/save — Save template to Firestore ─── */
router.post('/templates/save', async (req: Request, res: Response) => {
  try {
    const { templateId, name, userId, fields, structure } = req.body;
    if (!templateId || !name) {
      res.status(400).json({ success: false, error: 'templateId and name are required' });
      return;
    }
    
    const stored = templateStore.get(templateId);
    const templateData = {
      id: templateId,
      name,
      userId: userId || 'anonymous',
      fields: fields || stored?.fields || [],
      structure: structure || {},
      originalFileName: stored?.fileName || name,
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    if (db) {
      await db.collection('documentTemplates').doc(templateId).set(templateData);
    }
    
    res.json({ success: true, template: templateData });
  } catch (err) {
    logger.error('Template save error', { error: err });
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Save failed' });
  }
});

/* ─── GET /templates — List saved templates ─── */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    let templates: any[] = [];
    
    if (db) {
      let q = db.collection('documentTemplates').orderBy('savedAt', 'desc').limit(50);
      if (userId) q = q.where('userId', '==', userId) as any;
      const snapshot = await q.get();
      templates = snapshot.docs.map(doc => doc.data());
    }
    
    res.json({ success: true, templates });
  } catch (err) {
    logger.error('Templates list error', { error: err });
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'List failed' });
  }
});

/* ─── DELETE /templates/:id — Delete a saved template ─── */
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id: string = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) ?? '';
    if (db) {
      await db.collection('documentTemplates').doc(id).delete();
    }
    templateStore.delete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Delete failed' });
  }
});

/* ─── POST /history/save — Save generated document to history ─── */
router.post('/history/save', async (req: Request, res: Response) => {
  try {
    const { templateName, generatedAt, fields, userId, templateId, category, totalPages, generationTimeMs, sectionCount, validationPassed } = req.body;
    if (!templateName) {
      res.status(400).json({ success: false, error: 'templateName is required' });
      return;
    }
    
    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const historyEntry = {
      id: docId,
      userId: userId || 'anonymous',
      templateId: templateId || null,
      templateName,
      category: category || null,
      totalPages: totalPages || null,
      generatedAt: generatedAt || new Date().toISOString(),
      generationTimeMs: generationTimeMs || null,
      sectionCount: sectionCount || 0,
      fields: fields || {},
      validationPassed: validationPassed ?? true,
    };
    
    if (db) {
      await db.collection('documentHistory').doc(docId).set(historyEntry);
    }
    
    res.json({ success: true, id: docId, entry: historyEntry });
  } catch (err) {
    logger.error('History save error', { error: err });
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Save failed' });
  }
});

/* ─── GET /history — List document history ─── */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    let entries: any[] = [];
    
    if (db) {
      let q = db.collection('documentHistory').orderBy('generatedAt', 'desc').limit(50);
      if (userId) q = q.where('userId', '==', userId) as any;
      const snapshot = await q.get();
      entries = snapshot.docs.map(doc => doc.data());
    }
    
    res.json({ success: true, entries });
  } catch (err) {
    logger.error('History list error', { error: err });
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'List failed' });
  }
});

/* ─── POST /batch-generate — Batch generate documents ─── */
router.post('/batch-generate', async (req: Request, res: Response) => {
  try {
    pruneExpired();
    const { templateId, fieldMappings, batchData, fileName } = req.body as {
      templateId?: string;
      fieldMappings?: Array<{ id: string; name: string; type?: string; page?: number }>;
      batchData?: Record<string, string>[];
      fileName?: string;
    };
    
    if (!templateId || !fieldMappings?.length || !batchData?.length) {
      res.status(400).json({ success: false, error: 'templateId, fieldMappings, and batchData[] are required' });
      return;
    }
    
    if (batchData.length > 100) {
      res.status(400).json({ success: false, error: 'Maximum 100 documents per batch' });
      return;
    }
    
    const stored = templateStore.get(templateId);
    const results: { index: number; success: boolean; fileName?: string; generatedUrl?: string; error?: string }[] = [];
    
    for (let i = 0; i < batchData.length; i++) {
      try {
        const data = batchData[i];
        const mappings = fieldMappings.map(f => {
          const storedField = stored?.fields?.find(sf => sf.id === f.id);
          return {
            id: f.id, name: f.name, type: f.type || 'text', page: f.page,
            sampleValue: storedField?.sampleValue,
          };
        });
        
        const outFileName = `${fileName || 'Batch'}_${i + 1}.pdf`;
        
        const useReplicate = stored?.buffer && stored.buffer.length > 0 &&
          mappings.some(m => m.sampleValue && (data[m.id] ?? data[m.name] ?? '').trim() !== '');
        
        const { replicatePdfFromOriginal, generatePdfFromFields } = await import('../services/document-generator.js');
        
        const pdfBuffer = useReplicate
          ? await replicatePdfFromOriginal(stored!.buffer, mappings, data, outFileName)
          : await generatePdfFromFields(mappings, data, outFileName);
        
        const base64 = pdfBuffer.toString('base64');
        results.push({
          index: i,
          success: true,
          fileName: outFileName,
          generatedUrl: `data:application/pdf;base64,${base64}`,
        });
      } catch (err) {
        results.push({
          index: i,
          success: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      }
    }
    
    res.json({
      success: true,
      total: batchData.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err) {
    logger.error('Batch generate error', { error: err });
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Batch failed' });
  }
});

export { router as documentsRouter };
