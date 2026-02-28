/* ═══════════════════════════════════════════════════════════
   Computer Orchestration Engine — Executors
   
   Maps subtask types to executor functions that call the
   underlying services (AI, browser, integrations, etc).
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../../config.js';
import { logger } from '../logger.js';
import { AIEngine } from '../ai-engine.js';
import { VisionAgent } from '../visionAgent.js';
import { GmailService } from '../gmail.service.js';
import { SlackService } from '../slack.service.js';
import type { Subtask, SubtaskResult, ComputerMemory, SubtaskExecutor, SubtaskType } from './types.js';

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  return openaiClient;
}

function makeResult(
  subtaskId: string,
  status: SubtaskResult['status'],
  output: any,
  startTime: number,
  error?: string
): SubtaskResult {
  return {
    subtaskId,
    status,
    output,
    error,
    durationMs: Date.now() - startTime,
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
  };
}

function gatherDependencyOutputs(subtask: Subtask, memory: ComputerMemory): Record<string, any> {
  const depOutputs: Record<string, any> = {};
  for (const depId of subtask.dependsOn || []) {
    const depResult = memory.results.get(depId);
    if (depResult?.status === 'completed') {
      depOutputs[depId] = depResult.output;
    }
  }
  return depOutputs;
}

const executeAIReasoning: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const depOutputs = gatherDependencyOutputs(subtask, memory);
    const prompt = subtask.inputs.prompt || subtask.description;
    const systemPrompt = subtask.inputs.systemPrompt || 'You are a helpful assistant.';

    const combinedInput = {
      ...subtask.inputs,
      dependencyOutputs: depOutputs,
    };

    const result = await AIEngine.processAutomation(prompt, systemPrompt, combinedInput, {
      model: 'gpt-4o',
      temperature: 0.3,
    });

    return makeResult(subtask.id, 'completed', result, start);
  } catch (err: any) {
    logger.error('[Executor:ai_reasoning] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeWebBrowse: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const depOutputs = gatherDependencyOutputs(subtask, memory);
    let url = subtask.inputs.url || '';
    const task = subtask.inputs.task || subtask.description;

    if (!url && depOutputs) {
      for (const output of Object.values(depOutputs)) {
        if (typeof output === 'string' && output.startsWith('http')) {
          url = output;
          break;
        }
        if (output?.url) {
          url = output.url;
          break;
        }
      }
    }

    if (!url) {
      return makeResult(subtask.id, 'failed', null, start, 'No URL provided for web_browse');
    }

    const sessionId = `computer-${memory.taskId}-${subtask.id}`;
    const result = await VisionAgent.executeTask(task, url, sessionId);

    return makeResult(subtask.id, result.success ? 'completed' : 'failed', {
      extractedData: result.extractedData,
      finalUrl: result.finalUrl,
      steps: result.totalSteps,
    }, start, result.error);
  } catch (err: any) {
    logger.error('[Executor:web_browse] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeWebSearch: SubtaskExecutor = async (subtask, _memory) => {
  const start = Date.now();
  try {
    const query = subtask.inputs.query || subtask.description;
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a web search assistant. Given a search query, provide helpful information as if you had searched the web. Include relevant URLs where appropriate. Structure your response as JSON: { "summary": "...", "results": [{ "title": "...", "url": "...", "snippet": "..." }] }`,
        },
        { role: 'user', content: `Search query: ${query}` },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '';
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: content, results: [] };
    }

    return makeResult(subtask.id, 'completed', parsed, start);
  } catch (err: any) {
    logger.error('[Executor:web_search] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeSendEmail: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const depOutputs = gatherDependencyOutputs(subtask, memory);
    let { to, subject, body } = subtask.inputs;

    if (!body && depOutputs) {
      const lastOutput = Object.values(depOutputs).pop();
      if (typeof lastOutput === 'string') {
        body = lastOutput;
      } else if (lastOutput?.response) {
        body = lastOutput.response;
      } else if (lastOutput?.draft) {
        body = lastOutput.draft;
      }
    }

    if (!to || !subject) {
      return makeResult(subtask.id, 'failed', null, start, 'Missing required email fields (to, subject)');
    }

    await GmailService.restoreFromStore();
    const conn = GmailService.getConnection();
    if (conn.status !== 'connected') {
      return makeResult(subtask.id, 'failed', null, start, 'Gmail not connected');
    }

    const result = await GmailService.sendNewEmail(to, subject, body || '');
    return makeResult(subtask.id, 'completed', { sent: true, ...result }, start);
  } catch (err: any) {
    logger.error('[Executor:send_email] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeSendSlack: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const depOutputs = gatherDependencyOutputs(subtask, memory);
    let { channel, message, threadTs } = subtask.inputs;

    if (!message && depOutputs) {
      const lastOutput = Object.values(depOutputs).pop();
      if (typeof lastOutput === 'string') {
        message = lastOutput;
      } else if (lastOutput?.response) {
        message = lastOutput.response;
      }
    }

    if (!channel || !message) {
      return makeResult(subtask.id, 'failed', null, start, 'Missing required Slack fields (channel, message)');
    }

    await SlackService.restoreFromStore();
    const conn = SlackService.getConnection();
    if (conn.status !== 'connected') {
      return makeResult(subtask.id, 'failed', null, start, 'Slack not connected');
    }

    const success = await SlackService.sendReply(channel, message, threadTs);
    return makeResult(subtask.id, success ? 'completed' : 'failed', { sent: success }, start);
  } catch (err: any) {
    logger.error('[Executor:send_slack] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeHTTP: SubtaskExecutor = async (subtask, _memory) => {
  const start = Date.now();
  try {
    const { url, method = 'GET', headers = {}, body } = subtask.inputs;

    if (!url) {
      return makeResult(subtask.id, 'failed', null, start, 'Missing URL for HTTP request');
    }

    const fetchOpts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOpts);
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return makeResult(subtask.id, response.ok ? 'completed' : 'failed', {
      status: response.status,
      data,
    }, start, response.ok ? undefined : `HTTP ${response.status}`);
  } catch (err: any) {
    logger.error('[Executor:http_request] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeCode: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const code = subtask.inputs.code || '';
    const depOutputs = gatherDependencyOutputs(subtask, memory);

    const fn = new Function('inputs', 'dependencies', `
      "use strict";
      ${code}
    `);
    const result = fn(subtask.inputs, depOutputs);

    return makeResult(subtask.id, 'completed', result, start);
  } catch (err: any) {
    logger.error('[Executor:code_execute] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executeExtract: SubtaskExecutor = async (subtask, memory) => {
  const start = Date.now();
  try {
    const depOutputs = gatherDependencyOutputs(subtask, memory);
    const text = subtask.inputs.text || JSON.stringify(depOutputs);
    const schema = subtask.inputs.schema || subtask.description;

    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a data extraction assistant. Extract structured data from the provided text according to the schema. Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `SCHEMA/INSTRUCTIONS: ${schema}\n\nTEXT TO EXTRACT FROM:\n${text}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content || '';
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { extracted: content };
    }

    return makeResult(subtask.id, 'completed', parsed, start);
  } catch (err: any) {
    logger.error('[Executor:extract_data] Failed', { error: err.message });
    return makeResult(subtask.id, 'failed', null, start, err.message);
  }
};

const executorRegistry: Record<SubtaskType, SubtaskExecutor> = {
  ai_reasoning: executeAIReasoning,
  web_browse: executeWebBrowse,
  web_search: executeWebSearch,
  send_email: executeSendEmail,
  send_slack: executeSendSlack,
  http_request: executeHTTP,
  code_execute: executeCode,
  extract_data: executeExtract,
};

export function getExecutor(type: SubtaskType): SubtaskExecutor {
  return executorRegistry[type] || executeAIReasoning;
}

export async function executeSubtask(subtask: Subtask, memory: ComputerMemory): Promise<SubtaskResult> {
  const executor = getExecutor(subtask.type);
  logger.info('[Executor] Running subtask', { id: subtask.id, type: subtask.type });
  return executor(subtask, memory);
}
