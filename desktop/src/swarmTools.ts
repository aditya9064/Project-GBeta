/* ═══════════════════════════════════════════════════════════
   Swarm Tools — MCP tool servers for inter-agent coordination

   Two server constructors:

   1. createOrchestratorToolServer() — Tools for the lead agent:
      - plan_tasks: decompose a goal into a task DAG
      - spawn_worker: launch a worker agent for a specific task
      - check_progress: poll task board status
      - read_worker_result: get a completed worker's output
      - reassign_task: reassign a failed/stalled task
      - post_message: send messages to workers
      - read_messages: read messages from workers
      - finalize: aggregate results and mark session done

   2. createWorkerToolServer() — Tools for each worker agent:
      - get_task_context: read the broader goal and task details
      - report_progress: post progress update to orchestrator
      - post_artifact: share a file/data/result with other agents
      - read_artifacts: read artifacts from other agents' tasks
      - read_messages: read messages from orchestrator/peers
      - send_message: send a message to orchestrator or peer
      - signal_done: mark task as completed with result
      - signal_failure: mark task as failed with reason
   ═══════════════════════════════════════════════════════════ */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { TaskBoard, SwarmTask } from './taskBoard.js';

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] };
}

function err(t: string) {
  return { content: [{ type: 'text' as const, text: t }], isError: true };
}

function taskSummary(t: SwarmTask): string {
  const deps = t.dependencies.length > 0 ? ` deps=[${t.dependencies.join(',')}]` : '';
  const assigned = t.assignedTo ? ` agent=${t.assignedTo.slice(0, 8)}` : '';
  return `[${t.id}] ${t.status.toUpperCase()} "${t.title}"${deps}${assigned}${t.result ? ` result="${t.result.slice(0, 120)}"` : ''}`;
}

/* ═══════════════════════════════════════════════════════════
   Orchestrator Tool Server
   ═══════════════════════════════════════════════════════════ */

export function createOrchestratorToolServer(
  board: TaskBoard,
  sessionId: string,
  spawnWorkerFn: (taskId: string, task: SwarmTask) => Promise<string>,
) {
  const planTasks = tool(
    'plan_tasks',
    `Add tasks to the swarm task board. Each task has a title, description, type (desktop_action, browser_action, data_extraction, document_creation, communication, general), priority (1=lowest, 10=highest), dependencies (IDs of tasks that must complete first), max retries, and whether it requires human approval. Call this to decompose the user's goal into parallelizable subtasks. Dependencies reference task IDs returned by this tool. Call multiple times to add more tasks dynamically.`,
    {
      tasks: z.array(z.object({
        title: z.string().describe('Short task title'),
        description: z.string().describe('Detailed instructions for the worker agent'),
        taskType: z.enum(['desktop_action', 'browser_action', 'data_extraction', 'document_creation', 'communication', 'general']).default('general').describe('Type of task: desktop_action (native apps), browser_action (web), data_extraction, document_creation, communication (email/messaging), general'),
        priority: z.number().int().min(1).max(10).default(5),
        dependencies: z.array(z.string()).default([]).describe('IDs of tasks this depends on'),
        maxRetries: z.number().int().min(0).max(3).default(2),
        requiresApproval: z.boolean().default(false).describe('Set true for sensitive actions (sending email, deleting data, making payments)'),
      })).describe('Array of tasks to add'),
    },
    async (args) => {
      try {
        const created = board.addTasks(sessionId, args.tasks.map(t => ({
          title: t.title,
          description: t.description,
          taskType: t.taskType,
          priority: t.priority,
          dependencies: t.dependencies,
          maxRetries: t.maxRetries,
          requiresApproval: t.requiresApproval,
        })));
        const lines = created.map(t => `  ${taskSummary(t)}`);
        return text(`Created ${created.length} tasks:\n${lines.join('\n')}\n\nReady tasks can now be assigned to workers with spawn_worker.`);
      } catch (e: any) {
        return err(`Failed to create tasks: ${e.message}`);
      }
    },
  );

  const spawnWorker = tool(
    'spawn_worker',
    'Launch a worker agent to execute a specific task from the task board. The worker gets the task description as its goal plus context about the broader mission. Returns the worker agent ID.',
    {
      taskId: z.string().describe('ID of the task to assign (must be in "ready" status)'),
      extraContext: z.string().optional().describe('Additional context or instructions for the worker beyond the task description'),
    },
    async (args) => {
      try {
        const session = board.getSession(sessionId);
        if (!session) return err('Session not found');
        const task = session.tasks.get(args.taskId);
        if (!task) return err(`Task ${args.taskId} not found`);
        if (task.status !== 'ready') return err(`Task ${args.taskId} is "${task.status}", not "ready". Only ready tasks can be assigned.`);

        const agentId = await spawnWorkerFn(args.taskId, task);
        return text(`Worker agent ${agentId.slice(0, 8)} spawned for task [${task.id}] "${task.title}". The worker is now executing.`);
      } catch (e: any) {
        return err(`Failed to spawn worker: ${e.message}`);
      }
    },
  );

  const checkProgress = tool(
    'check_progress',
    'Check the current status of all tasks on the board. Shows task states, assignments, and results.',
    {},
    async () => {
      try {
        const summary = board.getSessionSummary(sessionId);
        const lines = summary.tasks.map(t => `  ${taskSummary(t)}`);
        return text(
          `Swarm Progress:\n` +
          `  Total: ${summary.taskCount} | Completed: ${summary.completedCount} | ` +
          `Running: ${summary.runningCount} | Ready: ${summary.readyCount} | ` +
          `Pending: ${summary.pendingCount} | Failed: ${summary.failedCount}\n\n` +
          `Tasks:\n${lines.join('\n')}`,
        );
      } catch (e: any) {
        return err(`Failed to check progress: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const readWorkerResult = tool(
    'read_worker_result',
    'Read the full result and artifacts from a completed task.',
    {
      taskId: z.string().describe('Task ID to read results for'),
    },
    async (args) => {
      try {
        const session = board.getSession(sessionId);
        if (!session) return err('Session not found');
        const task = session.tasks.get(args.taskId);
        if (!task) return err(`Task ${args.taskId} not found`);

        let output = `Task [${task.id}] "${task.title}" — ${task.status}\n`;
        if (task.result) output += `\nResult:\n${task.result}\n`;
        if (task.failureReason) output += `\nFailure: ${task.failureReason}\n`;
        if (task.artifacts.length > 0) {
          output += `\nArtifacts:\n`;
          for (const a of task.artifacts) {
            output += `  [${a.id}] ${a.name} (${a.type}): ${a.content.slice(0, 500)}${a.content.length > 500 ? '...' : ''}\n`;
          }
        }
        return text(output);
      } catch (e: any) {
        return err(`Failed to read result: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const reassignTask = tool(
    'reassign_task',
    'Reset a failed or stalled task back to "ready" status so it can be re-spawned with spawn_worker. Optionally update the description.',
    {
      taskId: z.string().describe('Task ID to reassign'),
      newDescription: z.string().optional().describe('Updated task description'),
    },
    async (args) => {
      try {
        const session = board.getSession(sessionId);
        if (!session) return err('Session not found');
        const task = session.tasks.get(args.taskId);
        if (!task) return err(`Task ${args.taskId} not found`);
        if (task.status !== 'failed' && task.status !== 'running') {
          return err(`Task is "${task.status}". Only failed/running tasks can be reassigned.`);
        }
        task.status = 'ready';
        task.assignedTo = null;
        task.failureReason = null;
        if (args.newDescription) task.description = args.newDescription;
        return text(`Task [${task.id}] reset to "ready". Use spawn_worker to assign a new worker.`);
      } catch (e: any) {
        return err(`Failed to reassign: ${e.message}`);
      }
    },
  );

  const postMessage = tool(
    'post_message',
    'Send a message to a specific worker agent or broadcast to all workers.',
    {
      to: z.string().describe('Agent ID (first 8 chars) or "broadcast" for all workers'),
      content: z.string().describe('Message content'),
      type: z.enum(['info', 'request', 'handoff']).default('info'),
    },
    async (args) => {
      try {
        board.postMessage(sessionId, {
          from: 'orchestrator',
          to: args.to,
          type: args.type,
          content: args.content,
        });
        return text(`Message sent to ${args.to}`);
      } catch (e: any) {
        return err(`Failed to send message: ${e.message}`);
      }
    },
  );

  const readMessages = tool(
    'read_messages',
    'Read messages sent to the orchestrator from workers.',
    {
      since: z.string().optional().describe('ISO timestamp to filter messages after'),
    },
    async (args) => {
      try {
        const msgs = board.getMessages(sessionId, { to: 'orchestrator', since: args.since });
        if (msgs.length === 0) return text('No new messages.');
        const lines = msgs.map(m => `[${m.timestamp}] ${m.from.slice(0, 8)} → orchestrator (${m.type}): ${m.content}`);
        return text(lines.join('\n'));
      } catch (e: any) {
        return err(`Failed to read messages: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const finalize = tool(
    'finalize',
    'Aggregate results from all completed tasks and mark the swarm session as done. Call this after all tasks are completed (or after deciding some failures are acceptable). Provide the final synthesized result.',
    {
      result: z.string().describe('Final aggregated result/summary of all work done'),
      status: z.enum(['completed', 'failed']).default('completed'),
    },
    async (args) => {
      try {
        board.setSessionStatus(sessionId, args.status, args.result);
        return text(`Swarm session finalized as "${args.status}".`);
      } catch (e: any) {
        return err(`Failed to finalize: ${e.message}`);
      }
    },
  );

  return createSdkMcpServer({
    name: 'swarm',
    version: '1.0.0',
    tools: [planTasks, spawnWorker, checkProgress, readWorkerResult, reassignTask, postMessage, readMessages, finalize],
  });
}

/* ═══════════════════════════════════════════════════════════
   Worker Tool Server
   ═══════════════════════════════════════════════════════════ */

export function createWorkerToolServer(
  board: TaskBoard,
  sessionId: string,
  agentId: string,
  taskId: string,
) {
  const getTaskContext = tool(
    'get_task_context',
    'Get the full context of your task and the broader swarm mission. Includes the high-level goal, your specific task details, and results from dependency tasks.',
    {},
    async () => {
      try {
        const session = board.getSession(sessionId);
        if (!session) return err('Session not found');
        const task = session.tasks.get(taskId);
        if (!task) return err('Task not found');

        let ctx = `SWARM MISSION: ${session.goal}\n\n`;
        ctx += `YOUR TASK [${task.id}]: ${task.title}\n${task.description}\n`;

        if (task.dependencies.length > 0) {
          ctx += `\nDEPENDENCY RESULTS:\n`;
          for (const depId of task.dependencies) {
            const dep = session.tasks.get(depId);
            if (dep) {
              ctx += `  [${dep.id}] "${dep.title}" — ${dep.status}`;
              if (dep.result) ctx += `\n    Result: ${dep.result}`;
              if (dep.artifacts.length > 0) {
                ctx += `\n    Artifacts: ${dep.artifacts.map(a => `${a.name}(${a.type})`).join(', ')}`;
              }
              ctx += '\n';
            }
          }
        }

        const otherTasks = Array.from(session.tasks.values()).filter(t => t.id !== taskId);
        if (otherTasks.length > 0) {
          ctx += `\nOTHER TASKS IN SWARM:\n`;
          for (const t of otherTasks) {
            ctx += `  ${taskSummary(t)}\n`;
          }
        }

        return text(ctx);
      } catch (e: any) {
        return err(`Failed to get context: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const reportProgress = tool(
    'report_progress',
    'Report progress on your task to the orchestrator. Call this periodically so the orchestrator knows you are making progress.',
    {
      update: z.string().describe('Brief progress update'),
    },
    async (args) => {
      try {
        board.postMessage(sessionId, {
          from: agentId,
          to: 'orchestrator',
          type: 'progress',
          content: args.update,
          metadata: { taskId },
        });
        return text('Progress reported.');
      } catch (e: any) {
        return err(`Failed to report: ${e.message}`);
      }
    },
  );

  const postArtifact = tool(
    'post_artifact',
    'Share a file, data snippet, or result with other agents in the swarm. Other agents can read this using read_artifacts.',
    {
      name: z.string().describe('Artifact name (e.g. "api-schema.json", "research-notes")'),
      type: z.enum(['file', 'data', 'text', 'code']).default('text'),
      content: z.string().describe('Artifact content'),
    },
    async (args) => {
      try {
        const artifact = board.addArtifact(sessionId, taskId, {
          name: args.name,
          type: args.type,
          content: args.content,
          producedBy: agentId,
          taskId,
        });
        return text(`Artifact "${artifact.name}" (${artifact.id}) shared with the swarm.`);
      } catch (e: any) {
        return err(`Failed to post artifact: ${e.message}`);
      }
    },
  );

  const readArtifacts = tool(
    'read_artifacts',
    'Read artifacts shared by other agents in the swarm. Optionally filter by task ID.',
    {
      fromTaskId: z.string().optional().describe('Filter artifacts from a specific task'),
    },
    async (args) => {
      try {
        const artifacts = board.getArtifacts(sessionId, args.fromTaskId);
        if (artifacts.length === 0) return text('No artifacts available.');
        const lines = artifacts.map(a => {
          const preview = a.content.length > 300 ? a.content.slice(0, 300) + '...' : a.content;
          return `[${a.id}] ${a.name} (${a.type}) by ${a.producedBy.slice(0, 8)} for task ${a.taskId}:\n${preview}`;
        });
        return text(lines.join('\n\n'));
      } catch (e: any) {
        return err(`Failed to read artifacts: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const readMessagesWorker = tool(
    'read_messages',
    'Read messages sent to you from the orchestrator or other agents.',
    {
      since: z.string().optional().describe('ISO timestamp to filter messages after'),
    },
    async (args) => {
      try {
        const msgs = board.getMessages(sessionId, { to: agentId, since: args.since });
        const broadcasts = board.getMessages(sessionId, { to: 'broadcast', since: args.since });
        const all = [...msgs, ...broadcasts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        if (all.length === 0) return text('No new messages.');
        const lines = all.map(m => `[${m.timestamp}] ${m.from === 'orchestrator' ? 'ORCHESTRATOR' : m.from.slice(0, 8)} (${m.type}): ${m.content}`);
        return text(lines.join('\n'));
      } catch (e: any) {
        return err(`Failed to read messages: ${e.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const sendMessage = tool(
    'send_message',
    'Send a message to the orchestrator or another agent. Use "orchestrator" to message the lead, or an agent ID for peer-to-peer.',
    {
      to: z.string().describe('"orchestrator" or agent ID'),
      content: z.string().describe('Message content'),
      type: z.enum(['info', 'request', 'help']).default('info'),
    },
    async (args) => {
      try {
        board.postMessage(sessionId, {
          from: agentId,
          to: args.to,
          type: args.type,
          content: args.content,
          metadata: { taskId },
        });
        return text(`Message sent to ${args.to}.`);
      } catch (e: any) {
        return err(`Failed to send message: ${e.message}`);
      }
    },
  );

  const signalDone = tool(
    'signal_done',
    'Mark your task as completed and report the result. Call this when you have finished your assigned task successfully.',
    {
      result: z.string().describe('Summary of what you accomplished'),
    },
    async (args) => {
      try {
        board.completeTask(sessionId, taskId, args.result);
        board.postMessage(sessionId, {
          from: agentId,
          to: 'orchestrator',
          type: 'info',
          content: `Task [${taskId}] completed: ${args.result.slice(0, 200)}`,
          metadata: { taskId, event: 'completed' },
        });
        return text('Task marked as completed. You can stop working now.');
      } catch (e: any) {
        return err(`Failed to signal done: ${e.message}`);
      }
    },
  );

  const signalFailure = tool(
    'signal_failure',
    'Report that you cannot complete your task. Explain what went wrong so the orchestrator can decide to retry or reassign.',
    {
      reason: z.string().describe('Why the task failed'),
    },
    async (args) => {
      try {
        board.failTask(sessionId, taskId, args.reason);
        board.postMessage(sessionId, {
          from: agentId,
          to: 'orchestrator',
          type: 'info',
          content: `Task [${taskId}] failed: ${args.reason}`,
          metadata: { taskId, event: 'failed' },
        });
        return text('Task failure reported. The orchestrator may reassign or retry.');
      } catch (e: any) {
        return err(`Failed to signal failure: ${e.message}`);
      }
    },
  );

  return createSdkMcpServer({
    name: 'swarm',
    version: '1.0.0',
    tools: [getTaskContext, reportProgress, postArtifact, readArtifacts, readMessagesWorker, sendMessage, signalDone, signalFailure],
  });
}
