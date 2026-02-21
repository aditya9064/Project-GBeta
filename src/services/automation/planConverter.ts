// Plan → Workflow Converter
// Transforms a GeneratedPlan (from the setup wizard) into a WorkflowDefinition
// that the execution engine can run.

import type { WorkflowDefinition, WorkflowNodeData, WorkflowEdge, NodeType } from './types';
import type { GeneratedPlan, PlanStep } from './planGenerator';

function stepTypeToNodeType(stepType: PlanStep['type']): NodeType {
  switch (stepType) {
    case 'browser_task': return 'browser_task';
    case 'ai': return 'ai';
    case 'app': return 'app';
    case 'action': return 'action';
    case 'memory': return 'memory';
    case 'trigger': return 'trigger';
    case 'condition': return 'condition';
    case 'delay': return 'delay';
    default: return 'action';
  }
}

function buildNodeConfig(step: PlanStep, userInputs: Record<string, string>): Record<string, any> {
  const config: Record<string, any> = { ...step.details };

  // Merge user inputs into the config
  if (step.inputFields) {
    for (const field of step.inputFields) {
      if (userInputs[field.key] !== undefined) {
        config[field.key] = userInputs[field.key];
      }
    }
  }

  // Add step-specific config
  if (step.type === 'browser_task') {
    config.action = step.details.browserAction || step.action;
    config.description = step.description;
    config.requiresConfirmation = step.requiresConfirmation;
    if (step.details.url) config.url = step.details.url;
    if (step.details.selector) config.selector = step.details.selector;
    if (step.details.value) config.value = step.details.value;
    if (step.details.waitAfterMs) config.waitAfterMs = step.details.waitAfterMs;
  }

  if (step.type === 'trigger') {
    config.triggerType = step.details.triggerType || 'manual';
  }

  if (step.type === 'ai') {
    config.prompt = step.details.prompt || step.description;
    config.model = 'gpt-4';
    config.temperature = 0.7;
  }

  if (step.type === 'app') {
    config.appType = step.details.appType;
    if (step.details.gmail) config.gmail = step.details.gmail;
    if (step.details.slack) config.slack = step.details.slack;
    if (step.details.notion) config.notion = step.details.notion;
  }

  if (step.type === 'memory') {
    config.action = step.details.action || 'write';
    config.scope = step.details.scope || 'agent';
    config.key = step.details.key || 'latest';
  }

  return config;
}

export function planToWorkflow(
  plan: GeneratedPlan,
  userInputs: Record<string, string> = {},
): WorkflowDefinition {
  const NODE_X = 400;
  const NODE_START_Y = 60;
  const NODE_GAP = 140;

  const nodes: WorkflowNodeData[] = plan.steps.map((step, index) => ({
    id: step.id,
    type: stepTypeToNodeType(step.type),
    label: step.description.slice(0, 60),
    description: step.description,
    config: buildNodeConfig(step, userInputs),
    position: { x: NODE_X, y: NODE_START_Y + index * NODE_GAP },
  }));

  // If there's no trigger node, prepend a manual trigger
  if (!nodes.some((n) => n.type === 'trigger')) {
    const triggerId = 'trigger-auto';
    nodes.unshift({
      id: triggerId,
      type: 'trigger',
      label: 'Manual Trigger',
      description: 'Start workflow manually',
      config: { triggerType: 'manual' },
      position: { x: NODE_X, y: NODE_START_Y - NODE_GAP },
    });
    // Shift all other nodes down
    for (let i = 1; i < nodes.length; i++) {
      nodes[i].position = { x: NODE_X, y: NODE_START_Y + (i - 1) * NODE_GAP };
    }
  }

  // Create sequential edges
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  return { nodes, edges };
}
