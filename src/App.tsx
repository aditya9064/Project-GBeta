import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './styles/clickup.css';
import { Calendar } from './components/calendar';
import { TeamsPage } from './components/teams';
import { DocsPage } from './components/docs';
import { TasksPage } from './components/tasks';
import { AuthPage } from './components/auth';
import { LandingPage } from './components/landing';
import { WhiteboardPage } from './components/whiteboard';
import { SmartCanvasPage } from './components/smartcanvas';
import { useAuth } from './contexts/AuthContext';
import { initialCalendarEvents } from './data/calendarData';

// Icons as inline SVGs
const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  Planner: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  AI: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  Teams: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Docs: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Dashboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Whiteboard: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
    </svg>
  ),
  SmartCanvas: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M8 7h8"/>
      <path d="M8 12h5"/>
      <path d="M16 14l2 2-2 2"/>
      <path d="M14 10l-3 6"/>
      <circle cx="17" cy="7" r="1.5" fill="currentColor"/>
    </svg>
  ),
  Forms: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Clips: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  ),
  More: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Invite: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  Upgrade: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 16,12 14,15 10,15 8,12 2,12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  Reply: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,17 4,12 9,7"/>
      <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
  AtSign: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  MoreHorizontal: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>
  ),
  Hash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  ArrowUpRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/>
      <polyline points="7,7 17,7 17,17"/>
    </svg>
  ),
  Folder: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10"/>
      <polyline points="1,20 1,14 7,14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  HelpCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  CalendarIcon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Sun: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  Monitor: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

// Export Icons for use in Calendar component
export { Icons };

// Placeholder page for features not yet implemented
function PlaceholderPage({ title, description, icon }: { title: string; description: string; icon: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    dashboard: <Icons.Dashboard />,
    whiteboard: <Icons.Whiteboard />,
    forms: <Icons.Forms />,
    clips: <Icons.Clips />,
    goals: <Icons.Star />,
    timesheets: <Icons.Clock />,
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '2rem',
      textAlign: 'center',
      color: 'var(--text-secondary)',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '16px',
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem',
        color: 'var(--accent-purple)',
      }}>
        <div style={{ transform: 'scale(2)' }}>{iconMap[icon]}</div>
      </div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.875rem', maxWidth: '400px', marginBottom: '1.5rem' }}>
        {description}
      </p>
      <span style={{ 
        padding: '0.5rem 1rem', 
        background: 'var(--bg-tertiary)', 
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)',
      }}>
        Coming Soon
      </span>
    </div>
  );
}

// Sidebar action icons
const SidebarIcons = {
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
  CollapseLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11,17 6,12 11,7"/>
      <polyline points="18,17 13,12 18,7"/>
    </svg>
  ),
  ExpandRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13,17 18,12 13,7"/>
      <polyline points="6,17 11,12 6,7"/>
    </svg>
  ),
};

function App() {
  const { user, userProfile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('primary');
  const [activeInboxItem, setActiveInboxItem] = useState('inbox');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme as 'light' | 'dark' | 'system';
    return 'dark';
  });

  // Derive active view from current route
  const getActiveView = () => {
    const path = location.pathname;
    if (path === '/calendar' || path === '/planner') return 'calendar';
    if (path === '/teams') return 'teams';
    if (path === '/docs') return 'docs';
    if (path === '/tasks') return 'tasks';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/whiteboard') return 'whiteboard';
    if (path === '/smartcanvas') return 'smartcanvas';
    if (path === '/forms') return 'forms';
    if (path === '/clips') return 'clips';
    if (path === '/goals') return 'goals';
    if (path === '/timesheets') return 'timesheets';
    return 'home';
  };
  const activeView = getActiveView();
  
  // Planner sidebar state
  const [triggerCreateEvent, setTriggerCreateEvent] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<typeof initialCalendarEvents>([]);
  const [assignedToMeExpanded, setAssignedToMeExpanded] = useState(false);
  const [todayOverdueExpanded, setTodayOverdueExpanded] = useState(false);
  const [showBacklogSettings, setShowBacklogSettings] = useState(false);
  const [showBacklogFilter, setShowBacklogFilter] = useState(false);
  const [backlogSearch, setBacklogSearch] = useState('');
  const [meetWithSearch, setMeetWithSearch] = useState('');

  // Theme effect - must be before early returns to follow Rules of Hooks
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', systemIsDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // All useCallback hooks must be before conditional returns (Rules of Hooks)
  const handleViewChange = useCallback((viewId: string) => {
    const routeMap: Record<string, string> = {
      'home': '/',
      'planner': '/calendar',
      'teams': '/teams',
      'docs': '/docs',
      'tasks': '/tasks',
      'dashboard': '/dashboard',
      'whiteboard': '/whiteboard',
      'smartcanvas': '/smartcanvas',
      'forms': '/forms',
      'clips': '/clips',
      'goals': '/goals',
      'timesheets': '/timesheets',
    };
    if (routeMap[viewId]) {
      navigate(routeMap[viewId]);
    }
  }, [navigate]);

  const handleThemeChange = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  }, []);

  // State for showing landing vs auth (must be before any early returns)
  const [showAuth, setShowAuth] = useState(false);

  // Show loading state
  if (loading) {
    return (
      <div className="app loading-screen" style={{ background: '#1E1F21', color: '#fff' }}>
        <div className="loading-container">
          <div className="loading-spinner-large" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing or auth page if not logged in
  if (!user) {
    if (showAuth) {
      return <AuthPage onBack={() => setShowAuth(false)} />;
    }
    return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  }

  // Get user display name and initials
  const displayName = userProfile?.displayName || user.displayName || user.email || 'User';
  const userInitials = displayName.charAt(0).toUpperCase();

  const iconRailItems = [
    { id: 'home', icon: Icons.Home, label: 'Home', active: activeView === 'home' },
    { id: 'planner', icon: Icons.Planner, label: 'Planner', active: activeView === 'calendar' },
    { id: 'tasks', icon: Icons.CheckCircle, label: 'Tasks', active: activeView === 'tasks' },
    { id: 'ai', icon: Icons.AI, label: 'AI' },
    { id: 'teams', icon: Icons.Teams, label: 'Team', active: activeView === 'teams' },
    { id: 'smartcanvas', icon: Icons.SmartCanvas, label: 'Canvas', active: activeView === 'smartcanvas' },
    { id: 'docs', icon: Icons.Docs, label: 'Docs', active: activeView === 'docs' },
    { id: 'dashboard', icon: Icons.Dashboard, label: 'Dashboard', active: activeView === 'dashboard' },
    { id: 'whiteboard', icon: Icons.Whiteboard, label: 'Whiteboard', active: activeView === 'whiteboard' },
    { id: 'forms', icon: Icons.Forms, label: 'Forms', active: activeView === 'forms' },
    { id: 'clips', icon: Icons.Clips, label: 'Clips', active: activeView === 'clips' },
    { id: 'goals', icon: Icons.Star, label: 'Goals', active: activeView === 'goals' },
    { id: 'timesheets', icon: Icons.Clock, label: 'Timesheets', active: activeView === 'timesheets' },
  ];

  const bottomIconRailItems = [
    { id: 'invite', icon: Icons.Invite, label: 'Invite' },
    { id: 'upgrade', icon: Icons.Upgrade, label: 'Upgrade' },
  ];

  const inboxItems = [
    { id: 'inbox', icon: Icons.Inbox, label: 'Inbox' },
    { id: 'replies', icon: Icons.Reply, label: 'Replies' },
    { id: 'comments', icon: Icons.AtSign, label: 'Assigned Comments' },
    { id: 'tasks', icon: Icons.User, label: 'My Tasks' },
    { id: 'more', icon: Icons.MoreHorizontal, label: 'More' },
  ];

  const channels = [
    { id: 'welcome', label: 'Welcome', icon: 'hash' },
    { id: 'general', label: 'General', sublabel: `${displayName}'s Workspace`, avatar: true },
  ];

  const tabs = [
    { id: 'primary', label: 'Primary', icon: Icons.Inbox },
    { id: 'other', label: 'Other', icon: Icons.ArrowUpRight },
    { id: 'later', label: 'Later', icon: Icons.Clock },
    { id: 'cleared', label: 'Cleared', icon: Icons.Check },
  ];

  return (
    <div className="app">
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="top-nav-left">
          <div className="workspace-selector">
            <div className="workspace-avatar">{userInitials}</div>
            <span className="workspace-name">{displayName}'s Workspace</span>
            <Icons.ChevronDown />
          </div>
          <button className="icon-btn">
            <Icons.Folder />
          </button>
        </div>

        <div className="search-bar">
          <Icons.Search />
          <span className="search-placeholder">Search</span>
          <span className="search-shortcut">⌘ K</span>
          <div className="search-ai">
            <Icons.Sparkles />
          </div>
        </div>

        <div className="top-nav-right">
          <button className="icon-btn"><Icons.RefreshCw /></button>
          <button className="icon-btn" onClick={() => setIsSettingsOpen(true)}><Icons.Settings /></button>
          <button className="icon-btn"><Icons.HelpCircle /></button>
          <button className="icon-btn"><Icons.Bell /></button>
          <button className="icon-btn"><Icons.CalendarIcon /></button>
          <div className="user-menu">
            <div className="user-avatar" title={displayName}>{userInitials}</div>
            <button className="sign-out-btn" onClick={() => signOut()} title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="main-container">
        {/* Icon Rail */}
        <nav className="icon-rail">
          <div className="icon-rail-top">
            {isSidebarCollapsed && (
              <button 
                className="rail-item expand-btn"
                title="Expand sidebar"
                onClick={() => setIsSidebarCollapsed(false)}
              >
                <SidebarIcons.ExpandRight />
              </button>
            )}
            {iconRailItems.map(item => (
              <button 
                key={item.id} 
                className={`rail-item ${item.active ? 'active' : ''}`}
                title={item.label}
                onClick={() => handleViewChange(item.id)}
              >
                <item.icon />
                <span className="rail-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="icon-rail-bottom">
            {bottomIconRailItems.map(item => (
              <button key={item.id} className="rail-item" title={item.label}>
                <item.icon />
                <span className="rail-label">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Home Sidebar */}
        {activeView === 'home' && !isSidebarCollapsed && (
        <aside className="secondary-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-left">
              <h2 className="sidebar-title">Home</h2>
              <div className="sidebar-header-actions">
                <button className="sidebar-action-btn" title="Search">
                  <SidebarIcons.Search />
                </button>
                <button className="sidebar-action-btn" title="Filter">
                  <SidebarIcons.Filter />
                </button>
                <button 
                  className="sidebar-action-btn" 
                  title="Collapse sidebar"
                  onClick={() => setIsSidebarCollapsed(true)}
                >
                  <SidebarIcons.CollapseLeft />
                </button>
              </div>
            </div>
            <button className="create-btn">
              <Icons.Plus />
              <span>Create</span>
            </button>
          </div>

          {/* Inbox Section */}
          <div className="sidebar-section">
            {inboxItems.map(item => (
              <button
                key={item.id}
                className={`sidebar-item ${activeInboxItem === item.id ? 'active' : ''}`}
                onClick={() => setActiveInboxItem(item.id)}
              >
                <item.icon />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-divider" />

          {/* Favorites */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Favorites</span>
            </div>
            <p className="section-hint">
              Click <Icons.Star /> to add favorites to your sidebar.
            </p>
          </div>

          <div className="sidebar-divider" />

          {/* Channels */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Channels</span>
            </div>
            {channels.map(channel => (
              <button key={channel.id} className="sidebar-item channel-item">
                {channel.avatar ? (
                  <div className="channel-avatar">A</div>
                ) : (
                  <Icons.Hash />
                )}
                <span className="channel-name">{channel.label}</span>
                {channel.sublabel && <span className="channel-sublabel">- {channel.sublabel}</span>}
              </button>
            ))}
            <button className="sidebar-item add-item">
              <Icons.Plus />
              <span>Add Channel</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          {/* Direct Messages */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Direct Messages</span>
            </div>
            <button className="sidebar-item">
              <div className="dm-avatar">A</div>
              <span className="dm-name">Aditya</span>
              <span className="dm-you">— You</span>
            </button>
            <button className="sidebar-item add-item">
              <Icons.Plus />
              <span>New message</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          {/* Spaces */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Spaces</span>
              <button className="section-action">
                <Icons.Plus />
              </button>
            </div>
            <button className="sidebar-item space-item">
              <div className="space-icon grid">
                <Icons.Grid />
              </div>
              <span className="space-name">All Tasks</span>
              <span className="space-sublabel">- Aditya's Workspace</span>
            </button>
            <button className="sidebar-item space-item">
              <div className="space-icon folder">S</div>
              <span className="space-name">Team Space</span>
            </button>
            <button className="sidebar-item add-item">
              <Icons.Plus />
              <span>New Space</span>
            </button>
          </div>
        </aside>
        )}

        {/* Planner Sidebar */}
        {activeView === 'calendar' && !isSidebarCollapsed && (
        <aside className="secondary-sidebar planner-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-left">
              <h2 className="sidebar-title">Planner</h2>
              <div className="sidebar-header-actions">
                <button 
                  className="sidebar-action-btn" 
                  title="Collapse sidebar"
                  onClick={() => setIsSidebarCollapsed(true)}
                >
                  <SidebarIcons.CollapseLeft />
                </button>
              </div>
            </div>
            <button 
              className="create-btn" 
              title="Create new event"
              onClick={() => setTriggerCreateEvent(true)}
            >
              <Icons.Plus />
            </button>
          </div>

          {/* Priorities Section */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Priorities</span>
            </div>
            {calendarEvents.filter(e => e.eventType === 'task' && e.status !== 'completed').length === 0 ? (
              <div className="priority-empty-state">
                <div className="priority-flag">🚩</div>
                <p>Prioritize a Task to see it appear here</p>
              </div>
            ) : (
              <div className="priority-list">
                {calendarEvents.filter(e => e.eventType === 'task' && e.status !== 'completed').slice(0, 5).map(event => (
                  <div key={event.id} className="priority-item" style={{ borderLeftColor: event.color }}>
                    <span className="priority-item-title">{event.title}</span>
                    <span className="priority-item-time">
                      {new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button 
              className="sidebar-item add-item"
              onClick={() => setTriggerCreateEvent(true)}
            >
              <Icons.Plus />
              <span>Add priority</span>
            </button>
          </div>

          <div className="sidebar-divider" />

          {/* Meet with Section */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Meet with</span>
            </div>
            <div className="meet-with-search">
              <SidebarIcons.Search />
              <input 
                type="text" 
                placeholder="Search for people..." 
                value={meetWithSearch}
                onChange={(e) => setMeetWithSearch(e.target.value)}
              />
            </div>
            {meetWithSearch && (
              <div className="meet-with-results">
                <div className="meet-with-empty">
                  <p>No contacts found matching "{meetWithSearch}"</p>
                  <button 
                    className="meet-with-schedule-btn"
                    onClick={() => {
                      setMeetWithSearch('');
                      setTriggerCreateEvent(true);
                    }}
                  >
                    Schedule meeting anyway
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* Assigned to me */}
          <div className="sidebar-section">
            <button 
              className={`sidebar-item expandable ${assignedToMeExpanded ? 'expanded' : ''}`}
              onClick={() => setAssignedToMeExpanded(!assignedToMeExpanded)}
            >
              <span>Assigned to me</span>
              <span className={`expand-icon ${assignedToMeExpanded ? 'rotated' : ''}`}>
                <Icons.ChevronRight />
              </span>
            </button>
            {assignedToMeExpanded && (
              <div className="expandable-content">
                {calendarEvents.filter(e => e.participants?.length > 0 && e.status !== 'completed').length === 0 ? (
                  <div className="expandable-empty">
                    <p>No events assigned to you</p>
                  </div>
                ) : (
                  <div className="assigned-events-list">
                    {calendarEvents.filter(e => e.participants?.length > 0 && e.status !== 'completed').slice(0, 5).map(event => (
                      <div key={event.id} className="assigned-event-item" style={{ borderLeftColor: event.color }}>
                        <span className="assigned-event-title">{event.title}</span>
                        <span className="assigned-event-time">
                          {new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* Today & overdue */}
          <div className="sidebar-section">
            <button 
              className={`sidebar-item expandable ${todayOverdueExpanded ? 'expanded' : ''}`}
              onClick={() => setTodayOverdueExpanded(!todayOverdueExpanded)}
            >
              <span>Today & overdue</span>
              <span className={`expand-icon ${todayOverdueExpanded ? 'rotated' : ''}`}>
                <Icons.ChevronRight />
              </span>
            </button>
            {todayOverdueExpanded && (
              <div className="expandable-content">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const todayEnd = new Date(today);
                  todayEnd.setHours(23, 59, 59, 999);
                  
                  const todayEvents = calendarEvents.filter(e => {
                    const eventDate = new Date(e.startTime);
                    return eventDate >= today && eventDate <= todayEnd && e.status !== 'completed';
                  });
                  
                  const overdueEvents = calendarEvents.filter(e => {
                    const eventDate = new Date(e.startTime);
                    return eventDate < today && e.status !== 'completed';
                  });
                  
                  if (todayEvents.length === 0 && overdueEvents.length === 0) {
                    return (
                      <div className="expandable-empty">
                        <p>No events today or overdue</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="today-overdue-list">
                      {overdueEvents.length > 0 && (
                        <div className="overdue-section">
                          <div className="overdue-label">Overdue ({overdueEvents.length})</div>
                          {overdueEvents.slice(0, 3).map(event => (
                            <div key={event.id} className="overdue-event-item">
                              <span className="overdue-event-title">{event.title}</span>
                              <span className="overdue-event-time">
                                {new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {todayEvents.length > 0 && (
                        <div className="today-section">
                          <div className="today-label">Today ({todayEvents.length})</div>
                          {todayEvents.slice(0, 3).map(event => (
                            <div key={event.id} className="today-event-item" style={{ borderLeftColor: event.color }}>
                              <span className="today-event-title">{event.title}</span>
                              <span className="today-event-time">
                                {event.isAllDay ? 'All day' : new Date(event.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="sidebar-divider" />

          {/* Backlog */}
          <div className="sidebar-section">
            <div className="section-header">
              <span>Backlog</span>
            </div>
            <div className="backlog-list-header">
              <button className="backlog-list-btn active">
                <div className="list-avatar">P</div>
                <span>Personal List</span>
              </button>
              <div className="backlog-actions-wrapper">
                <button 
                  className={`backlog-action-btn ${showBacklogSettings ? 'active' : ''}`}
                  title="Settings"
                  onClick={() => {
                    setShowBacklogSettings(!showBacklogSettings);
                    setShowBacklogFilter(false);
                  }}
                >
                  <Icons.Settings />
                </button>
                <button 
                  className={`backlog-action-btn ${showBacklogFilter ? 'active' : ''}`}
                  title="Filter"
                  onClick={() => {
                    setShowBacklogFilter(!showBacklogFilter);
                    setShowBacklogSettings(false);
                  }}
                >
                  <SidebarIcons.Filter />
                </button>
              </div>
              <input 
                type="text" 
                placeholder="Search..." 
                className="backlog-search"
                value={backlogSearch}
                onChange={(e) => setBacklogSearch(e.target.value)}
              />
            </div>
            
            {/* Settings Dropdown */}
            {showBacklogSettings && (
              <div className="backlog-dropdown">
                <button className="dropdown-item" onClick={() => setShowBacklogSettings(false)}>
                  <Icons.Settings />
                  <span>Configure list</span>
                </button>
                <button className="dropdown-item" onClick={() => setShowBacklogSettings(false)}>
                  <Icons.Plus />
                  <span>Create new list</span>
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => setShowBacklogSettings(false)}>
                  <Icons.ArrowUpRight />
                  <span>View all tasks</span>
                </button>
              </div>
            )}
            
            {/* Filter Dropdown */}
            {showBacklogFilter && (
              <div className="backlog-dropdown">
                <div className="dropdown-label">Show</div>
                <button className="dropdown-item active" onClick={() => setShowBacklogFilter(false)}>
                  <Icons.CheckCircle />
                  <span>All tasks</span>
                </button>
                <button className="dropdown-item" onClick={() => setShowBacklogFilter(false)}>
                  <Icons.Clock />
                  <span>Due today</span>
                </button>
                <button className="dropdown-item" onClick={() => setShowBacklogFilter(false)}>
                  <Icons.Star />
                  <span>High priority</span>
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => setShowBacklogFilter(false)}>
                  <Icons.Check />
                  <span>Completed</span>
                </button>
              </div>
            )}
            
            {/* Backlog Content */}
            {(() => {
              const backlogTasks = calendarEvents
                .filter(e => e.eventType === 'task' && e.status !== 'completed')
                .filter(e => !backlogSearch || e.title.toLowerCase().includes(backlogSearch.toLowerCase()));
              
              if (backlogTasks.length === 0) {
                return (
                  <div className="backlog-empty-state">
                    <p>{backlogSearch ? `No tasks matching "${backlogSearch}"` : 'No tasks in backlog'}</p>
                  </div>
                );
              }
              
              return (
                <div className="backlog-tasks-list">
                  {backlogTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="backlog-task-item">
                      <div className="backlog-task-checkbox" style={{ borderColor: task.color }} />
                      <span className="backlog-task-title">{task.title}</span>
                    </div>
                  ))}
                  {backlogTasks.length > 5 && (
                    <div className="backlog-more">+{backlogTasks.length - 5} more tasks</div>
                  )}
                </div>
              );
            })()}
          </div>
        </aside>
        )}

        {/* Main Content */}
        <main className={`main-content ${activeView === 'docs' ? 'docs-view' : ''} ${activeView === 'smartcanvas' ? 'smartcanvas-view' : ''}`}>
          <Routes>
            <Route path="/calendar" element={
              <Calendar 
                initialEvents={initialCalendarEvents}
                onEventsChange={setCalendarEvents}
                externalTriggerCreate={triggerCreateEvent}
                onCreateModalOpened={() => setTriggerCreateEvent(false)}
              />
            } />
            <Route path="/planner" element={
              <Calendar 
                initialEvents={initialCalendarEvents}
                onEventsChange={setCalendarEvents}
                externalTriggerCreate={triggerCreateEvent}
                onCreateModalOpened={() => setTriggerCreateEvent(false)}
              />
            } />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" description="Create dashboards with widgets to visualize your data." icon="dashboard" />} />
            <Route path="/whiteboard" element={<WhiteboardPage />} />
            <Route path="/smartcanvas" element={<SmartCanvasPage />} />
            <Route path="/forms" element={<PlaceholderPage title="Forms" description="Create forms to collect data from your team or clients." icon="forms" />} />
            <Route path="/clips" element={<PlaceholderPage title="Clips" description="Record and share screen recordings with your team." icon="clips" />} />
            <Route path="/goals" element={<PlaceholderPage title="Goals" description="Set and track goals for you and your team." icon="goals" />} />
            <Route path="/timesheets" element={<PlaceholderPage title="Timesheets" description="Track time spent on tasks and projects." icon="timesheets" />} />
            <Route path="/" element={
              <>
                {/* Tabs */}
                <div className="content-tabs">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <tab.icon />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Toolbar */}
                <div className="content-toolbar">
                  <button className="filter-btn">
                    <Icons.Filter />
                    <span>Filter</span>
                  </button>
                  <div className="toolbar-right">
                    <button className="icon-btn small">
                      <Icons.Settings />
                    </button>
                    <button className="clear-btn">
                      <Icons.Check />
                      <span>Clear all</span>
                    </button>
                  </div>
                </div>

                {/* Empty State */}
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                      <rect x="15" y="25" width="50" height="35" rx="4" fill="var(--accent-purple)"/>
                      <path d="M15 45L30 35H50L65 45" stroke="var(--accent-purple-light)" strokeWidth="3" fill="none"/>
                      <rect x="25" y="15" width="30" height="20" rx="3" fill="var(--accent-purple-light)"/>
                    </svg>
                  </div>
                  <h2 className="empty-title">Inbox Zero</h2>
                  <p className="empty-text">Congratulations! You cleared your important notifications 🎉</p>
                </div>

                {/* Quote Section */}
                <div className="quote-section">
                  <div className="quote-label">Motivational Quote</div>
                  <blockquote className="quote-text">
                    An entrepreneur is someone who jumps off a cliff and builds a plane on the way down.
                  </blockquote>
                  <cite className="quote-author">— Reid Hoffman</cite>
                </div>

                {/* Footer */}
                <div className="content-footer">
                  <div className="footer-indicator">
                    <span className="indicator-icon">👻</span>
                    <span className="indicator-text">1/5</span>
                  </div>
                </div>
              </>
            } />
          </Routes>
        </main>
      </div>

      {/* Settings Modal */}
      <div className={`modal-overlay ${isSettingsOpen ? 'open' : ''}`} onClick={() => setIsSettingsOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Settings</h3>
            <button className="modal-close-btn" onClick={() => setIsSettingsOpen(false)}>
              <Icons.X />
            </button>
          </div>
          <div className="theme-options">
            <button
              className={`theme-option ${theme === 'light' ? 'selected' : ''}`}
              onClick={() => handleThemeChange('light')}
              type="button"
            >
              <div className="theme-preview light"><Icons.Sun /></div>
              <span className="theme-label">Light</span>
              {theme === 'light' && <Icons.CheckCircle />}
            </button>
            <button
              className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}
              onClick={() => handleThemeChange('dark')}
              type="button"
            >
              <div className="theme-preview dark"><Icons.Moon /></div>
              <span className="theme-label">Dark</span>
              {theme === 'dark' && <Icons.CheckCircle />}
            </button>
            <button
              className={`theme-option ${theme === 'system' ? 'selected' : ''}`}
              onClick={() => handleThemeChange('system')}
              type="button"
            >
              <div className="theme-preview system"><Icons.Monitor /></div>
              <span className="theme-label">System</span>
              {theme === 'system' && <Icons.CheckCircle />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
