/**
 * Local Document Analyzer
 *
 * Client-side PDF/DOCX analysis using pdf-lib for structure extraction
 * and pattern-based heuristics for variable field detection.
 * Works without a backend server.
 */

import type { DetectedField, FieldType, DocumentStructure, BoundingBox } from './types';

// ─── Field detection patterns ──────────────────────────────────

interface FieldPattern {
  regex: RegExp;
  nameExtractor: (match: RegExpMatchArray) => string;
  type: FieldType;
  confidence: number;
}

const FIELD_PATTERNS: FieldPattern[] = [
  // Dates in various formats
  { regex: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g, nameExtractor: () => 'Date', type: 'date', confidence: 0.85 },
  { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, nameExtractor: () => 'Date', type: 'date', confidence: 0.9 },

  // Currency amounts
  { regex: /\$[\d,]+\.?\d{0,2}/g, nameExtractor: () => 'Amount', type: 'currency', confidence: 0.88 },
  { regex: /(?:USD|EUR|GBP)\s*[\d,]+\.?\d{0,2}/g, nameExtractor: () => 'Amount', type: 'currency', confidence: 0.85 },

  // Email addresses
  { regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, nameExtractor: () => 'Email', type: 'email', confidence: 0.95 },

  // Phone numbers
  { regex: /(?:\+1[\s\-]?)?(?:\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4})/g, nameExtractor: () => 'Phone', type: 'phone', confidence: 0.85 },

  // Percentages
  { regex: /\d+\.?\d*\s*%/g, nameExtractor: () => 'Percentage', type: 'percentage', confidence: 0.82 },

  // Invoice / ID numbers
  { regex: /(?:INV|Invoice|PO|Order|Ref|ID|No|#)[\s\-:#]*([A-Z0-9\-]{3,20})/gi, nameExtractor: (m) => m[0].split(/[\s\-:#]+/)[0] + ' Number', type: 'id', confidence: 0.88 },
];

// Key-value patterns for labeled fields
const KV_PATTERNS: RegExp[] = [
  /^(.+?):\s+(.+)$/gm,
  /^(.+?)\s{2,}(.+)$/gm,
];

// Common document field labels
const KNOWN_LABELS: Record<string, FieldType> = {
  'name': 'text', 'company': 'text', 'address': 'text', 'city': 'text',
  'state': 'text', 'zip': 'text', 'country': 'text', 'phone': 'phone',
  'email': 'email', 'date': 'date', 'invoice': 'id', 'amount': 'currency',
  'total': 'currency', 'subtotal': 'currency', 'tax': 'currency',
  'balance': 'currency', 'due': 'currency', 'payment': 'currency',
  'bill to': 'text', 'ship to': 'text', 'from': 'text', 'to': 'text',
  'attention': 'text', 'reference': 'id', 'account': 'id', 'po': 'id',
  'description': 'text', 'quantity': 'number', 'rate': 'currency',
  'price': 'currency', 'unit': 'text', 'terms': 'text', 'notes': 'text',
  'client': 'text', 'vendor': 'text', 'project': 'text', 'period': 'date',
  'employee': 'text', 'title': 'text', 'department': 'text',
  'salary': 'currency', 'start date': 'date', 'end date': 'date',
  'effective date': 'date', 'expiration': 'date', 'ssn': 'id',
  'ein': 'id', 'tin': 'id', 'policy': 'id', 'claim': 'id',
};

// ─── PDF text extraction using pdf-lib ─────────────────────────

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPageCount();

    // pdf-lib doesn't natively extract text content, so we use
    // a lightweight approach: try to parse the page content streams
    let fullText = '';

    for (let i = 0; i < pages; i++) {
      const page = pdfDoc.getPage(i);
      // Extract text operators from the content stream
      const content = await extractPageText(page);
      fullText += content + '\n\n--- Page Break ---\n\n';
    }

    // If pdf-lib extraction yields very little, the PDF likely uses
    // embedded fonts / images. Return what we have.
    if (fullText.replace(/[\s\-Page Break]/g, '').length < 20) {
      return { text: '[PDF text could not be extracted client-side. The document may contain scanned images. Upload to the server for OCR processing.]', pages };
    }

    return { text: fullText.trim(), pages };
  } catch {
    return { text: '', pages: 0 };
  }
}

async function extractPageText(page: any): Promise<string> {
  try {
    const dict = page.node;
    const contentsRef = dict.get(page.doc.context.obj('Contents'));
    if (!contentsRef) return '';

    // Try to get the content stream
    const stream = page.doc.context.lookup(contentsRef);
    if (!stream) return '';

    let rawBytes: Uint8Array | undefined;
    if (typeof stream.getContents === 'function') {
      rawBytes = stream.getContents();
    } else if (stream.contents) {
      rawBytes = stream.contents;
    }

    if (!rawBytes) return '';

    // Decode the content stream and extract text between Tj/TJ operators
    const raw = new TextDecoder('latin1').decode(rawBytes);
    const textParts: string[] = [];

    // Match text showing operators: (text) Tj or [(text)] TJ
    const tjMatches = raw.matchAll(/\(([^)]*)\)\s*Tj/g);
    for (const m of tjMatches) {
      textParts.push(decodePDFString(m[1]));
    }

    const tjArrayMatches = raw.matchAll(/\[([^\]]*)\]\s*TJ/g);
    for (const m of tjArrayMatches) {
      const inner = m[1];
      const parts = inner.matchAll(/\(([^)]*)\)/g);
      for (const p of parts) {
        textParts.push(decodePDFString(p[1]));
      }
    }

    return textParts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function decodePDFString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

// ─── Plain text extraction ─────────────────────────────────────

function extractTextFromPlain(text: string): { text: string; pages: number } {
  const pages = Math.max(1, Math.ceil(text.length / 3000));
  return { text, pages };
}

// ─── Field detection engine ────────────────────────────────────

function detectFieldsFromText(text: string): DetectedField[] {
  const fields: DetectedField[] = [];
  const seen = new Set<string>();
  let fieldIndex = 0;

  // 1. Detect key-value pairs (e.g., "Company: Acme Corp")
  for (const pattern of KV_PATTERNS) {
    const kvRegex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = kvRegex.exec(text)) !== null) {
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();

      if (label.length < 2 || label.length > 40 || value.length < 1) continue;
      if (seen.has(label)) continue;

      const knownType = Object.entries(KNOWN_LABELS).find(([k]) => label.includes(k));
      if (knownType || label.length <= 25) {
        const fieldType = knownType ? knownType[1] : inferFieldType(value);
        const fieldName = label.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        if (fieldName.length > 1 && value.length > 0) {
          fields.push({
            id: `field-${fieldIndex++}`,
            name: fieldName,
            type: fieldType,
            page: 1,
            confidence: knownType ? 0.9 : 0.7,
            aiSuggested: true,
            userConfirmed: false,
            sampleValue: value.slice(0, 100),
          });
          seen.add(label);
        }
      }
    }
  }

  // 2. Detect specific patterns (dates, currency, emails, etc.)
  for (const pattern of FIELD_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    let count = 0;

    while ((match = regex.exec(text)) !== null && count < 5) {
      const value = match[0].trim();
      const key = `${pattern.type}-${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const name = pattern.nameExtractor(match);
      const uniqueName = count > 0 ? `${name} ${count + 1}` : name;

      fields.push({
        id: `field-${fieldIndex++}`,
        name: uniqueName,
        type: pattern.type,
        page: 1,
        confidence: pattern.confidence,
        aiSuggested: true,
        userConfirmed: false,
        sampleValue: value,
      });
      count++;
    }
  }

  // Deduplicate by name (keep highest confidence)
  const uniqueFields = new Map<string, DetectedField>();
  for (const field of fields) {
    const existing = uniqueFields.get(field.name);
    if (!existing || field.confidence > existing.confidence) {
      uniqueFields.set(field.name, field);
    }
  }

  return Array.from(uniqueFields.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 30);
}

function inferFieldType(value: string): FieldType {
  if (/\$|€|£/.test(value) || /^\d[\d,]*\.\d{2}$/.test(value)) return 'currency';
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(value)) return 'date';
  if (/@/.test(value)) return 'email';
  if (/\(\d{3}\)|\d{3}[\-\s]\d{3}/.test(value)) return 'phone';
  if (/%/.test(value)) return 'percentage';
  if (/^\d+$/.test(value)) return 'number';
  return 'text';
}

// ─── Image extraction from PDF ─────────────────────────────────

export interface ExtractedImage {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  page: number;
  isRepeated: boolean;
  mimeType: string;
}

async function extractImagesFromPDF(arrayBuffer: ArrayBuffer): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];

  try {
    const { PDFDocument, PDFName, PDFStream, PDFRawStream } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    let imgIndex = 0;

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const page = pdfDoc.getPage(pageIdx);
      const resources = page.node.get(PDFName.of('Resources'));
      if (!resources) continue;

      const xObjectRef = resources instanceof Map
        ? resources.get(PDFName.of('XObject'))
        : (resources as any)?.get?.(PDFName.of('XObject'));

      const xObject = xObjectRef
        ? pdfDoc.context.lookup(xObjectRef)
        : null;

      if (!xObject) continue;

      // Iterate XObject dictionary entries
      try {
        const entries = (xObject as any)?.entries?.() || [];
        for (const [, ref] of entries) {
          const obj = pdfDoc.context.lookup(ref);
          if (!obj) continue;

          const subtypeRef = (obj as any)?.get?.(PDFName.of('Subtype'));
          const subtype = subtypeRef ? pdfDoc.context.lookup(subtypeRef) : subtypeRef;
          if (subtype?.toString() !== '/Image' && subtypeRef?.toString() !== '/Image') continue;

          const widthRef = (obj as any)?.get?.(PDFName.of('Width'));
          const heightRef = (obj as any)?.get?.(PDFName.of('Height'));
          const w = widthRef ? parseInt(String(pdfDoc.context.lookup(widthRef) ?? widthRef), 10) : 100;
          const h = heightRef ? parseInt(String(pdfDoc.context.lookup(heightRef) ?? heightRef), 10) : 100;

          // Skip tiny images (likely artifacts)
          if (w < 20 || h < 20) continue;

          let rawData: Uint8Array | null = null;
          if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
            rawData = (obj as any).getContents?.() || (obj as any).contents || null;
          }

          if (rawData && rawData.length > 100) {
            const mimeType = detectImageMimeType(rawData);
            const blob = new Blob([rawData], { type: mimeType });
            const dataUrl = await blobToDataUrl(blob);

            images.push({
              id: `img-${imgIndex++}`,
              dataUrl,
              width: w,
              height: h,
              page: pageIdx + 1,
              isRepeated: false,
              mimeType,
            });
          }
        }
      } catch {
        // XObject iteration failed for this page, skip
      }
    }
  } catch {
    // PDF image extraction failed entirely
  }

  // Mark repeated images (same dimensions appearing on multiple pages — likely logos)
  const dimCount = new Map<string, number>();
  for (const img of images) {
    const key = `${img.width}x${img.height}`;
    dimCount.set(key, (dimCount.get(key) || 0) + 1);
  }
  for (const img of images) {
    const key = `${img.width}x${img.height}`;
    if ((dimCount.get(key) || 0) > 1) {
      img.isRepeated = true;
    }
  }

  return images;
}

function detectImageMimeType(data: Uint8Array): string {
  if (data[0] === 0xFF && data[1] === 0xD8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
  if (data[0] === 0x47 && data[1] === 0x49) return 'image/gif';
  return 'image/png';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Main analyzer function ────────────────────────────────────

export interface LocalAnalysisResult {
  templateId: string;
  extractedText: string;
  pages: number;
  fields: DetectedField[];
  images: ExtractedImage[];
  structure: DocumentStructure;
  documentType: string;
}

function detectDocumentType(text: string): string {
  const lower = text.toLowerCase();
  if (/invoice|inv[\-\s]?\d|bill\s*to|amount\s*due/i.test(lower)) return 'Invoice';
  if (/lease\s*agreement|landlord|tenant|rent/i.test(lower)) return 'Lease Agreement';
  if (/master\s*service|msa|service\s*agreement/i.test(lower)) return 'Service Agreement';
  if (/employment|offer\s*letter|salary|compensation/i.test(lower)) return 'Employment Agreement';
  if (/certificate.*insurance|coi|coverage|policy\s*number/i.test(lower)) return 'Certificate of Insurance';
  if (/non-?disclosure|nda|confidential/i.test(lower)) return 'NDA';
  if (/proposal|scope\s*of\s*work|deliverables/i.test(lower)) return 'Proposal';
  if (/purchase\s*order|po[\-\s]?\d/i.test(lower)) return 'Purchase Order';
  if (/receipt|paid|transaction/i.test(lower)) return 'Receipt';
  if (/contract|agreement|terms/i.test(lower)) return 'Contract';
  return 'Document';
}

export async function analyzeDocumentLocally(file: File): Promise<LocalAnalysisResult> {
  const templateId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const arrayBuffer = await file.arrayBuffer();

  let text = '';
  let pages = 1;
  let images: ExtractedImage[] = [];

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const result = await extractTextFromPDF(arrayBuffer);
    text = result.text;
    pages = result.pages;
    images = await extractImagesFromPDF(arrayBuffer);
  } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    const decoder = new TextDecoder();
    const result = extractTextFromPlain(decoder.decode(arrayBuffer));
    text = result.text;
    pages = result.pages;
  } else {
    // For DOCX and other formats, attempt basic text extraction
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(arrayBuffer);
    // Strip XML tags for DOCX
    text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    pages = Math.max(1, Math.ceil(text.length / 3000));
  }

  const fields = detectFieldsFromText(text);
  const documentType = detectDocumentType(text);

  return {
    templateId,
    extractedText: text,
    pages,
    fields,
    images,
    structure: {
      pages,
      extractedText: text,
      images: images.map(img => ({ id: img.id, width: img.width, height: img.height, page: img.page })),
    },
    documentType,
  };
}
