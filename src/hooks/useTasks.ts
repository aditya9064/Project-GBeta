import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Task status options
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// Task type for the app
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string | null;
  projectName: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  workspaceId: string;
}

// Firestore task type
interface FirestoreTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Timestamp | null;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string | null;
  projectName: string | null;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  workspaceId: string;
}

// Convert Firestore task to Task
const toTask = (firestoreTask: FirestoreTask): Task => ({
  id: firestoreTask.id,
  title: firestoreTask.title,
  description: firestoreTask.description || '',
  status: firestoreTask.status,
  priority: firestoreTask.priority,
  dueDate: firestoreTask.dueDate ? firestoreTask.dueDate.toDate() : null,
  assigneeId: firestoreTask.assigneeId,
  assigneeName: firestoreTask.assigneeName,
  projectId: firestoreTask.projectId,
  projectName: firestoreTask.projectName,
  tags: firestoreTask.tags || [],
  createdAt: firestoreTask.createdAt.toDate(),
  updatedAt: firestoreTask.updatedAt.toDate(),
  createdBy: firestoreTask.createdBy,
  workspaceId: firestoreTask.workspaceId,
});

export function useTasks(projectId?: string) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get the user's default workspace ID
  const workspaceId = user ? `${user.uid}-default` : null;

  // Subscribe to tasks
  useEffect(() => {
    if (!workspaceId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksRef = collection(db, 'tasks');
    
    // Build query - filter by workspace and optionally by project
    let q;
    if (projectId) {
      q = query(
        tasksRef,
        where('workspaceId', '==', workspaceId),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        tasksRef,
        where('workspaceId', '==', workspaceId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasksList: Task[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<FirestoreTask, 'id'>;
          tasksList.push(toTask({ id: doc.id, ...data }));
        });
        setTasks(tasksList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching tasks:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId, projectId]);

  // Add a new task
  const addTask = useCallback(
    async (taskData: {
      title: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      dueDate?: Date | null;
      projectId?: string | null;
      projectName?: string | null;
      tags?: string[];
    }) => {
      if (!user || !workspaceId) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const tasksRef = collection(db, 'tasks');
        
        const firestoreData = {
          workspaceId,
          title: taskData.title,
          description: taskData.description || null,
          status: taskData.status || 'todo',
          priority: taskData.priority || 'normal',
          dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : null,
          assigneeId: user.uid,
          assigneeName: user.displayName || user.email || 'Unknown',
          projectId: taskData.projectId || null,
          projectName: taskData.projectName || null,
          tags: taskData.tags || [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user.uid,
        };
        
        const docRef = await addDoc(tasksRef, firestoreData);
        return { id: docRef.id, error: null };
      } catch (err) {
        return { id: null, error: err as Error };
      }
    },
    [user, workspaceId]
  );

  // Update a task
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'workspaceId'>>) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const taskRef = doc(db, 'tasks', taskId);
        const updateData: { [key: string]: string | string[] | Timestamp | FieldValue | null } = {
          updatedAt: serverTimestamp(),
        };
        
        if (updates.title !== undefined) updateData.title = updates.title;
        if (updates.description !== undefined) updateData.description = updates.description || null;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.priority !== undefined) updateData.priority = updates.priority;
        if (updates.dueDate !== undefined) {
          updateData.dueDate = updates.dueDate ? Timestamp.fromDate(updates.dueDate) : null;
        }
        if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
        if (updates.assigneeName !== undefined) updateData.assigneeName = updates.assigneeName;
        if (updates.projectId !== undefined) updateData.projectId = updates.projectId;
        if (updates.projectName !== undefined) updateData.projectName = updates.projectName;
        if (updates.tags !== undefined) updateData.tags = updates.tags;

        await updateDoc(taskRef, updateData);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Delete a task
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskRef);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  // Get tasks grouped by status
  const getTasksByStatus = useCallback(() => {
    return {
      todo: tasks.filter(t => t.status === 'todo'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      review: tasks.filter(t => t.status === 'review'),
      done: tasks.filter(t => t.status === 'done'),
    };
  }, [tasks]);

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    getTasksByStatus,
  };
}

