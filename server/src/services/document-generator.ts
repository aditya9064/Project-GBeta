/**
 * Document Generator — Produce PDF (and later DOCX) from template fields + data.
 * Can replicate the original PDF with only variable text replaced (overlay).
 */

import { createRequire } from 'node:module';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const require = createRequire(import.meta.url);

export interface FieldMapping {
  id: string;
  name: string;
  type: string;
  page?: number;
  sampleValue?: string;
}

interface TextPosition {
  pageIndex: number; // 0-based
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Replicate the original PDF: keep full layout and replace only the variable
 * regions (found by sampleValue) with the new values from data.
 */
export async function replicatePdfFromOriginal(
  originalPdfBuffer: Buffer,
  fields: FieldMapping[],
  data: Record<string, string>,
  _fileName: string
): Promise<Buffer> {
  const doc = await PDFDocument.load(originalPdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;

  // Get text positions from PDF.js for each field that has sampleValue
  const positionsByFieldId = await getTextPositionsFromPdf(originalPdfBuffer, fields);
  if (positionsByFieldId.size === 0) {
    // Fallback: return original unchanged if we couldn't find any text to replace
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  for (const field of fields) {
    const newValue = (data[field.id] ?? data[field.name] ?? '').trim();
    const pos = positionsByFieldId.get(field.id);
    if (!pos || newValue === '') continue;

    const page = pages[pos.pageIndex];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    // PDF y is from bottom; ensure we don't draw outside page
    const y = Math.max(0, Math.min(pos.y, pageHeight - 20));
    const pad = 2;
    const rectWidth = Math.min(pos.width + pad * 2, pageWidth - pos.x);
    const rectHeight = Math.min(pos.height + pad * 2, 24);

    // White overlay over old text
    page.drawRectangle({
      x: pos.x - pad,
      y: y - pad,
      width: rectWidth,
      height: rectHeight,
      color: rgb(1, 1, 1),
      opacity: 1,
    });
    // New text (clip to one line for simplicity)
    const line = newValue.replace(/\s+/g, ' ').slice(0, 80);
    page.drawText(line, {
      x: pos.x,
      y,
      size: fontSize,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function getTextPositionsFromPdf(
  buffer: Buffer,
  fields: FieldMapping[]
): Promise<Map<string, TextPosition>> {
  const result = new Map<string, TextPosition>();
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    if (typeof pdfjsLib.GlobalWorkerOptions !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (const field of fields) {
      const searchText = normalizeForSearch(field.sampleValue ?? '');
      if (!searchText) continue;

      for (let pageIndex = 0; pageIndex < numPages; pageIndex++) {
        const page = await pdfDoc.getPage(pageIndex + 1);
        const textContent = await page.getTextContent();
        const items = textContent.items as Array<{ str: string; transform: number[]; width?: number; height?: number }>;

        const parts: string[] = [];
        for (const it of items) parts.push((it.str ?? '').trim());
        const fullText = parts.join(' ');
        const normalizedFull = normalizeForSearch(fullText);
        const idx = normalizedFull.indexOf(searchText);
        if (idx === -1) continue;

        // Map character range [idx, idx+searchText.length] back to item indices
        let charCount = 0;
        let startItemIdx = 0;
        let endItemIdx = 0;
        for (let i = 0; i < parts.length; i++) {
          const partNorm = normalizeForSearch(parts[i]);
          const nextCount = charCount + (partNorm.length + (i > 0 ? 1 : 0));
          if (charCount <= idx && idx < nextCount) startItemIdx = i;
          if (charCount < idx + searchText.length && idx + searchText.length <= nextCount) {
            endItemIdx = i;
            break;
          }
          charCount = nextCount;
          endItemIdx = i;
        }

        const itemsToUse = items.slice(startItemIdx, endItemIdx + 1);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const it of itemsToUse) {
          const t = it.transform || [];
          const x = t[4] ?? 0;
          const y = t[5] ?? 0;
          const w = (it.width ?? 0) * (t[0] ?? 1);
          const h = (it.height ?? 12) * (t[3] ?? 1);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        }
        if (minX !== Infinity) {
          result.set(field.id, {
            pageIndex,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          });
          break; // one position per field (first page where found)
        }
      }
    }
  } catch (e) {
    console.warn('getTextPositionsFromPdf failed, falling back to simple PDF:', e);
  }
  return result;
}

function normalizeForSearch(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Generate a simple PDF document listing all field names and their values.
 * Phase 2 can overlay onto the original template PDF for exact layout.
 */
export async function generatePdfFromFields(
  fields: FieldMapping[],
  data: Record<string, string>,
  fileName: string
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 18;
  const titleSize = 16;
  const bodySize = 11;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin - 40;

  const drawText = (text: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) => {
    const size = opts.size ?? bodySize;
    const fontToUse = opts.bold ? bold : font;
    const indent = opts.indent ?? 0;
    const lines = wrapText(text, fontToUse, size, pageWidth - margin * 2 - indent);
    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin - 20;
      }
      page.drawText(line, {
        x: margin + indent,
        y,
        size,
        font: fontToUse,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= lineHeight;
    }
  };

  page.drawText(fileName || 'Generated Document', {
    x: margin,
    y: pageHeight - margin - 24,
    size: titleSize,
    font: bold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y = pageHeight - margin - 56;

  page.drawText(`Generated: ${new Date().toISOString().slice(0, 10)}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= lineHeight * 1.5;

  for (const field of fields) {
    const value = data[field.id] ?? data[field.name] ?? '';
    if (y < margin + lineHeight * 2) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 20;
    }
    drawText(`${field.name}:`, { bold: true });
    drawText(value || '(empty)', { indent: 16 });
    y -= 4;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, size: number) => number },
  size: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const words = text.split(/\s+/);
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}
