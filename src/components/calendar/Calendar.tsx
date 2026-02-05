import { useState, useCallback, useEffect, useMemo } from 'react';
import { CalendarEvent, CalendarView, EventReminder } from '../../types/calendar';
import { useEvents, createReminder, REMINDER_OPTIONS, REMINDER_TYPES } from '../../hooks/useEvents';
import { useReminders } from '../../hooks/useReminders';
import { useAuth } from '../../contexts/AuthContext';

// Icons
const ChevronLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>;
const ChevronRight = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,6 15,12 9,18"/></svg>;
const SparklesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z"/></svg>;
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ClockIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>;
const UsersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const VideoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BellIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const RepeatIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>;
const LoaderIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/></svg>;
const AlertIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

interface CalendarProps {
  initialEvents?: CalendarEvent[];
  onEventsChange?: (events: CalendarEvent[]) => void;
  externalTriggerCreate?: boolean;
  onCreateModalOpened?: () => void;
}

// AI Parser for natural language
function parseAIInput(input: string, existingEvents: CalendarEvent[]): Partial<CalendarEvent> | { error: string; question?: string } {
  const lower = input.toLowerCase();
  const now = new Date();
  
  // Parse date
  let targetDate = new Date(now);
  if (lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes('next week')) {
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (lower.includes('next monday')) {
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilMonday);
  } else if (lower.includes('friday')) {
    const daysUntilFriday = (12 - now.getDay()) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilFriday);
  }
  
  // Parse time
  let hour = 10; // Default
  const timeMatch = input.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    if (timeMatch[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
    if (timeMatch[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
    if (!timeMatch[3] && hour >= 1 && hour <= 6) hour += 12;
  } else if (lower.includes('morning')) {
    hour = 9;
  } else if (lower.includes('afternoon')) {
    hour = 14;
  } else if (lower.includes('evening')) {
    hour = 18;
  }
  
  // Parse duration
  let duration = 60;
  if (lower.includes('30 min') || lower.includes('half hour')) duration = 30;
  if (lower.includes('15 min') || lower.includes('quick')) duration = 15;
  if (lower.includes('2 hour')) duration = 120;
  if (lower.includes('all day')) duration = 480;
  
  // Parse event type
  let eventType: CalendarEvent['eventType'] = 'meeting';
  if (lower.includes('call') || lower.includes('phone')) eventType = 'call';
  if (lower.includes('focus') || lower.includes('deep work')) eventType = 'focus';
  if (lower.includes('remind')) eventType = 'reminder';
  
  // Parse participants
  const participants: CalendarEvent['participants'] = [];
  const names = ['sarah', 'alex', 'jordan', 'sam', 'taylor', 'chris', 'mike', 'emma'];
  names.forEach(name => {
    if (lower.includes(name)) {
      participants.push({
        id: name,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: `${name}@company.com`,
        type: 'contact',
        rsvpStatus: 'pending'
      });
    }
  });
  
  // Extract title
  let title = input
    .replace(/^(schedule|book|set|create|add)\s+(a\s+)?/i, '')
    .replace(/\s+(with|for)\s+\w+.*/i, '')
    .replace(/\s+(tomorrow|today|next\s+\w+|on\s+\w+|at\s+\d+).*/i, '')
    .trim();
  
  if (title.length < 3) {
    title = participants.length > 0 
      ? `Meeting with ${participants[0].name}` 
      : eventType === 'focus' ? 'Focus Time' : 'New Event';
  }
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Check for conflicts
  const startTime = new Date(targetDate);
  startTime.setHours(hour, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + duration * 60000);
  
  const conflict = existingEvents.find(e => {
    const eStart = new Date(e.startTime).getTime();
    const eEnd = new Date(e.endTime).getTime();
    const newStart = startTime.getTime();
    const newEnd = endTime.getTime();
    return (newStart < eEnd && newEnd > eStart);
  });
  
  if (conflict) {
    return { 
      error: `Conflict with "${conflict.title}" at that time.`,
      question: `Would you like to schedule at ${hour + 1}:00 instead?`
    };
  }
  
  const colors: Record<string, string> = {
    meeting: '#7C3AED',
    call: '#3B82F6', 
    focus: '#10B981',
    reminder: '#F59E0B',
    task: '#EC4899'
  };
  
  return {
    id: `event-${Date.now()}`,
    title,
    startTime,
    endTime,
    eventType,
    participants,
    status: 'scheduled',
    reminders: [{ id: `r-${Date.now()}`, time: new Date(startTime.getTime() - 30 * 60000), type: 'in-app', sent: false }],
    color: colors[eventType],
    location: eventType !== 'focus' ? { type: 'virtual', meetingLink: `https://meet.example.com/${Date.now().toString(36)}` } : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  };
}

// Reminder form state interface
interface ReminderFormState {
  minutesBefore: number;
  type: 'in-app' | 'email' | 'push';
}

export function Calendar({ initialEvents = [], onEventsChange, externalTriggerCreate, onCreateModalOpened }: CalendarProps) {
  const { user } = useAuth();
  const { events: firestoreEvents, loading, error: eventsError, createEvent, updateEvent, deleteEvent } = useEvents();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiMessage, setAiMessage] = useState<{text: string; type: 'success' | 'error' | 'info'} | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Use Firestore events if user is logged in, otherwise use initial/local events
  const events = useMemo(() => {
    if (user) {
      return firestoreEvents;
    }
    return initialEvents;
  }, [user, firestoreEvents, initialEvents]);
  
  // Set up reminder notifications
  const { hasPermission: hasNotificationPermission, requestPermission } = useReminders(events);
  
  // Handle external trigger to open create modal
  useEffect(() => {
    if (externalTriggerCreate) {
      setFormData(prev => ({ ...prev, date: currentDate.toISOString().split('T')[0] }));
      setShowCreateModal(true);
      onCreateModalOpened?.();
    }
  }, [externalTriggerCreate, currentDate, onCreateModalOpened]);
  
  // Notify parent when events change
  useEffect(() => {
    onEventsChange?.(events);
  }, [events, onEventsChange]);
  
  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    eventType: 'meeting' as CalendarEvent['eventType'],
    description: '',
    isRecurring: false,
    recurrence: 'weekly',
    isAllDay: false
  });
  
  // Reminder form state
  const [reminders, setReminders] = useState<ReminderFormState[]>([
    { minutesBefore: 30, type: 'in-app' }
  ]);

  // Add a new reminder
  const addReminder = useCallback(() => {
    setReminders(prev => [...prev, { minutesBefore: 15, type: 'in-app' }]);
  }, []);

  // Remove a reminder
  const removeReminder = useCallback((index: number) => {
    setReminders(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update a reminder
  const updateReminderField = useCallback((index: number, field: keyof ReminderFormState, value: number | string) => {
    setReminders(prev => prev.map((r, i) => 
      i === index ? { ...r, [field]: value } : r
    ));
  }, []);

  const navigatePrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  }, [currentDate, view]);

  const navigateNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  }, [currentDate, view]);

  const getHeaderTitle = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // AI Input handler
  const handleAISubmit = useCallback(async () => {
    if (!aiInput.trim()) return;
    
    const result = parseAIInput(aiInput, events);
    
    if ('error' in result) {
      setAiMessage({ text: result.error + (result.question ? ` ${result.question}` : ''), type: 'error' });
    } else {
      const newEvent = result as CalendarEvent;
      
      if (user) {
        // Save to Firestore
        setIsSaving(true);
        const eventId = await createEvent({
          title: newEvent.title,
          description: newEvent.description,
          startTime: newEvent.startTime,
          endTime: newEvent.endTime,
          eventType: newEvent.eventType,
          status: newEvent.status,
          participants: newEvent.participants,
          reminders: newEvent.reminders,
          color: newEvent.color,
          location: newEvent.location,
          isAllDay: newEvent.isAllDay
        });
        setIsSaving(false);
        
        if (eventId) {
          setAiMessage({ 
            text: `✓ "${newEvent.title}" scheduled for ${newEvent.startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${newEvent.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, 
            type: 'success' 
          });
          setCurrentDate(newEvent.startTime);
        } else {
          setAiMessage({ text: 'Failed to create event. Please try again.', type: 'error' });
        }
      } else {
        setAiMessage({ text: 'Please log in to create events', type: 'error' });
      }
    }
    
    setAiInput('');
    setTimeout(() => setAiMessage(null), 4000);
  }, [aiInput, events, user, createEvent]);

  // Create event from form
  const handleCreateEvent = useCallback(async () => {
    const [year, month, day] = formData.date.split('-').map(Number);
    
    let startTime: Date;
    let endTime: Date;
    
    if (formData.isAllDay) {
      startTime = new Date(year, month - 1, day, 0, 0, 0);
      endTime = new Date(year, month - 1, day, 23, 59, 59);
    } else {
      const [startH, startM] = formData.startTime.split(':').map(Number);
      const [endH, endM] = formData.endTime.split(':').map(Number);
      startTime = new Date(year, month - 1, day, startH, startM);
      endTime = new Date(year, month - 1, day, endH, endM);
    }
    
    const colors: Record<string, string> = { meeting: '#7C3AED', call: '#3B82F6', focus: '#10B981', reminder: '#F59E0B', task: '#EC4899' };
    
    // Create reminder objects from form state
    const eventReminders: EventReminder[] = formData.isAllDay ? [] : reminders.map(r => 
      createReminder(r.minutesBefore, r.type, startTime)
    );
    
    setIsSaving(true);
    
    if (editingEvent) {
      // Update existing event
      const success = await updateEvent(editingEvent.id, {
        title: formData.title,
        startTime,
        endTime,
        eventType: formData.eventType,
        description: formData.description,
        color: colors[formData.eventType],
        isAllDay: formData.isAllDay,
        reminders: eventReminders
      });
      
      setIsSaving(false);
      
      if (success) {
        setAiMessage({ text: `✓ "${formData.title}" updated`, type: 'success' });
      } else {
        setAiMessage({ text: 'Failed to update event', type: 'error' });
      }
    } else {
      // Create new event(s)
      if (formData.isRecurring) {
        // Create recurring events
        const recurringDates: Date[] = [];
        for (let i = 0; i < 8; i++) {
          const nextStart = new Date(startTime);
          const nextEnd = new Date(endTime);
          if (formData.recurrence === 'daily') {
            nextStart.setDate(nextStart.getDate() + i);
            nextEnd.setDate(nextEnd.getDate() + i);
          } else if (formData.recurrence === 'weekly') {
            nextStart.setDate(nextStart.getDate() + i * 7);
            nextEnd.setDate(nextEnd.getDate() + i * 7);
          } else if (formData.recurrence === 'monthly') {
            nextStart.setMonth(nextStart.getMonth() + i);
            nextEnd.setMonth(nextEnd.getMonth() + i);
          }
          recurringDates.push(nextStart);
        }
        
        // Create all recurring events
        for (let i = 0; i < recurringDates.length; i++) {
          const nextStart = recurringDates[i];
          const nextEnd = new Date(nextStart);
          if (formData.isAllDay) {
            nextEnd.setHours(23, 59, 59);
          } else {
            const duration = endTime.getTime() - startTime.getTime();
            nextEnd.setTime(nextStart.getTime() + duration);
          }
          
          await createEvent({
            title: formData.title,
            description: formData.description,
            startTime: nextStart,
            endTime: nextEnd,
            eventType: formData.eventType,
            status: 'scheduled',
            participants: [],
            reminders: formData.isAllDay ? [] : reminders.map(r => 
              createReminder(r.minutesBefore, r.type, nextStart)
            ),
            color: colors[formData.eventType],
            isAllDay: formData.isAllDay,
            isRecurring: true
          });
        }
        
        setIsSaving(false);
        setAiMessage({ text: `✓ "${formData.title}" created (recurring ${formData.recurrence})`, type: 'success' });
      } else {
        // Create single event
        const eventId = await createEvent({
          title: formData.title,
          description: formData.description,
          startTime,
          endTime,
          eventType: formData.eventType,
          status: 'scheduled',
          participants: [],
          reminders: eventReminders,
          color: colors[formData.eventType],
          isAllDay: formData.isAllDay
        });
        
        setIsSaving(false);
        
        if (eventId) {
          setAiMessage({ text: `✓ "${formData.title}" created`, type: 'success' });
        } else {
          setAiMessage({ text: 'Failed to create event', type: 'error' });
        }
      }
    }
    
    setShowCreateModal(false);
    setEditingEvent(null);
    setFormData({ title: '', date: '', startTime: '10:00', endTime: '11:00', eventType: 'meeting', description: '', isRecurring: false, recurrence: 'weekly', isAllDay: false });
    setReminders([{ minutesBefore: 30, type: 'in-app' }]);
    setTimeout(() => setAiMessage(null), 3000);
  }, [formData, editingEvent, reminders, createEvent, updateEvent]);

  // Delete event
  const handleDeleteEvent = useCallback(async (id: string) => {
    const event = events.find(e => e.id === id);
    setIsSaving(true);
    const success = await deleteEvent(id);
    setIsSaving(false);
    
    setSelectedEvent(null);
    if (success && event) {
      setAiMessage({ text: `"${event.title}" deleted`, type: 'info' });
    } else {
      setAiMessage({ text: 'Failed to delete event', type: 'error' });
    }
    setTimeout(() => setAiMessage(null), 2000);
  }, [events, deleteEvent]);

  // Open edit modal
  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      date: new Date(event.startTime).toISOString().split('T')[0],
      startTime: new Date(event.startTime).toTimeString().slice(0, 5),
      endTime: new Date(event.endTime).toTimeString().slice(0, 5),
      eventType: event.eventType,
      description: event.description || '',
      isRecurring: false,
      recurrence: 'weekly',
      isAllDay: event.isAllDay || false
    });
    
    // Populate reminders from event
    if (event.reminders && event.reminders.length > 0) {
      setReminders(event.reminders.map(r => {
        const minutesBefore = Math.round((new Date(event.startTime).getTime() - new Date(r.time).getTime()) / 60000);
        return {
          minutesBefore: minutesBefore > 0 ? minutesBefore : 30,
          type: r.type
        };
      }));
    } else {
      setReminders([{ minutesBefore: 30, type: 'in-app' }]);
    }
    
    setShowCreateModal(true);
    setSelectedEvent(null);
  }, []);

  // Complete/Cancel event
  const handleCompleteEvent = useCallback(async (id: string) => {
    setIsSaving(true);
    const success = await updateEvent(id, { status: 'completed' });
    setIsSaving(false);
    
    setSelectedEvent(null);
    if (success) {
      setAiMessage({ text: 'Event marked as completed', type: 'success' });
    } else {
      setAiMessage({ text: 'Failed to update event', type: 'error' });
    }
    setTimeout(() => setAiMessage(null), 2000);
  }, [updateEvent]);

  // Calendar grid helpers
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({ date, isCurrentMonth: date.getMonth() === month });
    }
    return days;
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(e => new Date(e.startTime).toDateString() === date.toDateString());
  };

  // Get all-day events for a specific date
  const getAllDayEventsForDay = (date: Date) => {
    return events.filter(e => e.isAllDay && new Date(e.startTime).toDateString() === date.toDateString());
  };

  // Get timed events (non-all-day) for a specific date
  const getTimedEventsForDay = (date: Date) => {
    return events.filter(e => !e.isAllDay && new Date(e.startTime).toDateString() === date.toDateString());
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const formatHour = (h: number) => h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`;

  // Get reminder description for display
  const getReminderDescription = (reminder: EventReminder, eventStartTime: Date): string => {
    const minutesBefore = Math.round((new Date(eventStartTime).getTime() - new Date(reminder.time).getTime()) / 60000);
    const option = REMINDER_OPTIONS.find(o => o.value === minutesBefore);
    return option?.label || `${minutesBefore} minutes before`;
  };

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-left">
          <h1 className="calendar-title">{getHeaderTitle()}</h1>
          <div className="calendar-nav">
            <button className="nav-btn" onClick={navigatePrevious}><ChevronLeft /></button>
            <button className="nav-btn today-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
            <button className="nav-btn" onClick={navigateNext}><ChevronRight /></button>
          </div>
        </div>
        <div className="calendar-header-right">
          {loading && <div className="loading-indicator"><LoaderIcon /> Loading...</div>}
          {user && !hasNotificationPermission && typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
            <button className="notification-permission-btn" onClick={requestPermission} title="Enable notifications">
              <BellIcon /> Enable Reminders
            </button>
          )}
          <button className="create-event-btn" onClick={() => {
            setFormData(prev => ({ ...prev, date: currentDate.toISOString().split('T')[0] }));
            setReminders([{ minutesBefore: 30, type: 'in-app' }]);
            setShowCreateModal(true);
          }}>
            <PlusIcon /> New Event
          </button>
          <div className="view-tabs">
            {(['day', 'week', 'month', 'agenda'] as CalendarView[]).map(v => (
              <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {eventsError && (
        <div className="ai-message error">
          <AlertIcon /> <span>{eventsError}</span>
        </div>
      )}

      {/* AI Message */}
      {aiMessage && (
        <div className={`ai-message ${aiMessage.type}`}>
          <span>{aiMessage.text}</span>
        </div>
      )}

      {/* Login prompt */}
      {!user && (
        <div className="ai-message info">
          <span>Log in to save your events and access them across devices</span>
        </div>
      )}

      {/* Main Body */}
      <div className="calendar-body">
        <div className={`calendar-main ${selectedEvent ? 'with-panel' : ''}`}>
          
          {/* MONTH VIEW */}
          {view === 'month' && (
            <div className="month-view">
              <div className="month-header">
                {weekDays.map(d => <div key={d} className="month-header-day">{d}</div>)}
              </div>
              <div className="month-grid">
                {getCalendarDays().map((day, i) => {
                  const allDayEvents = getAllDayEventsForDay(day.date);
                  const timedEvents = getTimedEventsForDay(day.date);
                  const allEvents = [...allDayEvents, ...timedEvents];
                  const isToday = day.date.toDateString() === today.toDateString();
                  return (
                    <div key={i} className={`month-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                         onClick={() => { setCurrentDate(day.date); setView('day'); }}>
                      <span className="day-number">{day.date.getDate()}</span>
                      <div className="day-events">
                        {/* All-day events first (with different styling) */}
                        {allDayEvents.slice(0, 2).map(e => (
                          <div key={e.id} className={`event-block all-day ${e.status === 'completed' ? 'completed' : ''}`}
                               style={{ backgroundColor: e.color }}
                               onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}>
                            {e.title}
                          </div>
                        ))}
                        {/* Timed events */}
                        {timedEvents.slice(0, allDayEvents.length > 0 ? 1 : 2).map(e => (
                          <div key={e.id} className={`event-block ${e.status === 'completed' ? 'completed' : ''}`}
                               style={{ backgroundColor: e.color }}
                               onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); }}>
                            {e.title}
                          </div>
                        ))}
                        {allEvents.length > 3 && <div className="more-events">+{allEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {view === 'week' && (
            <div className="week-view">
              <div className="week-header">
                <div className="week-header-time" />
                {getWeekDays().map((d, i) => (
                  <div key={i} className={`week-header-day ${d.toDateString() === today.toDateString() ? 'today' : ''}`}>
                    <span className="week-day-name">{weekDays[d.getDay()]}</span>
                    <span className="week-day-number">{d.getDate()}</span>
                  </div>
                ))}
              </div>
              {/* All-day events section */}
              {getWeekDays().some(d => getAllDayEventsForDay(d).length > 0) && (
                <div className="all-day-section">
                  <div className="all-day-label">All Day</div>
                  <div className="all-day-events-row">
                    {getWeekDays().map((d, di) => (
                      <div key={di} className="all-day-column">
                        {getAllDayEventsForDay(d).map(e => (
                          <div key={e.id} className={`all-day-event ${e.status === 'completed' ? 'completed' : ''}`}
                               style={{ backgroundColor: e.color }}
                               onClick={() => setSelectedEvent(e)}>
                            {e.title}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="week-grid-scroll">
                <div className="week-grid">
                  <div className="week-times">
                    {hours.map(h => <div key={h} className="week-time">{formatHour(h)}</div>)}
                  </div>
                  {getWeekDays().map((d, di) => (
                    <div key={di} className="week-day-column">
                      {hours.map(h => <div key={h} className="week-hour-slot" onClick={() => {
                        const date = new Date(d); date.setHours(h);
                        setFormData(prev => ({ ...prev, date: date.toISOString().split('T')[0], startTime: `${h.toString().padStart(2,'0')}:00`, endTime: `${(h+1).toString().padStart(2,'0')}:00`, isAllDay: false }));
                        setReminders([{ minutesBefore: 30, type: 'in-app' }]);
                        setShowCreateModal(true);
                      }} />)}
                      {getTimedEventsForDay(d).map(e => {
                        const startH = new Date(e.startTime).getHours() + new Date(e.startTime).getMinutes() / 60;
                        const endH = new Date(e.endTime).getHours() + new Date(e.endTime).getMinutes() / 60;
                        return (
                          <div key={e.id} className={`week-event ${e.status === 'completed' ? 'completed' : ''}`}
                               style={{ top: `${startH * 60}px`, height: `${Math.max((endH - startH) * 60, 30)}px`, backgroundColor: e.color }}
                               onClick={() => setSelectedEvent(e)}>
                            <div className="week-event-title">{e.title}</div>
                            <div className="week-event-time">{new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DAY VIEW */}
          {view === 'day' && (
            <div className="day-view">
              <div className="day-header-info">
                <div className="day-weekday">{weekDays[currentDate.getDay()]}</div>
                <div className={`day-date-num ${currentDate.toDateString() === today.toDateString() ? 'today' : ''}`}>{currentDate.getDate()}</div>
              </div>
              {/* All-day events section */}
              {getAllDayEventsForDay(currentDate).length > 0 && (
                <div className="all-day-section day-all-day">
                  <div className="all-day-label">All Day</div>
                  <div className="all-day-events-list">
                    {getAllDayEventsForDay(currentDate).map(e => (
                      <div key={e.id} className={`all-day-event ${e.status === 'completed' ? 'completed' : ''}`}
                           style={{ backgroundColor: e.color }}
                           onClick={() => setSelectedEvent(e)}>
                        <span className="all-day-event-title">{e.title}</span>
                        {e.description && <span className="all-day-event-desc">{e.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="day-grid-scroll">
                <div className="day-grid">
                  <div className="day-times">
                    {hours.map(h => <div key={h} className="day-time">{formatHour(h)}</div>)}
                  </div>
                  <div className="day-slots">
                    {hours.map(h => <div key={h} className="day-hour-slot" onClick={() => {
                      setFormData(prev => ({ ...prev, date: currentDate.toISOString().split('T')[0], startTime: `${h.toString().padStart(2,'0')}:00`, endTime: `${(h+1).toString().padStart(2,'0')}:00`, isAllDay: false }));
                      setReminders([{ minutesBefore: 30, type: 'in-app' }]);
                      setShowCreateModal(true);
                    }} />)}
                    {getTimedEventsForDay(currentDate).map(e => {
                      const startH = new Date(e.startTime).getHours() + new Date(e.startTime).getMinutes() / 60;
                      const endH = new Date(e.endTime).getHours() + new Date(e.endTime).getMinutes() / 60;
                      return (
                        <div key={e.id} className={`day-event ${e.status === 'completed' ? 'completed' : ''}`}
                             style={{ top: `${startH * 60}px`, height: `${Math.max((endH - startH) * 60, 40)}px`, backgroundColor: e.color }}
                             onClick={() => setSelectedEvent(e)}>
                          <div className="day-event-title">{e.title}</div>
                          <div className="day-event-time">
                            {new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - 
                            {new Date(e.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                          {e.participants.length > 0 && (
                            <div className="day-event-participants">{e.participants.map(p => p.name.split(' ')[0]).join(', ')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AGENDA VIEW */}
          {view === 'agenda' && (
            <div className="agenda-view">
              {(() => {
                const upcoming: { date: Date; events: CalendarEvent[] }[] = [];
                for (let i = 0; i < 30; i++) {
                  const d = new Date(currentDate);
                  d.setDate(d.getDate() + i);
                  const dayEvents = getEventsForDay(d).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                  if (dayEvents.length > 0) upcoming.push({ date: d, events: dayEvents });
                }
                if (upcoming.length === 0) {
                  return (
                    <div className="agenda-empty">
                      <div className="agenda-empty-icon">📅</div>
                      <div className="agenda-empty-title">No upcoming events</div>
                      <div className="agenda-empty-text">Use the AI input or + button to create events</div>
                    </div>
                  );
                }
                return upcoming.map(({ date, events: dayEvents }) => (
                  <div key={date.toISOString()} className="agenda-day">
                    <div className={`agenda-date ${date.toDateString() === today.toDateString() ? 'today' : ''}`}>
                      <div className="agenda-date-number">{date.getDate()}</div>
                      <div className="agenda-date-info">
                        <div className="agenda-weekday">{date.toDateString() === today.toDateString() ? 'Today' : weekDays[date.getDay()]}</div>
                        <div className="agenda-month">{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                      </div>
                    </div>
                    <div className="agenda-events">
                      {dayEvents.map(e => (
                        <div key={e.id} className={`agenda-event ${e.status === 'completed' ? 'completed' : ''} ${e.isAllDay ? 'all-day' : ''}`}
                             style={{ borderLeftColor: e.color }}
                             onClick={() => setSelectedEvent(e)}>
                          <div className="agenda-event-time">
                            {e.isAllDay ? 'All day' : new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </div>
                          <div className="agenda-event-content">
                            <div className="agenda-event-title">{e.title}</div>
                            <div className="agenda-event-meta">
                              {e.isAllDay && e.description && <span>{e.description}</span>}
                              {!e.isAllDay && e.participants.length > 0 && <span>{e.participants.map(p => p.name.split(' ')[0]).join(', ')}</span>}
                              {e.location?.type === 'virtual' && <span> • Video call</span>}
                            </div>
                          </div>
                          <div className="agenda-event-type" style={{ backgroundColor: e.color }}>
                            {e.eventType === 'call' ? <VideoIcon /> : e.eventType === 'focus' ? <ClockIcon /> : <UsersIcon />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Event Detail Panel */}
        {selectedEvent && (
          <div className="event-panel">
            <div className="event-panel-header">
              <span className="event-type-badge" style={{ backgroundColor: selectedEvent.color }}>{selectedEvent.eventType}</span>
              <div className="event-panel-actions">
                <button className="panel-action-btn" onClick={() => handleCompleteEvent(selectedEvent.id)} title="Mark complete" disabled={isSaving}>
                  {isSaving ? <LoaderIcon /> : <CheckIcon />}
                </button>
                <button className="panel-action-btn" onClick={() => handleEditEvent(selectedEvent)} title="Edit"><EditIcon /></button>
                <button className="panel-action-btn danger" onClick={() => handleDeleteEvent(selectedEvent.id)} title="Delete" disabled={isSaving}>
                  {isSaving ? <LoaderIcon /> : <TrashIcon />}
                </button>
                <button className="panel-action-btn" onClick={() => setSelectedEvent(null)}><CloseIcon /></button>
              </div>
            </div>
            <div className="event-panel-content">
              <div className="event-color-bar" style={{ backgroundColor: selectedEvent.color }} />
              <h2 className="event-title">{selectedEvent.title}</h2>
              {selectedEvent.status === 'completed' && <span className="event-status-badge">Completed</span>}
              
              <div className="event-section">
                <div className="event-detail"><ClockIcon /><div>
                  <div className="event-detail-primary">{new Date(selectedEvent.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  <div className="event-detail-secondary">
                    {selectedEvent.isAllDay ? 'All day' : `${new Date(selectedEvent.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${new Date(selectedEvent.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                  </div>
                </div></div>
              </div>
              
              {selectedEvent.location?.meetingLink && (
                <div className="event-section">
                  <div className="event-detail"><VideoIcon /><div>
                    <div className="event-detail-primary">Video Call</div>
                    <a href={selectedEvent.location.meetingLink} target="_blank" rel="noopener noreferrer" className="event-link">Join meeting</a>
                  </div></div>
                </div>
              )}
              
              {selectedEvent.participants.length > 0 && (
                <div className="event-section">
                  <div className="event-section-label">Participants</div>
                  {selectedEvent.participants.map(p => (
                    <div key={p.id} className="event-participant">
                      <div className="participant-avatar">{p.name.charAt(0)}</div>
                      <div className="participant-info">
                        <div className="participant-name">{p.name}</div>
                        <div className="participant-email">{p.email}</div>
                      </div>
                      <span className={`participant-status ${p.rsvpStatus}`}>{p.rsvpStatus}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedEvent.reminders.length > 0 && (
                <div className="event-section">
                  <div className="event-section-label">Reminders</div>
                  {selectedEvent.reminders.map(r => (
                    <div key={r.id} className="event-reminder">
                      <BellIcon /> {getReminderDescription(r, selectedEvent.startTime)}
                      <span className="reminder-type-badge">{r.type}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedEvent.description && (
                <div className="event-section">
                  <div className="event-section-label">Description</div>
                  <div className="event-notes">{selectedEvent.description}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Input */}
      <div className="ai-calendar-input">
        <div className="ai-input-container">
          <div className="ai-input-icon"><SparklesIcon /></div>
          <input
            type="text"
            className="ai-input"
            placeholder="Try: 'Schedule a meeting with Sarah tomorrow at 3pm' or 'Book focus time Friday morning'"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAISubmit()}
            disabled={!user}
          />
          <span className="ai-input-hint">⏎</span>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="modal-overlay open" onClick={() => { setShowCreateModal(false); setEditingEvent(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
              <button className="modal-close" onClick={() => { setShowCreateModal(false); setEditingEvent(null); }}><CloseIcon /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Event Name</label>
                <input type="text" value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Enter event name" autoFocus />
              </div>
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={formData.isAllDay} onChange={e => setFormData(prev => ({ ...prev, isAllDay: e.target.checked }))} />
                  <ClockIcon /> All day (no specific time)
                </label>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} />
                </div>
                {!formData.isAllDay && (
                  <>
                    <div className="form-group">
                      <label>Start Time</label>
                      <input type="time" value={formData.startTime} onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>End Time</label>
                      <input type="time" value={formData.endTime} onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={formData.eventType} onChange={e => setFormData(prev => ({ ...prev, eventType: e.target.value as any }))}>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="focus">Focus Time</option>
                  <option value="reminder">Reminder</option>
                  <option value="task">Task</option>
                </select>
              </div>
              
              {/* Reminders Section */}
              {!formData.isAllDay && (
                <div className="form-group">
                  <label>Reminders</label>
                  <div className="reminders-list">
                    {reminders.map((reminder, index) => (
                      <div key={index} className="reminder-row">
                        <select 
                          value={reminder.minutesBefore} 
                          onChange={e => updateReminderField(index, 'minutesBefore', parseInt(e.target.value))}
                          className="reminder-time-select"
                        >
                          {REMINDER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <select 
                          value={reminder.type} 
                          onChange={e => updateReminderField(index, 'type', e.target.value)}
                          className="reminder-type-select"
                        >
                          {REMINDER_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          className="reminder-remove-btn"
                          onClick={() => removeReminder(index)}
                          disabled={reminders.length === 1}
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="add-reminder-btn" onClick={addReminder}>
                      <PlusIcon /> Add Reminder
                    </button>
                  </div>
                </div>
              )}
              
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Add description..." rows={3} />
              </div>
              {!editingEvent && (
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.isRecurring} onChange={e => setFormData(prev => ({ ...prev, isRecurring: e.target.checked }))} />
                    <RepeatIcon /> Recurring event
                  </label>
                  {formData.isRecurring && (
                    <select value={formData.recurrence} onChange={e => setFormData(prev => ({ ...prev, recurrence: e.target.value }))}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowCreateModal(false); setEditingEvent(null); }}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleCreateEvent} 
                disabled={!formData.title || !formData.date || isSaving || !user}
              >
                {isSaving ? <><LoaderIcon /> Saving...</> : editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
