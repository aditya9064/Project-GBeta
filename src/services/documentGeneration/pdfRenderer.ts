/**
 * PDF Renderer
 * 
 * Renders a GeneratedDocument into a professional multi-page PDF
 * using jsPDF. Handles text wrapping, page breaks, headers, footers,
 * section numbering, and proper typography.
 */

import jsPDF from 'jspdf';
import { GeneratedDocument } from './types';

interface PDFConfig {
  pageWidth: number;   // in mm
  pageHeight: number;  // in mm
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
  fontSize: {
    title: number;
    heading1: number;
    heading2: number;
    body: number;
    footer: number;
  };
  lineHeight: number;
}

const defaultConfig: PDFConfig = {
  pageWidth: 215.9,  // Letter size
  pageHeight: 279.4,
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 25,
  marginRight: 25,
  headerHeight: 15,
  footerHeight: 10,
  fontSize: {
    title: 18,
    heading1: 13,
    heading2: 11,
    body: 10,
    footer: 8,
  },
  lineHeight: 1.5,
};

export function renderDocumentToPDF(doc: GeneratedDocument): jsPDF {
  const config = defaultConfig;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const contentWidth = config.pageWidth - config.marginLeft - config.marginRight;
  let currentY = config.marginTop;
  let pageNumber = 1;
  let totalPages = 0; // Will be set after first pass

  // ──── HELPER FUNCTIONS ─────────────────────────────────

  function getUsableHeight(): number {
    return config.pageHeight - config.marginTop - config.marginBottom - config.footerHeight;
  }

  function addNewPage() {
    addFooter();
    pdf.addPage();
    pageNumber++;
    currentY = config.marginTop;
    addHeader();
  }

  function checkPageBreak(neededHeight: number) {
    if (currentY + neededHeight > getUsableHeight() + config.marginTop) {
      addNewPage();
    }
  }

  function addHeader() {
    pdf.setFontSize(config.fontSize.footer);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont('helvetica', 'normal');

    // Document title on left
    pdf.text(doc.templateName, config.marginLeft, config.marginTop - 8);

    // Confidential on right
    pdf.text('CONFIDENTIAL', config.pageWidth - config.marginRight, config.marginTop - 8, { align: 'right' });

    // Thin line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(config.marginLeft, config.marginTop - 4, config.pageWidth - config.marginRight, config.marginTop - 4);

    pdf.setTextColor(0, 0, 0);
  }

  function addFooter() {
    const footerY = config.pageHeight - config.marginBottom + 5;

    pdf.setFontSize(config.fontSize.footer);
    pdf.setTextColor(150, 150, 150);
    pdf.setFont('helvetica', 'normal');

    // Thin line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(config.marginLeft, footerY - 5, config.pageWidth - config.marginRight, footerY - 5);

    // Company name on left
    const companyName = doc.answers['q5'] || doc.answers['q2'] || doc.answers['q1'] || 'Document';
    pdf.text(`Confidential — ${companyName}`, config.marginLeft, footerY);

    // Page number on right
    pdf.text(`Page ${pageNumber}`, config.pageWidth - config.marginRight, footerY, { align: 'right' });

    pdf.setTextColor(0, 0, 0);
  }

  function writeText(text: string, options: {
    fontSize?: number;
    fontStyle?: string;
    indent?: number;
    spacingAfter?: number;
    color?: [number, number, number];
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
  } = {}) {
    const {
      fontSize = config.fontSize.body,
      fontStyle = 'normal',
      indent = 0,
      spacingAfter = 2,
      color = [30, 30, 30],
      align = 'left',
      maxWidth,
    } = options;

    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', fontStyle);
    pdf.setTextColor(color[0], color[1], color[2]);

    const effectiveWidth = (maxWidth || contentWidth) - indent;
    const x = config.marginLeft + indent;

    // Split text into lines that fit within the width
    const lines = pdf.splitTextToSize(text, effectiveWidth);
    const lineHeightMm = (fontSize * config.lineHeight) / 2.835; // convert pt to mm

    for (const line of lines) {
      checkPageBreak(lineHeightMm);
      if (align === 'center') {
        pdf.text(line, config.pageWidth / 2, currentY, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(line, config.pageWidth - config.marginRight, currentY, { align: 'right' });
      } else {
        pdf.text(line, x, currentY);
      }
      currentY += lineHeightMm;
    }

    currentY += spacingAfter;
  }

  // ──── RENDER DOCUMENT ──────────────────────────────────

  // Add header to first page
  addHeader();

  // ─── TITLE PAGE ───────────────────────────────────────

  currentY = config.marginTop + 40;

  // Document title
  writeText(doc.templateName.toUpperCase(), {
    fontSize: config.fontSize.title,
    fontStyle: 'bold',
    spacingAfter: 8,
    align: 'center',
    color: [20, 20, 20],
  });

  // Subtitle / parties
  if (doc.answers['q4'] && doc.answers['q5']) {
    writeText(`${doc.answers['q5']} (Landlord)`, {
      fontSize: 12,
      fontStyle: 'normal',
      align: 'center',
      spacingAfter: 2,
      color: [80, 80, 80],
    });
    writeText(`and`, {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'center',
      spacingAfter: 2,
      color: [120, 120, 120],
    });
    writeText(`${doc.answers['q4']} (Tenant)`, {
      fontSize: 12,
      fontStyle: 'normal',
      align: 'center',
      spacingAfter: 8,
      color: [80, 80, 80],
    });
  } else if (doc.answers['q1'] && doc.answers['q2']) {
    writeText(`Between`, {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'center',
      spacingAfter: 2,
      color: [120, 120, 120],
    });
    writeText(`${doc.answers['q1']} and ${doc.answers['q2']}`, {
      fontSize: 12,
      fontStyle: 'normal',
      align: 'center',
      spacingAfter: 8,
      color: [80, 80, 80],
    });
  }

  // Date
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  writeText(`Effective Date: ${date}`, {
    fontSize: 10,
    fontStyle: 'normal',
    align: 'center',
    spacingAfter: 4,
    color: [100, 100, 100],
  });

  // Category badge
  writeText(doc.category.toUpperCase(), {
    fontSize: 9,
    fontStyle: 'bold',
    align: 'center',
    spacingAfter: 15,
    color: [224, 122, 58],
  });

  // Horizontal rule
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.5);
  pdf.line(config.marginLeft + 30, currentY, config.pageWidth - config.marginRight - 30, currentY);
  currentY += 10;

  // Confidentiality notice
  writeText('CONFIDENTIAL', {
    fontSize: 9,
    fontStyle: 'bold',
    align: 'center',
    spacingAfter: 2,
    color: [150, 150, 150],
  });
  writeText('This document contains proprietary and confidential information.', {
    fontSize: 8,
    fontStyle: 'normal',
    align: 'center',
    spacingAfter: 1,
    color: [150, 150, 150],
  });
  writeText('Unauthorized reproduction or distribution is prohibited.', {
    fontSize: 8,
    fontStyle: 'normal',
    align: 'center',
    spacingAfter: 10,
    color: [150, 150, 150],
  });

  // ─── TABLE OF CONTENTS ────────────────────────────────
  addNewPage();
  
  writeText('TABLE OF CONTENTS', {
    fontSize: config.fontSize.heading1,
    fontStyle: 'bold',
    spacingAfter: 8,
    color: [20, 20, 20],
  });

  let tocPage = 3; // TOC starts on page 2, content on page 3
  for (const section of doc.sections) {
    checkPageBreak(6);
    const indent = section.level > 1 ? 10 : 0;
    
    pdf.setFontSize(section.level === 1 ? 10 : 9);
    pdf.setFont('helvetica', section.level === 1 ? 'bold' : 'normal');
    pdf.setTextColor(30, 30, 30);
    
    // Section title
    pdf.text(section.title, config.marginLeft + indent, currentY);
    
    // Page number (right-aligned)
    pdf.text(String(tocPage), config.pageWidth - config.marginRight, currentY, { align: 'right' });
    
    // Dotted line
    const titleWidth = pdf.getTextWidth(section.title);
    const pageNumWidth = pdf.getTextWidth(String(tocPage));
    const dotsStart = config.marginLeft + indent + titleWidth + 3;
    const dotsEnd = config.pageWidth - config.marginRight - pageNumWidth - 3;
    
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 180);
    let dotX = dotsStart;
    while (dotX < dotsEnd) {
      pdf.text('.', dotX, currentY);
      dotX += 2;
    }
    
    currentY += section.level === 1 ? 5 : 4;
    tocPage += Math.ceil(section.pageEstimate);
  }

  // ─── SECTION CONTENT ──────────────────────────────────
  for (const section of doc.sections) {
    addNewPage();

    // Section heading
    writeText(section.title, {
      fontSize: section.level === 1 ? config.fontSize.heading1 : config.fontSize.heading2,
      fontStyle: 'bold',
      spacingAfter: 6,
      color: [20, 20, 20],
    });

    // Section content — split by paragraphs
    const paragraphs = section.content.split('\n\n');
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      // Check if it's a sub-heading (all caps or starts with number)
      const isSubHeading = /^[A-Z][A-Z\s]+[A-Z]$/.test(paragraph.trim()) ||
        /^\d+\.\d+\s+[A-Z]/.test(paragraph.trim());

      if (isSubHeading && paragraph.length < 120) {
        writeText(paragraph.trim(), {
          fontSize: config.fontSize.body,
          fontStyle: 'bold',
          spacingAfter: 3,
          color: [30, 30, 30],
        });
      } else {
        // Handle indented items (starting with (a), (b), etc.)
        const lines = paragraph.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const isListItem = /^\([a-z]\)|^☐|^☒|^•|^\d+\.\s/.test(trimmed);
          const isIndented = line.startsWith('   ') || line.startsWith('\t');

          writeText(trimmed, {
            fontSize: config.fontSize.body,
            fontStyle: 'normal',
            indent: isListItem ? 8 : isIndented ? 5 : 0,
            spacingAfter: isListItem ? 1.5 : 2.5,
            color: [30, 30, 30],
          });
        }
      }
    }
  }

  // Add footer to last page
  addFooter();

  // Update total pages count
  totalPages = pageNumber;

  return pdf;
}

/**
 * Generate PDF and trigger browser download.
 */
export function downloadPDF(doc: GeneratedDocument, filename?: string): void {
  const pdf = renderDocumentToPDF(doc);
  const name = filename || `${doc.templateName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(name);
}

/**
 * Generate PDF and return as Blob for preview.
 */
export function getPDFBlob(doc: GeneratedDocument): Blob {
  const pdf = renderDocumentToPDF(doc);
  return pdf.output('blob');
}

/**
 * Generate PDF and return as data URL for embedding.
 */
export function getPDFDataUrl(doc: GeneratedDocument): string {
  const pdf = renderDocumentToPDF(doc);
  return pdf.output('datauristring');
}





