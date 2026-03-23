// Agent Context - Global state for deployed agents
// Automatically detects backend availability:
//   - Backend UP:   Real execution (Gmail API, Slack API, OpenAI, HTTP)
//   - Backend DOWN: Simulated execution (demo mode with mock responses)

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  DeployedAgent,
  WorkflowDefinition,
  ExecutionRecord,
  AgentStatus,
  ExecutionStatus,
  checkAutomationBackend,
  isBackendAvailable,
  AgentMemoryService,
  AgentBus,
  generateAgentFromPrompt,
  TriggerConfig,
  AIConfig,
} from '../services/automation';
import type { AutomationStatus, ExecutionLog } from '../services/automation';
import type { AIGeneratedAgent } from '../services/automation/planGenerator';
import type { AgentRegistryEntry, AgentBusEvent, Crew } from '../services/automation/types';
import { ExecutionEngine, activeExecutions } from '../services/automation/executionEngine';
import { CrewService, type Crew as CrewType } from '../services/workforce';
import { log } from '../utils/logger';
import { getAuthHeaders } from '../lib/firebase';
import { MetricsService } from '../services/workforce';
import { auth } from '../lib/firebase';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

function getCurrentUserId(): string {
  return auth.currentUser?.uid || '';
}

// ─── Version history types ────────────────────────────────
export interface AgentVersion {
  version: number;
  workflow: WorkflowDefinition;
  savedAt: string;
}

const MAX_VERSIONS_PER_AGENT = 10;

function loadVersionHistory(): Record<string, AgentVersion[]> {
  try {
    const raw = localStorage.getItem('agent_version_history');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVersionHistory(history: Record<string, AgentVersion[]>): void {
  try {
    localStorage.setItem('agent_version_history', JSON.stringify(history));
  } catch { /* ignore */ }
}

// ─── Schedule types ──────────────────────────────────────
interface AgentSchedule {
  frequency: string;
  time?: string;
  dayOfWeek?: number;
}

interface AgentContextType {
  agents: DeployedAgent[];
  loading: boolean;
  error: string | null;
  selectedAgent: DeployedAgent | null;
  executions: ExecutionRecord[];
  backendStatus: AutomationStatus | null;
  lastExecutionLogs: ExecutionLog[];
  refreshAgents: () => Promise<void>;
  deployNewAgent: (name: string, description: string, workflow: WorkflowDefinition, icon?: string, color?: string) => Promise<DeployedAgent>;
  selectAgent: (agentId: string | null) => Promise<void>;
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  updateAgent: (agentId: string, workflow: WorkflowDefinition, name?: string, description?: string) => Promise<void>;
  runAgent: (agentId: string, triggerData?: any) => Promise<{ success: boolean; output?: any; error?: string; logs?: ExecutionLog[] }>;
  cancelAgent: (agentId: string) => void;
  getExecutionHistory: (agentId: string) => Promise<ExecutionRecord[]>;
  checkBackend: () => Promise<void>;
  // Memory
  getAgentMemory: (agentId: string) => Promise<Record<string, any>>;
  clearAgentMemory: (agentId: string) => Promise<void>;
  // Inter-agent
  agentRegistry: AgentRegistryEntry[];
  busEvents: AgentBusEvent[];
  findAgentsByCapability: (capability: string) => AgentRegistryEntry[];
  callAgent: (sourceAgentId: string, targetAgentId: string, input: any) => Promise<{ success: boolean; output?: any; error?: string }>;
  // Scheduling
  scheduleAgent: (agentId: string, schedule: AgentSchedule) => void;
  getScheduleInfo: (agentId: string) => AgentSchedule | null;
  // Prompt-to-Agent
  createAgentFromPrompt: (prompt: string) => Promise<{ success: boolean; agent?: DeployedAgent; error?: string }>;
  // Clone
  cloneAgent: (agentId: string) => Promise<DeployedAgent>;
  // Sharing
  shareAgent: (agentId: string, emails: string[]) => Promise<void>;
  publishToMarketplace: (agentId: string) => Promise<any>;
  // Version history
  getAgentVersions: (agentId: string) => AgentVersion[];
  restoreAgentVersion: (agentId: string, version: number) => Promise<void>;
  // Crews
  crews: CrewType[];
  loadCrews: () => Promise<void>;
  getCrewForAgent: (agentId: string) => CrewType | null;
}

const defaultAgentContext: AgentContextType = {
  agents: [],
  loading: false,
  error: null,
  selectedAgent: null,
  executions: [],
  backendStatus: null,
  lastExecutionLogs: [],
  refreshAgents: async () => {},
  deployNewAgent: async () => { throw new Error('AgentProvider not available'); },
  selectAgent: async () => {},
  pauseAgent: async () => {},
  resumeAgent: async () => {},
  deleteAgent: async () => {},
  updateAgent: async () => {},
  runAgent: async () => ({ success: false, error: 'AgentProvider not available' }),
  cancelAgent: () => {},
  getExecutionHistory: async () => [],
  checkBackend: async () => {},
  getAgentMemory: async () => ({}),
  clearAgentMemory: async () => {},
  agentRegistry: [],
  busEvents: [],
  findAgentsByCapability: () => [],
  callAgent: async () => ({ success: false, error: 'AgentProvider not available' }),
  scheduleAgent: () => {},
  getScheduleInfo: () => null,
  createAgentFromPrompt: async () => ({ success: false, error: 'AgentProvider not available' }),
  cloneAgent: async () => { throw new Error('AgentProvider not available'); },
  shareAgent: async () => {},
  publishToMarketplace: async () => ({}),
  getAgentVersions: () => [],
  restoreAgentVersion: async () => {},
  crews: [],
  loadCrews: async () => {},
  getCrewForAgent: () => null,
};

const AgentContext = createContext<AgentContextType>(defaultAgentContext);

// ─── Backend API helpers with better error logging ───

async function apiPost(path: string, body: any): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      log.warn(`[API POST] ${path} failed:`, data.error || res.statusText);
    }
    return data;
  } catch (err) {
    // Silently handle connection errors - backend is optional for demo mode
    if (err instanceof TypeError && err.message.includes('fetch')) {
      // Connection error — expected when backend is offline
      return null;
    }
    log.warn(`[API POST] ${path} error:`, err instanceof Error ? err.message : 'Network error');
    return null;
  }
}

async function apiPut(path: string, body: any): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      log.warn(`[API PUT] ${path} failed:`, data.error || res.statusText);
    }
    return data;
  } catch (err) {
    // Silently handle connection errors - backend is optional for demo mode
    if (err instanceof TypeError && err.message.includes('fetch')) {
      // Connection error — expected when backend is offline
      return null;
    }
    log.warn(`[API PUT] ${path} error:`, err instanceof Error ? err.message : 'Network error');
    return null;
  }
}

async function apiDelete(path: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}${path}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok) {
      log.warn(`[API DELETE] ${path} failed:`, data.error || res.statusText);
    }
    return data;
  } catch (err) {
    // Silently handle connection errors - backend is optional for demo mode
    if (err instanceof TypeError && err.message.includes('fetch')) {
      // Connection error — expected when backend is offline
      return null;
    }
    log.warn(`[API DELETE] ${path} error:`, err instanceof Error ? err.message : 'Network error');
    return null;
  }
}

async function apiGet(path: string): Promise<any> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}${path}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      log.warn(`[API GET] ${path} failed:`, data.error || res.statusText);
    }
    return data;
  } catch (err) {
    log.warn(`[API GET] ${path} error:`, err instanceof Error ? err.message : 'Network error');
    return null;
  }
}

function serializeAgent(agent: DeployedAgent): any {
  return {
    ...agent,
    createdAt: agent.createdAt instanceof Date ? agent.createdAt.toISOString() : agent.createdAt,
    updatedAt: agent.updatedAt instanceof Date ? agent.updatedAt.toISOString() : agent.updatedAt,
    deployedAt: agent.deployedAt instanceof Date ? agent.deployedAt.toISOString() : agent.deployedAt,
    lastExecutedAt: agent.lastExecutedAt instanceof Date ? agent.lastExecutedAt.toISOString() : agent.lastExecutedAt,
  };
}

// ─── Schedule persistence ────────────────────────────────

function loadSchedules(): Record<string, AgentSchedule> {
  try {
    const raw = localStorage.getItem('agent_schedules');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSchedules(schedules: Record<string, AgentSchedule>): void {
  try {
    localStorage.setItem('agent_schedules', JSON.stringify(schedules));
  } catch { /* ignore */ }
}

function isAgentDue(schedule: AgentSchedule): boolean {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  switch (schedule.frequency) {
    case 'every_minute':
      return true;
    case 'hourly':
      return now.getMinutes() === 0;
    case 'daily':
      return schedule.time ? hhmm === schedule.time : now.getHours() === 0 && now.getMinutes() === 0;
    case 'weekly':
      return (
        now.getDay() === (schedule.dayOfWeek ?? 0) &&
        (schedule.time ? hhmm === schedule.time : now.getHours() === 0 && now.getMinutes() === 0)
      );
    default:
      return false;
  }
}

// Default agent that matches the Firebase deployment UI
const DEFAULT_AGENT: DeployedAgent = {
  id: 'default-email-classification',
  userId: 'demo-user-123',
  name: '(G) - Email Classification',
  description: 'Classifies incoming emails automatically',
  icon: '📧',
  color: '#e07a3a',
  workflow: {
    nodes: [
      { id: 'trigger-1', type: 'trigger', label: 'Email Received', config: { triggerType: 'email' }, position: { x: 400, y: 60 } },
      { id: 'ai-1', type: 'ai', label: 'Classify Email', config: { model: 'gpt-4', prompt: 'Classify this email' }, position: { x: 400, y: 200 } },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'ai-1' }
    ]
  },
  status: 'active' as AgentStatus,
  triggerType: 'email',
  totalExecutions: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
  version: 1,
};

// Helper to fix/migrate old agents that might be missing workflows
function fixAgentWorkflow(agent: any): DeployedAgent {
  // If agent already has a valid workflow, return it
  if (agent.workflow && 
      Array.isArray(agent.workflow.nodes) && 
      agent.workflow.nodes.length > 0 &&
      Array.isArray(agent.workflow.edges)) {
    return agent as DeployedAgent;
  }

  // Create a default workflow for agents that don't have one
  console.log(`⚠️ Fixing agent "${agent.name || agent.id}" - missing or invalid workflow`);
  
  const triggerId = 'trigger-1';
  const aiNodeId = 'ai-1';
  
  const defaultWorkflow: WorkflowDefinition = {
    nodes: [
      {
        id: triggerId,
        type: 'trigger',
        label: 'Manual Trigger',
        config: { triggerType: 'manual' } as TriggerConfig,
        position: { x: 100, y: 100 },
      },
      {
        id: aiNodeId,
        type: 'ai',
        label: agent.description || 'Process',
        config: {
          model: 'gpt-4' as const,
          prompt: agent.description || 'Process the input data',
        } as AIConfig,
        position: { x: 300, y: 100 },
      },
    ],
    edges: [
      { id: 'e1', source: triggerId, target: aiNodeId },
    ],
  };

  return {
    ...agent,
    workflow: defaultWorkflow,
    triggerType: agent.triggerType || 'manual',
    status: agent.status || 'active',
    totalExecutions: agent.totalExecutions || 0,
    successfulExecutions: agent.successfulExecutions || 0,
    failedExecutions: agent.failedExecutions || 0,
    createdAt: agent.createdAt instanceof Date ? agent.createdAt : new Date(agent.createdAt || Date.now()),
    updatedAt: agent.updatedAt instanceof Date ? agent.updatedAt : new Date(agent.updatedAt || Date.now()),
    deployedAt: agent.deployedAt ? (agent.deployedAt instanceof Date ? agent.deployedAt : new Date(agent.deployedAt)) : undefined,
    lastExecutedAt: agent.lastExecutedAt ? (agent.lastExecutedAt instanceof Date ? agent.lastExecutedAt : new Date(agent.lastExecutedAt)) : undefined,
  } as DeployedAgent;
}

// Helper to load agents from localStorage (DEMO_MODE only: fallback to defaults when backend unavailable)
function loadAgentsFromStorage(): DeployedAgent[] {
  try {
    const stored = localStorage.getItem('demo_agents');
    if (stored) {
      const parsed = JSON.parse(stored);
      const agents = parsed.map((a: any) => {
        // Convert dates
        const agentWithDates = {
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
          deployedAt: a.deployedAt ? new Date(a.deployedAt) : undefined,
          lastExecutedAt: a.lastExecutedAt ? new Date(a.lastExecutedAt) : undefined,
        };
        // Fix workflow if needed
        return fixAgentWorkflow(agentWithDates);
      });
      if (agents.length > 0) {
        // Save fixed agents back to storage
        saveAgentsToStorage(agents);
        return agents;
      }
    }
  } catch (e) {
    log.error('Error loading agents from storage:', e);
  }
  return DEMO_MODE ? [DEFAULT_AGENT] : [];
}

// Helper to save agents to localStorage
function saveAgentsToStorage(agents: DeployedAgent[]): void {
  try {
    localStorage.setItem('demo_agents', JSON.stringify(agents));
  } catch (e) {
    log.error('Error saving agents to storage:', e);
  }
}

// Helper to load execution history from localStorage
function loadExecutionHistory(): Record<string, ExecutionRecord[]> {
  try {
    const stored = localStorage.getItem('demo_executions');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    log.error('Error loading execution history:', e);
  }
  return {};
}

function saveExecutionHistory(history: Record<string, ExecutionRecord[]>): void {
  try {
    localStorage.setItem('demo_executions', JSON.stringify(history));
  } catch (e) {
    log.error('Error saving execution history:', e);
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<DeployedAgent[]>(() => loadAgentsFromStorage());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [backendStatus, setBackendStatus] = useState<AutomationStatus | null>(null);
  const [lastExecutionLogs, setLastExecutionLogs] = useState<ExecutionLog[]>([]);
  const [agentRegistry, setAgentRegistry] = useState<AgentRegistryEntry[]>([]);
  const [busEvents, setBusEvents] = useState<AgentBusEvent[]>([]);
  const scheduleLastRun = useRef<Record<string, number>>({});
  const [crews, setCrews] = useState<CrewType[]>([]);

  // Check backend status on mount
  const checkBackend = useCallback(async () => {
    try {
      const status = await checkAutomationBackend();
      setBackendStatus(status);
      if (status) {
        log.info('Automation backend is connected');
        log.info('Gmail:', status.gmail.connected ? status.gmail.email : 'Not connected');
        log.info('Slack:', status.slack.connected ? status.slack.workspace : 'Not connected');
        log.info('AI:', status.ai.configured ? 'Configured' : 'Not configured');
      } else {
        log.info('Automation backend offline — running in demo mode');
      }
    } catch {
      log.info('Could not reach automation backend — running in demo mode');
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 60000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  // ─── Initial load: merge backend agents into localStorage ──
  useEffect(() => {
    (async () => {
      const resp = await apiGet(`/api/agents?userId=${getCurrentUserId()}`);
      if (!resp?.success || !Array.isArray(resp.data)) return;
      const remote: DeployedAgent[] = resp.data.map((a: any) => {
        const agentWithDates = {
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
          deployedAt: a.deployedAt ? new Date(a.deployedAt) : undefined,
          lastExecutedAt: a.lastExecutedAt ? new Date(a.lastExecutedAt) : undefined,
        };
        // Fix workflow if needed
        return fixAgentWorkflow(agentWithDates);
      });
      if (remote.length === 0) return;

      setAgents((prev) => {
        const localIds = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const r of remote) {
          if (!localIds.has(r.id)) merged.push(r);
        }
        // Fix all agents before saving
        const fixedMerged = merged.map(a => fixAgentWorkflow(a));
        saveAgentsToStorage(fixedMerged);
        return fixedMerged;
      });
    })();
  }, []);

  // Sync AgentBus registry whenever agents list changes
  useEffect(() => {
    AgentBus.syncRegistry(agents);
    setAgentRegistry(AgentBus.listAgents());
  }, [agents]);

  // Subscribe to bus events for UI display
  useEffect(() => {
    const unsub = AgentBus.subscribe('*', (event) => {
      setBusEvents((prev) => [...prev.slice(-99), event]);
    });
    return unsub;
  }, []);

  const refreshAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = loadAgentsFromStorage();
      const resp = await apiGet(`/api/agents?userId=${getCurrentUserId()}`);
      if (resp?.success && Array.isArray(resp.data)) {
        const localIds = new Set(loaded.map((a) => a.id));
        const remote = resp.data
          .filter((a: any) => !localIds.has(a.id))
          .map((a: any) => {
            const agentWithDates = {
              ...a,
              createdAt: new Date(a.createdAt),
              updatedAt: new Date(a.updatedAt),
              deployedAt: a.deployedAt ? new Date(a.deployedAt) : undefined,
              lastExecutedAt: a.lastExecutedAt ? new Date(a.lastExecutedAt) : undefined,
            };
            return fixAgentWorkflow(agentWithDates);
          });
        const merged = [...loaded.map(a => fixAgentWorkflow(a)), ...remote];
        saveAgentsToStorage(merged);
        setAgents(merged);
        
        // Sync full agent definitions to backend for scheduler access
        // This ensures the backend has complete agent data including workflow, status, triggerType
        for (const agent of loaded) {
          apiPost('/api/agents', serializeAgent(agent)).catch(() => {});
        }
      } else {
        setAgents(loaded);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const deployNewAgent = useCallback(async (
    name: string, 
    description: string, 
    workflow: WorkflowDefinition, 
    icon?: string, 
    color?: string
  ): Promise<DeployedAgent> => {
    const now = new Date();
    const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
    const triggerType = triggerNode?.config ? (triggerNode.config as any).triggerType || 'manual' : 'manual';
    
    const hasMemoryNode = workflow.nodes.some((n) => n.type === 'memory');
    const capabilities: string[] = [];
    for (const node of workflow.nodes) {
      const cfg = node.config as any;
      if (node.type === 'app' && cfg.appType) capabilities.push(`app:${cfg.appType}`);
      if (node.type === 'ai') capabilities.push('ai:processing');
      if (node.type === 'memory') capabilities.push('memory:enabled');
    }

    const newAgent: DeployedAgent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: getCurrentUserId(),
      name,
      description,
      icon: icon || 'Zap',
      color: color || '#e07a3a',
      workflow,
      status: 'active',
      triggerType,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      createdAt: now,
      updatedAt: now,
      deployedAt: now,
      settings: {
        retryOnFailure: true,
        maxRetries: 3,
        notifyOnFailure: false,
        timeout: 300,
      },
      memoryEnabled: hasMemoryNode,
      capabilities,
    };

    setAgents(prev => {
      const updated = [newAgent, ...prev];
      saveAgentsToStorage(updated);
      return updated;
    });

    apiPost('/api/agents', serializeAgent(newAgent));

    return newAgent;
  }, []);

  const selectAgent = useCallback(async (agentId: string | null) => {
    if (!agentId) {
      setSelectedAgent(null);
      setExecutions([]);
      return;
    }
    const agent = agents.find(a => a.id === agentId) || null;
    setSelectedAgent(agent);
    
    // Load execution history
    const history = loadExecutionHistory();
    setExecutions(history[agentId] || []);
  }, [agents]);

  const pauseAgent = useCallback(async (agentId: string) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === agentId ? { ...a, status: 'paused' as AgentStatus, updatedAt: new Date() } : a
      );
      saveAgentsToStorage(updated);
      return updated;
    });
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => prev ? { ...prev, status: 'paused' } : null);
    }
    apiPut(`/api/agents/${agentId}`, { status: 'paused' });
  }, [selectedAgent]);

  const resumeAgent = useCallback(async (agentId: string) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === agentId ? { ...a, status: 'active' as AgentStatus, updatedAt: new Date() } : a
      );
      saveAgentsToStorage(updated);
      return updated;
    });
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => prev ? { ...prev, status: 'active' } : null);
    }
    apiPut(`/api/agents/${agentId}`, { status: 'active' });
  }, [selectedAgent]);

  const deleteAgentHandler = useCallback(async (agentId: string) => {
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== agentId);
      saveAgentsToStorage(updated);
      return updated;
    });
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(null);
      setExecutions([]);
    }
    const history = loadExecutionHistory();
    delete history[agentId];
    saveExecutionHistory(history);

    // Remove schedule
    const schedules = loadSchedules();
    delete schedules[agentId];
    saveSchedules(schedules);

    apiDelete(`/api/agents/${agentId}`);
  }, [selectedAgent]);

  const updateAgentHandler = useCallback(async (
    agentId: string, 
    workflow: WorkflowDefinition, 
    name?: string, 
    description?: string
  ) => {
    // Save current workflow state as a version before applying the update
    const currentAgent = agents.find(a => a.id === agentId);
    if (currentAgent) {
      const versionHistory = loadVersionHistory();
      const agentVersions = versionHistory[agentId] || [];
      const nextVersion = agentVersions.length > 0
        ? Math.max(...agentVersions.map(v => v.version)) + 1
        : 1;
      agentVersions.unshift({
        version: nextVersion,
        workflow: currentAgent.workflow,
        savedAt: new Date().toISOString(),
      });
      if (agentVersions.length > MAX_VERSIONS_PER_AGENT) {
        agentVersions.length = MAX_VERSIONS_PER_AGENT;
      }
      versionHistory[agentId] = agentVersions;
      saveVersionHistory(versionHistory);
    }

    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === agentId 
          ? { 
              ...a, 
              workflow, 
              name: name || a.name, 
              description: description || a.description, 
              updatedAt: new Date() 
            } 
          : a
      );
      saveAgentsToStorage(updated);
      return updated;
    });
    if (selectedAgent?.id === agentId) {
      setSelectedAgent(prev => 
        prev ? { ...prev, workflow, name: name || prev.name, description: description || prev.description, updatedAt: new Date() } : null
      );
    }
    apiPut(`/api/agents/${agentId}`, {
      workflow,
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
    });
  }, [selectedAgent, agents]);

  const cancelAgent = useCallback((agentId: string) => {
    const controller = activeExecutions.get(agentId);
    if (controller) {
      controller.abort();
      activeExecutions.delete(agentId);
    }
  }, []);

  const runAgent = useCallback(async (
    agentId: string, 
    triggerData: any = {}
  ): Promise<{ success: boolean; output?: any; error?: string; logs?: ExecutionLog[] }> => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.status !== 'active') return { success: false, error: 'Agent is not active' };

    setLoading(true);
    setError(null);

    try {
      log.info(`Running agent: "${agent.name}"`);
      log.info(`Backend: ${isBackendAvailable() ? 'REAL execution' : 'SIMULATED execution'}`);

      const controller = new AbortController();
      activeExecutions.set(agentId, controller);

      // Use the real execution engine
      const result = await ExecutionEngine.executeWorkflow(
        agentId,
        getCurrentUserId(),
        agent.workflow,
        'manual',
        triggerData,
        // onNodeUpdate callback — updates UI in real time
        (log: ExecutionLog) => {
          setLastExecutionLogs(prev => {
            const existing = prev.findIndex(l => l.nodeId === log.nodeId);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = log;
              return updated;
            }
            return [...prev, log];
          });
        },
        undefined,
        controller.signal,
      );

      // Update agent stats
      const execStatus: ExecutionStatus = result.success ? 'completed' : 'failed';
      setAgents(prev => {
        const updated = prev.map(a => 
          a.id === agentId 
            ? { 
                ...a, 
                totalExecutions: a.totalExecutions + 1,
                successfulExecutions: result.success ? a.successfulExecutions + 1 : a.successfulExecutions,
                failedExecutions: result.success ? a.failedExecutions : a.failedExecutions + 1,
                lastExecutedAt: new Date(),
                lastExecutionStatus: execStatus,
                updatedAt: new Date() 
              } 
            : a
        );
        saveAgentsToStorage(updated);
        return updated;
      });

      // Save execution record
      const executionRecord: ExecutionRecord = {
        id: `exec-${Date.now()}`,
        agentId,
        userId: getCurrentUserId(),
        status: execStatus,
        triggeredBy: 'manual',
        triggerData,
        startedAt: result.logs[0]?.startedAt || new Date(),
        completedAt: new Date(),
        duration: result.logs.reduce((sum, l) => sum + (l.duration || 0), 0),
        nodeExecutions: result.logs.map(l => ({
          nodeId: l.nodeId,
          nodeName: l.nodeName,
          nodeType: l.nodeType as any,
          status: l.status === 'completed' ? 'completed' : l.status === 'failed' ? 'failed' : 'running',
          startedAt: l.startedAt,
          completedAt: l.completedAt,
          duration: l.duration,
          input: l.input,
          output: l.output,
          error: l.error,
        })),
        output: result.output,
        error: result.error ? { nodeId: 'unknown', message: result.error } : undefined,
      };

      // Persist execution history
      const history = loadExecutionHistory();
      if (!history[agentId]) history[agentId] = [];
      history[agentId].unshift(executionRecord);
      if (history[agentId].length > 50) history[agentId] = history[agentId].slice(0, 50);
      saveExecutionHistory(history);

      // Persist execution log to backend (non-blocking, fails silently if backend is offline)
      apiPost(`/api/agents/${agentId}/logs`, {
        ...executionRecord,
        startedAt: executionRecord.startedAt instanceof Date ? executionRecord.startedAt.toISOString() : executionRecord.startedAt,
        completedAt: executionRecord.completedAt instanceof Date ? executionRecord.completedAt.toISOString() : executionRecord.completedAt,
      }).catch(() => {
        // Silently ignore - backend is optional for demo mode
      });

      // Record metrics
      MetricsService.recordExecution(
        agentId,
        agent.name,
        result.success,
        executionRecord.duration || 0,
        0
      );

      // Sync updated agent stats to backend (non-blocking, fails silently if backend is offline)
      const updatedAgent = agents.find((a) => a.id === agentId);
      if (updatedAgent) {
        apiPut(`/api/agents/${agentId}`, {
          totalExecutions: updatedAgent.totalExecutions + 1,
          successfulExecutions: result.success ? updatedAgent.successfulExecutions + 1 : updatedAgent.successfulExecutions,
          failedExecutions: result.success ? updatedAgent.failedExecutions : updatedAgent.failedExecutions + 1,
          lastExecutedAt: new Date().toISOString(),
          lastExecutionStatus: execStatus,
        }).catch(() => {
          // Silently ignore - backend is optional for demo mode
        });
      }

      return { 
        success: result.success, 
        output: result.output, 
        error: result.error,
        logs: result.logs,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to run agent');
      return { success: false, error: err.message || 'Failed to run agent' };
    } finally {
      activeExecutions.delete(agentId);
      setLoading(false);
    }
  }, [agents]);

  const getExecutionHistory = useCallback(async (agentId: string): Promise<ExecutionRecord[]> => {
    const history = loadExecutionHistory();
    return (history[agentId] || []).map(r => ({
      ...r,
      startedAt: new Date(r.startedAt),
      completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
    }));
  }, []);

  // ─── Memory helpers ──────────────────────────────────
  const getAgentMemory = useCallback(async (agentId: string) => {
    return AgentMemoryService.loadAgentMemory(agentId);
  }, []);

  const clearAgentMemoryHandler = useCallback(async (agentId: string) => {
    await AgentMemoryService.clearAgentMemory(agentId);
  }, []);

  // ─── Inter-agent helpers ─────────────────────────────
  const findAgentsByCapability = useCallback((capability: string) => {
    return AgentBus.findAgentsByCapability(capability);
  }, []);

  const callAgentHandler = useCallback(async (
    sourceAgentId: string,
    targetAgentId: string,
    input: any,
  ) => {
    const source = agents.find((a) => a.id === sourceAgentId);
    return AgentBus.callAgent(
      sourceAgentId,
      source?.name || sourceAgentId,
      targetAgentId,
      input,
    );
  }, [agents]);

  // Register the runAgent callback with AgentBus so agents can invoke each other
  useEffect(() => {
    AgentBus.setAgentRunner(async (agentId: string, triggerData: any) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) throw new Error(`Agent ${agentId} not found`);
      if (agent.status !== 'active') throw new Error(`Agent ${agent.name} is ${agent.status}`);

      const result = await ExecutionEngine.executeWorkflow(
        agentId,
        getCurrentUserId(),
        agent.workflow,
        'manual',
        triggerData,
      );
      return result;
    });
  }, [agents]);

  // ─── Prompt-to-Agent ──────────────────────────────────────

  const createAgentFromPrompt = useCallback(async (prompt: string): Promise<{ success: boolean; agent?: DeployedAgent; error?: string }> => {
    try {
      const result: AIGeneratedAgent = await generateAgentFromPrompt(prompt);

      if (!result.success || !result.workflow?.nodes?.length) {
        return { success: false, error: result.error || 'Failed to generate workflow from prompt' };
      }

      const agent = await deployNewAgent(
        result.name,
        result.description,
        result.workflow,
        'Sparkles',
        '#e07a3a',
      );

      return { success: true, agent };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create agent from prompt' };
    }
  }, [deployNewAgent]);

  // ─── Clone agent ────────────────────────────────────────

  const cloneAgent = useCallback(async (agentId: string): Promise<DeployedAgent> => {
    const source = agents.find(a => a.id === agentId);
    if (!source) throw new Error('Agent not found');

    const clonedName = source.name.endsWith('(Copy)')
      ? source.name
      : `${source.name} (Copy)`;

    return deployNewAgent(
      clonedName,
      source.description,
      JSON.parse(JSON.stringify(source.workflow)),
      source.icon,
      source.color,
    );
  }, [agents, deployNewAgent]);

  // ─── Sharing ──────────────────────────────────────────

  const shareAgent = useCallback(async (agentId: string, emails: string[]) => {
    const stored = JSON.parse(localStorage.getItem('crewos-shared-agents') || '{}');
    stored[agentId] = { emails, sharedAt: new Date().toISOString() };
    localStorage.setItem('crewos-shared-agents', JSON.stringify(stored));
  }, []);

  const publishToMarketplace = useCallback(async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) throw new Error('Agent not found');
    const resp = await apiPost('/api/templates', {
      name: agent.name,
      description: agent.description || '',
      workflow: agent.workflow,
      category: 'community',
      author: getCurrentUserId(),
    });
    return resp;
  }, [agents]);

  // ─── Version history ───────────────────────────────────

  const getAgentVersions = useCallback((agentId: string): AgentVersion[] => {
    const history = loadVersionHistory();
    return history[agentId] || [];
  }, []);

  const restoreAgentVersion = useCallback(async (agentId: string, version: number) => {
    const history = loadVersionHistory();
    const agentVersions = history[agentId];
    if (!agentVersions) throw new Error('No version history for this agent');

    const target = agentVersions.find(v => v.version === version);
    if (!target) throw new Error(`Version ${version} not found`);

    await updateAgentHandler(agentId, target.workflow);
  }, [updateAgentHandler]);

  // ─── Scheduling ──────────────────────────────────────────

  const scheduleAgentFn = useCallback((agentId: string, schedule: AgentSchedule) => {
    const schedules = loadSchedules();
    schedules[agentId] = schedule;
    saveSchedules(schedules);
  }, []);

  const getScheduleInfoFn = useCallback((agentId: string): AgentSchedule | null => {
    const schedules = loadSchedules();
    return schedules[agentId] || null;
  }, []);

  // ─── Crews ────────────────────────────────────────────────

  const loadCrews = useCallback(async () => {
    try {
      const loadedCrews = await CrewService.list();
      setCrews(loadedCrews);
    } catch (err) {
      log.warn('Failed to load crews:', err);
    }
  }, []);

  const getCrewForAgent = useCallback((agentId: string): CrewType | null => {
    return crews.find(c => c.members.some(m => m.agentId === agentId)) || null;
  }, [crews]);

  // Load crews on mount
  useEffect(() => {
    loadCrews();
  }, [loadCrews]);

  // Poll every 60 s to check if any scheduled agent is due
  useEffect(() => {
    const interval = setInterval(() => {
      const schedules = loadSchedules();
      const now = Date.now();
      for (const [agentId, schedule] of Object.entries(schedules)) {
        const agent = agents.find((a) => a.id === agentId);
        if (!agent || agent.status !== 'active') continue;
        if (!isAgentDue(schedule)) continue;

        const lastRun = scheduleLastRun.current[agentId] || 0;
        if (now - lastRun < 59_000) continue; // debounce within same minute
        scheduleLastRun.current[agentId] = now;
        log.info(`Scheduled run for "${agent.name}"`);
        runAgent(agentId, { triggeredBy: 'schedule' });
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [agents, runAgent]);

  return (
    <AgentContext.Provider value={{ 
      agents, 
      loading, 
      error, 
      selectedAgent, 
      executions,
      backendStatus,
      lastExecutionLogs,
      refreshAgents, 
      deployNewAgent, 
      selectAgent, 
      pauseAgent, 
      resumeAgent, 
      deleteAgent: deleteAgentHandler, 
      updateAgent: updateAgentHandler, 
      runAgent,
      cancelAgent,
      getExecutionHistory,
      checkBackend,
      getAgentMemory,
      clearAgentMemory: clearAgentMemoryHandler,
      agentRegistry,
      busEvents,
      findAgentsByCapability,
      callAgent: callAgentHandler,
      scheduleAgent: scheduleAgentFn,
      getScheduleInfo: getScheduleInfoFn,
      createAgentFromPrompt,
      cloneAgent,
      shareAgent,
      publishToMarketplace,
      getAgentVersions,
      restoreAgentVersion,
      crews,
      loadCrews,
      getCrewForAgent,
    }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  return useContext(AgentContext);
}
