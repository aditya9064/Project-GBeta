/* ═══════════════════════════════════════════════════════════
   Prompt-to-Agent Service — AI-Powered Workflow Generation

   Takes a natural language prompt and uses OpenAI to generate
   a complete, validated WorkflowDefinition that the execution
   engine can run end-to-end.

   Pipeline:
   1. Analyze prompt to understand intent, triggers, and actions
   2. Generate a structured workflow (nodes + edges) via LLM
   3. Validate the workflow for completeness and correctness
   4. Return the workflow with metadata for deployment
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../config.js';

/* ─── Types ──────────────────────────────────────────────── */

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

interface GeneratedWorkflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>;
}

export interface GeneratedAgentResult {
  success: boolean;
  name: string;
  description: string;
  workflow: GeneratedWorkflow;
  triggerType: string;
  requiresBrowser: boolean;
  estimatedDuration: string;
  riskAssessment: 'low' | 'medium' | 'high';
  warnings: string[];
  requiredInputs: RequiredInput[];
  explanation: string;
  error?: string;
}

export interface RequiredInput {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'url' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  required: boolean;
  options?: string[];
}

/* ─── OpenAI Client ──────────────────────────────────────── */

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/* ─── System Prompt ──────────────────────────────────────── */

const SYSTEM_PROMPT = `You are an expert automation workflow architect. Your job is to convert natural language descriptions into executable workflow definitions.

You generate workflows using these node types:

NODE TYPES:
- "trigger": Entry point. Config: { triggerType: "manual" | "email" | "schedule" | "webhook" | "form" }
  For schedule: add schedule: { frequency: "minutely" | "hourly" | "daily" | "weekly", time?: "HH:MM", dayOfWeek?: 0-6 }
  For email: add emailFilter: { from?: string, subject?: string }
- "ai": AI processing node. Config: { model: "gpt-4", prompt: "...", systemPrompt?: "...", temperature?: 0.7, maxTokens?: 1024, outputFormat?: "text" | "json" }
- "app": Integration node. Config depends on appType:
  Gmail: { appType: "gmail", gmail: { action: "send" | "reply" | "read" | "draft", to?: "...", subject?: "...", body?: "..." } }
  Slack: { appType: "slack", slack: { action: "send_message", channel: "#...", message: "..." } }
  Notion: { appType: "notion", notion: { action: "create_page" | "query_database", content?: "..." } }
  HTTP: { appType: "http", http: { method: "GET" | "POST" | "PUT" | "DELETE", url: "...", headers?: {}, body?: {} } }
- "condition": Branching. Config: { field: "...", operator: "equals" | "contains" | "greater_than" | "less_than" | "exists", value: "..." }
- "filter": Data filtering. Config: { field: "...", operator: "equals" | "contains" | "exists", value: "..." }
- "delay": Wait. Config: { seconds: number } or { delaySeconds: number }
- "memory": Persistent storage. Config: { action: "read" | "write", scope: "agent" | "session" | "shared", key: "...", value?: "..." }
- "agent_call": Call another agent. Config: { targetAgentId: "...", passInput: true, waitForResult: true }
- "browser_task": Simple browser automation (only for trivial single-page actions). Config: { action: "navigate" | "click" | "type" | "extract" | "screenshot" | "wait" | "login" | "search" | "submit", url?: "...", selector?: "...", value?: "...", description: "...", waitAfterMs?: number }
- "vision_browse": AI-powered browser navigation — USE THIS for any task that requires navigating websites, finding information, extracting data from web pages, or interacting with web UIs. This node uses AI vision to see the page and navigate like a human. Config: { task: "what to do on the website (be specific and detailed)", url: "starting URL" }
  IMPORTANT: Prefer vision_browse over browser_task for any real website interaction. browser_task uses hardcoded CSS selectors that break on real sites. vision_browse uses AI to see and understand the page visually.
- "desktop_task": Control native desktop apps (macOS). Config: { task: "what to do in the app", appName: "App Name" (e.g. "Finder", "Notes", "Calendar", "Safari") }
- "action": Generic action. Config: { actionType: "send_email" | "send_message" | "http_request" | "ai_process", ... }
- "code": Run JavaScript code. Config: { code: "..." }
- "set": Set variables. Config: { assignments: [{ field: "...", value: "..." }] }
- "computer_task": Meta-orchestration for complex multi-step goals. Uses the Computer engine to dynamically plan and execute subtasks. Config: { goal: "detailed description of what to accomplish", context?: {} }
  USE THIS for complex goals that require multiple research steps, browsing multiple sites, gathering and synthesizing information, AND taking actions. computer_task handles the planning automatically.

TEMPLATE EXPRESSIONS:
Use template expressions to pass data between nodes:
- Simple: {{fieldName}} or {{nested.field}}
- From previous node output: {{response}}, {{data}}, {{emails}}
- n8n-style: {{ $json.field }}

RULES:
1. ALWAYS start with a trigger node
2. Every workflow MUST have at least one trigger and one action node
3. Nodes are connected sequentially via edges
4. Use descriptive labels for each node (max 60 chars)
5. Position nodes vertically: x=400, y starts at 60 and increments by 140
6. Every edge needs a unique id like "edge-0", "edge-1", etc.
7. For AI nodes that process data from previous nodes, use {{field}} template expressions in the prompt
8. For conditional workflows, use condition nodes with sourceHandle "true" or "false" on outgoing edges
9. For ANY task involving visiting a website, extracting data from the web, or interacting with web pages: ALWAYS use vision_browse nodes — NOT browser_task. vision_browse uses AI vision to see and navigate pages like a human. browser_task only works with hardcoded CSS selectors which break on real websites.
10. Use memory nodes to persist important data across executions
11. Keep workflows focused and practical — no unnecessary nodes
12. For controlling native desktop apps (Finder, Notes, Calendar, etc.), use desktop_task nodes with the appName in config
13. vision_browse nodes should have a detailed, specific "task" field describing what to do on the page (e.g., "Find MacBook Pro pricing, navigate to the MacBook Pro page, and extract all model names and prices")
14. For COMPLEX goals that involve multiple research steps, browsing multiple websites, gathering information from various sources, synthesizing it, AND taking actions (like sending emails), use a single "computer_task" node. This node dynamically plans and executes subtasks. Examples:
    - "Research top 3 competitors, get their pricing, and email a summary" → computer_task
    - "Find the best laptop deals, compare them, and create a report" → computer_task
    - "Monitor a website for changes and alert me" → vision_browse (simpler, single site)
    - "Send an email when I get an email from X" → regular workflow (simple automation)

IMPORTANT: Return ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.

JSON SCHEMA:
{
  "name": "Short agent name (3-6 words)",
  "description": "One-sentence description of what this agent does",
  "triggerType": "manual" | "email" | "schedule" | "webhook",
  "requiresBrowser": boolean,  // true if workflow uses vision_browse or browser_task
  "requiresDesktop": boolean, // true if workflow uses desktop_task
  "requiresComputer": boolean, // true if workflow uses computer_task (complex orchestration)
  "estimatedDuration": "e.g. 5-10s",
  "riskAssessment": "low" | "medium" | "high",
  "warnings": ["array of user-facing warnings if any"],
  "requiredInputs": [{ "key": "...", "label": "...", "type": "text|email|url|password|number|select|textarea", "placeholder": "...", "required": boolean }],
  "explanation": "2-3 sentence explanation of what the agent will do step by step",
  "workflow": {
    "nodes": [{ "id": "...", "type": "...", "label": "...", "description": "...", "config": {}, "position": { "x": 400, "y": number } }],
    "edges": [{ "id": "...", "source": "...", "target": "..." }]
  }
}`;

/* ─── Complexity Analysis ─────────────────────────────────── */

interface ComplexityAnalysis {
  isComplex: boolean;
  reason: string;
  suggestComputer: boolean;
}

async function analyzeComplexity(prompt: string): Promise<ComplexityAnalysis> {
  const complexPatterns = [
    { pattern: /research.*(and|then).*(compare|summarize|email|send|report)/i, reason: 'research + synthesis + action' },
    { pattern: /find.*multiple.*sites/i, reason: 'multi-site research' },
    { pattern: /gather.*from.*different/i, reason: 'multi-source gathering' },
    { pattern: /compare.*(pricing|prices|features|options).*across/i, reason: 'cross-site comparison' },
    { pattern: /(analyze|research|investigate).*and.*(send|email|notify|alert)/i, reason: 'research + communication' },
    { pattern: /top\s*\d+.*competitors/i, reason: 'competitive research' },
    { pattern: /monitor.*multiple/i, reason: 'multi-target monitoring' },
    { pattern: /search.*web.*and.*summarize/i, reason: 'web search + synthesis' },
  ];

  for (const { pattern, reason } of complexPatterns) {
    if (pattern.test(prompt)) {
      return { isComplex: true, reason, suggestComputer: true };
    }
  }

  const actionIndicators = (prompt.match(/\band\b|\bthen\b|\bafter\b|\bfinally\b/gi) || []).length;
  if (actionIndicators >= 3) {
    return { isComplex: true, reason: 'multi-step sequence', suggestComputer: true };
  }

  return { isComplex: false, reason: '', suggestComputer: false };
}

/* ─── Main Generator ─────────────────────────────────────── */

export class PromptToAgentService {
  /**
   * Analyze prompt complexity to determine if Computer orchestration is recommended.
   */
  static async analyzePrompt(prompt: string): Promise<ComplexityAnalysis> {
    return analyzeComplexity(prompt);
  }

  /**
   * Generate a complete, validated workflow from a natural language prompt.
   * For complex prompts, this may generate a single computer_task node that
   * handles the orchestration dynamically.
   */
  static async generate(prompt: string): Promise<GeneratedAgentResult> {
    const openai = getOpenAI();

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Convert this prompt into an executable automation workflow:\n\n"${prompt}"\n\nReturn ONLY the JSON object.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return this.errorResult('AI returned empty response');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        return this.errorResult('AI returned invalid JSON');
      }

      // Validate and normalize the workflow
      const validation = this.validateWorkflow(parsed);
      if (!validation.valid) {
        // Attempt a repair pass
        const repaired = await this.repairWorkflow(openai, prompt, content, validation.errors);
        if (repaired) {
          parsed = repaired;
        } else {
          return this.errorResult(`Generated workflow has issues: ${validation.errors.join(', ')}`);
        }
      }

      // Normalize positions
      this.normalizePositions(parsed.workflow);

      return {
        success: true,
        name: parsed.name || 'New Agent',
        description: parsed.description || prompt,
        workflow: parsed.workflow,
        triggerType: parsed.triggerType || 'manual',
        requiresBrowser: parsed.requiresBrowser || false,
        estimatedDuration: parsed.estimatedDuration || '5-15s',
        riskAssessment: parsed.riskAssessment || 'low',
        warnings: parsed.warnings || [],
        requiredInputs: parsed.requiredInputs || [],
        explanation: parsed.explanation || '',
      };
    } catch (err: any) {
      console.error('[PromptToAgent] Generation error:', err);
      return this.errorResult(err.message || 'Failed to generate agent');
    }
  }

  /**
   * Attempt to repair a broken workflow by sending it back to the LLM with error context.
   */
  private static async repairWorkflow(
    openai: OpenAI,
    originalPrompt: string,
    brokenOutput: string,
    errors: string[],
  ): Promise<any | null> {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `The previous generation for this prompt had validation errors. Fix them.

ORIGINAL PROMPT: "${originalPrompt}"

PREVIOUS OUTPUT (with errors):
${brokenOutput}

ERRORS TO FIX:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Return the corrected JSON object.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      const parsed = JSON.parse(content);
      const revalidation = this.validateWorkflow(parsed);
      return revalidation.valid ? parsed : null;
    } catch {
      return null;
    }
  }

  /* ─── Validation ──────────────────────────────────────── */

  static validateWorkflow(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.workflow) {
      errors.push('Missing "workflow" field');
      return { valid: false, errors };
    }

    const { nodes, edges } = data.workflow;

    if (!Array.isArray(nodes) || nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    if (!Array.isArray(edges)) {
      errors.push('Workflow must have an "edges" array');
    }

    if (nodes && nodes.length > 0) {
      // Must have a trigger node
      const hasTrigger = nodes.some((n: any) => n.type === 'trigger');
      if (!hasTrigger) {
        errors.push('Workflow must start with a trigger node');
      }

      // Must have at least one non-trigger node
      const hasAction = nodes.some((n: any) => n.type !== 'trigger');
      if (!hasAction) {
        errors.push('Workflow must have at least one action node');
      }

      // Validate each node
      const nodeIds = new Set<string>();
      for (const node of nodes) {
        if (!node.id) {
          errors.push('Every node must have an "id"');
          continue;
        }
        if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: ${node.id}`);
        }
        nodeIds.add(node.id);

        if (!node.type) {
          errors.push(`Node ${node.id}: missing "type"`);
        }
        if (!node.label) {
          errors.push(`Node ${node.id}: missing "label"`);
        }
        if (!node.config || typeof node.config !== 'object') {
          errors.push(`Node ${node.id}: missing or invalid "config"`);
        }
      }

      // Validate edges reference existing nodes
      if (edges) {
        for (const edge of edges) {
          if (!nodeIds.has(edge.source)) {
            errors.push(`Edge ${edge.id}: source "${edge.source}" does not exist`);
          }
          if (!nodeIds.has(edge.target)) {
            errors.push(`Edge ${edge.id}: target "${edge.target}" does not exist`);
          }
        }
      }

      // Check connectivity — every non-trigger node should be reachable
      if (edges && edges.length > 0) {
        const targets = new Set(edges.map((e: any) => e.target));
        for (const node of nodes) {
          if (node.type !== 'trigger' && !targets.has(node.id)) {
            errors.push(`Node "${node.label}" (${node.id}) is not connected — no edge targets it`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /* ─── Position Normalization ──────────────────────────── */

  private static normalizePositions(workflow: GeneratedWorkflow): void {
    if (!workflow?.nodes) return;

    const NODE_X = 400;
    const START_Y = 60;
    const GAP = 140;

    for (let i = 0; i < workflow.nodes.length; i++) {
      workflow.nodes[i].position = { x: NODE_X, y: START_Y + i * GAP };
    }
  }

  /* ─── Error Helper ───────────────────────────────────── */

  private static errorResult(error: string): GeneratedAgentResult {
    return {
      success: false,
      name: '',
      description: '',
      workflow: { nodes: [], edges: [] },
      triggerType: 'manual',
      requiresBrowser: false,
      estimatedDuration: '',
      riskAssessment: 'low',
      warnings: [],
      requiredInputs: [],
      explanation: '',
      error,
    };
  }
}
