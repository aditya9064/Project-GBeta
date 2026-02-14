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
  DelayConfig
} from './types';
import {
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationSlackAPI,
  AutomationAIAPI,
  AutomationHttpAPI,
} from './automationApi';

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

// Execution log for UI display
export interface ExecutionLog {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  isReal: boolean; // true if executed via real backend API
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

/* ═══ MAIN EXECUTION ═════════════════════════════════════ */

export async function executeWorkflow(
  agentId: string,
  userId: string,
  workflow: WorkflowDefinition,
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'event',
  triggerData: any = {},
  onNodeUpdate?: (log: ExecutionLog) => void
): Promise<{ success: boolean; output?: any; error?: string; logs: ExecutionLog[] }> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const logs: ExecutionLog[] = [];
  const backendUp = isBackendAvailable();
  
  console.log(`\n🚀 Executing workflow for agent ${agentId}`);
  console.log(`   Backend: ${backendUp ? '✅ Connected (REAL execution)' : '⚠️ Offline (SIMULATED execution)'}`);
  console.log(`   Triggered by: ${triggeredBy}`);
  console.log(`   Nodes: ${workflow.nodes.length}, Edges: ${workflow.edges.length}\n`);

  const context: ExecutionContext = {
    executionId,
    agentId,
    userId,
    trigger: { type: triggeredBy as any, data: triggerData },
    variables: { ...workflow.variables },
    nodeOutputs: {}
  };

  try {
    const executionOrder = buildExecutionOrder(workflow);
    
    for (const nodeId of executionOrder) {
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
        continue;
      }
      
      const input = getNodeInput(node, workflow, context);
      
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
        
        console.log(`  ✅ ${node.label} (${node.type}) — ${nodeLog.duration}ms ${backendUp ? '[REAL]' : '[SIMULATED]'}`);
        
      } catch (error: any) {
        nodeLog.status = 'failed';
        nodeLog.completedAt = new Date();
        nodeLog.duration = nodeLog.completedAt.getTime() - nodeLog.startedAt.getTime();
        nodeLog.error = error.message;
        onNodeUpdate?.(nodeLog);
        
        console.error(`  ❌ ${node.label} (${node.type}) — ${error.message}`);
        
        return { success: false, error: error.message, logs };
      }
    }
    
    // Get final output
    const lastNodeId = executionOrder[executionOrder.length - 1];
    const finalOutput = context.nodeOutputs[lastNodeId];
    
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
  // Check for registered custom executors first
  if (nodeExecutors[node.type]) {
    return nodeExecutors[node.type](node, { ...context, trigger: { ...context.trigger, data: input } });
  }
  
  switch (node.type) {
    case 'trigger':
      return executeTrigger(node, input);
      
    case 'app':
      return executeApp(node, input, useRealBackend);
      
    case 'ai':
      return executeAI(node, input, useRealBackend);
      
    case 'filter':
      return executeFilter(node, input);
      
    case 'delay':
      return executeDelay(node, input);
      
    case 'action':
      return executeAction(node, input, useRealBackend);
      
    case 'knowledge':
      return executeKnowledge(node, input);
      
    default:
      return input;
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
      return executeNotion(config, input);
    case 'http':
    case 'webhook':
      return executeHttp(config, input, useRealBackend);
    default:
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

/* ─── Gmail executor ─────────────────────────────────── */

async function executeGmail(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const gmail = config.gmail;
  if (!gmail) {
    return { error: 'Gmail configuration missing' };
  }

  // ── REAL BACKEND EXECUTION ──
  if (useRealBackend) {
    switch (gmail.action) {
      case 'send': {
        const to = gmail.to || input.to || input.email;
        const subject = gmail.subject || input.subject || 'Automated Email';
        const body = gmail.body || input.body || input.message || '';
        
        const result = await AutomationGmailAPI.send(to, subject, body);
        if (result) {
          return { ...result, success: true };
        }
        throw new Error('Failed to send email via Gmail API');
      }
      
      case 'reply': {
        const messageId = input.messageId || input.id;
        const body = gmail.body || input.body || input.message || '';
        
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

/* ─── Notion executor (simulated — no backend yet) ──── */

async function executeNotion(config: AppConfig, input: any): Promise<any> {
  const notion = config.notion;
  if (!notion) {
    return { error: 'Notion configuration missing' };
  }
  
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

/* ─── HTTP executor ──────────────────────────────────── */

async function executeHttp(config: AppConfig, input: any, useRealBackend: boolean): Promise<any> {
  const http = config.http;
  if (!http) {
    return { error: 'HTTP configuration missing' };
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
      success: false,
      error: error.message,
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

/* ═══ EXPORTS ════════════════════════════════════════════ */

export const ExecutionEngine = {
  executeWorkflow,
  registerExecutor
};
