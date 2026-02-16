/**
 * Document Replication Agent — types for upload, analysis, mapping, and generation.
 */

export type DocumentFormat = 'pdf' | 'docx' | 'txt' | 'image';

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'currency'
  | 'email'
  | 'phone'
  | 'id'
  | 'percentage';

export interface BoundingBox {
  x: number;   // 0–1 or px
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface DetectedField {
  id: string;
  name: string;
  type: FieldType;
  boundingBox?: BoundingBox;
  page: number;
  confidence: number;
  aiSuggested: boolean;
  userConfirmed: boolean;
  sampleValue?: string;
}

export interface DocumentStructure {
  pages: number;
  extractedText?: string;
  layout?: unknown;
  tables?: unknown[];
  images?: unknown[];
}

export interface DocumentTemplate {
  id: string;
  userId: string;
  originalFileName: string;
  originalFormat: DocumentFormat;
  storageUrl: string;
  createdAt: number;
  fields: DetectedField[];
  structure: DocumentStructure;
}

export type OutputFormat = 'pdf' | 'docx' | 'txt' | 'html';

export interface GeneratedReplicationDocument {
  id: string;
  templateId: string;
  userId: string;
  outputFormat: OutputFormat;
  data: Record<string, string>;
  generatedUrl: string;
  createdAt: number;
  fileName: string;
}

export interface AnalyzeDocumentRequest {
  fileUrl?: string;
  fileBase64?: string;
  fileName: string;
  mimeType: string;
}

export interface AnalyzeDocumentResponse {
  success: boolean;
  templateId?: string;
  fields?: DetectedField[];
  structure?: DocumentStructure;
  error?: string;
}

export interface GenerateDocumentRequest {
  templateId: string;
  fieldMappings: DetectedField[];
  data: Record<string, string>;
  outputFormat: OutputFormat;
  fileName?: string;
}

export interface GenerateDocumentResponse {
  success: boolean;
  generatedUrl?: string;
  fileName?: string;
  error?: string;
}
