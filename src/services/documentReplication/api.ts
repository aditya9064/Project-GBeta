/**
 * Document Replication API client.
 * Calls backend /api/documents/* for analyze and generate.
 */

import type {
  AnalyzeDocumentRequest,
  AnalyzeDocumentResponse,
  GenerateDocumentRequest,
  GenerateDocumentResponse,
  DocumentTemplate,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(
  path: string,
  options: { method?: string; headers?: HeadersInit; body?: unknown } = {}
): Promise<T> {
  const { body, method, headers } = options;
  const fetchOptions: RequestInit = {
    method: method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    },
  };
  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}/documents${path}`, fetchOptions);
  let data: T & { success?: boolean; error?: string };
  try {
    data = (await res.json()) as T & { success?: boolean; error?: string };
  } catch {
    throw new Error(res.status === 500 ? 'Server error (check backend terminal for details)' : res.statusText);
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as T;
}

/** Response from POST /documents/upload */
interface UploadResponse {
  success: boolean;
  templateId: string;
  template?: DocumentTemplate;
  fields?: import('./types').DetectedField[];
  structure?: DocumentTemplate['structure'];
}

/**
 * Upload document (base64), run analysis, and get templateId + fields.
 */
export async function uploadDocument(
  file: File,
  userId: string
): Promise<{ templateId: string; template?: DocumentTemplate; fields?: import('./types').DetectedField[] }> {
  const base64 = await fileToBase64(file);
  const res = await request<UploadResponse>('/upload', {
    method: 'POST',
    body: {
      fileBase64: base64,
      fileName: file.name,
      mimeType: file.type,
      userId,
    },
  });
  if (!res.templateId) throw new Error('Upload did not return templateId');
  return {
    templateId: res.templateId,
    template: res.template,
    fields: res.fields,
  };
}

/**
 * Analyze document: extract text and run AI variable detection.
 * Can be called with storage URL (after upload) or with base64.
 */
export async function analyzeDocument(
  req: AnalyzeDocumentRequest
): Promise<AnalyzeDocumentResponse> {
  return request<AnalyzeDocumentResponse>('/analyze', {
    method: 'POST',
    body: req,
  });
}

/**
 * Generate a new document from template + field mappings + data.
 */
export async function generateReplicationDocument(
  req: GenerateDocumentRequest
): Promise<GenerateDocumentResponse> {
  return request<GenerateDocumentResponse>('/generate', {
    method: 'POST',
    body: req,
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
