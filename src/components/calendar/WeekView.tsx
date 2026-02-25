import { CalendarEvent } from '../../types/calendar';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date) => void;
  selectedEventId?: string;
}

export function WeekView({ 
  currentDate, 
  events, 
  onEventClick, 
  selectedEventId 
}: WeekViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get week days
  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.getFullYear() === date.getFullYear() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getDate() === date.getDate();
    });
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const startHour = event.startTime.getHours() + event.startTime.getMinutes() / 60;
    const endHour = event.endTime.getHours() + event.endTime.getMinutes() / 60;
    const duration = endHour - startHour;
    
    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 30)}px`,
      backgroundColor: event.color || '#7C3AED',
    };
  };

  const weekDays = getWeekDays();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime();
  };

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-header-time" />
        {weekDays.map((day, index) => (
          <div 
            key={index} 
            className={`week-header-day ${isToday(day) ? 'today' : ''}`}
          >
            <span className="week-day-name">{dayNames[day.getDay()]}</span>
            <span className="week-day-number">{day.getDate()}</span>
          </div>
        ))}
      </div>
      
      <div className="week-grid">
        <div className="week-times">
          {hours.map(hour => (
            <div key={hour} className="week-time">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        
        {weekDays.map((day, dayIndex) => {
          const dayEvents = getEventsForDay(day);
          
          return (
            <div key={dayIndex} className="week-day-column">
              {hours.map(hour => (
                <div key={hour} className="week-hour-slot" />
              ))}
              
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className={`week-event ${selectedEventId === event.id ? 'selected' : ''}`}
                  style={getEventStyle(event)}
                  onClick={() => onEventClick(event)}
                >
                  <div className="week-event-title">{event.title}</div>
                  <div className="week-event-time">
                    {event.startTime.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}










