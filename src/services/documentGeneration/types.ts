/* ─── DOCUMENT GENERATION TYPES ──────────────────────────── */

/** User-provided answers from the intake form */
export interface IntakeAnswers {
  [questionId: string]: string;
}

/** A single section in the document structure */
export interface DocumentSection {
  id: string;
  title: string;
  level: number; // 1 = article, 2 = subsection, 3 = sub-subsection
  content: string;
  pageEstimate: number; // estimated pages this section fills
  conditional?: {
    questionId: string;
    value: string | string[];
    include: boolean;
  };
}

/** Full document schema definition */
export interface DocumentSchema {
  templateId: string;
  name: string;
  category: string;
  description: string;
  jurisdiction?: string;
  sections: DocumentSectionSchema[];
}

/** Schema for a section — used to generate content */
export interface DocumentSectionSchema {
  id: string;
  title: string;
  level: number;
  contentGenerator: (answers: IntakeAnswers) => string;
  pageEstimate: number;
  conditional?: {
    questionId: string;
    values: string[];
    include: boolean; // include when answer matches values
  };
}

/** Intake question definition for each template */
export interface IntakeQuestionDef {
  id: string;
  question: string;
  type: 'select' | 'text' | 'multiselect' | 'date' | 'toggle' | 'number' | 'textarea';
  options?: string[];
  defaultValue?: string;
  required: boolean;
  helpText?: string;
  placeholder?: string;
}

/** Template definition with schema + questions */
export interface DocumentTemplateDef {
  id: string;
  name: string;
  category: string;
  description: string;
  pages: string;
  sections: number;
  avgGenerationTime: string;
  questions: IntakeQuestionDef[];
  schema: DocumentSectionSchema[];
}

/** A generated section with content */
export interface GeneratedSection {
  id: string;
  title: string;
  level: number;
  content: string;
  pageStart: number;
  pageEnd: number;
  pageEstimate: number;
  status: 'pending' | 'generating' | 'done';
  generatedAt?: number;
}

/** Full generated document */
export interface GeneratedDocument {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  answers: IntakeAnswers;
  sections: GeneratedSection[];
  totalPages: number;
  generatedAt: number;
  generationTimeMs: number;
  validation: ValidationResult;
}

/** Validation check result */
export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'warning' | 'fail';
  details: string;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  overallStatus: 'pass' | 'warning' | 'fail';
}

/** Pipeline progress callback */
export interface PipelineProgress {
  stage: 'intake' | 'entity-resolution' | 'structure' | 'content' | 'validation' | 'rendering';
  stageLabel: string;
  stageProgress: number; // 0-100
  overallProgress: number; // 0-100
  currentSection?: string;
  sectionsCompleted: number;
  sectionsTotal: number;
  pagesGenerated: number;
  etaSeconds: number;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

