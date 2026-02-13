import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Plus, 
  Sparkles, 
  Zap, 
  Database, 
  Mail, 
  Calendar, 
  FileText, 
  MessageSquare,
  Settings,
  Play,
  Save,
  X,
  Trash2,
  Edit,
  Link as LinkIcon,
  Brain,
  Cloud,
  Globe,
  Folder,
  Code,
  BarChart3,
  Users,
  ShoppingCart,
  CreditCard,
  Bell,
  Clock,
  Filter,
  ArrowRight,
  CheckCircle2,
  PanelLeft,
  Rocket,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { WorkflowDefinition, WorkflowNodeData, WorkflowEdge } from '../../services/automation/types';
import './WorkflowBuilder.css';
import { CustomNode } from './CustomNode';
import { PromptModal } from './PromptModal';
import { NodeConfigPanel } from './NodeConfigPanel';

// Node types
export type NodeType = 'trigger' | 'action' | 'app' | 'knowledge' | 'condition' | 'ai';

export interface WorkflowNode extends Node {
  data: {
    label: string;
    type: NodeType;
    icon?: React.ReactNode;
    description?: string;
    config?: Record<string, any>;
    appType?: string;
    knowledgeBaseId?: string;
  };
}

const nodeTypes = {
  custom: CustomNode,
};

// Available apps for integration
export const availableApps = [
  { id: 'gmail', name: 'Gmail', icon: Mail, color: '#EA4335' },
  { id: 'calendar', name: 'Google Calendar', icon: Calendar, color: '#4285F4' },
  { id: 'slack', name: 'Slack', icon: MessageSquare, color: '#4A154B' },
  { id: 'notion', name: 'Notion', icon: FileText, color: '#000000' },
  { id: 'salesforce', name: 'Salesforce', icon: Cloud, color: '#00A1E0' },
  { id: 'hubspot', name: 'HubSpot', icon: BarChart3, color: '#FF7A59' },
  { id: 'shopify', name: 'Shopify', icon: ShoppingCart, color: '#96BF48' },
  { id: 'stripe', name: 'Stripe', icon: CreditCard, color: '#635BFF' },
  { id: 'zendesk', name: 'Zendesk', icon: MessageSquare, color: '#03363D' },
  { id: 'github', name: 'GitHub', icon: Code, color: '#181717' },
];

// Knowledge base types
export const knowledgeBaseTypes = [
  { id: 'documents', name: 'Documents', icon: FileText, color: '#6366F1' },
  { id: 'wiki', name: 'Wiki', icon: Globe, color: '#8B5CF6' },
  { id: 'database', name: 'Database', icon: Database, color: '#10B981' },
  { id: 'api', name: 'API', icon: Code, color: '#F59E0B' },
];

// Trigger types
export const triggerTypes = [
  { id: 'webhook', name: 'Webhook', icon: LinkIcon, color: '#3B82F6' },
  { id: 'schedule', name: 'Schedule', icon: Clock, color: '#10B981' },
  { id: 'email', name: 'Email', icon: Mail, color: '#EA4335' },
  { id: 'form', name: 'Form Submission', icon: FileText, color: '#8B5CF6' },
  { id: 'event', name: 'Event', icon: Bell, color: '#F59E0B' },
];

// Action types
export const actionTypes = [
  { id: 'send-email', name: 'Send Email', icon: Mail, color: '#EA4335' },
  { id: 'create-task', name: 'Create Task', icon: CheckCircle2, color: '#10B981' },
  { id: 'update-record', name: 'Update Record', icon: Edit, color: '#3B82F6' },
  { id: 'send-notification', name: 'Send Notification', icon: Bell, color: '#F59E0B' },
  { id: 'ai-process', name: 'AI Process', icon: Brain, color: '#8B5CF6' },
  { id: 'filter', name: 'Filter', icon: Filter, color: '#6366F1' },
];

interface WorkflowBuilderProps {
  onSave?: (workflow: { nodes: Node[]; edges: Edge[] }) => void;
  onClose?: () => void;
  initialWorkflow?: { nodes: Node[]; edges: Edge[] };
  onToggleSidebar?: () => void;
  onDeploy?: (name: string, description: string, workflow: WorkflowDefinition) => Promise<void>;
  isDeploying?: boolean;
}

export function WorkflowBuilder({ onSave, onClose, initialWorkflow, onToggleSidebar, onDeploy, isDeploying }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.edges || []);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [workflowName, setWorkflowName] = useState('New Automation');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ 
        ...params, 
        type: 'smoothstep', 
        animated: true, 
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#8b5cf6',
        },
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      }, eds));
    },
    [setEdges]
  );

  // Generate nodes from prompt
  const generateNodesFromPrompt = useCallback((prompt: string) => {
    // Simple AI-like parsing (in production, this would call an AI service)
    const lowerPrompt = prompt.toLowerCase();
    
    const newNodes: WorkflowNode[] = [];
    let nodeId = 1;

    // Detect triggers
    if (lowerPrompt.includes('when') || lowerPrompt.includes('trigger') || lowerPrompt.includes('receive')) {
      if (lowerPrompt.includes('email')) {
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'custom',
          position: { x: 100, y: 100 },
          data: {
            label: 'New Email',
            type: 'trigger',
            icon: <Mail size={16} />,
            description: 'Triggers when a new email is received',
            config: { triggerType: 'email' },
          },
        });
      } else if (lowerPrompt.includes('schedule') || lowerPrompt.includes('daily') || lowerPrompt.includes('weekly')) {
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'custom',
          position: { x: 100, y: 100 },
          data: {
            label: 'Schedule',
            type: 'trigger',
            icon: <Clock size={16} />,
            description: 'Runs on a schedule',
            config: { triggerType: 'schedule', frequency: 'daily' },
          },
        });
      } else {
        newNodes.push({
          id: `node-${nodeId++}`,
          type: 'custom',
          position: { x: 100, y: 100 },
          data: {
            label: 'Webhook',
            type: 'trigger',
            icon: <LinkIcon size={16} />,
            description: 'Triggers via webhook',
            config: { triggerType: 'webhook' },
          },
        });
      }
    }

    // Detect apps
    const appKeywords: Record<string, string> = {
      gmail: 'gmail',
      email: 'gmail',
      calendar: 'calendar',
      slack: 'slack',
      notion: 'notion',
      salesforce: 'salesforce',
      hubspot: 'hubspot',
      shopify: 'shopify',
      stripe: 'stripe',
    };

    for (const [keyword, appId] of Object.entries(appKeywords)) {
      if (lowerPrompt.includes(keyword)) {
        const app = availableApps.find(a => a.id === appId);
        if (app) {
          newNodes.push({
            id: `node-${nodeId++}`,
            type: 'custom',
            position: { x: 300, y: 100 + (nodeId - 2) * 150 },
            data: {
              label: app.name,
              type: 'app',
              icon: <app.icon size={16} />,
              description: `Connect to ${app.name}`,
              appType: app.id,
              config: {},
            },
          });
        }
      }
    }

    // Detect knowledge bases
    if (lowerPrompt.includes('document') || lowerPrompt.includes('knowledge') || lowerPrompt.includes('data')) {
      newNodes.push({
        id: `node-${nodeId++}`,
        type: 'custom',
        position: { x: 500, y: 100 },
        data: {
          label: 'Knowledge Base',
          type: 'knowledge',
          icon: <Database size={16} />,
          description: 'Access knowledge base',
          knowledgeBaseId: 'documents',
          config: {},
        },
      });
    }

    // Detect AI actions
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('process') || lowerPrompt.includes('ai') || lowerPrompt.includes('intelligent')) {
      newNodes.push({
        id: `node-${nodeId++}`,
        type: 'custom',
        position: { x: 700, y: 100 },
        data: {
          label: 'AI Process',
          type: 'ai',
          icon: <Brain size={16} />,
          description: 'AI-powered processing',
          config: { prompt },
        },
      });
    }

    // Default action if no specific actions detected
    if (newNodes.length === 0 || !newNodes.some(n => n.data.type === 'action')) {
      newNodes.push({
        id: `node-${nodeId++}`,
        type: 'custom',
        position: { x: 900, y: 100 },
        data: {
          label: 'Action',
          type: 'action',
          icon: <Zap size={16} />,
          description: 'Perform action',
          config: {},
        },
      });
    }

    // Add connections between nodes
    const newEdges: Edge[] = [];
    for (let i = 0; i < newNodes.length - 1; i++) {
      newEdges.push({
        id: `edge-${i}`,
        source: newNodes[i].id,
        target: newNodes[i + 1].id,
        type: 'smoothstep',
        animated: true,
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#8b5cf6',
        },
        style: { stroke: '#8b5cf6', strokeWidth: 2 },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    setShowPromptModal(false);
  }, [setNodes, setEdges]);

  // Add node manually
  const addNode = useCallback((nodeType: NodeType, config?: any) => {
    const id = `node-${Date.now()}`;
    const position = reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      : { x: Math.random() * 500, y: Math.random() * 500 };

    let newNode: WorkflowNode;

    switch (nodeType) {
      case 'trigger':
        const trigger = triggerTypes[0];
        newNode = {
          id,
          type: 'custom',
          position,
          data: {
            label: trigger.name,
            type: 'trigger',
            icon: <trigger.icon size={16} />,
            description: `Trigger: ${trigger.name}`,
            config: { triggerType: trigger.id, ...config },
          },
        };
        break;
      case 'app':
        const app = availableApps[0];
        newNode = {
          id,
          type: 'custom',
          position,
          data: {
            label: app.name,
            type: 'app',
            icon: <app.icon size={16} />,
            description: `Connect to ${app.name}`,
            appType: app.id,
            config: { ...config },
          },
        };
        break;
      case 'knowledge':
        const kb = knowledgeBaseTypes[0];
        newNode = {
          id,
          type: 'custom',
          position,
          data: {
            label: kb.name,
            type: 'knowledge',
            icon: <kb.icon size={16} />,
            description: `Knowledge base: ${kb.name}`,
            knowledgeBaseId: kb.id,
            config: { ...config },
          },
        };
        break;
      case 'action':
        const action = actionTypes[0];
        newNode = {
          id,
          type: 'custom',
          position,
          data: {
            label: action.name,
            type: 'action',
            icon: <action.icon size={16} />,
            description: `Action: ${action.name}`,
            config: { actionType: action.id, ...config },
          },
        };
        break;
      case 'ai':
        newNode = {
          id,
          type: 'custom',
          position,
          data: {
            label: 'AI Agent',
            type: 'ai',
            icon: <Brain size={16} />,
            description: 'AI-powered automation',
            config: { ...config },
          },
        };
        break;
      default:
        return;
    }

    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as WorkflowNode);
    setShowNodeConfig(true);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
    setShowNodeConfig(false);
  }, [setNodes, setEdges]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({ nodes, edges });
    }
  }, [nodes, edges, onSave]);

  const handleRun = useCallback(() => {
    setIsRunning(true);
    // Simulate workflow execution
    setTimeout(() => {
      setIsRunning(false);
      alert('Workflow executed successfully!');
    }, 2000);
  }, []);

  // Convert React Flow nodes/edges to WorkflowDefinition format
  const convertToWorkflowDefinition = useCallback((): WorkflowDefinition => {
    const workflowNodes: WorkflowNodeData[] = nodes.map(node => ({
      id: node.id,
      type: (node.data as any).type as WorkflowNodeData['type'],
      label: (node.data as any).label as string,
      description: (node.data as any).description as string | undefined,
      config: (node.data as any).config || {},
      position: node.position
    }));

    const workflowEdges: WorkflowEdge[] = edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined
    }));

    return {
      nodes: workflowNodes,
      edges: workflowEdges
    };
  }, [nodes, edges]);

  // Handle deploy
  const handleDeploy = useCallback(async () => {
    if (!onDeploy || nodes.length === 0) return;
    
    const workflow = convertToWorkflowDefinition();
    
    try {
      await onDeploy(workflowName, workflowDescription, workflow);
      setDeploySuccess(true);
      setTimeout(() => {
        setShowDeployModal(false);
        setDeploySuccess(false);
        if (onClose) onClose();
      }, 2000);
    } catch (error) {
      console.error('Deploy error:', error);
    }
  }, [onDeploy, nodes, workflowName, workflowDescription, convertToWorkflowDefinition, onClose]);

  return (
    <div className="workflow-builder">
      {/* Header */}
      <div className="workflow-header">
        <div className="workflow-header-left">
          {onToggleSidebar && (
            <button
              className="workflow-btn workflow-btn-sidebar"
              onClick={onToggleSidebar}
              title="Toggle Sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="workflow-name-input"
            placeholder="Workflow name"
          />
          <button
            className="workflow-btn workflow-btn-primary"
            onClick={() => setShowPromptModal(true)}
          >
            <Sparkles size={16} />
            Create from Prompt
          </button>
        </div>
        <div className="workflow-header-right">
          <button
            className="workflow-btn workflow-btn-secondary"
            onClick={handleSave}
          >
            <Save size={16} />
            Save
          </button>
          <button
            className="workflow-btn workflow-btn-run"
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
          >
            <Play size={16} />
            {isRunning ? 'Running...' : 'Test'}
          </button>
          {onDeploy && (
            <button
              className="workflow-btn workflow-btn-deploy"
              onClick={() => setShowDeployModal(true)}
              disabled={nodes.length === 0}
            >
              <Rocket size={16} />
              Deploy Agent
            </button>
          )}
          {onClose && (
            <button
              className="workflow-btn workflow-btn-close"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="workflow-toolbar">
        <div className="workflow-toolbar-section">
          <span className="workflow-toolbar-label">Add Node:</span>
          <button
            className="workflow-toolbar-btn"
            onClick={() => addNode('trigger')}
            title="Add Trigger"
          >
            <Bell size={14} />
            Trigger
          </button>
          <button
            className="workflow-toolbar-btn"
            onClick={() => addNode('app')}
            title="Add App"
          >
            <Cloud size={14} />
            App
          </button>
          <button
            className="workflow-toolbar-btn"
            onClick={() => addNode('knowledge')}
            title="Add Knowledge Base"
          >
            <Database size={14} />
            Knowledge
          </button>
          <button
            className="workflow-toolbar-btn"
            onClick={() => addNode('action')}
            title="Add Action"
          >
            <Zap size={14} />
            Action
          </button>
          <button
            className="workflow-toolbar-btn"
            onClick={() => addNode('ai')}
            title="Add AI Agent"
          >
            <Brain size={14} />
            AI Agent
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="workflow-canvas" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          onInit={setReactFlowInstance}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Prompt Modal */}
      {showPromptModal && (
        <PromptModal
          onClose={() => setShowPromptModal(false)}
          onSubmit={generateNodesFromPrompt}
        />
      )}

      {/* Node Config Panel */}
      {showNodeConfig && selectedNode && (
        <NodeConfigPanel
          node={selectedNode}
          onClose={() => {
            setShowNodeConfig(false);
            setSelectedNode(null);
          }}
          onUpdate={(updatedNode) => {
            setNodes((nds) =>
              nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
            );
          }}
          onDelete={() => deleteNode(selectedNode.id)}
        />
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="deploy-modal-overlay" onClick={() => !isDeploying && setShowDeployModal(false)}>
          <div className="deploy-modal" onClick={(e) => e.stopPropagation()}>
            {deploySuccess ? (
              <div className="deploy-success">
                <div className="deploy-success-icon">
                  <CheckCircle size={48} />
                </div>
                <h2>Agent Deployed Successfully!</h2>
                <p>Your automation agent is now active and ready to run.</p>
              </div>
            ) : (
              <>
                <div className="deploy-modal-header">
                  <div className="deploy-modal-icon">
                    <Rocket size={24} />
                  </div>
                  <div>
                    <h2>Deploy Your Agent</h2>
                    <p>Give your automation agent a name and description</p>
                  </div>
                  <button 
                    className="deploy-modal-close" 
                    onClick={() => setShowDeployModal(false)}
                    disabled={isDeploying}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="deploy-modal-content">
                  <div className="deploy-form-group">
                    <label>Agent Name</label>
                    <input
                      type="text"
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      placeholder="e.g., Email to Notion Task Creator"
                      disabled={isDeploying}
                    />
                  </div>

                  <div className="deploy-form-group">
                    <label>Description</label>
                    <textarea
                      value={workflowDescription}
                      onChange={(e) => setWorkflowDescription(e.target.value)}
                      placeholder="Describe what this agent does..."
                      rows={3}
                      disabled={isDeploying}
                    />
                  </div>

                  <div className="deploy-summary">
                    <h4>Workflow Summary</h4>
                    <div className="deploy-summary-stats">
                      <div className="deploy-stat">
                        <span className="deploy-stat-value">{nodes.length}</span>
                        <span className="deploy-stat-label">Nodes</span>
                      </div>
                      <div className="deploy-stat">
                        <span className="deploy-stat-value">{edges.length}</span>
                        <span className="deploy-stat-label">Connections</span>
                      </div>
                      <div className="deploy-stat">
                        <span className="deploy-stat-value">
                          {nodes.find(n => (n.data as any).type === 'trigger')?.data && (nodes.find(n => (n.data as any).type === 'trigger')?.data as any).label || 'Manual'}
                        </span>
                        <span className="deploy-stat-label">Trigger</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="deploy-modal-footer">
                  <button 
                    className="deploy-btn deploy-btn-cancel" 
                    onClick={() => setShowDeployModal(false)}
                    disabled={isDeploying}
                  >
                    Cancel
                  </button>
                  <button 
                    className="deploy-btn deploy-btn-confirm"
                    onClick={handleDeploy}
                    disabled={isDeploying || !workflowName.trim()}
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 size={16} className="spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket size={16} />
                        Deploy Agent
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

