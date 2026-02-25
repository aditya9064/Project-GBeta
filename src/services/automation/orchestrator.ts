// Multi-Agent Orchestrator — Manager agent pattern
//
// A manager agent decomposes complex tasks into sub-tasks, discovers and
// delegates to specialist agents via AgentBus, then assembles results.
//
// Example: "Prepare for the Acme Corp meeting tomorrow"
//   Manager spawns:
//     → Sales agent → pulls CRM data, recent deals, pipeline
//     → Comms agent → summarizes recent email threads with Acme
//     → Doc agent   → generates a one-page briefing PDF
//     → Calendar agent → checks attendees and agenda
//   Manager assembles everything into a briefing

import { AgentBus } from './agentBus';
import {
  isBackendAvailable,
  AutomationAIAPI,
} from './automationApi';
import { EnhancedMemoryService } from './enhancedMemory';
import type { AgentRegistryEntry } from './types';

export interface OrchestratorTask {
  id: string;
  description: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  status: 'pending' | 'delegated' | 'completed' | 'failed' | 'skipped';
  input?: any;
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OrchestrationPlan {
  goal: string;
  tasks: OrchestratorTask[];
  synthesisPrompt?: string;
}

export interface OrchestrationResult {
  success: boolean;
  goal: string;
  plan: OrchestrationPlan;
  assembledResult?: any;
  error?: string;
  totalDuration: number;
}

type TaskUpdateHandler = (task: OrchestratorTask, plan: OrchestrationPlan) => void;

const MANAGER_AGENT_ID = 'orchestrator-manager';

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

async function decomposeGoal(goal: string, context?: any): Promise<OrchestrationPlan> {
  const availableAgents = AgentBus.listAgents().filter(a => a.status === 'active');
  const agentDescriptions = availableAgents
    .map(a => `  - "${a.name}" (id: ${a.agentId}): capabilities: [${a.capabilities.join(', ')}], description: ${a.description || 'N/A'}`)
    .join('\n');

  if (isBackendAvailable() && availableAgents.length > 0) {
    try {
      const result = await AutomationAIAPI.process(
        `You are an AI orchestrator that breaks complex tasks into sub-tasks and assigns them to specialist agents.

GOAL: ${goal}
${context ? `\nContext: ${JSON.stringify(context)}` : ''}

Available specialist agents:
${agentDescriptions || '  (none deployed)'}

Break this goal into 2-5 concrete sub-tasks. For each, either assign an existing agent (by agentId) or mark it as unassigned. Return EXACTLY this JSON (no markdown):
{
  "tasks": [
    { "description": "what to do", "agentId": "agent-id or null", "input": { ... } }
  ],
  "synthesisPrompt": "how to combine the results into a final answer"
}`,
        { model: 'gpt-4', temperature: 0.3, maxTokens: 800 },
      );

      if (result?.response) {
        const text = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            goal,
            tasks: (parsed.tasks || []).map((t: any) => ({
              id: generateTaskId(),
              description: t.description,
              assignedAgentId: t.agentId || undefined,
              assignedAgentName: t.agentId
                ? availableAgents.find(a => a.agentId === t.agentId)?.name
                : undefined,
              status: 'pending' as const,
              input: t.input || {},
            })),
            synthesisPrompt: parsed.synthesisPrompt,
          };
        }
      }
    } catch {
      // Fall through to heuristic decomposition
    }
  }

  // Heuristic decomposition when AI is unavailable
  return heuristicDecompose(goal, availableAgents);
}

function heuristicDecompose(goal: string, agents: AgentRegistryEntry[]): OrchestrationPlan {
  const lower = goal.toLowerCase();
  const tasks: OrchestratorTask[] = [];

  const patterns: { keywords: string[]; taskDesc: string; capabilities: string[] }[] = [
    { keywords: ['email', 'inbox', 'message'], taskDesc: 'Check and process relevant emails', capabilities: ['app:gmail', 'domain:email'] },
    { keywords: ['slack', 'channel', 'notify'], taskDesc: 'Send Slack notifications', capabilities: ['app:slack', 'domain:slack'] },
    { keywords: ['report', 'analyze', 'data', 'summary'], taskDesc: 'Analyze data and generate report', capabilities: ['ai:processing', 'domain:analyze', 'domain:summarize'] },
    { keywords: ['schedule', 'calendar', 'meeting'], taskDesc: 'Check calendar and meeting details', capabilities: ['domain:calendar'] },
    { keywords: ['document', 'generate', 'create'], taskDesc: 'Generate required documents', capabilities: ['domain:report', 'ai:processing'] },
    { keywords: ['crm', 'customer', 'sales', 'deal'], taskDesc: 'Pull CRM and sales data', capabilities: ['app:salesforce', 'app:hubspot'] },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      const matchingAgent = agents.find(a =>
        pattern.capabilities.some(cap =>
          a.capabilities.some(ac => ac.includes(cap.split(':')[1])),
        ),
      );

      tasks.push({
        id: generateTaskId(),
        description: pattern.taskDesc,
        assignedAgentId: matchingAgent?.agentId,
        assignedAgentName: matchingAgent?.name,
        status: 'pending',
        input: { goal },
      });
    }
  }

  // Always add a synthesis task
  if (tasks.length === 0) {
    tasks.push({
      id: generateTaskId(),
      description: `Execute: ${goal}`,
      status: 'pending',
      input: { goal },
    });
  }

  return {
    goal,
    tasks,
    synthesisPrompt: `Combine the results of all sub-tasks to fulfill: "${goal}"`,
  };
}

async function assembleResults(plan: OrchestrationPlan): Promise<any> {
  const completedTasks = plan.tasks.filter(t => t.status === 'completed' && t.output);

  if (completedTasks.length === 0) {
    return { summary: 'No tasks produced output', tasks: plan.tasks.map(t => ({ description: t.description, status: t.status })) };
  }

  if (isBackendAvailable() && plan.synthesisPrompt) {
    try {
      const taskResults = completedTasks
        .map(t => `Task: "${t.description}"\nResult: ${JSON.stringify(t.output).substring(0, 500)}`)
        .join('\n\n');

      const result = await AutomationAIAPI.process(
        `${plan.synthesisPrompt}\n\nGoal: ${plan.goal}\n\nSub-task results:\n${taskResults}\n\nSynthesize these results into a clear, actionable summary.`,
        { model: 'gpt-4', temperature: 0.3, maxTokens: 1000 },
      );

      if (result?.response) {
        return {
          synthesized: true,
          summary: typeof result.response === 'string' ? result.response : result.response.result || result.response,
          taskCount: completedTasks.length,
          details: completedTasks.map(t => ({ task: t.description, result: t.output })),
        };
      }
    } catch {
      // Fall through to manual assembly
    }
  }

  return {
    synthesized: false,
    goal: plan.goal,
    results: completedTasks.map(t => ({
      task: t.description,
      agent: t.assignedAgentName || 'unassigned',
      result: t.output,
    })),
    failedTasks: plan.tasks
      .filter(t => t.status === 'failed')
      .map(t => ({ task: t.description, error: t.error })),
  };
}

export const Orchestrator = {
  async execute(
    goal: string,
    context?: any,
    onTaskUpdate?: TaskUpdateHandler,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    console.log(`\n🎯 Orchestrator: "${goal}"`);

    // Decompose the goal into sub-tasks
    const plan = await decomposeGoal(goal, context);
    console.log(`   Decomposed into ${plan.tasks.length} sub-tasks`);

    // Execute tasks (parallel where possible)
    const delegatedPromises: Promise<void>[] = [];

    for (const task of plan.tasks) {
      if (task.assignedAgentId) {
        task.status = 'delegated';
        task.startedAt = new Date();
        onTaskUpdate?.(task, plan);

        const promise = (async () => {
          try {
            console.log(`   → Delegating "${task.description}" to ${task.assignedAgentName}`);
            const result = await AgentBus.callAgent(
              MANAGER_AGENT_ID,
              'Orchestrator',
              task.assignedAgentId!,
              { ...task.input, _orchestratorGoal: goal, _taskDescription: task.description },
              true,
              60_000,
            );

            if (result.success) {
              task.status = 'completed';
              task.output = result.output;
              console.log(`   ✅ "${task.description}" completed`);
            } else {
              task.status = 'failed';
              task.error = result.error;
              console.log(`   ❌ "${task.description}" failed: ${result.error}`);
            }
          } catch (err: any) {
            task.status = 'failed';
            task.error = err.message;
          }
          task.completedAt = new Date();
          onTaskUpdate?.(task, plan);
        })();

        delegatedPromises.push(promise);
      } else {
        task.status = 'skipped';
        task.error = 'No suitable agent found';
        onTaskUpdate?.(task, plan);
      }
    }

    await Promise.allSettled(delegatedPromises);

    // Assemble results
    const assembledResult = await assembleResults(plan);

    const totalDuration = Date.now() - startTime;
    const completedCount = plan.tasks.filter(t => t.status === 'completed').length;
    const success = completedCount > 0;

    console.log(`\n${success ? '✅' : '❌'} Orchestration "${goal}" — ${completedCount}/${plan.tasks.length} tasks completed (${totalDuration}ms)\n`);

    await EnhancedMemoryService.recordEpisode(MANAGER_AGENT_ID, {
      eventType: 'execution',
      summary: `Orchestrated "${goal}": ${completedCount}/${plan.tasks.length} tasks succeeded`,
      outcome: success ? 'success' : 'failure',
      details: {
        goal,
        taskCount: plan.tasks.length,
        completed: completedCount,
        duration: totalDuration,
      },
      relatedEntities: plan.tasks
        .filter(t => t.assignedAgentName)
        .map(t => t.assignedAgentName!),
      importance: 0.8,
    });

    return {
      success,
      goal,
      plan,
      assembledResult,
      totalDuration,
    };
  },

  async planOnly(goal: string, context?: any): Promise<OrchestrationPlan> {
    return decomposeGoal(goal, context);
  },

  async executePlan(
    plan: OrchestrationPlan,
    onTaskUpdate?: TaskUpdateHandler,
  ): Promise<OrchestrationResult> {
    return this.execute(plan.goal, undefined, onTaskUpdate);
  },
};
