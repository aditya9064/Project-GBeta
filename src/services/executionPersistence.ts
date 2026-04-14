/* ═══════════════════════════════════════════════════════════
   Execution Persistence — Firestore state persistence for
   swarm executions, tasks, and artifacts.

   Writes execution state on key transitions (start, complete,
   fail, cancel) so sessions survive page reloads and can be
   reviewed after completion.
   ═══════════════════════════════════════════════════════════ */

import {
  doc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/firebase';

interface ExecutionDoc {
  id: string;
  goal: string;
  status: string;
  ownerId: string;
  startedAt: string;
  completedAt: string | null;
  result: string | null;
  error: string | null;
  taskCount: number;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

interface TaskDoc {
  id: string;
  title: string;
  description: string;
  status: string;
  taskType: string;
  assignedTo: string | null;
  dependencies: string[];
  result: string | null;
  priority: number;
  failureReason: string | null;
  retryCount: number;
}

function getOwnerId(): string | null {
  return auth.currentUser?.uid || null;
}

export async function persistExecution(execution: {
  swarmId: string;
  goal: string;
  status: string;
  startedAt: string;
  result?: string | null;
  error?: string | null;
  tasks?: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    taskType?: string;
    assignedTo?: string | null;
    dependencies?: string[];
    result?: string | null;
    priority?: number;
    failureReason?: string | null;
    retryCount?: number;
  }>;
}): Promise<void> {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  try {
    const execRef = doc(db, 'executions', execution.swarmId);
    const execDoc: ExecutionDoc = {
      id: execution.swarmId,
      goal: execution.goal,
      status: execution.status,
      ownerId,
      startedAt: execution.startedAt,
      completedAt: null,
      result: execution.result || null,
      error: execution.error || null,
      taskCount: execution.tasks?.length || 0,
      updatedAt: serverTimestamp(),
    };

    await setDoc(execRef, execDoc, { merge: true });

    if (execution.tasks && execution.tasks.length > 0) {
      const batch = writeBatch(db);
      for (const task of execution.tasks) {
        const taskRef = doc(db, 'executions', execution.swarmId, 'tasks', task.id);
        batch.set(taskRef, {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          taskType: task.taskType || 'general',
          assignedTo: task.assignedTo || null,
          dependencies: task.dependencies || [],
          result: task.result || null,
          priority: task.priority || 0,
          failureReason: task.failureReason || null,
          retryCount: task.retryCount || 0,
        } as TaskDoc, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('[ExecutionPersistence] Failed to persist:', err);
  }
}

export async function updateExecutionStatus(
  swarmId: string,
  status: string,
  extra?: { result?: string; error?: string; completedAt?: string },
): Promise<void> {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  try {
    const execRef = doc(db, 'executions', swarmId);
    await updateDoc(execRef, {
      status,
      updatedAt: serverTimestamp(),
      ...extra,
    });
  } catch (err) {
    console.warn('[ExecutionPersistence] Failed to update status:', err);
  }
}

export async function updateTaskStatus(
  swarmId: string,
  taskId: string,
  status: string,
  extra?: { result?: string; failureReason?: string },
): Promise<void> {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  try {
    const taskRef = doc(db, 'executions', swarmId, 'tasks', taskId);
    await updateDoc(taskRef, {
      status,
      ...extra,
    });
  } catch (err) {
    console.warn('[ExecutionPersistence] Failed to update task:', err);
  }
}

export async function loadRecentExecutions(maxResults = 20): Promise<ExecutionDoc[]> {
  const ownerId = getOwnerId();
  if (!ownerId) return [];

  try {
    const q = query(
      collection(db, 'executions'),
      where('ownerId', '==', ownerId),
      orderBy('updatedAt', 'desc'),
      limit(maxResults),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as ExecutionDoc);
  } catch (err) {
    console.warn('[ExecutionPersistence] Failed to load:', err);
    return [];
  }
}

export async function persistExecutionLog(
  swarmId: string,
  log: { level: string; message: string; component?: string; metadata?: Record<string, any> },
): Promise<void> {
  const ownerId = getOwnerId();
  if (!ownerId) return;

  try {
    const logRef = doc(collection(db, 'executions', swarmId, 'logs'));
    await setDoc(logRef, {
      ...log,
      timestamp: serverTimestamp(),
    });
  } catch {
    // best-effort
  }
}
