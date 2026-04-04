/* @deprecated — Use AgentManager (agentManager.ts) instead.
   AgentManager uses concurrent Claude Agent SDK query() calls
   with per-agent virtual displays, replacing the mutex-based
   orchestration pattern.

   ═══════════════════════════════════════════════════════════
   Agent Orchestrator — Manages multiple Computer Use agents

   Each agent targets a specific macOS app window and runs its
   own agentic loop concurrently. Keyboard input is parallel
   via AppleScript; mouse clicks serialize through a shared mutex.
   ═══════════════════════════════════════════════════════════ */

import { ComputerUseAgent, AgentStep } from './computerUseAgent.js';
import { InputMutex } from './inputMutex.js';

/* ─── Types ──────────────────────────────────────────────── */

export type AgentRunStatus = 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface AgentRunInfo {
  executionId: string;
  targetApp: string;
  goal: string;
  status: AgentRunStatus;
  stepCount: number;
  startedAt: string;
}

export interface OrchestratorCallbacks {
  onStep: (executionId: string, step: AgentStep) => void;
  onScreenshot: (executionId: string, screenshot: string) => void;
  onComplete: (executionId: string, result: string) => void;
  onError: (executionId: string, error: string) => void;
  onApprovalRequired: (executionId: string, action: { description: string; action: any }) => void;
  onStatusChange: (executionId: string, status: AgentRunStatus) => void;
}

interface ManagedAgent {
  agent: ComputerUseAgent;
  info: AgentRunInfo;
}

/* ─── Orchestrator ───────────────────────────────────────── */

export class AgentOrchestrator {
  private agents = new Map<string, ManagedAgent>();
  private inputMutex = new InputMutex();
  private serverUrl: string;
  private callbacks: OrchestratorCallbacks;

  constructor(serverUrl: string, callbacks: OrchestratorCallbacks) {
    this.serverUrl = serverUrl;
    this.callbacks = callbacks;
  }

  startAgent(opts: {
    goal: string;
    targetApp: string;
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
  }): string {
    const executionId = `multi-${opts.targetApp.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    const agent = new ComputerUseAgent({ serverUrl: this.serverUrl });

    const info: AgentRunInfo = {
      executionId,
      targetApp: opts.targetApp,
      goal: opts.goal,
      status: 'running',
      stepCount: 0,
      startedAt: new Date().toISOString(),
    };

    this.agents.set(executionId, { agent, info });

    const tag = `[Orchestrator:${opts.targetApp}]`;
    console.log(tag, 'Starting agent:', opts.goal);

    agent.execute({
      executionId,
      goal: opts.goal,
      model: opts.model,
      maxTurns: opts.maxTurns || 30,
      maxBudgetUsd: opts.maxBudgetUsd || 2.00,
      targetApp: opts.targetApp,
      inputMutex: this.inputMutex,

      onStep: (step) => {
        const managed = this.agents.get(executionId);
        if (managed) managed.info.stepCount++;
        this.callbacks.onStep(executionId, step);
      },

      onScreenshot: (screenshot) => {
        this.callbacks.onScreenshot(executionId, screenshot);
      },

      onComplete: (result) => {
        const managed = this.agents.get(executionId);
        if (managed) {
          managed.info.status = 'completed';
          this.callbacks.onStatusChange(executionId, 'completed');
        }
        console.log(tag, 'Completed:', result.substring(0, 150));
        this.callbacks.onComplete(executionId, result);
      },

      onError: (error) => {
        const managed = this.agents.get(executionId);
        if (managed) {
          managed.info.status = 'failed';
          this.callbacks.onStatusChange(executionId, 'failed');
        }
        console.error(tag, 'Error:', error.message);
        this.callbacks.onError(executionId, error.message);
      },

      onApprovalRequired: (action) => {
        const managed = this.agents.get(executionId);
        if (managed) {
          managed.info.status = 'awaiting_approval';
          this.callbacks.onStatusChange(executionId, 'awaiting_approval');
        }
        this.callbacks.onApprovalRequired(executionId, action);
      },
    });

    return executionId;
  }

  approveAgent(executionId: string, approved: boolean): boolean {
    const managed = this.agents.get(executionId);
    if (!managed) return false;
    managed.agent.resolveApproval(executionId, approved);
    if (approved) {
      managed.info.status = 'running';
      this.callbacks.onStatusChange(executionId, 'running');
    }
    return true;
  }

  cancelAgent(executionId: string): boolean {
    const managed = this.agents.get(executionId);
    if (!managed) return false;
    managed.agent.cancel(executionId);
    managed.info.status = 'cancelled';
    this.callbacks.onStatusChange(executionId, 'cancelled');
    return true;
  }

  cancelAll(): number {
    let count = 0;
    for (const [id, managed] of this.agents) {
      if (managed.info.status === 'running' || managed.info.status === 'awaiting_approval') {
        managed.agent.cancel(id);
        managed.info.status = 'cancelled';
        this.callbacks.onStatusChange(id, 'cancelled');
        count++;
      }
    }
    return count;
  }

  getStatus(): AgentRunInfo[] {
    return Array.from(this.agents.values()).map(m => ({ ...m.info }));
  }

  getAgentStatus(executionId: string): AgentRunInfo | null {
    const managed = this.agents.get(executionId);
    return managed ? { ...managed.info } : null;
  }

  getActiveCount(): number {
    let count = 0;
    for (const managed of this.agents.values()) {
      if (managed.info.status === 'running' || managed.info.status === 'awaiting_approval') {
        count++;
      }
    }
    return count;
  }

  cleanup(): void {
    for (const [id, managed] of this.agents) {
      if (managed.info.status !== 'running' && managed.info.status !== 'awaiting_approval') {
        this.agents.delete(id);
      }
    }
  }
}
