import { useState, useCallback, useEffect } from 'react';
import { auth } from '../lib/firebase';

export interface AppNotification {
  id: string;
  type: 'agent_failure' | 'agent_success' | 'message' | 'escalation' | 'task_due' | 'info';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = 'crewos-notifications';

function loadNotifications(): AppNotification[] {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const saved = localStorage.getItem(`${STORAGE_KEY}-${uid}`);
    if (!saved) return [];
    return JSON.parse(saved).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
  } catch { return []; }
}

function saveNotifications(notifications: AppNotification[]) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    localStorage.setItem(`${STORAGE_KEY}-${uid}`, JSON.stringify(notifications));
  } catch {}
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev].slice(0, 50);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll };
}
