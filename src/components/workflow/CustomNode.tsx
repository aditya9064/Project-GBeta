import { Handle, Position, useReactFlow } from '@xyflow/react';
import { memo, useCallback } from 'react';
import type { WorkflowNode } from './WorkflowBuilder';
import { availableApps, triggerTypes, actionTypes, knowledgeBaseTypes } from './WorkflowBuilder';
import {
  Bell, Cloud, Database, Zap, Brain, HelpCircle, HardDrive, GitBranch, Globe,
  ChevronDown,
} from 'lucide-react';

interface CustomNodeProps {
  id: string;
  data: WorkflowNode['data'];
  selected?: boolean;
}

const DefaultIcon = ({ type }: { type: string }) => {
  const size = 16;
  switch (type) {
    case 'trigger': return <Bell size={size} />;
    case 'app': return <Cloud size={size} />;
    case 'knowledge': return <Database size={size} />;
    case 'action': return <Zap size={size} />;
    case 'ai': return <Brain size={size} />;
    case 'memory': return <HardDrive size={size} />;
    case 'agent_call': return <GitBranch size={size} />;
    case 'browser_task': return <Globe size={size} />;
    default: return <HelpCircle size={size} />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'trigger': return 'Trigger';
    case 'app': return 'App Integration';
    case 'knowledge': return 'Knowledge Base';
    case 'action': return 'Action';
    case 'ai': return 'AI Processing';
    case 'memory': return 'Memory';
    case 'agent_call': return 'Agent Call';
    case 'browser_task': return 'Browser Task';
    default: return 'Node';
  }
};

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

export const CustomNode = memo(({ id, data, selected }: CustomNodeProps) => {
  const { updateNodeData } = useReactFlow();

  const getNodeColor = () => {
    switch (data.type) {
      case 'trigger': return '#7c3aed';
      case 'app': return '#3b82f6';
      case 'knowledge': return '#e07a3a';
      case 'action': return '#f59e0b';
      case 'ai': return '#8b5cf6';
      case 'memory': return '#06b6d4';
      case 'agent_call': return '#ec4899';
      case 'browser_task': return '#14b8a6';
      default: return '#6b7280';
    }
  };

  const nodeColor = getNodeColor();
  const config = data.config || {};

  const updateConfig = useCallback((patch: Record<string, any>) => {
    updateNodeData(id, { config: { ...config, ...patch } });
  }, [id, config, updateNodeData]);

  const updateNestedConfig = useCallback((key: string, patch: Record<string, any>) => {
    updateNodeData(id, {
      config: { ...config, [key]: { ...(config[key] || {}), ...patch } },
    });
  }, [id, config, updateNodeData]);

  const updateLabel = useCallback((label: string) => {
    updateNodeData(id, { label });
  }, [id, updateNodeData]);

  const renderFields = () => {
    switch (data.type) {
      case 'trigger':
        return <TriggerFields config={config} updateConfig={updateConfig} updateLabel={updateLabel} />;
      case 'app':
        return <AppFields config={config} appType={data.appType} updateConfig={updateConfig} updateNestedConfig={updateNestedConfig} updateLabel={updateLabel} nodeId={id} />;
      case 'ai':
        return <AIFields config={config} updateConfig={updateConfig} />;
      case 'memory':
        return <MemoryFields config={config} updateConfig={updateConfig} />;
      case 'browser_task':
        return <BrowserTaskFields config={config} updateConfig={updateConfig} />;
      case 'agent_call':
        return <AgentCallFields config={config} updateConfig={updateConfig} />;
      case 'action':
        return <ActionFields config={config} updateConfig={updateConfig} updateLabel={updateLabel} />;
      case 'knowledge':
        return <KnowledgeFields config={config} updateConfig={updateConfig} updateLabel={updateLabel} knowledgeBaseId={data.knowledgeBaseId} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{ borderLeftColor: nodeColor }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="custom-node-header">
        <div
          className="custom-node-icon"
          style={{ color: nodeColor, background: `${nodeColor}14` }}
        >
          {data.icon || <DefaultIcon type={data.type} />}
        </div>
        <div className="custom-node-info">
          <div className="custom-node-type" style={{ color: nodeColor }}>{getTypeLabel(data.type)}</div>
          <div className="custom-node-label">{data.label}</div>
        </div>
      </div>

      <div className="custom-node-fields" onMouseDown={stop} onClick={stop} onPointerDown={stop}>
        {renderFields()}
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

/* ─── Field components per node type ─── */

interface FieldProps {
  config: Record<string, any>;
  updateConfig: (patch: Record<string, any>) => void;
}

function NodeField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cn-field">
      <label className="cn-field-label">{label}</label>
      {children}
    </div>
  );
}

function NodeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="cn-select-wrap">
      <select className="cn-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="cn-select-chevron" />
    </div>
  );
}

function NodeInput({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      className="cn-input"
      type={type || 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function NodeTextarea({ value, onChange, placeholder, rows }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      className="cn-textarea"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 2}
    />
  );
}

/* ─── Trigger ─── */
function TriggerFields({ config, updateConfig, updateLabel }: FieldProps & { updateLabel: (l: string) => void }) {
  const triggerType = config.triggerType || 'webhook';
  return (
    <>
      <NodeField label="Type">
        <NodeSelect
          value={triggerType}
          onChange={v => {
            const t = triggerTypes.find(tt => tt.id === v);
            updateConfig({ triggerType: v });
            if (t) updateLabel(t.name);
          }}
          options={triggerTypes.map(t => ({ value: t.id, label: t.name }))}
        />
      </NodeField>
      {triggerType === 'schedule' && (
        <NodeField label="Frequency">
          <NodeSelect
            value={config.frequency || 'daily'}
            onChange={v => updateConfig({ frequency: v })}
            options={[
              { value: 'hourly', label: 'Every hour' },
              { value: 'daily', label: 'Every day' },
              { value: 'weekly', label: 'Every week' },
              { value: 'monthly', label: 'Every month' },
            ]}
          />
        </NodeField>
      )}
      {triggerType === 'email' && (
        <NodeField label="Filter">
          <NodeInput
            value={config.emailFilter || ''}
            onChange={v => updateConfig({ emailFilter: v })}
            placeholder="e.g. from:boss@company.com"
          />
        </NodeField>
      )}
      {triggerType === 'webhook' && (
        <NodeField label="URL">
          <NodeInput
            value={config.webhookUrl || ''}
            onChange={() => {}}
            placeholder="Generated after deploy"
          />
        </NodeField>
      )}
      {triggerType === 'form' && (
        <NodeField label="Form Name">
          <NodeInput
            value={config.formName || ''}
            onChange={v => updateConfig({ formName: v })}
            placeholder="Contact form, Survey, etc."
          />
        </NodeField>
      )}
    </>
  );
}

/* ─── App ─── */
function AppFields({ config, appType, updateConfig, updateNestedConfig, updateLabel }: FieldProps & { appType?: string; updateNestedConfig: (key: string, patch: Record<string, any>) => void; updateLabel: (l: string) => void; nodeId: string }) {
  const currentApp = appType || config.appType || 'gmail';

  return (
    <>
      <NodeField label="App">
        <NodeSelect
          value={currentApp}
          onChange={v => {
            const app = availableApps.find(a => a.id === v);
            const newConfig: Record<string, any> = { appType: v };
            if (v === 'gmail') newConfig.gmail = { action: 'send', to: '', subject: '', body: '' };
            else if (v === 'slack') newConfig.slack = { action: 'send_message', channel: '', message: '' };
            updateConfig(newConfig);
            if (app) updateLabel(app.name);
          }}
          options={availableApps.map(a => ({ value: a.id, label: a.name }))}
        />
      </NodeField>

      {currentApp === 'gmail' && (
        <>
          <NodeField label="Action">
            <NodeSelect
              value={config.gmail?.action || 'send'}
              onChange={v => updateNestedConfig('gmail', { action: v })}
              options={[
                { value: 'send', label: 'Send Email' },
                { value: 'read', label: 'Read Emails' },
                { value: 'reply', label: 'Reply' },
              ]}
            />
          </NodeField>
          {config.gmail?.action === 'send' && (
            <>
              <NodeField label="To">
                <NodeInput value={config.gmail?.to || ''} onChange={v => updateNestedConfig('gmail', { ...config.gmail, to: v })} placeholder="recipient@example.com" />
              </NodeField>
              <NodeField label="Subject">
                <NodeInput value={config.gmail?.subject || ''} onChange={v => updateNestedConfig('gmail', { ...config.gmail, subject: v })} placeholder="Email subject" />
              </NodeField>
              <NodeField label="Body">
                <NodeTextarea value={config.gmail?.body || ''} onChange={v => updateNestedConfig('gmail', { ...config.gmail, body: v })} placeholder="Email body..." rows={3} />
              </NodeField>
            </>
          )}
          {config.gmail?.action === 'read' && (
            <NodeField label="Search Query">
              <NodeInput value={config.gmail?.query || ''} onChange={v => updateNestedConfig('gmail', { ...config.gmail, query: v })} placeholder="is:unread from:example.com" />
            </NodeField>
          )}
          {config.gmail?.action === 'reply' && (
            <NodeField label="Reply Body">
              <NodeTextarea value={config.gmail?.body || ''} onChange={v => updateNestedConfig('gmail', { ...config.gmail, body: v })} placeholder="Reply message..." rows={3} />
            </NodeField>
          )}
        </>
      )}

      {currentApp === 'slack' && (
        <>
          <NodeField label="Action">
            <NodeSelect
              value={config.slack?.action || 'send_message'}
              onChange={v => updateNestedConfig('slack', { action: v })}
              options={[
                { value: 'send_message', label: 'Send Message' },
                { value: 'read_messages', label: 'Read Messages' },
              ]}
            />
          </NodeField>
          {config.slack?.action === 'send_message' && (
            <>
              <NodeField label="Channel">
                <NodeInput value={config.slack?.channel || ''} onChange={v => updateNestedConfig('slack', { ...config.slack, channel: v })} placeholder="#general" />
              </NodeField>
              <NodeField label="Message">
                <NodeTextarea value={config.slack?.message || ''} onChange={v => updateNestedConfig('slack', { ...config.slack, message: v })} placeholder="Message text..." rows={2} />
              </NodeField>
            </>
          )}
        </>
      )}

      {currentApp === 'notion' && (
        <NodeField label="Action">
          <NodeSelect
            value={config.notion?.action || 'create_page'}
            onChange={v => updateNestedConfig('notion', { action: v })}
            options={[
              { value: 'create_page', label: 'Create Page' },
              { value: 'update_page', label: 'Update Page' },
            ]}
          />
        </NodeField>
      )}
    </>
  );
}

/* ─── AI ─── */
function AIFields({ config, updateConfig }: FieldProps) {
  return (
    <>
      <NodeField label="Prompt">
        <NodeTextarea
          value={config.prompt || ''}
          onChange={v => updateConfig({ prompt: v })}
          placeholder="Describe what the AI should do..."
          rows={3}
        />
      </NodeField>
      <NodeField label="Model">
        <NodeSelect
          value={config.model || 'gpt-4'}
          onChange={v => updateConfig({ model: v })}
          options={[
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          ]}
        />
      </NodeField>
      <NodeField label={`Temperature (${config.temperature ?? 0.7})`}>
        <input
          className="cn-range"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.temperature ?? 0.7}
          onChange={e => updateConfig({ temperature: parseFloat(e.target.value) })}
        />
        <div className="cn-range-labels">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </NodeField>
    </>
  );
}

/* ─── Memory ─── */
function MemoryFields({ config, updateConfig }: FieldProps) {
  return (
    <>
      <NodeField label="Action">
        <NodeSelect
          value={config.action || 'write'}
          onChange={v => updateConfig({ action: v })}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'read', label: 'Read' },
            { value: 'search', label: 'Search' },
            { value: 'delete', label: 'Delete' },
          ]}
        />
      </NodeField>
      <NodeField label="Scope">
        <NodeSelect
          value={config.scope || 'agent'}
          onChange={v => updateConfig({ scope: v })}
          options={[
            { value: 'session', label: 'Session' },
            { value: 'agent', label: 'Agent' },
            { value: 'shared', label: 'Shared' },
          ]}
        />
      </NodeField>
      {(config.action === 'write' || config.action === 'read' || config.action === 'delete') && (
        <NodeField label="Key">
          <NodeInput value={config.key || ''} onChange={v => updateConfig({ key: v })} placeholder="e.g. last_summary" />
        </NodeField>
      )}
      {config.action === 'search' && (
        <NodeField label="Query">
          <NodeInput value={config.query || ''} onChange={v => updateConfig({ query: v })} placeholder="Search keywords..." />
        </NodeField>
      )}
    </>
  );
}

/* ─── Browser Task ─── */
function BrowserTaskFields({ config, updateConfig }: FieldProps) {
  return (
    <>
      <NodeField label="Action">
        <NodeSelect
          value={config.action || 'navigate'}
          onChange={v => updateConfig({ action: v })}
          options={[
            { value: 'navigate', label: 'Navigate to URL' },
            { value: 'click', label: 'Click Element' },
            { value: 'type', label: 'Type Text' },
            { value: 'search', label: 'Search' },
            { value: 'login', label: 'Login' },
            { value: 'extract', label: 'Extract Data' },
            { value: 'screenshot', label: 'Screenshot' },
            { value: 'scroll', label: 'Scroll' },
            { value: 'wait', label: 'Wait' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </NodeField>
      {(config.action === 'navigate' || config.action === 'login') && (
        <NodeField label="URL">
          <NodeInput value={config.url || ''} onChange={v => updateConfig({ url: v })} placeholder="https://example.com" type="url" />
        </NodeField>
      )}
      {(config.action === 'click' || config.action === 'type' || config.action === 'extract') && (
        <NodeField label="Selector">
          <NodeInput value={config.selector || ''} onChange={v => updateConfig({ selector: v })} placeholder="#id or .class" />
        </NodeField>
      )}
      {(config.action === 'type' || config.action === 'search') && (
        <NodeField label="Value">
          <NodeInput value={config.value || ''} onChange={v => updateConfig({ value: v })} placeholder="Text to type..." />
        </NodeField>
      )}
      <NodeField label="Description">
        <NodeInput value={config.description || ''} onChange={v => updateConfig({ description: v })} placeholder="What does this step do?" />
      </NodeField>
    </>
  );
}

/* ─── Agent Call ─── */
function AgentCallFields({ config, updateConfig }: FieldProps) {
  return (
    <>
      <NodeField label="Target Agent ID">
        <NodeInput
          value={config.targetAgentId || ''}
          onChange={v => updateConfig({ targetAgentId: v })}
          placeholder="Agent ID to call"
        />
      </NodeField>
      <NodeField label="Timeout (sec)">
        <NodeInput
          value={String(config.timeoutSeconds || 30)}
          onChange={v => updateConfig({ timeoutSeconds: parseInt(v) || 30 })}
          type="number"
        />
      </NodeField>
    </>
  );
}

/* ─── Action ─── */
function ActionFields({ config, updateConfig, updateLabel }: FieldProps & { updateLabel: (l: string) => void }) {
  return (
    <NodeField label="Action Type">
      <NodeSelect
        value={config.actionType || 'send-email'}
        onChange={v => {
          const a = actionTypes.find(at => at.id === v);
          updateConfig({ actionType: v });
          if (a) updateLabel(a.name);
        }}
        options={actionTypes.map(a => ({ value: a.id, label: a.name }))}
      />
    </NodeField>
  );
}

/* ─── Knowledge ─── */
function KnowledgeFields({ config, updateConfig, updateLabel, knowledgeBaseId }: FieldProps & { updateLabel: (l: string) => void; knowledgeBaseId?: string }) {
  return (
    <NodeField label="Source">
      <NodeSelect
        value={knowledgeBaseId || config.knowledgeBaseId || 'documents'}
        onChange={v => {
          const kb = knowledgeBaseTypes.find(k => k.id === v);
          updateConfig({ knowledgeBaseId: v });
          if (kb) updateLabel(kb.name);
        }}
        options={knowledgeBaseTypes.map(kb => ({ value: kb.id, label: kb.name }))}
      />
    </NodeField>
  );
}
