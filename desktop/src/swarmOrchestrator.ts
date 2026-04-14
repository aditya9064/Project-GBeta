/* ═══════════════════════════════════════════════════════════
   Swarm Orchestrator — Coordinated multi-agent execution

   The orchestrator is itself a Claude agent with special tools
   for task decomposition and worker management. It:

   1. Receives a high-level goal from the user
   2. Uses Claude to decompose it into a task DAG
   3. Spawns worker agents for ready tasks (respecting deps)
   4. Enforces maxWorkers concurrency limit
   5. Monitors workers via the shared TaskBoard
   6. Handles failures with retry/reassignment
   7. Gates sensitive actions through approval flow
   8. Aggregates results into a final summary
   ═══════════════════════════════════════════════════════════ */

import crypto from 'crypto';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { TaskBoard, type SwarmTask, type SwarmStatus } from './taskBoard.js';
import { createOrchestratorToolServer, createWorkerToolServer } from './swarmTools.js';
import { createDisplayToolServer } from './displayTools.js';
import { createBrowserToolServer } from './browserTools.js';
import { BrowserManager, type BrowserSession } from './browserAgent.js';
import { VirtualDisplayManager, type VirtualDisplay } from './virtualDisplayManager.js';
import type { AgentStep, AgentStatus, PermissionMode } from './claudeAgent.js';
import { logger } from './structuredLogger.js';

export interface SwarmCallbacks {
  onOrchestratorStep: (step: AgentStep) => void;
  onWorkerStep: (workerId: string, taskId: string, step: AgentStep) => void;
  onWorkerScreenshot: (workerId: string, taskId: string, dataUrl: string) => void;
  onTaskUpdate: (taskId: string, task: SwarmTask) => void;
  onSwarmStatus: (status: SwarmStatus) => void;
  onComplete: (result: string) => void;
  onError: (error: string) => void;
  onWorkerSpawned: (workerId: string, taskId: string, taskTitle: string) => void;
  onWorkerFinished: (workerId: string, taskId: string, status: 'completed' | 'failed', result: string) => void;
}

export interface SwarmOptions {
  maxWorkers?: number;
  maxTurnsOrchestrator?: number;
  maxTurnsWorker?: number;
  workingDirectory?: string;
  enableGui?: boolean;
  permissionMode?: PermissionMode;
  isolateWorkers?: boolean;
}

interface WorkerRecord {
  agentId: string;
  taskId: string;
  query: ReturnType<typeof query> | null;
  display: VirtualDisplay | null;
  browserSession: BrowserSession | null;
  status: AgentStatus;
}

const DEFAULT_MAX_WORKERS = 5;

export class SwarmOrchestrator {
  private board: TaskBoard;
  private displayManager: VirtualDisplayManager;
  private callbacks: SwarmCallbacks;
  private options: SwarmOptions;
  private maxWorkers: number;
  private sessionId: string | null = null;
  private orchestratorQuery: ReturnType<typeof query> | null = null;
  private browserManager: BrowserManager;
  private workers = new Map<string, WorkerRecord>();
  private cancelled = false;

  constructor(
    displayManager: VirtualDisplayManager,
    callbacks: SwarmCallbacks,
    options?: SwarmOptions,
  ) {
    this.board = new TaskBoard();
    this.displayManager = displayManager;
    this.browserManager = new BrowserManager();
    this.callbacks = callbacks;
    this.options = options || {};
    this.maxWorkers = this.options.maxWorkers ?? DEFAULT_MAX_WORKERS;

    this.board.on('task:completed', (_sid: string, taskId: string) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) this.callbacks.onTaskUpdate(taskId, task);
      }
    });

    this.board.on('task:failed', (_sid: string, taskId: string) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) this.callbacks.onTaskUpdate(taskId, task);
      }
    });

    this.board.on('task:ready', (_sid: string, taskId: string) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) this.callbacks.onTaskUpdate(taskId, task);
      }
    });

    this.board.on('task:started', (_sid: string, taskId: string) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) this.callbacks.onTaskUpdate(taskId, task);
      }
    });

    this.board.on('task:retry', (_sid: string, taskId: string, attempt: number) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) {
          this.callbacks.onTaskUpdate(taskId, task);
          this.callbacks.onOrchestratorStep({
            type: 'status',
            content: `Task "${task.title}" failed, retrying (attempt ${attempt}/${task.maxRetries})...`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    this.board.on('task:needs-approval', (_sid: string, taskId: string, reason: string) => {
      const session = this.board.getSession(this.sessionId!);
      if (session) {
        const task = session.tasks.get(taskId);
        if (task) this.callbacks.onTaskUpdate(taskId, task);
      }
    });

    this.board.on('task:timeout', (_sid: string, taskId: string) => {
      this.callbacks.onOrchestratorStep({
        type: 'status',
        content: `Task ${taskId} timed out due to inactivity`,
        timestamp: new Date().toISOString(),
      });
    });

    this.board.on('task:stuck-warning', (_sid: string, taskId: string, idleMs: number) => {
      this.callbacks.onOrchestratorStep({
        type: 'status',
        content: `Warning: Task ${taskId} appears stuck (idle for ${Math.round(idleMs / 1000)}s)`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  get taskBoard(): TaskBoard { return this.board; }

  async execute(goal: string): Promise<void> {
    const ts = () => new Date().toISOString();
    this.cancelled = false;

    const session = this.board.createSession(goal);
    this.sessionId = session.id;
    logger.swarm('session_created', session.id, { metadata: { goal: goal.slice(0, 200), maxWorkers: this.maxWorkers } });
    this.callbacks.onSwarmStatus('planning');

    const spawnWorkerFn = async (taskId: string, task: SwarmTask): Promise<string> => {
      const activeCount = this.getActiveWorkerCount();
      if (activeCount >= this.maxWorkers) {
        logger.swarm('worker_limit_reached', session.id, { taskId, metadata: { activeCount, maxWorkers: this.maxWorkers } });
        throw new Error(`Worker limit reached (${this.maxWorkers}). Wait for a running worker to finish before spawning more.`);
      }
      return this.launchWorker(taskId, task);
    };

    const swarmServer = createOrchestratorToolServer(this.board, session.id, spawnWorkerFn);
    const mcpServers: Record<string, any> = { swarm: swarmServer };
    const allowedTools = ['mcp__swarm__*'];

    try {
      this.callbacks.onOrchestratorStep({
        type: 'status',
        content: 'Orchestrator starting — analyzing goal and planning tasks...',
        timestamp: ts(),
      });

      this.callbacks.onSwarmStatus('executing');
      this.board.setSessionStatus(session.id, 'executing');
      this.board.startStuckDetection();

      const systemPrompt = buildOrchestratorPrompt(goal, this.maxWorkers);

      this.orchestratorQuery = query({
        prompt: `Your mission: ${goal}\n\nDecompose this into a structured execution plan, then spawn workers to execute each task. Monitor their progress and aggregate results when done.\n\nYou have a maximum of ${this.maxWorkers} concurrent workers.`,
        options: {
          systemPrompt,
          mcpServers,
          allowedTools,
          permissionMode: this.options.permissionMode ?? 'bypassPermissions',
          maxTurns: this.options.maxTurnsOrchestrator ?? 80,
          ...(this.options.workingDirectory ? { workingDirectory: this.options.workingDirectory } : {}),
        },
      });

      for await (const message of this.orchestratorQuery) {
        if (this.cancelled) break;

        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'thinking') {
              this.callbacks.onOrchestratorStep({
                type: 'thinking',
                content: block.thinking || '',
                timestamp: ts(),
              });
            } else if (block.type === 'text') {
              this.callbacks.onOrchestratorStep({
                type: 'text',
                content: block.text,
                timestamp: ts(),
              });
            } else if (block.type === 'tool_use') {
              this.callbacks.onOrchestratorStep({
                type: 'tool_call',
                content: JSON.stringify(block.input),
                toolName: block.name,
                timestamp: ts(),
              });
            }
          }
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            const session = this.board.getSession(this.sessionId!);
            if (session && session.status === 'executing') {
              this.board.setSessionStatus(this.sessionId!, 'completed', session.finalResult || message.result || 'Swarm completed');
            }
            this.callbacks.onComplete(session?.finalResult || message.result || 'Swarm completed');
          } else {
            const errors = (message as any).errors as string[] | undefined;
            const errMsg = errors?.join('; ') || `Orchestrator ended: ${message.subtype}`;
            this.board.setSessionStatus(this.sessionId!, 'failed', errMsg);
            this.callbacks.onError(errMsg);
          }
        }
      }

      if (this.cancelled) {
        this.board.setSessionStatus(this.sessionId!, 'cancelled');
        this.callbacks.onSwarmStatus('cancelled');
      }
    } catch (err: any) {
      if (!this.cancelled) {
        this.board.setSessionStatus(this.sessionId!, 'failed', err.message);
        this.callbacks.onError(err.message || 'Orchestrator error');
      }
    } finally {
      this.board.stopStuckDetection();
      await this.cleanupAllWorkers();
    }
  }

  /* ─── Worker Management ────────────────────────────────── */

  private getActiveWorkerCount(): number {
    let count = 0;
    for (const w of this.workers.values()) {
      if (w.status === 'running' || w.status === 'starting') count++;
    }
    return count;
  }

  private async launchWorker(taskId: string, task: SwarmTask): Promise<string> {
    const agentId = crypto.randomUUID();
    const ts = () => new Date().toISOString();

    this.board.assignTask(this.sessionId!, taskId, agentId);
    this.board.startTask(this.sessionId!, taskId);

    const workerServer = createWorkerToolServer(this.board, this.sessionId!, agentId, taskId);
    const mcpServers: Record<string, any> = { swarm: workerServer };
    const allowedTools = ['mcp__swarm__*'];

    let display: VirtualDisplay | null = null;
    let browserSession: BrowserSession | null = null;

    if (task.taskType === 'browser_action') {
      try {
        browserSession = await this.browserManager.createSession(`worker-${agentId.slice(0, 8)}`);
        const browserServer = createBrowserToolServer(browserSession);
        mcpServers.browser = browserServer;
        allowedTools.push('mcp__browser__*');
      } catch {
        browserSession = null;
      }
    }

    if (this.options.enableGui !== false && (task.taskType === 'desktop_action' || task.taskType === 'general')) {
      try {
        if (!this.displayManager.isRunning) await this.displayManager.start();
        display = await this.displayManager.createDisplay({
          width: 1280,
          height: 900,
          name: `Worker ${agentId.slice(0, 8)}`,
        });
        const displayServer = createDisplayToolServer(
          this.displayManager,
          display.displayId,
          `swarm-worker-${agentId.slice(0, 8)}`,
        );
        mcpServers.display = displayServer;
        allowedTools.push('mcp__display__*');
      } catch {
        display = null;
      }
    }

    const worker: WorkerRecord = { agentId, taskId, query: null, display, browserSession, status: 'starting' };
    this.workers.set(agentId, worker);

    logger.worker('spawned', this.sessionId!, agentId, taskId, {
      metadata: { taskTitle: task.title, taskType: task.taskType, hasDisplay: !!display, hasBrowser: !!browserSession },
    });
    this.callbacks.onWorkerSpawned(agentId, taskId, task.title);
    this.callbacks.onTaskUpdate(taskId, task);

    const session = this.board.getSession(this.sessionId!)!;
    const depResults = task.dependencies
      .map(depId => {
        const dep = session.tasks.get(depId);
        if (!dep || !dep.result) return '';
        return `[${dep.id}] "${dep.title}": ${dep.result}`;
      })
      .filter(Boolean)
      .join('\n');

    const approvalNote = task.requiresApproval
      ? `\n\nIMPORTANT: This task involves sensitive actions. Before executing any destructive or irreversible action (sending emails, deleting data, making payments), call report_progress with a detailed description and wait for approval.`
      : '';

    const prompt = [
      `You are a worker agent in a coordinated swarm. Your assigned task:`,
      ``,
      `TASK [${taskId}]: ${task.title}`,
      `TYPE: ${task.taskType}`,
      `${task.description}`,
      depResults ? `\nRESULTS FROM PREREQUISITE TASKS:\n${depResults}` : '',
      approvalNote,
      ``,
      `SWARM MISSION: ${session.goal}`,
      ``,
      `INSTRUCTIONS:`,
      `1. Use get_task_context to understand the full context if needed`,
      `2. Execute your task thoroughly`,
      `3. Use report_progress periodically to keep the orchestrator informed`,
      `4. Use post_artifact to share any important outputs with other agents`,
      `5. When done, call signal_done with a summary of what you accomplished`,
      `6. If you cannot complete the task, call signal_failure with a clear explanation`,
    ].join('\n');

    const systemPrompt = buildWorkerPrompt(!!display, task.taskType);

    worker.query = query({
      prompt,
      options: {
        systemPrompt,
        mcpServers,
        allowedTools,
        permissionMode: this.options.permissionMode ?? 'bypassPermissions',
        maxTurns: this.options.maxTurnsWorker ?? 40,
        ...(this.options.workingDirectory ? { workingDirectory: this.options.workingDirectory } : {}),
      },
    });

    worker.status = 'running';

    this.runWorker(worker, taskId).catch((err) => {
      console.error(`[Swarm] Worker ${agentId.slice(0, 8)} uncaught error:`, err);
    });

    return agentId;
  }

  private async runWorker(worker: WorkerRecord, taskId: string): Promise<void> {
    const ts = () => new Date().toISOString();

    try {
      for await (const message of worker.query!) {
        if (this.cancelled || worker.status === 'cancelled') break;

        this.board.recordTaskActivity(this.sessionId!, taskId);

        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'thinking') {
              this.callbacks.onWorkerStep(worker.agentId, taskId, {
                type: 'thinking', content: block.thinking || '', timestamp: ts(),
              });
            } else if (block.type === 'text') {
              this.callbacks.onWorkerStep(worker.agentId, taskId, {
                type: 'text', content: block.text, timestamp: ts(),
              });
            } else if (block.type === 'tool_use') {
              this.callbacks.onWorkerStep(worker.agentId, taskId, {
                type: 'tool_call',
                content: JSON.stringify(block.input),
                toolName: block.name,
                timestamp: ts(),
              });
              if (block.name === 'mcp__display__screenshot' && worker.display) {
                try {
                  const cap = await this.displayManager.captureDisplay(worker.display.displayId, 0.5);
                  this.callbacks.onWorkerScreenshot(worker.agentId, taskId, `data:image/jpeg;base64,${cap.base64}`);
                } catch { /* best-effort */ }
              }
            }
          }
        } else if (message.type === 'result') {
          const session = this.board.getSession(this.sessionId!);
          const task = session?.tasks.get(taskId);

          if (task && task.status === 'running') {
            if (message.subtype === 'success') {
              this.board.completeTask(this.sessionId!, taskId, message.result || 'Worker completed');
            } else {
              const errors = (message as any).errors as string[] | undefined;
              this.board.failTask(this.sessionId!, taskId, errors?.join('; ') || `Worker ended: ${message.subtype}`);
            }
          }

          worker.status = 'completed';
          this.callbacks.onWorkerFinished(
            worker.agentId,
            taskId,
            task?.status === 'completed' ? 'completed' : 'failed',
            task?.result || task?.failureReason || 'done',
          );
        }
      }
    } catch (err: any) {
      const session = this.board.getSession(this.sessionId!);
      const task = session?.tasks.get(taskId);
      if (task && task.status === 'running') {
        this.board.failTask(this.sessionId!, taskId, err.message || 'Worker crashed');
      }
      worker.status = 'failed';
      this.callbacks.onWorkerFinished(worker.agentId, taskId, 'failed', err.message);
    } finally {
      if (worker.display) {
        try { await this.displayManager.destroyDisplay(worker.display.displayId); } catch { /* best effort */ }
        worker.display = null;
      }
      if (worker.browserSession) {
        try { await this.browserManager.destroySession(worker.browserSession.id); } catch { /* best effort */ }
        worker.browserSession = null;
      }
    }
  }

  /* ─── Cancel & Cleanup ─────────────────────────────────── */

  cancel(): void {
    this.cancelled = true;
    try { this.orchestratorQuery?.close(); } catch { /* already done */ }
    for (const worker of this.workers.values()) {
      worker.status = 'cancelled';
      try { worker.query?.close(); } catch { /* already done */ }
    }
  }

  private async cleanupAllWorkers(): Promise<void> {
    for (const worker of this.workers.values()) {
      if (worker.display) {
        try { await this.displayManager.destroyDisplay(worker.display.displayId); } catch { /* best effort */ }
        worker.display = null;
      }
      if (worker.browserSession) {
        try { await this.browserManager.destroySession(worker.browserSession.id); } catch { /* best effort */ }
        worker.browserSession = null;
      }
    }
    await this.browserManager.destroyAll().catch(() => {});
    this.orchestratorQuery = null;
  }

  getSessionId(): string | null { return this.sessionId; }
  getTaskBoard(): TaskBoard { return this.board; }

  getWorkerCount(): number {
    return this.getActiveWorkerCount();
  }

  getSessionSummary() {
    if (!this.sessionId) return null;
    return this.board.getSessionSummary(this.sessionId);
  }
}

/* ─── System Prompts ─────────────────────────────────────── */

function buildOrchestratorPrompt(goal: string, maxWorkers: number): string {
  return `You are the ORCHESTRATOR of a coordinated AI agent swarm. You lead a team of up to ${maxWorkers} concurrent worker agents.

YOUR ROLE:
- Analyze the user's goal and break it into a structured, deterministic task plan (a DAG with dependencies)
- Spawn worker agents for each task, respecting the concurrency limit of ${maxWorkers}
- Monitor workers and handle failures with retries
- Aggregate results into a final comprehensive deliverable

PLANNING RULES (CRITICAL):
1. Produce a STRUCTURED plan — each task must have:
   - A clear, specific title (what to do)
   - A detailed description (how to do it, acceptance criteria)
   - A task type: "desktop_action", "browser_action", "data_extraction", "document_creation", "communication", or "general"
   - Dependencies on other task IDs (or empty if independent)
   - Priority (1 = lowest, 10 = highest)
2. For tasks involving sensitive actions (sending email, deleting data, making payments), set requiresApproval: true
3. Keep tasks between 5-30 minutes of equivalent human effort
4. MAXIMIZE PARALLELISM: Independent tasks should have no dependencies between them

EXECUTION RULES:
1. Spawn workers for ALL ready tasks simultaneously (up to ${maxWorkers} at a time)
2. Call check_progress frequently to catch completions
3. When tasks complete, their dependents become "ready" — spawn workers for those immediately
4. If a task fails and has retries remaining, it auto-resets to "ready" — spawn a new worker for it
5. Read worker results with read_worker_result to understand outputs
6. DON'T DO THE WORK YOURSELF — your job is to coordinate

AGGREGATION:
- Once all critical tasks are done, synthesize results into a comprehensive final deliverable
- Call finalize with the aggregated result`;
}

function buildWorkerPrompt(hasDisplay: boolean, taskType: string): string {
  let prompt = `You are a WORKER agent in a coordinated swarm. You have been assigned a specific task by the orchestrator.

YOUR ROLE:
- Execute your assigned task thoroughly and completely
- Report progress to the orchestrator periodically
- Share important outputs as artifacts so other agents can use them
- Signal completion or failure when done

RULES:
1. Focus ONLY on your assigned task
2. Call report_progress every few major steps
3. If you produce data, files, or results that other tasks might need, use post_artifact
4. Use read_artifacts to check if prerequisite tasks left data you need
5. When finished, ALWAYS call signal_done with a clear summary of what you accomplished and any outputs
6. If stuck after multiple attempts, call signal_failure with a detailed explanation rather than spinning`;

  if (hasDisplay) {
    prompt += `\n\nGUI CAPABILITIES: You have a virtual display for GUI interactions. Use display tools (screenshot, click, type_text, etc.) for any desktop application work.`;
  }

  if (taskType === 'browser_action') {
    prompt += `\n\nBROWSER TASK: This is a web-based task. Use browser automation tools to navigate pages, fill forms, extract data, and handle login flows.`;
  } else if (taskType === 'communication') {
    prompt += `\n\nCOMMUNICATION TASK: This involves sending communications (email, messages). Draft all communications and report them via report_progress BEFORE sending. Wait for confirmation if the task has requiresApproval set.`;
  }

  return prompt;
}
