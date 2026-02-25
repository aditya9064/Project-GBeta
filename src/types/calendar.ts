// Calendar Types and Event Data Model

export type EventType = 'meeting' | 'call' | 'focus' | 'reminder' | 'task';
export type EventStatus = 'scheduled' | 'completed' | 'canceled';
export type CalendarView = 'day' | 'week' | 'month' | 'agenda';
export type ReminderType = 'in-app' | 'email' | 'push';

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  type: 'internal' | 'contact' | 'external';
  rsvpStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
}

export interface Reminder {
  id: string;
  time: Date;
  type: ReminderType;
  sent: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every X days/weeks/months
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  endDate?: Date;
  count?: number; // Number of occurrences
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: Participant;
  completed: boolean;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: {
    type: 'physical' | 'virtual';
    address?: string;
    meetingLink?: string;
  };
  participants: Participant[];
  eventType: EventType;
  status: EventStatus;
  reminders: Reminder[];
  recurrence?: RecurrenceRule;
  color?: string;
  
  // AI-generated content
  aiSummary?: string;
  actionItems?: ActionItem[];
  meetingNotes?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  relatedContactIds?: string[];
  relatedDealIds?: string[];
}

// AI Intent Parsing Types
export interface ParsedEventIntent {
  action: 'create' | 'update' | 'delete' | 'query';
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in minutes
  participants?: string[]; // Names or emails to resolve
  eventType?: EventType;
  location?: string;
  recurrence?: {
    pattern: string;
    endCondition?: string;
  };
  reminders?: {
    offset: number; // minutes before
    type?: ReminderType;
  }[];
  confidence: number; // 0-1
  needsClarification?: {
    field: string;
    options?: string[];
    question: string;
  };
}

// Calendar State
export interface CalendarState {
  currentDate: Date;
  view: CalendarView;
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  isCreating: boolean;
  draggedEvent: CalendarEvent | null;
}










