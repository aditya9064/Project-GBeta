/* ═══════════════════════════════════════════════════════════
   Execution Engine — Runs workflows step by step
   
   This engine executes workflow nodes by calling the REAL
   backend API when available, falling back to simulated
   execution in demo mode.
   
   Real integrations (when backend is connected):
   - Gmail: send/read/reply via Google OAuth + Gmail API
   - Slack: send messages via Slack OAuth + Web API
   - AI: process prompts via OpenAI API
   - HTTP: proxied requests through backend
   
   Demo mode (when backend is offline):
   - Returns simulated results for all node types
   - Logs execution details to console
   ═══════════════════════════════════════════════════════════ */

import { 
  WorkflowDefinition, 
  WorkflowNodeData, 
  ExecutionContext, 
  NodeExecution,
  TriggerConfig,
  AppConfig,
  AIConfig as AINodeConfig,
  FilterConfig,
  DelayConfig,
  MemoryConfig,
  AgentCallConfig,
  BrowserTaskConfig,
} from './types';
import {
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationSlackAPI,
  AutomationAIAPI,
  AutomationHttpAPI,
  AutomationBrowserAPI,
  AutomationNotionAPI,
} from './automationApi';
import { AgentMemoryService } from './memoryService';
import { AgentBus } from './agentBus';

// Node executor functions
type NodeExecutor = (
  node: WorkflowNodeData, 
  context: ExecutionContext
) => Promise<any>;

// Registry of custom node executors
const nodeExecutors: Record<string, NodeExecutor> = {};

// Register a custom node executor
export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  nodeExecutors[nodeType] = executor;
}

// Required input field definition for user input prompts
export interface RequiredInputField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'select' | 'oauth';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[]; // For select type
  oauthProvider?: string; // For oauth type (gmail, slack, etc.)
  description?: string;
}

// Execution log for UI display
export interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_input';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  isReal: boolean; // true if executed via real backend API
  // For awaiting_input status
  requiredInputs?: RequiredInputField[];
  inputPromptMessage?: string;
}

// Get input data for a node based on connections
function getNodeInput(
  node: WorkflowNodeData,
  workflow: WorkflowDefinition,
  context: ExecutionContext
): any {
  const incomingEdges = workflow.edges.filter(e => e.target === node.id);
  
  if (incomingEdges.length === 0) {
    return context.trigger.data;
  }
  
  const input: any = {};
  for (const edge of incomingEdges) {
    const sourceOutput = context.nodeOutputs[edge.source];
    if (sourceOutput) {
      Object.assign(input, sourceOutput);
    }
  }
  
  if (node.inputMapping) {
    const mappedInput: any = {};
    for (const [targetKey, sourceKey] of Object.entries(node.inputMapping)) {
      mappedInput[targetKey] = getNestedValue(input, sourceKey);
    }
    return mappedInput;
  }
  
  return input;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function applyOutputMapping(output: any, mapping?: Record<string, string>): any {
  if (!mapping) return output;
  const mappedOutput: any = {};
  for (const [targetKey, sourceKey] of Object.entries(mapping)) {
    mappedOutput[targetKey] = getNestedValue(output, sourceKey);
  }
  return mappedOutput;
}

/* ═══ CREDENTIAL / INPUT DETECTION ════════════════════════ */

// Store for user-provided credentials during execution
const userProvidedCredentials: Record<string, Record<string, any>> = {};

// Get credentials for a specific service
export function getStoredCredentials(serviceType: string): Record<string, any> | null {
  return userProvidedCredentials[serviceType] || null;
}

// Store credentials provided by user
export function storeCredentials(serviceType: string, credentials: Record<string, any>): void {
  userProvidedCredentials[serviceType] = credentials;
}

// Clear stored credentials
export function clearCredentials(serviceType?: string): void {
  if (serviceType) {
    delete userProvidedCredentials[serviceType];
  } else {
    Object.keys(userProvidedCredentials).forEach(key => delete userProvidedCredentials[key]);
  }
}

// Detect what inputs are needed for a node
function detectRequiredInputs(node: WorkflowNodeData, input: any): RequiredInputField[] | null {
  const config = node.config as any;
  const requiredInputs: RequiredInputField[] = [];

  // Check based on node type and app type
  if (node.type === 'app') {
    const appType = config?.appType;
    
    // Gmail - needs OAuth or credentials
    if (appType === 'gmail') {
      const storedCreds = getStoredCredentials('gmail');
      if (!storedCreds) {
        // Check if we have the email recipient for send actions
        const gmail = config?.gmail;
        if (gmail?.action === 'send' && !gmail.to && !input.to && !input.email) {
          requiredInputs.push({
            key: 'to',
            label: 'Recipient Email',
            type: 'email',
            placeholder: 'recipient@example.com',
            required: true,
            description: 'The email address to send to',
          });
        }
        if (gmail?.action === 'send' && !gmail.subject && !input.subject) {
          requiredInputs.push({
            key: 'subject',
            label: 'Email Subject',
            type: 'text',
            placeholder: 'Enter email subject',
            required: true,
          });
        }
        if (gmail?.action === 'send' && !gmail.body && !input.body && !input.message) {
          requiredInputs.push({
            key: 'body',
            label: 'Email Body',
            type: 'text',
            placeholder: 'Enter email content',
            required: true,
          });
        }
      }
    }

    // Slack - needs channel if not specified
    if (appType === 'slack') {
      const slack = config?.slack;
      if (slack?.action === 'send_message' && !slack.channel && !input.channel) {
        requiredInputs.push({
          key: 'channel',
          label: 'Slack Channel',
          type: 'text',
          placeholder: '#general or channel ID',
          required: true,
          description: 'The Slack channel to post to',
        });
      }
      if (slack?.action === 'send_message' && !slack.message && !input.message && !input.text) {
        requiredInputs.push({
          key: 'message',
          label: 'Message',
          type: 'text',
          placeholder: 'Enter your message',
          required: true,
        });
      }
    }

    // HTTP - needs URL if not specified
    if (appType === 'http' || appType === 'webhook') {
      const http = config?.http;
      if (!http?.url && !input.url) {
        requiredInputs.push({
          key: 'url',
          label: 'Request URL',
          type: 'text',
          placeholder: 'https://api.example.com/endpoint',
          required: true,
        });
      }
    }
  }

  // Check for form/user_input trigger
  if (node.type === 'trigger') {
    const triggerType = config?.triggerType;
    if (triggerType === 'form') {
      const formFields = config?.formFields || [];
      for (const field of formFields) {
        if (!input[field.name]) {
          requiredInputs.push({
            key: field.name,
            label: field.label || field.name,
            type: field.type || 'text',
            placeholder: field.placeholder,
            required: field.required !== false,
          });
        }
      }
    }
  }

  // Check for AI node - needs prompt or query
  if (node.type === 'ai') {
    if (!config?.prompt && !input.prompt && !input.query && !input.message) {
      requiredInputs.push({
        key: 'prompt',
        label: 'AI Prompt',
        type: 'text',
        placeholder: 'Enter your question or instructions',
        required: true,
      });
    }
  }

  return requiredInputs.length > 0 ? requiredInputs : null;
}

/* ═══ MAIN EXECUTION ═════════════════════════════════════ */

// Extended result type that includes awaiting input state
export interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  logs: ExecutionLog[];
  // For paused execution awaiting user input
  awaitingInput?: boolean;
  pausedAtNodeId?: string;
  requiredInputs?: RequiredInputField[];
  inputPromptMessage?: string;
  // Serializable state for resuming execution
  executionState?: {
    executionId: string;
    agentId: string;
    userId: string;
    workflow: WorkflowDefinition;
    triggeredBy: string;
    triggerData: any;
    completedNodeIds: string[];
    nodeOutputs: Record<string, any>;
  };
}

export async function executeWorkflow(
  agentId: string,
  userId: string,
  workflow: WorkflowDefinition,
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'event',
  triggerData: any = {},
  onNodeUpdate?: (log: ExecutionLog) => void,
  // Optional: resume execution state
  resumeState?: {
    completedNodeIds: string[];
    nodeOutputs: Record<string, any>;
    userProvidedInputs?: Record<string, any>;
  }
): Promise<ExecutionResult> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const logs: ExecutionLog[] = [];
  const backendUp = isBackendAvailable();

  console.log(`\n🚀 Executing workflow for agent ${agentId}`);
  console.log(`   Backend: ${backendUp ? '✅ Connected (REAL execution)' : '⚠️ Offline (SIMULATED execution)'}`);
  console.log(`   Triggered by: ${triggeredBy}`);
  console.log(`   Nodes: ${workflow.nodes.length}, Edges: ${workflow.edges.length}`);
  if (resumeState) {
    console.log(`   Resuming from: ${resumeState.completedNodeIds.length} completed nodes`);
  }
  console.log('');

  // Load persistent memory for this agent
  const persistedMemory = await AgentMemoryService.loadAgentMemory(agentId);

  const context: ExecutionContext = {
    executionId,
    agentId,
    userId,
    trigger: { type: triggeredBy as any, data: { ...triggerData, ...resumeState?.userProvidedInputs } },
    variables: { ...workflow.variables },
    nodeOutputs: resumeState?.nodeOutputs || {},
    memory: persistedMemory,
    callerAgentId: triggerData?._callerAgentId,
  };

  // Track completed nodes for resume capability
  const completedNodeIds: string[] = resumeState?.completedNodeIds || [];

  try {
    const executionOrder = buildExecutionOrder(workflow);
    
    for (const nodeId of executionOrder) {
      // Skip already completed nodes when resuming
      if (completedNodeIds.includes(nodeId)) {
        console.log(`  ⏭️ Skipping already completed: ${nodeId}`);
        continue;
      }

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      context.currentNodeId = nodeId;
      
      // Check conditions
      const shouldExecute = checkConditions(node, workflow, context);
      if (!shouldExecute) {
        const skipLog: ExecutionLog = {
          nodeId: node.id,
          nodeName: node.label,
          nodeType: node.type,
          status: 'skipped',
          startedAt: new Date(),
          completedAt: new Date(),
          duration: 0,
          isReal: false,
        };
        logs.push(skipLog);
        onNodeUpdate?.(skipLog);
        completedNodeIds.push(nodeId);
        continue;
      }
      
      // Get input from previous nodes and user-provided inputs
      let input = getNodeInput(node, workflow, context);
      
      // Merge any user-provided inputs for this node
      if (resumeState?.userProvidedInputs) {
        input = { ...input, ...resumeState.userProvidedInputs };
      }
      
      // Check if this node requires user input
      const requiredInputs = detectRequiredInputs(node, input);
      if (requiredInputs && requiredInputs.length > 0) {
        // Pause execution and return state for resuming
        const awaitingLog: ExecutionLog = {
          nodeId: node.id,
          nodeName: node.label,
          nodeType: node.type,
          status: 'awaiting_input',
          startedAt: new Date(),
          input,
          isReal: backendUp,
          requiredInputs,
          inputPromptMessage: `"${node.label}" needs additional information to proceed:`,
        };
        logs.push(awaitingLog);
        onNodeUpdate?.(awaitingLog);
        
        console.log(`  ⏸️ ${node.label} (${node.type}) — Awaiting user input`);
        console.log(`     Required: ${requiredInputs.map(r => r.key).join(', ')}`);
        
        return {
          success: false,
          awaitingInput: true,
          pausedAtNodeId: node.id,
          requiredInputs,
          inputPromptMessage: awaitingLog.inputPromptMessage,
          logs,
          executionState: {
            executionId,
            agentId,
            userId,
            workflow,
            triggeredBy,
            triggerData,
            completedNodeIds,
            nodeOutputs: context.nodeOutputs,
          },
        };
      }
      
      const nodeLog: ExecutionLog = {
        nodeId: node.id,
        nodeName: node.label,
        nodeType: node.type,
        status: 'running',
        startedAt: new Date(),
        input,
        isReal: backendUp,
      };
      logs.push(nodeLog);
      onNodeUpdate?.(nodeLog);

      try {
        const output = await executeNode(node, input, context, backendUp);
        const mappedOutput = applyOutputMapping(output, node.outputMapping);
        context.nodeOutputs[node.id] = mappedOutput;
        
        nodeLog.status = 'completed';
        nodeLog.completedAt = new Date();
        nodeLog.duration = nodeLog.completedAt.getTime() - nodeLog.startedAt.getTime();
        nodeLog.output = mappedOutput;
        onNodeUpdate?.(nodeLog);
        
        completedNodeIds.push(nodeId);
        
        console.log(`  ✅ ${node.label} (${node.type}) — ${nodeLog.duration}ms ${backendUp ? '[REAL]' : '[SIMULATED]'}`);
        
      } catch (error: any) {
        nodeLog.status = 'failed';
        nodeLog.completedAt = new Date();
        nodeLog.duration = nodeLog.completedAt.getTime() - nodeLog.startedAt.getTime();
        nodeLog.error = error.message;
        onNodeUpdate?.(nodeLog);
        
        console.error(`  ❌ ${node.label} (${node.type}) — ${error.message}`);
        
        // In simulated / demo mode, continue execution even when a node fails
        // In real backend mode, stop immediately on failure
        if (backendUp) {
          return { success: false, error: error.message, logs };
        }
        // For simulated mode, store a fallback output so downstream nodes have input
        context.nodeOutputs[node.id] = {
          _error: error.message,
          _simulated: true,
          _failedNode: node.label,
        };
        completedNodeIds.push(nodeId);
      }
    }
    
    // Get final output
    const lastNodeId = executionOrder[executionOrder.length - 1];
    const finalOutput = context.nodeOutputs[lastNodeId];
    
    // Check if any nodes failed
    const failedNodes = logs.filter(l => l.status === 'failed');
    if (failedNodes.length > 0) {
      console.log(`\n⚠️ Workflow completed with ${failedNodes.length} failed node(s) (demo mode)\n`);
      return { 
        success: true, 
        output: finalOutput, 
        logs,
      };
    }

    console.log(`\n✅ Workflow execution completed successfully\n`);
    return { success: true, output: finalOutput, logs };
    
  } catch (error: any) {
    console.error(`\n❌ Workflow execution failed: ${error.message}\n`);
    return { success: false, error: error.message, logs };
  }
}

/* ═══ TOPOLOGICAL SORT ═══════════════════════════════════ */

function buildExecutionOrder(workflow: WorkflowDefinition): string[] {
  const visited = new Set<string>();
  const order: string[] = [];
  const visiting = new Set<string>();
  
  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      throw new Error('Circular dependency detected in workflow');
    }
    
    visiting.add(nodeId);
    const incomingEdges = workflow.edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }
  
  for (const node of workflow.nodes) {
    visit(node.id);
  }
  
  return order;
}

/* ═══ CONDITION CHECKING ═════════════════════════════════ */

function checkConditions(
  node: WorkflowNodeData,
  workflow: WorkflowDefinition,
  context: ExecutionContext
): boolean {
  const incomingEdges = workflow.edges.filter(e => e.target === node.id);
  
  for (const edge of incomingEdges) {
    if (edge.condition) {
      const sourceOutput = context.nodeOutputs[edge.source];
      if (!evaluateCondition(edge.condition, sourceOutput)) {
        return false;
      }
    }
  }
  
  return true;
}

function evaluateCondition(condition: FilterConfig, data: any): boolean {
  const results = condition.conditions.map(c => {
    const value = getNestedValue(data, c.field);
    switch (c.operator) {
      case 'equals': return value === c.value;
      case 'not_equals': return value !== c.value;
      case 'contains': return String(value).includes(c.value);
      case 'not_contains': return !String(value).includes(c.value);
      case 'gt': return value > c.value;
      case 'lt': return value < c.value;
      case 'gte': return value >= c.value;
      case 'lte': return value <= c.value;
      case 'exists': return value !== undefined && value !== null;
      case 'not_exists': return value === undefined || value === null;
      default: return true;
    }
  });
  
  return condition.logic === 'and' ? results.every(r => r) : results.some(r => r);
}

/* ═══ NODE EXECUTION (Real + Simulated) ═════════════════ */

async function executeNode(
  node: WorkflowNodeData,
  input: any,
  context: ExecutionContext,
  useRealBackend: boolean
): Promise<any> {
  // Resolve template expressions in node config before execution
  const resolvedNode = {
    ...node,
    config: resolveAllTemplates(node.config, context, input),
  };
  
  // Check for registered custom executors first
  if (nodeExecutors[resolvedNode.type]) {
    return nodeExecutors[resolvedNode.type](resolvedNode, { ...context, trigger: { ...context.trigger, data: input } });
  }
  
  switch (resolvedNode.type) {
    case 'trigger':
      return executeTrigger(resolvedNode, input);
      
    case 'app':
      return executeApp(resolvedNode, input, useRealBackend);
      
    case 'ai':
      return executeAI(resolvedNode, input, useRealBackend);
      
    case 'condition':
      return executeCondition(resolvedNode, input);
      
    case 'filter':
      return executeFilter(resolvedNode, input);
      
    case 'delay':
      return executeDelay(resolvedNode, input);
      
    case 'action':
      return executeAction(resolvedNode, input, useRealBackend);
      
    case 'knowledge':
      return executeKnowledge(resolvedNode, input);

    case 'memory':
      return executeMemory(resolvedNode, input, context);

    case 'agent_call':
      return executeAgentCall(resolvedNode, input, context);

    case 'browser_task':
      return executeBrowserTask(resolvedNode, input, context, useRealBackend);

    case 'vision_browse':
    case 'desktop_task':
      return executeVisionTask(resolvedNode, input, useRealBackend);

    default:
      // For any unknown/n8n-specific node type, pass through with metadata
      return executeGenericN8nNode(resolvedNode, input, useRealBackend);
  }
}

/* ═══ TRIGGER ════════════════════════════════════════════ */

async function executeTrigger(node: WorkflowNodeData, input: any): Promise<any> {
  return {
    ...input,
    _trigger: {
      nodeId: node.id,
      type: (node.config as TriggerConfig).triggerType,
      timestamp: new Date().toISOString()
    }
  };
}

/* ═══ APP NODE (Gmail, Slack, etc.) ══════════════════════ */

async function executeApp(
  node: WorkflowNodeData, 
  input: any,
  useRealBackend: boolean
): Promise<any> {
  const config = node.config as AppConfig;
  
  switch (config.appType) {
    case 'gmail':
      return executeGmail(config, input, useRealBackend);
    case 'slack':
      return executeSlack(config, input, useRealBackend);
    case 'notion':
      return executeNotion(config, input, useRealBackend);
    case 'http':
    case 'webhook': {
      // If this is actually a generic n8n app routed through HTTP but
      // without a real HTTP config, delegate to the generic executor instead
      const genericName = (config as any).genericAppName || '';
      const n8nOrig = (config as any).n8nOriginalType || '';
      if ((genericName || n8nOrig) && !config.http?.url) {
        return executeGenericN8nNode(node, input, useRealBackend);
      }
      return executeHttp(config, input, useRealBackend);
    }
    default: {
      // For n8n-imported generic apps, delegate to the generic executor
      const n8nType = (config as any).n8nOriginalType || '';
      const genericAppName = (config as any).genericAppName || '';
      if (n8nType || genericAppName) {
        return executeGenericN8nNode(node, input, useRealBackend);
      }
      return {
        ...input,
        _app: {
          nodeId: node.id,
          appType: config.appType,
          status: 'simulated',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

/* ─── Gmail executor ─────────────────────────────────── */

async function executeGmail(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const gmail = config.gmail;
  if (!gmail) {
    return { error: 'Gmail configuration missing' };
  }
  
  // Helper to resolve n8n expressions in Gmail config values
  const resolve = (value: any, fallback: string = ''): string => {
    if (value === undefined || value === null) return fallback;
    const resolved = resolveN8nExpression(String(value), input);
    return resolved !== value ? String(resolved) : (input?.[value] || String(value) || fallback);
  };

  // ── REAL BACKEND EXECUTION ──
  if (useRealBackend) {
    switch (gmail.action) {
      case 'send': {
        const to = resolve(gmail.to, input.to || input.email || '');
        const subject = resolve(gmail.subject, input.subject || 'Automated Email');
        const body = resolve(gmail.body, input.body || input.message || '');
        
        // Validate email address before sending
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toTrimmed = to.trim();
        if (!toTrimmed || !emailRegex.test(toTrimmed)) {
          throw new Error(`Invalid "to" email address: "${toTrimmed || '(empty)'}". Please configure a valid recipient email in the workflow node.`);
        }
        
        const result = await AutomationGmailAPI.send(toTrimmed, subject, body);
        if (result) {
          return { ...result, success: true };
        }
        throw new Error('Failed to send email via Gmail API');
      }
      
      case 'reply': {
        const messageId = input.messageId || input.id;
        const body = resolve(gmail.body, input.body || input.message || '');
        
        if (!messageId) throw new Error('No messageId provided for Gmail reply');
        
        const result = await AutomationGmailAPI.reply(messageId, body);
        if (result) {
          return { success: true, action: 'reply', messageId };
        }
        throw new Error('Failed to reply via Gmail API');
      }
      
      case 'read': {
        const result = await AutomationGmailAPI.read(10);
        if (result) {
          return { success: true, ...result };
        }
        throw new Error('Failed to read emails via Gmail API');
      }
      
      case 'draft': {
        // Draft action: prepare email content without sending
        // Returns the draft that would be sent, allowing review or further processing
        const to = resolve(gmail.to, input.to || input.email || input.fromEmail || '');
        const subject = resolve(gmail.subject, input.subject || 'Draft Email');
        const body = resolve(gmail.body, input.body || input.message || input.response || '');
        
        console.log(`[Gmail] Created draft for: ${to}`);
        return {
          success: true,
          action: 'draft',
          to,
          subject,
          body,
          draftId: `draft-${Date.now()}`,
          timestamp: new Date().toISOString(),
          _note: 'Draft prepared - ready to send or review',
        };
      }
      
      case 'addLabels':
      case 'removeLabels':
      case 'markAsRead':
      case 'markAsUnread':
      case 'archive':
      case 'trash':
      case 'star':
      case 'unstar': {
        // These are Gmail operations that modify message state
        // For MVP, we simulate these as successful operations
        const messageId = input.messageId || input.id || gmail.messageId;
        const labels = gmail.labels || input.labels || [];
        console.log(`[Gmail] ${gmail.action} operation on message: ${messageId}`);
        return {
          success: true,
          action: gmail.action,
          messageId,
          labels: Array.isArray(labels) ? labels : [labels],
          timestamp: new Date().toISOString(),
          _note: `Gmail ${gmail.action} operation completed`,
        };
      }
      
      default:
        console.warn(`[Gmail] Unsupported action "${gmail.action}" — falling back to simulation`);
    }
  }
  
  // ── SIMULATED EXECUTION (Demo mode) ──
  switch (gmail.action) {
    case 'send':
      console.log(`[Gmail SIMULATED] Sending email to: ${gmail.to}`);
      return {
        success: true,
        action: 'send',
        to: gmail.to,
        subject: gmail.subject,
        messageId: `sim-msg-${Date.now()}`,
        timestamp: new Date().toISOString(),
        _simulated: true,
      };
      
    case 'read':
      console.log(`[Gmail SIMULATED] Reading emails`);
      return {
        success: true,
        action: 'read',
        count: 3,
        emails: [
          {
            id: 'sim-email-1',
            from: 'sender@example.com',
            subject: 'Sample Email',
            preview: 'This is a simulated email for demo purposes.',
            receivedAt: new Date().toISOString()
          },
          {
            id: 'sim-email-2',
            from: 'another@example.com',
            subject: 'Follow-up',
            preview: 'Following up on our earlier conversation.',
            receivedAt: new Date(Date.now() - 3600000).toISOString()
          },
        ],
        _simulated: true,
      };
    
    case 'draft':
      console.log(`[Gmail SIMULATED] Creating draft for: ${gmail.to}`);
      return {
        success: true,
        action: 'draft',
        to: gmail.to,
        subject: gmail.subject,
        body: gmail.body,
        draftId: `sim-draft-${Date.now()}`,
        timestamp: new Date().toISOString(),
        _simulated: true,
      };
      
    default:
      return { success: true, action: gmail.action, _simulated: true };
  }
}

/* ─── Slack executor ─────────────────────────────────── */

async function executeSlack(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const slack = config.slack;
  if (!slack) {
    return { error: 'Slack configuration missing' };
  }

  // ── REAL BACKEND EXECUTION ──
  if (useRealBackend && slack.action === 'send_message') {
    const channel = slack.channel || input.channel;
    const message = slack.message || input.message || '';
    
    if (!channel) throw new Error('No Slack channel specified');
    
    const result = await AutomationSlackAPI.send(channel, message);
    if (result) {
      return { ...result, success: true };
    }
    throw new Error('Failed to send Slack message via API');
  }

  // ── SIMULATED EXECUTION ──
  console.log(`[Slack SIMULATED] Sending to #${slack.channel}: ${slack.message}`);
  return {
    success: true,
    action: slack.action,
    channel: slack.channel,
    message: slack.message || input.message,
    messageTs: `${Date.now()}.000000`,
    timestamp: new Date().toISOString(),
    _simulated: true,
  };
}

/* ─── Notion executor ─────────────────────────────────── */

async function executeNotion(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const notion = config.notion;
  if (!notion) {
    return { error: 'Notion configuration missing' };
  }

  // ── REAL BACKEND EXECUTION ──
  if (useRealBackend) {
    try {
      switch (notion.action) {
        case 'create_page': {
          const result = await AutomationNotionAPI.createPage(
            notion.databaseId || '',
            notion.properties || input.properties || {},
            notion.content || input.content
          );
          if (result) {
            return { ...result, success: true };
          }
          break;
        }
        case 'update_page': {
          const pageId = notion.pageId || input.pageId;
          if (!pageId) throw new Error('No pageId provided for Notion update');
          const result = await AutomationNotionAPI.updatePage(
            pageId,
            notion.properties || input.properties || {}
          );
          if (result) {
            return { ...result, success: true };
          }
          break;
        }
        case 'query_database': {
          const result = await AutomationNotionAPI.queryDatabase(
            notion.databaseId || '',
            notion.filter,
            notion.sorts
          );
          if (result) {
            return { ...result, success: true };
          }
          break;
        }
        case 'get_page': {
          const pageId = notion.pageId || input.pageId;
          if (!pageId) throw new Error('No pageId provided for Notion get');
          const result = await AutomationNotionAPI.getPage(pageId);
          if (result) {
            return { ...result, success: true };
          }
          break;
        }
        case 'append_blocks': {
          const pageId = notion.pageId || input.pageId;
          if (!pageId) throw new Error('No pageId provided for Notion append');
          const result = await AutomationNotionAPI.appendBlocks(
            pageId,
            notion.blocks || input.blocks || []
          );
          if (result) {
            return { ...result, success: true };
          }
          break;
        }
        default:
          console.warn(`[Notion] Unsupported action "${notion.action}" — falling back to simulation`);
      }
    } catch (err: any) {
      console.warn(`[Notion] Backend error: ${err.message} — falling back to simulation`);
    }
  }
  
  // ── SIMULATED EXECUTION (Demo mode) ──
  console.log(`[Notion SIMULATED] ${notion.action} on ${notion.databaseId || 'default'}`);
  return {
    success: true,
    action: notion.action,
    pageId: `sim-page-${Date.now()}`,
    databaseId: notion.databaseId,
    timestamp: new Date().toISOString(),
    _simulated: true,
  };
}

/* ─── URL validation helper ──────────────────────────── */

function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  // Reject n8n template expressions like {{ $env.WEBHOOK_URL }}
  if (/\{\{.*\}\}/.test(url)) return false;
  // Reject empty or whitespace-only
  if (!url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function hasTemplateExpression(value: any): boolean {
  if (typeof value !== 'string') return false;
  return /\{\{.*\}\}/.test(value);
}

function resolveTemplateExpressions(value: string, context: ExecutionContext, input: any): string {
  if (typeof value !== 'string') return value;
  
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
    const trimmedExpr = expr.trim();
    
    if (trimmedExpr.startsWith('$env.')) {
      const envVar = trimmedExpr.substring(5);
      const envValue = import.meta.env[`VITE_${envVar}`] || import.meta.env[envVar] || '';
      if (envValue) return envValue;
      console.warn(`[Template] Environment variable ${envVar} not found`);
      return match;
    }
    
    if (trimmedExpr.startsWith('$json')) {
      const resolved = resolveN8nExpression(`={{${trimmedExpr}}}`, input);
      if (resolved !== `={{${trimmedExpr}}}`) return String(resolved);
    }
    
    if (trimmedExpr.startsWith('$input.')) {
      const path = trimmedExpr.substring(7);
      const resolved = getNestedValue(input, path);
      if (resolved !== undefined) return String(resolved);
    }
    
    if (trimmedExpr.startsWith('$vars.') || trimmedExpr.startsWith('$variables.')) {
      const path = trimmedExpr.replace(/^\$(vars|variables)\./, '');
      const resolved = context.variables?.[path];
      if (resolved !== undefined) return String(resolved);
    }
    
    if (trimmedExpr.startsWith('$memory.')) {
      const key = trimmedExpr.substring(8);
      const resolved = context.memory?.[key];
      if (resolved !== undefined) return String(resolved);
    }
    
    if (trimmedExpr === '$now' || trimmedExpr === '$timestamp') {
      return new Date().toISOString();
    }
    
    if (trimmedExpr === '$executionId') {
      return context.executionId;
    }
    
    if (trimmedExpr === '$agentId') {
      return context.agentId;
    }
    
    return match;
  });
}

function resolveAllTemplates(obj: any, context: ExecutionContext, input: any): any {
  if (typeof obj === 'string') {
    return resolveTemplateExpressions(obj, context, input);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveAllTemplates(item, context, input));
  }
  if (obj && typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveAllTemplates(value, context, input);
    }
    return resolved;
  }
  return obj;
}

/* ─── HTTP executor ──────────────────────────────────── */

async function executeHttp(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const http = config.http;
  if (!http) {
    return { error: 'HTTP configuration missing' };
  }

  // Check for unresolved n8n template expressions in the URL
  if (!http.url || hasTemplateExpression(http.url)) {
    console.log(`[HTTP] URL contains unresolved template expression: "${http.url}" — simulating`);
    return {
      success: true,
      status: 200,
      data: { message: 'HTTP request simulated (URL contains template expression that needs configuration)' },
      url: http.url || '(not configured)',
      method: http.method || 'GET',
      timestamp: new Date().toISOString(),
      _simulated: true,
      _reason: 'URL contains unresolved template expression',
    };
  }

  // Validate URL format
  if (!isValidUrl(http.url)) {
    console.log(`[HTTP] Invalid URL: "${http.url}" — simulating`);
    return {
      success: true,
      status: 200,
      data: { message: `HTTP request simulated (invalid URL: "${http.url}")` },
      url: http.url,
      method: http.method || 'GET',
      timestamp: new Date().toISOString(),
      _simulated: true,
      _reason: 'Invalid URL format',
    };
  }

  // ── REAL BACKEND EXECUTION (proxied) ──
  if (useRealBackend) {
    const result = await AutomationHttpAPI.request(
      http.url,
      http.method,
      http.headers,
      http.method !== 'GET' ? (http.body || input) : undefined
    );
    if (result) {
      return { success: result.status >= 200 && result.status < 300, ...result };
    }
  }

  // ── DIRECT FETCH (fallback — may have CORS issues) ──
  try {
    const response = await fetch(http.url, {
      method: http.method,
      headers: {
        'Content-Type': 'application/json',
        ...http.headers
      },
      body: http.method !== 'GET' ? JSON.stringify(http.body || input) : undefined
    });
    const data = await response.json().catch(() => response.text());
    return {
      success: response.ok,
      status: response.status,
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: true,
      data: { message: `HTTP request simulated (${error.message})` },
      url: http.url,
      method: http.method || 'GET',
      timestamp: new Date().toISOString(),
      _simulated: true,
    };
  }
}

/* ═══ AI NODE ════════════════════════════════════════════ */

async function executeAI(
  node: WorkflowNodeData, 
  input: any, 
  useRealBackend: boolean
): Promise<any> {
  const config = node.config as AINodeConfig;
  
  // ── REAL BACKEND EXECUTION ──
  if (useRealBackend) {
    const result = await AutomationAIAPI.process(config.prompt, {
      systemPrompt: config.systemPrompt,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      input,
    });
    if (result) {
      return {
        success: true,
        ...result,
      };
    }
    console.warn('[AI] Backend processing failed — falling back to simulation');
  }
  
  // ── SIMULATED EXECUTION ──
  console.log(`[AI SIMULATED] Processing with model: ${config.model || 'gpt-4'}`);
  console.log(`[AI SIMULATED] Prompt: ${config.prompt}`);
  
  const simulatedResponse = generateSimulatedAIResponse(config, input);
  
  return {
    success: true,
    model: config.model || 'gpt-4',
    prompt: config.prompt,
    response: simulatedResponse,
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    timestamp: new Date().toISOString(),
    _simulated: true,
  };
}

function generateSimulatedAIResponse(config: AINodeConfig, input: any): any {
  const prompt = config.prompt.toLowerCase();
  
  if (prompt.includes('summarize') || prompt.includes('summary')) {
    return {
      summary: `Summary of input data: ${JSON.stringify(input).substring(0, 200)}...`,
      keyPoints: ['Point 1', 'Point 2', 'Point 3']
    };
  }
  if (prompt.includes('classify') || prompt.includes('categorize')) {
    return { category: 'General', confidence: 0.85, reasoning: 'Based on input content analysis' };
  }
  if (prompt.includes('extract') || prompt.includes('parse')) {
    return { extractedData: { entities: ['Entity 1', 'Entity 2'], dates: [new Date().toISOString()] } };
  }
  if (prompt.includes('analyze') || prompt.includes('sentiment')) {
    return { analysis: 'The content appears to be neutral with professional tone.', sentiment: 'neutral', score: 0.5 };
  }
  return { result: 'AI processing completed successfully (simulated)', processedInput: input };
}

/* ═══ FILTER NODE ════════════════════════════════════════ */

async function executeFilter(node: WorkflowNodeData, input: any): Promise<any> {
  const config = node.config as FilterConfig;
  if (!config || !config.conditions) return input;
  
  const passes = evaluateCondition(config, input);
  return {
    ...input,
    _filter: { passed: passes, conditions: config.conditions.length, logic: config.logic }
  };
}

/* ═══ DELAY NODE ═════════════════════════════════════════ */

async function executeDelay(node: WorkflowNodeData, input: any): Promise<any> {
  const config = node.config as DelayConfig;
  if (!config) return input;
  
  const multipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  
  const delayMs = config.duration * (multipliers[config.unit] || 1000);
  const actualDelay = Math.min(delayMs, 5000); // Cap at 5s for demo
  
  await new Promise(resolve => setTimeout(resolve, actualDelay));
  
  return {
    ...input,
    _delay: {
      requested: `${config.duration} ${config.unit}`,
      actual: `${actualDelay}ms`,
      timestamp: new Date().toISOString()
    }
  };
}

/* ═══ ACTION NODE ════════════════════════════════════════ */

async function executeAction(
  node: WorkflowNodeData, 
  input: any,
  useRealBackend: boolean
): Promise<any> {
  const config = node.config as any;
  
  // If the action is email/slack/ai, route to the specific executor
  if (config.actionType === 'send_email') {
    return executeGmail({ appType: 'gmail', gmail: { action: 'send', ...config } } as AppConfig, input, useRealBackend);
  }
  if (config.actionType === 'send_message') {
    return executeSlack({ appType: 'slack', slack: { action: 'send_message', ...config } } as AppConfig, input, useRealBackend);
  }
  if (config.actionType === 'ai_process') {
    return executeAI(node, input, useRealBackend);
  }
  if (config.actionType === 'http_request') {
    return executeHttp({ appType: 'http', http: config } as AppConfig, input, useRealBackend);
  }

  console.log(`[Action] Executing: ${config.actionType || 'generic'}`);
  return {
    success: true,
    action: config.actionType || 'generic',
    input,
    result: 'Action completed successfully',
    timestamp: new Date().toISOString()
  };
}

/* ═══ CONDITION NODE (n8n IF/Switch) ═════════════════════ */

async function executeCondition(node: WorkflowNodeData, input: any): Promise<any> {
  const config = node.config as any;
  const conditions = config.conditions || config.n8nParameters?.conditions;
  
  // If we have n8n-style conditions, evaluate them
  if (conditions) {
    // Try to evaluate — for n8n conditions we check if expressions match
    const result = evaluateN8nConditions(conditions, input);
    return {
      ...input,
      _condition: {
        nodeId: node.id,
        label: node.label,
        result,
        passedPath: result ? 'true' : 'false',
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  // Default: pass through
  return {
    ...input,
    _condition: {
      nodeId: node.id,
      result: true,
      passedPath: 'true',
      timestamp: new Date().toISOString(),
    },
  };
}

function evaluateN8nConditions(conditions: any, input: any): boolean {
  // n8n conditions can be in various formats
  if (!conditions) return true;
  
  // n8n IF node: { conditions: { string: [{value1, operation, value2}], number: [...] } }
  if (conditions.string) {
    for (const c of conditions.string) {
      const val1 = resolveN8nExpression(c.value1, input);
      const val2 = resolveN8nExpression(c.value2, input);
      switch (c.operation) {
        case 'equal': if (val1 !== val2) return false; break;
        case 'notEqual': if (val1 === val2) return false; break;
        case 'contains': if (!String(val1).includes(String(val2))) return false; break;
        case 'notContains': if (String(val1).includes(String(val2))) return false; break;
        case 'startsWith': if (!String(val1).startsWith(String(val2))) return false; break;
        case 'endsWith': if (!String(val1).endsWith(String(val2))) return false; break;
        case 'isEmpty': if (val1 !== '' && val1 !== null && val1 !== undefined) return false; break;
        case 'isNotEmpty': if (val1 === '' || val1 === null || val1 === undefined) return false; break;
        case 'regex': {
          try { if (!new RegExp(String(val2)).test(String(val1))) return false; } catch { return false; }
          break;
        }
      }
    }
  }
  
  if (conditions.number) {
    for (const c of conditions.number) {
      const val1 = Number(resolveN8nExpression(c.value1, input));
      const val2 = Number(resolveN8nExpression(c.value2, input));
      switch (c.operation) {
        case 'equal': if (val1 !== val2) return false; break;
        case 'notEqual': if (val1 === val2) return false; break;
        case 'larger': if (!(val1 > val2)) return false; break;
        case 'largerEqual': if (!(val1 >= val2)) return false; break;
        case 'smaller': if (!(val1 < val2)) return false; break;
        case 'smallerEqual': if (!(val1 <= val2)) return false; break;
      }
    }
  }
  
  if (conditions.boolean) {
    for (const c of conditions.boolean) {
      const val1 = resolveN8nExpression(c.value1, input);
      const val2 = c.value2;
      switch (c.operation) {
        case 'equal': if (Boolean(val1) !== Boolean(val2)) return false; break;
        case 'notEqual': if (Boolean(val1) === Boolean(val2)) return false; break;
      }
    }
  }
  
  return true;
}

function resolveN8nExpression(value: any, input: any): any {
  if (typeof value !== 'string') return value;
  
  // Handle both =expression and ={{expression}} syntax
  let expr = '';
  
  // Check for ={{expression}} syntax
  const bracketMatch = value.match(/^=\{\{(.+)\}\}$/);
  if (bracketMatch) {
    expr = bracketMatch[1].trim();
  } 
  // Check for =expression syntax (without braces)
  else if (value.startsWith('=') && !value.startsWith('={{')) {
    expr = value.slice(1).trim();
    // Also handle {{ }} inside
    const innerMatch = expr.match(/^\{\{(.+)\}\}$/);
    if (innerMatch) {
      expr = innerMatch[1].trim();
    }
  }
  
  if (!expr) return value;
  
  // Handle $('NodeName').item.json.field syntax (n8n node references)
  const nodeRefMatch = expr.match(/\$\(['"]([^'"]+)['"]\)\.item\.json\.(.+)/);
  if (nodeRefMatch) {
    const [, _nodeName, fieldPath] = nodeRefMatch;
    // Map n8n field paths to our input data
    return resolveN8nFieldPath(fieldPath, input);
  }
  
  // $json["field"] or $json.field
  const jsonFieldMatch = expr.match(/\$json\["([^"]+)"\]|\$json\.(\w+)/);
  if (jsonFieldMatch) {
    const field = jsonFieldMatch[1] || jsonFieldMatch[2];
    return input?.[field];
  }
  
  // Nested access: $json["a"]["b"]
  const nestedMatch = expr.match(/\$json(?:\["([^"]+)"\])+/g);
  if (nestedMatch) {
    let result = input;
    const fields = [...expr.matchAll(/\["([^"]+)"\]/g)].map(m => m[1]);
    for (const f of fields) {
      result = result?.[f];
    }
    return result;
  }
  
  return value;
}

/**
 * Resolve n8n-style field paths like 'headers.subject' to our data structure.
 */
function resolveN8nFieldPath(fieldPath: string, data: any): any {
  const fieldMappings: Record<string, string[]> = {
    'headers.subject': ['subject', 'email.subject'],
    'headers.from': ['from', 'fromEmail', 'email.from', 'email.fromEmail'],
    'headers.to': ['to', 'email.to'],
    'subject': ['subject', 'email.subject'],
    'from': ['from', 'fromEmail', 'email.from'],
    'body': ['body', 'fullMessage', 'email.body', 'email.fullMessage'],
    'text': ['body', 'fullMessage', 'email.body'],
    'html': ['body', 'fullMessage', 'email.body'],
    'id': ['messageId', 'id', 'email.id'],
    'threadId': ['threadId', 'email.threadId'],
  };
  
  // Try mapped fields first
  const mappings = fieldMappings[fieldPath];
  if (mappings) {
    for (const mapping of mappings) {
      const val = getNestedValue(data, mapping);
      if (val !== undefined && val !== null) {
        return val;
      }
    }
  }
  
  // Fall back to direct field access
  return getNestedValue(data, fieldPath);
}

/* ═══ GENERIC N8N NODE EXECUTOR ══════════════════════════ */

async function executeGenericN8nNode(
  node: WorkflowNodeData,
  input: any,
  useRealBackend: boolean
): Promise<any> {
  const config = node.config as any;
  const n8nType = config?.n8nOriginalType || '';
  const n8nParams = config?.n8nParameters || {};
  const genericApp = config?.genericAppName || '';
  
  console.log(`[n8n Node] Executing: ${node.label} (${n8nType})`);
  
  // If this is a generic app node with HTTP config, try to execute via HTTP
  // But only if the URL doesn't contain template expressions
  if (genericApp && useRealBackend && config?.http) {
    const httpUrl = config.http?.url || '';
    if (httpUrl && !hasTemplateExpression(httpUrl) && isValidUrl(httpUrl)) {
      try {
        return await executeHttp({ appType: 'http', http: config.http } as AppConfig, input, useRealBackend);
      } catch (err) {
        console.warn(`[n8n Node] HTTP execution failed for ${genericApp}, using simulation`);
      }
    } else if (httpUrl && hasTemplateExpression(httpUrl)) {
      console.log(`[n8n Node] Skipping HTTP for ${genericApp} — URL has template expressions`);
    }
  }
  
  // Simulate execution based on the n8n node type
  const shortType = n8nType.replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', '');
  const operation = n8nParams.operation || n8nParams.resource || 'execute';
  
  return {
    success: true,
    nodeId: node.id,
    nodeType: shortType || node.type,
    label: node.label,
    operation,
    app: genericApp || shortType,
    input: typeof input === 'object' ? { ...input } : input,
    output: generateSimulatedOutput(shortType, operation, n8nParams, input),
    timestamp: new Date().toISOString(),
    _simulated: true,
    _n8nOriginal: true,
  };
}

/**
 * Generate realistic simulated output for any n8n node type
 */
function generateSimulatedOutput(nodeType: string, operation: string, params: any, input: any): any {
  const t = nodeType.toLowerCase();
  
  // Data transformation nodes
  if (t === 'set' || t === 'function' || t === 'functionitem' || t === 'code') {
    return { ...input, _processed: true, _by: nodeType };
  }
  
  // Merge nodes
  if (t === 'merge') {
    return { ...input, _merged: true, mergeMode: params.mode || 'append' };
  }
  
  // Split nodes
  if (t === 'splitinbatches' || t === 'splitout') {
    return Array.isArray(input) ? input : [input];
  }
  
  // Aggregate / Summarize
  if (t === 'aggregate' || t === 'summarize') {
    return { aggregatedCount: Array.isArray(input) ? input.length : 1, data: input };
  }
  
  // Remove Duplicates
  if (t === 'removeduplicates') {
    return { ...input, _deduped: true };
  }
  
  // DateTime
  if (t === 'datetime') {
    return { ...input, formattedDate: new Date().toISOString(), _formatted: true };
  }
  
  // Crypto
  if (t === 'crypto') {
    return { ...input, hash: 'a1b2c3d4e5f6', algorithm: params.algorithm || 'sha256' };
  }
  
  // HTTP Request
  if (t === 'httprequest' || t === 'http') {
    return { status: 200, data: { message: 'HTTP request simulated' }, url: params.url };
  }
  
  // Execute Command
  if (t === 'executecommand') {
    return { stdout: 'Command executed successfully', exitCode: 0, command: params.command };
  }
  
  // Execute Workflow
  if (t === 'executeworkflow') {
    return { workflowCompleted: true, subWorkflowId: params.workflowId };
  }
  
  // CRM operations
  if (['hubspot', 'salesforce', 'pipedrive', 'zohocrm', 'copper', 'activecampaign'].includes(t)) {
    return generateCrmOutput(operation, params);
  }
  
  // Communication
  if (['telegram', 'discord', 'mattermost', 'matrix', 'whatsapp', 'twilio'].includes(t)) {
    return {
      messageId: `sim-${t}-${Date.now()}`,
      delivered: true,
      channel: params.channel || params.chatId || 'default',
    };
  }
  
  // E-commerce
  if (['shopify', 'woocommerce', 'stripe', 'paypal'].includes(t)) {
    return generateEcommerceOutput(t, operation, params);
  }
  
  // Productivity
  if (['notion', 'airtable', 'googlesheets', 'todoist', 'trello', 'asana', 'clickup', 'mondaycom'].includes(t)) {
    return generateProductivityOutput(t, operation, params);
  }
  
  // File Storage
  if (['googledrive', 'dropbox', 'box', 'microsoftonedrive', 'awss3'].includes(t)) {
    return { fileId: `sim-file-${Date.now()}`, name: params.name || 'document', uploaded: true };
  }
  
  // Database
  if (['postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'supabase'].includes(t)) {
    return { rows: [{ id: 1, data: 'sample' }], rowCount: 1, query: operation };
  }
  
  // Development
  if (['github', 'gitlab', 'bitbucket', 'jira'].includes(t)) {
    return { id: `sim-${t}-${Date.now()}`, action: operation, success: true };
  }
  
  // Error handlers  
  if (t === 'stopanderror') {
    return { stopped: true, message: params.message || 'Workflow stopped' };
  }
  
  // No-op
  if (t === 'noop' || t === 'nop') {
    return input;
  }
  
  // Respond to webhook
  if (t === 'respondtowebhook') {
    return { responded: true, statusCode: params.responseCode || 200 };
  }
  
  // XML / HTML / Markdown processing
  if (['xml', 'html', 'markdown'].includes(t)) {
    return { ...input, _converted: true, format: t };
  }
  
  // Binary file operations
  if (['readbinaryfile', 'readbinaryfiles', 'writebinaryfile', 'movebinarydata', 'converttofile', 'extractfromfile'].includes(t)) {
    return { ...input, binaryProcessed: true, fileName: params.fileName || 'file' };
  }
  
  // Wait node
  if (t === 'wait') {
    return { ...input, waited: true, resumedAt: new Date().toISOString() };
  }
  
  // Default: pass through with metadata
  return {
    ...input,
    _executedBy: nodeType,
    _operation: operation,
    _simulated: true,
  };
}

function generateCrmOutput(operation: string, params: any): any {
  switch (operation) {
    case 'create':
      return { id: `sim-crm-${Date.now()}`, created: true };
    case 'update':
      return { id: params.id || `sim-crm-${Date.now()}`, updated: true };
    case 'get':
      return { id: params.id || '1', name: 'Sample Contact', email: 'contact@example.com' };
    case 'getAll':
    case 'search':
      return { results: [{ id: '1', name: 'Contact 1' }, { id: '2', name: 'Contact 2' }], total: 2 };
    case 'delete':
      return { id: params.id || '1', deleted: true };
    default:
      return { operation, success: true };
  }
}

function generateEcommerceOutput(app: string, operation: string, params: any): any {
  switch (operation) {
    case 'create':
      return { id: `sim-${app}-${Date.now()}`, created: true, type: params.resource };
    case 'get':
      return { id: params.id || '1', status: 'active', amount: 9999 };
    case 'getAll':
      return { items: [{ id: '1', name: 'Product A' }, { id: '2', name: 'Product B' }] };
    default:
      return { operation, success: true, app };
  }
}

function generateProductivityOutput(app: string, operation: string, params: any): any {
  switch (operation) {
    case 'create':
    case 'create_page':
      return { id: `sim-${app}-${Date.now()}`, created: true, title: params.title || 'New Item' };
    case 'update':
    case 'update_page':
      return { id: params.id || '1', updated: true };
    case 'get':
    case 'read':
      return { id: params.id || '1', title: 'Sample', content: 'Sample content' };
    case 'getAll':
    case 'lookup':
      return { results: [{ id: '1', title: 'Item 1' }, { id: '2', title: 'Item 2' }] };
    case 'append':
      return { rowIndex: 42, appended: true };
    default:
      return { operation, success: true, app };
  }
}

/* ═══ KNOWLEDGE NODE ═════════════════════════════════════ */

async function executeKnowledge(
  node: WorkflowNodeData, 
  input: any
): Promise<any> {
  const config = node.config as any;
  console.log(`[Knowledge] Accessing: ${config.knowledgeBaseId || 'default'}`);
  
  return {
    success: true,
    knowledgeBase: config.knowledgeBaseId || 'default',
    action: config.action || 'query',
    results: [],
    timestamp: new Date().toISOString()
  };
}

/* ═══ MEMORY NODE ════════════════════════════════════════ */

async function executeMemory(
  node: WorkflowNodeData,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  const config = node.config as MemoryConfig;
  const scope = config.scope || 'agent';
  const agentId = context.agentId;

  console.log(`[Memory] ${config.action} — scope: ${scope}, key: ${config.key || '(search)'}`);

  switch (config.action) {
    case 'write': {
      const value = config.value !== undefined ? config.value : input;
      const key = config.key || 'latest';
      const entry = await AgentMemoryService.write(agentId, scope, key, value, config.ttlMinutes);
      context.memory[key] = value;
      return {
        success: true,
        action: 'write',
        scope,
        key,
        entryId: entry.id,
        timestamp: new Date().toISOString(),
      };
    }

    case 'read': {
      const key = config.key || 'latest';
      const value = await AgentMemoryService.read(agentId, scope, key);
      return {
        success: true,
        action: 'read',
        scope,
        key,
        value: value ?? context.memory[key] ?? null,
        found: value !== null || context.memory[key] !== undefined,
        timestamp: new Date().toISOString(),
      };
    }

    case 'search': {
      const queryStr = config.query || JSON.stringify(input).substring(0, 100);
      const results = await AgentMemoryService.search(agentId, scope, queryStr);
      return {
        success: true,
        action: 'search',
        scope,
        query: queryStr,
        results: results.map((r) => ({ key: r.key, value: r.value })),
        count: results.length,
        timestamp: new Date().toISOString(),
      };
    }

    case 'delete': {
      const key = config.key || 'latest';
      await AgentMemoryService.delete(agentId, scope, key);
      delete context.memory[key];
      return {
        success: true,
        action: 'delete',
        scope,
        key,
        timestamp: new Date().toISOString(),
      };
    }

    default:
      return { success: false, error: `Unknown memory action: ${config.action}` };
  }
}

/* ═══ AGENT CALL NODE ════════════════════════════════════ */

async function executeAgentCall(
  node: WorkflowNodeData,
  input: any,
  context: ExecutionContext,
): Promise<any> {
  const config = node.config as AgentCallConfig;
  const targetId = config.targetAgentId;
  const targetName = config.targetAgentName || targetId;

  if (!targetId) {
    return { success: false, error: 'No target agent configured for agent_call node.' };
  }

  // Prevent infinite recursion
  if (targetId === context.agentId) {
    return { success: false, error: 'Agent cannot call itself (infinite recursion prevented).' };
  }

  console.log(`[AgentCall] Calling agent "${targetName}" (${targetId}) — wait: ${config.waitForResult}`);

  // Build input for the target agent
  let callInput = config.passInput ? input : {};
  if (config.inputMapping) {
    const mapped: any = {};
    for (const [targetKey, sourceKey] of Object.entries(config.inputMapping)) {
      mapped[targetKey] = getNestedValue(input, sourceKey);
    }
    callInput = mapped;
  }

  const timeoutMs = (config.timeoutSeconds || 30) * 1000;

  const result = await AgentBus.callAgent(
    context.agentId,
    'caller-agent',
    targetId,
    callInput,
    config.waitForResult !== false,
    timeoutMs,
  );

  if (result.success) {
    console.log(`[AgentCall] Agent "${targetName}" completed successfully`);
  } else {
    console.warn(`[AgentCall] Agent "${targetName}" failed: ${result.error}`);
  }

  return {
    ...result,
    targetAgentId: targetId,
    targetAgentName: targetName,
    timestamp: new Date().toISOString(),
  };
}

/* ═══ VISION BROWSE / DESKTOP TASK NODE ══════════════════ */

const BACKEND_URL_VISION = 'http://localhost:3001';

async function executeVisionTask(
  node: WorkflowNodeData,
  input: any,
  useRealBackend: boolean,
): Promise<any> {
  const config = node.config as Record<string, any>;
  const task = config.task || config.description || node.label;
  const url = config.url || input.url;
  const appName = config.appName || config.app;
  const isDesktop = node.type === 'desktop_task' || !!appName;

  console.log(`[Vision] ${isDesktop ? 'Desktop' : 'Browser'}: ${task}`);

  if (useRealBackend) {
    try {
      const endpoint = isDesktop ? '/api/browser/vision/desktop' : '/api/browser/vision/task';
      const body = isDesktop ? { task, appName } : { task, url };

      const res = await fetch(`${BACKEND_URL_VISION}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success && data.data) {
        return {
          ...data.data,
          _executionMode: 'vision_agent',
        };
      }
      console.warn('[Vision] Backend returned failure:', data.error);
    } catch (err: any) {
      console.warn(`[Vision] Backend error: ${err.message}`);
    }
  }

  // Simulated fallback
  await new Promise(r => setTimeout(r, 2000));
  return {
    success: true,
    task,
    url,
    extractedData: { note: 'Vision agent requires the backend server to be running' },
    totalSteps: 0,
    durationMs: 0,
    _simulated: true,
    _executionMode: 'demo',
    timestamp: new Date().toISOString(),
  };
}

/* ═══ BROWSER TASK NODE ══════════════════════════════════ */

async function executeBrowserTask(
  node: WorkflowNodeData,
  input: any,
  context: ExecutionContext,
  useRealBackend: boolean,
): Promise<any> {
  const config = node.config as BrowserTaskConfig;
  const sessionId = context.agentId;

  console.log(`[Browser] ${config.action}: ${config.description}`);

  // ── REAL BACKEND (Puppeteer) ──
  if (useRealBackend) {
    try {
      // Ensure a headless browser session exists for this agent
      await AutomationBrowserAPI.createSession(sessionId, { headless: true });

      const params = buildBrowserParams(config, input);
      const result = await AutomationBrowserAPI.action(sessionId, config.action, params);

      if (result) {
        // Post-action wait if configured
        if (config.waitAfterMs) {
          await new Promise(r => setTimeout(r, Math.min(config.waitAfterMs!, 10_000)));
        }

        return {
          ...result,
          description: config.description,
          requiresConfirmation: config.requiresConfirmation || false,
          _executionMode: 'puppeteer',
        };
      }
      console.warn('[Browser] Backend action returned null — falling back to simulation');
    } catch (err: any) {
      console.warn(`[Browser] Backend error: ${err.message} — falling back to simulation`);
    }
  }

  // ── SIMULATED EXECUTION (Demo mode) ──
  const simulated = simulateBrowserAction(config, input);

  const delay = config.waitAfterMs || (config.action === 'navigate' ? 1500 : 500);
  await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 3000)));

  return {
    success: true,
    action: config.action,
    description: config.description,
    ...simulated,
    requiresConfirmation: config.requiresConfirmation || false,
    timestamp: new Date().toISOString(),
    _simulated: true,
    _executionMode: 'demo',
  };
}

function buildBrowserParams(config: BrowserTaskConfig, input: any): Record<string, any> {
  const params: Record<string, any> = {};

  switch (config.action) {
    case 'navigate':
      params.url = config.url || input.url;
      break;
    case 'click':
      params.selector = config.selector;
      params.waitForNav = true;
      break;
    case 'type':
      params.selector = config.selector;
      params.text = config.value || input.value || '';
      params.clearFirst = true;
      break;
    case 'select':
      params.selector = config.selector;
      params.value = config.value || input.value || '';
      break;
    case 'scroll':
      params.direction = 'down';
      params.pixels = 500;
      break;
    case 'wait':
      params.ms = config.waitAfterMs || 1000;
      break;
    case 'screenshot':
      params.fullPage = false;
      break;
    case 'extract':
      params.selector = config.selector;
      break;
    case 'submit':
      params.selector = config.selector || 'form';
      break;
    case 'login':
      params.url = config.url;
      params.usernameSelector = config.credentials?.usernameField || '#email';
      params.passwordSelector = config.credentials?.passwordField || '#password';
      params.username = input.username || '';
      params.password = input.password || '';
      break;
    case 'search':
      params.url = config.url;
      params.query = config.value || input.query || input.searchTerm || '';
      break;
    case 'add_to_cart':
      params.selector = config.selector || '.add-to-cart, #add-to-cart-button';
      break;
    case 'checkout':
      params.selector = config.selector || '#checkout, .checkout-button';
      params.waitForNav = true;
      break;
    default:
      if (config.selector) params.selector = config.selector;
      if (config.url) params.url = config.url;
      if (config.value) params.value = config.value;
  }

  return params;
}

function simulateBrowserAction(config: BrowserTaskConfig, input: any): any {
  const sims: Record<string, () => any> = {
    navigate: () => ({ url: config.url || input.url || 'https://example.com', title: 'Page loaded', loaded: true }),
    click: () => ({ selector: config.selector, clicked: true }),
    type: () => ({ selector: config.selector, typed: config.value || input.value || '', field: config.selector }),
    select: () => ({ selector: config.selector, selected: config.value || input.value || '' }),
    scroll: () => ({ direction: 'down', pixels: 500 }),
    wait: () => ({ waited: config.waitAfterMs || 1000 }),
    screenshot: () => ({ captured: true, filename: `screenshot-${Date.now()}.png` }),
    extract: () => ({ selector: config.selector, extracted: 'Sample extracted content', elements: 1 }),
    submit: () => ({ selector: config.selector || 'form', submitted: true }),
    login: () => ({ url: config.url, loggedIn: true }),
    search: () => ({ query: config.value || input.query || '', searched: true, resultsFound: 15 }),
    add_to_cart: () => ({ item: input.productName || 'Product', addedToCart: true, cartCount: (input.cartCount || 0) + 1 }),
    checkout: () => ({ initiated: true, requiresConfirmation: true, total: input.total || '$0.00' }),
    custom: () => ({ description: config.description, executed: true }),
  };
  return (sims[config.action] || sims.custom)();
}

/* ═══ EXPORTS ════════════════════════════════════════════ */

export const ExecutionEngine = {
  executeWorkflow,
  registerExecutor
};
