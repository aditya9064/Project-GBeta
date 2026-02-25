import { CalendarEvent, EventType } from '../../types/calendar';

interface AgendaViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date) => void;
  selectedEventId?: string;
}

// Event type icons
const EventIcons: Record<EventType, React.ReactNode> = {
  meeting: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  call: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  focus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  reminder: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  task: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
};

export function AgendaView({ 
  currentDate, 
  events, 
  onEventClick, 
  selectedEventId 
}: AgendaViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get next 14 days of events
  const getUpcomingDays = () => {
    const days: { date: Date; events: CalendarEvent[] }[] = [];
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.startTime);
        return eventDate.getFullYear() === date.getFullYear() &&
               eventDate.getMonth() === date.getMonth() &&
               eventDate.getDate() === date.getDate();
      }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      if (dayEvents.length > 0) {
        days.push({ date, events: dayEvents });
      }
    }
    
    return days;
  };

  const upcomingDays = getUpcomingDays();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime();
  };

  if (upcomingDays.length === 0) {
    return (
      <div className="agenda-view">
        <div className="agenda-empty">
          <div className="agenda-empty-icon">📅</div>
          <div className="agenda-empty-title">No upcoming events</div>
          <div className="agenda-empty-text">
            Use the AI input below to schedule your first event
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda-view">
      {upcomingDays.map(({ date, events: dayEvents }) => (
        <div key={date.toISOString()} className="agenda-day">
          <div className={`agenda-date ${isToday(date) ? 'today' : ''}`}>
            <div className="agenda-date-number">{date.getDate()}</div>
            <div className="agenda-date-info">
              <div className="agenda-weekday">
                {isToday(date) ? 'Today' : dayNames[date.getDay()]}
              </div>
              <div className="agenda-month">
                {monthNames[date.getMonth()]} {date.getFullYear()}
              </div>
            </div>
          </div>
          
          <div className="agenda-events">
            {dayEvents.map(event => (
              <div
                key={event.id}
                className={`agenda-event ${selectedEventId === event.id ? 'selected' : ''}`}
                style={{ borderLeftColor: event.color || '#7C3AED' }}
                onClick={() => onEventClick(event)}
              >
                <div className="agenda-event-time">
                  {event.startTime.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </div>
                
                <div className="agenda-event-content">
                  <div className="agenda-event-title">{event.title}</div>
                  <div className="agenda-event-meta">
                    {event.participants.length > 0 && (
                      <>
                        {event.participants.map(p => p.name.split(' ')[0]).join(', ')}
                        {event.location && ' • '}
                      </>
                    )}
                    {event.location?.type === 'virtual' && 'Video call'}
                    {event.location?.type === 'physical' && event.location.address}
                  </div>
                </div>
                
                <div 
                  className="agenda-event-type"
                  style={{ backgroundColor: event.color || '#7C3AED' }}
                >
                  {EventIcons[event.eventType]}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}










