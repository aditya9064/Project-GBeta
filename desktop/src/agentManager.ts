/* ═══════════════════════════════════════════════════════════
   Agent Manager — Orchestrates multiple ClaudeAgent instances
   running concurrently.

   Each agent gets its own virtual display, its own MCP tools,
   its own clipboard. They share the VirtualDisplayManager
   (which multiplexes to one Swift server process) but are
   otherwise fully isolated.

   Provides a central API for the Electron IPC layer to start,
   cancel, and query agents.
   ═══════════════════════════════════════════════════════════ */

import { ClaudeAgent, type AgentCallbacks, type AgentStep, type AgentStatus, type ClaudeAgentOptions } from './claudeAgent.js';
import { VirtualDisplayManager } from './virtualDisplayManager.js';
import crypto from 'crypto';

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
}

export interface AgentManagerCallbacks {
  onStep: (agentId: string, step: AgentStep) => void;
  onScreenshot: (agentId: string, dataUrl: string) => void;
  onComplete: (agentId: string, result: string) => void;
  onError: (agentId: string, error: string) => void;
  onStatusChange: (agentId: string, status: AgentStatus) => void;
}

export class AgentManager {
  private displayManager: VirtualDisplayManager;
  private agents = new Map<string, ClaudeAgent>();
  private agentInfo = new Map<string, AgentInfo>();
  private callbacks: AgentManagerCallbacks;

  constructor(displayManager: VirtualDisplayManager, callbacks: AgentManagerCallbacks) {
    this.displayManager = displayManager;
    this.callbacks = callbacks;
  }

  async ensureDisplayServer(): Promise<void> {
    if (!this.displayManager.isRunning) {
      await this.displayManager.start();
    }
  }

  startAgent(args: {
    goal: string;
    maxTurns?: number;
    workingDirectory?: string;
    enableGui?: boolean;
    systemPrompt?: string;
  }): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

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
    };
    this.agentInfo.set(id, info);

    const options: ClaudeAgentOptions = {
      maxTurns: args.maxTurns ?? 40,
      workingDirectory: args.workingDirectory,
      enableGui: args.enableGui ?? true,
      systemPrompt: args.systemPrompt,
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
        }
        this.callbacks.onComplete(id, result);
      },
      onError: (error) => {
        const inf = this.agentInfo.get(id);
        if (inf) {
          inf.status = 'failed';
          inf.error = error;
          inf.completedAt = new Date().toISOString();
        }
        this.callbacks.onError(id, error);
      },
      onStatusChange: (status) => {
        const inf = this.agentInfo.get(id);
        if (inf) inf.status = status;
        this.callbacks.onStatusChange(id, status);
      },
    };

    agent.execute(args.goal, callbacks).catch((err) => {
      console.error(`[AgentManager] Agent ${id} uncaught error:`, err);
      callbacks.onError(err.message || 'Uncaught agent error');
    });

    return id;
  }

  cancelAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.cancel();
    const inf = this.agentInfo.get(id);
    if (inf) {
      inf.status = 'cancelled';
      inf.completedAt = new Date().toISOString();
    }
    this.callbacks.onStatusChange(id, 'cancelled');
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

  removeAgent(id: string): boolean {
    const inf = this.agentInfo.get(id);
    if (!inf) return false;
    if (inf.status === 'running' || inf.status === 'starting') {
      this.cancelAgent(id);
    }
    this.agents.delete(id);
    this.agentInfo.delete(id);
    return true;
  }
}
