import { useState, useEffect } from 'react';
import { X, Trash2, Settings, Save } from 'lucide-react';
import { WorkflowNode, availableApps, knowledgeBaseTypes, triggerTypes, actionTypes } from './WorkflowBuilder';
import './NodeConfigPanel.css';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onClose: () => void;
  onUpdate: (node: WorkflowNode) => void;
  onDelete: () => void;
}

export function NodeConfigPanel({ node, onClose, onUpdate, onDelete }: NodeConfigPanelProps) {
  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description || '');
  const [config, setConfig] = useState(node.data.config || {});

  useEffect(() => {
    setLabel(node.data.label);
    setDescription(node.data.description || '');
    setConfig(node.data.config || {});
  }, [node]);

  const handleSave = () => {
    const updatedNode: WorkflowNode = {
      ...node,
      data: {
        ...node.data,
        label,
        description,
        config,
      },
    };
    onUpdate(updatedNode);
  };

  const handleAppChange = (appId: string) => {
    const app = availableApps.find(a => a.id === appId);
    if (app) {
      setLabel(app.name);
      setConfig({ ...config, appType: appId });
    }
  };

  const handleKnowledgeBaseChange = (kbId: string) => {
    const kb = knowledgeBaseTypes.find(k => k.id === kbId);
    if (kb) {
      setLabel(kb.name);
      setConfig({ ...config, knowledgeBaseId: kbId });
    }
  };

  const handleTriggerChange = (triggerId: string) => {
    const trigger = triggerTypes.find(t => t.id === triggerId);
    if (trigger) {
      setLabel(trigger.name);
      setConfig({ ...config, triggerType: triggerId });
    }
  };

  const handleActionChange = (actionId: string) => {
    const action = actionTypes.find(a => a.id === actionId);
    if (action) {
      setLabel(action.name);
      setConfig({ ...config, actionType: actionId });
    }
  };

  return (
    <div className="node-config-panel">
      <div className="node-config-header">
        <div className="node-config-header-left">
          <Settings size={18} />
          <span>Configure Node</span>
        </div>
        <button className="node-config-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="node-config-content">
        <div className="node-config-section">
          <label className="node-config-label">Label</label>
          <input
            type="text"
            className="node-config-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="node-config-section">
          <label className="node-config-label">Description</label>
          <textarea
            className="node-config-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {node.data.type === 'app' && (
          <div className="node-config-section">
            <label className="node-config-label">App</label>
            <select
              className="node-config-select"
              value={node.data.appType || ''}
              onChange={(e) => handleAppChange(e.target.value)}
            >
              {availableApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.type === 'knowledge' && (
          <div className="node-config-section">
            <label className="node-config-label">Knowledge Base</label>
            <select
              className="node-config-select"
              value={node.data.knowledgeBaseId || ''}
              onChange={(e) => handleKnowledgeBaseChange(e.target.value)}
            >
              {knowledgeBaseTypes.map((kb) => (
                <option key={kb.id} value={kb.id}>
                  {kb.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.type === 'trigger' && (
          <div className="node-config-section">
            <label className="node-config-label">Trigger Type</label>
            <select
              className="node-config-select"
              value={config.triggerType || ''}
              onChange={(e) => handleTriggerChange(e.target.value)}
            >
              {triggerTypes.map((trigger) => (
                <option key={trigger.id} value={trigger.id}>
                  {trigger.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.type === 'action' && (
          <div className="node-config-section">
            <label className="node-config-label">Action Type</label>
            <select
              className="node-config-select"
              value={config.actionType || ''}
              onChange={(e) => handleActionChange(e.target.value)}
            >
              {actionTypes.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.type === 'ai' && (
          <div className="node-config-section">
            <label className="node-config-label">AI Prompt</label>
            <textarea
              className="node-config-textarea"
              value={config.prompt || ''}
              onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
              placeholder="Describe what the AI should do..."
              rows={4}
            />
          </div>
        )}
      </div>

      <div className="node-config-footer">
        <button className="node-config-btn node-config-btn-danger" onClick={onDelete}>
          <Trash2 size={16} />
          Delete
        </button>
        <button className="node-config-btn node-config-btn-primary" onClick={handleSave}>
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
}

