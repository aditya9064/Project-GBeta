// Automation Agent Types - Inspired by n8n and Zapier

export type NodeType = 'trigger' | 'action' | 'app' | 'knowledge' | 'condition' | 'ai' | 'filter' | 'delay';

export type AgentStatus = 'draft' | 'active' | 'paused' | 'error' | 'archived';

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TriggerType = 
  | 'webhook' 
  | 'schedule' 
  | 'email' 
  | 'form' 
  | 'manual'
  | 'app_event';

export type AppType = 
  | 'gmail' 
  | 'slack' 
  | 'notion' 
  | 'calendar' 
  | 'salesforce' 
  | 'hubspot' 
  | 'shopify' 
  | 'stripe' 
  | 'github' 
  | 'zendesk'
  | 'webhook'
  | 'http';

export type ActionType =
  | 'send_email'
  | 'send_message'
  | 'create_record'
  | 'update_record'
  | 'delete_record'
  | 'ai_process'
  | 'http_request'
  | 'transform_data'
  | 'filter'
  | 'delay'
  | 'notify';

// Node configuration for different types
export interface TriggerConfig {
  triggerType: TriggerType;
  // Webhook
  webhookUrl?: string;
  webhookSecret?: string;
  // Schedule
  schedule?: {
    frequency: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';
    cronExpression?: string;
    timezone?: string;
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  // Email
  emailFilter?: {
    from?: string;
    subject?: string;
    hasAttachment?: boolean;
  };
}

export interface AppConfig {
  appType: AppType;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    webhookUrl?: string;
  };
  // Gmail
  gmail?: {
    action: 'read' | 'send' | 'reply' | 'label' | 'archive';
    to?: string;
    subject?: string;
    body?: string;
    label?: string;
  };
  // Slack
  slack?: {
    action: 'send_message' | 'create_channel' | 'upload_file';
    channel?: string;
    message?: string;
  };
  // Notion
  notion?: {
    action: 'create_page' | 'update_page' | 'query_database' | 'create_database';
    databaseId?: string;
    pageId?: string;
    properties?: Record<string, any>;
  };
  // HTTP
  http?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface AIConfig {
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'claude-2';
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  outputFormat?: 'text' | 'json' | 'structured';
  outputSchema?: Record<string, any>;
}

export interface KnowledgeConfig {
  knowledgeBaseId: string;
  action: 'query' | 'add' | 'update' | 'delete';
  query?: string;
  data?: any;
}

export interface FilterConfig {
  conditions: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
    value: any;
  }[];
  logic: 'and' | 'or';
}

export interface DelayConfig {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}

// Workflow Node
export interface WorkflowNodeData {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  icon?: string;
  config: TriggerConfig | AppConfig | AIConfig | KnowledgeConfig | FilterConfig | DelayConfig | Record<string, any>;
  position: { x: number; y: number };
  // Input/Output mapping
  inputMapping?: Record<string, string>; // Maps input data fields to node inputs
  outputMapping?: Record<string, string>; // Maps node outputs to named fields
}

// Workflow Edge (connection between nodes)
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  condition?: FilterConfig; // For conditional edges
}

// Complete Workflow Definition
export interface WorkflowDefinition {
  nodes: WorkflowNodeData[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>; // Global workflow variables
}

// Deployed Agent
export interface DeployedAgent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  workflow: WorkflowDefinition;
  status: AgentStatus;
  
  // Trigger info
  triggerType: TriggerType;
  webhookUrl?: string;
  schedule?: TriggerConfig['schedule'];
  
  // Stats
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutedAt?: Date;
  lastExecutionStatus?: ExecutionStatus;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  deployedAt?: Date;
  pausedAt?: Date;
  
  // Settings
  settings: {
    retryOnFailure: boolean;
    maxRetries: number;
    notifyOnFailure: boolean;
    notifyEmail?: string;
    timeout: number; // in seconds
  };
}

// Execution Record
export interface ExecutionRecord {
  id: string;
  agentId: string;
  userId: string;
  status: ExecutionStatus;
  
  // Trigger info
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'event';
  triggerData?: any;
  
  // Execution details
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
  
  // Node execution logs
  nodeExecutions: NodeExecution[];
  
  // Results
  output?: any;
  error?: {
    nodeId: string;
    message: string;
    stack?: string;
  };
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  nodeType: NodeType;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
}

// Execution Context - passed through workflow
export interface ExecutionContext {
  executionId: string;
  agentId: string;
  userId: string;
  trigger: {
    type: TriggerType;
    data: any;
  };
  variables: Record<string, any>;
  nodeOutputs: Record<string, any>; // Map of nodeId -> output
  currentNodeId?: string;
}

// App Credentials
export interface AppCredential {
  id: string;
  userId: string;
  appType: AppType;
  name: string;
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    expiresAt?: Date;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook
export interface Webhook {
  id: string;
  agentId: string;
  userId: string;
  url: string;
  secret: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

