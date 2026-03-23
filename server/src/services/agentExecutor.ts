/* ═══════════════════════════════════════════════════════════
   Server-Side Agent Executor

   Runs workflow agents entirely on the server using real
   services (Gmail, Slack, OpenAI). No browser required.

   This is the server equivalent of the frontend's
   executionEngine.ts, but calls services directly instead
   of going through HTTP endpoints.
   ═══════════════════════════════════════════════════════════ */

import { GmailService } from './gmail.service.js';
import { SlackService } from './slack.service.js';
import { AIEngine } from './ai-engine.js';
import { AgentStore, type ExecutionRecord, type ExecutionNodeLog } from './agentStore.js';
import type { StoredAgent } from './agentStore.js';
import { VisionAgent } from './visionAgent.js';
import { ComputerService } from './computer/index.js';
import { ExecutionStream } from './executionStream.js';
import { logger } from './logger.js';

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: any;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  condition?: string;
}

interface WorkflowDef {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export class AgentExecutor {
  /**
   * Execute an agent's workflow with the given trigger data.
   * All execution is server-side using real services.
   */
  static async execute(
    agent: StoredAgent,
    triggerType: string,
    triggerData: any = {},
  ): Promise<ExecutionRecord> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date().toISOString();

    const record: ExecutionRecord = {
      id: executionId,
      agentId: agent.id,
      agentName: agent.name,
      userId: agent.userId,
      status: 'running',
      trigger: triggerType,
      triggerData,
      startedAt,
      logs: [],
    };

      await AgentStore.saveExecution(record);
      logger.info(`[AgentExecutor] Starting: "${agent.name}" (${executionId})`);

      // Emit SSE event for execution start
      ExecutionStream.emit({
        type: 'log',
        executionId,
        agentId: agent.id,
        message: `Starting execution of "${agent.name}"`,
        timestamp: new Date().toISOString(),
      });

    try {
      await GmailService.restoreFromStore();
      await SlackService.restoreFromStore();

      const workflow: WorkflowDef = agent.workflow;
      if (!workflow?.nodes?.length) {
        throw new Error('Agent has no workflow nodes');
      }

      const nodeOutputs: Record<string, any> = {};
      const executed = new Set<string>();

      const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        const triggerLog = this.createNodeLog(triggerNode, 'completed');
        triggerLog.output = triggerData;
        record.logs.push(triggerLog);
        nodeOutputs[triggerNode.id] = triggerData;
        executed.add(triggerNode.id);
        logger.info(`Trigger: ${triggerNode.label}`);

        // Follow edges from trigger to execute downstream nodes
        const outEdges = workflow.edges.filter(e => e.source === triggerNode.id);
        for (const edge of outEdges) {
          await this.executeFromNode(edge.target, workflow, nodeOutputs, executed, record, agent);
        }
      } else {
        // No trigger node — execute from first node
        await this.executeFromNode(workflow.nodes[0].id, workflow, nodeOutputs, executed, record, agent);
      }

      const lastNode = workflow.nodes[workflow.nodes.length - 1];
      record.output = nodeOutputs[lastNode.id] || nodeOutputs[Object.keys(nodeOutputs).pop()!];
      record.status = 'completed';
      record.completedAt = new Date().toISOString();
      record.durationMs = Date.now() - new Date(startedAt).getTime();

      await AgentStore.saveExecution(record);
      await AgentStore.recordExecution(agent.id, true);

      logger.info(`[AgentExecutor] Completed: "${agent.name}" in ${record.durationMs}ms`);

      // Emit SSE event for execution complete
      ExecutionStream.emit({
        type: 'execution_complete',
        executionId,
        agentId: agent.id,
        message: `Execution completed successfully in ${record.durationMs}ms`,
        output: record.output,
        timestamp: new Date().toISOString(),
      });

      return record;

    } catch (err: any) {
      record.status = 'failed';
      record.error = err.message;
      record.completedAt = new Date().toISOString();
      record.durationMs = Date.now() - new Date(startedAt).getTime();

      await AgentStore.saveExecution(record);
      await AgentStore.recordExecution(agent.id, false);
      await AgentStore.updateStatus(agent.id, 'error', err.message);

      logger.error(`[AgentExecutor] Failed: "${agent.name}"`, { error: err.message });

      // Emit SSE event for execution failure
      ExecutionStream.emit({
        type: 'execution_failed',
        executionId,
        agentId: agent.id,
        error: err.message,
        timestamp: new Date().toISOString(),
      });

      return record;
    }
  }

  private static async executeFromNode(
    nodeId: string,
    workflow: WorkflowDef,
    nodeOutputs: Record<string, any>,
    executed: Set<string>,
    record: ExecutionRecord,
    agent?: StoredAgent,
  ): Promise<void> {
    if (executed.has(nodeId)) return;

    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Gather input from parent nodes
    const incomingEdges = workflow.edges.filter(e => e.target === nodeId);
    let input: any = {};
    for (const edge of incomingEdges) {
      if (nodeOutputs[edge.source] !== undefined) {
        input = { ...input, ...(typeof nodeOutputs[edge.source] === 'object' ? nodeOutputs[edge.source] : { data: nodeOutputs[edge.source] }) };
      }
    }

    if (node.type === 'trigger') {
      executed.add(nodeId);
    } else {
      const nodeLog = this.createNodeLog(node, 'running');
      nodeLog.input = this.sanitizeForLog(input);
      record.logs.push(nodeLog);

      // Emit SSE event for node start
      ExecutionStream.emit({
        type: 'node_start',
        executionId: record.id,
        agentId: record.agentId,
        nodeId: node.id,
        nodeName: node.label,
        nodeType: node.type,
        status: 'running',
        timestamp: new Date().toISOString(),
      });

      try {
        const output = await this.executeNode(node, input, record);
        nodeLog.status = 'completed';
        nodeLog.completedAt = new Date().toISOString();
        nodeLog.durationMs = Date.now() - new Date(nodeLog.startedAt).getTime();
        nodeLog.output = this.sanitizeForLog(output);
        nodeOutputs[nodeId] = output;
        executed.add(nodeId);
        logger.info(`${node.type}: ${node.label} (${nodeLog.durationMs}ms)`);

        // Emit SSE event for node complete
        ExecutionStream.emit({
          type: 'node_complete',
          executionId: record.id,
          agentId: record.agentId,
          nodeId: node.id,
          nodeName: node.label,
          nodeType: node.type,
          status: 'completed',
          output: this.sanitizeForLog(output),
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        nodeLog.status = 'failed';
        nodeLog.completedAt = new Date().toISOString();
        nodeLog.durationMs = Date.now() - new Date(nodeLog.startedAt).getTime();
        nodeLog.error = err.message;
        executed.add(nodeId);
        logger.error(`${node.type}: ${node.label}`, { error: err.message });

        // Emit SSE event for node failure
        ExecutionStream.emit({
          type: 'node_failed',
          executionId: record.id,
          agentId: record.agentId,
          nodeId: node.id,
          nodeName: node.label,
          nodeType: node.type,
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString(),
        });

        throw err;
      }
    }

    // Follow outgoing edges
    const outEdges = workflow.edges.filter(e => e.source === nodeId);
    for (const edge of outEdges) {
      if (node.type === 'condition') {
        const condResult = nodeOutputs[nodeId];
        const pass = condResult?.result === true || condResult?.result === 'true';
        if (edge.sourceHandle === 'true' && pass) {
          await this.executeFromNode(edge.target, workflow, nodeOutputs, executed, record, agent);
        } else if (edge.sourceHandle === 'false' && !pass) {
          await this.executeFromNode(edge.target, workflow, nodeOutputs, executed, record, agent);
        } else if (!edge.sourceHandle) {
          await this.executeFromNode(edge.target, workflow, nodeOutputs, executed, record, agent);
        }
      } else {
        await this.executeFromNode(edge.target, workflow, nodeOutputs, executed, record, agent);
      }
    }
  }

  private static async executeNode(node: WorkflowNode, input: any, record?: ExecutionRecord): Promise<any> {
    switch (node.type) {
      case 'app':
        return this.executeApp(node, input);
      case 'ai':
        return this.executeAI(node, input);
      case 'action':
        return this.executeAction(node, input);
      case 'condition':
        return this.executeCondition(node, input);
      case 'filter':
        return this.executeFilter(node, input);
      case 'delay':
        return this.executeDelay(node, input);
      case 'http_request':
        return this.executeHttp(node, input);
      case 'code':
        return this.executeCode(node, input);
      case 'set':
        return this.executeSet(node, input);
      case 'browser_task':
      case 'vision_browse':
        return this.executeVisionBrowse(node, input);
      case 'computer_task':
        return this.executeComputerTask(node, input);
      case 'autonomous_task':
        return this.executeAutonomousTask(node, input, record?.userId || 'system');
      default:
        logger.info(`Passthrough for unknown node type: ${node.type}`);
        return { ...input, _nodeType: node.type, _processed: true };
    }
  }

  // ── App node (Gmail, Slack, etc.) ──

  private static async executeApp(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};

    switch (config.appType) {
      case 'gmail':
        return this.executeGmail(config, input);
      case 'slack':
        return this.executeSlack(config, input);
      case 'http':
        return this.executeHttpRequest(config.http, input);
      default:
        return { ...input, _app: config.appType, _processed: true };
    }
  }

  // ── Gmail ──

  private static async executeGmail(config: any, input: any): Promise<any> {
    const gmail = config.gmail;
    if (!gmail) throw new Error('Gmail configuration missing');

    switch (gmail.action) {
      case 'send': {
        const to = this.resolveTemplate(gmail.to || input.to || input.email || '', input);
        const subject = this.resolveTemplate(gmail.subject || input.subject || '', input);
        const body = this.resolveTemplate(gmail.body || input.body || input.response || '', input);

        if (!to) throw new Error('No recipient email address provided');

        const result = await GmailService.sendNewEmail(to, subject, body);
        return {
          success: true,
          action: 'send',
          to,
          subject,
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
        };
      }

      case 'reply': {
        const messageId = input.messageId || input.id;
        const body = this.resolveTemplate(gmail.body || input.body || input.response || '', input);
        if (!messageId) throw new Error('No messageId for reply');

        await GmailService.sendReply(messageId, body);
        return {
          success: true,
          action: 'reply',
          messageId,
          timestamp: new Date().toISOString(),
        };
      }

      case 'read': {
        const messages = await GmailService.fetchMessages(20);
        return {
          action: 'read',
          count: messages.length,
          emails: messages.map(e => ({
            id: e.externalId,
            from: e.from,
            fromEmail: e.fromEmail,
            subject: e.subject,
            preview: e.preview,
            fullMessage: e.fullMessage,
            receivedAt: e.receivedAt,
            priority: e.priority,
          })),
          timestamp: new Date().toISOString(),
        };
      }

      default:
        return { action: gmail.action, _unsupported: true };
    }
  }

  // ── Slack ──

  private static async executeSlack(config: any, input: any): Promise<any> {
    const slack = config.slack;
    if (!slack) throw new Error('Slack configuration missing');

    if (slack.action === 'send_message') {
      const channel = this.resolveTemplate(slack.channel || input.channel || '', input);
      const message = this.resolveTemplate(slack.message || input.message || '', input);
      if (!channel) throw new Error('No Slack channel specified');

      await SlackService.sendReply(channel, message);
      return {
        success: true,
        action: 'send_message',
        channel,
        timestamp: new Date().toISOString(),
      };
    }

    return { action: slack.action, _unsupported: true };
  }

  // ── AI (OpenAI) ──

  private static async executeAI(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};
    const prompt = this.resolveTemplate(config.prompt || '', input);
    const systemPrompt = config.systemPrompt || undefined;

    const result = await AIEngine.processAutomation(
      prompt,
      systemPrompt,
      input,
      {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
    );

    return {
      response: result.response,
      model: result.model,
      usage: result.usage,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Action node ──

  private static async executeAction(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};

    if (config.actionType === 'send_email') {
      return this.executeGmail({ appType: 'gmail', gmail: { action: 'send', ...config } }, input);
    }
    if (config.actionType === 'send_message') {
      return this.executeSlack({ appType: 'slack', slack: { action: 'send_message', ...config } }, input);
    }
    if (config.actionType === 'ai_process') {
      return this.executeAI(node, input);
    }
    if (config.actionType === 'http_request') {
      return this.executeHttpRequest(config, input);
    }

    return { ...input, _actionType: config.actionType, _processed: true };
  }

  // ── Condition ──

  private static executeCondition(node: WorkflowNode, input: any): any {
    const config = node.config || {};
    const field = config.field || '';
    const operator = config.operator || 'equals';
    const value = config.value;

    const fieldValue = this.getNestedValue(input, field);
    let result = false;

    switch (operator) {
      case 'equals': result = fieldValue === value; break;
      case 'not_equals': result = fieldValue !== value; break;
      case 'contains': result = String(fieldValue).includes(String(value)); break;
      case 'not_contains': result = !String(fieldValue).includes(String(value)); break;
      case 'greater_than': result = Number(fieldValue) > Number(value); break;
      case 'less_than': result = Number(fieldValue) < Number(value); break;
      case 'exists': result = fieldValue !== undefined && fieldValue !== null; break;
      case 'not_exists': result = fieldValue === undefined || fieldValue === null; break;
      default: result = !!fieldValue;
    }

    return { ...input, _condition: true, result, field, operator, value: String(value) };
  }

  // ── Filter ──

  private static executeFilter(node: WorkflowNode, input: any): any {
    const config = node.config || {};
    const field = config.field || '';
    const operator = config.operator || 'equals';
    const value = config.value;
    const fieldValue = this.getNestedValue(input, field);

    let pass = false;
    switch (operator) {
      case 'equals': pass = fieldValue === value; break;
      case 'contains': pass = String(fieldValue).includes(String(value)); break;
      case 'exists': pass = fieldValue !== undefined && fieldValue !== null; break;
      default: pass = !!fieldValue;
    }

    return pass ? { ...input, _filtered: true } : { _filtered: false, _dropped: true };
  }

  // ── Delay ──

  private static async executeDelay(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};
    const seconds = config.seconds || config.delaySeconds || 1;
    const ms = Math.min(seconds * 1000, 30000); // Cap at 30s for cloud functions
    await new Promise(resolve => setTimeout(resolve, ms));
    return { ...input, _delayed: true, _delayMs: ms };
  }

  // ── HTTP request ──

  private static async executeHttpRequest(config: any, input: any): Promise<any> {
    if (!config?.url) throw new Error('No URL configured for HTTP request');

    const url = this.resolveTemplate(config.url, input);
    const method = (config.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers || {}) };
    const fetchOptions: any = { method, headers };

    if (method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(config.body || input);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  private static async executeHttp(node: WorkflowNode, input: any): Promise<any> {
    return this.executeHttpRequest(node.config, input);
  }

  // ── Code node (safe eval) ──

  private static executeCode(node: WorkflowNode, input: any): any {
    const config = node.config || {};
    const code = config.code || config.expression || '';
    if (!code) return { ...input, _code: true };

    try {
      const fn = new Function('input', 'data', `"use strict"; ${code}`);
      const result = fn(input, input);
      return result !== undefined ? result : input;
    } catch (err: any) {
      return { ...input, _codeError: err.message };
    }
  }

  // ── Set node ──

  private static executeSet(node: WorkflowNode, input: any): any {
    const config = node.config || {};
    const assignments = config.assignments || config.values || [];
    const result = { ...input };
    for (const a of assignments) {
      if (a.field) result[a.field] = this.resolveTemplate(String(a.value ?? ''), input);
    }
    return result;
  }

  // ── Vision Browse (AI-powered browser/desktop navigation) ──

  private static async executeVisionBrowse(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};
    const task = this.resolveTemplate(config.task || config.description || node.label, input);
    const url = this.resolveTemplate(config.url || input.url || '', input);
    const appName = config.appName || config.app;

    if (appName) {
      const result = await VisionAgent.executeDesktopTask(task, appName);
      return {
        success: result.success,
        task,
        app: appName,
        extractedData: result.extractedData,
        totalSteps: result.totalSteps,
        durationMs: result.durationMs,
        error: result.error,
        finalUrl: result.finalUrl,
        timestamp: new Date().toISOString(),
      };
    }

    if (!url) {
      throw new Error('Vision browse node requires a "url" or "appName" in config');
    }

    const result = await VisionAgent.executeTask(task, url);
    return {
      success: result.success,
      task,
      url,
      extractedData: result.extractedData,
      totalSteps: result.totalSteps,
      durationMs: result.durationMs,
      error: result.error,
      finalUrl: result.finalUrl,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Computer Task (meta-orchestration) ──

  private static async executeComputerTask(node: WorkflowNode, input: any): Promise<any> {
    const config = node.config || {};
    const goal = this.resolveTemplate(config.goal || config.task || node.label, input);

    if (!goal) {
      throw new Error('Computer task node requires a "goal" in config');
    }

    const context = {
      ...input,
      ...config.context,
    };

    const result = await ComputerService.runTask(goal, context);

    return {
      success: result.success,
      goal,
      result: result.result,
      subtasks: result.subtasks,
      durationMs: result.durationMs,
      error: result.error,
      timestamp: new Date().toISOString(),
    };
  }

  private static async executeAutonomousTask(node: WorkflowNode, input: any, userId: string): Promise<any> {
    const config = node.config || {};
    const goal = this.resolveTemplate(config.goal || config.prompt || node.label, input);

    if (!goal) {
      throw new Error('Autonomous task node requires a "goal" in config');
    }

    const contextStr = input ? `\n\nContext from workflow: ${JSON.stringify(input).substring(0, 2000)}` : '';
    const fullGoal = `${goal}${contextStr}`;

    const { executeAutonomous } = await import('./autonomousExecutor.js');

    const steps: any[] = [];
    const collectEmit = (event: string, data: Record<string, any>) => {
      if (event === 'step_done' || event === 'tool_complete') {
        steps.push(data.step || data);
      }
    };

    const execution = await executeAutonomous(fullGoal, userId, collectEmit, {
      model: config.model || 'gpt-4o',
      maxIterations: config.maxIterations || 15,
      autoApproveRisk: config.autoApproveRisk || 'medium',
    });

    return {
      _autonomousTask: true,
      goal,
      result: execution.result,
      status: execution.status,
      totalTokens: execution.totalTokens,
      totalCost: execution.totalCost,
      stepCount: execution.steps.length,
      executionId: execution.id,
    };
  }

  // ── Helpers ──

  /**
   * Resolve template expressions in a string.
   * Supports multiple syntaxes:
   * - Simple: {{field}} or {{nested.field}}
   * - n8n style: {{ $('Node Name').item.json.field }}
   * - Prefixed: =expression (common in n8n exports)
   */
  private static resolveTemplate(template: string, data: any): string {
    if (!template) return template;
    
    // If the entire string starts with '=', it's an n8n expression - try to resolve it
    if (typeof template === 'string' && template.startsWith('=')) {
      const expression = template.slice(1);
      const resolved = this.resolveExpression(expression, data);
      if (resolved !== undefined && resolved !== null) {
        return String(resolved);
      }
      // Fall through to try other resolution methods
    }
    
    // Replace {{ expression }} patterns
    return template.replace(/\{\{(.+?)\}\}/g, (_match, expr) => {
      const trimmed = expr.trim();
      const val = this.resolveExpression(trimmed, data);
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  /**
   * Resolve a single expression.
   * Handles n8n-style $('NodeName').item.json.field and simple dot notation.
   */
  private static resolveExpression(expr: string, data: any): any {
    if (!expr) return undefined;
    
    // Handle n8n-style $('NodeName') or $("NodeName") expressions
    // These reference previous node outputs - we map them to the input data
    const n8nMatch = expr.match(/^\$\(['"]([^'"]+)['"]\)\.item\.json\.(.+)$/);
    if (n8nMatch) {
      const [, _nodeName, fieldPath] = n8nMatch;
      // The data passed to this node contains the previous node's output
      // Map common n8n fields to our input structure
      return this.resolveN8nField(fieldPath, data);
    }
    
    // Handle $json.field (shorthand for current item)
    const jsonMatch = expr.match(/^\$json\.(.+)$/);
    if (jsonMatch) {
      return this.getNestedValue(data, jsonMatch[1]);
    }
    
    // Handle simple field references
    return this.getNestedValue(data, expr);
  }

  /**
   * Resolve n8n field paths to our data structure.
   * Maps fields like 'headers.subject' to our email data.
   */
  private static resolveN8nField(fieldPath: string, data: any): any {
    // Common n8n email field mappings
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
        const val = this.getNestedValue(data, mapping);
        if (val !== undefined && val !== null) {
          return val;
        }
      }
    }
    
    // Fall back to direct field access
    return this.getNestedValue(data, fieldPath);
  }

  private static getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((cur, key) => cur?.[key], obj);
  }

  private static createNodeLog(node: WorkflowNode, status: ExecutionNodeLog['status']): ExecutionNodeLog {
    return {
      nodeId: node.id,
      nodeName: node.label,
      nodeType: node.type,
      status,
      startedAt: new Date().toISOString(),
    };
  }

  private static sanitizeForLog(data: any): any {
    if (!data) return data;
    try {
      const str = JSON.stringify(data);
      if (str.length > 5000) {
        return { _truncated: true, _size: str.length, preview: str.substring(0, 2000) + '...' };
      }
      return data;
    } catch {
      return { _type: typeof data, _toString: String(data).substring(0, 500) };
    }
  }
}
