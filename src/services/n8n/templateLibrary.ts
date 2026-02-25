/**
 * Template Library Service
 * 
 * Manages the searchable index of 3,656+ n8n workflow templates.
 * Loads the index from public/workflows/index.json which contains
 * embedded workflow data — no individual file fetching needed.
 * 
 * Each template in the index includes a `workflowData` field with
 * the minified n8n workflow (nodes + connections), ready to convert
 * to CrewOS format and deploy as a native agent.
 */

import { convertN8nToCrewOS, N8nWorkflow } from './converter';
import { WorkflowDefinition } from '../automation/types';

/* ═══ Types ═══════════════════════════════════════════════ */

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  integrationDir: string;
  fileName: string;
  nodeCount: number;
  complexity: 'low' | 'medium' | 'high';
  triggerType: string;
  services: string[];
  tags: string[];
  /** Embedded n8n workflow data (nodes + connections) — no file fetch needed */
  workflowData?: N8nWorkflow;
  /** @deprecated — no longer used; workflow data is embedded in the index */
  filePath?: string;
}

export interface TemplateIndex {
  version: string;
  generatedAt: string;
  totalWorkflows: number;
  categories: { name: string; count: number }[];
  integrations: string[];
  workflows: WorkflowTemplate[];
}

export interface TemplateSearchOptions {
  query?: string;
  category?: string;
  complexity?: 'low' | 'medium' | 'high';
  triggerType?: string;
  service?: string;
  page?: number;
  pageSize?: number;
}

export interface TemplateSearchResult {
  templates: WorkflowTemplate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: { name: string; count: number }[];
}

/* ═══ Template Library ════════════════════════════════════ */

let _index: TemplateIndex | null = null;
let _loadPromise: Promise<TemplateIndex> | null = null;

/**
 * Load the template index. Caches after first load.
 */
export async function loadTemplateIndex(): Promise<TemplateIndex> {
  if (_index) return _index;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const resp = await fetch('/workflows/index.json');
      if (!resp.ok) throw new Error(`Failed to load template index: ${resp.status}`);
      const data = await resp.json();
      _index = data as TemplateIndex;
      console.log(`[TemplateLibrary] Loaded ${_index.totalWorkflows} workflow templates`);
      return _index;
    } catch (err) {
      console.warn('[TemplateLibrary] Could not load index, using empty library:', err);
      _index = {
        version: '0.0.0',
        generatedAt: new Date().toISOString(),
        totalWorkflows: 0,
        categories: [],
        integrations: [],
        workflows: [],
      };
      return _index;
    }
  })();

  return _loadPromise;
}

/**
 * Search and filter templates
 */
export async function searchTemplates(options: TemplateSearchOptions = {}): Promise<TemplateSearchResult> {
  const index = await loadTemplateIndex();
  let results = [...index.workflows];

  // Text search (name, description, services)
  if (options.query) {
    const q = options.query.toLowerCase().trim();
    const terms = q.split(/\s+/);
    results = results.filter(t => {
      const searchText = `${t.name} ${t.description} ${t.services.join(' ')} ${t.integrationDir}`.toLowerCase();
      return terms.every(term => searchText.includes(term));
    });
  }

  // Category filter
  if (options.category && options.category !== 'All') {
    results = results.filter(t => t.category === options.category);
  }

  // Complexity filter
  if (options.complexity) {
    results = results.filter(t => t.complexity === options.complexity);
  }

  // Trigger type filter
  if (options.triggerType) {
    results = results.filter(t => t.triggerType === options.triggerType);
  }

  // Service filter
  if (options.service) {
    const svc = options.service.toLowerCase();
    results = results.filter(t => 
      t.services.some(s => s.toLowerCase().includes(svc)) ||
      t.integrationDir.toLowerCase().includes(svc)
    );
  }

  // Compute category counts for current results
  const catCounts: Record<string, number> = {};
  for (const t of results) {
    catCounts[t.category] = (catCounts[t.category] || 0) + 1;
  }
  const categories = Object.entries(catCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Pagination
  const page = options.page || 1;
  const pageSize = options.pageSize || 24;
  const total = results.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paged = results.slice(start, start + pageSize);

  return {
    templates: paged,
    total,
    page,
    pageSize,
    totalPages,
    categories,
  };
}

/**
 * Get all available categories
 */
export async function getCategories(): Promise<{ name: string; count: number }[]> {
  const index = await loadTemplateIndex();
  return index.categories;
}

/**
 * Get all available integrations
 */
export async function getIntegrations(): Promise<string[]> {
  const index = await loadTemplateIndex();
  return index.integrations;
}

/**
 * Convert a template to a ready-to-deploy CrewOS workflow.
 * Uses the embedded workflowData — no network fetch needed.
 */
export async function importTemplate(template: WorkflowTemplate): Promise<WorkflowDefinition> {
  if (!template.workflowData) {
    throw new Error(`Template "${template.name}" has no embedded workflow data`);
  }
  return convertN8nToCrewOS(template.workflowData as N8nWorkflow);
}

/**
 * Get the raw n8n workflow JSON from a template.
 * Uses the embedded workflowData — no network fetch needed.
 */
export async function loadRawTemplate(template: WorkflowTemplate): Promise<N8nWorkflow> {
  if (!template.workflowData) {
    throw new Error(`Template "${template.name}" has no embedded workflow data`);
  }
  return template.workflowData as N8nWorkflow;
}

/**
 * Get related templates (same category or overlapping services)
 */
export async function getRelatedTemplates(template: WorkflowTemplate, limit = 6): Promise<WorkflowTemplate[]> {
  const index = await loadTemplateIndex();
  
  const scored = index.workflows
    .filter(t => t.id !== template.id)
    .map(t => {
      let score = 0;
      if (t.category === template.category) score += 3;
      if (t.integrationDir === template.integrationDir) score += 2;
      for (const svc of template.services) {
        if (t.services.includes(svc)) score += 1;
      }
      return { template: t, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.template);
}

/**
 * Get featured/popular templates
 */
export async function getFeaturedTemplates(limit = 12): Promise<WorkflowTemplate[]> {
  const index = await loadTemplateIndex();
  
  return [...index.workflows]
    .sort((a, b) => {
      const complexityScore = (c: string) => c === 'medium' ? 3 : c === 'high' ? 2 : 1;
      const cs = complexityScore(b.complexity) - complexityScore(a.complexity);
      if (cs !== 0) return cs;
      return b.services.length - a.services.length;
    })
    .slice(0, limit);
}
