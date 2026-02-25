/**
 * Local PDF Generator
 *
 * Generates professional PDFs that replicate the structure of the original
 * uploaded document, substituting detected variable fields with user-provided data
 * and embedding selected images/logos.
 */

import jsPDF from 'jspdf';
import type { DetectedField } from './types';
import type { ExtractedImage } from './localAnalyzer';

interface GenerateOptions {
  fields: DetectedField[];
  data: Record<string, string>;
  images: ExtractedImage[];
  documentType: string;
  extractedText: string;
  pages: number;
}

// ─── Document type → professional styling ──────────────────────

interface DocStyle {
  headerColor: [number, number, number];
  accentColor: [number, number, number];
  titleFontSize: number;
  bodyFontSize: number;
  headerText: string;
  includeTableFormat: boolean;
  includeSignatureBlock: boolean;
}

const DOC_STYLES: Record<string, DocStyle> = {
  'Invoice': {
    headerColor: [30, 30, 46],
    accentColor: [224, 122, 58],
    titleFontSize: 22,
    bodyFontSize: 10,
    headerText: 'INVOICE',
    includeTableFormat: true,
    includeSignatureBlock: false,
  },
  'Lease Agreement': {
    headerColor: [20, 20, 40],
    accentColor: [45, 85, 155],
    titleFontSize: 18,
    bodyFontSize: 10,
    headerText: 'LEASE AGREEMENT',
    includeTableFormat: false,
    includeSignatureBlock: true,
  },
  'Service Agreement': {
    headerColor: [20, 20, 40],
    accentColor: [45, 120, 85],
    titleFontSize: 18,
    bodyFontSize: 10,
    headerText: 'MASTER SERVICE AGREEMENT',
    includeTableFormat: false,
    includeSignatureBlock: true,
  },
  'Employment Agreement': {
    headerColor: [25, 25, 50],
    accentColor: [100, 60, 150],
    titleFontSize: 18,
    bodyFontSize: 10,
    headerText: 'EMPLOYMENT AGREEMENT',
    includeTableFormat: false,
    includeSignatureBlock: true,
  },
  'Certificate of Insurance': {
    headerColor: [30, 60, 30],
    accentColor: [40, 120, 70],
    titleFontSize: 16,
    bodyFontSize: 9,
    headerText: 'CERTIFICATE OF INSURANCE',
    includeTableFormat: true,
    includeSignatureBlock: false,
  },
  'Proposal': {
    headerColor: [224, 122, 58],
    accentColor: [224, 122, 58],
    titleFontSize: 20,
    bodyFontSize: 10,
    headerText: 'PROPOSAL',
    includeTableFormat: true,
    includeSignatureBlock: true,
  },
};

const DEFAULT_STYLE: DocStyle = {
  headerColor: [30, 30, 46],
  accentColor: [224, 122, 58],
  titleFontSize: 18,
  bodyFontSize: 10,
  headerText: 'DOCUMENT',
  includeTableFormat: false,
  includeSignatureBlock: false,
};

export function generateLocalPDF(options: GenerateOptions): Blob {
  const { fields, data, images, documentType, extractedText, pages } = options;
  const style = DOC_STYLES[documentType] || DEFAULT_STYLE;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = 215.9;
  const H = 279.4;
  const ML = 22;
  const MR = 22;
  const MT = 20;
  const MB = 25;
  const CW = W - ML - MR;

  let y = MT;
  let pageNum = 1;

  // ─── Helper functions ──────────────────────────────────

  function newPage() {
    addFooter();
    pdf.addPage();
    pageNum++;
    y = MT;
    addRunningHeader();
  }

  function checkBreak(needed: number) {
    if (y + needed > H - MB) newPage();
  }

  function addRunningHeader() {
    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 160);
    pdf.setFont('helvetica', 'normal');
    pdf.text(style.headerText, ML, MT - 6);
    pdf.text('CONFIDENTIAL', W - MR, MT - 6, { align: 'right' });
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(ML, MT - 3, W - MR, MT - 3);
  }

  function addFooter() {
    const fy = H - MB + 8;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(ML, fy - 5, W - MR, fy - 5);
    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 160);
    pdf.setFont('helvetica', 'normal');

    const companyName = data[fields.find(f =>
      f.name.toLowerCase().includes('company') ||
      f.name.toLowerCase().includes('from')
    )?.id || ''] || documentType;

    pdf.text(`Confidential — ${companyName}`, ML, fy);
    pdf.text(`Page ${pageNum}`, W - MR, fy, { align: 'right' });
  }

  function writeText(text: string, opts: {
    size?: number; style?: string; color?: [number, number, number];
    indent?: number; after?: number; align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  } = {}) {
    const sz = opts.size || style.bodyFontSize;
    const st = opts.style || 'normal';
    const col = opts.color || [30, 30, 30];
    const ind = opts.indent || 0;
    const after = opts.after ?? 2;
    const align = opts.align || 'left';
    const mw = (opts.maxWidth || CW) - ind;

    pdf.setFontSize(sz);
    pdf.setFont('helvetica', st);
    pdf.setTextColor(col[0], col[1], col[2]);

    const lines = pdf.splitTextToSize(text, mw);
    const lh = (sz * 1.45) / 2.835;

    for (const line of lines) {
      checkBreak(lh);
      const x = align === 'center' ? W / 2 : align === 'right' ? W - MR : ML + ind;
      pdf.text(line, x, y, { align });
      y += lh;
    }
    y += after;
  }

  function addImage(img: ExtractedImage, maxW: number, maxH: number, align: 'left' | 'center' | 'right' = 'left') {
    try {
      const ratio = img.width / img.height;
      let w = Math.min(maxW, img.width * 0.264);
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }

      checkBreak(h + 4);

      let x = ML;
      if (align === 'center') x = (W - w) / 2;
      else if (align === 'right') x = W - MR - w;

      pdf.addImage(img.dataUrl, img.mimeType === 'image/jpeg' ? 'JPEG' : 'PNG', x, y, w, h);
      y += h + 4;
    } catch {
      // Image embedding failed, skip silently
    }
  }

  // ─── Build the document ────────────────────────────────

  addRunningHeader();

  // Logos at top (repeated images)
  const logos = images.filter(img => img.isRepeated);
  if (logos.length > 0) {
    addImage(logos[0], 50, 20, 'left');
    y += 2;
  }

  // Title
  y += 10;
  writeText(style.headerText, {
    size: style.titleFontSize,
    style: 'bold',
    color: style.headerColor,
    align: 'center',
    after: 8,
  });

  // Subtitle with key parties
  const partyFields = fields.filter(f =>
    f.name.toLowerCase().includes('company') ||
    f.name.toLowerCase().includes('name') ||
    f.name.toLowerCase().includes('client') ||
    f.name.toLowerCase().includes('from') ||
    f.name.toLowerCase().includes('to') ||
    f.name.toLowerCase().includes('bill')
  );

  if (partyFields.length >= 2) {
    const p1 = data[partyFields[0].id] || partyFields[0].sampleValue || '';
    const p2 = data[partyFields[1].id] || partyFields[1].sampleValue || '';
    if (p1 && p2) {
      writeText(`${p1}`, { size: 12, align: 'center', color: [80, 80, 80], after: 1 });
      writeText('and', { size: 9, align: 'center', color: [140, 140, 140], after: 1 });
      writeText(`${p2}`, { size: 12, align: 'center', color: [80, 80, 80], after: 6 });
    }
  }

  // Date
  const dateField = fields.find(f => f.type === 'date');
  const dateValue = dateField ? (data[dateField.id] || dateField.sampleValue || '') : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  writeText(`Date: ${dateValue}`, { size: 10, align: 'center', color: [120, 120, 120], after: 4 });

  // Accent line
  pdf.setDrawColor(style.accentColor[0], style.accentColor[1], style.accentColor[2]);
  pdf.setLineWidth(1);
  pdf.line(ML + 40, y, W - MR - 40, y);
  y += 12;

  // ─── FIELD DATA SECTION ────────────────────────────────

  if (style.includeTableFormat) {
    // Table-style layout for invoices, COIs, etc.
    writeText('DETAILS', { size: 11, style: 'bold', color: style.headerColor, after: 5 });

    // Draw table header
    pdf.setFillColor(style.headerColor[0], style.headerColor[1], style.headerColor[2]);
    checkBreak(10);
    pdf.rect(ML, y, CW, 8, 'F');
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text('Field', ML + 4, y + 5.5);
    pdf.text('Value', ML + CW * 0.4, y + 5.5);
    y += 10;

    // Table rows
    fields.filter(f => f.userConfirmed !== false).forEach((field, i) => {
      const value = data[field.id] || '';
      checkBreak(9);

      if (i % 2 === 0) {
        pdf.setFillColor(248, 248, 252);
        pdf.rect(ML, y - 1, CW, 8, 'F');
      }

      pdf.setDrawColor(230, 230, 235);
      pdf.setLineWidth(0.2);
      pdf.line(ML, y + 7, ML + CW, y + 7);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(60, 60, 80);
      pdf.text(field.name, ML + 4, y + 5);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      const valLines = pdf.splitTextToSize(value || '—', CW * 0.55);
      pdf.text(valLines[0] || '—', ML + CW * 0.4, y + 5);

      y += 9;
    });

    y += 8;
  } else {
    // Key-value layout for contracts, agreements
    newPage();

    fields.filter(f => f.userConfirmed !== false).forEach((field) => {
      const value = data[field.id] || '';

      checkBreak(14);

      writeText(field.name.toUpperCase(), {
        size: 8,
        style: 'bold',
        color: [style.accentColor[0], style.accentColor[1], style.accentColor[2]],
        after: 1,
      });
      writeText(value || '[Not provided]', {
        size: style.bodyFontSize,
        color: value ? [30, 30, 30] : [160, 160, 160],
        after: 5,
      });
    });
  }

  // ─── ADDITIONAL CONTENT FROM ORIGINAL ──────────────────

  // If there's substantial extracted text, include relevant sections
  if (extractedText && extractedText.length > 100) {
    newPage();

    writeText('TERMS AND CONDITIONS', {
      size: 13,
      style: 'bold',
      color: style.headerColor,
      after: 6,
    });

    // Replace known field values in the extracted text
    let processedText = extractedText;
    fields.forEach(f => {
      if (f.sampleValue && data[f.id]) {
        processedText = processedText.replace(
          new RegExp(escapeRegex(f.sampleValue), 'g'),
          data[f.id]
        );
      }
    });

    // Remove page break markers and clean up
    const sections = processedText
      .split(/---\s*Page Break\s*---/i)
      .filter(s => s.trim().length > 20);

    let sectionCount = 0;
    for (const section of sections) {
      if (sectionCount >= pages * 2) break;

      const paragraphs = section.split(/\n\n+/).filter(p => p.trim().length > 10);
      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (trimmed.length < 5) continue;

        // Detect headings (all caps or short bold lines)
        if (/^[A-Z\s\d.]+$/.test(trimmed) && trimmed.length < 80) {
          writeText(trimmed, { size: 11, style: 'bold', color: style.headerColor, after: 3 });
        } else {
          writeText(trimmed, { size: style.bodyFontSize, after: 3 });
        }
      }
      sectionCount++;
    }
  }

  // ─── NON-LOGO IMAGES ──────────────────────────────────

  const contentImages = images.filter(img => !img.isRepeated);
  if (contentImages.length > 0) {
    checkBreak(20);
    y += 5;
    for (const img of contentImages) {
      addImage(img, 120, 60, 'center');
    }
  }

  // ─── SIGNATURE BLOCK ──────────────────────────────────

  if (style.includeSignatureBlock) {
    newPage();
    y += 20;

    writeText('SIGNATURES', { size: 13, style: 'bold', color: style.headerColor, after: 12 });

    const sigParties = partyFields.slice(0, 2);
    if (sigParties.length >= 2) {
      const sigW = (CW - 20) / 2;

      for (let col = 0; col < 2; col++) {
        const party = sigParties[col];
        const name = data[party.id] || party.sampleValue || 'Party';
        const x = ML + col * (sigW + 20);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(name, x, y);

        // Signature line
        const sy = y + 25;
        pdf.setDrawColor(30, 30, 30);
        pdf.setLineWidth(0.5);
        pdf.line(x, sy, x + sigW, sy);

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text('Signature', x, sy + 5);
        pdf.text('Date: _______________', x, sy + 12);
        pdf.text('Title: _______________', x, sy + 19);
      }
    } else {
      // Single signature block
      pdf.setDrawColor(30, 30, 30);
      pdf.setLineWidth(0.5);
      pdf.line(ML, y + 20, ML + 80, y + 20);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120, 120, 120);
      pdf.text('Authorized Signature', ML, y + 25);
      pdf.text('Date: _______________', ML, y + 32);
    }
  }

  // Final footer
  addFooter();

  return pdf.output('blob');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
