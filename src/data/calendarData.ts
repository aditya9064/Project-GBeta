import { CalendarEvent } from '../types/calendar';

const today = new Date();
const getDate = (daysFromToday: number, hour: number, minute: number = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
};

export const initialCalendarEvents: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Team Standup',
    description: 'Daily sync with the product team to discuss blockers and progress.',
    startTime: getDate(0, 9, 30),
    endTime: getDate(0, 10, 0),
    eventType: 'meeting',
    status: 'scheduled',
    participants: [
      { id: 'u1', name: 'Sarah Chen', email: 'sarah@company.com', type: 'user', rsvpStatus: 'accepted' },
      { id: 'u2', name: 'Alex Kim', email: 'alex@company.com', type: 'user', rsvpStatus: 'accepted' },
    ],
    location: { type: 'virtual', meetingLink: 'https://meet.example.com/daily-standup' },
    reminders: [{ id: 'r1', time: getDate(0, 9, 15), type: 'in-app', sent: false }],
    color: '#7C3AED',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-2',
    title: 'Product Strategy Review',
    description: 'Quarterly review of product roadmap and strategic initiatives.',
    startTime: getDate(0, 14, 0),
    endTime: getDate(0, 15, 30),
    eventType: 'meeting',
    status: 'scheduled',
    participants: [
      { id: 'u3', name: 'Jordan Taylor', email: 'jordan@company.com', type: 'user', rsvpStatus: 'accepted' },
      { id: 'c1', name: 'Michael Davis', email: 'michael@partner.com', type: 'contact', rsvpStatus: 'pending' },
    ],
    location: { type: 'physical', address: 'Conference Room A' },
    reminders: [
      { id: 'r2', time: getDate(0, 13, 30), type: 'in-app', sent: false },
      { id: 'r3', time: getDate(-1, 14, 0), type: 'email', sent: true }
    ],
    color: '#7C3AED',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-3',
    title: 'Client Call - Acme Corp',
    description: 'Discuss contract renewal and new feature requests.',
    startTime: getDate(1, 11, 0),
    endTime: getDate(1, 11, 45),
    eventType: 'call',
    status: 'scheduled',
    participants: [
      { id: 'c2', name: 'Emma Wilson', email: 'emma@acme.com', type: 'contact', rsvpStatus: 'accepted' },
    ],
    location: { type: 'virtual', meetingLink: 'https://zoom.us/j/123456789' },
    reminders: [{ id: 'r4', time: getDate(1, 10, 45), type: 'in-app', sent: false }],
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-4',
    title: 'Deep Work: Feature Development',
    description: 'Uninterrupted time for coding the new dashboard features.',
    startTime: getDate(1, 14, 0),
    endTime: getDate(1, 17, 0),
    eventType: 'focus',
    status: 'scheduled',
    participants: [],
    reminders: [{ id: 'r5', time: getDate(1, 13, 55), type: 'in-app', sent: false }],
    color: '#10B981',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-5',
    title: 'Weekly Team Sync',
    description: 'End of week recap and planning for next week.',
    startTime: getDate(2, 16, 0),
    endTime: getDate(2, 17, 0),
    eventType: 'meeting',
    status: 'scheduled',
    participants: [
      { id: 'u1', name: 'Sarah Chen', email: 'sarah@company.com', type: 'user', rsvpStatus: 'accepted' },
      { id: 'u2', name: 'Alex Kim', email: 'alex@company.com', type: 'user', rsvpStatus: 'accepted' },
      { id: 'u3', name: 'Jordan Taylor', email: 'jordan@company.com', type: 'user', rsvpStatus: 'tentative' },
    ],
    location: { type: 'virtual', meetingLink: 'https://meet.example.com/weekly-sync' },
    reminders: [{ id: 'r6', time: getDate(2, 15, 45), type: 'in-app', sent: false }],
    color: '#7C3AED',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-6',
    title: 'Submit Quarterly Report',
    description: 'Deadline for Q1 performance report submission.',
    startTime: getDate(3, 17, 0),
    endTime: getDate(3, 17, 30),
    eventType: 'reminder',
    status: 'scheduled',
    participants: [],
    reminders: [
      { id: 'r7', time: getDate(3, 9, 0), type: 'in-app', sent: false },
      { id: 'r8', time: getDate(2, 17, 0), type: 'email', sent: false }
    ],
    color: '#F59E0B',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-7',
    title: 'Design Review',
    description: 'Review new UI mockups with the design team.',
    startTime: getDate(4, 10, 0),
    endTime: getDate(4, 11, 0),
    eventType: 'meeting',
    status: 'scheduled',
    participants: [
      { id: 'u4', name: 'Chris Lee', email: 'chris@company.com', type: 'user', rsvpStatus: 'accepted' },
    ],
    location: { type: 'virtual', meetingLink: 'https://figma.com/board/review' },
    reminders: [{ id: 'r9', time: getDate(4, 9, 45), type: 'in-app', sent: false }],
    color: '#7C3AED',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  },
  {
    id: 'event-8',
    title: 'Investor Update Call',
    description: 'Monthly update call with investors.',
    startTime: getDate(5, 15, 0),
    endTime: getDate(5, 16, 0),
    eventType: 'call',
    status: 'scheduled',
    participants: [
      { id: 'e1', name: 'David Brown', email: 'david@ventures.com', type: 'external', rsvpStatus: 'accepted' },
      { id: 'e2', name: 'Lisa Wong', email: 'lisa@capital.com', type: 'external', rsvpStatus: 'pending' },
    ],
    location: { type: 'virtual', meetingLink: 'https://zoom.us/j/987654321' },
    reminders: [
      { id: 'r10', time: getDate(5, 14, 0), type: 'in-app', sent: false },
      { id: 'r11', time: getDate(4, 15, 0), type: 'email', sent: false }
    ],
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'current-user'
  }
];
