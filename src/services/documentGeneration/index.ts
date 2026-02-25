/**
 * Document Generation Service
 * 
 * Public API for the document generation pipeline.
 */

// Types
export type {
  IntakeAnswers,
  DocumentTemplateDef,
  IntakeQuestionDef,
  GeneratedDocument,
  GeneratedSection,
  ValidationResult,
  ValidationCheck,
  PipelineProgress,
  ProgressCallback,
} from './types';

// Pipeline (main API)
export {
  getAvailableTemplates,
  getTemplate,
  getTemplateQuestions,
  runPipeline,
  exportToPDF,
  exportToPDFBlob,
  exportToText,
} from './pipeline';

// Individual templates (for direct access)
export { commercialLeaseTemplate } from './schemas/commercialLease';
export { msaTemplate } from './schemas/masterServiceAgreement';
export { invoiceTemplate } from './schemas/invoicePackage';
export { insuranceCOITemplate } from './schemas/insuranceCOI';
export { vendorPackageTemplate } from './schemas/vendorPackage';
export { employmentTemplate } from './schemas/employmentAgreement';





