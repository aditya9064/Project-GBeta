/* ═══════════════════════════════════════════════════════════
   Computer Orchestration Engine — Task Planner
   
   Uses GPT-4o to decompose complex goals into executable
   subtasks with dependency ordering.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../../config.js';
import { logger } from '../logger.js';
import type { TaskPlan, Subtask, SubtaskType, ExecutionOrder } from './types.js';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

const PLANNER_SYSTEM_PROMPT = `You are a task planning AI that breaks down complex goals into executable subtasks.

Given a user's goal, decompose it into a series of subtasks that can be executed by specialized systems.

AVAILABLE SUBTASK TYPES:
- ai_reasoning: Use AI to analyze, summarize, generate text, make decisions, or reason about data
- web_browse: Navigate a website using AI vision to find specific information or perform actions
- web_search: Search the web for information (use when you need to find URLs or general info first)
- send_email: Send an email via Gmail (requires: to, subject, body)
- send_slack: Send a Slack message (requires: channel, message)
- http_request: Make an HTTP API request (requires: url, method, optionally headers/body)
- code_execute: Execute JavaScript code to transform or process data
- extract_data: Use AI to extract structured data from unstructured text

PLANNING RULES:
1. Start with information gathering (web_search, web_browse) before processing
2. Use ai_reasoning to analyze and synthesize collected information
3. End with actions (send_email, send_slack, http_request) after data is ready
4. Mark dependencies correctly - a subtask can only use outputs from completed subtasks
5. Independent subtasks can run in parallel
6. Keep subtasks atomic - each should do ONE thing
7. Provide clear descriptions that explain what the subtask should accomplish
8. Include all necessary inputs for each subtask type

RESPONSE FORMAT (JSON only, no markdown):
{
  "goal": "original goal restated",
  "subtasks": [
    {
      "id": "1",
      "type": "web_search",
      "description": "What this subtask does",
      "inputs": { "query": "search terms" },
      "dependsOn": []
    },
    {
      "id": "2", 
      "type": "web_browse",
      "description": "Visit specific page",
      "inputs": { "url": "https://...", "task": "find X information" },
      "dependsOn": ["1"]
    }
  ],
  "executionOrder": "sequential" | "parallel" | "mixed",
  "dependencies": {
    "2": ["1"],
    "3": ["1", "2"]
  }
}`;

export async function planTask(
  goal: string,
  context?: Record<string, any>
): Promise<TaskPlan> {
  const openai = getOpenAI();

  const contextStr = context && Object.keys(context).length > 0
    ? `\n\nCONTEXT PROVIDED:\n${JSON.stringify(context, null, 2)}`
    : '';

  const userPrompt = `GOAL: ${goal}${contextStr}

Break this goal into executable subtasks. Return ONLY valid JSON.`;

  logger.info('[Planner] Decomposing goal', { goal: goal.slice(0, 100) });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PLANNER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const plan = validateAndNormalizePlan(parsed, goal);
    logger.info('[Planner] Plan created', { 
      subtaskCount: plan.subtasks.length,
      order: plan.executionOrder,
    });

    return plan;
  } catch (err: any) {
    logger.error('[Planner] Failed to create plan', { error: err.message });
    throw new Error(`Task planning failed: ${err.message}`);
  }
}

function validateAndNormalizePlan(raw: any, goal: string): TaskPlan {
  const validTypes: SubtaskType[] = [
    'ai_reasoning', 'web_browse', 'web_search', 'send_email',
    'send_slack', 'http_request', 'code_execute', 'extract_data'
  ];
  const validOrders: ExecutionOrder[] = ['sequential', 'parallel', 'mixed'];

  if (!Array.isArray(raw.subtasks) || raw.subtasks.length === 0) {
    throw new Error('Plan must have at least one subtask');
  }

  const subtasks: Subtask[] = raw.subtasks.map((s: any, idx: number) => {
    const id = String(s.id || idx + 1);
    const type = validTypes.includes(s.type) ? s.type : 'ai_reasoning';
    return {
      id,
      type,
      description: String(s.description || `Subtask ${id}`),
      inputs: s.inputs || {},
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
    };
  });

  const dependencies: Record<string, string[]> = {};
  for (const st of subtasks) {
    if (st.dependsOn && st.dependsOn.length > 0) {
      dependencies[st.id] = st.dependsOn;
    }
  }

  const executionOrder = validOrders.includes(raw.executionOrder)
    ? raw.executionOrder
    : (Object.keys(dependencies).length > 0 ? 'mixed' : 'sequential');

  return {
    goal: raw.goal || goal,
    subtasks,
    executionOrder,
    dependencies,
  };
}

export function getExecutionLevels(plan: TaskPlan): Subtask[][] {
  const completed = new Set<string>();
  const levels: Subtask[][] = [];
  const remaining = new Set(plan.subtasks.map(s => s.id));

  while (remaining.size > 0) {
    const level: Subtask[] = [];

    for (const subtask of plan.subtasks) {
      if (!remaining.has(subtask.id)) continue;

      const deps = subtask.dependsOn || [];
      const allDepsComplete = deps.every(d => completed.has(d));

      if (allDepsComplete) {
        level.push(subtask);
      }
    }

    if (level.length === 0 && remaining.size > 0) {
      const stuck = plan.subtasks.filter(s => remaining.has(s.id));
      level.push(...stuck);
      logger.warn('[Planner] Circular dependency detected, forcing execution', {
        stuck: stuck.map(s => s.id),
      });
    }

    for (const st of level) {
      remaining.delete(st.id);
      completed.add(st.id);
    }

    levels.push(level);
  }

  return levels;
}
