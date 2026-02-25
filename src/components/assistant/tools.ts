import type { AssistantTool, ToolDefinition } from './types';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'navigate_to_page',
    description: 'Navigate to a page or section within the OperonAI app. Use this when the user wants to go somewhere.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description: 'The page to navigate to',
          enum: ['agents', 'workflow', 'comms', 'docai', 'sales', 'logs', 'settings'],
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'deploy_agent',
    description: 'Deploy an AI agent from the catalog by name. If the user does not specify which agent, ask for clarification.',
    parameters: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'The name or partial name of the agent to deploy (e.g. "invoice generator", "email response")',
        },
        version: {
          type: 'string',
          description: 'The version to deploy (e.g. "v2.0"). Defaults to latest.',
        },
      },
      required: ['agent_name'],
    },
  },
  {
    name: 'search_agents',
    description: 'Search for deployed agents or catalog agents by name, category, or status.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for finding agents',
        },
        status_filter: {
          type: 'string',
          description: 'Filter by agent status',
          enum: ['running', 'idle', 'error', 'all'],
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_emails',
    description: 'Read recent emails or messages. Returns a summary of the latest messages.',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'How many messages to read. Defaults to 5.',
          default: 5,
        },
        from_filter: {
          type: 'string',
          description: 'Filter messages from a specific person or email address',
        },
        channel: {
          type: 'string',
          description: 'Filter by channel type',
          enum: ['email', 'slack', 'teams'],
        },
      },
    },
  },
  {
    name: 'reply_to_email',
    description: 'Reply to a specific email or message. The assistant will generate and send a reply.',
    parameters: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The ID of the message to reply to',
        },
        reply_text: {
          type: 'string',
          description: 'The text of the reply to send',
        },
      },
      required: ['message_id', 'reply_text'],
    },
  },
  {
    name: 'run_agent',
    description: 'Run/execute a deployed agent by name or ID.',
    parameters: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description: 'The name or ID of the deployed agent to run',
        },
      },
      required: ['agent_name'],
    },
  },
  {
    name: 'ask_clarification',
    description: 'Ask the user a clarifying question when the request is ambiguous, parameters are missing, or the action is destructive.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The clarifying question to ask the user',
        },
        options: {
          type: 'array',
          description: 'Optional list of choices to present',
          items: { type: 'string' },
        },
      },
      required: ['question'],
    },
  },
];

export function buildToolsForSession(): Array<{
  type: 'function';
  name: string;
  description: string;
  parameters: ToolDefinition['parameters'];
}> {
  return toolDefinitions.map((t) => ({
    type: 'function' as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
