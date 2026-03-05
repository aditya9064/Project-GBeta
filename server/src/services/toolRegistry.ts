/* ═══════════════════════════════════════════════════════════
   Tool Registry — Formal tool definitions for the autonomous agent.

   Each tool wraps an existing capability (Gmail, Slack, HTTP, browser,
   code, memory, etc.) and exposes it as an OpenAI function-calling
   schema with a risk level that governs auto-approve vs. user approval.
   ═══════════════════════════════════════════════════════════ */

import { execSync } from 'child_process';
import { GmailService } from './gmail.service.js';
import { SlackService } from './slack.service.js';
import { AIEngine } from './ai-engine.js';
import { VisionAgent } from './visionAgent.js';
import { logger } from './logger.js';

/* ─── gws CLI helper ────────────────────────────────────── */

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

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, any>, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  userId: string;
  executionId: string;
  agentMemory: Map<string, any>;
}

function openaiSchema(props: Record<string, unknown>, required: string[]): Record<string, unknown> {
  return {
    type: 'object',
    properties: props,
    required,
  };
}

/* ─── Tool Definitions ──────────────────────────────────── */

const gmail_send: ToolDefinition = {
  name: 'gmail_send',
  description: 'Send a new email via Gmail. Use this when the user wants to compose and send an email to someone.',
  riskLevel: 'high',
  parameters: openaiSchema({
    to: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body (plain text or HTML)' },
  }, ['to', 'subject', 'body']),
  async execute(args) {
    const result = await GmailService.sendNewEmail(args.to, args.subject, args.body);
    return { success: true, action: 'send', to: args.to, subject: args.subject, messageId: result.messageId };
  },
};

const gmail_read: ToolDefinition = {
  name: 'gmail_read',
  description: 'Read recent emails from Gmail inbox. Returns the latest messages with sender, subject, and preview.',
  riskLevel: 'low',
  parameters: openaiSchema({
    count: { type: 'number', description: 'Number of emails to fetch (max 50, default 20)' },
  }, []),
  async execute(args) {
    const count = Math.min(args.count || 20, 50);
    const messages = await GmailService.fetchMessages(count);
    return {
      action: 'read',
      count: messages.length,
      emails: messages.map(e => ({
        id: e.externalId,
        from: e.from,
        fromEmail: e.fromEmail,
        subject: e.subject,
        preview: e.preview,
        fullMessage: e.fullMessage?.substring(0, 2000),
        receivedAt: e.receivedAt,
      })),
    };
  },
};

const gmail_reply: ToolDefinition = {
  name: 'gmail_reply',
  description: 'Reply to an existing email thread. Requires the original message ID.',
  riskLevel: 'high',
  parameters: openaiSchema({
    messageId: { type: 'string', description: 'The ID of the message to reply to' },
    body: { type: 'string', description: 'Reply body text' },
  }, ['messageId', 'body']),
  async execute(args) {
    await GmailService.sendReply(args.messageId, args.body);
    return { success: true, action: 'reply', messageId: args.messageId };
  },
};

const slack_send: ToolDefinition = {
  name: 'slack_send',
  description: 'Send a message to a Slack channel or user.',
  riskLevel: 'high',
  parameters: openaiSchema({
    channel: { type: 'string', description: 'Slack channel name or ID (e.g. #general or C01234)' },
    message: { type: 'string', description: 'Message text to send' },
  }, ['channel', 'message']),
  async execute(args) {
    await SlackService.sendReply(args.channel, args.message);
    return { success: true, action: 'send_message', channel: args.channel };
  },
};

const http_request: ToolDefinition = {
  name: 'http_request',
  description: 'Make an HTTP request to any URL. Useful for calling APIs, fetching data, or interacting with web services.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    url: { type: 'string', description: 'Full URL to request' },
    method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method (default GET)' },
    headers: { type: 'object', description: 'Request headers as key-value pairs' },
    body: { type: 'object', description: 'Request body (for POST/PUT/PATCH)' },
  }, ['url']),
  async execute(args) {
    const method = (args.method || 'GET').toUpperCase();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(args.headers || {}) };
    const fetchOptions: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD' && args.body) {
      fetchOptions.body = JSON.stringify(args.body);
    }
    const response = await fetch(args.url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : await response.text();
    return { status: response.status, statusText: response.statusText, data };
  },
};

const browser_navigate: ToolDefinition = {
  name: 'browser_navigate',
  description: 'Navigate to a URL using the AI vision browser agent. Performs a task on a web page using AI-driven navigation (clicking, typing, reading content).',
  riskLevel: 'medium',
  parameters: openaiSchema({
    url: { type: 'string', description: 'URL to navigate to' },
    task: { type: 'string', description: 'What to do on the page (e.g. "find the pricing information", "fill out the contact form")' },
  }, ['url', 'task']),
  async execute(args) {
    const result = await VisionAgent.executeTask(args.task, args.url);
    return {
      success: result.success,
      task: args.task,
      url: args.url,
      extractedData: result.extractedData,
      totalSteps: result.totalSteps,
      durationMs: result.durationMs,
      error: result.error,
      finalUrl: result.finalUrl,
    };
  },
};

const ai_analyze: ToolDefinition = {
  name: 'ai_analyze',
  description: 'Use AI to analyze, summarize, transform, or reason about data. Send a prompt with optional input data and get an AI-generated response.',
  riskLevel: 'low',
  parameters: openaiSchema({
    prompt: { type: 'string', description: 'The instruction or question for the AI' },
    input: { type: 'object', description: 'Optional data to include as context for the AI' },
    model: { type: 'string', description: 'Model to use (default gpt-4o-mini)' },
  }, ['prompt']),
  async execute(args) {
    const result = await AIEngine.processAutomation(
      args.prompt,
      undefined,
      args.input,
      { model: args.model || 'gpt-4o-mini', temperature: 0.7, maxTokens: 2048 },
    );
    return { response: result.response, model: result.model, usage: result.usage };
  },
};

const run_code: ToolDefinition = {
  name: 'run_code',
  description: 'Execute JavaScript code in a sandboxed environment. The code receives an "input" variable with any data you provide. Return a value from the code to get the result.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    code: { type: 'string', description: 'JavaScript code to execute. Use "return" to output a result. The variable "input" contains the input data.' },
    input: { type: 'object', description: 'Data available as the "input" variable inside the code' },
  }, ['code']),
  async execute(args) {
    try {
      const fn = new Function('input', `"use strict"; ${args.code}`);
      const result = fn(args.input || {});
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};

const memory_read: ToolDefinition = {
  name: 'memory_read',
  description: 'Read a value from persistent agent memory by key.',
  riskLevel: 'low',
  parameters: openaiSchema({
    key: { type: 'string', description: 'Memory key to read' },
  }, ['key']),
  async execute(args, context) {
    const value = context.agentMemory.get(args.key);
    return { key: args.key, value: value ?? null, found: value !== undefined };
  },
};

const memory_write: ToolDefinition = {
  name: 'memory_write',
  description: 'Store a value in persistent agent memory. Use this to remember information across conversations.',
  riskLevel: 'low',
  parameters: openaiSchema({
    key: { type: 'string', description: 'Memory key to write' },
    value: { type: 'string', description: 'Value to store' },
  }, ['key', 'value']),
  async execute(args, context) {
    context.agentMemory.set(args.key, args.value);
    return { key: args.key, stored: true };
  },
};

const memory_search: ToolDefinition = {
  name: 'memory_search',
  description: 'Search agent memory for keys or values matching a query string.',
  riskLevel: 'low',
  parameters: openaiSchema({
    query: { type: 'string', description: 'Search term to match against memory keys and values' },
  }, ['query']),
  async execute(args, context) {
    const q = args.query.toLowerCase();
    const results: Array<{ key: string; value: any }> = [];
    for (const [key, value] of context.agentMemory.entries()) {
      if (key.toLowerCase().includes(q) || String(value).toLowerCase().includes(q)) {
        results.push({ key, value });
      }
    }
    return { query: args.query, results, count: results.length };
  },
};

const ask_user: ToolDefinition = {
  name: 'ask_user',
  description: 'Ask the user a question and wait for their response. Use this when you need clarification, missing information, or user confirmation before proceeding.',
  riskLevel: 'low',
  parameters: openaiSchema({
    question: { type: 'string', description: 'The question to ask the user' },
  }, ['question']),
  async execute(args) {
    return { action: 'ask_user', question: args.question, awaitingResponse: true };
  },
};

/* ─── Google Workspace Tools (via gws CLI) ──────────────── */

const gws_drive: ToolDefinition = {
  name: 'google_drive',
  description: 'Manage Google Drive files: list, search, create, download, share, move, or delete files and folders. Returns structured JSON.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    action: {
      type: 'string',
      enum: ['list', 'search', 'get', 'create_folder', 'delete', 'share'],
      description: 'The Drive action to perform',
    },
    query: { type: 'string', description: 'Search query (for "search" action, uses Drive search syntax e.g. "name contains \'report\' and mimeType=\'application/pdf\'")' },
    fileId: { type: 'string', description: 'File or folder ID (for get, delete, share actions)' },
    folderName: { type: 'string', description: 'Name for new folder (for create_folder action)' },
    parentId: { type: 'string', description: 'Parent folder ID (for create_folder)' },
    shareEmail: { type: 'string', description: 'Email to share with (for share action)' },
    shareRole: { type: 'string', enum: ['reader', 'writer', 'commenter'], description: 'Permission role (for share action, default: reader)' },
    pageSize: { type: 'number', description: 'Number of results to return (default 10, max 100)' },
  }, ['action']),
  async execute(args) {
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;

    switch (args.action) {
      case 'list':
        return runGws(`drive files list ${ps({ pageSize: args.pageSize || 10, fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)' })}`);

      case 'search':
        if (!args.query) throw new Error('query is required for search');
        return runGws(`drive files list ${ps({ q: args.query, pageSize: args.pageSize || 10, fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)' })}`);

      case 'get':
        if (!args.fileId) throw new Error('fileId is required for get');
        return runGws(`drive files get ${ps({ fileId: args.fileId, fields: 'id,name,mimeType,modifiedTime,size,webViewLink,owners,permissions' })}`);

      case 'create_folder':
        if (!args.folderName) throw new Error('folderName is required');
        const folderMeta: Record<string, any> = { name: args.folderName, mimeType: 'application/vnd.google-apps.folder' };
        if (args.parentId) folderMeta.parents = [args.parentId];
        return runGws(`drive files create --json '${JSON.stringify(folderMeta)}'`);

      case 'delete':
        if (!args.fileId) throw new Error('fileId is required for delete');
        return runGws(`drive files delete ${ps({ fileId: args.fileId })}`);

      case 'share':
        if (!args.fileId || !args.shareEmail) throw new Error('fileId and shareEmail are required for share');
        return runGws(`drive permissions create ${ps({ fileId: args.fileId })} --json '${JSON.stringify({ role: args.shareRole || 'reader', type: 'user', emailAddress: args.shareEmail })}'`);

      default:
        throw new Error(`Unknown drive action: ${args.action}`);
    }
  },
};

const gws_calendar: ToolDefinition = {
  name: 'google_calendar',
  description: 'Manage Google Calendar: list upcoming events, create new events, update or delete events. Returns structured JSON.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    action: {
      type: 'string',
      enum: ['list', 'create', 'get', 'delete'],
      description: 'The Calendar action to perform',
    },
    calendarId: { type: 'string', description: 'Calendar ID (default: "primary")' },
    eventId: { type: 'string', description: 'Event ID (for get/delete actions)' },
    summary: { type: 'string', description: 'Event title (for create action)' },
    description: { type: 'string', description: 'Event description (for create action)' },
    startDateTime: { type: 'string', description: 'Start time in ISO 8601 format, e.g. "2026-03-06T15:00:00-05:00" (for create action)' },
    endDateTime: { type: 'string', description: 'End time in ISO 8601 format (for create action)' },
    attendees: { type: 'string', description: 'Comma-separated email addresses of attendees (for create action)' },
    location: { type: 'string', description: 'Event location (for create action)' },
    maxResults: { type: 'number', description: 'Number of events to return (for list, default 10)' },
  }, ['action']),
  async execute(args) {
    const calId = args.calendarId || 'primary';
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;

    switch (args.action) {
      case 'list':
        return runGws(`calendar events list ${ps({
          calendarId: calId,
          maxResults: args.maxResults || 10,
          timeMin: new Date().toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        })}`);

      case 'create': {
        if (!args.summary || !args.startDateTime || !args.endDateTime) {
          throw new Error('summary, startDateTime, and endDateTime are required to create an event');
        }
        const event: Record<string, any> = {
          summary: args.summary,
          start: { dateTime: args.startDateTime },
          end: { dateTime: args.endDateTime },
        };
        if (args.description) event.description = args.description;
        if (args.location) event.location = args.location;
        if (args.attendees) {
          event.attendees = args.attendees.split(',').map((e: string) => ({ email: e.trim() }));
        }
        return runGws(`calendar events insert ${ps({ calendarId: calId })} --json '${JSON.stringify(event)}'`);
      }

      case 'get':
        if (!args.eventId) throw new Error('eventId is required for get');
        return runGws(`calendar events get ${ps({ calendarId: calId, eventId: args.eventId })}`);

      case 'delete':
        if (!args.eventId) throw new Error('eventId is required for delete');
        return runGws(`calendar events delete ${ps({ calendarId: calId, eventId: args.eventId })}`);

      default:
        throw new Error(`Unknown calendar action: ${args.action}`);
    }
  },
};

const gws_sheets: ToolDefinition = {
  name: 'google_sheets',
  description: 'Work with Google Sheets: create spreadsheets, read cell ranges, write/append data, and list sheets. Returns structured JSON.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    action: {
      type: 'string',
      enum: ['create', 'read', 'write', 'append', 'get'],
      description: 'The Sheets action to perform',
    },
    spreadsheetId: { type: 'string', description: 'Spreadsheet ID (for read/write/append/get actions)' },
    title: { type: 'string', description: 'Spreadsheet title (for create action)' },
    range: { type: 'string', description: 'Cell range in A1 notation, e.g. "Sheet1!A1:C10" (for read/write/append)' },
    values: {
      type: 'array',
      description: 'Array of rows to write. Each row is an array of cell values, e.g. [["Name","Score"],["Alice",95]]',
      items: { type: 'array', items: { type: 'string' } },
    },
  }, ['action']),
  async execute(args) {
    const ps = (obj: Record<string, any>) => `--params '${JSON.stringify(obj)}'`;

    switch (args.action) {
      case 'create':
        if (!args.title) throw new Error('title is required to create a spreadsheet');
        return runGws(`sheets spreadsheets create --json '${JSON.stringify({ properties: { title: args.title } })}'`);

      case 'get':
        if (!args.spreadsheetId) throw new Error('spreadsheetId is required');
        return runGws(`sheets spreadsheets get ${ps({ spreadsheetId: args.spreadsheetId })}`);

      case 'read':
        if (!args.spreadsheetId || !args.range) throw new Error('spreadsheetId and range are required for read');
        return runGws(`sheets spreadsheets values get ${ps({ spreadsheetId: args.spreadsheetId, range: args.range })}`);

      case 'write':
        if (!args.spreadsheetId || !args.range || !args.values) throw new Error('spreadsheetId, range, and values are required for write');
        return runGws(`sheets spreadsheets values update ${ps({ spreadsheetId: args.spreadsheetId, range: args.range, valueInputOption: 'USER_ENTERED' })} --json '${JSON.stringify({ values: args.values })}'`);

      case 'append':
        if (!args.spreadsheetId || !args.range || !args.values) throw new Error('spreadsheetId, range, and values are required for append');
        return runGws(`sheets spreadsheets values append ${ps({ spreadsheetId: args.spreadsheetId, range: args.range, valueInputOption: 'USER_ENTERED' })} --json '${JSON.stringify({ values: args.values })}'`);

      default:
        throw new Error(`Unknown sheets action: ${args.action}`);
    }
  },
};

const gws_docs: ToolDefinition = {
  name: 'google_docs',
  description: 'Work with Google Docs: create new documents or get document content/metadata. Returns structured JSON.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    action: {
      type: 'string',
      enum: ['create', 'get'],
      description: 'The Docs action to perform',
    },
    documentId: { type: 'string', description: 'Document ID (for get action)' },
    title: { type: 'string', description: 'Document title (for create action)' },
  }, ['action']),
  async execute(args) {
    switch (args.action) {
      case 'create':
        if (!args.title) throw new Error('title is required to create a document');
        return runGws(`docs documents create --json '${JSON.stringify({ title: args.title })}'`);

      case 'get':
        if (!args.documentId) throw new Error('documentId is required for get');
        return runGws(`docs documents get --params '${JSON.stringify({ documentId: args.documentId })}'`);

      default:
        throw new Error(`Unknown docs action: ${args.action}`);
    }
  },
};

const gws_general: ToolDefinition = {
  name: 'google_workspace',
  description: 'Run any Google Workspace CLI command for APIs not covered by the other google_* tools. Supports all Google Workspace APIs: Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin, Tasks, and more. The command is passed directly to the gws CLI. Use "gws <service> <resource> <method> --params \'{...}\' --json \'{...}\'" syntax. Returns structured JSON.',
  riskLevel: 'medium',
  parameters: openaiSchema({
    command: {
      type: 'string',
      description: 'The gws CLI command (without the "gws" prefix). Examples: "tasks tasklists list", "chat spaces list", "admin users list --params \'{\\"domain\\":\\"example.com\\"}\'"',
    },
  }, ['command']),
  async execute(args) {
    const blocked = ['auth', 'mcp'];
    const firstWord = args.command.trim().split(/\s+/)[0];
    if (blocked.includes(firstWord)) {
      throw new Error(`The "${firstWord}" command is not allowed for security reasons`);
    }
    return runGws(args.command);
  },
};

/* ─── Registry ──────────────────────────────────────────── */

const ALL_TOOLS: ToolDefinition[] = [
  gmail_send,
  gmail_read,
  gmail_reply,
  slack_send,
  http_request,
  browser_navigate,
  ai_analyze,
  run_code,
  memory_read,
  memory_write,
  memory_search,
  ask_user,
  gws_drive,
  gws_calendar,
  gws_sheets,
  gws_docs,
  gws_general,
];

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(tools?: ToolDefinition[]) {
    for (const tool of tools || ALL_TOOLS) {
      this.tools.set(tool.name, tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Get all tools whose risk level is at or below the given threshold */
  getByMaxRisk(maxRisk: RiskLevel): ToolDefinition[] {
    const levels: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
    const max = levels[maxRisk];
    return this.getAll().filter(t => levels[t.riskLevel] <= max);
  }

  /** Convert to OpenAI function-calling tools array */
  toOpenAITools(names?: string[]): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    const toolList = names
      ? names.map(n => this.tools.get(n)).filter(Boolean) as ToolDefinition[]
      : this.getAll();

    return toolList.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name} (risk: ${tool.riskLevel})`);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
}

export const defaultRegistry = new ToolRegistry();
