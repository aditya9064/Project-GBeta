// AI Event Parser - Natural Language to Calendar Events

import { ParsedEventIntent, EventType, CalendarEvent, Participant, Reminder } from '../types/calendar';

// Mock contacts for demonstration
const mockContacts = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@stripe.com' },
  { id: '2', name: 'Alex Rivera', email: 'alex@stripe.com' },
  { id: '3', name: 'Jordan Lee', email: 'jordan@notion.so' },
  { id: '4', name: 'Sam Morgan', email: 'sam@linear.app' },
  { id: '5', name: 'Taylor Brooks', email: 'taylor@figma.com' },
];

const mockTeams = [
  { name: 'Marketing', members: ['Sarah Chen', 'Taylor Brooks'] },
  { name: 'Engineering', members: ['Alex Rivera', 'Sam Morgan'] },
  { name: 'Stripe team', members: ['Sarah Chen', 'Alex Rivera'] },
];

// Time patterns
const timePatterns = {
  morning: { hour: 9, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 18, minute: 0 },
  noon: { hour: 12, minute: 0 },
  eod: { hour: 17, minute: 0 },
};

// Duration patterns
const durationPatterns: Record<string, number> = {
  'quick': 15,
  'brief': 15,
  'short': 30,
  'standup': 15,
  'sync': 30,
  'meeting': 60,
  'call': 30,
  'demo': 45,
  'workshop': 90,
  'training': 120,
};

// Parse relative dates
function parseRelativeDate(text: string): Date | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('today')) {
    return today;
  }
  if (lowerText.includes('tomorrow')) {
    return new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }
  if (lowerText.includes('next week')) {
    return new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  
  // Day of week parsing
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerText.includes(days[i])) {
      const currentDay = today.getDay();
      let daysUntil = i - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next occurrence
      return new Date(today.getTime() + daysUntil * 24 * 60 * 60 * 1000);
    }
  }
  
  return null;
}

// Parse time from text
function parseTime(text: string): { hour: number; minute: number } | null {
  const lowerText = text.toLowerCase();
  
  // Check named times
  for (const [name, time] of Object.entries(timePatterns)) {
    if (lowerText.includes(name)) {
      return time;
    }
  }
  
  // Parse specific times like "4pm", "4:30pm", "16:00"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    
    // If no meridiem and hour is small, assume PM for business hours
    if (!meridiem && hour >= 1 && hour <= 6) hour += 12;
    
    return { hour, minute };
  }
  
  return null;
}

// Parse duration
function parseDuration(text: string): number {
  const lowerText = text.toLowerCase();
  
  // Check for explicit duration
  const durationMatch = text.match(/(\d+)\s*(min|minute|hour|hr)/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    return unit.startsWith('hour') || unit === 'hr' ? value * 60 : value;
  }
  
  // Check for duration keywords
  for (const [keyword, minutes] of Object.entries(durationPatterns)) {
    if (lowerText.includes(keyword)) {
      return minutes;
    }
  }
  
  // Default duration based on event type
  if (lowerText.includes('call')) return 30;
  if (lowerText.includes('meeting')) return 60;
  if (lowerText.includes('demo')) return 45;
  
  return 30; // Default 30 minutes
}

// Find participants from text
function findParticipants(text: string): string[] {
  const participants: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Check for team mentions
  for (const team of mockTeams) {
    if (lowerText.includes(team.name.toLowerCase())) {
      participants.push(...team.members);
    }
  }
  
  // Check for individual contacts
  for (const contact of mockContacts) {
    const firstName = contact.name.split(' ')[0].toLowerCase();
    if (lowerText.includes(firstName)) {
      if (!participants.includes(contact.name)) {
        participants.push(contact.name);
      }
    }
  }
  
  return participants;
}

// Detect event type
function detectEventType(text: string): EventType {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('remind') || lowerText.includes('reminder')) return 'reminder';
  if (lowerText.includes('call') || lowerText.includes('phone')) return 'call';
  if (lowerText.includes('focus') || lowerText.includes('deep work')) return 'focus';
  if (lowerText.includes('task') || lowerText.includes('todo')) return 'task';
  
  return 'meeting';
}

// Parse recurrence pattern
function parseRecurrence(text: string): { pattern: string; endCondition?: string } | null {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('every day') || lowerText.includes('daily')) {
    return { pattern: 'daily' };
  }
  if (lowerText.includes('every week') || lowerText.includes('weekly')) {
    return { pattern: 'weekly' };
  }
  if (lowerText.includes('every month') || lowerText.includes('monthly')) {
    return { pattern: 'monthly' };
  }
  if (lowerText.includes('every monday')) {
    return { pattern: 'weekly:monday' };
  }
  if (lowerText.includes('every weekday')) {
    return { pattern: 'weekdays' };
  }
  
  // Parse "for the next X weeks/days"
  const forMatch = text.match(/for\s+(?:the\s+)?next\s+(\d+)\s+(week|day|month)/i);
  if (forMatch) {
    return { 
      pattern: 'daily', 
      endCondition: `${forMatch[1]} ${forMatch[2]}s` 
    };
  }
  
  return null;
}

// Main parsing function
export function parseEventIntent(input: string): ParsedEventIntent {
  const lowerInput = input.toLowerCase();
  
  // Detect action
  let action: 'create' | 'update' | 'delete' | 'query' = 'create';
  if (lowerInput.includes('cancel') || lowerInput.includes('delete')) {
    action = 'delete';
  } else if (lowerInput.includes('reschedule') || lowerInput.includes('move') || lowerInput.includes('change')) {
    action = 'update';
  } else if (lowerInput.includes('what') || lowerInput.includes('when') || lowerInput.includes('show')) {
    action = 'query';
  }
  
  // Parse components
  const date = parseRelativeDate(input);
  const time = parseTime(input);
  const duration = parseDuration(input);
  const participants = findParticipants(input);
  const eventType = detectEventType(input);
  const recurrence = parseRecurrence(input);
  
  // Build start time
  let startTime: Date | undefined;
  if (date) {
    startTime = new Date(date);
    if (time) {
      startTime.setHours(time.hour, time.minute, 0, 0);
    } else {
      // Default to next available hour
      const now = new Date();
      startTime.setHours(now.getHours() + 1, 0, 0, 0);
    }
  }
  
  // Build end time
  let endTime: Date | undefined;
  if (startTime) {
    endTime = new Date(startTime.getTime() + duration * 60 * 1000);
  }
  
  // Extract title - remove common prefixes and participants
  let title = input
    .replace(/^(schedule|book|set|create|add)\s+(a\s+)?/i, '')
    .replace(/\s+(with|for)\s+.*/i, '')
    .replace(/\s+(tomorrow|today|next\s+\w+|on\s+\w+).*/i, '')
    .replace(/\s+at\s+\d.*/i, '')
    .trim();
  
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Default title if empty
  if (!title || title.length < 3) {
    if (participants.length > 0) {
      title = `Meeting with ${participants[0]}`;
    } else {
      title = eventType === 'reminder' ? 'Reminder' : 'New Event';
    }
  }
  
  // Calculate confidence
  let confidence = 0.5;
  if (startTime) confidence += 0.2;
  if (participants.length > 0) confidence += 0.15;
  if (title.length > 5) confidence += 0.15;
  
  // Check if clarification needed
  let needsClarification: ParsedEventIntent['needsClarification'];
  if (!date && !lowerInput.includes('recurring')) {
    needsClarification = {
      field: 'date',
      question: 'When would you like to schedule this?',
      options: ['Today', 'Tomorrow', 'This week', 'Next week']
    };
    confidence = 0.4;
  }
  
  return {
    action,
    title,
    startTime,
    endTime,
    duration,
    participants,
    eventType,
    recurrence: recurrence || undefined,
    reminders: [
      { offset: 30, type: 'in-app' },
      { offset: eventType === 'meeting' ? 60 : 15, type: 'email' }
    ],
    confidence,
    needsClarification,
  };
}

// Resolve participant names to full participant objects
export function resolveParticipants(names: string[]): Participant[] {
  return names.map((name, index) => {
    const contact = mockContacts.find(c => 
      c.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
    );
    
    if (contact) {
      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        type: 'contact' as const,
        rsvpStatus: 'pending' as const,
      };
    }
    
    return {
      id: `external-${index}`,
      name,
      email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
      type: 'external' as const,
      rsvpStatus: 'pending' as const,
    };
  });
}

// Create calendar event from parsed intent
export function createEventFromIntent(intent: ParsedEventIntent): CalendarEvent | null {
  if (!intent.startTime || !intent.endTime) {
    return null;
  }
  
  const now = new Date();
  const participants = resolveParticipants(intent.participants || []);
  
  const reminders: Reminder[] = (intent.reminders || []).map((r, i) => ({
    id: `reminder-${i}`,
    time: new Date(intent.startTime!.getTime() - r.offset * 60 * 1000),
    type: r.type || 'in-app',
    sent: false,
  }));
  
  return {
    id: `event-${Date.now()}`,
    title: intent.title || 'New Event',
    description: intent.description,
    startTime: intent.startTime,
    endTime: intent.endTime,
    location: intent.location ? {
      type: 'virtual',
      meetingLink: `https://meet.example.com/${Date.now().toString(36)}`,
    } : undefined,
    participants,
    eventType: intent.eventType || 'meeting',
    status: 'scheduled',
    reminders,
    color: getEventColor(intent.eventType || 'meeting'),
    createdAt: now,
    updatedAt: now,
    createdBy: 'current-user',
  };
}

// Get color for event type
function getEventColor(type: EventType): string {
  const colors: Record<EventType, string> = {
    meeting: '#7C3AED',
    call: '#3B82F6',
    focus: '#10B981',
    reminder: '#F59E0B',
    task: '#EC4899',
  };
  return colors[type];
}

// Generate AI confirmation message
export function generateConfirmation(event: CalendarEvent): string {
  const dateStr = event.startTime.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  const timeStr = event.startTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  
  let message = `✓ ${event.title} scheduled for ${dateStr} at ${timeStr}`;
  
  if (event.participants.length > 0) {
    const names = event.participants.map(p => p.name.split(' ')[0]).join(', ');
    message += ` with ${names}`;
  }
  
  if (event.location?.meetingLink) {
    message += '. Meeting link added.';
  }
  
  return message;
}










