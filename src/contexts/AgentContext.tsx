// Agent Context - Global state for deployed agents
// Automatically detects backend availability:
//   - Backend UP:   Real execution (Gmail API, Slack API, OpenAI, HTTP)
//   - Backend DOWN: Simulated execution (demo mode with mock responses)

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
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
} from '../services/automation';
import type { AutomationStatus, ExecutionLog } from '../services/automation';
import type { AgentRegistryEntry, AgentBusEvent } from '../services/automation/types';
import { ExecutionEngine } from '../services/automation/executionEngine';

// Demo user ID for local storage
const DEMO_USER_ID = 'demo-user-123';

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
  getExecutionHistory: async () => [],
  checkBackend: async () => {},
  getAgentMemory: async () => ({}),
  clearAgentMemory: async () => {},
  agentRegistry: [],
  busEvents: [],
  findAgentsByCapability: () => [],
  callAgent: async () => ({ success: false, error: 'AgentProvider not available' }),
};

const AgentContext = createContext<AgentContextType>(defaultAgentContext);

// Helper to load agents from localStorage
function loadAgentsFromStorage(): DeployedAgent[] {
  try {
    const stored = localStorage.getItem('demo_agents');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((a: any) => ({
        ...a,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
        deployedAt: a.deployedAt ? new Date(a.deployedAt) : undefined,
        lastExecutedAt: a.lastExecutedAt ? new Date(a.lastExecutedAt) : undefined,
      }));
    }
  } catch (e) {
    console.error('Error loading agents from storage:', e);
  }
  return [];
}

// Helper to save agents to localStorage
function saveAgentsToStorage(agents: DeployedAgent[]): void {
  try {
    localStorage.setItem('demo_agents', JSON.stringify(agents));
  } catch (e) {
    console.error('Error saving agents to storage:', e);
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
    console.error('Error loading execution history:', e);
  }
  return {};
}

function saveExecutionHistory(history: Record<string, ExecutionRecord[]>): void {
  try {
    localStorage.setItem('demo_executions', JSON.stringify(history));
  } catch (e) {
    console.error('Error saving execution history:', e);
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

  // Check backend status on mount
  const checkBackend = useCallback(async () => {
    try {
      const status = await checkAutomationBackend();
      setBackendStatus(status);
      if (status) {
        console.log('🟢 Automation backend is connected');
        console.log('   Gmail:', status.gmail.connected ? `✅ ${status.gmail.email}` : '❌ Not connected');
        console.log('   Slack:', status.slack.connected ? `✅ ${status.slack.workspace}` : '❌ Not connected');
        console.log('   AI:', status.ai.configured ? '✅ Configured' : '❌ Not configured');
      } else {
        console.log('🟡 Automation backend offline — running in demo mode');
      }
    } catch {
      console.log('🟡 Could not reach automation backend — running in demo mode');
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 60000);
    return () => clearInterval(interval);
  }, [checkBackend]);

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
      setAgents(loaded);
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
      userId: DEMO_USER_ID,
      name,
      description,
      icon: icon || 'Zap',
      color: color || '#8b5cf6',
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
    // Clean up execution history
    const history = loadExecutionHistory();
    delete history[agentId];
    saveExecutionHistory(history);
  }, [selectedAgent]);

  const updateAgentHandler = useCallback(async (
    agentId: string, 
    workflow: WorkflowDefinition, 
    name?: string, 
    description?: string
  ) => {
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
  }, [selectedAgent]);

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
      console.log(`\n🤖 Running agent: "${agent.name}"`);
      console.log(`   Backend: ${isBackendAvailable() ? '✅ REAL execution' : '⚠️ SIMULATED execution'}`);

      // Use the real execution engine
      const result = await ExecutionEngine.executeWorkflow(
        agentId,
        DEMO_USER_ID,
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
        }
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
        userId: DEMO_USER_ID,
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
      // Keep max 50 executions per agent
      if (history[agentId].length > 50) history[agentId] = history[agentId].slice(0, 50);
      saveExecutionHistory(history);

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
        DEMO_USER_ID,
        agent.workflow,
        'manual',
        triggerData,
      );
      return result;
    });
  }, [agents]);

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
      getExecutionHistory,
      checkBackend,
      getAgentMemory,
      clearAgentMemory: clearAgentMemoryHandler,
      agentRegistry,
      busEvents,
      findAgentsByCapability,
      callAgent: callAgentHandler,
    }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  return useContext(AgentContext);
}
