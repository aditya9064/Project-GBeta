/* ═══════════════════════════════════════════════════════════
   Computer Orchestration Engine — Main Service
   
   A meta-agent that decomposes complex goals into subtasks
   and delegates them to specialized executors. Inspired by
   Perplexity Computer's task orchestration approach.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../../config.js';
import { logger } from '../logger.js';
import { ComputerMemoryStore } from './memory.js';
import { planTask, getExecutionLevels } from './planner.js';
import { executeSubtask } from './executors.js';
import type {
  ComputerResult,
  ComputerMemory,
  TaskPlan,
  Subtask,
  SubtaskResult,
  LogEntry,
} from './types.js';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  return openaiClient;
}

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const ComputerService = {
  /**
   * Main entry point: run a complex task by decomposing and orchestrating.
   */
  async runTask(goal: string, context?: Record<string, any>): Promise<ComputerResult> {
    const taskId = generateTaskId();
    const startTime = Date.now();

    logger.info('[Computer] Starting task', { taskId, goal: goal.slice(0, 100) });

    const memory = ComputerMemoryStore.create(taskId, goal, context);
    ComputerMemoryStore.log(taskId, 'info', 'Task started');

    try {
      ComputerMemoryStore.log(taskId, 'info', 'Planning task decomposition...');
      const plan = await planTask(goal, context);
      ComputerMemoryStore.setPlan(taskId, plan);
      ComputerMemoryStore.log(taskId, 'info', `Plan created: ${plan.subtasks.length} subtasks`);

      await this.executeOrchestration(taskId, memory, plan);

      ComputerMemoryStore.setStatus(taskId, 'synthesizing');
      ComputerMemoryStore.log(taskId, 'info', 'Synthesizing results...');
      const finalResult = await this.synthesizeResults(taskId, memory);

      ComputerMemoryStore.setStatus(taskId, 'done');
      ComputerMemoryStore.log(taskId, 'info', 'Task completed');

      return this.buildResult(taskId, memory, finalResult, startTime);
    } catch (err: any) {
      logger.error('[Computer] Task failed', { taskId, error: err.message });
      ComputerMemoryStore.setStatus(taskId, 'failed');
      ComputerMemoryStore.log(taskId, 'error', `Task failed: ${err.message}`);

      return this.buildResult(taskId, memory, null, startTime, err.message);
    }
  },

  /**
   * Execute the orchestration loop with dependency resolution and parallel execution.
   */
  async executeOrchestration(taskId: string, memory: ComputerMemory, plan: TaskPlan): Promise<void> {
    const levels = getExecutionLevels(plan);

    logger.info('[Computer] Execution levels', { 
      taskId, 
      levels: levels.map(l => l.map(s => s.id)) 
    });

    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const level = levels[levelIdx];
      ComputerMemoryStore.log(
        taskId, 
        'info', 
        `Executing level ${levelIdx + 1}/${levels.length}: ${level.length} subtask(s)`
      );

      const results = await Promise.all(
        level.map(async (subtask) => {
          ComputerMemoryStore.log(taskId, 'info', `Starting: ${subtask.description}`, subtask.id);
          const result = await executeSubtask(subtask, memory);
          ComputerMemoryStore.addResult(taskId, result);
          
          const statusMsg = result.status === 'completed' 
            ? `Completed: ${subtask.description}` 
            : `Failed: ${subtask.description} - ${result.error}`;
          ComputerMemoryStore.log(taskId, result.status === 'completed' ? 'info' : 'warn', statusMsg, subtask.id);
          
          return result;
        })
      );

      const failed = results.filter(r => r.status === 'failed');
      if (failed.length === level.length) {
        logger.warn('[Computer] All subtasks in level failed', { taskId, levelIdx });
      }
    }
  },

  /**
   * Synthesize all subtask results into a final coherent output.
   */
  async synthesizeResults(taskId: string, memory: ComputerMemory): Promise<any> {
    const updatedMemory = ComputerMemoryStore.get(taskId);
    if (!updatedMemory?.plan) return null;

    const results = ComputerMemoryStore.getAllResults(taskId);
    const successfulResults = results.filter(r => r.status === 'completed');

    if (successfulResults.length === 0) {
      return { error: 'All subtasks failed', results };
    }

    if (successfulResults.length === 1) {
      return successfulResults[0].output;
    }

    try {
      const openai = getOpenAI();
      const subtaskSummaries = successfulResults.map(r => {
        const subtask = updatedMemory.plan!.subtasks.find(s => s.id === r.subtaskId);
        return {
          id: r.subtaskId,
          description: subtask?.description || 'Unknown',
          type: subtask?.type || 'unknown',
          output: r.output,
        };
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a results synthesizer. Given the outputs of multiple subtasks that were executed to achieve a goal, combine them into a coherent final result. Be concise but complete. If the goal was to send something (email, message), confirm it was done. If the goal was to gather information, present the findings clearly.`,
          },
          {
            role: 'user',
            content: `ORIGINAL GOAL: ${updatedMemory.goal}\n\nSUBTASK RESULTS:\n${JSON.stringify(subtaskSummaries, null, 2)}\n\nSynthesize these results into a final coherent response.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const synthesis = response.choices[0]?.message?.content || '';
      return {
        synthesis,
        subtaskOutputs: subtaskSummaries,
      };
    } catch (err: any) {
      logger.warn('[Computer] Synthesis failed, returning raw results', { error: err.message });
      return {
        subtaskOutputs: successfulResults.map(r => ({
          id: r.subtaskId,
          output: r.output,
        })),
      };
    }
  },

  /**
   * Build the final ComputerResult object.
   */
  buildResult(
    taskId: string,
    memory: ComputerMemory,
    result: any,
    startTime: number,
    error?: string
  ): ComputerResult {
    const updatedMemory = ComputerMemoryStore.get(taskId) || memory;
    const allResults = ComputerMemoryStore.getAllResults(taskId);
    const plan = updatedMemory.plan;

    return {
      success: updatedMemory.status === 'done',
      taskId,
      goal: updatedMemory.goal,
      result,
      subtasks: (plan?.subtasks || []).map(st => {
        const res = allResults.find(r => r.subtaskId === st.id);
        return {
          id: st.id,
          type: st.type,
          description: st.description,
          status: res?.status || 'pending',
          result: res?.output,
          error: res?.error,
          durationMs: res?.durationMs || 0,
        };
      }),
      logs: updatedMemory.logs,
      durationMs: Date.now() - startTime,
      error,
    };
  },

  /**
   * Get the status of a running or completed task.
   */
  getStatus(taskId: string): {
    taskId: string;
    status: string;
    progress: { completed: number; total: number };
    logs: LogEntry[];
    result?: any;
  } | null {
    const memory = ComputerMemoryStore.get(taskId);
    if (!memory) return null;

    const progress = ComputerMemoryStore.getProgress(taskId);

    return {
      taskId,
      status: memory.status,
      progress,
      logs: memory.logs,
      result: memory.status === 'done' ? this.getLastResult(taskId) : undefined,
    };
  },

  getLastResult(taskId: string): any {
    const results = ComputerMemoryStore.getAllResults(taskId);
    const last = results[results.length - 1];
    return last?.output;
  },
};

export * from './types.js';
