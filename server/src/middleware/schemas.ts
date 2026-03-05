import { z } from 'zod';

export const gmailSendSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().max(50000).optional().default(''),
});

export const gmailReplySchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  body: z.string().min(1, 'body is required').max(50000),
});

export const slackSendSchema = z.object({
  channel: z.string().min(1, 'channel is required'),
  message: z.string().min(1, 'message is required').max(10000),
  threadTs: z.string().optional(),
});

export const aiProcessSchema = z.object({
  prompt: z.string().min(1, 'prompt is required').max(10000),
  systemPrompt: z.string().max(10000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(16000).optional(),
  input: z.any().optional(),
});

export const httpRequestSchema = z.object({
  url: z.string().url('Invalid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).optional().default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
});

export const agentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  workflow: z.record(z.any()).or(z.array(z.any())),
  id: z.string().optional(),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['active', 'paused', 'draft', 'error', 'archived']).optional(),
  userId: z.string().optional(),
  triggerType: z.string().optional(),
  triggerConfig: z.record(z.any()).optional(),
}).passthrough();

export const agentGenerateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(2000),
});

export const visionStartSchema = z.object({
  task: z.string().min(1, 'Task is required').max(2000),
  url: z.string().max(2000).optional().refine(
    (val) => !val || val.startsWith('http://') || val.startsWith('https://'),
    { message: 'URL must start with http:// or https://' }
  ),
  appName: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
});

/* ── Message schemas ─────────────────────────────────────── */

export const messageDraftSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  to: z.string().min(1, 'Recipient is required'),
  body: z.string().min(1, 'Body is required').max(50_000),
  channel: z.enum(['email', 'slack', 'teams']).optional(),
  feedback: z.string().max(5000).optional(),
});

export const messageSendSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  draft: z.string().max(50_000).optional(),
});

export const messageUpdateSchema = z.object({
  status: z.enum(['pending', 'ai_drafted', 'approved', 'sent', 'escalated']).optional(),
  starred: z.boolean().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  aiDraft: z.string().max(50_000).optional(),
});

/* ── Agent schemas ───────────────────────────────────────── */

export const agentStatusUpdateSchema = z.object({
  status: z.enum(['active', 'paused', 'draft', 'archived']),
});

export const agentRunSchema = z.object({
  triggerData: z.record(z.any()).optional().default({}),
});

/* ── Budget schemas ──────────────────────────────────────── */

export const budgetUpdateSchema = z.object({
  monthlyLimit: z.number().min(0).optional(),
  alertThreshold: z.number().min(0).max(1).optional(),
  hardLimit: z.boolean().optional(),
  enabled: z.boolean().optional(),
}).passthrough();

export const budgetRecordCostSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  amount: z.number().min(0, 'Amount must be non-negative'),
  description: z.string().min(1, 'Description is required').max(2000),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  crewId: z.string().optional(),
  crewName: z.string().optional(),
  executionId: z.string().optional(),
  metadata: z.any().optional(),
});

export const budgetSetLimitSchema = z.object({
  budget: z.number().min(0, 'Budget must be non-negative'),
});

export const budgetCalculateSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

/* ── Webhook schemas ─────────────────────────────────────── */

export const webhookCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  direction: z.enum(['inbound', 'outbound']),
  events: z.array(z.string().min(1)).min(1, 'At least one event is required'),
  createdBy: z.string().min(1, 'createdBy is required'),
  description: z.string().max(2000).optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  filters: z.any().optional(),
  targetAgentId: z.string().optional(),
  targetWorkflowId: z.string().optional(),
  transformPayload: z.any().optional(),
  enabled: z.boolean().optional(),
  retryConfig: z.any().optional(),
  teamId: z.string().optional(),
}).refine(
  (data) => data.direction !== 'outbound' || !!data.url,
  { message: 'Outbound webhooks require a URL', path: ['url'] },
);

export const webhookUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  events: z.array(z.string()).optional(),
  filters: z.any().optional(),
  targetAgentId: z.string().optional(),
  targetWorkflowId: z.string().optional(),
  transformPayload: z.any().optional(),
  enabled: z.boolean().optional(),
  retryConfig: z.any().optional(),
}).passthrough();

/* ── Escalation schemas ──────────────────────────────────── */

export const escalationCreateSchema = z.object({
  type: z.enum(['execution_failure', 'low_confidence', 'flagged_content', 'manual_review', 'approval_required', 'budget_exceeded']),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().min(1, 'Description is required').max(5000),
  userId: z.string().min(1, 'userId is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  agentId: z.string().optional(),
  agentName: z.string().optional(),
  crewId: z.string().optional(),
  crewName: z.string().optional(),
  executionId: z.string().optional(),
  nodeId: z.string().optional(),
  nodeName: z.string().optional(),
  errorMessage: z.string().optional(),
  context: z.any().optional(),
  originalOutput: z.any().optional(),
  suggestedAction: z.string().optional(),
  dueBy: z.string().optional(),
});

export const escalationUpdateSchema = z.object({
  type: z.enum(['execution_failure', 'low_confidence', 'flagged_content', 'manual_review', 'approval_required', 'budget_exceeded']).optional(),
  status: z.enum(['pending', 'in_review', 'resolved', 'dismissed', 'auto_resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  assignedTo: z.string().optional(),
}).passthrough();

export const escalationResolveSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required').max(5000),
  resolvedBy: z.string().min(1, 'resolvedBy is required'),
  reviewerNotes: z.string().max(5000).optional(),
});

export const escalationDismissSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(5000),
  dismissedBy: z.string().min(1, 'dismissedBy is required'),
});

export const escalationAssignSchema = z.object({
  assignedTo: z.string().min(1, 'assignedTo is required'),
});

/* ── Autonomous Agent schemas ─────────────────────────────── */

export const autonomousRunSchema = z.object({
  goal: z.string().min(1, 'Goal is required').max(10000),
  model: z.enum(['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-4-turbo']).optional(),
  maxIterations: z.number().int().min(1).max(100).optional(),
  autoApproveRisk: z.enum(['low', 'medium', 'high']).optional(),
  tools: z.array(z.string()).optional(),
  systemPrompt: z.string().max(10000).optional(),
});

export const autonomousApproveSchema = z.object({
  approved: z.boolean(),
});

export const autonomousMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
});
