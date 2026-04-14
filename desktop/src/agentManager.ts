/* ═══════════════════════════════════════════════════════════
   Agent Manager — Orchestrates multiple ClaudeAgent instances
   running concurrently, with optional swarm coordination.

   TWO MODES:
   1. Independent Mode (existing): N agents, each with its own
      goal, no coordination. Good for unrelated parallel tasks.

   2. Swarm Mode (new): An orchestrator agent decomposes a goal
      into a task DAG, spawns worker agents, coordinates handoffs,
      shares artifacts, and aggregates results. This is a true
      multi-agent team, not just parallel workers.

   Provides a central API for the Electron IPC layer to start,
   cancel, and query agents and swarms.

   Hardening:
   - maxConcurrentAgents cap with optional wait queue
   - Auto-reap of finished agents after a configurable TTL
   - Max retained agent records to bound memory
   - Optional filesystem isolation via git worktrees
   ═══════════════════════════════════════════════════════════ */

import { ClaudeAgent, type AgentCallbacks, type AgentStep, type AgentStatus, type ClaudeAgentOptions, type PermissionMode } from './claudeAgent.js';
import { SwarmOrchestrator, type SwarmCallbacks, type SwarmOptions } from './swarmOrchestrator.js';
import type { SwarmTask, SwarmStatus } from './taskBoard.js';
import { VirtualDisplayManager } from './virtualDisplayManager.js';
import { logger } from './structuredLogger.js';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface AgentInfo {
  id: string;
  goal: string;
  status: AgentStatus;
  startedAt: string;
  completedAt: string | null;
  steps: AgentStep[];
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  isolatedDir: string | null;
}

export interface AgentManagerCallbacks {
  onStep: (agentId: string, step: AgentStep) => void;
  onScreenshot: (agentId: string, dataUrl: string) => void;
  onComplete: (agentId: string, result: string) => void;
  onError: (agentId: string, error: string) => void;
  onStatusChange: (agentId: string, status: AgentStatus) => void;
  onSwarmTaskUpdate?: (swarmId: string, taskId: string, task: SwarmTask) => void;
  onSwarmStatus?: (swarmId: string, status: SwarmStatus) => void;
  onSwarmWorkerSpawned?: (swarmId: string, workerId: string, taskId: string, taskTitle: string) => void;
  onSwarmWorkerFinished?: (swarmId: string, workerId: string, taskId: string, status: string, result: string) => void;
  onSwarmOrchestratorStep?: (swarmId: string, step: AgentStep) => void;
  onSwarmWorkerStep?: (swarmId: string, workerId: string, taskId: string, step: AgentStep) => void;
}

export interface SwarmInfo {
  id: string;
  goal: string;
  status: SwarmStatus;
  startedAt: string;
  completedAt: string | null;
  result: string | null;
  error: string | null;
  taskCount: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  tasks: SwarmTask[];
  workerCount: number;
}

export interface AgentManagerOptions {
  maxConcurrentAgents?: number;
  reapAfterMs?: number;
  maxRetainedAgents?: number;
}

interface QueuedRequest {
  args: StartAgentArgs;
  resolve: (id: string) => void;
  reject: (err: Error) => void;
}

interface StartAgentArgs {
  goal: string;
  maxTurns?: number;
  workingDirectory?: string;
  enableGui?: boolean;
  systemPrompt?: string;
  permissionMode?: PermissionMode;
  isolateFilesystem?: boolean;
}

export interface StartSwarmArgs {
  goal: string;
  maxWorkers?: number;
  maxTurnsOrchestrator?: number;
  maxTurnsWorker?: number;
  workingDirectory?: string;
  enableGui?: boolean;
  permissionMode?: PermissionMode;
  isolateWorkers?: boolean;
}

const TERMINAL_STATUSES: AgentStatus[] = ['completed', 'failed', 'cancelled'];

export class AgentManager {
  private displayManager: VirtualDisplayManager;
  private agents = new Map<string, ClaudeAgent>();
  private agentInfo = new Map<string, AgentInfo>();
  private callbacks: AgentManagerCallbacks;

  private maxConcurrent: number;
  private reapAfterMs: number;
  private maxRetained: number;
  private reapTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private waitQueue: QueuedRequest[] = [];

  private swarms = new Map<string, SwarmOrchestrator>();
  private swarmInfo = new Map<string, SwarmInfo>();

  constructor(
    displayManager: VirtualDisplayManager,
    callbacks: AgentManagerCallbacks,
    options?: AgentManagerOptions,
  ) {
    this.displayManager = displayManager;
    this.callbacks = callbacks;
    this.maxConcurrent = options?.maxConcurrentAgents ?? 8;
    this.reapAfterMs = options?.reapAfterMs ?? 5 * 60 * 1000;
    this.maxRetained = options?.maxRetainedAgents ?? 50;
  }

  async ensureDisplayServer(): Promise<void> {
    if (!this.displayManager.isRunning) {
      await this.displayManager.start();
    }
  }

  startAgent(args: StartAgentArgs): string {
    if (this.getActiveCount() >= this.maxConcurrent) {
      logger.system('agent_limit_reached', {
        level: 'warn',
        metadata: { maxConcurrent: this.maxConcurrent, queued: this.waitQueue.length },
      });
      throw new Error(
        `Agent limit reached (${this.maxConcurrent} concurrent). ` +
        `Cancel a running agent or use startAgentQueued() to wait for a slot.`,
      );
    }
    return this.launchAgent(args);
  }

  startAgentQueued(args: StartAgentArgs): Promise<string> {
    if (this.getActiveCount() < this.maxConcurrent) {
      return Promise.resolve(this.launchAgent(args));
    }
    return new Promise<string>((resolve, reject) => {
      this.waitQueue.push({ args, resolve, reject });
    });
  }

  private launchAgent(args: StartAgentArgs): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let isolatedDir: string | null = null;
    let workingDirectory = args.workingDirectory;

    if (args.isolateFilesystem && workingDirectory) {
      isolatedDir = this.createIsolatedDir(workingDirectory, id);
      workingDirectory = isolatedDir;
    }

    const info: AgentInfo = {
      id,
      goal: args.goal,
      status: 'starting',
      startedAt: now,
      completedAt: null,
      steps: [],
      latestScreenshot: null,
      result: null,
      error: null,
      isolatedDir,
    };
    this.agentInfo.set(id, info);

    const options: ClaudeAgentOptions = {
      maxTurns: args.maxTurns ?? 40,
      workingDirectory,
      enableGui: args.enableGui ?? true,
      systemPrompt: args.systemPrompt,
      permissionMode: args.permissionMode,
    };

    const agent = new ClaudeAgent(id, this.displayManager, options);
    this.agents.set(id, agent);

    const callbacks: AgentCallbacks = {
      onStep: (step) => {
        const inf = this.agentInfo.get(id);
        if (inf) {
          inf.steps.push(step);
          if (inf.steps.length > 200) inf.steps = inf.steps.slice(-100);
        }
        this.callbacks.onStep(id, step);
      },
      onScreenshot: (dataUrl) => {
        const inf = this.agentInfo.get(id);
        if (inf) inf.latestScreenshot = dataUrl;
        this.callbacks.onScreenshot(id, dataUrl);
      },
      onComplete: (result) => {
        const inf = this.agentInfo.get(id);
        if (inf) {
          inf.status = 'completed';
          inf.result = result;
          inf.completedAt = new Date().toISOString();
          logger.agent('completed', id, {
            status: 'success',
            durationMs: Date.now() - new Date(inf.startedAt).getTime(),
            metadata: { steps: inf.steps.length },
          });
        }
        this.callbacks.onComplete(id, result);
        this.onAgentFinished(id);
      },
      onError: (error) => {
        const inf = this.agentInfo.get(id);
        if (inf) {
          inf.status = 'failed';
          inf.error = error;
          inf.completedAt = new Date().toISOString();
          logger.agent('failed', id, {
            status: 'error',
            error,
            durationMs: Date.now() - new Date(inf.startedAt).getTime(),
          });
        }
        this.callbacks.onError(id, error);
        this.onAgentFinished(id);
      },
      onStatusChange: (status) => {
        const inf = this.agentInfo.get(id);
        if (inf) inf.status = status;
        this.callbacks.onStatusChange(id, status);
      },
    };

    logger.agent('started', id, {
      metadata: { goal: args.goal.slice(0, 200), enableGui: args.enableGui, isolated: !!isolatedDir },
    });

    agent.execute(args.goal, callbacks).catch((err) => {
      logger.error('agent', 'uncaught_error', err.message, { agentId: id });
      callbacks.onError(err.message || 'Uncaught agent error');
    });

    return id;
  }

  /* ─── Lifecycle hooks ─────────────────────────────────── */

  private onAgentFinished(id: string): void {
    this.scheduleReap(id);
    this.drainQueue();
    this.enforceRetentionLimit();
  }

  private drainQueue(): void {
    while (this.waitQueue.length > 0 && this.getActiveCount() < this.maxConcurrent) {
      const next = this.waitQueue.shift()!;
      try {
        const agentId = this.launchAgent(next.args);
        next.resolve(agentId);
      } catch (err: any) {
        next.reject(err);
      }
    }
  }

  /* ─── Auto-reap ───────────────────────────────────────── */

  private scheduleReap(id: string): void {
    if (this.reapTimers.has(id)) return;
    const timer = setTimeout(() => {
      this.reapTimers.delete(id);
      const inf = this.agentInfo.get(id);
      if (inf && TERMINAL_STATUSES.includes(inf.status)) {
        this.removeAgent(id);
        logger.agent('reaped', id, { level: 'debug' });
      }
    }, this.reapAfterMs);
    this.reapTimers.set(id, timer);
  }

  private enforceRetentionLimit(): void {
    if (this.agentInfo.size <= this.maxRetained) return;

    const finished = Array.from(this.agentInfo.values())
      .filter(i => TERMINAL_STATUSES.includes(i.status))
      .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''));

    while (this.agentInfo.size > this.maxRetained && finished.length > 0) {
      const oldest = finished.shift()!;
      this.removeAgent(oldest.id);
      logger.agent('evicted', oldest.id, { level: 'debug', metadata: { reason: 'retention_limit' } });
    }
  }

  /* ─── Filesystem isolation ────────────────────────────── */

  private createIsolatedDir(baseDir: string, agentId: string): string {
    try {
      const branchName = `agent/${agentId.slice(0, 8)}`;
      execSync('git rev-parse --is-inside-work-tree', { cwd: baseDir, stdio: 'ignore' });
      const worktreeDir = join(tmpdir(), `operon-agent-${agentId.slice(0, 8)}`);
      execSync(`git worktree add "${worktreeDir}" -b "${branchName}" HEAD`, {
        cwd: baseDir,
        stdio: 'ignore',
      });
      logger.system('worktree_created', { level: 'debug', metadata: { path: worktreeDir } });
      return worktreeDir;
    } catch {
      const tmpDir = mkdtempSync(join(tmpdir(), 'operon-agent-'));
      logger.system('temp_dir_created', { level: 'debug', metadata: { path: tmpDir } });
      return tmpDir;
    }
  }

  private cleanupIsolatedDir(info: AgentInfo): void {
    if (!info.isolatedDir) return;
    try {
      try {
        execSync(`git worktree remove "${info.isolatedDir}" --force`, { stdio: 'ignore' });
      } catch {
        rmSync(info.isolatedDir, { recursive: true, force: true });
      }
      logger.system('isolated_dir_cleaned', { level: 'debug', metadata: { path: info.isolatedDir } });
    } catch (err: any) {
      logger.error('system', 'cleanup_failed', err?.message || 'Unknown', { metadata: { path: info.isolatedDir } });
    }
  }

  /* ─── Public API ──────────────────────────────────────── */

  cancelAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.cancel();
    const inf = this.agentInfo.get(id);
    if (inf) {
      inf.status = 'cancelled';
      inf.completedAt = new Date().toISOString();
    }
    logger.agent('cancelled', id);
    this.callbacks.onStatusChange(id, 'cancelled');
    this.onAgentFinished(id);
    return true;
  }

  cancelAll(): number {
    let count = 0;
    for (const [id, agent] of this.agents) {
      const inf = this.agentInfo.get(id);
      if (inf && (inf.status === 'running' || inf.status === 'starting')) {
        agent.cancel();
        inf.status = 'cancelled';
        inf.completedAt = new Date().toISOString();
        this.callbacks.onStatusChange(id, 'cancelled');
        this.onAgentFinished(id);
        count++;
      }
    }
    return count;
  }

  getAgentStatus(id: string): AgentInfo | null {
    return this.agentInfo.get(id) || null;
  }

  listAgents(): AgentInfo[] {
    return Array.from(this.agentInfo.values());
  }

  getActiveCount(): number {
    let count = 0;
    for (const inf of this.agentInfo.values()) {
      if (inf.status === 'running' || inf.status === 'starting') count++;
    }
    return count;
  }

  getQueuedCount(): number {
    return this.waitQueue.length;
  }

  removeAgent(id: string): boolean {
    const inf = this.agentInfo.get(id);
    if (!inf) return false;
    if (inf.status === 'running' || inf.status === 'starting') {
      this.cancelAgent(id);
    }
    this.cleanupIsolatedDir(inf);
    const timer = this.reapTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.reapTimers.delete(id);
    }
    this.agents.delete(id);
    this.agentInfo.delete(id);
    return true;
  }

  /* ═══════════════════════════════════════════════════════
     SWARM MODE — Orchestrated multi-agent coordination
     ═══════════════════════════════════════════════════════ */

  startSwarm(args: StartSwarmArgs): string {
    const swarmId = crypto.randomUUID();
    const now = new Date().toISOString();

    const info: SwarmInfo = {
      id: swarmId,
      goal: args.goal,
      status: 'planning',
      startedAt: now,
      completedAt: null,
      result: null,
      error: null,
      taskCount: 0,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0,
      tasks: [],
      workerCount: 0,
    };
    this.swarmInfo.set(swarmId, info);

    const swarmCallbacks: SwarmCallbacks = {
      onOrchestratorStep: (step) => {
        this.callbacks.onSwarmOrchestratorStep?.(swarmId, step);
      },
      onWorkerStep: (workerId, taskId, step) => {
        this.callbacks.onSwarmWorkerStep?.(swarmId, workerId, taskId, step);
      },
      onWorkerScreenshot: (workerId, taskId, dataUrl) => {
        this.callbacks.onScreenshot(workerId, dataUrl);
      },
      onTaskUpdate: (taskId, task) => {
        this.updateSwarmInfo(swarmId);
        this.callbacks.onSwarmTaskUpdate?.(swarmId, taskId, task);
      },
      onSwarmStatus: (status) => {
        const inf = this.swarmInfo.get(swarmId);
        if (inf) inf.status = status;
        this.callbacks.onSwarmStatus?.(swarmId, status);
      },
      onComplete: (result) => {
        const inf = this.swarmInfo.get(swarmId);
        if (inf) {
          inf.status = 'completed';
          inf.result = result;
          inf.completedAt = new Date().toISOString();
        }
        this.updateSwarmInfo(swarmId);
        this.callbacks.onSwarmStatus?.(swarmId, 'completed');
      },
      onError: (error) => {
        const inf = this.swarmInfo.get(swarmId);
        if (inf) {
          inf.status = 'failed';
          inf.error = error;
          inf.completedAt = new Date().toISOString();
        }
        this.callbacks.onSwarmStatus?.(swarmId, 'failed');
      },
      onWorkerSpawned: (workerId, taskId, taskTitle) => {
        this.callbacks.onSwarmWorkerSpawned?.(swarmId, workerId, taskId, taskTitle);
        this.updateSwarmInfo(swarmId);
      },
      onWorkerFinished: (workerId, taskId, status, result) => {
        this.callbacks.onSwarmWorkerFinished?.(swarmId, workerId, taskId, status, result);
        this.updateSwarmInfo(swarmId);
      },
    };

    const orchestrator = new SwarmOrchestrator(this.displayManager, swarmCallbacks, {
      maxWorkers: args.maxWorkers,
      maxTurnsOrchestrator: args.maxTurnsOrchestrator,
      maxTurnsWorker: args.maxTurnsWorker,
      workingDirectory: args.workingDirectory,
      enableGui: args.enableGui,
      permissionMode: args.permissionMode,
      isolateWorkers: args.isolateWorkers,
    });

    this.swarms.set(swarmId, orchestrator);

    logger.swarm('started', swarmId, {
      metadata: { goal: args.goal.slice(0, 200), maxWorkers: args.maxWorkers },
    });

    orchestrator.execute(args.goal).catch((err) => {
      logger.error('swarm', 'uncaught_error', err.message, { swarmId });
      const inf = this.swarmInfo.get(swarmId);
      if (inf && inf.status !== 'cancelled') {
        inf.status = 'failed';
        inf.error = err.message;
        inf.completedAt = new Date().toISOString();
      }
    });

    return swarmId;
  }

  private updateSwarmInfo(swarmId: string): void {
    const orchestrator = this.swarms.get(swarmId);
    const inf = this.swarmInfo.get(swarmId);
    if (!orchestrator || !inf) return;

    const summary = orchestrator.getSessionSummary();
    if (summary) {
      inf.taskCount = summary.taskCount;
      inf.completedCount = summary.completedCount;
      inf.failedCount = summary.failedCount;
      inf.runningCount = summary.runningCount;
      inf.tasks = summary.tasks;
      inf.workerCount = orchestrator.getWorkerCount();
    }
  }

  cancelSwarm(swarmId: string): boolean {
    const orchestrator = this.swarms.get(swarmId);
    if (!orchestrator) return false;
    orchestrator.cancel();
    const inf = this.swarmInfo.get(swarmId);
    if (inf) {
      inf.status = 'cancelled';
      inf.completedAt = new Date().toISOString();
    }
    logger.swarm('cancelled', swarmId);
    this.callbacks.onSwarmStatus?.(swarmId, 'cancelled');
    return true;
  }

  getSwarmStatus(swarmId: string): SwarmInfo | null {
    const inf = this.swarmInfo.get(swarmId);
    if (!inf) return null;
    this.updateSwarmInfo(swarmId);
    return inf;
  }

  listSwarms(): SwarmInfo[] {
    for (const id of this.swarmInfo.keys()) {
      this.updateSwarmInfo(id);
    }
    return Array.from(this.swarmInfo.values());
  }

  getSwarmTasks(swarmId: string): SwarmTask[] {
    const orchestrator = this.swarms.get(swarmId);
    if (!orchestrator) return [];
    const summary = orchestrator.getSessionSummary();
    return summary?.tasks || [];
  }

  removeSwarm(swarmId: string): boolean {
    const orchestrator = this.swarms.get(swarmId);
    if (!orchestrator) return false;
    orchestrator.cancel();
    this.swarms.delete(swarmId);
    this.swarmInfo.delete(swarmId);
    return true;
  }
}
