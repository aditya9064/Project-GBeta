import { CalendarEvent } from '../../types/calendar';

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date) => void;
  selectedEventId?: string;
}

export function DayView({ 
  currentDate, 
  events, 
  onEventClick, 
  selectedEventId 
}: DayViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const compareDate = new Date(currentDate);
  compareDate.setHours(0, 0, 0, 0);

  // Get events for current day
  const dayEvents = events.filter(event => {
    const eventDate = new Date(event.startTime);
    return eventDate.getFullYear() === currentDate.getFullYear() &&
           eventDate.getMonth() === currentDate.getMonth() &&
           eventDate.getDate() === currentDate.getDate();
  });

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
    const endHour = event.endTime.getHours() + event.endTime.getMinutes() / 60;
    const duration = endHour - startHour;
    
    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 40)}px`,
      backgroundColor: event.color || '#e07a3a',
    };
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const isToday = compareDate.getTime() === today.getTime();

  return (
    <div className="day-view">
      <div className="day-header">
        <div className="day-info">
          <div className="day-weekday">{dayNames[currentDate.getDay()]}</div>
          <div className={`day-date ${isToday ? 'today' : ''}`}>
            {currentDate.getDate()}
          </div>
        </div>
      </div>
      
      <div className="day-grid">
        <div className="day-times">
          {hours.map(hour => (
            <div key={hour} className="day-time">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        
        <div className="day-slots">
          {hours.map(hour => (
            <div key={hour} className="day-hour-slot" />
          ))}
          
          {dayEvents.map(event => (
            <div
              key={event.id}
              className={`day-event ${selectedEventId === event.id ? 'selected' : ''}`}
              style={getEventStyle(event)}
              onClick={() => onEventClick(event)}
            >
              <div className="day-event-title">{event.title}</div>
              <div className="day-event-time">
                {event.startTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })} - {event.endTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </div>
              {event.participants.length > 0 && (
                <div className="day-event-participants">
                  {event.participants.map(p => p.name.split(' ')[0]).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}










