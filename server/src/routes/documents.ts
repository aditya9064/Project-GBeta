/* ═══════════════════════════════════════════════════════════
   Document Replication Agent — Upload, Analyze, Generate
   
   POST /api/documents/upload   — Upload file (base64), analyze, return templateId + fields
   POST /api/documents/analyze — Analyze only (file URL or base64)
   POST /api/documents/generate — Generate PDF from templateId + field mappings + data
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
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
      console.error('Upload extractText error:', extractErr);
      res.status(500).json({ success: false, error: `Extraction failed: ${msg}` });
      return;
    }

    const structure = { pages, extractedText: text.slice(0, 5000) };

    let fields: DetectedField[];
    try {
      fields = await detectVariablesWithOpenAI(text, fileName);
    } catch (aiErr) {
      console.warn('AI detection failed, using fallback fields:', aiErr);
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

    res.json({
      success: true,
      templateId,
      template: {
        id: templateId,
        userId: userId || 'anonymous',
        originalFileName: fileName,
        originalFormat: mimeType?.includes('pdf') ? 'pdf' : mimeType?.includes('word') ? 'docx' : 'txt',
        storageUrl: '',
        createdAt: Date.now(),
        fields,
        structure,
      },
      fields,
      structure,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Documents upload error:', message, stack || '');
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
    console.error('Documents analyze error:', err);
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
    console.error('Documents generate error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    });
  }
});

export { router as documentsRouter };
