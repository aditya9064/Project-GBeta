// Agent Service - Manages deployed agents in Firestore
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  DeployedAgent, 
  AgentStatus, 
  WorkflowDefinition, 
  TriggerType,
  ExecutionRecord,
  ExecutionStatus,
  NodeExecution
} from './types';

const AGENTS_COLLECTION = 'agents';
const EXECUTIONS_COLLECTION = 'executions';

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Generate webhook URL
function generateWebhookUrl(agentId: string): string {
  // In production, this would be your actual API endpoint
  // For demo, we'll use a simulated webhook URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/api/webhook/${agentId}`;
}

// Generate webhook secret
function generateWebhookSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Firestore timestamps to dates
function convertTimestamps(data: any): any {
  if (!data) return data;
  const result = { ...data };
  
  const timestampFields = ['createdAt', 'updatedAt', 'deployedAt', 'pausedAt', 'lastExecutedAt', 'startedAt', 'completedAt'];
  
  for (const field of timestampFields) {
    if (result[field] && result[field].toDate) {
      result[field] = result[field].toDate();
    }
  }
  
  return result;
}

// Deploy a new agent
export async function deployAgent(
  userId: string,
  name: string,
  description: string,
  workflow: WorkflowDefinition,
  icon?: string,
  color?: string
): Promise<DeployedAgent> {
  const agentId = generateId();
  
  // Determine trigger type from workflow
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
  const triggerType: TriggerType = (triggerNode?.config as any)?.triggerType || 'manual';
  
  const agent: DeployedAgent = {
    id: agentId,
    userId,
    name,
    description,
    icon,
    color,
    workflow,
    status: 'active',
    triggerType,
    webhookUrl: triggerType === 'webhook' ? generateWebhookUrl(agentId) : undefined,
    schedule: triggerType === 'schedule' ? (triggerNode?.config as any)?.schedule : undefined,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deployedAt: new Date(),
    settings: {
      retryOnFailure: true,
      maxRetries: 3,
      notifyOnFailure: false,
      timeout: 300 // 5 minutes default
    }
  };

  // Save to Firestore
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await setDoc(docRef, {
    ...agent,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deployedAt: serverTimestamp()
  });

  return agent;
}

// Get all agents for a user
export async function getUserAgents(userId: string): Promise<DeployedAgent[]> {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => convertTimestamps(doc.data()) as DeployedAgent);
}

// Get a specific agent
export async function getAgent(agentId: string): Promise<DeployedAgent | null> {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return convertTimestamps(snapshot.data()) as DeployedAgent;
}

// Update agent status
export async function updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  const updates: any = {
    status,
    updatedAt: serverTimestamp()
  };
  
  if (status === 'paused') {
    updates.pausedAt = serverTimestamp();
  } else if (status === 'active') {
    updates.pausedAt = null;
  }
  
  await updateDoc(docRef, updates);
}

// Update agent workflow
export async function updateAgentWorkflow(
  agentId: string, 
  workflow: WorkflowDefinition,
  name?: string,
  description?: string
): Promise<void> {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  const updates: any = {
    workflow,
    updatedAt: serverTimestamp()
  };
  
  if (name) updates.name = name;
  if (description) updates.description = description;
  
  // Re-detect trigger type
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
  if (triggerNode) {
    updates.triggerType = (triggerNode.config as any)?.triggerType || 'manual';
  }
  
  await updateDoc(docRef, updates);
}

// Delete agent
export async function deleteAgent(agentId: string): Promise<void> {
  const docRef = doc(db, AGENTS_COLLECTION, agentId);
  await deleteDoc(docRef);
}

// Record execution start
export async function startExecution(
  agentId: string,
  userId: string,
  triggeredBy: 'manual' | 'webhook' | 'schedule' | 'event',
  triggerData?: any
): Promise<ExecutionRecord> {
  const executionId = generateId();
  
  const execution: ExecutionRecord = {
    id: executionId,
    agentId,
    userId,
    status: 'running',
    triggeredBy,
    triggerData,
    startedAt: new Date(),
    nodeExecutions: []
  };

  const docRef = doc(db, EXECUTIONS_COLLECTION, executionId);
  await setDoc(docRef, {
    ...execution,
    startedAt: serverTimestamp()
  });

  // Update agent stats
  const agentRef = doc(db, AGENTS_COLLECTION, agentId);
  await updateDoc(agentRef, {
    totalExecutions: (await getDoc(agentRef)).data()?.totalExecutions + 1 || 1,
    lastExecutedAt: serverTimestamp(),
    lastExecutionStatus: 'running'
  });

  return execution;
}

// Update execution with node result
export async function updateExecutionNode(
  executionId: string,
  nodeExecution: NodeExecution
): Promise<void> {
  const docRef = doc(db, EXECUTIONS_COLLECTION, executionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return;
  
  const data = snapshot.data();
  const nodeExecutions = data.nodeExecutions || [];
  nodeExecutions.push(nodeExecution);
  
  await updateDoc(docRef, { nodeExecutions });
}

// Complete execution
export async function completeExecution(
  executionId: string,
  status: ExecutionStatus,
  output?: any,
  error?: { nodeId: string; message: string; stack?: string }
): Promise<void> {
  const docRef = doc(db, EXECUTIONS_COLLECTION, executionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return;
  
  const data = snapshot.data();
  const startedAt = data.startedAt?.toDate?.() || new Date();
  const completedAt = new Date();
  const duration = completedAt.getTime() - startedAt.getTime();

  await updateDoc(docRef, {
    status,
    completedAt: serverTimestamp(),
    duration,
    output,
    error
  });

  // Update agent stats
  const agentRef = doc(db, AGENTS_COLLECTION, data.agentId);
  const agentSnapshot = await getDoc(agentRef);
  
  if (agentSnapshot.exists()) {
    const agentData = agentSnapshot.data();
    const updates: any = {
      lastExecutionStatus: status
    };
    
    if (status === 'completed') {
      updates.successfulExecutions = (agentData.successfulExecutions || 0) + 1;
    } else if (status === 'failed') {
      updates.failedExecutions = (agentData.failedExecutions || 0) + 1;
    }
    
    await updateDoc(agentRef, updates);
  }
}

// Get execution history for an agent
export async function getAgentExecutions(
  agentId: string, 
  limit: number = 20
): Promise<ExecutionRecord[]> {
  const q = query(
    collection(db, EXECUTIONS_COLLECTION),
    where('agentId', '==', agentId),
    orderBy('startedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .slice(0, limit)
    .map(doc => convertTimestamps(doc.data()) as ExecutionRecord);
}

// Get a specific execution
export async function getExecution(executionId: string): Promise<ExecutionRecord | null> {
  const docRef = doc(db, EXECUTIONS_COLLECTION, executionId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return convertTimestamps(snapshot.data()) as ExecutionRecord;
}

