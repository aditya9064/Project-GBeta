/* ═══════════════════════════════════════════════════════════
   Computer Orchestration Engine — Types
   
   TypeScript interfaces for the task planning and execution
   system that decomposes complex goals into subtasks.
   ═══════════════════════════════════════════════════════════ */

export type SubtaskType =
  | 'ai_reasoning'
  | 'web_browse'
  | 'web_search'
  | 'send_email'
  | 'send_slack'
  | 'http_request'
  | 'code_execute'
  | 'extract_data';

export type ExecutionOrder = 'sequential' | 'parallel' | 'mixed';

export type TaskStatus = 'planning' | 'executing' | 'synthesizing' | 'done' | 'failed';

export type SubtaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface Subtask {
  id: string;
  type: SubtaskType;
  description: string;
  inputs: Record<string, any>;
  dependsOn?: string[];
}

export interface TaskPlan {
  goal: string;
  subtasks: Subtask[];
  executionOrder: ExecutionOrder;
  dependencies: Record<string, string[]>;
}

export interface SubtaskResult {
  subtaskId: string;
  status: SubtaskStatus;
  output: any;
  error?: string;
  durationMs: number;
  startedAt: string;
  completedAt?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  subtaskId?: string;
  data?: Record<string, any>;
}

export interface ComputerMemory {
  taskId: string;
  goal: string;
  context?: Record<string, any>;
  plan: TaskPlan | null;
  results: Map<string, SubtaskResult>;
  status: TaskStatus;
  logs: LogEntry[];
  startedAt: Date;
  completedAt?: Date;
}

export interface ComputerResult {
  success: boolean;
  taskId: string;
  goal: string;
  result: any;
  subtasks: {
    id: string;
    type: SubtaskType;
    description: string;
    status: SubtaskStatus;
    result?: any;
    error?: string;
    durationMs: number;
  }[];
  logs: LogEntry[];
  durationMs: number;
  error?: string;
}

export interface ComputerRunRequest {
  goal: string;
  context?: Record<string, any>;
}

export interface ComputerStatusResponse {
  taskId: string;
  status: TaskStatus;
  progress: {
    completed: number;
    total: number;
  };
  logs: LogEntry[];
  result?: any;
}

export type SubtaskExecutor = (
  subtask: Subtask,
  memory: ComputerMemory,
) => Promise<SubtaskResult>;
