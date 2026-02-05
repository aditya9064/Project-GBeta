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
  UpdateData,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { CalendarEvent } from '../types/calendar';
import type { FirestoreEvent } from '../types/database';

// Convert Firestore event to CalendarEvent
const toCalendarEvent = (firestoreEvent: FirestoreEvent): CalendarEvent => ({
  id: firestoreEvent.id,
  title: firestoreEvent.title,
  description: firestoreEvent.description || undefined,
  startTime: firestoreEvent.startTime.toDate(),
  endTime: firestoreEvent.endTime.toDate(),
  eventType: firestoreEvent.eventType,
  status: firestoreEvent.status,
  participants: [], // Will be loaded separately if needed
  location: firestoreEvent.location || undefined,
  reminders: [],
  color: firestoreEvent.color || '#7C3AED',
  createdAt: firestoreEvent.createdAt.toDate(),
  updatedAt: firestoreEvent.updatedAt.toDate(),
  createdBy: firestoreEvent.createdBy,
});

// Convert CalendarEvent to Firestore event
const toFirestoreEvent = (
  event: Partial<CalendarEvent>,
  workspaceId: string,
  userId: string
): Partial<FirestoreEvent> => ({
  workspaceId,
  title: event.title,
  description: event.description || null,
  startTime: event.startTime ? Timestamp.fromDate(event.startTime) : undefined,
  endTime: event.endTime ? Timestamp.fromDate(event.endTime) : undefined,
  eventType: event.eventType as FirestoreEvent['eventType'],
  status: event.status as FirestoreEvent['status'],
  location: event.location || null,
  color: event.color || null,
  createdBy: userId,
});

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get the user's default workspace ID
  const workspaceId = user ? `${user.uid}-default` : null;

  // Subscribe to events
  useEffect(() => {
    if (!workspaceId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('workspaceId', '==', workspaceId),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const eventsList: CalendarEvent[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<FirestoreEvent, 'id'>;
          eventsList.push(toCalendarEvent({ id: doc.id, ...data }));
        });
        setEvents(eventsList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching events:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId]);

  // Add a new event
  const addEvent = useCallback(
    async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
      if (!user || !workspaceId) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const eventsRef = collection(db, 'events');
        const firestoreData = {
          ...toFirestoreEvent(event, workspaceId, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(eventsRef, firestoreData);
        return { id: docRef.id, error: null };
      } catch (err) {
        return { id: null, error: err as Error };
      }
    },
    [user, workspaceId]
  );

  // Update an event
  const updateEvent = useCallback(
    async (eventId: string, updates: Partial<CalendarEvent>) => {
      if (!user || !workspaceId) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const eventRef = doc(db, 'events', eventId);
        const firestoreUpdates = toFirestoreEvent(updates, workspaceId, user.uid);
        
        // Build update object, filtering out undefined values
        const updateData: UpdateData<FirestoreEvent> = {
          updatedAt: serverTimestamp() as Timestamp,
        };
        
        if (firestoreUpdates.title !== undefined) updateData.title = firestoreUpdates.title;
        if (firestoreUpdates.description !== undefined) updateData.description = firestoreUpdates.description;
        if (firestoreUpdates.startTime !== undefined) updateData.startTime = firestoreUpdates.startTime;
        if (firestoreUpdates.endTime !== undefined) updateData.endTime = firestoreUpdates.endTime;
        if (firestoreUpdates.eventType !== undefined) updateData.eventType = firestoreUpdates.eventType;
        if (firestoreUpdates.status !== undefined) updateData.status = firestoreUpdates.status;
        if (firestoreUpdates.location !== undefined) updateData.location = firestoreUpdates.location;
        if (firestoreUpdates.color !== undefined) updateData.color = firestoreUpdates.color;

        await updateDoc(eventRef, updateData);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user, workspaceId]
  );

  // Delete an event
  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      const eventRef = doc(db, 'events', eventId);
      await deleteDoc(eventRef);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  return {
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}

