// Agent Context - Global state for deployed agents
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  DeployedAgent,
  WorkflowDefinition,
  ExecutionRecord,
  AgentStatus,
  deployAgent,
  getUserAgents,
  getAgent,
  updateAgentStatus,
  updateAgentWorkflow,
  deleteAgent as deleteAgentService,
  getAgentExecutions,
  ExecutionEngine
} from '../services/automation';

interface AgentContextType {
  agents: DeployedAgent[];
  loading: boolean;
  error: string | null;
  selectedAgent: DeployedAgent | null;
  executions: ExecutionRecord[];
  refreshAgents: () => Promise<void>;
  deployNewAgent: (name: string, description: string, workflow: WorkflowDefinition, icon?: string, color?: string) => Promise<DeployedAgent>;
  selectAgent: (agentId: string | null) => Promise<void>;
  pauseAgent: (agentId: string) => Promise<void>;
  resumeAgent: (agentId: string) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  updateAgent: (agentId: string, workflow: WorkflowDefinition, name?: string, description?: string) => Promise<void>;
  runAgent: (agentId: string, triggerData?: any) => Promise<{ success: boolean; output?: any; error?: string }>;
  getExecutionHistory: (agentId: string) => Promise<ExecutionRecord[]>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [agents, setAgents] = useState<DeployedAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);

  const refreshAgents = useCallback(async () => {
    if (!user) { setAgents([]); return; }
    setLoading(true);
    setError(null);
    try {
      const userAgents = await getUserAgents(user.uid);
      setAgents(userAgents);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshAgents(); }, [refreshAgents]);

  const deployNewAgent = useCallback(async (name: string, description: string, workflow: WorkflowDefinition, icon?: string, color?: string): Promise<DeployedAgent> => {
    if (!user) throw new Error('Must be logged in to deploy an agent');
    const agent = await deployAgent(user.uid, name, description, workflow, icon, color);
    setAgents(prev => [agent, ...prev]);
    return agent;
  }, [user]);

  const selectAgent = useCallback(async (agentId: string | null) => {
    if (!agentId) { setSelectedAgent(null); setExecutions([]); return; }
    const agent = await getAgent(agentId);
    setSelectedAgent(agent);
    if (agent) { const history = await getAgentExecutions(agentId); setExecutions(history); }
  }, []);

  const pauseAgent = useCallback(async (agentId: string) => {
    await updateAgentStatus(agentId, 'paused');
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'paused' as AgentStatus } : a));
    if (selectedAgent?.id === agentId) setSelectedAgent(prev => prev ? { ...prev, status: 'paused' } : null);
  }, [selectedAgent]);

  const resumeAgent = useCallback(async (agentId: string) => {
    await updateAgentStatus(agentId, 'active');
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'active' as AgentStatus } : a));
    if (selectedAgent?.id === agentId) setSelectedAgent(prev => prev ? { ...prev, status: 'active' } : null);
  }, [selectedAgent]);

  const deleteAgentHandler = useCallback(async (agentId: string) => {
    await deleteAgentService(agentId);
    setAgents(prev => prev.filter(a => a.id !== agentId));
    if (selectedAgent?.id === agentId) { setSelectedAgent(null); setExecutions([]); }
  }, [selectedAgent]);

  const updateAgentHandler = useCallback(async (agentId: string, workflow: WorkflowDefinition, name?: string, description?: string) => {
    await updateAgentWorkflow(agentId, workflow, name, description);
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, workflow, name: name || a.name, description: description || a.description, updatedAt: new Date() } : a));
    if (selectedAgent?.id === agentId) setSelectedAgent(prev => prev ? { ...prev, workflow, name: name || prev.name, description: description || prev.description, updatedAt: new Date() } : null);
  }, [selectedAgent]);

  const runAgent = useCallback(async (agentId: string, triggerData: any = {}): Promise<{ success: boolean; output?: any; error?: string }> => {
    if (!user) return { success: false, error: 'Must be logged in' };
    const agent = agents.find(a => a.id === agentId) || await getAgent(agentId);
    if (!agent) return { success: false, error: 'Agent not found' };
    if (agent.status !== 'active') return { success: false, error: 'Agent is not active' };
    const result = await ExecutionEngine.executeWorkflow(agentId, user.uid, agent.workflow, 'manual', triggerData);
    const history = await getAgentExecutions(agentId);
    setExecutions(history);
    await refreshAgents();
    return result;
  }, [user, agents, refreshAgents]);

  const getExecutionHistory = useCallback(async (agentId: string): Promise<ExecutionRecord[]> => getAgentExecutions(agentId), []);

  return (
    <AgentContext.Provider value={{ agents, loading, error, selectedAgent, executions, refreshAgents, deployNewAgent, selectAgent, pauseAgent, resumeAgent, deleteAgent: deleteAgentHandler, updateAgent: updateAgentHandler, runAgent, getExecutionHistory }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (context === undefined) throw new Error('useAgents must be used within an AgentProvider');
  return context;
}
