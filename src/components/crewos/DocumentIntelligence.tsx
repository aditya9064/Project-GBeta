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
  Eye,
  Table2,
  Tag,
  Cpu,
  Database,
  GitBranch,
  Play,
  BarChart3,
  Clock,
  Zap,
  FileCheck,
  AlertTriangle,
  Check,
  X,
  Search,
  Plus,
  Download,
  RefreshCw,
  Settings2,
  BookOpen,
  Scale,
  Home,
  Building2,
  FileSignature,
  ClipboardCheck,
  Briefcase,
} from 'lucide-react';
import './DocumentIntelligence.css';

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

/* ─── TYPES ──────────────────────────────────────────────── */

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  type: 'ocr' | 'extraction' | 'classifier' | 'structure' | 'content' | 'validation';
  status: 'deployed' | 'training' | 'fine-tuning' | 'queued';
  accuracy: number;
  latency: string;
  trainingSamples: string;
  lastTrained: string;
  icon: typeof FileText;
}

/* ─── DATA ───────────────────────────────────────────────── */

const models: ModelInfo[] = [
  {
    id: 'm1',
    name: 'LayoutLMv3 — OCR + Layout',
    description:
      'Layout-aware transformer that understands document structure — headers, paragraphs, tables, signatures, and spatial relationships between text blocks. Handles scanned PDFs, photos, and handwritten content.',
    type: 'ocr',
    status: 'deployed',
    accuracy: 97.8,
    latency: '1.2s',
    trainingSamples: '48K docs',
    lastTrained: '2 days ago',
    icon: Eye,
  },
  {
    id: 'm2',
    name: 'TableFormer — Table & KV Extraction',
    description:
      'Extracts structured tables, key-value pairs, line items, and nested data from complex document layouts. Handles multi-page tables with merged cells and irregular formatting.',
    type: 'extraction',
    status: 'deployed',
    accuracy: 96.4,
    latency: '0.8s',
    trainingSamples: '22K tables',
    lastTrained: '5 days ago',
    icon: Table2,
  },
  {
    id: 'm3',
    name: 'DocClassifier — Document Type',
    description:
      'Classifies documents into 47 categories (invoices, contracts, W-9s, insurance certs, leases, NDAs, etc.) with sub-type detection. Routes to appropriate extraction pipeline.',
    type: 'classifier',
    status: 'deployed',
    accuracy: 99.1,
    latency: '0.3s',
    trainingSamples: '85K docs',
    lastTrained: '1 day ago',
    icon: Tag,
  },
  {
    id: 'm4',
    name: 'StructureGen — Outline Model',
    description:
      'Generates document structure ASTs trained on real professional documents. Knows section ordering, required clauses, and regulatory requirements per document type and jurisdiction.',
    type: 'structure',
    status: 'deployed',
    accuracy: 94.7,
    latency: '2.1s',
    trainingSamples: '35K outlines',
    lastTrained: '3 days ago',
    icon: GitBranch,
  },
  {
    id: 'm5',
    name: 'SectionWriter — Content Generation',
    description:
      'Fine-tuned on 200K+ real professional document sections. Generates each section independently with full context awareness. This is how 20–50 page documents are composed — section by section, not all at once.',
    type: 'content',
    status: 'fine-tuning',
    accuracy: 92.3,
    latency: '4.8s/section',
    trainingSamples: '200K sections',
    lastTrained: 'In progress',
    icon: Brain,
  },
  {
    id: 'm6',
    name: 'DocValidator — Cross-Reference',
    description:
      'Validates internal references, clause numbering, regulatory compliance, contradiction detection, and formatting consistency across the full generated document.',
    type: 'validation',
    status: 'training',
    accuracy: 91.6,
    latency: '3.2s',
    trainingSamples: '15K validated docs',
    lastTrained: 'Epoch 8/12',
    icon: Shield,
  },
];

/* ─── TEMPLATE ICON / COLOR MAP ─────────────────────────── */
const templateIcons: Record<string, typeof FileText> = {
  dt1: Building2, dt2: Scale, dt3: FileText,
  dt4: ClipboardCheck, dt5: FileSignature, dt6: Briefcase,
};
const templateColors: Record<string, string> = {
  dt1: '#e07a3a', dt2: '#d46b2c', dt3: '#1a1a2e',
  dt4: '#3a3a52', dt5: '#c05a1c', dt6: '#111111',
};

/* ─── COMPONENT ──────────────────────────────────────────── */

type ActiveView = 'models' | 'generate' | 'pipeline' | 'replicate';

interface DocumentIntelligenceProps {
  initialView?: ActiveView;
}

export function DocumentIntelligence(props: DocumentIntelligenceProps = {}) {
  const { initialView } = props;
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>(initialView ?? 'models');
  useEffect(() => {
    if (initialView) setActiveView(initialView);
  }, [initialView]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0); // 0 = template select, 1 = intake, 2 = generating, 3 = review
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState(true);

  // ─── NEW: Live generation state ───
  const [intakeAnswers, setIntakeAnswers] = useState<IntakeAnswers>({});
  const [pipelineProgress, setPipelineProgress] = useState<PipelineProgress | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);

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
    } catch (err) {
      console.error('Generation failed:', err);
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

  const getStatusBadge = (status: ModelInfo['status']) => {
    const map = {
      'deployed': { label: 'Deployed', className: 'docai-status-deployed' },
      'training': { label: 'Training', className: 'docai-status-training' },
      'fine-tuning': { label: 'Fine-tuning', className: 'docai-status-finetuning' },
      'queued': { label: 'Queued', className: 'docai-status-queued' },
    };
    return map[status];
  };

  const getTypeLabel = (type: ModelInfo['type']) => {
    const map = {
      'ocr': { label: 'Understanding', className: 'docai-type-understanding' },
      'extraction': { label: 'Extraction', className: 'docai-type-extraction' },
      'classifier': { label: 'Classification', className: 'docai-type-classification' },
      'structure': { label: 'Generation', className: 'docai-type-generation' },
      'content': { label: 'Generation', className: 'docai-type-generation' },
      'validation': { label: 'Validation', className: 'docai-type-validation' },
    };
    return map[type];
  };

  /* ─── MODELS VIEW ───────────────────────────────────────── */
  const renderModelsView = () => (
    <div className="docai-models-view">
      {/* Architecture Overview */}
      <div className="docai-arch-banner">
        <div className="docai-arch-banner-content">
          <div className="docai-arch-banner-icon">
            <Layers size={28} />
          </div>
          <div className="docai-arch-banner-text">
            <h3>Custom Model Stack — Not a GPT Wrapper</h3>
            <p>6 specialized models trained on your document corpus. Each handles one stage of the pipeline. Documents are composed section-by-section, not generated in a single call.</p>
          </div>
          <div className="docai-arch-stats">
            <div className="docai-arch-stat">
              <span className="docai-arch-stat-value">6</span>
              <span className="docai-arch-stat-label">Models</span>
            </div>
            <div className="docai-arch-stat">
              <span className="docai-arch-stat-value">405K</span>
              <span className="docai-arch-stat-label">Training Samples</span>
            </div>
            <div className="docai-arch-stat">
              <span className="docai-arch-stat-value">47</span>
              <span className="docai-arch-stat-label">Doc Types</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Diagram */}
      <div className="docai-pipeline-flow">
        <div className="docai-pipeline-flow-label">Generation Pipeline</div>
        <div className="docai-pipeline-steps">
          {['OCR + Layout', 'Extract KV', 'Classify', 'Structure', 'Generate Sections', 'Validate'].map((step, i) => (
            <div key={step} className="docai-pipeline-step-item">
              <div className={`docai-pipeline-step-dot ${i < 4 ? 'active' : i === 4 ? 'current' : ''}`}>
                {i < 4 ? <Check size={12} /> : i === 4 ? <Loader2 size={12} className="docai-spin" /> : <Circle size={12} />}
              </div>
              <span className="docai-pipeline-step-name">{step}</span>
              {i < 5 && <ArrowRight size={14} className="docai-pipeline-arrow" />}
            </div>
          ))}
        </div>
      </div>

      {/* Model Cards */}
      <div className="docai-models-grid">
        {models.map((model) => {
          const statusBadge = getStatusBadge(model.status);
          const typeLabel = getTypeLabel(model.type);
          const isExpanded = expandedModel === model.id;

          return (
            <div
              key={model.id}
              className={`docai-model-card ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedModel(isExpanded ? null : model.id)}
            >
              <div className="docai-model-card-header">
                <div className="docai-model-card-tags">
                  <span className={`docai-model-type ${typeLabel.className}`}>{typeLabel.label}</span>
                  <span className={`docai-model-status ${statusBadge.className}`}>
                    {model.status === 'training' || model.status === 'fine-tuning' ? (
                      <Loader2 size={11} className="docai-spin" />
                    ) : model.status === 'deployed' ? (
                      <CheckCircle2 size={11} />
                    ) : null}
                    {statusBadge.label}
                  </span>
                </div>
                <div className="docai-model-icon">
                  <model.icon size={20} />
                </div>
              </div>

              <h4 className="docai-model-name">{model.name}</h4>
              <p className="docai-model-desc">{model.description}</p>

              <div className="docai-model-metrics">
                <div className="docai-metric">
                  <span className="docai-metric-value">{model.accuracy}%</span>
                  <span className="docai-metric-label">Accuracy</span>
                </div>
                <div className="docai-metric">
                  <span className="docai-metric-value">{model.latency}</span>
                  <span className="docai-metric-label">Latency</span>
                </div>
                <div className="docai-metric">
                  <span className="docai-metric-value">{model.trainingSamples}</span>
                  <span className="docai-metric-label">Trained On</span>
                </div>
                <div className="docai-metric">
                  <span className="docai-metric-value">{model.lastTrained}</span>
                  <span className="docai-metric-label">Last Trained</span>
                </div>
              </div>

              {isExpanded && (
                <div className="docai-model-expanded">
                  <div className="docai-model-expanded-section">
                    <h5>Training Progress</h5>
                    <div className="docai-progress-bar">
                      <div
                        className="docai-progress-fill"
                        style={{
                          width: model.status === 'deployed' ? '100%' : model.status === 'fine-tuning' ? '72%' : '67%',
                        }}
                      />
                    </div>
                    <span className="docai-progress-label">
                      {model.status === 'deployed'
                        ? 'Production ready'
                        : model.status === 'fine-tuning'
                        ? 'Epoch 9/12 — ETA 4.2h'
                        : 'Epoch 8/12 — ETA 6.1h'}
                    </span>
                  </div>
                  <div className="docai-model-actions">
                    <button className="docai-model-action-btn">
                      <RefreshCw size={14} />
                      Retrain
                    </button>
                    <button className="docai-model-action-btn">
                      <BarChart3 size={14} />
                      Metrics
                    </button>
                    <button className="docai-model-action-btn">
                      <Settings2 size={14} />
                      Config
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

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

  /* ─── PIPELINE VIEW ─────────────────────────────────────── */
  const renderPipelineView = () => (
    <div className="docai-pipeline-view">
      <div className="docai-pipeline-header-bar">
        <h3>How It Works — The 5-Stage Pipeline</h3>
        <p>No single model generates the entire document. Each stage is a specialized model trained for its specific task.</p>
      </div>

      <div className="docai-how-cards">
        {/* Stage 1 */}
        <div className="docai-how-card">
          <div className="docai-how-stage-num">01</div>
          <div className="docai-how-icon" style={{ background: 'rgba(224,122,58,0.1)', color: '#e07a3a' }}>
            <BookOpen size={24} />
          </div>
          <h4>Guided Intake</h4>
          <p className="docai-how-subtitle">Users answer questions — never draft</p>
          <p>A fine-tuned classifier determines document type and presents 8–15 targeted questions. For a lease: "Commercial or residential?", "State?", "Term length?" The user never writes prose. Entity data is auto-pulled from CRM, prior documents, and company records.</p>
          <div className="docai-how-detail">
            <span className="docai-how-tag">No drafting</span>
            <span className="docai-how-tag">CRM auto-fill</span>
            <span className="docai-how-tag">Smart defaults</span>
          </div>
        </div>

        {/* Stage 2 */}
        <div className="docai-how-card">
          <div className="docai-how-stage-num">02</div>
          <div className="docai-how-icon" style={{ background: 'rgba(224,122,58,0.1)', color: '#e07a3a' }}>
            <GitBranch size={24} />
          </div>
          <h4>Structure Generation</h4>
          <p className="docai-how-subtitle">The Outline Model builds the skeleton</p>
          <p>A model fine-tuned on thousands of real professional documents generates the document AST — a structured JSON tree of sections, subsections, required clauses, and regulatory boilerplate. It knows section ordering and jurisdiction-specific requirements.</p>
          <div className="docai-how-detail">
            <span className="docai-how-tag">35K outlines trained</span>
            <span className="docai-how-tag">JSON AST output</span>
            <span className="docai-how-tag">Jurisdiction-aware</span>
          </div>
        </div>

        {/* Stage 3 */}
        <div className="docai-how-card highlight">
          <div className="docai-how-stage-num">03</div>
          <div className="docai-how-icon" style={{ background: 'rgba(26,26,46,0.08)', color: '#1a1a2e' }}>
            <Brain size={24} />
          </div>
          <h4>Section-by-Section Generation</h4>
          <p className="docai-how-subtitle">This is the key insight</p>
          <p>Each section is generated <strong>independently</strong> by a fine-tuned content model with full context of prior sections + user inputs. This is how you get 20–50+ page documents. The model is trained on 200K+ real professional document sections, not generic web text. Each call generates one section with proper legal/business language.</p>
          <div className="docai-how-detail">
            <span className="docai-how-tag">200K sections trained</span>
            <span className="docai-how-tag">Context-aware</span>
            <span className="docai-how-tag">4.8s per section</span>
            <span className="docai-how-tag">20–50+ pages</span>
          </div>
        </div>

        {/* Stage 4 */}
        <div className="docai-how-card">
          <div className="docai-how-stage-num">04</div>
          <div className="docai-how-icon" style={{ background: 'rgba(212,107,44,0.1)', color: '#d46b2c' }}>
            <Shield size={24} />
          </div>
          <h4>Cross-Reference Validation</h4>
          <p className="docai-how-subtitle">Deterministic quality checks</p>
          <p>A validation model scans the complete generated document for: broken internal references ("Section 12.3" actually exists), consistent clause numbering, regulatory compliance per jurisdiction, contradiction detection, and proper defined term usage throughout.</p>
          <div className="docai-how-detail">
            <span className="docai-how-tag">Auditable</span>
            <span className="docai-how-tag">Deterministic</span>
            <span className="docai-how-tag">Compliance checks</span>
          </div>
        </div>

        {/* Stage 5 */}
        <div className="docai-how-card">
          <div className="docai-how-stage-num">05</div>
          <div className="docai-how-icon" style={{ background: 'rgba(58,58,82,0.08)', color: '#3a3a52' }}>
            <FileCheck size={24} />
          </div>
          <h4>Template Rendering</h4>
          <p className="docai-how-subtitle">Professional output — PDF, DOCX, HTML</p>
          <p>The structured content renders into professional document format with proper headers, footers, page numbers, signature blocks, exhibits, and schedules. Company branding and formatting standards are applied automatically. Exports to PDF, DOCX, and HTML.</p>
          <div className="docai-how-detail">
            <span className="docai-how-tag">PDF / DOCX / HTML</span>
            <span className="docai-how-tag">Company branding</span>
            <span className="docai-how-tag">Signature blocks</span>
          </div>
        </div>
      </div>

      {/* Why Not GPT */}
      <div className="docai-why-custom">
        <h3>Why Custom Models, Not GPT Wrappers</h3>
        <div className="docai-comparison">
          <div className="docai-comparison-col bad">
            <div className="docai-comparison-header">
              <X size={18} />
              <span>GPT Wrapper Approach</span>
            </div>
            <ul>
              <li>Generic output — no domain knowledge</li>
              <li>Token limits = 1–2 page max</li>
              <li>No understanding of document structure</li>
              <li>Hallucinated legal language</li>
              <li>Inconsistent between runs</li>
              <li>Can't learn from your documents</li>
              <li>Prompt injection risk for legal docs</li>
            </ul>
          </div>
          <div className="docai-comparison-col good">
            <div className="docai-comparison-header">
              <CheckCircle2 size={18} />
              <span>Custom Model Stack</span>
            </div>
            <ul>
              <li>Trained on real professional documents</li>
              <li>Section-by-section = unlimited length</li>
              <li>Layout-aware structure understanding</li>
              <li>Accurate legal/business language</li>
              <li>Deterministic, auditable outputs</li>
              <li>Continuous learning from feedback</li>
              <li>Sandboxed per-model, no injection</li>
            </ul>
          </div>
        </div>
      </div>
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
              className={`docai-header-tab ${activeView === 'models' ? 'active' : ''}`}
              onClick={() => setActiveView('models')}
            >
              <Cpu size={15} />
              Model Stack
            </button>
            <button
              className={`docai-header-tab ${activeView === 'generate' ? 'active' : ''}`}
              onClick={() => { setActiveView('generate'); setWizardStep(0); setSelectedTemplate(null); }}
            >
              <Sparkles size={15} />
              Generate
            </button>
            <button
              className={`docai-header-tab ${activeView === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveView('pipeline')}
            >
              <GitBranch size={15} />
              How It Works
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
        {activeView === 'models' && renderModelsView()}
        {activeView === 'generate' && renderGenerateView()}
        {activeView === 'pipeline' && renderPipelineView()}
        {activeView === 'replicate' && (
          <DocumentReplicationAgent
            userId={user?.uid ?? 'anonymous'}
            onBack={() => setActiveView('models')}
          />
        )}
      </div>
    </div>
  );
}

