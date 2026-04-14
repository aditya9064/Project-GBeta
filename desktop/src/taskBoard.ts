/* ═══════════════════════════════════════════════════════════
   Task Board — Shared coordination state for agent swarms

   The task board is a directed acyclic graph (DAG) of tasks
   with dependencies, artifacts, and status tracking. All
   agents in a swarm share the same board and use it for:
   - Dependency resolution (what can run next)
   - Artifact sharing (passing data between tasks)
   - Progress tracking (who's doing what)
   - Handoffs (one agent's output feeds another's input)
   - Timeout detection (stuck task recovery)
   - Structured task types (desktop, browser, data, etc.)
   ═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from './structuredLogger.js';

export type TaskStatus = 'pending' | 'blocked' | 'ready' | 'assigned' | 'running' | 'completed' | 'failed' | 'needs_approval';

export type TaskType = 'desktop_action' | 'browser_action' | 'data_extraction' | 'document_creation' | 'communication' | 'general';

export interface SwarmTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  taskType: TaskType;
  assignedTo: string | null;
  dependencies: string[];
  result: string | null;
  artifacts: SwarmArtifact[];
  priority: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  failureReason: string | null;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  requiresApproval: boolean;
  approvalReason: string | null;
  metadata: Record<string, any>;
}

export interface SwarmArtifact {
  id: string;
  name: string;
  type: 'file' | 'data' | 'text' | 'code' | 'screenshot';
  content: string;
  producedBy: string;
  taskId: string;
  timestamp: string;
}

export interface SwarmMessage {
  id: string;
  from: string;
  to: string;
  type: 'info' | 'request' | 'artifact' | 'progress' | 'handoff' | 'help' | 'approval_request' | 'approval_response';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type SwarmStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface SwarmSession {
  id: string;
  goal: string;
  status: SwarmStatus;
  orchestratorId: string | null;
  tasks: Map<string, SwarmTask>;
  messages: SwarmMessage[];
  artifacts: SwarmArtifact[];
  createdAt: string;
  completedAt: string | null;
  finalResult: string | null;
}

const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_RETRIES = 2;

const STUCK_CHECK_INTERVAL_MS = 30_000;
const STUCK_THRESHOLD_RATIO = 0.6; // consider stuck if idle for 60% of timeout

export class TaskBoard extends EventEmitter {
  private sessions = new Map<string, SwarmSession>();
  private timeoutTimers = new Map<string, NodeJS.Timeout>();
  private stuckCheckTimer: NodeJS.Timeout | null = null;

  createSession(goal: string): SwarmSession {
    const session: SwarmSession = {
      id: crypto.randomUUID(),
      goal,
      status: 'planning',
      orchestratorId: null,
      tasks: new Map(),
      messages: [],
      artifacts: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      finalResult: null,
    };
    this.sessions.set(session.id, session);
    this.emit('session:created', session.id);
    return session;
  }

  getSession(sessionId: string): SwarmSession | null {
    return this.sessions.get(sessionId) || null;
  }

  setOrchestrator(sessionId: string, agentId: string): void {
    const session = this.requireSession(sessionId);
    session.orchestratorId = agentId;
  }

  /* ─── Task Management ──────────────────────────────────── */

  addTask(sessionId: string, task: Omit<SwarmTask, 'id' | 'status' | 'assignedTo' | 'result' | 'artifacts' | 'createdAt' | 'startedAt' | 'completedAt' | 'lastActivityAt' | 'failureReason' | 'retryCount'> & Partial<Pick<SwarmTask, 'maxRetries' | 'timeoutMs' | 'taskType' | 'requiresApproval' | 'approvalReason' | 'metadata'>>): SwarmTask {
    const session = this.requireSession(sessionId);
    const newTask: SwarmTask = {
      id: crypto.randomUUID().slice(0, 8),
      title: task.title,
      description: task.description,
      dependencies: task.dependencies,
      priority: task.priority,
      status: 'pending',
      taskType: task.taskType || 'general',
      assignedTo: null,
      result: null,
      artifacts: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      lastActivityAt: null,
      failureReason: null,
      retryCount: 0,
      maxRetries: task.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: task.timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS,
      requiresApproval: task.requiresApproval ?? false,
      approvalReason: task.approvalReason ?? null,
      metadata: task.metadata ?? {},
    };

    session.tasks.set(newTask.id, newTask);
    this.resolveDependencies(sessionId);
    logger.task('added', sessionId, newTask.id, {
      metadata: { title: newTask.title, taskType: newTask.taskType, priority: newTask.priority, deps: newTask.dependencies },
    });
    this.emit('task:added', sessionId, newTask);
    return newTask;
  }

  addTasks(sessionId: string, tasks: Parameters<TaskBoard['addTask']>[1][]): SwarmTask[] {
    return tasks.map(t => this.addTask(sessionId, t));
  }

  assignTask(sessionId: string, taskId: string, agentId: string): boolean {
    const task = this.requireTask(sessionId, taskId);
    if (task.status !== 'ready') return false;
    task.status = 'assigned';
    task.assignedTo = agentId;
    this.emit('task:assigned', sessionId, taskId, agentId);
    return true;
  }

  startTask(sessionId: string, taskId: string): void {
    const task = this.requireTask(sessionId, taskId);
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    task.lastActivityAt = task.startedAt;
    this.startTaskTimeout(sessionId, taskId);
    this.emit('task:started', sessionId, taskId);
  }

  recordTaskActivity(sessionId: string, taskId: string): void {
    const task = this.requireTask(sessionId, taskId);
    task.lastActivityAt = new Date().toISOString();
  }

  completeTask(sessionId: string, taskId: string, result: string): void {
    const task = this.requireTask(sessionId, taskId);
    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.lastActivityAt = task.completedAt;
    this.clearTaskTimeout(taskId);
    this.resolveDependencies(sessionId);
    this.emit('task:completed', sessionId, taskId, result);

    if (this.allTasksDone(sessionId)) {
      this.emit('session:all-tasks-done', sessionId);
    }
  }

  failTask(sessionId: string, taskId: string, reason: string): void {
    const task = this.requireTask(sessionId, taskId);
    this.clearTaskTimeout(taskId);

    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = 'ready';
      task.assignedTo = null;
      task.failureReason = reason;
      task.startedAt = null;
      task.lastActivityAt = new Date().toISOString();
      logger.task('retrying', sessionId, taskId, {
        level: 'warn',
        metadata: { attempt: task.retryCount, maxRetries: task.maxRetries, reason },
      });
      this.emit('task:retry', sessionId, taskId, task.retryCount);
    } else {
      task.status = 'failed';
      task.failureReason = reason;
      task.completedAt = new Date().toISOString();
      task.lastActivityAt = task.completedAt;
      logger.task('failed', sessionId, taskId, {
        level: 'error',
        error: reason,
        metadata: { retries: task.retryCount },
      });
      this.resolveDependencies(sessionId);
      this.emit('task:failed', sessionId, taskId, reason);

      if (this.allTasksDone(sessionId)) {
        this.emit('session:all-tasks-done', sessionId);
      }
    }
  }

  requestApproval(sessionId: string, taskId: string, reason: string): void {
    const task = this.requireTask(sessionId, taskId);
    task.status = 'needs_approval';
    task.approvalReason = reason;
    task.lastActivityAt = new Date().toISOString();
    this.clearTaskTimeout(taskId);
    this.emit('task:needs-approval', sessionId, taskId, reason);
  }

  approveTask(sessionId: string, taskId: string, approved: boolean): void {
    const task = this.requireTask(sessionId, taskId);
    if (task.status !== 'needs_approval') return;

    if (approved) {
      task.status = 'running';
      task.lastActivityAt = new Date().toISOString();
      this.startTaskTimeout(sessionId, taskId);
      this.emit('task:approved', sessionId, taskId);
    } else {
      this.failTask(sessionId, taskId, 'Rejected by user');
    }
  }

  /* ─── Timeout Handling ──────────────────────────────────── */

  private startTaskTimeout(sessionId: string, taskId: string): void {
    this.clearTaskTimeout(taskId);
    const task = this.requireTask(sessionId, taskId);
    if (task.timeoutMs <= 0) return;

    const timer = setTimeout(() => {
      const current = this.sessions.get(sessionId)?.tasks.get(taskId);
      if (current && (current.status === 'running' || current.status === 'assigned')) {
        const lastActivity = current.lastActivityAt ? new Date(current.lastActivityAt).getTime() : 0;
        const elapsed = Date.now() - lastActivity;

        if (elapsed >= task.timeoutMs * 0.8) {
          logger.task('timed_out', sessionId, taskId, {
            level: 'error',
            metadata: { idleMs: elapsed, timeoutMs: task.timeoutMs },
          });
          this.emit('task:timeout', sessionId, taskId);
          this.failTask(sessionId, taskId, `Task timed out after ${Math.round(task.timeoutMs / 1000)}s of inactivity`);
        } else {
          this.startTaskTimeout(sessionId, taskId);
        }
      }
    }, task.timeoutMs);

    this.timeoutTimers.set(taskId, timer);
  }

  private clearTaskTimeout(taskId: string): void {
    const timer = this.timeoutTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(taskId);
    }
  }

  /* ─── Dependency Resolution ────────────────────────────── */

  private resolveDependencies(sessionId: string): void {
    const session = this.requireSession(sessionId);
    for (const task of session.tasks.values()) {
      if (task.status !== 'pending' && task.status !== 'blocked') continue;

      const depsResolved = task.dependencies.every(depId => {
        const dep = session.tasks.get(depId);
        return dep && dep.status === 'completed';
      });

      if (depsResolved) {
        task.status = 'ready';
        this.emit('task:ready', sessionId, task.id);
      } else {
        const anyFailed = task.dependencies.some(depId => {
          const dep = session.tasks.get(depId);
          return dep && dep.status === 'failed';
        });
        if (anyFailed) {
          task.status = 'blocked';
        }
      }
    }
  }

  getReadyTasks(sessionId: string): SwarmTask[] {
    const session = this.requireSession(sessionId);
    return Array.from(session.tasks.values())
      .filter(t => t.status === 'ready')
      .sort((a, b) => b.priority - a.priority);
  }

  getRunningTasks(sessionId: string): SwarmTask[] {
    const session = this.requireSession(sessionId);
    return Array.from(session.tasks.values()).filter(t => t.status === 'running' || t.status === 'assigned');
  }

  getTasksNeedingApproval(sessionId: string): SwarmTask[] {
    const session = this.requireSession(sessionId);
    return Array.from(session.tasks.values()).filter(t => t.status === 'needs_approval');
  }

  allTasksDone(sessionId: string): boolean {
    const session = this.requireSession(sessionId);
    if (session.tasks.size === 0) return false;
    return Array.from(session.tasks.values()).every(
      t => t.status === 'completed' || t.status === 'failed',
    );
  }

  /* ─── Artifacts ────────────────────────────────────────── */

  addArtifact(sessionId: string, taskId: string, artifact: Omit<SwarmArtifact, 'id' | 'timestamp'>): SwarmArtifact {
    const session = this.requireSession(sessionId);
    const task = session.tasks.get(taskId);
    const newArtifact: SwarmArtifact = {
      ...artifact,
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
    };
    if (task) task.artifacts.push(newArtifact);
    session.artifacts.push(newArtifact);
    this.emit('artifact:added', sessionId, newArtifact);
    return newArtifact;
  }

  getArtifacts(sessionId: string, taskId?: string): SwarmArtifact[] {
    const session = this.requireSession(sessionId);
    if (taskId) {
      const task = session.tasks.get(taskId);
      return task ? task.artifacts : [];
    }
    return session.artifacts;
  }

  /* ─── Messages ─────────────────────────────────────────── */

  postMessage(sessionId: string, msg: Omit<SwarmMessage, 'id' | 'timestamp'>): SwarmMessage {
    const session = this.requireSession(sessionId);
    const newMsg: SwarmMessage = {
      ...msg,
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
    };
    session.messages.push(newMsg);
    if (session.messages.length > 500) {
      session.messages = session.messages.slice(-300);
    }
    this.emit('message:posted', sessionId, newMsg);
    return newMsg;
  }

  getMessages(sessionId: string, filter?: { from?: string; to?: string; since?: string }): SwarmMessage[] {
    const session = this.requireSession(sessionId);
    let msgs = session.messages;
    if (filter?.from) msgs = msgs.filter(m => m.from === filter.from);
    if (filter?.to) msgs = msgs.filter(m => m.to === filter.to || m.to === 'broadcast');
    if (filter?.since) msgs = msgs.filter(m => m.timestamp > filter.since!);
    return msgs;
  }

  /* ─── Session Lifecycle ────────────────────────────────── */

  setSessionStatus(sessionId: string, status: SwarmStatus, finalResult?: string): void {
    const session = this.requireSession(sessionId);
    session.status = status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      session.completedAt = new Date().toISOString();
      for (const taskId of this.timeoutTimers.keys()) {
        if (session.tasks.has(taskId)) {
          this.clearTaskTimeout(taskId);
        }
      }
    }
    if (finalResult) session.finalResult = finalResult;
    this.emit('session:status', sessionId, status);
  }

  getSessionSummary(sessionId: string): {
    id: string;
    goal: string;
    status: SwarmStatus;
    taskCount: number;
    completedCount: number;
    failedCount: number;
    runningCount: number;
    readyCount: number;
    pendingCount: number;
    needsApprovalCount: number;
    tasks: SwarmTask[];
    messageCount: number;
    artifactCount: number;
    finalResult: string | null;
  } {
    const session = this.requireSession(sessionId);
    const tasks = Array.from(session.tasks.values());
    return {
      id: session.id,
      goal: session.goal,
      status: session.status,
      taskCount: tasks.length,
      completedCount: tasks.filter(t => t.status === 'completed').length,
      failedCount: tasks.filter(t => t.status === 'failed').length,
      runningCount: tasks.filter(t => t.status === 'running' || t.status === 'assigned').length,
      readyCount: tasks.filter(t => t.status === 'ready').length,
      pendingCount: tasks.filter(t => t.status === 'pending' || t.status === 'blocked').length,
      needsApprovalCount: tasks.filter(t => t.status === 'needs_approval').length,
      tasks,
      messageCount: session.messages.length,
      artifactCount: session.artifacts.length,
      finalResult: session.finalResult,
    };
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      for (const taskId of session.tasks.keys()) {
        this.clearTaskTimeout(taskId);
      }
    }
    this.sessions.delete(sessionId);
  }

  listSessions(): Array<{ id: string; goal: string; status: SwarmStatus; taskCount: number }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      goal: s.goal,
      status: s.status,
      taskCount: s.tasks.size,
    }));
  }

  /* ─── Stuck Detection ──────────────────────────────────── */

  startStuckDetection(): void {
    this.stopStuckDetection();
    this.stuckCheckTimer = setInterval(() => this.checkForStuckTasks(), STUCK_CHECK_INTERVAL_MS);
  }

  stopStuckDetection(): void {
    if (this.stuckCheckTimer) {
      clearInterval(this.stuckCheckTimer);
      this.stuckCheckTimer = null;
    }
  }

  private checkForStuckTasks(): void {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (session.status !== 'executing') continue;

      for (const task of session.tasks.values()) {
        if (task.status !== 'running' && task.status !== 'assigned') continue;

        const lastActivity = task.lastActivityAt ? new Date(task.lastActivityAt).getTime() : 0;
        const idleMs = now - lastActivity;
        const threshold = task.timeoutMs * STUCK_THRESHOLD_RATIO;

        if (idleMs >= threshold && idleMs < task.timeoutMs) {
          logger.task('stuck_warning', sessionId, task.id, {
            level: 'warn',
            metadata: {
              idleMs,
              threshold,
              timeoutMs: task.timeoutMs,
              assignedTo: task.assignedTo,
              title: task.title,
            },
          });
          this.emit('task:stuck-warning', sessionId, task.id, idleMs);
        }
      }
    }
  }

  getStuckTasks(sessionId: string): Array<{ task: SwarmTask; idleMs: number }> {
    const session = this.requireSession(sessionId);
    const now = Date.now();
    const stuck: Array<{ task: SwarmTask; idleMs: number }> = [];

    for (const task of session.tasks.values()) {
      if (task.status !== 'running' && task.status !== 'assigned') continue;
      const lastActivity = task.lastActivityAt ? new Date(task.lastActivityAt).getTime() : 0;
      const idleMs = now - lastActivity;
      if (idleMs >= task.timeoutMs * STUCK_THRESHOLD_RATIO) {
        stuck.push({ task, idleMs });
      }
    }

    return stuck.sort((a, b) => b.idleMs - a.idleMs);
  }

  /* ─── Serialization & Persistence ─────────────────────── */

  serializeSession(sessionId: string): string {
    const session = this.requireSession(sessionId);
    return JSON.stringify({
      ...session,
      tasks: Array.from(session.tasks.entries()),
    });
  }

  deserializeSession(json: string): SwarmSession {
    const raw = JSON.parse(json);
    const session: SwarmSession = {
      ...raw,
      tasks: new Map(raw.tasks),
    };
    this.sessions.set(session.id, session);
    this.resolveDependencies(session.id);
    return session;
  }

  toFirestoreDoc(sessionId: string): {
    session: Record<string, any>;
    tasks: Array<Record<string, any>>;
    artifacts: Array<Record<string, any>>;
  } {
    const session = this.requireSession(sessionId);
    const tasks = Array.from(session.tasks.values());

    return {
      session: {
        id: session.id,
        goal: session.goal,
        status: session.status,
        orchestratorId: session.orchestratorId,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        finalResult: session.finalResult,
        taskCount: tasks.length,
        messageCount: session.messages.length,
        artifactCount: session.artifacts.length,
      },
      tasks: tasks.map(t => ({
        ...t,
        sessionId: session.id,
      })),
      artifacts: session.artifacts.map(a => ({
        ...a,
        sessionId: session.id,
      })),
    };
  }

  loadFromFirestoreDoc(doc: {
    session: Record<string, any>;
    tasks: Array<Record<string, any>>;
    artifacts?: Array<Record<string, any>>;
  }): SwarmSession {
    const session: SwarmSession = {
      id: doc.session.id,
      goal: doc.session.goal,
      status: doc.session.status,
      orchestratorId: doc.session.orchestratorId || null,
      tasks: new Map(),
      messages: [],
      artifacts: (doc.artifacts || []) as SwarmArtifact[],
      createdAt: doc.session.createdAt,
      completedAt: doc.session.completedAt || null,
      finalResult: doc.session.finalResult || null,
    };

    for (const t of doc.tasks) {
      const { sessionId: _, ...taskData } = t as SwarmTask & { sessionId?: string };
      session.tasks.set(taskData.id, taskData as SwarmTask);
    }

    this.sessions.set(session.id, session);
    this.resolveDependencies(session.id);
    return session;
  }

  /* ─── Helpers ──────────────────────────────────────────── */

  private requireSession(sessionId: string): SwarmSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    return session;
  }

  private requireTask(sessionId: string, taskId: string): SwarmTask {
    const session = this.requireSession(sessionId);
    const task = session.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found in session ${sessionId}`);
    return task;
  }
}
