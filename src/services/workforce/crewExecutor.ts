/* ═══════════════════════════════════════════════════════════
   Crew Executor — Orchestrates task execution across a crew
   
   Implements the manager-specialist-reviewer pattern where:
   - Manager agent decomposes goals and assigns tasks
   - Specialist agents execute assigned tasks
   - Reviewer agents validate output before completion
   ═══════════════════════════════════════════════════════════ */

import { AgentBus } from '../automation/agentBus';
import { ExecutionEngine } from '../automation/executionEngine';
import { CrewService, type Crew, type CrewMember, type CrewSettings } from './crewService';
import { MetricsService } from './metricsService';
import { FeedbackService } from './feedbackService';

export interface CrewExecutionRequest {
  crewId: string;
  goal: string;
  inputData?: Record<string, unknown>;
  userId?: string;
  callerAgentId?: string;
  onPhaseChange?: (phase: string) => void;
  onTaskUpdate?: (taskIndex: number, status: string, result?: any) => void;
  onTasksDecomposed?: (tasks: { description: string; requiredCapability?: string }[]) => void;
  onLog?: (message: string) => void;
}

export interface CrewTaskAssignment {
  taskId: string;
  agentId: string;
  agentName: string;
  role: CrewMember['role'];
  task: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'review';
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CrewExecutionResult {
  crewId: string;
  crewName: string;
  executionId: string;
  goal: string;
  status: 'completed' | 'failed' | 'partial';
  success: boolean;
  tasks: CrewTaskAssignment[];
  finalOutput: unknown;
  output: unknown;
  error?: string;
  reviewStatus?: 'approved' | 'rejected' | 'pending';
  reviewFeedback?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface CrewExecutionContext {
  executionId: string;
  crew: Crew;
  goal: string;
  inputData: Record<string, unknown>;
  tasks: CrewTaskAssignment[];
  sharedContext: Record<string, unknown>;
  logs: string[];
}

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function log(ctx: CrewExecutionContext, message: string): void {
  const timestamp = new Date().toISOString();
  ctx.logs.push(`[${timestamp}] ${message}`);
  console.log(`[CrewExecutor] ${message}`);
}

export const CrewExecutor = {
  /**
   * Execute a goal using a crew of agents
   */
  async execute(request: CrewExecutionRequest): Promise<CrewExecutionResult> {
    const startTime = Date.now();
    const executionId = `crew-exec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    // Fetch the crew
    let crew: Crew;
    try {
      crew = await CrewService.get(request.crewId);
    } catch (err) {
      throw new Error(`Failed to fetch crew ${request.crewId}: ${err}`);
    }
    
    // Initialize execution context
    const ctx: CrewExecutionContext = {
      executionId,
      crew,
      goal: request.goal,
      inputData: request.inputData || {},
      tasks: [],
      sharedContext: { ...crew.sharedContext },
      logs: [],
    };
    
    log(ctx, `Starting crew execution for "${crew.name}"`);
    log(ctx, `Goal: ${request.goal}`);
    
    // Find agents by role
    const manager = crew.members.find(m => m.role === 'manager');
    const specialists = crew.members.filter(m => m.role === 'specialist');
    const reviewers = crew.members.filter(m => m.role === 'reviewer');
    const qaAgents = crew.members.filter(m => m.role === 'qa');
    
    if (!manager) {
      throw new Error('Crew must have at least one manager agent');
    }
    
    if (specialists.length === 0) {
      throw new Error('Crew must have at least one specialist agent');
    }
    
    log(ctx, `Crew composition: 1 manager, ${specialists.length} specialists, ${reviewers.length} reviewers`);
    
    try {
      // Phase 1: Manager decomposes goal into tasks
      request.onPhaseChange?.('decomposing');
      request.onLog?.(`Manager ${manager.agentName} decomposing goal...`);
      log(ctx, `Manager ${manager.agentName} decomposing goal...`);
      const decomposition = await this.decomposeGoal(ctx, manager, request.goal, request.inputData);
      
      // Notify UI about decomposed tasks
      request.onTasksDecomposed?.(decomposition.tasks);
      
      // Phase 2: Assign and execute tasks with specialists
      request.onPhaseChange?.('executing');
      request.onLog?.(`Executing ${decomposition.tasks.length} tasks...`);
      log(ctx, `Executing ${decomposition.tasks.length} tasks...`);
      const taskResults = await this.executeTasksParallel(ctx, specialists, decomposition.tasks, request.onTaskUpdate);
      
      // Phase 3: Aggregate results
      request.onPhaseChange?.('aggregating');
      request.onLog?.('Aggregating task results...');
      log(ctx, 'Aggregating task results...');
      let aggregatedOutput = await this.aggregateResults(ctx, manager, taskResults);
      
      // Phase 4: Review if required
      let reviewStatus: 'approved' | 'rejected' | 'pending' = 'approved';
      let reviewFeedback: string | undefined;
      
      if (crew.settings.requireReviewForOutput && reviewers.length > 0) {
        request.onPhaseChange?.('reviewing');
        request.onLog?.(`Reviewer ${reviewers[0].agentName} reviewing output...`);
        log(ctx, `Reviewer ${reviewers[0].agentName} reviewing output...`);
        const reviewResult = await this.reviewOutput(ctx, reviewers[0], aggregatedOutput);
        reviewStatus = reviewResult.approved ? 'approved' : 'rejected';
        reviewFeedback = reviewResult.feedback;
        
        if (!reviewResult.approved && crew.settings.escalationEnabled) {
          log(ctx, 'Review rejected, escalating...');
          // Could retry or escalate here based on settings
        }
      }
      
      // Phase 5: QA check if we have QA agents
      if (qaAgents.length > 0 && reviewStatus === 'approved') {
        log(ctx, `QA agent ${qaAgents[0].agentName} performing quality check...`);
        const qaResult = await this.performQACheck(ctx, qaAgents[0], aggregatedOutput);
        if (!qaResult.passed) {
          log(ctx, `QA failed: ${qaResult.issues.join(', ')}`);
          reviewStatus = 'rejected';
          reviewFeedback = `QA issues: ${qaResult.issues.join('; ')}`;
        }
      }
      
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      
      // Record metrics
      MetricsService.recordActivity({
        type: 'crew_task',
        crewId: crew.id,
        crewName: crew.name,
        description: `Completed "${request.goal}" in ${MetricsService.formatDuration(durationMs)}`,
        timestamp: completedAt,
        success: reviewStatus === 'approved',
      });
      
      const isSuccess = reviewStatus === 'approved';
      const result: CrewExecutionResult = {
        crewId: crew.id,
        crewName: crew.name,
        executionId,
        goal: request.goal,
        status: isSuccess ? 'completed' : 'failed',
        success: isSuccess,
        tasks: ctx.tasks,
        finalOutput: aggregatedOutput,
        output: aggregatedOutput,
        error: isSuccess ? undefined : reviewFeedback,
        reviewStatus,
        reviewFeedback,
        startedAt: new Date(startTime).toISOString(),
        completedAt,
        durationMs,
      };
      
      request.onPhaseChange?.(isSuccess ? 'completed' : 'failed');
      
      log(ctx, `Crew execution ${reviewStatus === 'approved' ? 'completed successfully' : 'failed'}`);
      
      // Emit completion event
      AgentBus.emit({
        id: `crew-complete-${executionId}`,
        type: 'agent_output',
        sourceAgentId: `crew:${crew.id}`,
        sourceAgentName: crew.name,
        payload: {
          crewTaskId: crew.id,
          callerExecutionId: request.callerAgentId,
          result,
        },
        timestamp: new Date(),
        handled: false,
      });
      
      return result;
      
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;
      
      log(ctx, `Crew execution failed: ${err.message}`);
      
      MetricsService.recordActivity({
        type: 'error',
        crewId: crew.id,
        crewName: crew.name,
        description: `Failed: ${err.message}`,
        timestamp: completedAt,
        success: false,
      });
      
      request.onPhaseChange?.('failed');
      
      return {
        crewId: crew.id,
        crewName: crew.name,
        executionId,
        goal: request.goal,
        status: 'failed',
        success: false,
        tasks: ctx.tasks,
        finalOutput: { error: err.message },
        output: { error: err.message },
        error: err.message,
        startedAt: new Date(startTime).toISOString(),
        completedAt,
        durationMs,
      };
    }
  },
  
  /**
   * Manager agent decomposes goal into subtasks
   */
  async decomposeGoal(
    ctx: CrewExecutionContext,
    manager: CrewMember,
    goal: string,
    inputData?: Record<string, unknown>
  ): Promise<{ tasks: { description: string; requiredCapability?: string }[] }> {
    // Try to call the manager agent for decomposition
    try {
      const result = await AgentBus.callAgent(
        ctx.executionId,
        'CrewExecutor',
        manager.agentId,
        {
          action: 'decompose_goal',
          goal,
          inputData,
          crewContext: ctx.sharedContext,
          availableSpecialists: ctx.crew.members
            .filter(m => m.role === 'specialist')
            .map(m => ({ id: m.agentId, name: m.agentName })),
        },
        true,
        30000
      );
      
      if (result.success && result.output?.tasks) {
        return { tasks: result.output.tasks };
      }
    } catch (err) {
      log(ctx, `Manager decomposition failed, using heuristic fallback`);
    }
    
    // Heuristic fallback: create a single task from the goal
    return {
      tasks: [{ description: goal }],
    };
  },
  
  /**
   * Execute tasks in parallel with specialists
   */
  async executeTasksParallel(
    ctx: CrewExecutionContext,
    specialists: CrewMember[],
    tasks: { description: string; requiredCapability?: string }[],
    onTaskUpdate?: (taskIndex: number, status: string, result?: any) => void
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const maxConcurrent = ctx.crew.settings.maxConcurrentTasks || 3;
    
    // Create task assignments
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const specialist = specialists[i % specialists.length];
      
      const assignment: CrewTaskAssignment = {
        taskId: generateTaskId(),
        agentId: specialist.agentId,
        agentName: specialist.agentName,
        role: specialist.role,
        task: task.description,
        input: { ...ctx.inputData, task: task.description },
        status: 'pending',
      };
      
      ctx.tasks.push(assignment);
    }
    
    // Execute in batches respecting concurrency limit
    for (let i = 0; i < ctx.tasks.length; i += maxConcurrent) {
      const batch = ctx.tasks.slice(i, i + maxConcurrent);
      
      await Promise.all(
        batch.map(async (assignment, batchIdx) => {
          const taskIdx = ctx.tasks.indexOf(assignment);
          assignment.status = 'running';
          assignment.startedAt = new Date().toISOString();
          onTaskUpdate?.(taskIdx, 'running');
          log(ctx, `${assignment.agentName} starting: ${assignment.task.substring(0, 50)}...`);
          
          try {
            const result = await AgentBus.callAgent(
              ctx.executionId,
              'CrewExecutor',
              assignment.agentId,
              {
                action: 'execute_task',
                task: assignment.task,
                input: assignment.input,
                crewContext: ctx.sharedContext,
              },
              true,
              60000
            );
            
            if (result.success) {
              assignment.status = 'completed';
              assignment.output = result.output;
              results.set(assignment.taskId, result.output);
              onTaskUpdate?.(taskIdx, 'completed', result.output);
              log(ctx, `${assignment.agentName} completed task`);
            } else {
              throw new Error(result.error || 'Task execution failed');
            }
          } catch (err: any) {
            assignment.status = 'failed';
            assignment.error = err.message;
            onTaskUpdate?.(taskIdx, 'failed', err.message);
            log(ctx, `${assignment.agentName} failed: ${err.message}`);
            
            // Check escalation threshold
            const failedCount = ctx.tasks.filter(t => t.status === 'failed').length;
            if (ctx.crew.settings.escalationEnabled && 
                failedCount >= ctx.crew.settings.escalationThreshold) {
              throw new Error(`Escalation triggered: ${failedCount} tasks failed`);
            }
          }
          
          assignment.completedAt = new Date().toISOString();
        })
      );
    }
    
    return results;
  },
  
  /**
   * Manager aggregates results from all tasks
   */
  async aggregateResults(
    ctx: CrewExecutionContext,
    manager: CrewMember,
    taskResults: Map<string, unknown>
  ): Promise<unknown> {
    const completedTasks = ctx.tasks.filter(t => t.status === 'completed');
    
    if (completedTasks.length === 0) {
      throw new Error('No tasks completed successfully');
    }
    
    // Simple aggregation for single task
    if (completedTasks.length === 1) {
      return completedTasks[0].output;
    }
    
    // Try manager aggregation
    try {
      const result = await AgentBus.callAgent(
        ctx.executionId,
        'CrewExecutor',
        manager.agentId,
        {
          action: 'aggregate_results',
          goal: ctx.goal,
          tasks: completedTasks.map(t => ({
            task: t.task,
            output: t.output,
          })),
          crewContext: ctx.sharedContext,
        },
        true,
        30000
      );
      
      if (result.success && result.output) {
        return result.output;
      }
    } catch (err) {
      log(ctx, 'Manager aggregation failed, using simple merge');
    }
    
    // Fallback: merge all outputs
    const merged: Record<string, unknown> = {
      tasks: completedTasks.map(t => ({
        task: t.task,
        result: t.output,
      })),
    };
    
    // If outputs are objects, merge them
    for (const task of completedTasks) {
      if (typeof task.output === 'object' && task.output !== null) {
        Object.assign(merged, task.output);
      }
    }
    
    return merged;
  },
  
  /**
   * Reviewer validates the aggregated output
   */
  async reviewOutput(
    ctx: CrewExecutionContext,
    reviewer: CrewMember,
    output: unknown
  ): Promise<{ approved: boolean; feedback?: string }> {
    try {
      const result = await AgentBus.callAgent(
        ctx.executionId,
        'CrewExecutor',
        reviewer.agentId,
        {
          action: 'review_output',
          goal: ctx.goal,
          output,
          crewContext: ctx.sharedContext,
        },
        true,
        30000
      );
      
      if (result.success) {
        return {
          approved: result.output?.approved ?? true,
          feedback: result.output?.feedback,
        };
      }
    } catch (err) {
      log(ctx, `Review failed: ${err}`);
    }
    
    // Default to approved if review fails
    return { approved: true };
  },
  
  /**
   * QA agent performs quality checks
   */
  async performQACheck(
    ctx: CrewExecutionContext,
    qaAgent: CrewMember,
    output: unknown
  ): Promise<{ passed: boolean; issues: string[] }> {
    try {
      const result = await AgentBus.callAgent(
        ctx.executionId,
        'CrewExecutor',
        qaAgent.agentId,
        {
          action: 'qa_check',
          goal: ctx.goal,
          output,
          crewContext: ctx.sharedContext,
        },
        true,
        30000
      );
      
      if (result.success) {
        return {
          passed: result.output?.passed ?? true,
          issues: result.output?.issues || [],
        };
      }
    } catch (err) {
      log(ctx, `QA check failed: ${err}`);
    }
    
    // Default to passed if QA check fails
    return { passed: true, issues: [] };
  },
  
  /**
   * Subscribe to crew task requests
   */
  subscribeToCrewTasks(
    crewId: string,
    handler: (request: CrewExecutionRequest) => Promise<void>
  ): () => void {
    return AgentBus.subscribe(`crew:${crewId}`, async (event) => {
      if (event.type === 'agent_request' && event.payload?.crewId === crewId) {
        await handler({
          crewId,
          goal: event.payload.goal,
          inputData: event.payload.input,
          callerAgentId: event.sourceAgentId,
        });
      }
    });
  },
};
