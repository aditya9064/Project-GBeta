/**
 * WorkflowSetupModal — Configuration wizard that appears after importing a template.
 * 
 * Extracts all user-configurable fields from every node in the workflow
 * and presents them in one clean form so users can fill in emails,
 * channels, prompts, etc. before deploying.
 */

import { useState, useMemo } from 'react';
import {
  X, Mail, MessageSquare, Brain, Globe, Clock, Zap, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp, Settings, ArrowRight
} from 'lucide-react';
import type { WorkflowDefinition, WorkflowNodeData } from '../../services/automation/types';
import './WorkflowSetupModal.css';

/* ═══ Types ═══════════════════════════════════════════════ */

interface ConfigField {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  appType?: string;
  fieldKey: string;       // path in config, e.g. "gmail.to"
  label: string;          // human-readable label
  placeholder: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'number';
  required: boolean;
  options?: { value: string; label: string }[];
  value: string;
  group: string;          // grouping label (e.g., "Gmail — Send Email")
  icon: 'mail' | 'slack' | 'ai' | 'trigger' | 'http' | 'generic';
}

interface WorkflowSetupModalProps {
  workflow: WorkflowDefinition;
  templateName: string;
  onComplete: (updatedWorkflow: WorkflowDefinition) => void;
  onSkip: () => void;
  onClose: () => void;
}

/* ═══ Field extraction ════════════════════════════════════ */

function extractConfigFields(workflow: WorkflowDefinition): ConfigField[] {
  const fields: ConfigField[] = [];

  for (const node of workflow.nodes) {
    const config = node.config as any;

    // ── Gmail ──
    if (config?.appType === 'gmail' || node.type === 'app' && config?.gmail) {
      const gmail = config.gmail || {};
      const action = gmail.action || 'send';
      const group = `Gmail — ${action === 'send' ? 'Send Email' : action === 'read' ? 'Read Emails' : action === 'reply' ? 'Reply to Email' : action}`;

      if (action === 'send') {
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'gmail', fieldKey: 'gmail.to', label: 'Recipient Email',
          placeholder: 'recipient@example.com',
          type: 'email', required: true, value: gmail.to || '',
          group, icon: 'mail',
        });
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'gmail', fieldKey: 'gmail.subject', label: 'Subject',
          placeholder: 'Email subject line',
          type: 'text', required: false, value: gmail.subject || '',
          group, icon: 'mail',
        });
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'gmail', fieldKey: 'gmail.body', label: 'Email Body',
          placeholder: 'Type your email message here...',
          type: 'textarea', required: false, value: gmail.body || '',
          group, icon: 'mail',
        });
      }
      if (action === 'read') {
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'gmail', fieldKey: 'gmail.query', label: 'Search Query',
          placeholder: 'e.g. is:unread from:boss@company.com',
          type: 'text', required: false, value: gmail.query || '',
          group, icon: 'mail',
        });
      }
      if (action === 'reply') {
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'gmail', fieldKey: 'gmail.body', label: 'Reply Body',
          placeholder: 'Type your reply message...',
          type: 'textarea', required: false, value: gmail.body || '',
          group, icon: 'mail',
        });
      }
    }

    // ── Slack ──
    if (config?.appType === 'slack' || node.type === 'app' && config?.slack) {
      const slack = config.slack || {};
      const action = slack.action || 'send_message';
      const group = `Slack — ${action === 'send_message' ? 'Send Message' : action}`;

      if (action === 'send_message') {
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'slack', fieldKey: 'slack.channel', label: 'Channel',
          placeholder: '#general or channel ID',
          type: 'text', required: true, value: slack.channel || '',
          group, icon: 'slack',
        });
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'slack', fieldKey: 'slack.message', label: 'Message',
          placeholder: 'Type message to send...',
          type: 'textarea', required: false, value: slack.message || '',
          group, icon: 'slack',
        });
      }
    }

    // ── AI Processing ──
    if (node.type === 'ai') {
      const group = `AI Processing — ${node.label}`;
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'prompt', label: 'AI Prompt',
        placeholder: 'Describe what the AI should do...',
        type: 'textarea', required: true, value: config?.prompt || '',
        group, icon: 'ai',
      });
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'systemPrompt', label: 'System Prompt (optional)',
        placeholder: 'Set AI persona / instructions...',
        type: 'textarea', required: false, value: config?.systemPrompt || '',
        group, icon: 'ai',
      });
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'model', label: 'Model',
        placeholder: '',
        type: 'select', required: false, value: config?.model || 'gpt-4',
        options: [
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        ],
        group, icon: 'ai',
      });
    }

    // ── HTTP / Webhook nodes ──
    if (config?.appType === 'http' || config?.appType === 'webhook' || config?.http) {
      const http = config.http || {};
      const group = `HTTP Request — ${node.label}`;
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        appType: 'http', fieldKey: 'http.url', label: 'URL',
        placeholder: 'https://api.example.com/endpoint',
        type: 'text', required: true, value: http.url || '',
        group, icon: 'http',
      });
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        appType: 'http', fieldKey: 'http.method', label: 'Method',
        placeholder: '',
        type: 'select', required: false, value: http.method || 'GET',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
          { value: 'PATCH', label: 'PATCH' },
        ],
        group, icon: 'http',
      });
    }

    // ── Trigger (schedule) ──
    if (node.type === 'trigger' && config?.triggerType === 'schedule') {
      const group = `Trigger — Schedule`;
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'frequency', label: 'Frequency',
        placeholder: '',
        type: 'select', required: false, value: config?.frequency || 'daily',
        options: [
          { value: 'hourly', label: 'Every Hour' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
        ],
        group, icon: 'trigger',
      });
    }

    // ── Trigger (email filter) ──
    if (node.type === 'trigger' && config?.triggerType === 'email') {
      const group = `Trigger — Email`;
      const emailFilter = config?.emailFilter || {};
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'emailFilter.from', label: 'From (filter)',
        placeholder: 'sender@example.com (leave empty for all)',
        type: 'email', required: false, value: emailFilter.from || '',
        group, icon: 'trigger',
      });
      fields.push({
        nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
        fieldKey: 'emailFilter.subject', label: 'Subject Contains',
        placeholder: 'e.g. "Invoice" (leave empty for all)',
        type: 'text', required: false, value: emailFilter.subject || '',
        group, icon: 'trigger',
      });
    }

    // ── Notion ──
    if (config?.appType === 'notion' || config?.notion) {
      const notion = config.notion || {};
      const group = `Notion — ${node.label}`;
      if (notion.databaseId !== undefined || notion.action === 'query_database') {
        fields.push({
          nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
          appType: 'notion', fieldKey: 'notion.databaseId', label: 'Database ID',
          placeholder: 'Your Notion database ID',
          type: 'text', required: false, value: notion.databaseId || '',
          group, icon: 'generic',
        });
      }
    }

    // ── Action nodes (send email / send message) ──
    if (node.type === 'action') {
      const actionType = config?.actionType;
      if (actionType === 'send_email' || actionType === 'send-email') {
        const group = `Action — Send Email`;
        if (!fields.some(f => f.nodeId === node.id && f.fieldKey === 'to')) {
          fields.push({
            nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
            fieldKey: 'to', label: 'Recipient Email',
            placeholder: 'recipient@example.com',
            type: 'email', required: true, value: config?.to || '',
            group, icon: 'mail',
          });
          fields.push({
            nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
            fieldKey: 'subject', label: 'Subject',
            placeholder: 'Email subject',
            type: 'text', required: false, value: config?.subject || '',
            group, icon: 'mail',
          });
          fields.push({
            nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
            fieldKey: 'body', label: 'Body',
            placeholder: 'Email body...',
            type: 'textarea', required: false, value: config?.body || '',
            group, icon: 'mail',
          });
        }
      }
      if (actionType === 'send_message') {
        const group = `Action — Send Message`;
        if (!fields.some(f => f.nodeId === node.id && f.fieldKey === 'channel')) {
          fields.push({
            nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
            fieldKey: 'channel', label: 'Channel',
            placeholder: '#general',
            type: 'text', required: true, value: config?.channel || '',
            group, icon: 'slack',
          });
          fields.push({
            nodeId: node.id, nodeLabel: node.label, nodeType: node.type,
            fieldKey: 'message', label: 'Message',
            placeholder: 'Message text...',
            type: 'textarea', required: false, value: config?.message || '',
            group, icon: 'slack',
          });
        }
      }
    }
  }

  return fields;
}

/* ═══ Apply field values back to workflow ═════════════════ */

function applyFieldValues(
  workflow: WorkflowDefinition,
  fieldValues: Record<string, string>
): WorkflowDefinition {
  const updatedNodes = workflow.nodes.map(node => {
    const config = { ...(node.config as any) };
    let changed = false;

    for (const [key, value] of Object.entries(fieldValues)) {
      // key format: "nodeId::fieldKey"
      const [nodeId, fieldKey] = key.split('::');
      if (nodeId !== node.id) continue;

      // Set nested value
      const parts = fieldKey.split('.');
      if (parts.length === 1) {
        config[parts[0]] = value;
      } else if (parts.length === 2) {
        if (!config[parts[0]]) config[parts[0]] = {};
        config[parts[0]][parts[1]] = value;
      }
      changed = true;
    }

    if (changed) {
      return { ...node, config };
    }
    return node;
  });

  return { ...workflow, nodes: updatedNodes };
}

/* ═══ Icon helper ═════════════════════════════════════════ */

function GroupIcon({ icon }: { icon: ConfigField['icon'] }) {
  switch (icon) {
    case 'mail': return <Mail size={18} />;
    case 'slack': return <MessageSquare size={18} />;
    case 'ai': return <Brain size={18} />;
    case 'trigger': return <Zap size={18} />;
    case 'http': return <Globe size={18} />;
    default: return <Settings size={18} />;
  }
}

/* ═══ Component ═══════════════════════════════════════════ */

export function WorkflowSetupModal({ workflow, templateName, onComplete, onSkip, onClose }: WorkflowSetupModalProps) {
  const fields = useMemo(() => extractConfigFields(workflow), [workflow]);

  // Initialize field values
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[`${f.nodeId}::${f.fieldKey}`] = f.value;
    }
    return initial;
  });

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Expand all groups by default
    return new Set(fields.map(f => f.group));
  });

  // Group fields by their group label
  const groupedFields = useMemo(() => {
    const groups = new Map<string, ConfigField[]>();
    for (const f of fields) {
      const existing = groups.get(f.group) || [];
      existing.push(f);
      groups.set(f.group, existing);
    }
    return groups;
  }, [fields]);

  const handleFieldChange = (nodeId: string, fieldKey: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [`${nodeId}::${fieldKey}`]: value }));
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleComplete = () => {
    const updatedWorkflow = applyFieldValues(workflow, fieldValues);
    onComplete(updatedWorkflow);
  };

  // Count filled required fields
  const requiredFields = fields.filter(f => f.required);
  const filledRequired = requiredFields.filter(f => {
    const val = fieldValues[`${f.nodeId}::${f.fieldKey}`];
    return val && val.trim().length > 0;
  });

  const allRequiredFilled = filledRequired.length === requiredFields.length;

  // If no configurable fields found, auto-skip
  if (fields.length === 0) {
    return (
      <div className="wfs-overlay" onClick={onClose}>
        <div className="wfs-modal wfs-modal-small" onClick={e => e.stopPropagation()}>
          <div className="wfs-empty">
            <CheckCircle size={48} />
            <h3>Template Ready!</h3>
            <p>"{templateName}" has no fields that need configuration. It's ready to deploy.</p>
            <button className="wfs-btn wfs-btn-primary" onClick={onSkip}>
              Continue to Builder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wfs-overlay" onClick={onClose}>
      <div className="wfs-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wfs-header">
          <div className="wfs-header-left">
            <div className="wfs-header-icon">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="wfs-title">Configure Your Workflow</h2>
              <p className="wfs-subtitle">
                Fill in the details below for "{templateName}"
              </p>
            </div>
          </div>
          <button className="wfs-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        {requiredFields.length > 0 && (
          <div className="wfs-progress-bar">
            <div className="wfs-progress-info">
              <span>{filledRequired.length} of {requiredFields.length} required fields completed</span>
              {allRequiredFilled && <CheckCircle size={14} className="wfs-progress-check" />}
            </div>
            <div className="wfs-progress-track">
              <div
                className="wfs-progress-fill"
                style={{ width: `${requiredFields.length > 0 ? (filledRequired.length / requiredFields.length) * 100 : 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Field Groups */}
        <div className="wfs-body">
          {Array.from(groupedFields.entries()).map(([group, groupFields]) => {
            const isExpanded = expandedGroups.has(group);
            const icon = groupFields[0].icon;
            const requiredInGroup = groupFields.filter(f => f.required);
            const filledInGroup = requiredInGroup.filter(f => {
              const val = fieldValues[`${f.nodeId}::${f.fieldKey}`];
              return val && val.trim().length > 0;
            });

            return (
              <div key={group} className="wfs-group">
                <button className="wfs-group-header" onClick={() => toggleGroup(group)}>
                  <div className="wfs-group-header-left">
                    <GroupIcon icon={icon} />
                    <span className="wfs-group-name">{group}</span>
                    {requiredInGroup.length > 0 && (
                      <span className={`wfs-group-badge ${filledInGroup.length === requiredInGroup.length ? 'complete' : 'incomplete'}`}>
                        {filledInGroup.length === requiredInGroup.length ? (
                          <><CheckCircle size={12} /> Done</>
                        ) : (
                          <>{filledInGroup.length}/{requiredInGroup.length}</>
                        )}
                      </span>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isExpanded && (
                  <div className="wfs-group-content">
                    {groupFields.map(field => {
                      const fieldId = `${field.nodeId}::${field.fieldKey}`;
                      const val = fieldValues[fieldId] || '';

                      return (
                        <div key={fieldId} className="wfs-field">
                          <label className="wfs-field-label">
                            {field.label}
                            {field.required && <span className="wfs-required">*</span>}
                          </label>

                          {field.type === 'textarea' ? (
                            <textarea
                              className="wfs-input wfs-textarea"
                              value={val}
                              onChange={e => handleFieldChange(field.nodeId, field.fieldKey, e.target.value)}
                              placeholder={field.placeholder}
                              rows={3}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              className="wfs-input wfs-select"
                              value={val}
                              onChange={e => handleFieldChange(field.nodeId, field.fieldKey, e.target.value)}
                            >
                              {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type}
                              className="wfs-input"
                              value={val}
                              onChange={e => handleFieldChange(field.nodeId, field.fieldKey, e.target.value)}
                              placeholder={field.placeholder}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="wfs-footer">
          <button className="wfs-btn wfs-btn-ghost" onClick={onSkip}>
            Skip — I'll configure later
          </button>
          <button
            className="wfs-btn wfs-btn-primary"
            onClick={handleComplete}
          >
            <ArrowRight size={16} />
            {allRequiredFilled ? 'Apply & Continue' : 'Continue Anyway'}
          </button>
        </div>

        {/* Warning for missing required fields */}
        {!allRequiredFilled && (
          <div className="wfs-warning">
            <AlertCircle size={14} />
            <span>Some required fields are empty. You can still continue and fill them in later by clicking on individual nodes.</span>
          </div>
        )}
      </div>
    </div>
  );
}

