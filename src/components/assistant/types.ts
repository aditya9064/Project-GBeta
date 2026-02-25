export type AssistantStatus = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking' | 'error';

export interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  type: 'transcript' | 'action' | 'clarification' | 'error';
  text: string;
  timestamp: number;
  action?: {
    tool: string;
    args: Record<string, unknown>;
    result?: unknown;
    status: 'pending' | 'running' | 'success' | 'error';
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface ToolExecutor {
  (args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }>;
}

export interface AssistantTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}
