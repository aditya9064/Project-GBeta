/**
 * TemplateGallery — Browse, search, and import 4,343+ n8n automation templates
 * 
 * A full-screen overlay that lets users explore the entire n8n workflow
 * library organized by category, complexity, and service integration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Search, Loader2, ArrowRight, Zap, Clock, Mail, Globe, Filter,
  ChevronDown, ChevronLeft, ChevronRight, Layers, Star, Play, Download,
  AlertCircle, CheckCircle2, Brain, MessageSquare, ShoppingCart, CreditCard,
  BarChart3, Database, FileText, Code, Cloud, Users, Folder, Settings,
  Activity, Cpu, Tag
} from 'lucide-react';
import {
  searchTemplates,
  getCategories,
  getFeaturedTemplates,
  importTemplate,
  loadRawTemplate,
  getRelatedTemplates,
} from '../../services/n8n/templateLibrary';
import type { WorkflowTemplate, TemplateSearchResult } from '../../services/n8n/templateLibrary';
import type { N8nWorkflow } from '../../services/n8n/converter';
import type { WorkflowDefinition } from '../../services/automation/types';
import './TemplateGallery.css';

/* ═══ Icons for categories ════════════════════════════════ */

const categoryIcons: Record<string, React.ReactNode> = {
  'Email': <Mail size={16} />,
  'Communication': <MessageSquare size={16} />,
  'Social Media': <Users size={16} />,
  'CRM & Sales': <BarChart3 size={16} />,
  'Productivity': <Layers size={16} />,
  'Development': <Code size={16} />,
  'Finance': <CreditCard size={16} />,
  'E-Commerce': <ShoppingCart size={16} />,
  'File Storage': <Folder size={16} />,
  'Scheduling': <Clock size={16} />,
  'AI & ML': <Brain size={16} />,
  'Database': <Database size={16} />,
  'CMS': <FileText size={16} />,
  'Triggers': <Zap size={16} />,
  'Utilities': <Settings size={16} />,
  'Support': <MessageSquare size={16} />,
  'Analytics': <Activity size={16} />,
  'Documents': <FileText size={16} />,
  'Other': <Globe size={16} />,
};

const complexityColors: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

/* ═══ Props ═══════════════════════════════════════════════ */

interface TemplateGalleryProps {
  onClose: () => void;
  onImport: (workflow: WorkflowDefinition, templateName: string) => void;
}

/* ═══ Component ═══════════════════════════════════════════ */

export function TemplateGallery({ onClose, onImport }: TemplateGalleryProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('');
  const [selectedTrigger, setSelectedTrigger] = useState('');
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [searchResult, setSearchResult] = useState<TemplateSearchResult | null>(null);
  const [featured, setFeatured] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);
  const [previewData, setPreviewData] = useState<N8nWorkflow | null>(null);
  const [relatedTemplates, setRelatedTemplates] = useState<WorkflowTemplate[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [cats, feat, initial] = await Promise.all([
          getCategories(),
          getFeaturedTemplates(12),
          searchTemplates({ page: 1, pageSize: 24 }),
        ]);
        setCategories(cats);
        setFeatured(feat);
        setSearchResult(initial);
        setError(null);
      } catch (err: any) {
        setError('Failed to load template library. Make sure workflows are downloaded.');
        console.error('[TemplateGallery] Init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Search with debounce
  const doSearch = useCallback(async (q: string, cat: string, complexity: string, trigger: string, p: number) => {
    try {
      setLoading(true);
      const result = await searchTemplates({
        query: q || undefined,
        category: cat !== 'All' ? cat : undefined,
        complexity: complexity as any || undefined,
        triggerType: trigger || undefined,
        page: p,
        pageSize: 24,
      });
      setSearchResult(result);
      setError(null);
    } catch (err: any) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      doSearch(value, selectedCategory, selectedComplexity, selectedTrigger, 1);
    }, 300);
  }, [selectedCategory, selectedComplexity, selectedTrigger, doSearch]);

  // Handle filter changes
  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
    doSearch(query, cat, selectedComplexity, selectedTrigger, 1);
  }, [query, selectedComplexity, selectedTrigger, doSearch]);

  const handleComplexityChange = useCallback((c: string) => {
    const newVal = c === selectedComplexity ? '' : c;
    setSelectedComplexity(newVal);
    setPage(1);
    doSearch(query, selectedCategory, newVal, selectedTrigger, 1);
  }, [query, selectedCategory, selectedComplexity, selectedTrigger, doSearch]);

  const handleTriggerChange = useCallback((t: string) => {
    const newVal = t === selectedTrigger ? '' : t;
    setSelectedTrigger(newVal);
    setPage(1);
    doSearch(query, selectedCategory, selectedComplexity, newVal, 1);
  }, [query, selectedCategory, selectedComplexity, selectedTrigger, doSearch]);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    doSearch(query, selectedCategory, selectedComplexity, selectedTrigger, p);
  }, [query, selectedCategory, selectedComplexity, selectedTrigger, doSearch]);

  // Import a template
  const handleImport = useCallback(async (template: WorkflowTemplate) => {
    try {
      setImporting(template.id);
      const workflow = await importTemplate(template);
      onImport(workflow, template.name);
    } catch (err) {
      console.error('[TemplateGallery] Import failed:', err);
      setError('Failed to import template');
    } finally {
      setImporting(null);
    }
  }, [onImport]);

  // Preview a template
  const handlePreview = useCallback(async (template: WorkflowTemplate) => {
    setPreviewTemplate(template);
    try {
      const [raw, related] = await Promise.all([
        loadRawTemplate(template),
        getRelatedTemplates(template, 4),
      ]);
      setPreviewData(raw);
      setRelatedTemplates(related);
    } catch (err) {
      console.error('[TemplateGallery] Preview failed:', err);
    }
  }, []);

  // Close preview
  const closePreview = useCallback(() => {
    setPreviewTemplate(null);
    setPreviewData(null);
    setRelatedTemplates([]);
  }, []);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const showingSearch = query || selectedCategory !== 'All' || selectedComplexity || selectedTrigger;

  return (
    <div className="tg-overlay" onClick={onClose}>
      <div className="tg-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tg-header">
          <div className="tg-header-left">
            <div className="tg-header-icon">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="tg-title">Automation Templates</h2>
              <p className="tg-subtitle">
                {searchResult?.total ?? 0} production-ready workflows • 365+ integrations
              </p>
            </div>
          </div>
          <button className="tg-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="tg-search-bar">
          <div className="tg-search-input-wrapper">
            <Search size={16} className="tg-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="tg-search-input"
              placeholder="Search automations... (e.g., 'Gmail to Slack', 'Stripe invoice', 'AI summary')"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {query && (
              <button className="tg-search-clear" onClick={() => handleSearchChange('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="tg-filters">
            <div className="tg-filter-group">
              <span className="tg-filter-label">Complexity:</span>
              {['low', 'medium', 'high'].map(c => (
                <button
                  key={c}
                  className={`tg-filter-chip ${selectedComplexity === c ? 'active' : ''}`}
                  onClick={() => handleComplexityChange(c)}
                  style={selectedComplexity === c ? { borderColor: complexityColors[c], color: complexityColors[c] } : {}}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="tg-filter-group">
              <span className="tg-filter-label">Trigger:</span>
              {['webhook', 'schedule', 'email', 'event', 'manual'].map(t => (
                <button
                  key={t}
                  className={`tg-filter-chip ${selectedTrigger === t ? 'active' : ''}`}
                  onClick={() => handleTriggerChange(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="tg-body">
          {/* Categories Sidebar */}
          <div className="tg-sidebar">
            <div className="tg-sidebar-title">Categories</div>
            <button
              className={`tg-cat-btn ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('All')}
            >
              <Layers size={14} />
              <span>All Templates</span>
              <span className="tg-cat-count">{searchResult?.total ?? 0}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.name}
                className={`tg-cat-btn ${selectedCategory === cat.name ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.name)}
              >
                {categoryIcons[cat.name] || <Folder size={14} />}
                <span>{cat.name}</span>
                <span className="tg-cat-count">{cat.count}</span>
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="tg-content">
            {error && (
              <div className="tg-error">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {loading && !searchResult ? (
              <div className="tg-loading">
                <Loader2 size={32} className="spin" />
                <span>Loading templates...</span>
              </div>
            ) : (
              <>
                {/* Featured section when no active search */}
                {!showingSearch && featured.length > 0 && (
                  <div className="tg-section">
                    <h3 className="tg-section-title">
                      <Star size={16} /> Featured Automations
                    </h3>
                    <div className="tg-grid">
                      {featured.map(template => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          importing={importing}
                          onPreview={handlePreview}
                          onImport={handleImport}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                <div className="tg-section">
                  <h3 className="tg-section-title">
                    {showingSearch ? (
                      <>
                        <Search size={16} />
                        {searchResult?.total ?? 0} results
                        {query && <span className="tg-search-term"> for "{query}"</span>}
                      </>
                    ) : (
                      <>
                        <Zap size={16} /> All Automations
                      </>
                    )}
                  </h3>

                  {searchResult && searchResult.templates.length > 0 ? (
                    <>
                      <div className="tg-grid">
                        {searchResult.templates.map(template => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            importing={importing}
                            onPreview={handlePreview}
                            onImport={handleImport}
                          />
                        ))}
                      </div>

                      {/* Pagination */}
                      {searchResult.totalPages > 1 && (
                        <div className="tg-pagination">
                          <button
                            className="tg-page-btn"
                            disabled={page <= 1}
                            onClick={() => handlePageChange(page - 1)}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="tg-page-info">
                            Page {page} of {searchResult.totalPages}
                          </span>
                          <button
                            className="tg-page-btn"
                            disabled={page >= searchResult.totalPages}
                            onClick={() => handlePageChange(page + 1)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    !loading && (
                      <div className="tg-empty">
                        <Search size={32} />
                        <p>No templates found matching your criteria</p>
                        <button className="tg-reset-btn" onClick={() => {
                          setQuery('');
                          setSelectedCategory('All');
                          setSelectedComplexity('');
                          setSelectedTrigger('');
                          doSearch('', 'All', '', '', 1);
                        }}>
                          Reset Filters
                        </button>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Template Preview Modal */}
        {previewTemplate && (
          <div className="tg-preview-overlay" onClick={closePreview}>
            <div className="tg-preview" onClick={(e) => e.stopPropagation()}>
              <div className="tg-preview-header">
                <div>
                  <h3>{previewTemplate.name}</h3>
                  <p className="tg-preview-desc">{previewTemplate.description || 'No description available'}</p>
                </div>
                <button className="tg-close" onClick={closePreview}>
                  <X size={18} />
                </button>
              </div>

              <div className="tg-preview-body">
                {/* Metadata */}
                <div className="tg-preview-meta">
                  <div className="tg-preview-meta-item">
                    <span className="tg-meta-label">Category</span>
                    <span className="tg-meta-value">
                      {categoryIcons[previewTemplate.category]} {previewTemplate.category}
                    </span>
                  </div>
                  <div className="tg-preview-meta-item">
                    <span className="tg-meta-label">Complexity</span>
                    <span className="tg-meta-value" style={{ color: complexityColors[previewTemplate.complexity] }}>
                      {previewTemplate.complexity}
                    </span>
                  </div>
                  <div className="tg-preview-meta-item">
                    <span className="tg-meta-label">Trigger</span>
                    <span className="tg-meta-value">{previewTemplate.triggerType}</span>
                  </div>
                  <div className="tg-preview-meta-item">
                    <span className="tg-meta-label">Nodes</span>
                    <span className="tg-meta-value">{previewTemplate.nodeCount}</span>
                  </div>
                </div>

                {/* Services */}
                {previewTemplate.services.length > 0 && (
                  <div className="tg-preview-services">
                    <span className="tg-meta-label">Services Used</span>
                    <div className="tg-service-tags">
                      {previewTemplate.services.map(svc => (
                        <span key={svc} className="tg-service-tag">{svc}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workflow Nodes Preview */}
                {previewData && (
                  <div className="tg-preview-nodes">
                    <span className="tg-meta-label">Workflow Steps</span>
                    <div className="tg-node-list">
                      {previewData.nodes.map((node, i) => (
                        <div key={node.id || i} className="tg-node-item">
                          <div className="tg-node-idx">{i + 1}</div>
                          <div className="tg-node-info">
                            <div className="tg-node-name">{node.name}</div>
                            <div className="tg-node-type">
                              {node.type.replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '')}
                              {node.parameters?.operation && ` • ${node.parameters.operation}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Templates */}
                {relatedTemplates.length > 0 && (
                  <div className="tg-preview-related">
                    <span className="tg-meta-label">Related Templates</span>
                    <div className="tg-related-list">
                      {relatedTemplates.map(rt => (
                        <button
                          key={rt.id}
                          className="tg-related-item"
                          onClick={() => handlePreview(rt)}
                        >
                          <span className="tg-related-name">{rt.name}</span>
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="tg-preview-footer">
                <button className="tg-btn-secondary" onClick={closePreview}>
                  Cancel
                </button>
                <button
                  className="tg-btn-primary"
                  onClick={() => {
                    handleImport(previewTemplate);
                    closePreview();
                  }}
                  disabled={importing === previewTemplate.id}
                >
                  {importing === previewTemplate.id ? (
                    <><Loader2 size={16} className="spin" /> Importing...</>
                  ) : (
                    <><Download size={16} /> Use This Template</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Template Card ═══════════════════════════════════════ */

interface TemplateCardProps {
  template: WorkflowTemplate;
  importing: string | null;
  onPreview: (t: WorkflowTemplate) => void;
  onImport: (t: WorkflowTemplate) => void;
}

function TemplateCard({ template, importing, onPreview, onImport }: TemplateCardProps) {
  return (
    <div className="tg-card" onClick={() => onPreview(template)}>
      <div className="tg-card-header">
        <span className="tg-card-category">
          {categoryIcons[template.category] || <Folder size={12} />}
          {template.category}
        </span>
        <span
          className="tg-card-complexity"
          style={{ color: complexityColors[template.complexity] }}
        >
          {template.complexity}
        </span>
      </div>

      <h4 className="tg-card-title">{template.name}</h4>
      <p className="tg-card-desc">
        {template.description || `Automated workflow with ${template.services.join(', ') || template.integrationDir}`}
      </p>

      <div className="tg-card-services">
        {template.services.slice(0, 4).map(svc => (
          <span key={svc} className="tg-card-service">{svc}</span>
        ))}
        {template.services.length > 4 && (
          <span className="tg-card-service tg-more">+{template.services.length - 4}</span>
        )}
      </div>

      <div className="tg-card-footer">
        <span className="tg-card-meta">
          <Cpu size={12} /> {template.nodeCount} nodes
        </span>
        <span className="tg-card-meta">
          <Zap size={12} /> {template.triggerType}
        </span>
        <button
          className="tg-card-import"
          onClick={(e) => {
            e.stopPropagation();
            onImport(template);
          }}
          disabled={importing === template.id}
        >
          {importing === template.id ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <><Download size={14} /> Use</>
          )}
        </button>
      </div>
    </div>
  );
}

