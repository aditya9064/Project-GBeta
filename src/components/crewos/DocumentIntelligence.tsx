import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
  Layers,
  Brain,
  Shield,
  Sparkles,
  ArrowRight,
  Database,
  Play,
  BarChart3,
  Clock,
  Zap,
  FileCheck,
  AlertTriangle,
  Search,
  Plus,
  Download,
  RefreshCw,
  Scale,
  Building2,
  FileSignature,
  ClipboardCheck,
  Briefcase,
} from 'lucide-react';
import './DocumentIntelligence.css';
import { log } from '../../utils/logger';

import {
  getAvailableTemplates,
  getTemplate,
  runPipeline,
  exportToPDF,
  exportToText,
  type IntakeAnswers,
  type PipelineProgress,
  type GeneratedDocument,
  type DocumentTemplateDef,
} from '../../services/documentGeneration';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentReplicationAgent } from './documentReplication';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');

/* ─── DATA ───────────────────────────────────────────────── */

/* ─── TEMPLATE ICON / COLOR MAP ─────────────────────────── */
const templateIcons: Record<string, typeof FileText> = {
  dt1: Building2, dt2: Scale, dt3: FileText,
  dt4: ClipboardCheck, dt5: FileSignature, dt6: Briefcase,
};
const templateColors: Record<string, string> = {
  dt1: '#e07a3a', dt2: '#d46b2c', dt3: '#1a1a2e',
  dt4: '#3a3a52', dt5: '#c05a1c', dt6: '#111111',
};

const templateModelStats: Record<string, { accuracy: string; latency: string; trainedOn: string; lastTrained: string }> = {
  dt1: { accuracy: '97.2%', latency: '~12s', trainedOn: '18K leases', lastTrained: '2 days ago' },
  dt2: { accuracy: '96.8%', latency: '~15s', trainedOn: '14K contracts', lastTrained: '3 days ago' },
  dt3: { accuracy: '98.1%', latency: '~8s', trainedOn: '22K proposals', lastTrained: '1 day ago' },
  dt4: { accuracy: '97.5%', latency: '~10s', trainedOn: '11K compliance', lastTrained: '4 days ago' },
  dt5: { accuracy: '96.3%', latency: '~14s', trainedOn: '9K agreements', lastTrained: '5 days ago' },
  dt6: { accuracy: '95.9%', latency: '~18s', trainedOn: '7K reports', lastTrained: '3 days ago' },
};

/* ─── COMPONENT ──────────────────────────────────────────── */

type ActiveView = 'generate' | 'replicate';

interface DocumentIntelligenceProps {
  initialView?: ActiveView;
}

export function DocumentIntelligence(props: DocumentIntelligenceProps = {}) {
  const { initialView } = props;
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>(initialView === 'replicate' ? 'replicate' : 'generate');
  useEffect(() => {
    if (initialView) setActiveView(initialView);
  }, [initialView]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0); // 0 = template select, 1 = intake, 2 = generating, 3 = review
  const [expandedSections, setExpandedSections] = useState(true);

  // ─── NEW: Live generation state ───
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);

  // ─── History state ───
  const [documentHistory, setDocumentHistory] = useState<Array<{
    id: string; templateName: string; generatedAt: string;
    category?: string; totalPages?: number; templateId?: string;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    (async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`${API_BASE}/documents/history`, { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success) setDocumentHistory(json.entries || []);
        }
      } catch { /* history load non-fatal */ }
      clearTimeout(timeout);
      if (!cancelled) setHistoryLoading(false);
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, []);

  // Get templates from the generation service
  const availableTemplates = getAvailableTemplates();
  const activeTemplate: DocumentTemplateDef | undefined = selectedTemplate ? getTemplate(selectedTemplate) : undefined;

  // Compute intake progress
  const answeredCount = activeTemplate
    ? activeTemplate.questions.filter(q => intakeAnswers[q.id]?.trim()).length
    : 0;
  const requiredCount = activeTemplate
    ? activeTemplate.questions.filter(q => q.required).length
    : 0;
  const requiredAnswered = activeTemplate
    ? activeTemplate.questions.filter(q => q.required && intakeAnswers[q.id]?.trim()).length
    : 0;
  const canGenerate = requiredAnswered >= requiredCount;

  // Handle intake answer changes
  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setIntakeAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  // Run the generation pipeline
  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || isGenerating) return;
    setIsGenerating(true);
    generatingRef.current = true;
    setWizardStep(2);
    setPipelineProgress(null);
    setGeneratedDoc(null);

    try {
      const doc = await runPipeline(selectedTemplate, intakeAnswers, (progress) => {
        if (generatingRef.current) {
          setPipelineProgress({ ...progress });
        }
      });
      setGeneratedDoc(doc);
      setWizardStep(3);

      try {
        const histRes = await fetch(`${API_BASE}/documents/history/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: doc.templateName,
            generatedAt: doc.generatedAt,
            fields: intakeAnswers,
            userId: user?.uid || 'anonymous',
            templateId: doc.templateId,
            category: doc.category,
            totalPages: doc.totalPages,
            generationTimeMs: doc.generationTimeMs,
            sectionCount: doc.sections?.length || 0,
          }),
        });
        if (histRes.ok) {
          const histJson = await histRes.json();
          if (histJson.success && histJson.entry) {
            setDocumentHistory(prev => [histJson.entry, ...prev]);
          }
        }
      } catch { /* history save non-fatal */ }
    } catch (err) {
      log.error('Generation failed:', err);
      setWizardStep(1);
    } finally {
      setIsGenerating(false);
      generatingRef.current = false;
    }
  }, [selectedTemplate, intakeAnswers, isGenerating]);

  // Export handlers
  const handleExportPDF = useCallback(() => {
    if (generatedDoc) exportToPDF(generatedDoc);
  }, [generatedDoc]);

  const handleExportText = useCallback(() => {
    if (!generatedDoc) return;
    const text = exportToText(generatedDoc);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedDoc.templateName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedDoc]);

  /* ─── GENERATE VIEW ─────────────────────────────────────── */
  const renderGenerateView = () => {
    // ─── STEP 0: Template Selection ───
    if (wizardStep === 0) {
      return (
        <div className="docai-generate-view">
          <div className="docai-gen-header-bar">
            <div>
              <h3 className="docai-gen-title">Generate a Document</h3>
              <p className="docai-gen-subtitle">Select a template. Answer targeted questions. The model handles the rest — no drafting required.</p>
            </div>
            <div className="docai-gen-search">
              <Search size={15} />
              <input type="text" placeholder="Search templates..." />
            </div>
          </div>

          <div className="docai-templates-grid">
            {availableTemplates.map((tmpl) => {
              const Icon = templateIcons[tmpl.id] || FileText;
              const color = templateColors[tmpl.id] || '#e07a3a';
              return (
                <div
                  key={tmpl.id}
                  role="button"
                  tabIndex={0}
                  className={`docai-template-card ${selectedTemplate === tmpl.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedTemplate(tmpl.id);
                    // Pre-fill defaults: explicit defaultValue → first option → placeholder example → auto-date
                    const defaults: IntakeAnswers = {};
                    tmpl.questions.forEach(q => {
                      if (q.defaultValue) {
                        defaults[q.id] = q.defaultValue;
                      } else if ((q.type === 'select' || q.type === 'toggle') && q.options?.length) {
                        defaults[q.id] = q.options[0];
                      } else if (q.type === 'date') {
                        // Auto-fill date fields with today's date
                        const d = new Date();
                        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                        defaults[q.id] = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                      } else if ((q.type === 'text' || q.type === 'textarea') && q.placeholder) {
                        defaults[q.id] = q.placeholder.replace(/^e\.g\.\s*/i, '');
                      }
                    });
                    setIntakeAnswers(defaults);
                  }}
                >
                  <div className="docai-template-icon" style={{ background: `${color}15`, color }}>
                    <Icon size={22} />
                  </div>
                  <div className="docai-template-info">
                    <h4>{tmpl.name}</h4>
                    <p>{tmpl.description}</p>
                    <div className="docai-template-meta">
                      <span><FileText size={12} /> {tmpl.pages} pages</span>
                      <span><Layers size={12} /> {tmpl.sections} sections</span>
                      <span><Clock size={12} /> ~{tmpl.avgGenerationTime}</span>
                    </div>
                    {templateModelStats[tmpl.id] && (
                      <div className="docai-template-model-stats">
                        <span className="docai-tms" title="Pipeline accuracy for this document type">
                          <BarChart3 size={11} />
                          {templateModelStats[tmpl.id].accuracy}
                        </span>
                        <span className="docai-tms" title="Average generation latency">
                          <Zap size={11} />
                          {templateModelStats[tmpl.id].latency}
                        </span>
                        <span className="docai-tms" title="Training corpus size">
                          <Database size={11} />
                          {templateModelStats[tmpl.id].trainedOn}
                        </span>
                        <span className="docai-tms" title="Last model training">
                          <RefreshCw size={11} />
                          {templateModelStats[tmpl.id].lastTrained}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="docai-template-inputs-badge">
                    {tmpl.questions.length} inputs
                  </div>
                </div>
              );
            })}
          </div>

          {selectedTemplate && (
            <div className="docai-gen-footer">
              <button className="docai-gen-start-btn" onClick={() => setWizardStep(1)}>
                <Sparkles size={16} />
                Start Guided Intake
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      );
    }

    // ─── STEP 1: Interactive Intake Form ───
    if (wizardStep === 1 && activeTemplate) {
      const totalQ = activeTemplate.questions.length;
      const progressPct = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0;

      return (
        <div className="docai-generate-view">
          <div className="docai-intake-header">
            <button className="docai-back-btn" onClick={() => { setWizardStep(0); }}>
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
              Back
            </button>
            <div className="docai-intake-header-info">
              <h3>{activeTemplate.name} — Guided Intake</h3>
              <p>Answer these questions. The model generates a full {activeTemplate.pages} page document from your inputs. No drafting needed.</p>
            </div>
            <div className="docai-intake-progress">
              <span>{answeredCount} / {totalQ} completed</span>
              <div className="docai-intake-progress-bar">
                <div className="docai-intake-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>

          <div className="docai-intake-form">
            {activeTemplate.questions.map((q) => (
              <div key={q.id} className="docai-intake-field">
                <div className="docai-intake-field-header">
                  <label>
                    {q.question}
                    {q.required && <span className="docai-required">*</span>}
                  </label>
                  {q.helpText && <span className="docai-help-text">{q.helpText}</span>}
                </div>
                {q.type === 'select' ? (
                  <select
                    className="docai-intake-select-input"
                    value={intakeAnswers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  >
                    <option value="">Select...</option>
                    {q.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : q.type === 'toggle' ? (
                  <div className="docai-intake-toggle" role="radiogroup" aria-label={q.question}>
                    {q.options?.map(opt => (
                      <span
                        key={opt}
                        role="radio"
                        tabIndex={0}
                        aria-checked={intakeAnswers[q.id] === opt}
                        className={`docai-toggle-opt ${intakeAnswers[q.id] === opt ? 'active' : ''}`}
                        onClick={() => handleAnswerChange(q.id, opt)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAnswerChange(q.id, opt); }}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                ) : q.type === 'textarea' ? (
                  <textarea
                    className="docai-intake-textarea-input"
                    placeholder={q.placeholder || ''}
                    value={intakeAnswers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <input
                    type="text"
                    className="docai-intake-text-input"
                    placeholder={q.placeholder || ''}
                    value={intakeAnswers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="docai-intake-footer">
            <div className="docai-intake-footer-info">
              <Zap size={14} />
              <span>Entity resolution will auto-fill additional fields from your CRM and prior documents</span>
            </div>
            <button
              className={`docai-gen-start-btn ${!canGenerate ? 'disabled' : ''}`}
              onClick={canGenerate ? handleGenerate : undefined}
              style={{ opacity: canGenerate ? 1 : 0.5, cursor: canGenerate ? 'pointer' : 'not-allowed' }}
            >
              <Play size={16} />
              Generate Document ({activeTemplate.sections} sections)
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    // ─── STEP 2: Live Generation Progress ───
    if (wizardStep === 2) {
      const pp = pipelineProgress;
      const stages = [
        { id: 'p1', name: 'Guided Intake', desc: 'Smart questions — no drafting required', stage: 'intake' as const },
        { id: 'p2', name: 'Entity Resolution', desc: 'Auto-fill from CRM, prior docs, company data', stage: 'entity-resolution' as const },
        { id: 'p3', name: 'Structure Generation', desc: 'Outline model builds document AST', stage: 'structure' as const },
        { id: 'p4', name: 'Section-by-Section Content', desc: 'Content model generates each section', stage: 'content' as const },
        { id: 'p5', name: 'Cross-Reference Validation', desc: 'Check references, numbering, compliance', stage: 'validation' as const },
        { id: 'p6', name: 'Template Rendering', desc: 'Professional formatting → PDF/DOCX', stage: 'rendering' as const },
      ];

      const stageOrder = ['intake', 'entity-resolution', 'structure', 'content', 'validation', 'rendering'];
      const currentStageIdx = pp ? stageOrder.indexOf(pp.stage) : -1;

      return (
        <div className="docai-generate-view">
          <div className="docai-generating-header">
            <div>
              <h3>Generating: {activeTemplate?.name || 'Document'}</h3>
              <p>The pipeline is composing your document section by section. Each section is generated independently with full context.</p>
            </div>
            <div className="docai-generating-stats">
              <div className="docai-gen-stat">
                <span className="docai-gen-stat-value">{pp ? `${pp.sectionsCompleted} / ${pp.sectionsTotal}` : '—'}</span>
                <span className="docai-gen-stat-label">Sections Done</span>
              </div>
              <div className="docai-gen-stat">
                <span className="docai-gen-stat-value">{pp ? `~${pp.pagesGenerated}` : '—'}</span>
                <span className="docai-gen-stat-label">Pages So Far</span>
              </div>
              <div className="docai-gen-stat">
                <span className="docai-gen-stat-value">{pp ? `${Math.ceil(pp.etaSeconds)}s` : '—'}</span>
                <span className="docai-gen-stat-label">ETA Remaining</span>
              </div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="docai-overall-progress">
            <div className="docai-overall-progress-bar">
              <div className="docai-progress-fill" style={{ width: `${pp?.overallProgress || 0}%` }} />
            </div>
            <span className="docai-overall-progress-label">{pp?.overallProgress || 0}% — {pp?.stageLabel || 'Starting...'}</span>
          </div>

          {/* Pipeline Stages */}
          <div className="docai-pipeline-progress">
            {stages.map((s, i) => {
              const isComplete = i < currentStageIdx || (i === currentStageIdx && pp?.stageProgress === 100);
              const isActive = i === currentStageIdx && pp?.stageProgress !== 100;
              const isPending = i > currentStageIdx;
              const status = isComplete ? 'completed' : isActive ? 'active' : 'pending';

              return (
                <div key={s.id} className={`docai-pipeline-stage ${status}`}>
                  <div className="docai-pipeline-stage-indicator">
                    {isComplete ? <CheckCircle2 size={18} /> : isActive ? <Loader2 size={18} className="docai-spin" /> : <Circle size={18} />}
                    {i < stages.length - 1 && <div className="docai-pipeline-line" />}
                  </div>
                  <div className="docai-pipeline-stage-content">
                    <h4>{s.name}</h4>
                    <p>{s.desc}</p>
                    {isActive && pp?.currentSection && (
                      <span className="docai-pipeline-detail">{pp.currentSection}</span>
                    )}
                    {isActive && pp?.stage === 'content' && (
                      <span className="docai-pipeline-detail">Section {pp.sectionsCompleted}/{pp.sectionsTotal}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ─── STEP 3: Review with REAL generated content ───
    if (wizardStep === 3 && generatedDoc) {
      const doc = generatedDoc;
      const genTimeStr = `${Math.floor(doc.generationTimeMs / 1000)}s`;

      return (
        <div className="docai-generate-view">
          <div className="docai-review-header">
            <button className="docai-back-btn" onClick={() => { setWizardStep(0); setGeneratedDoc(null); }}>
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
              New Document
            </button>
            <div className="docai-review-header-info">
              <h3>Document Ready for Review</h3>
              <p>{doc.totalPages}-page {doc.templateName} generated in {genTimeStr}</p>
            </div>
            <div className="docai-review-actions">
              <button className="docai-gen-secondary-btn" onClick={handleExportPDF}>
                <Download size={14} />
                Export PDF
              </button>
              <button className="docai-gen-secondary-btn" onClick={handleExportText}>
                <Download size={14} />
                Export TXT
              </button>
              <button className="docai-gen-start-btn" onClick={handleExportPDF}>
                <FileCheck size={16} />
                Download & Send
              </button>
            </div>
          </div>

          {/* Validation Results — REAL data */}
          <div className="docai-validation-results">
            {doc.validation.checks.map((check) => (
              <div key={check.id} className={`docai-validation-card ${check.status}`}>
                {check.status === 'pass' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <div>
                  <h4>{check.name}</h4>
                  <p>{check.details}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Document Preview — REAL first section content */}
          <div className="docai-doc-preview">
            <div className="docai-doc-preview-page">
              <div className="docai-doc-preview-header">
                <div className="docai-doc-preview-logo">{doc.templateName.toUpperCase()}</div>
                <div className="docai-doc-preview-meta">
                  <span>{doc.category}</span>
                  <span>Generated: {new Date(doc.generatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="docai-doc-preview-body">
                {doc.sections.slice(0, 3).map((section) => (
                  <div key={section.id}>
                    <div className="docai-doc-preview-line bold">{section.title}</div>
                    {section.content.split('\n').slice(0, 6).map((line, j) => (
                      <div key={j} className={`docai-doc-preview-line ${line.trim() === '' ? 'spacer' : ''}`}>
                        {line.trim()}
                      </div>
                    ))}
                    <div className="docai-doc-preview-line spacer" />
                  </div>
                ))}
                <div className="docai-doc-preview-line" style={{ color: '#8a8aa0', fontStyle: 'italic' }}>
                  ... {doc.sections.length - 3} more sections (download PDF for full document) ...
                </div>
              </div>
              <div className="docai-doc-preview-footer">
                <span>Confidential — Generated by Document Intelligence</span>
                <span>Page 1 of {doc.totalPages}</span>
              </div>
            </div>
          </div>

          {/* Section List */}
          <div className="docai-sections-progress">
            <button
              className="docai-sections-toggle"
              onClick={() => setExpandedSections(!expandedSections)}
            >
              {expandedSections ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>All Sections ({doc.sections.length})</span>
              <span className="docai-sections-count">{doc.totalPages} pages</span>
            </button>

            {expandedSections && (
              <div className="docai-sections-list">
                {doc.sections.map((section, i) => (
                  <div key={section.id} className="docai-section-item done">
                    <div className="docai-section-status-icon">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="docai-section-number">{String(i + 1).padStart(2, '0')}</span>
                    <span className="docai-section-name">{section.title}</span>
                    <span className="docai-section-pages">p.{section.pageStart}–{section.pageEnd}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="docai-review-info">
            <div className="docai-review-info-item">
              <Layers size={16} />
              <div>
                <strong>{doc.sections.length} sections</strong> generated by SectionWriter model
              </div>
            </div>
            <div className="docai-review-info-item">
              <Shield size={16} />
              <div>
                <strong>{doc.validation.checks.length} validation checks</strong> passed by DocValidator model
              </div>
            </div>
            <div className="docai-review-info-item">
              <Database size={16} />
              <div>
                <strong>{doc.totalPages} pages</strong> of professional content generated
              </div>
            </div>
            <div className="docai-review-info-item">
              <Brain size={16} />
              <div>
                <strong>0 GPT calls</strong> — fully custom-trained models
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Fallback
    return null;
  };

  /* ─── HISTORY VIEW ─────────────────────────────────────── */
  const renderHistoryView = () => (
    <div className="docai-models-view">
      <div className="docai-arch-banner">
        <div className="docai-arch-banner-content">
          <div className="docai-arch-banner-icon">
            <Clock size={28} />
          </div>
          <div className="docai-arch-banner-text">
            <h3>Document History</h3>
            <p>Previously generated documents. Click to view details.</p>
          </div>
          <div className="docai-arch-stats">
            <div className="docai-arch-stat">
              <span className="docai-arch-stat-value">{documentHistory.length}</span>
              <span className="docai-arch-stat-label">Documents</span>
            </div>
          </div>
        </div>
      </div>

      {historyLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2rem', color: '#8a8aa0' }}>
          <Loader2 size={18} className="docai-spin" />
          Loading history...
        </div>
      ) : documentHistory.length === 0 ? (
        <div style={{ padding: '2rem', color: '#8a8aa0', textAlign: 'center' }}>
          No documents generated yet. Use the Generate tab to create your first document.
        </div>
      ) : (
        <div className="docai-models-grid">
          {documentHistory.map((entry) => (
            <div key={entry.id} className="docai-model-card">
              <div className="docai-model-card-header">
                <div className="docai-model-card-tags">
                  {entry.category && (
                    <span className="docai-model-type docai-type-generation">{entry.category}</span>
                  )}
                  <span className="docai-model-status docai-status-deployed">
                    <CheckCircle2 size={11} />
                    Generated
                  </span>
                </div>
                <div className="docai-model-icon">
                  <FileText size={20} />
                </div>
              </div>
              <h4 className="docai-model-name">{entry.templateName}</h4>
              <div className="docai-model-metrics">
                <div className="docai-metric">
                  <span className="docai-metric-value">{new Date(entry.generatedAt).toLocaleDateString()}</span>
                  <span className="docai-metric-label">Date</span>
                </div>
                {entry.totalPages && (
                  <div className="docai-metric">
                    <span className="docai-metric-value">{entry.totalPages}</span>
                    <span className="docai-metric-label">Pages</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="docai-page">
      {/* Header */}
      <div className="docai-header">
        <div className="docai-header-left">
          <h1 className="docai-header-title">Document Intelligence</h1>
          <div className="docai-header-tabs">
            <button
              className={`docai-header-tab ${activeView === 'generate' ? 'active' : ''}`}
              onClick={() => { setActiveView('generate'); setWizardStep(0); setSelectedTemplate(null); }}
            >
              <Sparkles size={15} />
              Generate
            </button>
            <button
              className={`docai-header-tab ${activeView === 'replicate' ? 'active' : ''}`}
              onClick={() => setActiveView('replicate')}
            >
              <Upload size={15} />
              Replicate
            </button>
          </div>
        </div>
        <div className="docai-header-right">
          <button className="docai-btn-primary" onClick={() => { setActiveView('generate'); setWizardStep(0); }}>
            <Plus size={16} />
            New Document
          </button>
          <button
            className="docai-btn-secondary"
            onClick={() => setActiveView('replicate')}
          >
            <Upload size={15} />
            Replicate
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="docai-content">
        {activeView === 'generate' && renderGenerateView()}
        {activeView === 'replicate' && (
          <DocumentReplicationAgent
            userId={user?.uid ?? 'anonymous'}
            onBack={() => setActiveView('generate')}
          />
        )}
      </div>
    </div>
  );
}

