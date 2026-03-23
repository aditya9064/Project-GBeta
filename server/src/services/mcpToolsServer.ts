/* ═══════════════════════════════════════════════════════════
   MCP Tools Server — Exposes OperonAI custom tools (Gmail,
   Slack, Google Workspace, etc.) as an MCP server so the
   Claude Agent SDK can call them alongside its built-in tools.
   ═══════════════════════════════════════════════════════════ */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { GmailService } from './gmail.service.js';
import { SlackService } from './slack.service.js';
import { AIEngine } from './ai-engine.js';
import { VisionAgent } from './visionAgent.js';
import { PromptToAgentService } from './promptToAgent.js';
import { execSync } from 'child_process';
import type { ToolContext } from './toolRegistry.js';

function runGws(command: string): any {
  try {
    const output = execSync(`gws ${command}`, {
      encoding: 'utf-8',
      timeout: 30_000,
      maxBuffer: 5 * 1024 * 1024,
    });
    try { return JSON.parse(output); } catch { return { raw: output.trim() }; }
  } catch (err: any) {
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    throw new Error(stderr || stdout || err.message);
  }
}

/* ─── Tool Context (shared across MCP tool executions) ──── */

let activeToolContext: ToolContext = {
  userId: 'anonymous',
  executionId: '',
  agentMemory: new Map(),
};

export function setToolContext(ctx: ToolContext) {
  activeToolContext = ctx;
}

/* ─── Helper: wrap result as MCP CallToolResult ────────── */

function textResult(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

/* ─── MCP Tool Definitions ─────────────────────────────── */

const gmailSend = tool(
  'gmail_send',
  'Send a new email via Gmail.',
  { to: z.string(), subject: z.string(), body: z.string() },
  async (args) => {
    const result = await GmailService.sendNewEmail(args.to, args.subject, args.body);
    return textResult({ success: true, to: args.to, subject: args.subject, messageId: result.messageId });
  },
);

const gmailRead = tool(
  'gmail_read',
  'Read recent emails from Gmail inbox.',
  { count: z.number().optional().default(20) },
  async (args) => {
    const count = Math.min(args.count || 20, 50);
    const messages = await GmailService.fetchMessages(count);
    return textResult({
      count: messages.length,
      emails: messages.map((e: any) => ({
        id: e.externalId, from: e.from, fromEmail: e.fromEmail,
        subject: e.subject, preview: e.preview,
        fullMessage: e.fullMessage?.substring(0, 2000),
        receivedAt: e.receivedAt,
      })),
    });
  },
  { annotations: { readOnlyHint: true } },
);

const gmailReply = tool(
  'gmail_reply',
  'Reply to an existing email thread.',
  { messageId: z.string(), body: z.string() },
  async (args) => {
    await GmailService.sendReply(args.messageId, args.body);
    return textResult({ success: true, messageId: args.messageId });
  },
);

const gmailSearch = tool(
  'gmail_search',
  'Search Gmail for emails matching a query. Supports from:, subject:, has:attachment, is:unread, etc.',
  { query: z.string(), count: z.number().optional().default(10) },
  async (args) => {
    const count = Math.min(args.count || 10, 50);
    const messages = await GmailService.searchMessages(args.query, count);
    return textResult({
      query: args.query, count: messages.length,
      emails: messages.map((e: any) => ({
        id: e.externalId, from: e.from, fromEmail: e.fromEmail,
        subject: e.subject, preview: e.preview,
        fullMessage: e.fullMessage?.substring(0, 2000),
        receivedAt: e.receivedAt,
      })),
    });
  },
  { annotations: { readOnlyHint: true } },
);

const gmailDraft = tool(
  'gmail_draft',
  'Create an email draft in Gmail without sending it.',
  { to: z.string(), subject: z.string(), body: z.string() },
  async (args) => {
    const result = await GmailService.createDraft(args.to, args.subject, args.body);
    return textResult({ success: true, to: args.to, subject: args.subject, draftId: result.draftId });
  },
);

const slackSend = tool(
  'slack_send',
  'Send a message to a Slack channel or user.',
  { channel: z.string(), message: z.string() },
  async (args) => {
    await SlackService.sendReply(args.channel, args.message);
    return textResult({ success: true, channel: args.channel });
  },
);

const slackRead = tool(
  'slack_read',
  'Read recent messages from a Slack channel.',
  { channel: z.string(), count: z.number().optional().default(20) },
  async (args) => {
    const count = Math.min(args.count || 20, 100);
    const messages = await SlackService.readMessages(args.channel, count);
    return textResult({ channel: args.channel, count: messages.length, messages });
  },
  { annotations: { readOnlyHint: true } },
);

const slackListChannels = tool(
  'slack_list_channels',
  'List available Slack channels.',
  { limit: z.number().optional().default(50) },
  async (args) => {
    const limit = Math.min(args.limit || 50, 200);
    const channels = await SlackService.listChannels(limit);
    return textResult({ count: channels.length, channels });
  },
  { annotations: { readOnlyHint: true } },
);

const httpRequest = tool(
  'http_request',
  'Make an HTTP request to any URL.',
  {
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET'),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  },
  async (args) => {
    const method = (args.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(args.headers || {}) };
    const fetchOptions: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && args.body) {
      fetchOptions.body = JSON.stringify(args.body);
    }
    const response = await fetch(args.url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : await response.text();
    return textResult({ status: response.status, statusText: response.statusText, data });
  },
);

const browserNavigate = tool(
  'browser_navigate',
  'Navigate to a URL using the AI vision browser agent.',
  { url: z.string(), task: z.string() },
  async (args) => {
    const result = await VisionAgent.executeTask(args.task, args.url);
    return textResult({
      success: result.success, task: args.task, url: args.url,
      extractedData: result.extractedData, totalSteps: result.totalSteps,
      durationMs: result.durationMs, error: result.error, finalUrl: result.finalUrl,
    });
  },
);

const aiAnalyze = tool(
  'ai_analyze',
  'Use AI to analyze, summarize, or reason about data.',
  { prompt: z.string(), input: z.any().optional() },
  async (args) => {
    const result = await AIEngine.processAutomation(
      args.prompt, undefined, args.input,
      { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 2048 },
    );
    return textResult({ response: result.response, model: result.model, usage: result.usage });
  },
  { annotations: { readOnlyHint: true } },
);

const runCode = tool(
  'run_code',
  'Execute JavaScript code. The variable "input" contains provided data.',
  { code: z.string(), input: z.any().optional() },
  async (args) => {
    try {
      const fn = new Function('input', `"use strict"; ${args.code}`);
      const result = fn(args.input || {});
      return textResult({ success: true, result });
    } catch (err: any) {
      return textResult({ success: false, error: err.message });
    }
  },
);

const memoryRead = tool(
  'memory_read',
  'Read a value from persistent agent memory by key.',
  { key: z.string() },
  async (args) => {
    const value = activeToolContext.agentMemory.get(args.key);
    return textResult({ key: args.key, value: value ?? null, found: value !== undefined });
  },
  { annotations: { readOnlyHint: true } },
);

const memoryWrite = tool(
  'memory_write',
  'Store a value in persistent agent memory.',
  { key: z.string(), value: z.string() },
  async (args) => {
    activeToolContext.agentMemory.set(args.key, args.value);
    return textResult({ key: args.key, stored: true });
  },
);

const memorySearch = tool(
  'memory_search',
  'Search agent memory for keys or values matching a query.',
  { query: z.string() },
  async (args) => {
    const q = args.query.toLowerCase();
    const results: Array<{ key: string; value: any }> = [];
    for (const [key, value] of activeToolContext.agentMemory.entries()) {
      if (key.toLowerCase().includes(q) || String(value).toLowerCase().includes(q)) {
        results.push({ key, value });
      }
    }
    return textResult({ query: args.query, results, count: results.length });
  },
  { annotations: { readOnlyHint: true } },
);

const googleDrive = tool(
  'google_drive',
  'Manage Google Drive files: list, search, create folders, delete, share.',
  {
    action: z.enum(['list', 'search', 'get', 'create_folder', 'delete', 'share']),
    query: z.string().optional(),
    fileId: z.string().optional(),
    folderName: z.string().optional(),
    parentId: z.string().optional(),
    shareEmail: z.string().optional(),
    shareRole: z.enum(['reader', 'writer', 'commenter']).optional().default('reader'),
    pageSize: z.number().optional().default(10),
  },
  async (args) => {
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;
    let result: any;
    switch (args.action) {
      case 'list':
        result = runGws(`drive files list ${ps({ pageSize: args.pageSize || 10, fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)' })}`);
        break;
      case 'search':
        if (!args.query) throw new Error('query is required for search');
        result = runGws(`drive files list ${ps({ q: args.query, pageSize: args.pageSize || 10, fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)' })}`);
        break;
      case 'get':
        if (!args.fileId) throw new Error('fileId is required');
        result = runGws(`drive files get ${ps({ fileId: args.fileId, fields: 'id,name,mimeType,modifiedTime,size,webViewLink,owners,permissions' })}`);
        break;
      case 'create_folder': {
        if (!args.folderName) throw new Error('folderName is required');
        const meta: Record<string, any> = { name: args.folderName, mimeType: 'application/vnd.google-apps.folder' };
        if (args.parentId) meta.parents = [args.parentId];
        result = runGws(`drive files create --json '${JSON.stringify(meta)}'`);
        break;
      }
      case 'delete':
        if (!args.fileId) throw new Error('fileId is required');
        result = runGws(`drive files delete ${ps({ fileId: args.fileId })}`);
        break;
      case 'share':
        if (!args.fileId || !args.shareEmail) throw new Error('fileId and shareEmail are required');
        result = runGws(`drive permissions create ${ps({ fileId: args.fileId })} --json '${JSON.stringify({ role: args.shareRole || 'reader', type: 'user', emailAddress: args.shareEmail })}'`);
        break;
    }
    return textResult(result);
  },
);

const googleCalendar = tool(
  'google_calendar',
  'Manage Google Calendar: list upcoming events, create, get, or delete events.',
  {
    action: z.enum(['list', 'create', 'get', 'delete']),
    calendarId: z.string().optional().default('primary'),
    eventId: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    startDateTime: z.string().optional(),
    endDateTime: z.string().optional(),
    attendees: z.string().optional(),
    location: z.string().optional(),
    maxResults: z.number().optional().default(10),
  },
  async (args) => {
    const calId = args.calendarId || 'primary';
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;
    let result: any;
    switch (args.action) {
      case 'list':
        result = runGws(`calendar events list ${ps({ calendarId: calId, maxResults: args.maxResults || 10, timeMin: new Date().toISOString(), singleEvents: true, orderBy: 'startTime' })}`);
        break;
      case 'create': {
        if (!args.summary || !args.startDateTime || !args.endDateTime) throw new Error('summary, startDateTime, and endDateTime are required');
        const event: Record<string, any> = { summary: args.summary, start: { dateTime: args.startDateTime }, end: { dateTime: args.endDateTime } };
        if (args.description) event.description = args.description;
        if (args.location) event.location = args.location;
        if (args.attendees) event.attendees = args.attendees.split(',').map((e: string) => ({ email: e.trim() }));
        result = runGws(`calendar events insert ${ps({ calendarId: calId })} --json '${JSON.stringify(event)}'`);
        break;
      }
      case 'get':
        if (!args.eventId) throw new Error('eventId is required');
        result = runGws(`calendar events get ${ps({ calendarId: calId, eventId: args.eventId })}`);
        break;
      case 'delete':
        if (!args.eventId) throw new Error('eventId is required');
        result = runGws(`calendar events delete ${ps({ calendarId: calId, eventId: args.eventId })}`);
        break;
    }
    return textResult(result);
  },
);

const googleSheets = tool(
  'google_sheets',
  'Work with Google Sheets: create, read ranges, write, or append data.',
  {
    action: z.enum(['create', 'read', 'write', 'append', 'get']),
    spreadsheetId: z.string().optional(),
    title: z.string().optional(),
    range: z.string().optional(),
    values: z.array(z.array(z.string())).optional(),
  },
  async (args) => {
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;
    let result: any;
    switch (args.action) {
      case 'create':
        if (!args.title) throw new Error('title is required');
        result = runGws(`sheets spreadsheets create --json '${JSON.stringify({ properties: { title: args.title } })}'`);
        break;
      case 'get':
        if (!args.spreadsheetId) throw new Error('spreadsheetId is required');
        result = runGws(`sheets spreadsheets get ${ps({ spreadsheetId: args.spreadsheetId })}`);
        break;
      case 'read':
        if (!args.spreadsheetId || !args.range) throw new Error('spreadsheetId and range are required');
        result = runGws(`sheets spreadsheets values get ${ps({ spreadsheetId: args.spreadsheetId, range: args.range })}`);
        break;
      case 'write':
        if (!args.spreadsheetId || !args.range || !args.values) throw new Error('spreadsheetId, range, and values are required');
        result = runGws(`sheets spreadsheets values update ${ps({ spreadsheetId: args.spreadsheetId, range: args.range, valueInputOption: 'USER_ENTERED' })} --json '${JSON.stringify({ values: args.values })}'`);
        break;
      case 'append':
        if (!args.spreadsheetId || !args.range || !args.values) throw new Error('spreadsheetId, range, and values are required');
        result = runGws(`sheets spreadsheets values append ${ps({ spreadsheetId: args.spreadsheetId, range: args.range, valueInputOption: 'USER_ENTERED' })} --json '${JSON.stringify({ values: args.values })}'`);
        break;
    }
    return textResult(result);
  },
);

const googleDocs = tool(
  'google_docs',
  'Work with Google Docs: create or get document content.',
  {
    action: z.enum(['create', 'get']),
    documentId: z.string().optional(),
    title: z.string().optional(),
  },
  async (args) => {
    let result: any;
    switch (args.action) {
      case 'create':
        if (!args.title) throw new Error('title is required');
        result = runGws(`docs documents create --json '${JSON.stringify({ title: args.title })}'`);
        break;
      case 'get':
        if (!args.documentId) throw new Error('documentId is required');
        result = runGws(`docs documents get --params '${JSON.stringify({ documentId: args.documentId })}'`);
        break;
    }
    return textResult(result);
  },
);

const googleWorkspace = tool(
  'google_workspace',
  'Run any Google Workspace CLI command for APIs not covered by other google_* tools.',
  { command: z.string() },
  async (args) => {
    const blocked = ['auth', 'mcp'];
    const firstWord = args.command.trim().split(/\s+/)[0];
    if (blocked.includes(firstWord)) throw new Error(`"${firstWord}" command is not allowed`);
    return textResult(runGws(args.command));
  },
);

const createWorkflow = tool(
  'create_workflow',
  'Create and deploy a reusable workflow agent from a natural language description.',
  { description: z.string(), name: z.string().optional() },
  async (args) => {
    try {
      const result = await PromptToAgentService.generate(args.description);
      if (!result.success) return textResult({ success: false, error: result.error });
      return textResult({
        success: true, name: result.name, description: result.description,
        triggerType: result.triggerType, nodeCount: result.workflow.nodes.length,
        explanation: result.explanation, workflow: result.workflow, warnings: result.warnings,
      });
    } catch (err: any) {
      return textResult({ success: false, error: err.message });
    }
  },
);

/* ─── Export all tools and factory ────────────────────────── */

export const mcpTools = [
  gmailSend, gmailRead, gmailReply, gmailSearch, gmailDraft,
  slackSend, slackRead, slackListChannels,
  httpRequest, browserNavigate, aiAnalyze, runCode,
  memoryRead, memoryWrite, memorySearch,
  googleDrive, googleCalendar, googleSheets, googleDocs, googleWorkspace,
  createWorkflow,
];

export function createOperonMcpServer() {
  return createSdkMcpServer({
    name: 'operon-tools',
    version: '1.0.0',
    tools: mcpTools,
  });
}
