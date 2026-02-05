export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

export type EventType = 'meeting' | 'call' | 'focus' | 'reminder' | 'task';

export type EventStatus = 'scheduled' | 'completed' | 'canceled';

export type RSVPStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface Participant {
  id: string;
  name: string;
  email: string;
  type: 'user' | 'contact' | 'external';
  avatar?: string;
  rsvpStatus?: RSVPStatus;
}

export interface EventLocation {
  type: 'physical' | 'virtual';
  address?: string;
  meetingLink?: string;
}

export interface EventReminder {
  id: string;
  time: Date;
  type: 'in-app' | 'email' | 'push';
  sent: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  endDate?: Date;
  count?: number;
  daysOfWeek?: number[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: EventLocation;
  participants: Participant[];
  eventType: EventType;
  status: EventStatus;
  reminders: EventReminder[];
  aiSummary?: string;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  color?: string;
  isAllDay?: boolean; // Events without a specific time (e.g., deadlines, holidays)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
