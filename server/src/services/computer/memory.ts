/* ═══════════════════════════════════════════════════════════
   Computer Orchestration Engine — Working Memory
   
   Stores intermediate results during task execution. Memory
   is scoped per-task and cleaned up after completion.
   ═══════════════════════════════════════════════════════════ */

import type {
  ComputerMemory,
  TaskPlan,
  SubtaskResult,
  LogEntry,
  TaskStatus,
} from './types.js';

const MAX_TASKS = 50;
const CLEANUP_AFTER_MS = 30 * 60 * 1000; // 30 minutes

const taskMemory = new Map<string, ComputerMemory>();

export const ComputerMemoryStore = {
  create(taskId: string, goal: string, context?: Record<string, any>): ComputerMemory {
    if (taskMemory.size >= MAX_TASKS) {
      const oldest = Array.from(taskMemory.entries()).reduce((a, b) =>
        a[1].startedAt < b[1].startedAt ? a : b
      );
      taskMemory.delete(oldest[0]);
    }

    const memory: ComputerMemory = {
      taskId,
      goal,
      context,
      plan: null,
      results: new Map(),
      status: 'planning',
      logs: [],
      startedAt: new Date(),
    };
    taskMemory.set(taskId, memory);

    setTimeout(() => taskMemory.delete(taskId), CLEANUP_AFTER_MS);

    return memory;
  },

  get(taskId: string): ComputerMemory | null {
    return taskMemory.get(taskId) || null;
  },

  setPlan(taskId: string, plan: TaskPlan): void {
    const mem = taskMemory.get(taskId);
    if (mem) {
      mem.plan = plan;
      mem.status = 'executing';
    }
  },

  setStatus(taskId: string, status: TaskStatus): void {
    const mem = taskMemory.get(taskId);
    if (mem) {
      mem.status = status;
      if (status === 'done' || status === 'failed') {
        mem.completedAt = new Date();
      }
    }
  },

  addResult(taskId: string, result: SubtaskResult): void {
    const mem = taskMemory.get(taskId);
    if (mem) {
      mem.results.set(result.subtaskId, result);
    }
  },

  getResult(taskId: string, subtaskId: string): SubtaskResult | null {
    const mem = taskMemory.get(taskId);
    return mem?.results.get(subtaskId) || null;
  },

  getAllResults(taskId: string): SubtaskResult[] {
    const mem = taskMemory.get(taskId);
    return mem ? Array.from(mem.results.values()) : [];
  },

  log(taskId: string, level: LogEntry['level'], message: string, subtaskId?: string, data?: Record<string, any>): void {
    const mem = taskMemory.get(taskId);
    if (mem) {
      mem.logs.push({
        timestamp: new Date().toISOString(),
        level,
        message,
        subtaskId,
        data,
      });
    }
  },

  getProgress(taskId: string): { completed: number; total: number } {
    const mem = taskMemory.get(taskId);
    if (!mem || !mem.plan) return { completed: 0, total: 0 };
    const total = mem.plan.subtasks.length;
    const completed = Array.from(mem.results.values()).filter(
      r => r.status === 'completed' || r.status === 'skipped'
    ).length;
    return { completed, total };
  },

  delete(taskId: string): void {
    taskMemory.delete(taskId);
  },
};
