/* ═══════════════════════════════════════════════════════════
   Claude Agent — Wraps the Claude Agent SDK's query()
   function with a virtual display for GUI control.

   Each instance represents a single autonomous agent that can:
   - Read/write/edit files (built-in)
   - Run shell commands (built-in)
   - Search code (built-in)
   - Control GUI apps via its own virtual display (custom MCP)

   The agent loop, conversation management, prompt caching,
   error recovery, and extended thinking are all handled by
   the SDK — we just wire up events and display tools.
   ═══════════════════════════════════════════════════════════ */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { createDisplayToolServer } from './displayTools.js';
import { VirtualDisplayManager, type VirtualDisplay } from './virtualDisplayManager.js';
import { logger } from './structuredLogger.js';

export type AgentStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentStep {
  type: 'thinking' | 'action' | 'tool_call' | 'tool_result' | 'text' | 'status';
  content: string;
  toolName?: string;
  timestamp: string;
}

export interface AgentCallbacks {
  onStep: (step: AgentStep) => void;
  onScreenshot: (dataUrl: string) => void;
  onComplete: (result: string) => void;
  onError: (error: string) => void;
  onStatusChange: (status: AgentStatus) => void;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';

export interface ClaudeAgentOptions {
  maxTurns?: number;
  workingDirectory?: string;
  systemPrompt?: string;
  enableGui?: boolean;
  permissionMode?: PermissionMode;
}

export class ClaudeAgent {
  readonly id: string;
  private displayManager: VirtualDisplayManager;
  private display: VirtualDisplay | null = null;
  private currentQuery: ReturnType<typeof query> | null = null;
  private _status: AgentStatus = 'starting';
  private options: ClaudeAgentOptions;

  constructor(
    id: string,
    displayManager: VirtualDisplayManager,
    options?: ClaudeAgentOptions,
  ) {
    this.id = id;
    this.displayManager = displayManager;
    this.options = options || {};
  }

  get status(): AgentStatus { return this._status; }

  async execute(goal: string, callbacks: AgentCallbacks): Promise<void> {
    const ts = () => new Date().toISOString();
    const setStatus = (s: AgentStatus) => {
      this._status = s;
      callbacks.onStatusChange(s);
    };

    try {
      setStatus('starting');

      const mcpServers: Record<string, any> = {};
      const allowedTools: string[] = [];

      if (this.options.enableGui !== false) {
        if (!this.displayManager.isRunning) {
          callbacks.onStep({ type: 'status', content: 'Starting display server...', timestamp: ts() });
          await this.displayManager.start();
        }

        callbacks.onStep({ type: 'status', content: 'Creating virtual display...', timestamp: ts() });
        this.display = await this.displayManager.createDisplay({
          width: 1280,
          height: 900,
          name: `Agent ${this.id}`,
        });

        const clipboardName = `operon-agent-${this.id}`;
        const displayServer = createDisplayToolServer(
          this.displayManager,
          this.display.displayId,
          clipboardName,
        );

        mcpServers.display = displayServer;
        allowedTools.push('mcp__display__*');
      }

      setStatus('running');
      logger.agent('executing', this.id, { metadata: { goal: goal.slice(0, 200), enableGui: this.options.enableGui } });
      callbacks.onStep({ type: 'status', content: 'Agent started', timestamp: ts() });

      const systemPrompt = this.options.systemPrompt || buildSystemPrompt(!!this.display);

      this.currentQuery = query({
        prompt: goal,
        options: {
          systemPrompt,
          mcpServers,
          allowedTools,
          permissionMode: this.options.permissionMode ?? 'bypassPermissions',
          maxTurns: this.options.maxTurns ?? 40,
          ...(this.options.workingDirectory ? { workingDirectory: this.options.workingDirectory } : {}),
        },
      });

      for await (const message of this.currentQuery) {
        if (this._status === 'cancelled') break;

        switch (message.type) {
          case 'assistant': {
            for (const block of message.message.content) {
              if (block.type === 'thinking') {
                callbacks.onStep({
                  type: 'thinking',
                  content: block.thinking || '',
                  timestamp: ts(),
                });
              } else if (block.type === 'text') {
                callbacks.onStep({
                  type: 'text',
                  content: block.text,
                  timestamp: ts(),
                });
              } else if (block.type === 'tool_use') {
                callbacks.onStep({
                  type: 'tool_call',
                  content: JSON.stringify(block.input),
                  toolName: block.name,
                  timestamp: ts(),
                });

                if (block.name === 'mcp__display__screenshot') {
                  try {
                    const cap = await this.displayManager.captureDisplay(
                      this.display!.displayId, 0.5,
                    );
                    callbacks.onScreenshot(`data:image/jpeg;base64,${cap.base64}`);
                  } catch { /* screenshot relay is best-effort */ }
                }
              }
            }
            break;
          }

          case 'result': {
            if (message.subtype === 'success') {
              logger.agent('result_success', this.id);
              setStatus('completed');
              callbacks.onComplete(message.result || 'Task completed');
            } else if (message.subtype === 'error_max_turns') {
              logger.agent('result_max_turns', this.id, { level: 'warn', metadata: { maxTurns: this.options.maxTurns ?? 40 } });
              setStatus('completed');
              const errors = (message as any).errors as string[] | undefined;
              callbacks.onComplete(`Reached maximum turns (${this.options.maxTurns ?? 40}). ${errors?.join('; ') || ''}`);
            } else {
              logger.agent('result_error', this.id, { level: 'error', error: message.subtype });
              setStatus('failed');
              const errors = (message as any).errors as string[] | undefined;
              callbacks.onError(errors?.join('; ') || `Agent ended with: ${message.subtype}`);
            }
            break;
          }
        }
      }

      if (this._status === 'running') {
        setStatus('completed');
        callbacks.onComplete('Agent finished');
      }
    } catch (err: any) {
      if (this._status !== 'cancelled') {
        logger.error('agent', 'execution_error', err.message || 'Unknown error', { agentId: this.id });
        setStatus('failed');
        callbacks.onError(err.message || 'Unknown error');
      }
    } finally {
      await this.cleanup();
    }
  }

  cancel(): void {
    this._status = 'cancelled';
    try { this.currentQuery?.close(); } catch { /* already done */ }
  }

  private async cleanup(): Promise<void> {
    if (this.display) {
      try {
        await this.displayManager.destroyDisplay(this.display.displayId);
      } catch { /* best effort */ }
      this.display = null;
    }
    this.currentQuery = null;
  }
}

function buildSystemPrompt(hasDisplay: boolean): string {
  const base = `You are an autonomous AI agent. You can read, edit, and create files, run shell commands, search code, and perform git operations.

Complete the user's task thoroughly. Think step-by-step. When you encounter errors, debug and fix them. When done, summarize what you accomplished.`;

  if (!hasDisplay) return base;

  return `${base}

GUI CAPABILITIES: You have a virtual display with macOS applications. Use the display tools to:
- Open apps with open_app (e.g. "Safari", "Figma", "Notes", "Terminal")
- Take screenshots to see the screen
- Click, type, scroll, and use key combos to interact
- Switch between apps with switch_app
- List windows with list_windows

WORKFLOW: Always take a screenshot after actions to verify the result. Use keyboard shortcuts when possible — they're faster than clicking through menus.

CRITICAL SAFETY RULES — you MUST follow these:

1. USE THE CORRECT APP: If the user says "WhatsApp", open WhatsApp — not Messages, not SMS, not iMessage. If the user says "Slack", open Slack — not Discord, not Teams. Never substitute one messaging app for another. If the requested app is not installed, STOP and report the error — do not use an alternative.

2. VERIFY BEFORE SENDING: Before sending any message, email, payment, or form submission:
   - Take a screenshot and confirm you have the CORRECT recipient/contact visible
   - The recipient name must match EXACTLY what the user asked for
   - Verify you are in the correct conversation thread, not a search result or unrelated thread
   - Never match a contact based on message content — only match on the contact/conversation NAME
   - If you are not 100% certain you have the right recipient, STOP and report what you see

3. SEARCH BY CONTACT NAME: When looking for a person in any messaging app:
   - Use the app's search/contact feature to search for the PERSON'S NAME
   - Do NOT scroll through conversations looking for mentions of the name
   - Do NOT click on a conversation just because it contains the person's name in the message text
   - The conversation header / contact name must match the requested person

4. NO IRREVERSIBLE ACTIONS WITHOUT VERIFICATION: Before any action that cannot be undone (sending a message, deleting a file, making a purchase, submitting a form), always take a screenshot first and verify the target. If anything looks wrong, stop.

5. REPORT UNCERTAINTIES: If you cannot find the right contact, the right app, or you're unsure about any step, STOP and explain what happened rather than guessing.`;
}
