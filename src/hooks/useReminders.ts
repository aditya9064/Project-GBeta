import { useEffect, useRef, useCallback } from 'react';
import { CalendarEvent } from '../types/calendar';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show a notification
export function showNotification(options: NotificationOptions): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag,
      requireInteraction: options.requireInteraction
    });

    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

// Format time difference for display
function formatTimeDiff(minutes: number): string {
  if (minutes === 0) return 'now';
  if (minutes === 1) return 'in 1 minute';
  if (minutes < 60) return `in ${minutes} minutes`;
  if (minutes === 60) return 'in 1 hour';
  if (minutes < 1440) return `in ${Math.floor(minutes / 60)} hours`;
  if (minutes === 1440) return 'tomorrow';
  return `in ${Math.floor(minutes / 1440)} days`;
}

export function useReminders(events: CalendarEvent[]) {
  const notifiedReminders = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for upcoming reminders
  const checkReminders = useCallback(() => {
    const now = new Date().getTime();

    events.forEach(event => {
      if (event.status === 'completed' || event.status === 'canceled') return;

      event.reminders.forEach(reminder => {
        if (reminder.sent) return;
        
        const reminderKey = `${event.id}-${reminder.id}`;
        if (notifiedReminders.current.has(reminderKey)) return;

        const reminderTime = new Date(reminder.time).getTime();
        const timeDiff = reminderTime - now;

        // Trigger if reminder time is within the next minute
        if (timeDiff <= 60000 && timeDiff > -60000) {
          notifiedReminders.current.add(reminderKey);

          const eventTime = new Date(event.startTime);
          const minutesUntilEvent = Math.round((eventTime.getTime() - now) / 60000);
          const timeDescription = formatTimeDiff(minutesUntilEvent);

          // Show notification based on type
          if (reminder.type === 'in-app' || reminder.type === 'push') {
            showNotification({
              title: event.title,
              body: event.isAllDay 
                ? `All-day event ${timeDescription}`
                : `Starts ${timeDescription} at ${eventTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
              tag: reminderKey,
              requireInteraction: true
            });
          }

          // For email type, we would integrate with a backend service
          // For now, we just log it
          if (reminder.type === 'email') {
            console.log(`[Email Reminder] ${event.title} starts ${timeDescription}`);
          }
        }
      });
    });
  }, [events]);

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Set up interval to check reminders
  useEffect(() => {
    // Check immediately
    checkReminders();

    // Check every 30 seconds
    intervalRef.current = setInterval(checkReminders, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkReminders]);

  // Clear notified reminders when events change significantly
  useEffect(() => {
    // Get current event IDs
    const currentEventIds = new Set(events.map(e => e.id));
    
    // Remove notifications for events that no longer exist
    notifiedReminders.current.forEach(key => {
      const eventId = key.split('-')[0];
      if (!currentEventIds.has(eventId)) {
        notifiedReminders.current.delete(key);
      }
    });
  }, [events]);

  return {
    requestPermission: requestNotificationPermission,
    hasPermission: typeof Notification !== 'undefined' && Notification.permission === 'granted'
  };
}

