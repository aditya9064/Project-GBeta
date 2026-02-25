// Autonomous Agent Engine — Think-Act-Observe reasoning loop
//
// Unlike the deterministic executeWorkflow() which runs nodes in fixed order,
// executeAutonomousAgent() receives a GOAL and uses an LLM to decide what
// actions to take, observes the results, and loops until the goal is achieved.

import {
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationSlackAPI,
  AutomationAIAPI,
  AutomationHttpAPI,
} from './automationApi';
import { AgentMemoryService } from './memoryService';
import { AgentBus } from './agentBus';
import type { ExecutionLog } from './executionEngine';

export interface AgentGoal {
  description: string;
  context?: Record<string, any>;
  constraints?: string[];
  maxSteps?: number;
  requireApproval?: boolean;
}

export interface ThoughtStep {
  thought: string;
  action: string;
  actionInput: Record<string, any>;
  observation?: any;
  timestamp: Date;
}

export interface AutonomousResult {
  success: boolean;
  goal: string;
  steps: ThoughtStep[];
  finalAnswer?: string;
  error?: string;
  logs: ExecutionLog[];
  totalSteps: number;
}

type ToolFn = (input: Record<string, any>) => Promise<any>;

const AVAILABLE_TOOLS: Record<string, { description: string; parameters: string }> = {
  read_emails: {
    description: 'Read recent emails from Gmail inbox',
    parameters: '{ "count": number }',
  },
  send_email: {
    description: 'Send an email via Gmail',
    parameters: '{ "to": string, "subject": string, "body": string }',
  },
  reply_email: {
    description: 'Reply to an email by message ID',
    parameters: '{ "messageId": string, "body": string }',
  },
  send_slack: {
    description: 'Send a message to a Slack channel',
    parameters: '{ "channel": string, "message": string }',
  },
  search_agents: {
    description: 'Find deployed agents by capability keyword',
    parameters: '{ "capability": string }',
  },
  call_agent: {
    description: 'Invoke another deployed agent with input data',
    parameters: '{ "agentId": string, "input": object }',
  },
  read_memory: {
    description: 'Read a value from persistent agent memory',
    parameters: '{ "key": string }',
  },
  write_memory: {
    description: 'Write a value to persistent agent memory',
    parameters: '{ "key": string, "value": any }',
  },
  http_request: {
    description: 'Make an HTTP request to any URL',
    parameters: '{ "url": string, "method": string, "body"?: object }',
  },
  finish: {
    description: 'Complete the task and return the final answer',
    parameters: '{ "answer": string }',
  },
};

function buildToolExecutors(agentId: string): Record<string, ToolFn> {
  return {
    read_emails: async (input) => {
      if (!isBackendAvailable()) return { emails: [], _simulated: true, note: 'Backend offline' };
      return AutomationGmailAPI.read(input.count || 5);
    },
    send_email: async (input) => {
      if (!isBackendAvailable()) return { sent: true, _simulated: true };
      return AutomationGmailAPI.send(input.to, input.subject, input.body);
    },
    reply_email: async (input) => {
      if (!isBackendAvailable()) return { replied: true, _simulated: true };
      return AutomationGmailAPI.reply(input.messageId, input.body);
    },
    send_slack: async (input) => {
      if (!isBackendAvailable()) return { sent: true, _simulated: true };
      return AutomationSlackAPI.send(input.channel, input.message);
    },
    search_agents: async (input) => {
      return AgentBus.findAgentsByCapability(input.capability);
    },
    call_agent: async (input) => {
      return AgentBus.callAgent(agentId, 'autonomous-agent', input.agentId, input.input);
    },
    read_memory: async (input) => {
      return AgentMemoryService.read(agentId, 'agent', input.key);
    },
    write_memory: async (input) => {
      await AgentMemoryService.write(agentId, 'agent', input.key, input.value);
      return { written: true, key: input.key };
    },
    http_request: async (input) => {
      if (!isBackendAvailable()) return { status: 200, data: {}, _simulated: true };
      return AutomationHttpAPI.request(input.url, input.method || 'GET', input.headers, input.body);
    },
    finish: async (input) => {
      return { finished: true, answer: input.answer };
    },
  };
}

function buildReasoningPrompt(goal: AgentGoal, steps: ThoughtStep[], memory: Record<string, any>): string {
  const toolList = Object.entries(AVAILABLE_TOOLS)
    .map(([name, t]) => `  - ${name}: ${t.description}\n    Parameters: ${t.parameters}`)
    .join('\n');

  const historyBlock = steps
    .map((s, i) => [
      `Step ${i + 1}:`,
      `  Thought: ${s.thought}`,
      `  Action: ${s.action}(${JSON.stringify(s.actionInput)})`,
      `  Observation: ${JSON.stringify(s.observation ?? '(pending)')}`,
    ].join('\n'))
    .join('\n\n');

  const memoryBlock = Object.keys(memory).length > 0
    ? `Agent memory:\n${JSON.stringify(memory, null, 2)}`
    : 'Agent memory: (empty)';

  const constraintBlock = goal.constraints?.length
    ? `Constraints:\n${goal.constraints.map(c => `  - ${c}`).join('\n')}`
    : '';

  return `You are an autonomous AI agent. Achieve the following goal by reasoning step-by-step and using tools.

GOAL: ${goal.description}

${goal.context ? `Context:\n${JSON.stringify(goal.context, null, 2)}` : ''}
${constraintBlock}
${memoryBlock}

Available tools:
${toolList}

${historyBlock ? `Previous steps:\n${historyBlock}\n` : ''}
Respond with EXACTLY this JSON format (no markdown, no code fences):
{
  "thought": "your reasoning about what to do next",
  "action": "tool_name",
  "actionInput": { ... }
}

If the goal is achieved, use the "finish" action with your final answer.
If something went wrong, reason about an alternative approach.`;
}

function parseReasoningResponse(text: string): { thought: string; action: string; actionInput: Record<string, any> } | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.thought || !parsed.action) return null;
    return {
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.actionInput || {},
    };
  } catch {
    return null;
  }
}

export async function executeAutonomousAgent(
  agentId: string,
  userId: string,
  goal: AgentGoal,
  onStepUpdate?: (step: ThoughtStep, stepIndex: number) => void,
  onLogUpdate?: (log: ExecutionLog) => void,
): Promise<AutonomousResult> {
  const maxSteps = goal.maxSteps || 10;
  const steps: ThoughtStep[] = [];
  const logs: ExecutionLog[] = [];
  const toolExecutors = buildToolExecutors(agentId);

  const memory = await AgentMemoryService.loadAgentMemory(agentId);

  console.log(`\n🧠 Autonomous Agent starting — Goal: "${goal.description}"`);
  console.log(`   Max steps: ${maxSteps}`);

  for (let i = 0; i < maxSteps; i++) {
    const prompt = buildReasoningPrompt(goal, steps, memory);

    const thinkLog: ExecutionLog = {
      nodeId: `think-${i}`,
      nodeName: `Think (step ${i + 1})`,
      nodeType: 'ai',
      status: 'running',
      startedAt: new Date(),
      isReal: isBackendAvailable(),
    };
    logs.push(thinkLog);
    onLogUpdate?.(thinkLog);

    let reasoning: { thought: string; action: string; actionInput: Record<string, any> } | null = null;

    if (isBackendAvailable()) {
      const aiResult = await AutomationAIAPI.process(prompt, {
        model: 'gpt-4',
        temperature: 0.2,
        maxTokens: 1000,
      });
      if (aiResult?.response) {
        const text = typeof aiResult.response === 'string' ? aiResult.response : JSON.stringify(aiResult.response);
        reasoning = parseReasoningResponse(text);
      }
    }

    if (!reasoning) {
      reasoning = {
        thought: `Step ${i + 1}: Working toward goal "${goal.description}". Backend ${isBackendAvailable() ? 'available' : 'offline'}.`,
        action: 'finish',
        actionInput: { answer: `Completed autonomous reasoning for: ${goal.description}` },
      };
    }

    thinkLog.status = 'completed';
    thinkLog.completedAt = new Date();
    thinkLog.duration = thinkLog.completedAt.getTime() - thinkLog.startedAt.getTime();
    thinkLog.output = { thought: reasoning.thought, action: reasoning.action };
    onLogUpdate?.(thinkLog);

    console.log(`  💭 Thought: ${reasoning.thought}`);
    console.log(`  🔧 Action: ${reasoning.action}(${JSON.stringify(reasoning.actionInput)})`);

    const step: ThoughtStep = {
      thought: reasoning.thought,
      action: reasoning.action,
      actionInput: reasoning.actionInput,
      timestamp: new Date(),
    };

    // Execute the chosen action
    const actionLog: ExecutionLog = {
      nodeId: `act-${i}`,
      nodeName: `Act: ${reasoning.action} (step ${i + 1})`,
      nodeType: 'action',
      status: 'running',
      startedAt: new Date(),
      input: reasoning.actionInput,
      isReal: isBackendAvailable(),
    };
    logs.push(actionLog);
    onLogUpdate?.(actionLog);

    const executor = toolExecutors[reasoning.action];
    if (!executor) {
      step.observation = { error: `Unknown tool: ${reasoning.action}` };
      actionLog.status = 'failed';
      actionLog.error = `Unknown tool: ${reasoning.action}`;
    } else {
      try {
        const result = await executor(reasoning.actionInput);
        step.observation = result;
        actionLog.status = 'completed';
        actionLog.output = result;
      } catch (err: any) {
        step.observation = { error: err.message };
        actionLog.status = 'failed';
        actionLog.error = err.message;
      }
    }

    actionLog.completedAt = new Date();
    actionLog.duration = actionLog.completedAt.getTime() - actionLog.startedAt.getTime();
    onLogUpdate?.(actionLog);

    steps.push(step);
    onStepUpdate?.(step, i);

    console.log(`  👁 Observation: ${JSON.stringify(step.observation).substring(0, 200)}`);

    if (reasoning.action === 'finish') {
      const answer = reasoning.actionInput.answer || step.observation?.answer || 'Done';
      console.log(`\n✅ Autonomous agent finished in ${i + 1} steps: ${answer}\n`);

      await AgentMemoryService.write(agentId, 'agent', 'last_autonomous_result', {
        goal: goal.description,
        answer,
        steps: steps.length,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        goal: goal.description,
        steps,
        finalAnswer: answer,
        logs,
        totalSteps: steps.length,
      };
    }
  }

  console.log(`\n⚠️ Autonomous agent hit max steps (${maxSteps}) without finishing\n`);
  return {
    success: false,
    goal: goal.description,
    steps,
    error: `Reached maximum steps (${maxSteps}) without achieving goal`,
    logs,
    totalSteps: steps.length,
  };
}

export const AutonomousEngine = {
  executeAutonomousAgent,
};
