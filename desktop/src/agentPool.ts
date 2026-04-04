/* @deprecated — Use AgentManager (agentManager.ts) instead.
   AgentManager uses the Claude Agent SDK with concurrent query() calls,
   giving each agent Claude Code's full capabilities plus GUI control.

   ═══════════════════════════════════════════════════════════
   Agent Pool — Manages multiple fully-isolated agents running
   in parallel, each with its own screen, keyboard, mouse,
   and clipboard.

   Multiple agents can work on the SAME app without conflicts:
   each gets its own window on its own virtual display.

   Usage:
     const pool = new AgentPool(displayManager, callbacks);
     const id1 = pool.startAgent({ goal: "Design a login page in Figma", apps: ["Figma"] });
     const id2 = pool.startAgent({ goal: "Write notes for meeting", apps: ["Notes"] });
     const id3 = pool.startAgent({ goal: "Edit the hero image in Photoshop", apps: ["Adobe Photoshop"] });
     // All three run simultaneously without conflicts.
   ═══════════════════════════════════════════════════════════ */

import { IsolatedAgent, type IsolatedStep } from './isolatedAgent.js';
import { VirtualDisplayManager } from './virtualDisplayManager.js';

export type PoolAgentStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PoolAgentInfo {
  executionId: string;
  goal: string;
  apps: string[];
  status: PoolAgentStatus;
  stepCount: number;
  startedAt: string;
  completedAt?: string;
}

export interface PoolCallbacks {
  onStep: (executionId: string, step: IsolatedStep) => void;
  onScreenshot: (executionId: string, screenshot: string) => void;
  onComplete: (executionId: string, result: string) => void;
  onError: (executionId: string, error: string) => void;
  onStatusChange: (executionId: string, status: PoolAgentStatus) => void;
}

export class AgentPool {
  private displayManager: VirtualDisplayManager;
  private agent: IsolatedAgent;
  private agents = new Map<string, PoolAgentInfo>();
  private callbacks: PoolCallbacks;

  constructor(displayManager: VirtualDisplayManager, callbacks: PoolCallbacks) {
    this.displayManager = displayManager;
    this.agent = new IsolatedAgent(displayManager);
    this.callbacks = callbacks;
  }

  async ensureDisplayServer(): Promise<void> {
    if (!this.displayManager.isRunning) {
      await this.displayManager.start();
    }
  }

  startAgent(opts: {
    goal: string;
    apps?: string[];
    maxTurns?: number;
  }): string {
    const executionId = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const info: PoolAgentInfo = {
      executionId,
      goal: opts.goal,
      apps: opts.apps || [],
      status: 'starting',
      stepCount: 0,
      startedAt: new Date().toISOString(),
    };
    this.agents.set(executionId, info);

    const appsLabel = opts.apps?.length ? ` [${opts.apps.join(', ')}]` : ' [auto-detect]';
    console.log(`[AgentPool] Starting ${executionId}:${appsLabel} ${opts.goal.slice(0, 80)}`);
    this.callbacks.onStatusChange(executionId, 'starting');

    this.agent.execute({
      executionId,
      goal: opts.goal,
      apps: opts.apps,
      maxTurns: opts.maxTurns || 40,

      onStep: (step) => {
        const agent = this.agents.get(executionId);
        if (agent) {
          agent.stepCount++;
          if (agent.status === 'starting') {
            agent.status = 'running';
            this.callbacks.onStatusChange(executionId, 'running');
          }
        }
        this.callbacks.onStep(executionId, step);
      },

      onScreenshot: (screenshot) => {
        this.callbacks.onScreenshot(executionId, screenshot);
      },

      onComplete: (result) => {
        const agent = this.agents.get(executionId);
        if (agent) {
          agent.status = 'completed';
          agent.completedAt = new Date().toISOString();
          this.callbacks.onStatusChange(executionId, 'completed');
        }
        console.log(`[AgentPool] ${executionId} completed: ${result.slice(0, 150)}`);
        this.callbacks.onComplete(executionId, result);
      },

      onError: (error) => {
        const agent = this.agents.get(executionId);
        if (agent) {
          agent.status = 'failed';
          agent.completedAt = new Date().toISOString();
          this.callbacks.onStatusChange(executionId, 'failed');
        }
        console.error(`[AgentPool] ${executionId} error:`, error.message);
        this.callbacks.onError(executionId, error.message);
      },
    });

    return executionId;
  }

  cancelAgent(executionId: string): boolean {
    const agent = this.agents.get(executionId);
    if (!agent || (agent.status !== 'running' && agent.status !== 'starting')) return false;
    this.agent.cancel(executionId);
    agent.status = 'cancelled';
    agent.completedAt = new Date().toISOString();
    this.callbacks.onStatusChange(executionId, 'cancelled');
    return true;
  }

  cancelAll(): number {
    let count = 0;
    for (const [id, info] of this.agents) {
      if (info.status === 'running' || info.status === 'starting') {
        this.agent.cancel(id);
        info.status = 'cancelled';
        info.completedAt = new Date().toISOString();
        this.callbacks.onStatusChange(id, 'cancelled');
        count++;
      }
    }
    return count;
  }

  getStatus(): PoolAgentInfo[] {
    return [...this.agents.values()].map(a => ({ ...a }));
  }

  getAgentStatus(executionId: string): PoolAgentInfo | null {
    const agent = this.agents.get(executionId);
    return agent ? { ...agent } : null;
  }

  getActiveCount(): number {
    return [...this.agents.values()].filter(a => a.status === 'running' || a.status === 'starting').length;
  }

  cleanup(): void {
    for (const [id, info] of this.agents) {
      if (info.status !== 'running' && info.status !== 'starting') {
        this.agents.delete(id);
      }
    }
  }
}
