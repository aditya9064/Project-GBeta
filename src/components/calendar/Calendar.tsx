import { useState, useCallback } from 'react';
import { CalendarEvent, CalendarView, ParsedEventIntent } from '../../types/calendar';
import { parseEventIntent, createEventFromIntent, generateConfirmation } from '../../utils/aiEventParser';
import { useEvents } from '../../hooks/useEvents';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { AgendaView } from './AgendaView';
import { EventPanel } from './EventPanel';
import { AICalendarInput } from './AICalendarInput';
import './Calendar.css';

// Icons
const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,6 15,12 9,18"/>
  </svg>
);

export function Calendar() {
  const { events, loading, error, createEvent, updateEvent, deleteEvent } = useEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<ParsedEventIntent | null>(null);

  // Navigation
  const navigatePrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, view]);

  const navigateNext = useCallback(() => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  }, [currentDate, view]);

  const navigateToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // Format header title
  const getHeaderTitle = () => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'long', 
      year: 'numeric' 
    };
    
    if (view === 'day') {
      return currentDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric',
        year: 'numeric' 
      });
    }
    
    if (view === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    return currentDate.toLocaleDateString('en-US', options);
  };

  // Handle AI input
  const handleAIInput = useCallback(async (input: string) => {
    const intent = parseEventIntent(input);
    
    if (intent.needsClarification) {
      setPendingIntent(intent);
      setAiMessage(`🤔 ${intent.needsClarification.question}`);
      return;
    }
    
    if (intent.confidence >= 0.6) {
      const event = createEventFromIntent(intent);
      if (event) {
        const { id: _id, createdAt: _ca, updatedAt: _ua, createdBy: _cb, ...eventData } = event;
        const newId = await createEvent(eventData);
        if (newId) {
          setAiMessage(generateConfirmation(event));
          setCurrentDate(event.startTime);
          setTimeout(() => setAiMessage(null), 4000);
        } else {
          setAiMessage('Failed to create event. Please try again.');
          setTimeout(() => setAiMessage(null), 3000);
        }
      }
    } else {
      setAiMessage("I'm not sure what you want to schedule. Could you be more specific?");
      setTimeout(() => setAiMessage(null), 3000);
    }
  }, [createEvent]);

  // Handle clarification response
  const handleClarification = useCallback(async (response: string) => {
    if (!pendingIntent) return;
    
    const updatedInput = `${pendingIntent.title} ${response}`;
    const newIntent = parseEventIntent(updatedInput);
    
    const event = createEventFromIntent(newIntent);
    if (event) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, createdBy: _cb, ...eventData } = event;
      const newId = await createEvent(eventData);
      if (newId) {
        setAiMessage(generateConfirmation(event));
        setCurrentDate(event.startTime);
        setTimeout(() => setAiMessage(null), 4000);
      }
    }
    
    setPendingIntent(null);
  }, [pendingIntent, createEvent]);

  // Event handlers
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleEventUpdate = useCallback(async (updatedEvent: CalendarEvent) => {
    const { id, createdAt: _ca, updatedAt: _ua, createdBy: _cb, ...updates } = updatedEvent;
    const success = await updateEvent(id, updates);
    if (success) {
      setSelectedEvent(updatedEvent);
    }
  }, [updateEvent]);

  const handleEventDelete = useCallback(async (eventId: string) => {
    const success = await deleteEvent(eventId);
    if (success) {
      setSelectedEvent(null);
      setAiMessage('Event deleted');
      setTimeout(() => setAiMessage(null), 2000);
    }
  }, [deleteEvent]);

  const handleClosePanel = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  // Handle drag reschedule
  const handleEventDrop = useCallback(async (eventId: string, newStart: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const duration = event.endTime.getTime() - event.startTime.getTime();
    const success = await updateEvent(eventId, {
      startTime: newStart,
      endTime: new Date(newStart.getTime() + duration),
    });
    
    if (success) {
      setAiMessage('Event rescheduled');
      setTimeout(() => setAiMessage(null), 2000);
    }
  }, [events, updateEvent]);

  // Render current view
  const renderView = () => {
    const viewProps = {
      currentDate,
      events,
      onEventClick: handleEventClick,
      onEventDrop: handleEventDrop,
      selectedEventId: selectedEvent?.id,
    };

    switch (view) {
      case 'day':
        return <DayView {...viewProps} />;
      case 'week':
        return <WeekView {...viewProps} />;
      case 'agenda':
        return <AgendaView {...viewProps} />;
      default:
        return <MonthView {...viewProps} />;
    }
  };

  const views: { id: CalendarView; label: string }[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'agenda', label: 'Agenda' },
  ];

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-left">
          <h1 className="calendar-title">{getHeaderTitle()}</h1>
          <div className="calendar-nav">
            <button className="nav-btn" onClick={navigatePrevious}>
              <ChevronLeft />
            </button>
            <button className="nav-btn today-btn" onClick={navigateToday}>
              Today
            </button>
            <button className="nav-btn" onClick={navigateNext}>
              <ChevronRight />
            </button>
          </div>
        </div>
        
        <div className="calendar-header-right">
          <div className="view-tabs">
            {views.map(v => (
              <button
                key={v.id}
                className={`view-tab ${view === v.id ? 'active' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading / Error State */}
      {loading && (
        <div className="ai-message">
          <span>Loading events...</span>
        </div>
      )}
      {error && (
        <div className="ai-message" style={{ color: '#ef4444' }}>
          <span>{error}</span>
        </div>
      )}

      {/* AI Message */}
      {aiMessage && (
        <div className="ai-message">
          <span>{aiMessage}</span>
        </div>
      )}

      {/* Clarification Options */}
      {pendingIntent?.needsClarification && (
        <div className="clarification-options">
          {pendingIntent.needsClarification.options?.map(option => (
            <button
              key={option}
              className="clarification-btn"
              onClick={() => handleClarification(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="calendar-body">
        <div className={`calendar-main ${selectedEvent ? 'with-panel' : ''}`}>
          {renderView()}
        </div>

        {/* Event Detail Panel */}
        {selectedEvent && (
          <EventPanel
            event={selectedEvent}
            onClose={handleClosePanel}
            onUpdate={handleEventUpdate}
            onDelete={handleEventDelete}
          />
        )}
      </div>

      {/* AI Input */}
      <AICalendarInput onSubmit={handleAIInput} />
    </div>
  );
}










