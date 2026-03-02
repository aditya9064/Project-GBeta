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
  id: z.string().min(1, 'Agent ID is required'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['active', 'paused', 'draft', 'error', 'archived']).optional(),
  userId: z.string().optional(),
  workflow: z.any(),
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
