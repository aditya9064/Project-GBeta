import React, { useState, useRef, useEffect } from 'react';
import { Bell, Bot, Mail, AlertTriangle, CheckCircle2, Info, X, Check } from 'lucide-react';
import type { AppNotification } from '../../hooks/useNotifications';

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigate: (path: string) => void;
}

function getTypeIcon(type: AppNotification['type']) {
  switch (type) {
    case 'agent_failure':
    case 'agent_success':
      return <Bot size={16} />;
    case 'message':
      return <Mail size={16} />;
    case 'escalation':
      return <AlertTriangle size={16} />;
    case 'task_due':
      return <CheckCircle2 size={16} />;
    case 'info':
    default:
      return <Info size={16} />;
  }
}

function getTypeColor(type: AppNotification['type']): string {
  switch (type) {
    case 'agent_failure': return '#ef4444';
    case 'agent_success': return '#22c55e';
    case 'message': return '#e07a3a';
    case 'escalation': return '#f59e0b';
    case 'task_due': return '#d46b2c';
    case 'info':
    default: return '#6b7280';
  }
}

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleNotificationClick(notif: AppNotification) {
    if (!notif.read) onMarkAsRead(notif.id);
    if (notif.link) {
      onNavigate(notif.link);
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        title="Notifications"
        className="operonai-nav-item"
        style={{ position: 'relative' }}
      >
        <span className="operonai-nav-item-icon">
          <Bell size={18} />
        </span>
        <span className="operonai-nav-item-text">Notifications</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: '50%',
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            left: '100%',
            bottom: 0,
            marginLeft: 8,
            width: 360,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'var(--bg-primary, #fff)',
            color: 'var(--text-primary, #1a1a1a)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color, #e5e7eb)',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  title="Mark all as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-accent, #e07a3a)',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  <Check size={14} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #6b7280)',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--text-secondary, #6b7280)',
                fontSize: 13,
              }}
            >
              No notifications yet
            </div>
          ) : (
            <>
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 16px',
                    cursor: notif.link ? 'pointer' : 'default',
                    background: notif.read
                      ? 'transparent'
                      : 'var(--bg-secondary, #f0f5ff)',
                    borderBottom: '1px solid var(--border-color, #e5e7eb)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (notif.link) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover, #f3f4f6)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = notif.read
                      ? 'transparent'
                      : 'var(--bg-secondary, #f0f5ff)';
                  }}
                >
                  <div
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${getTypeColor(notif.type)}18`,
                      color: getTypeColor(notif.type),
                      marginTop: 2,
                    }}
                  >
                    {getTypeIcon(notif.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: notif.read ? 400 : 600,
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notif.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-secondary, #9ca3af)',
                          flexShrink: 0,
                        }}
                      >
                        {relativeTime(notif.timestamp)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary, #6b7280)',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {notif.description}
                    </div>
                  </div>
                  {!notif.read && (
                    <div
                      style={{
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#e07a3a',
                        marginTop: 6,
                      }}
                    />
                  )}
                </div>
              ))}
              {/* Footer */}
              <div
                style={{
                  padding: '10px 16px',
                  textAlign: 'center',
                  borderTop: '1px solid var(--border-color, #e5e7eb)',
                }}
              >
                <button
                  onClick={onClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary, #6b7280)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
