import { CalendarEvent } from '../../types/calendar';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newStart: Date) => void;
  selectedEventId?: string;
}

export function MonthView({ 
  currentDate, 
  events, 
  onEventClick, 
  selectedEventId 
}: MonthViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get calendar grid
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date,
        isCurrentMonth: date.getMonth() === month
      });
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

  const days = getCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime();
  };

  return (
    <div className="month-view">
      <div className="month-header">
        {weekDays.map(day => (
          <div key={day} className="month-header-day">{day}</div>
        ))}
      </div>
      
      <div className="month-grid">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day.date);
          const displayEvents = dayEvents.slice(0, 3);
          const moreCount = dayEvents.length - 3;
          
          return (
            <div
              key={index}
              className={`month-day ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday(day.date) ? 'today' : ''}`}
            >
              <span className="day-number">{day.date.getDate()}</span>
              
              <div className="day-events">
                {displayEvents.map(event => (
                  <div
                    key={event.id}
                    className={`event-block ${selectedEventId === event.id ? 'selected' : ''}`}
                    style={{ backgroundColor: event.color || '#7C3AED' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                
                {moreCount > 0 && (
                  <div className="more-events">+{moreCount} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}










