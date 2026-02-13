// Execution Engine - Runs workflows step by step
import { 
  WorkflowDefinition, 
  WorkflowNodeData, 
  ExecutionContext, 
  NodeExecution,
  TriggerConfig,
  AppConfig,
  AIConfig,
  FilterConfig,
  DelayConfig
} from './types';
import { 
  startExecution, 
  updateExecutionNode, 
  completeExecution 
} from './agentService';

// Node executor functions
type NodeExecutor = (
  node: WorkflowNodeData, 
  context: ExecutionContext
) => Promise<any>;

// Registry of node executors
const nodeExecutors: Record<string, NodeExecutor> = {};

// Register a node executor
export function registerExecutor(nodeType: string, executor: NodeExecutor): void {
  nodeExecutors[nodeType] = executor;
}

// Get input data for a node based on connections
function getNodeInput(
  node: WorkflowNodeData,
  workflow: WorkflowDefinition,
  context: ExecutionContext
): any {
  // Find edges that connect to this node
  const incomingEdges = workflow.edges.filter(e => e.target === node.id);
  
  if (incomingEdges.length === 0) {
    // No incoming edges - use trigger data
    return context.trigger.data;
  }
  
  // Merge outputs from all source nodes
  const input: any = {};
  for (const edge of incomingEdges) {
    const sourceOutput = context.nodeOutputs[edge.source];
    if (sourceOutput) {
      Object.assign(input, sourceOutput);
    }
  }
  
  // Apply input mapping if defined
  if (node.inputMapping) {
    const mappedInput: any = {};
    for (const [targetKey, sourceKey] of Object.entries(node.inputMapping)) {
      mappedInput[targetKey] = getNestedValue(input, sourceKey);
    }
    return mappedInput;
  }
  
  return input;
}

// Helper to get nested values like "data.email.subject"
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Apply output mapping
function applyOutputMapping(output: any, mapping?: Record<string, string>): any {
  if (!mapping) return output;
  
  const mappedOutput: any = {};
  for (const [targetKey, sourceKey] of Object.entries(mapping)) {
    mappedOutput[targetKey] = getNestedValue(output, sourceKey);
  }
  return mappedOutput;
}

// Main execution function
export async function executeWorkflow(
  agentId: string,
  userId: string,
  workflow: WorkflowDefinition,
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'event',
  triggerData: any = {}
): Promise<{ success: boolean; output?: any; error?: string }> {
  // Start execution record
  const execution = await startExecution(agentId, userId, triggeredBy, triggerData);
  
  // Initialize context
  const context: ExecutionContext = {
    executionId: execution.id,
    agentId,
    userId,
    trigger: {
      type: triggeredBy as any,
      data: triggerData
    },
    variables: { ...workflow.variables },
    nodeOutputs: {}
  };

  try {
    // Build execution order (topological sort)
    const executionOrder = buildExecutionOrder(workflow);
    
    // Execute nodes in order
    for (const nodeId of executionOrder) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;
      
      context.currentNodeId = nodeId;
      
      // Check if this is a conditional edge
      const shouldExecute = await checkConditions(node, workflow, context);
      if (!shouldExecute) {
        continue;
      }
      
      // Get input for this node
      const input = getNodeInput(node, workflow, context);
      
      // Create node execution record
      const nodeExec: NodeExecution = {
        nodeId: node.id,
        nodeName: node.label,
        nodeType: node.type,
        status: 'running',
        startedAt: new Date(),
        input
      };

      try {
        // Execute the node
        const output = await executeNode(node, input, context);
        
        // Apply output mapping and store
        const mappedOutput = applyOutputMapping(output, node.outputMapping);
        context.nodeOutputs[node.id] = mappedOutput;
        
        // Update node execution
        nodeExec.status = 'completed';
        nodeExec.completedAt = new Date();
        nodeExec.duration = nodeExec.completedAt.getTime() - nodeExec.startedAt.getTime();
        nodeExec.output = mappedOutput;
        
      } catch (error: any) {
        nodeExec.status = 'failed';
        nodeExec.completedAt = new Date();
        nodeExec.duration = nodeExec.completedAt.getTime() - nodeExec.startedAt.getTime();
        nodeExec.error = error.message;
        
        // Record node execution
        await updateExecutionNode(execution.id, nodeExec);
        
        // Complete with failure
        await completeExecution(execution.id, 'failed', undefined, {
          nodeId: node.id,
          message: error.message,
          stack: error.stack
        });
        
        return { success: false, error: error.message };
      }
      
      // Record node execution
      await updateExecutionNode(execution.id, nodeExec);
    }
    
    // Get final output (from last node)
    const lastNodeId = executionOrder[executionOrder.length - 1];
    const finalOutput = context.nodeOutputs[lastNodeId];
    
    // Complete successfully
    await completeExecution(execution.id, 'completed', finalOutput);
    
    return { success: true, output: finalOutput };
    
  } catch (error: any) {
    await completeExecution(execution.id, 'failed', undefined, {
      nodeId: context.currentNodeId || 'unknown',
      message: error.message,
      stack: error.stack
    });
    
    return { success: false, error: error.message };
  }
}

// Build topological execution order
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
    
    // Visit all nodes that this node depends on
    const incomingEdges = workflow.edges.filter(e => e.target === nodeId);
    for (const edge of incomingEdges) {
      visit(edge.source);
    }
    
    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }
  
  // Start from nodes with no outgoing edges (leaf nodes) and work backwards
  // Or simpler: just visit all nodes
  for (const node of workflow.nodes) {
    visit(node.id);
  }
  
  return order;
}

// Check if node should execute based on conditional edges
async function checkConditions(
  node: WorkflowNodeData,
  workflow: WorkflowDefinition,
  context: ExecutionContext
): Promise<boolean> {
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

// Evaluate filter condition
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
  
  if (condition.logic === 'and') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

// Execute a single node
async function executeNode(
  node: WorkflowNodeData,
  input: any,
  context: ExecutionContext
): Promise<any> {
  // Check for registered executor
  if (nodeExecutors[node.type]) {
    return nodeExecutors[node.type](node, { ...context, trigger: { ...context.trigger, data: input } });
  }
  
  // Built-in executors
  switch (node.type) {
    case 'trigger':
      return executeTrigger(node, input);
      
    case 'app':
      return executeApp(node, input, context);
      
    case 'ai':
      return executeAI(node, input, context);
      
    case 'filter':
      return executeFilter(node, input);
      
    case 'delay':
      return executeDelay(node, input);
      
    case 'action':
      return executeAction(node, input, context);
      
    case 'knowledge':
      return executeKnowledge(node, input, context);
      
    default:
      // Pass through
      return input;
  }
}

// Trigger node executor
async function executeTrigger(node: WorkflowNodeData, input: any): Promise<any> {
  // Triggers just pass through the trigger data
  return {
    ...input,
    _trigger: {
      nodeId: node.id,
      type: (node.config as TriggerConfig).triggerType,
      timestamp: new Date().toISOString()
    }
  };
}

// App node executor
async function executeApp(
  node: WorkflowNodeData, 
  input: any, 
  context: ExecutionContext
): Promise<any> {
  const config = node.config as AppConfig;
  
  switch (config.appType) {
    case 'gmail':
      return executeGmail(config, input);
      
    case 'slack':
      return executeSlack(config, input);
      
    case 'notion':
      return executeNotion(config, input);
      
    case 'http':
    case 'webhook':
      return executeHttp(config, input);
      
    default:
      // Simulate app execution for demo
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

// Gmail executor (simulated for demo)
async function executeGmail(config: AppConfig, input: any): Promise<any> {
  const gmail = config.gmail;
  
  if (!gmail) {
    return { error: 'Gmail configuration missing' };
  }
  
  // In production, this would use the Gmail API
  // For demo, we simulate the action
  switch (gmail.action) {
    case 'send':
      console.log(`[Gmail] Sending email to: ${gmail.to}`);
      return {
        success: true,
        action: 'send',
        to: gmail.to,
        subject: gmail.subject,
        messageId: `msg-${Date.now()}`,
        timestamp: new Date().toISOString()
      };
      
    case 'read':
      console.log(`[Gmail] Reading emails`);
      return {
        success: true,
        action: 'read',
        emails: [
          {
            id: 'email-1',
            from: 'sender@example.com',
            subject: 'Sample Email',
            body: 'This is a sample email body.',
            receivedAt: new Date().toISOString()
          }
        ]
      };
      
    default:
      return { success: true, action: gmail.action };
  }
}

// Slack executor (simulated for demo)
async function executeSlack(config: AppConfig, input: any): Promise<any> {
  const slack = config.slack;
  
  if (!slack) {
    return { error: 'Slack configuration missing' };
  }
  
  switch (slack.action) {
    case 'send_message':
      console.log(`[Slack] Sending message to #${slack.channel}: ${slack.message}`);
      return {
        success: true,
        action: 'send_message',
        channel: slack.channel,
        message: slack.message || input.message,
        messageTs: `${Date.now()}.000000`,
        timestamp: new Date().toISOString()
      };
      
    default:
      return { success: true, action: slack.action };
  }
}

// Notion executor (simulated for demo)
async function executeNotion(config: AppConfig, input: any): Promise<any> {
  const notion = config.notion;
  
  if (!notion) {
    return { error: 'Notion configuration missing' };
  }
  
  switch (notion.action) {
    case 'create_page':
      console.log(`[Notion] Creating page in database: ${notion.databaseId}`);
      return {
        success: true,
        action: 'create_page',
        pageId: `page-${Date.now()}`,
        databaseId: notion.databaseId,
        properties: notion.properties || input,
        timestamp: new Date().toISOString()
      };
      
    case 'query_database':
      console.log(`[Notion] Querying database: ${notion.databaseId}`);
      return {
        success: true,
        action: 'query_database',
        databaseId: notion.databaseId,
        results: []
      };
      
    default:
      return { success: true, action: notion.action };
  }
}

// HTTP executor
async function executeHttp(config: AppConfig, input: any): Promise<any> {
  const http = config.http;
  
  if (!http) {
    return { error: 'HTTP configuration missing' };
  }
  
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
      timestamp: new Date().toISOString()
    };
  }
}

// AI executor (simulated for demo - in production would use OpenAI/Claude API)
async function executeAI(
  node: WorkflowNodeData, 
  input: any, 
  context: ExecutionContext
): Promise<any> {
  const config = node.config as AIConfig;
  
  console.log(`[AI] Processing with model: ${config.model || 'gpt-4'}`);
  console.log(`[AI] Prompt: ${config.prompt}`);
  console.log(`[AI] Input:`, input);
  
  // Simulate AI processing
  // In production, this would call OpenAI or Claude API
  const simulatedResponse = generateAIResponse(config, input);
  
  return {
    success: true,
    model: config.model || 'gpt-4',
    prompt: config.prompt,
    response: simulatedResponse,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    },
    timestamp: new Date().toISOString()
  };
}

// Generate simulated AI response
function generateAIResponse(config: AIConfig, input: any): any {
  const prompt = config.prompt.toLowerCase();
  
  // Analyze intent from prompt
  if (prompt.includes('summarize') || prompt.includes('summary')) {
    return {
      summary: `Summary of input data: ${JSON.stringify(input).substring(0, 200)}...`,
      keyPoints: ['Point 1', 'Point 2', 'Point 3']
    };
  }
  
  if (prompt.includes('classify') || prompt.includes('categorize')) {
    return {
      category: 'General',
      confidence: 0.85,
      reasoning: 'Based on the input content analysis'
    };
  }
  
  if (prompt.includes('extract') || prompt.includes('parse')) {
    return {
      extractedData: {
        entities: ['Entity 1', 'Entity 2'],
        dates: [new Date().toISOString()],
        values: []
      }
    };
  }
  
  if (prompt.includes('analyze') || prompt.includes('sentiment')) {
    return {
      analysis: 'The content appears to be neutral with professional tone.',
      sentiment: 'neutral',
      score: 0.5
    };
  }
  
  // Default response
  return {
    result: 'AI processing completed successfully',
    processedInput: input,
    recommendation: 'Continue with workflow'
  };
}

// Filter node executor
async function executeFilter(node: WorkflowNodeData, input: any): Promise<any> {
  const config = node.config as FilterConfig;
  
  if (!config || !config.conditions) {
    return input; // Pass through if no conditions
  }
  
  const passes = evaluateCondition(config, input);
  
  return {
    ...input,
    _filter: {
      passed: passes,
      conditions: config.conditions.length,
      logic: config.logic
    }
  };
}

// Delay node executor
async function executeDelay(node: WorkflowNodeData, input: any): Promise<any> {
  const config = node.config as DelayConfig;
  
  if (!config) {
    return input;
  }
  
  // Convert to milliseconds
  const multipliers: Record<string, number> = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  
  const delayMs = config.duration * (multipliers[config.unit] || 1000);
  
  // For demo, cap at 5 seconds to prevent long waits
  const actualDelay = Math.min(delayMs, 5000);
  
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

// Action node executor
async function executeAction(
  node: WorkflowNodeData, 
  input: any, 
  context: ExecutionContext
): Promise<any> {
  const config = node.config as any;
  
  console.log(`[Action] Executing action: ${config.actionType || 'generic'}`);
  
  return {
    success: true,
    action: config.actionType || 'generic',
    input,
    result: 'Action completed successfully',
    timestamp: new Date().toISOString()
  };
}

// Knowledge node executor
async function executeKnowledge(
  node: WorkflowNodeData, 
  input: any, 
  context: ExecutionContext
): Promise<any> {
  const config = node.config as any;
  
  console.log(`[Knowledge] Accessing knowledge base: ${config.knowledgeBaseId || 'default'}`);
  
  return {
    success: true,
    knowledgeBase: config.knowledgeBaseId || 'default',
    action: config.action || 'query',
    results: [],
    timestamp: new Date().toISOString()
  };
}

// Export execution engine
export const ExecutionEngine = {
  executeWorkflow,
  registerExecutor
};

