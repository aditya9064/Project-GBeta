import { useState, useCallback, useRef } from 'react';
import {
  X, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle, AlertTriangle,
  GripVertical, Trash2, Plus, Edit2, ChevronDown, ChevronUp, Globe, Brain,
  Cloud, Zap, HardDrive, Clock, Shield, ShieldAlert, ShieldCheck, Eye,
  Rocket, AlertCircle, Cpu, Mail, Calendar, Link, Play, Timer,
} from 'lucide-react';
import { generatePlan, generateAgentFromPrompt, type GeneratedPlan, type PlanStep, type PlanInputField, type AIGeneratedAgent } from '../../services/automation/planGenerator';
import type { WorkflowDefinition } from '../../services/automation/types';
import { executeWorkflow, type ExecutionResult } from '../../services/automation/executionEngine';
import { log } from '../../utils/logger';
import './AgentSetupWizard.css';

type TriggerSelection = 'manual' | 'schedule' | 'email' | 'webhook';
type ScheduleFrequency = 'every_5m' | 'every_15m' | 'every_hour' | 'every_day' | 'every_week';

interface TriggerConfig {
  type: TriggerSelection;
  schedule?: ScheduleFrequency;
  scheduleDay?: string;
  scheduleTime?: string;
}

interface AgentSetupWizardProps {
  onClose: () => void;
  onDeploy: (plan: GeneratedPlan, userInputs: Record<string, string>, trigger?: TriggerConfig) => void;
  onDeployWorkflow?: (name: string, description: string, workflow: WorkflowDefinition, userInputs: Record<string, string>, trigger?: TriggerConfig) => void;
  isDeploying?: boolean;
}

type WizardStep = 'prompt' | 'review' | 'inputs' | 'trigger' | 'confirm';

const stepIcon = (type: string) => {
  switch (type) {
    case 'browser_task': return <Globe size={16} />;
    case 'vision_browse': return <Eye size={16} />;
    case 'desktop_task': return <Cpu size={16} />;
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
    case 'vision_browse': return '#0891b2';
    case 'desktop_task': return '#d946ef';
    case 'ai': return '#e07a3a';
    case 'app': return '#0ea5e9';
    case 'action': return '#f59e0b';
    case 'memory': return '#06b6d4';
    case 'trigger': return '#d46b2c';
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

export function AgentSetupWizard({ onClose, onDeploy, onDeployWorkflow, isDeploying }: AgentSetupWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>('prompt');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [aiResult, setAiResult] = useState<AIGeneratedAgent | null>(null);
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [addStepAfter, setAddStepAfter] = useState<string | null>(null);
  const [newStepType, setNewStepType] = useState<PlanStep['type']>('browser_task');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerSelection>('manual');
  const [scheduleFrequency, setScheduleFrequency] = useState<ScheduleFrequency>('every_hour');
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ExecutionResult | null>(null);

  // Drag and drop state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStatus('Understanding your request...');

    try {
      // Try AI-powered generation first
      setGenerationStatus('Generating workflow with AI...');
      const result = await generateAgentFromPrompt(prompt);

      if (result.success && result.workflow.nodes.length > 0) {
        setAiResult(result);
        // Convert AI result to plan format for the review step
        const aiPlan: GeneratedPlan = {
          title: result.name,
          description: result.description,
          steps: result.workflow.nodes.map((node, i) => ({
            id: node.id,
            order: i + 1,
            type: (node.type === 'action' || node.type === 'code' || node.type === 'set' ? 'action' : node.type) as PlanStep['type'],
            action: node.config?.action || node.config?.actionType || node.type,
            description: node.description || node.label,
            details: node.config || {},
            requiresConfirmation: node.config?.requiresConfirmation || false,
            requiresInput: false,
            estimatedDuration: '2-5s',
            riskLevel: node.type === 'browser_task' ? 'medium' : 'low',
          })),
          requiredInputs: result.requiredInputs,
          warnings: result.warnings,
          estimatedTotalDuration: result.estimatedDuration,
          requiresBrowser: result.requiresBrowser,
          riskAssessment: result.riskAssessment,
        };
        setPlan(aiPlan);
        setWizardStep('review');
      } else {
        throw new Error(result.error || 'Generation returned empty workflow');
      }
    } catch (err: any) {
      log.warn('AI generation failed, falling back:', err.message);
      setGenerationStatus('Using local generation...');
      // Fallback to keyword-based
      const generated = generatePlan(prompt);
      setPlan(generated);
      setAiResult(null);
      setWizardStep('review');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
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

  const triggerConfig: TriggerConfig = { type: triggerType, schedule: scheduleFrequency, scheduleDay, scheduleTime };

  const handleDeploy = () => {
    if (!plan) return;

    if (aiResult && onDeployWorkflow) {
      onDeployWorkflow(aiResult.name, aiResult.description, aiResult.workflow, userInputs, triggerConfig);
      return;
    }

    onDeploy(plan, userInputs, triggerConfig);
  };

  const handleTestRun = useCallback(async () => {
    if (!plan) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const workflow: WorkflowDefinition = aiResult
        ? aiResult.workflow
        : {
            nodes: plan.steps.map((step) => ({
              id: step.id,
              type: step.type as any,
              label: step.description,
              position: { x: 0, y: 0 },
              config: step.details || {},
              description: step.description,
            })),
            edges: plan.steps.slice(1).map((step, i) => ({
              id: `e-${plan.steps[i].id}-${step.id}`,
              source: plan.steps[i].id,
              target: step.id,
            })),
          };
      const result = await executeWorkflow(
        `test-${Date.now()}`,
        'local-user',
        workflow,
        'manual',
        userInputs,
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message, logs: [] });
    } finally {
      setIsTesting(false);
    }
  }, [plan, aiResult, userInputs]);

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
                {wizardStep === 'trigger' && 'Choose when this agent should run'}
                {wizardStep === 'confirm' && 'Confirm and deploy your agent'}
              </p>
            </div>
          </div>
          <button className="wizard-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Progress */}
        <div className="wizard-progress">
          {(['prompt', 'review', 'inputs', 'trigger', 'confirm'] as WizardStep[]).map((step, i) => (
            <div
              key={step}
              className={`wizard-progress-step ${wizardStep === step ? 'active' : ''} ${
                ['prompt', 'review', 'inputs', 'trigger', 'confirm'].indexOf(wizardStep) > i ? 'done' : ''
              }`}
            >
              <div className="wizard-progress-dot">
                {['prompt', 'review', 'inputs', 'trigger', 'confirm'].indexOf(wizardStep) > i
                  ? <CheckCircle size={14} />
                  : i + 1
                }
              </div>
              <span className="wizard-progress-label">
                {step === 'prompt' ? 'Describe' : step === 'review' ? 'Review' : step === 'inputs' ? 'Details' : step === 'trigger' ? 'Trigger' : 'Deploy'}
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
                  placeholder="Describe what you want the agent to do in plain English..."
                  rows={4}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                {generationError && (
                  <div className="wizard-warning" style={{ margin: 0 }}>
                    <AlertTriangle size={14} />
                    <span>{generationError}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {isGenerating && generationStatus ? (
                    <span style={{ fontSize: '13px', color: '#e07a3a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Loader2 size={14} className="spin" /> {generationStatus}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={12} /> Powered by AI — generates complete executable workflows
                    </span>
                  )}
                  <button
                    className="wizard-generate-btn"
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating}
                  >
                    {isGenerating ? (
                      <><Loader2 size={16} className="spin" /> Generating...</>
                    ) : (
                      <><Sparkles size={16} /> Generate Agent</>
                    )}
                  </button>
                </div>
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
                  {aiResult?.explanation && (
                    <p style={{ fontSize: '13px', color: '#4b5563', margin: '4px 0 8px', lineHeight: 1.5, background: '#f0fdf4', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      {aiResult.explanation}
                    </p>
                  )}
                  <div className="wizard-plan-meta">
                    {aiResult && (
                      <span className="wizard-risk-badge risk-low" style={{ background: '#fef3eb', color: '#c05d1e' }}>
                        <Cpu size={12} /> AI Generated
                      </span>
                    )}
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

          {/* ═══ STEP 4: CONFIGURE TRIGGER ═══ */}
          {wizardStep === 'trigger' && plan && (
            <div className="wizard-trigger-step">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Timer size={20} style={{ color: '#e07a3a' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f3f4f6' }}>When should this agent run?</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>Choose how this agent gets triggered</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {([
                  { value: 'manual' as TriggerSelection, icon: <Play size={18} />, label: 'Manual', desc: 'Run on demand from the dashboard' },
                  { value: 'schedule' as TriggerSelection, icon: <Calendar size={18} />, label: 'Schedule', desc: 'Run automatically on a schedule' },
                  { value: 'email' as TriggerSelection, icon: <Mail size={18} />, label: 'Email Trigger', desc: 'Run when matching emails arrive' },
                  { value: 'webhook' as TriggerSelection, icon: <Link size={18} />, label: 'Webhook', desc: 'Run via HTTP webhook URL' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    className={`wizard-trigger-option ${triggerType === opt.value ? 'selected' : ''}`}
                    onClick={() => setTriggerType(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                      background: triggerType === opt.value ? '#1e293b' : '#111827',
                      border: triggerType === opt.value ? '2px solid #e07a3a' : '1px solid #374151',
                      borderRadius: '10px', cursor: 'pointer', width: '100%', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ color: triggerType === opt.value ? '#e07a3a' : '#6b7280', flexShrink: 0 }}>{opt.icon}</div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: triggerType === opt.value ? '#f3f4f6' : '#d1d5db' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {triggerType === 'schedule' && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#111827', borderRadius: '10px', border: '1px solid #374151' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#d1d5db', marginBottom: '8px', display: 'block' }}>Frequency</label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => setScheduleFrequency(e.target.value as ScheduleFrequency)}
                    style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6', fontSize: '14px', marginBottom: '12px' }}
                  >
                    <option value="every_5m">Every 5 minutes</option>
                    <option value="every_15m">Every 15 minutes</option>
                    <option value="every_hour">Every hour</option>
                    <option value="every_day">Every day at a specific time</option>
                    <option value="every_week">Every week on a specific day</option>
                  </select>
                  {(scheduleFrequency === 'every_day' || scheduleFrequency === 'every_week') && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {scheduleFrequency === 'every_week' && (
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>Day</label>
                          <select
                            value={scheduleDay}
                            onChange={(e) => setScheduleDay(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6', fontSize: '14px' }}
                          >
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => (
                              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>Time</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', background: '#1e293b', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {triggerType === 'webhook' && (
                <div style={{ marginTop: '16px', padding: '14px 16px', background: '#172554', borderRadius: '10px', border: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Link size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#93c5fd' }}>A webhook URL will be generated after deployment</span>
                </div>
              )}

              {triggerType === 'email' && (
                <div style={{ marginTop: '16px', padding: '14px 16px', background: '#172554', borderRadius: '10px', border: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#93c5fd' }}>Agent will trigger when matching emails arrive</span>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 5: CONFIRM ═══ */}
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
                    <span className="wizard-confirm-stat-val">{aiResult ? aiResult.workflow.nodes.length : plan.steps.length}</span>
                    <span className="wizard-confirm-stat-label">{aiResult ? 'Nodes' : 'Steps'}</span>
                  </div>
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val">{plan.steps.filter((s) => s.requiresConfirmation).length}</span>
                    <span className="wizard-confirm-stat-label">Checkpoints</span>
                  </div>
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val">{plan.estimatedTotalDuration}</span>
                    <span className="wizard-confirm-stat-label">Est. Duration</span>
                  </div>
                  <div className="wizard-confirm-stat">
                    <span className="wizard-confirm-stat-val" style={{ color: '#e07a3a', textTransform: 'capitalize' }}>{triggerType}</span>
                    <span className="wizard-confirm-stat-label">Trigger</span>
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

                {/* Credential check */}
                {(() => {
                  const serviceKeywords = ['gmail', 'slack', 'notion', 'sheets', 'drive', 'calendar', 'trello', 'jira', 'github', 'outlook', 'teams', 'discord', 'asana', 'hubspot', 'salesforce', 'twilio', 'sendgrid', 'stripe'];
                  const neededServices = new Set<string>();
                  plan.steps.forEach((step) => {
                    const text = `${step.action} ${step.description} ${JSON.stringify(step.details)}`.toLowerCase();
                    serviceKeywords.forEach((svc) => {
                      if (text.includes(svc)) neededServices.add(svc);
                    });
                    if (step.type === 'app') {
                      const appName = (step.details?.app || step.details?.service || step.action || '').toLowerCase();
                      if (appName && appName !== 'custom') neededServices.add(appName);
                    }
                  });
                  if (neededServices.size === 0) return null;
                  return (
                    <div style={{ margin: '16px 0 0', padding: '12px 16px', background: '#451a03', borderRadius: '10px', border: '1px solid #92400e', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <AlertTriangle size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fcd34d', marginBottom: '4px' }}>Services may need credentials</div>
                        <div style={{ fontSize: '12px', color: '#fde68a', lineHeight: 1.5 }}>
                          This workflow references: <strong>{[...neededServices].join(', ')}</strong>. Make sure these services are connected in your account settings before running.
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Trigger summary */}
                <div style={{ margin: '16px 0 0', padding: '12px 16px', background: '#111827', borderRadius: '10px', border: '1px solid #374151', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Timer size={16} style={{ color: '#e07a3a' }} />
                  <span style={{ fontSize: '13px', color: '#d1d5db' }}>
                    <strong style={{ color: '#f3f4f6' }}>Trigger:</strong>{' '}
                    {triggerType === 'manual' && 'Manual \u2014 run on demand'}
                    {triggerType === 'schedule' && `Scheduled \u2014 ${
                      scheduleFrequency === 'every_5m' ? 'every 5 minutes' :
                      scheduleFrequency === 'every_15m' ? 'every 15 minutes' :
                      scheduleFrequency === 'every_hour' ? 'every hour' :
                      scheduleFrequency === 'every_day' ? `daily at ${scheduleTime}` :
                      `weekly on ${scheduleDay} at ${scheduleTime}`
                    }`}
                    {triggerType === 'email' && 'Email \u2014 when matching emails arrive'}
                    {triggerType === 'webhook' && 'Webhook \u2014 via HTTP request'}
                  </span>
                </div>

                {/* Test result panel */}
                {testResult && (
                  <div style={{ margin: '16px 0 0', padding: '14px 16px', background: testResult.success ? '#052e16' : '#450a0a', borderRadius: '10px', border: `1px solid ${testResult.success ? '#166534' : '#991b1b'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: testResult.logs.length > 0 ? '10px' : '0' }}>
                      {testResult.success
                        ? <CheckCircle size={16} style={{ color: '#4ade80' }} />
                        : <AlertCircle size={16} style={{ color: '#f87171' }} />
                      }
                      <span style={{ fontSize: '14px', fontWeight: 600, color: testResult.success ? '#4ade80' : '#f87171' }}>
                        {testResult.success ? 'Test Passed' : 'Test Failed'}
                      </span>
                      {testResult.error && (
                        <span style={{ fontSize: '12px', color: '#fca5a5', marginLeft: 'auto' }}>{testResult.error}</span>
                      )}
                    </div>
                    {testResult.logs.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {testResult.logs.map((l, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                            {l.status === 'completed' && <CheckCircle size={12} style={{ color: '#4ade80' }} />}
                            {l.status === 'failed' && <AlertCircle size={12} style={{ color: '#f87171' }} />}
                            {l.status === 'skipped' && <ArrowRight size={12} style={{ color: '#6b7280' }} />}
                            {l.status === 'running' && <Loader2 size={12} className="spin" style={{ color: '#60a5fa' }} />}
                            {l.status === 'awaiting_input' && <Clock size={12} style={{ color: '#fbbf24' }} />}
                            <span style={{ color: '#d1d5db' }}>{l.nodeName}</span>
                            <span style={{ color: '#6b7280', marginLeft: 'auto' }}>{l.status}{l.duration ? ` \u00B7 ${l.duration}ms` : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
                  if (wizardStep === 'trigger') setWizardStep(canProceedToInputs ? 'inputs' : 'review');
                  if (wizardStep === 'confirm') setWizardStep('trigger');
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
                onClick={() => setWizardStep(canProceedToInputs ? 'inputs' : 'trigger')}
              >
                {canProceedToInputs ? 'Fill in Details' : 'Configure Trigger'} <ArrowRight size={16} />
              </button>
            )}
            {wizardStep === 'inputs' && (
              <button
                className="wizard-btn wizard-btn-next"
                onClick={() => setWizardStep('trigger')}
                disabled={!canProceedToConfirm}
              >
                Configure Trigger <ArrowRight size={16} />
              </button>
            )}
            {wizardStep === 'trigger' && (
              <button
                className="wizard-btn wizard-btn-next"
                onClick={() => setWizardStep('confirm')}
              >
                Review & Deploy <ArrowRight size={16} />
              </button>
            )}
            {wizardStep === 'confirm' && (
              <>
                <button
                  className="wizard-btn wizard-btn-back"
                  onClick={handleTestRun}
                  disabled={isTesting || isDeploying}
                  style={{ borderColor: '#e07a3a', color: '#f0a060' }}
                >
                  {isTesting ? (
                    <><Loader2 size={16} className="spin" /> Testing...</>
                  ) : (
                    <><Play size={16} /> Test Run</>
                  )}
                </button>
                <button
                  className="wizard-btn wizard-btn-deploy"
                  onClick={handleDeploy}
                  disabled={isDeploying || isTesting}
                >
                  {isDeploying ? (
                    <><Loader2 size={16} className="spin" /> Deploying...</>
                  ) : (
                    <><Rocket size={16} /> Deploy Agent</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
