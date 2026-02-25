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
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { CalendarEvent, EventReminder } from '../types/calendar';

// Firestore event document interface
interface FirestoreEvent {
  title: string;
  description?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  eventType: string;
  status: string;
  color?: string;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: {
    frequency: string;
    interval?: number;
    endDate?: Timestamp;
    count?: number;
    daysOfWeek?: number[];
  };
  location?: {
    type: string;
    address?: string;
    meetingLink?: string;
  };
  participants: Array<{
    id: string;
    name: string;
    email: string;
    type: string;
    avatar?: string;
    rsvpStatus?: string;
  }>;
  reminders: Array<{
    id: string;
    time: Timestamp;
    type: string;
    sent: boolean;
  }>;
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Convert Firestore document to CalendarEvent
function firestoreToEvent(id: string, data: DocumentData): CalendarEvent {
  return {
    id,
    title: data.title,
    description: data.description,
    startTime: data.startTime?.toDate() || new Date(),
    endTime: data.endTime?.toDate() || new Date(),
    eventType: data.eventType || 'meeting',
    status: data.status || 'scheduled',
    color: data.color,
    isAllDay: data.isAllDay || false,
    isRecurring: data.isRecurring || false,
    recurrenceRule: data.recurrenceRule ? {
      ...data.recurrenceRule,
      endDate: data.recurrenceRule.endDate?.toDate()
    } : undefined,
    location: data.location,
    participants: data.participants || [],
    reminders: (data.reminders || []).map((r: any) => ({
      ...r,
      time: r.time?.toDate() || new Date()
    })),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    createdBy: data.userId
  };
}

// Convert CalendarEvent to Firestore document
function eventToFirestore(event: Partial<CalendarEvent>, userId: string): Partial<FirestoreEvent> {
  const doc: Partial<FirestoreEvent> = {
    userId
  };

  if (event.title !== undefined) doc.title = event.title;
  if (event.description !== undefined) doc.description = event.description;
  if (event.startTime !== undefined) doc.startTime = Timestamp.fromDate(event.startTime);
  if (event.endTime !== undefined) doc.endTime = Timestamp.fromDate(event.endTime);
  if (event.eventType !== undefined) doc.eventType = event.eventType;
  if (event.status !== undefined) doc.status = event.status;
  if (event.color !== undefined) doc.color = event.color;
  if (event.isAllDay !== undefined) doc.isAllDay = event.isAllDay;
  if (event.isRecurring !== undefined) doc.isRecurring = event.isRecurring;
  if (event.location !== undefined) doc.location = event.location;
  if (event.participants !== undefined) doc.participants = event.participants;
  if (event.reminders !== undefined) {
    doc.reminders = event.reminders.map(r => ({
      ...r,
      time: Timestamp.fromDate(r.time)
    }));
  }
  if (event.recurrenceRule !== undefined) {
    doc.recurrenceRule = event.recurrenceRule ? {
      ...event.recurrenceRule,
      endDate: event.recurrenceRule.endDate 
        ? Timestamp.fromDate(event.recurrenceRule.endDate) 
        : undefined
    } : undefined;
  }

  return doc;
}

export interface UseEventsReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string | null>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  getEventById: (id: string) => CalendarEvent | undefined;
}

export function useEvents(): UseEventsReturn {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to events from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('userId', '==', user.uid),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const eventList: CalendarEvent[] = [];
        snapshot.forEach((doc) => {
          eventList.push(firestoreToEvent(doc.id, doc.data()));
        });
        setEvents(eventList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching events:', err);
        setError('Failed to load events');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Create a new event
  const createEvent = useCallback(async (
    event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
  ): Promise<string | null> => {
    if (!user?.uid) {
      setError('You must be logged in to create events');
      return null;
    }

    try {
      const now = Timestamp.now();
      const eventData = {
        ...eventToFirestore(event as Partial<CalendarEvent>, user.uid),
        createdAt: now,
        updatedAt: now
      };

      const docRef = await addDoc(collection(db, 'events'), eventData);
      return docRef.id;
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event');
      return null;
    }
  }, [user?.uid]);

  // Update an existing event
  const updateEvent = useCallback(async (
    id: string, 
    updates: Partial<CalendarEvent>
  ): Promise<boolean> => {
    if (!user?.uid) {
      setError('You must be logged in to update events');
      return false;
    }

    try {
      const eventRef = doc(db, 'events', id);
      const updateData = {
        ...eventToFirestore(updates, user.uid),
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(eventRef, updateData);
      return true;
    } catch (err) {
      console.error('Error updating event:', err);
      setError('Failed to update event');
      return false;
    }
  }, [user?.uid]);

  // Delete an event
  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    if (!user?.uid) {
      setError('You must be logged in to delete events');
      return false;
    }

    try {
      const eventRef = doc(db, 'events', id);
      await deleteDoc(eventRef);
      return true;
    } catch (err) {
      console.error('Error deleting event:', err);
      setError('Failed to delete event');
      return false;
    }
  }, [user?.uid]);

  // Get event by ID
  const getEventById = useCallback((id: string): CalendarEvent | undefined => {
    return events.find(e => e.id === id);
  }, [events]);

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventById
  };
}

// Reminder utility functions
export function createReminder(
  minutesBefore: number, 
  type: 'in-app' | 'email' | 'push' = 'in-app',
  eventStartTime: Date
): EventReminder {
  const reminderTime = new Date(eventStartTime.getTime() - minutesBefore * 60 * 1000);
  return {
    id: `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    time: reminderTime,
    type,
    sent: false
  };
}

export const REMINDER_OPTIONS = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' }
];

export const REMINDER_TYPES = [
  { value: 'in-app', label: 'In-app notification' },
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push notification' }
];
