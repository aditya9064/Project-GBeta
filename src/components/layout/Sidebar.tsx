import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Building2, CheckSquare, BarChart3, Inbox, Calendar, Settings, Search, Star, ChevronDown, Plus, Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Avatar, IconButton } from '../ui';
import { currentUser, workspaces } from '../../data/mockData';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

const mainNavItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'inbox', label: 'Inbox', icon: Inbox, badge: 3 },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'companies', label: 'Companies', icon: Building2 },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: 5 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const favoriteItems = [
  { id: 'fav-1', label: 'Enterprise Deals', icon: Star },
  { id: 'fav-2', label: 'Q1 Pipeline', icon: Star },
];

export function Sidebar({ currentView, onViewChange, theme, onThemeToggle }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const currentWorkspace = workspaces[0];

  const sidebarWidth = isCollapsed ? 72 : 260;

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-secondary)',
        borderRight: '1px solid var(--color-border-subtle)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header / Workspace Selector */}
      <div style={{ padding: '1rem', position: 'relative' }}>
        <button
          onClick={() => !isCollapsed && setShowWorkspaces(!showWorkspaces)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem',
            width: '100%',
            borderRadius: '8px',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 8, background: currentWorkspace.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
            {currentWorkspace.icon}
          </div>
          {!isCollapsed && (
            <>
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.8125rem', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentWorkspace.name}</span>
              <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            </>
          )}
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.5rem 0.75rem',
            background: 'var(--color-bg-tertiary)',
            borderRadius: '8px',
            color: 'var(--color-text-tertiary)',
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}>
            <Search size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>Search</span>
            <kbd style={{ fontSize: 11, padding: '2px 6px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 4 }}>⌘K</kbd>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 0.75rem' }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {mainNavItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: currentView === item.id ? 'var(--color-bg-selected)' : 'transparent',
                  color: currentView === item.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 100ms ease',
                }}
              >
                <item.icon size={18} />
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                    {item.badge && (
                      <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--color-accent-muted)', color: 'var(--color-accent)', borderRadius: 9999 }}>
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Favorites */}
        {!isCollapsed && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.75rem 0.5rem', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Favorites</span>
              <IconButton aria-label="Add favorite" size="sm"><Plus size={14} /></IconButton>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {favoriteItems.map(item => (
                <li key={item.id}>
                  <button style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}>
                    <item.icon size={16} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <IconButton aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onClick={onThemeToggle} size="sm">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconButton>
          <IconButton aria-label="Settings" onClick={() => onViewChange('settings')} size="sm">
            <Settings size={16} />
          </IconButton>
          <IconButton aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setIsCollapsed(!isCollapsed)} size="sm">
            {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </IconButton>
        </div>

        <button style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '8px', background: 'transparent', cursor: 'pointer' }}>
          <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{currentUser.name}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)', textTransform: 'capitalize' }}>{currentUser.role}</span>
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
