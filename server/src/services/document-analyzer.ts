/**
 * Document Analyzer — Extract text from PDF/DOCX and detect variables via OpenAI.
 */

import { createRequire } from 'node:module';
import OpenAI from 'openai';
import { config } from '../config.js';

const require = createRequire(import.meta.url);

export interface DetectedField {
  id: string;
  name: string;
  type: string;
  boundingBox?: { x: number; y: number; width: number; height: number; page?: number };
  page: number;
  confidence: number;
  aiSuggested: boolean;
  userConfirmed: boolean;
  sampleValue?: string;
}

export interface DocumentStructure {
  pages: number;
  extractedText?: string;
}

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: config.openai.apiKey });
  return openai;
}

/**
 * Extract text from a PDF buffer using pdf-parse (CJS).
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    const pdfParseModule = require('pdf-parse');
    const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default ?? pdfParseModule;
    if (typeof pdfParse !== 'function') {
      console.warn('pdf-parse: no function export');
      return { text: '', pages: 1 };
    }
    const data = await pdfParse(buffer);
    const text = data?.text != null ? String(data.text) : '';
    const pages = typeof data?.numpages === 'number' ? data.numpages : 1;
    return { text, pages };
  } catch (e) {
    console.warn('pdf-parse failed, returning empty text:', e);
    return { text: '', pages: 1 };
  }
}

/**
 * Extract text from a DOCX buffer using mammoth.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string; pages: number }> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    const pages = Math.max(1, Math.ceil(text.length / 3000));
    return { text, pages };
  } catch (e) {
    console.warn('mammoth failed, returning empty text:', e);
    return { text: '', pages: 1 };
  }
}

/**
 * Extract text from buffer based on mime type.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; pages: number }> {
  if (mimeType === 'application/pdf') return extractTextFromPdf(buffer);
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractTextFromDocx(buffer);
  }
  if (mimeType === 'text/plain') {
    const text = buffer.toString('utf-8');
    return { text, pages: Math.max(1, Math.ceil(text.length / 3000)) };
  }
  return { text: '', pages: 1 };
}

/**
 * Call OpenAI to detect variable-like fields in the extracted text.
 * Returns suggested fields with name, type, confidence, and sample value.
 */
export async function detectVariablesWithOpenAI(
  extractedText: string,
  fileName: string
): Promise<DetectedField[]> {
  const apiKey = config.openai?.apiKey;
  if (!apiKey || !extractedText.trim()) {
    return [];
  }

  const truncated = extractedText.slice(0, 12000);
  const prompt = `You are a document analysis assistant. Below is text extracted from a document named "${fileName}".

Identify all likely VARIABLE or PLACEHOLDER fields — values that would change when creating another document of the same type. Examples: names (person/company), dates, amounts, invoice numbers, addresses, emails, phone numbers, IDs, percentages.

For each detected field return:
- name: short label (e.g. "Invoice Number", "Customer Name", "Date")
- type: one of text, number, date, currency, email, phone, id, percentage
- confidence: 0-1
- sampleValue: the value that appears in this document (or "..." if generic)

Return a JSON array of objects with keys: name, type, confidence, sampleValue. Use only the types listed. No other commentary.`;

  try {
    const client = getOpenAI();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n---\nDocument text:\n${truncated}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content) as { fields?: Array<{ name: string; type: string; confidence?: number; sampleValue?: string }> };
    const list = Array.isArray(parsed.fields) ? parsed.fields : Array.isArray(parsed) ? parsed : [];
    const types = ['text', 'number', 'date', 'currency', 'email', 'phone', 'id', 'percentage'];

    return list.slice(0, 50).map((item, i) => ({
      id: `field-${i}-${Date.now()}`,
      name: String(item.name || `Field ${i + 1}`).slice(0, 80),
      type: types.includes(String(item.type)) ? item.type : 'text',
      page: 1,
      confidence: Math.min(1, Math.max(0, Number(item.confidence) ?? 0.8)),
      aiSuggested: true,
      userConfirmed: false,
      sampleValue: item.sampleValue != null ? String(item.sampleValue).slice(0, 200) : undefined,
    }));
  } catch (e) {
    console.error('OpenAI variable detection failed:', e);
    return [];
  }
}
