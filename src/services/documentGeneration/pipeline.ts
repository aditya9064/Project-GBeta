/**
 * Document Generation Pipeline
 * 
 * Orchestrates the full document generation flow:
 * 1. Guided Intake (handled by UI)
 * 2. Entity Resolution
 * 3. Structure Generation
 * 4. Section-by-Section Content Generation
 * 5. Cross-Reference Validation
 * 6. Template Rendering (PDF/DOCX)
 */

import {
  IntakeAnswers,
  DocumentTemplateDef,
  GeneratedDocument,
  ProgressCallback,
} from './types';
import { generateDocument } from './engine';
import { downloadPDF, getPDFBlob } from './pdfRenderer';

// Import all templates
import { commercialLeaseTemplate } from './schemas/commercialLease';
import { msaTemplate } from './schemas/masterServiceAgreement';
import { invoiceTemplate } from './schemas/invoicePackage';
import { insuranceCOITemplate } from './schemas/insuranceCOI';
import { vendorPackageTemplate } from './schemas/vendorPackage';
import { employmentTemplate } from './schemas/employmentAgreement';

/** Registry of all available document templates */
const templateRegistry: Map<string, DocumentTemplateDef> = new Map([
  ['dt1', commercialLeaseTemplate],
  ['dt2', msaTemplate],
  ['dt3', invoiceTemplate],
  ['dt4', insuranceCOITemplate],
  ['dt5', vendorPackageTemplate],
  ['dt6', employmentTemplate],
]);

/**
 * Get all available templates.
 */
export function getAvailableTemplates(): DocumentTemplateDef[] {
  return Array.from(templateRegistry.values());
}

/**
 * Get a specific template by ID.
 */
export function getTemplate(templateId: string): DocumentTemplateDef | undefined {
  return templateRegistry.get(templateId);
}

/**
 * Get intake questions for a specific template.
 */
export function getTemplateQuestions(templateId: string) {
  const template = templateRegistry.get(templateId);
  if (!template) throw new Error(`Template ${templateId} not found`);
  return template.questions;
}

/**
 * Run the full document generation pipeline.
 */
export async function runPipeline(
  templateId: string,
  answers: IntakeAnswers,
  onProgress?: ProgressCallback,
): Promise<GeneratedDocument> {
  const template = templateRegistry.get(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found in registry`);
  }

  // Run the generation engine
  const document = await generateDocument(template, answers, onProgress);

  return document;
}

/**
 * Download the generated document as PDF.
 */
export function exportToPDF(doc: GeneratedDocument, filename?: string): void {
  downloadPDF(doc, filename);
}

/**
 * Get PDF as Blob for preview.
 */
export function exportToPDFBlob(doc: GeneratedDocument): Blob {
  return getPDFBlob(doc);
}

/**
 * Generate a plain text version of the document.
 */
export function exportToText(doc: GeneratedDocument): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push(doc.templateName.toUpperCase());
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Generated: ${new Date(doc.generatedAt).toLocaleString()}`);
  lines.push(`Total Pages: ${doc.totalPages}`);
  lines.push(`Sections: ${doc.sections.length}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('');

  for (const section of doc.sections) {
    lines.push('');
    lines.push(section.title);
    lines.push('-'.repeat(section.title.length));
    lines.push('');
    lines.push(section.content);
    lines.push('');
  }

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('END OF DOCUMENT');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

