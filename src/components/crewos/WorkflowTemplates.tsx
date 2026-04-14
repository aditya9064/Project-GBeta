import { useState, useCallback } from 'react';
import {
  Users,
  FileText,
  Search,
  Mail,
  Database,
  Play,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';
import { useSwarm } from '../../hooks/useComputerUse';
import { useNavigate } from 'react-router-dom';

interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
  tags: string[];
  goalTemplate: string;
  parameters: TemplateParameter[];
}

interface TemplateParameter {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea';
  required: boolean;
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'lead-processing',
    title: 'Lead Processing & Follow-up',
    description: 'Extract leads from a source, enrich contact data, and draft personalized follow-up emails for approval.',
    icon: Users,
    tags: ['Sales', 'Email', 'CRM'],
    goalTemplate: 'Process leads from {source}. For each lead, enrich their profile with company info, then draft a personalized follow-up email based on this context: {context}. Queue all emails for my approval before sending.',
    parameters: [
      { id: 'source', label: 'Lead Source', placeholder: 'e.g. spreadsheet on Desktop, LinkedIn page, CRM export', type: 'text', required: true },
      { id: 'context', label: 'Email Context', placeholder: 'e.g. We met at TechCrunch Disrupt and discussed our AI platform', type: 'textarea', required: true },
    ],
  },
  {
    id: 'invoice-processing',
    title: 'Invoice Processing',
    description: 'Extract data from invoice PDFs, validate amounts, and input into your accounting application.',
    icon: FileText,
    tags: ['Finance', 'Data Entry', 'Desktop'],
    goalTemplate: 'Process invoices from {location}. Extract vendor name, invoice number, date, line items, and total amount from each invoice. Validate the data, then enter it into {target_app}.',
    parameters: [
      { id: 'location', label: 'Invoice Location', placeholder: 'e.g. Downloads folder, email attachments, specific folder path', type: 'text', required: true },
      { id: 'target_app', label: 'Target Application', placeholder: 'e.g. QuickBooks, Xero, Google Sheets', type: 'text', required: true },
    ],
  },
  {
    id: 'research-report',
    title: 'Research & Report',
    description: 'Research a topic across the web, synthesize findings, and generate a comprehensive summary document.',
    icon: Search,
    tags: ['Research', 'Writing', 'Browser'],
    goalTemplate: 'Research the following topic thoroughly: {topic}. {instructions} Compile findings into a well-structured document with sections, key findings, data points, and citations. Save the final report as a document on the Desktop.',
    parameters: [
      { id: 'topic', label: 'Research Topic', placeholder: 'e.g. Competitive landscape for AI coding assistants in 2026', type: 'text', required: true },
      { id: 'instructions', label: 'Special Instructions', placeholder: 'e.g. Focus on pricing, features, and market share. Include at least 5 competitors.', type: 'textarea', required: false },
    ],
  },
  {
    id: 'email-triage',
    title: 'Email Triage & Response',
    description: 'Scan your inbox, categorize emails by priority, and draft responses for your review.',
    icon: Mail,
    tags: ['Email', 'Communication', 'Desktop'],
    goalTemplate: 'Open {email_app} and scan the inbox. Categorize emails into: Urgent (needs immediate response), Important (needs response today), Low Priority (can wait), and FYI (no response needed). For urgent and important emails, draft appropriate responses. {additional}',
    parameters: [
      { id: 'email_app', label: 'Email Application', placeholder: 'e.g. Gmail in Chrome, Apple Mail, Outlook', type: 'text', required: true },
      { id: 'additional', label: 'Additional Instructions', placeholder: 'e.g. Ignore marketing emails. Flag anything from investors.', type: 'textarea', required: false },
    ],
  },
  {
    id: 'data-entry',
    title: 'Data Entry & Transfer',
    description: 'Extract data from spreadsheets or PDFs and input into a target application systematically.',
    icon: Database,
    tags: ['Data Entry', 'Desktop', 'Automation'],
    goalTemplate: 'Extract data from {source_file}. The data contains {data_description}. Input each record into {target_app}, following the application\'s form layout. Verify each entry after submission.',
    parameters: [
      { id: 'source_file', label: 'Source File', placeholder: 'e.g. contacts.csv on Desktop, inventory spreadsheet in Google Sheets', type: 'text', required: true },
      { id: 'data_description', label: 'Data Description', placeholder: 'e.g. customer names, addresses, phone numbers, and order history', type: 'textarea', required: true },
      { id: 'target_app', label: 'Target Application', placeholder: 'e.g. Salesforce, internal CRM, SAP', type: 'text', required: true },
    ],
  },
];

export default function WorkflowTemplates() {
  const { startSwarm } = useSwarm();
  const navigate = useNavigate();
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.swarm;

  const template = activeTemplate
    ? WORKFLOW_TEMPLATES.find(t => t.id === activeTemplate) || null
    : null;

  const handleSelect = useCallback((id: string) => {
    setActiveTemplate(id);
    setParams({});
  }, []);

  const handleClose = useCallback(() => {
    setActiveTemplate(null);
    setParams({});
  }, []);

  const handleExecute = useCallback(async () => {
    if (!template || submitting) return;

    const missingRequired = template.parameters
      .filter(p => p.required && !params[p.id]?.trim());

    if (missingRequired.length > 0) return;

    let goal = template.goalTemplate;
    for (const param of template.parameters) {
      goal = goal.replace(`{${param.id}}`, params[param.id]?.trim() || '(not specified)');
    }

    setSubmitting(true);
    try {
      const swarmId = await startSwarm(goal, { enableGui: true, maxWorkers: 5 });
      if (swarmId) {
        handleClose();
        navigate('/execution');
      }
    } catch (err) {
      console.error('Failed to start workflow:', err);
    } finally {
      setSubmitting(false);
    }
  }, [template, params, submitting, startSwarm, navigate, handleClose]);

  return (
    <div className="oa-workflows-page">
      <h2>Pre-Built Workflows</h2>
      <p>Select a workflow template to get started quickly. Fill in the parameters and execute.</p>

      {!template ? (
        <div className="oa-workflow-grid">
          {WORKFLOW_TEMPLATES.map(wf => (
            <div
              key={wf.id}
              className="oa-workflow-card"
              onClick={() => handleSelect(wf.id)}
            >
              <div className="oa-workflow-icon">
                <wf.icon size={22} />
              </div>
              <h3>{wf.title}</h3>
              <p>{wf.description}</p>
              <div className="oa-workflow-tags">
                {wf.tags.map(tag => (
                  <span key={tag} className="oa-workflow-tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="oa-goal-form" style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{template.title}</h3>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--oa-text-muted)', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <p style={{ color: 'var(--oa-text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            {template.description}
          </p>

          {template.parameters.map(param => (
            <div key={param.id} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--oa-text)' }}>
                {param.label} {param.required && <span style={{ color: 'var(--oa-error)' }}>*</span>}
              </label>
              {param.type === 'textarea' ? (
                <textarea
                  className="oa-goal-textarea"
                  style={{ minHeight: 80 }}
                  value={params[param.id] || ''}
                  onChange={e => setParams(prev => ({ ...prev, [param.id]: e.target.value }))}
                  placeholder={param.placeholder}
                />
              ) : (
                <input
                  type="text"
                  className="oa-goal-textarea"
                  style={{ minHeight: 'auto', padding: '10px 14px', resize: 'none' }}
                  value={params[param.id] || ''}
                  onChange={e => setParams(prev => ({ ...prev, [param.id]: e.target.value }))}
                  placeholder={param.placeholder}
                />
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="oa-ctrl-btn" onClick={handleClose}>Cancel</button>
            <button
              className="oa-execute-btn"
              onClick={handleExecute}
              disabled={submitting || !isDesktop}
            >
              {submitting ? (
                <><Loader2 size={16} className="oa-spin" /> Starting...</>
              ) : (
                <><Play size={16} /> Execute Workflow</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
