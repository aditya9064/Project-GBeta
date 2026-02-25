import { useState, useCallback, useRef } from 'react';
import {
  X, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertTriangle,
  GripVertical, Trash2, Plus, Edit2, ChevronDown, ChevronUp, Globe, Brain,
  Cloud, Zap, HardDrive, Clock, Shield, ShieldAlert, ShieldCheck, Eye,
  Rocket, AlertCircle,
} from 'lucide-react';
import { generatePlan, type GeneratedPlan, type PlanStep, type PlanInputField } from '../../services/automation/planGenerator';
import './AgentSetupWizard.css';

interface AgentSetupWizardProps {
  onClose: () => void;
  onDeploy: (plan: GeneratedPlan, userInputs: Record<string, string>) => void;
  isDeploying?: boolean;
}

type WizardStep = 'prompt' | 'review' | 'inputs' | 'confirm';

const stepIcon = (type: string) => {
  switch (type) {
    case 'browser_task': return <Globe size={16} />;
    case 'ai': return <Brain size={16} />;
    case 'app': return <Cloud size={16} />;
    case 'action': return <Zap size={16} />;
    case 'memory': return <HardDrive size={16} />;
    case 'trigger': return <Clock size={16} />;
    default: return <Zap size={16} />;
  }
};

const stepColor = (type: string) => {
  switch (type) {
    case 'browser_task': return '#14b8a6';
    case 'ai': return '#8b5cf6';
    case 'app': return '#3b82f6';
    case 'action': return '#f59e0b';
    case 'memory': return '#06b6d4';
    case 'trigger': return '#7c3aed';
    case 'condition': return '#ef4444';
    default: return '#6b7280';
  }
};

const riskBadge = (level: string) => {
  switch (level) {
    case 'high': return <span className="wizard-risk-badge risk-high"><ShieldAlert size={12} /> High Risk</span>;
    case 'medium': return <span className="wizard-risk-badge risk-medium"><Shield size={12} /> Medium</span>;
    default: return <span className="wizard-risk-badge risk-low"><ShieldCheck size={12} /> Low Risk</span>;
  }
};

export function AgentSetupWizard({ onClose, onDeploy, isDeploying }: AgentSetupWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('prompt');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [addStepAfter, setAddStepAfter] = useState<string | null>(null);
  const [newStepType, setNewStepType] = useState<PlanStep['type']>('browser_task');
  const [newStepDesc, setNewStepDesc] = useState('');

  // Drag and drop state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    // Simulate a brief "thinking" delay for UX
    await new Promise((r) => setTimeout(r, 800));

    const generated = generatePlan(prompt);
    setPlan(generated);
    setIsGenerating(false);
    setWizardStep('review');
  }, [prompt]);

  const handleDeleteStep = useCallback((stepId: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      steps: plan.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })),
    });
  }, [plan]);

  const handleEditStep = useCallback((stepId: string) => {
    if (!plan) return;
    const step = plan.steps.find((s) => s.id === stepId);
    if (step) {
      setEditingStepId(stepId);
      setEditingDescription(step.description);
    }
  }, [plan]);

  const handleSaveEdit = useCallback(() => {
    if (!plan || !editingStepId) return;
    setPlan({
      ...plan,
      steps: plan.steps.map((s) =>
        s.id === editingStepId ? { ...s, description: editingDescription } : s
      ),
    });
    setEditingStepId(null);
    setEditingDescription('');
  }, [plan, editingStepId, editingDescription]);

  const handleAddStep = useCallback(() => {
    if (!plan || !addStepAfter || !newStepDesc.trim()) return;
    const insertIdx = plan.steps.findIndex((s) => s.id === addStepAfter) + 1;
    const newStep: PlanStep = {
      id: `step-custom-${Date.now()}`,
      order: insertIdx + 1,
      type: newStepType,
      action: 'custom',
      description: newStepDesc,
      details: {},
      requiresConfirmation: newStepType === 'browser_task',
      requiresInput: false,
      estimatedDuration: '2-5s',
      riskLevel: newStepType === 'browser_task' ? 'medium' : 'low',
    };

    const updated = [...plan.steps];
    updated.splice(insertIdx, 0, newStep);

    setPlan({
      ...plan,
      steps: updated.map((s, i) => ({ ...s, order: i + 1 })),
    });
    setAddStepAfter(null);
    setNewStepDesc('');
  }, [plan, addStepAfter, newStepType, newStepDesc]);

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (!plan || dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const items = [...plan.steps];
    const dragged = items.splice(dragItem.current, 1)[0];
    items.splice(dragOverItem.current, 0, dragged);

    setPlan({
      ...plan,
      steps: items.map((s, i) => ({ ...s, order: i + 1 })),
    });

    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleToggleConfirmation = (stepId: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      steps: plan.steps.map((s) =>
        s.id === stepId ? { ...s, requiresConfirmation: !s.requiresConfirmation } : s
      ),
    });
  };

  const canProceedToInputs = plan && plan.requiredInputs.length > 0;
  const canProceedToConfirm = plan && (!canProceedToInputs || plan.requiredInputs.every((f) => !f.required || userInputs[f.key]));

  const handleDeploy = () => {
    if (plan) onDeploy(plan, userInputs);
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-header-left">
            <Sparkles size={20} className="wizard-header-icon" />
            <div>
              <h2 className="wizard-title">Create Agent</h2>
              <p className="wizard-subtitle">
                {wizardStep === 'prompt' && 'Describe what you want the agent to do'}
                {wizardStep === 'review' && 'Review and edit the execution plan'}
                {wizardStep === 'inputs' && 'Provide the required information'}
                {wizardStep === 'confirm' && 'Confirm and deploy your agent'}
              </p>
            </div>
          </div>
          <button className="wizard-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Progress */}
        <div className="wizard-progress">
          {(['prompt', 'review', 'inputs', 'confirm'] as WizardStep[]).map((step, i) => (
            <div
              key={step}
              className={`wizard-progress-step ${wizardStep === step ? 'active' : ''} ${
                ['prompt', 'review', 'inputs', 'confirm'].indexOf(wizardStep) > i ? 'done' : ''
              }`}
            >
              <div className="wizard-progress-dot">
                {['prompt', 'review', 'inputs', 'confirm'].indexOf(wizardStep) > i
                  ? <CheckCircle size={14} />
                  : i + 1
                }
              </div>
              <span className="wizard-progress-label">
                {step === 'prompt' ? 'Describe' : step === 'review' ? 'Review Plan' : step === 'inputs' ? 'Details' : 'Deploy'}
              </span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="wizard-content">
          {/* ═══ STEP 1: PROMPT ═══ */}
          {wizardStep === 'prompt' && (
            <div className="wizard-prompt-step">
              <div className="wizard-prompt-examples">
                <p className="wizard-examples-label">Examples:</p>
                <div className="wizard-examples-grid">
                  {[
                    'Order noise-cancelling headphones on Amazon',
                    'Go to LinkedIn and apply to 5 software engineer jobs',
                    'Extract product prices from competitor website',
                    'Fill out the tax form at irs.gov/form1040',
                    'Every morning, check Gmail and summarize unread emails to Slack',
                  ].map((ex) => (
                    <button
                      key={ex}
                      className="wizard-example-btn"
                      onClick={() => setPrompt(ex)}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wizard-prompt-input-wrap">
                <textarea
                  className="wizard-prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want the agent to do..."
                  rows={4}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <button
                  className="wizard-generate-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <><Loader2 size={16} className="spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles size={16} /> Generate Plan</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: REVIEW PLAN ═══ */}
          {wizardStep === 'review' && plan && (
            <div className="wizard-review-step">
              {/* Plan header */}
              <div className="wizard-plan-header">
                <div className="wizard-plan-info">
                  <h3 className="wizard-plan-title">{plan.title}</h3>
                  <p className="wizard-plan-desc">{plan.description}</p>
                  <div className="wizard-plan-meta">
                    {riskBadge(plan.riskAssessment)}
                    <span className="wizard-plan-duration">
                      <Clock size={12} /> ~{plan.estimatedTotalDuration}
                    </span>
                    {plan.requiresBrowser && (
                      <span className="wizard-plan-browser">
                        <Globe size={12} /> Opens browser window
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {plan.warnings.length > 0 && (
                <div className="wizard-warnings">
                  {plan.warnings.map((w, i) => (
                    <div key={i} className="wizard-warning">
                      <AlertTriangle size={14} />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Steps list — drag and drop */}
              <div className="wizard-steps-header">
                <span>Execution Steps ({plan.steps.length})</span>
                <span className="wizard-steps-hint">Drag to reorder, click to expand</span>
              </div>

              <div className="wizard-steps-list">
                {plan.steps.map((step, index) => (
                  <div key={step.id}>
                    <div
                      className={`wizard-step-card ${expandedSteps.has(step.id) ? 'expanded' : ''} ${editingStepId === step.id ? 'editing' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="wizard-step-row" onClick={() => toggleExpand(step.id)}>
                        <div className="wizard-step-grip">
                          <GripVertical size={14} />
                        </div>
                        <div className="wizard-step-number">{step.order}</div>
                        <div className="wizard-step-icon" style={{ color: stepColor(step.type), background: `${stepColor(step.type)}14` }}>
                          {stepIcon(step.type)}
                        </div>
                        <div className="wizard-step-info">
                          {editingStepId === step.id ? (
                            <input
                              className="wizard-step-edit-input"
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') setEditingStepId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className="wizard-step-desc">{step.description}</span>
                          )}
                          <span className="wizard-step-type">{step.type.replace('_', ' ')}</span>
                        </div>
                        <div className="wizard-step-badges">
                          {step.requiresConfirmation && (
                            <span className="wizard-badge wizard-badge-confirm" title="Pauses for your approval">
                              <Eye size={10} /> Confirm
                            </span>
                          )}
                          {step.riskLevel === 'high' && (
                            <span className="wizard-badge wizard-badge-risk">
                              <ShieldAlert size={10} />
                            </span>
                          )}
                        </div>
                        <div className="wizard-step-actions" onClick={(e) => e.stopPropagation()}>
                          {editingStepId === step.id ? (
                            <button className="wizard-step-action-btn save" onClick={handleSaveEdit} title="Save">
                              <CheckCircle size={14} />
                            </button>
                          ) : (
                            <button className="wizard-step-action-btn" onClick={() => handleEditStep(step.id)} title="Edit">
                              <Edit2 size={14} />
                            </button>
                          )}
                          <button className="wizard-step-action-btn" onClick={() => handleDeleteStep(step.id)} title="Remove">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="wizard-step-expand">
                          {expandedSteps.has(step.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedSteps.has(step.id) && (
                        <div className="wizard-step-details">
                          <div className="wizard-step-detail-row">
                            <span className="wizard-detail-label">Type:</span>
                            <span>{step.type.replace('_', ' ')}</span>
                          </div>
                          <div className="wizard-step-detail-row">
                            <span className="wizard-detail-label">Est. Duration:</span>
                            <span>{step.estimatedDuration}</span>
                          </div>
                          <div className="wizard-step-detail-row">
                            <span className="wizard-detail-label">Risk:</span>
                            {riskBadge(step.riskLevel)}
                          </div>
                          <div className="wizard-step-detail-row">
                            <label className="wizard-detail-checkbox">
                              <input
                                type="checkbox"
                                checked={step.requiresConfirmation}
                                onChange={() => handleToggleConfirmation(step.id)}
                              />
                              Pause for confirmation before this step
                            </label>
                          </div>
                          {step.inputFields && step.inputFields.length > 0 && (
                            <div className="wizard-step-detail-row">
                              <span className="wizard-detail-label">Requires input:</span>
                              <span>{step.inputFields.map((f) => f.label).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add step button between steps */}
                    {addStepAfter === step.id ? (
                      <div className="wizard-add-step-form">
                        <select
                          className="wizard-add-step-select"
                          value={newStepType}
                          onChange={(e) => setNewStepType(e.target.value as PlanStep['type'])}
                        >
                          <option value="browser_task">Browser Task</option>
                          <option value="ai">AI Processing</option>
                          <option value="app">App Integration</option>
                          <option value="action">Action</option>
                          <option value="memory">Memory</option>
                          <option value="delay">Wait / Delay</option>
                          <option value="condition">Condition</option>
                        </select>
                        <input
                          className="wizard-add-step-input"
                          value={newStepDesc}
                          onChange={(e) => setNewStepDesc(e.target.value)}
                          placeholder="Describe what this step should do..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStep();
                            if (e.key === 'Escape') setAddStepAfter(null);
                          }}
                        />
                        <button className="wizard-add-step-confirm" onClick={handleAddStep} disabled={!newStepDesc.trim()}>
                          <Plus size={14} /> Add
                        </button>
                        <button className="wizard-add-step-cancel" onClick={() => setAddStepAfter(null)}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="wizard-add-step-trigger"
                        onClick={() => { setAddStepAfter(step.id); setNewStepDesc(''); }}
                      >
                        <Plus size={12} /> Add step here
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ STEP 3: INPUTS ═══ */}
          {wizardStep === 'inputs' && plan && (
            <div className="wizard-inputs-step">
              <div className="wizard-inputs-intro">
                <AlertCircle size={16} />
                <span>Fill in these details so the agent knows exactly what to do.</span>
              </div>

              <div className="wizard-inputs-form">
                {plan.requiredInputs.map((field) => (
                  <div key={field.key} className="wizard-input-group">
                    <label className="wizard-input-label">
                      {field.label}
                      {field.required && <span className="wizard-required">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        className="wizard-input-field"
                        value={userInputs[field.key] || ''}
                        onChange={(e) => setUserInputs({ ...userInputs, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        rows={3}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        className="wizard-input-field"
                        value={userInputs[field.key] || ''}
                        onChange={(e) => setUserInputs({ ...userInputs, [field.key]: e.target.value })}
                      >
                        <option value="">Select...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        className="wizard-input-field"
                        value={userInputs[field.key] || ''}
                        onChange={(e) => setUserInputs({ ...userInputs, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ STEP 4: CONFIRM ═══ */}
          {wizardStep === 'confirm' && plan && (
            <div className="wizard-confirm-step">
              <div className="wizard-confirm-card">
                <div className="wizard-confirm-icon">
                  <Rocket size={32} />
                </div>
                <h3>Ready to Deploy</h3>
                <p className="wizard-confirm-name">{plan.title}</p>
                <p className="wizard-confirm-desc">{plan.description}</p>

                <div className="wizard-confirm-summary">
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val">{plan.steps.length}</span>
                    <span className="wizard-confirm-stat-label">Steps</span>
                  </div>
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val">{plan.steps.filter((s) => s.requiresConfirmation).length}</span>
                    <span className="wizard-confirm-stat-label">Checkpoints</span>
                  </div>
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val">{plan.estimatedTotalDuration}</span>
                    <span className="wizard-confirm-stat-label">Est. Duration</span>
                  </div>
                </div>

                {plan.requiresBrowser && (
                  <div className="wizard-confirm-note">
                    <Globe size={14} />
                    <span>This agent will open a <strong>separate browser window</strong> so it won't interfere with your work.</span>
                  </div>
                )}

                {plan.warnings.length > 0 && (
                  <div className="wizard-confirm-warnings">
                    {plan.warnings.map((w, i) => (
                      <div key={i} className="wizard-warning">
                        <AlertTriangle size={14} />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="wizard-footer">
          <div className="wizard-footer-left">
            {wizardStep !== 'prompt' && (
              <button
                className="wizard-btn wizard-btn-back"
                onClick={() => {
                  if (wizardStep === 'review') setWizardStep('prompt');
                  if (wizardStep === 'inputs') setWizardStep('review');
                  if (wizardStep === 'confirm') setWizardStep(canProceedToInputs ? 'inputs' : 'review');
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
          </div>
          <div className="wizard-footer-right">
            {wizardStep === 'review' && (
              <button
                className="wizard-btn wizard-btn-next"
                onClick={() => setWizardStep(canProceedToInputs ? 'inputs' : 'confirm')}
              >
                {canProceedToInputs ? 'Fill in Details' : 'Review & Deploy'} <ArrowRight size={16} />
              </button>
            )}
            {wizardStep === 'inputs' && (
              <button
                className="wizard-btn wizard-btn-next"
                onClick={() => setWizardStep('confirm')}
                disabled={!canProceedToConfirm}
              >
                Review & Deploy <ArrowRight size={16} />
              </button>
            )}
            {wizardStep === 'confirm' && (
              <button
                className="wizard-btn wizard-btn-deploy"
                onClick={handleDeploy}
                disabled={isDeploying}
              >
                {isDeploying ? (
                  <><Loader2 size={16} className="spin" /> Deploying...</>
                ) : (
                  <><Rocket size={16} /> Deploy Agent</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
