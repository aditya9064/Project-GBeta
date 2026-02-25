import { CalendarEvent } from '../../types/calendar';

interface EventPanelProps {
  event: CalendarEvent;
  onClose: () => void;
  onUpdate: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}

// Icons
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

const MapPinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23,7 16,12 23,17"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const BellIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const SparklesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z"/>
  </svg>
);

export function EventPanel({ event, onClose, onDelete }: EventPanelProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatReminderTime = (reminder: { time: Date }) => {
    const diff = event.startTime.getTime() - reminder.time.getTime();
    const minutes = Math.round(diff / (1000 * 60));
    
    if (minutes < 60) return `${minutes} minutes before`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hours before`;
    return `${Math.round(minutes / 1440)} days before`;
  };

  const getEventTypeLabel = () => {
    const labels = {
      meeting: 'Meeting',
      call: 'Call',
      focus: 'Focus Time',
      reminder: 'Reminder',
      task: 'Task'
    };
    return labels[event.eventType];
  };

  return (
    <div className="event-panel">
      <div className="event-panel-header">
        <span className="event-type-label">{getEventTypeLabel()}</span>
        <div className="event-panel-actions">
          <button className="panel-btn danger" onClick={() => onDelete(event.id)}>
            <TrashIcon />
          </button>
          <button className="panel-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>
      
      <div className="event-panel-content">
        <div 
          className="event-color-bar" 
          style={{ backgroundColor: event.color || '#7C3AED' }}
        />
        
        <h2 className="event-title">{event.title}</h2>
        
        {/* Time */}
        <div className="event-section">
          <div className="event-detail">
            <div className="event-detail-icon">
              <ClockIcon />
            </div>
            <div className="event-detail-content">
              <div className="event-detail-primary">
                {formatDate(event.startTime)}
              </div>
              <div className="event-detail-secondary">
                {formatTime(event.startTime)} – {formatTime(event.endTime)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Location */}
        {event.location && (
          <div className="event-section">
            <div className="event-detail">
              <div className="event-detail-icon">
                {event.location.type === 'virtual' ? <VideoIcon /> : <MapPinIcon />}
              </div>
              <div className="event-detail-content">
                <div className="event-detail-primary">
                  {event.location.type === 'virtual' ? 'Video Call' : event.location.address}
                </div>
                {event.location.meetingLink && (
                  <div className="event-detail-secondary">
                    <a 
                      href={event.location.meetingLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent-purple)' }}
                    >
                      Join meeting
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Participants */}
        {event.participants.length > 0 && (
          <div className="event-section">
            <div className="event-section-label">Participants</div>
            <div className="event-participants">
              {event.participants.map(participant => (
                <div key={participant.id} className="event-participant">
                  <div className="participant-avatar">
                    {participant.name.charAt(0)}
                  </div>
                  <div className="participant-info">
                    <div className="participant-name">{participant.name}</div>
                    <div className="participant-email">{participant.email}</div>
                  </div>
                  <span className={`participant-status ${participant.rsvpStatus}`}>
                    {participant.rsvpStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Reminders */}
        {event.reminders.length > 0 && (
          <div className="event-section">
            <div className="event-section-label">Reminders</div>
            <div className="event-reminders">
              {event.reminders.map(reminder => (
                <div key={reminder.id} className="event-reminder">
                  <BellIcon />
                  <span>{formatReminderTime(reminder)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Description */}
        {event.description && (
          <div className="event-section">
            <div className="event-section-label">Description</div>
            <div className="event-notes">{event.description}</div>
          </div>
        )}
        
        {/* AI Summary */}
        {event.aiSummary && (
          <div className="event-section">
            <div className="event-section-label">AI Summary</div>
            <div className="event-ai-summary">
              <div className="ai-summary-header">
                <SparklesIcon />
                <span className="ai-badge">AI Generated</span>
              </div>
              <div className="ai-summary-text">{event.aiSummary}</div>
            </div>
          </div>
        )}
        
        {/* Action Items */}
        {event.actionItems && event.actionItems.length > 0 && (
          <div className="event-section">
            <div className="event-section-label">Action Items</div>
            <div className="event-notes">
              {event.actionItems.map(item => (
                <div key={item.id} style={{ marginBottom: '8px' }}>
                  • {item.text}
                  {item.assignee && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {' '}— {item.assignee.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Meeting Notes */}
        {event.meetingNotes && (
          <div className="event-section">
            <div className="event-section-label">Meeting Notes</div>
            <div className="event-notes">{event.meetingNotes}</div>
          </div>
        )}
      </div>
    </div>
  );
}










