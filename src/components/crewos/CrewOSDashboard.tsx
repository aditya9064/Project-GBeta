import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  Settings,
  Zap,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Monitor,
  Sun,
  Moon,
} from 'lucide-react';
import './CrewOSDashboard.css';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { useSwarm } from '../../hooks/useComputerUse';
import { GoalInput } from './GoalInput';

const ExecutionView = lazy(() => import('./ExecutionView'));
const WorkflowTemplates = lazy(() => import('./WorkflowTemplates'));
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.SettingsPage })));

type NavItem = 'dashboard' | 'execution' | 'workflows' | 'settings';

const NAV_ITEMS: { id: NavItem; label: string; icon: typeof Layers }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Layers },
  { id: 'execution', label: 'Executions', icon: Monitor },
  { id: 'workflows', label: 'Workflows', icon: Zap },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const pathToNav: Record<string, NavItem> = {
  '/dashboard': 'dashboard',
  '/execution': 'execution',
  '/workflows': 'workflows',
  '/settings': 'settings',
};

const navToPath: Record<NavItem, string> = {
  dashboard: '/dashboard',
  execution: '/execution',
  workflows: '/workflows',
  settings: '/settings',
};

export function CrewOSDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeCount } = useSwarm();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const activeNav: NavItem = pathToNav[location.pathname] || 'dashboard';

  const handleNav = useCallback((id: NavItem) => {
    navigate(navToPath[id]);
  }, [navigate]);

  useEffect(() => {
    if (location.pathname === '/app' || location.pathname === '/app/') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const handleGoalSubmitted = useCallback((_swarmId: string) => {
    navigate('/execution');
  }, [navigate]);

  return (
    <div className={`operonai-app ${theme}`}>
      {/* ─── Sidebar ─── */}
      <aside className={`oa-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="oa-sidebar-header">
          <div className="oa-logo">
            <Layers size={24} />
            {!sidebarCollapsed && <span>OperonAI</span>}
          </div>
          <button
            className="oa-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="oa-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`oa-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => handleNav(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.id === 'execution' && activeCount > 0 && (
                <span className="oa-badge">{activeCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="oa-sidebar-footer">
          <button className="oa-nav-item" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {!sidebarCollapsed && <span>Theme</span>}
          </button>
          {user && (
            <button className="oa-nav-item" onClick={signOut} title="Sign out">
              <LogOut size={20} />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="oa-main">
        <Suspense fallback={<div className="oa-loading">Loading...</div>}>
          {activeNav === 'dashboard' && (
            <GoalInput onGoalSubmitted={handleGoalSubmitted} />
          )}
          {activeNav === 'execution' && <ExecutionView />}
          {activeNav === 'workflows' && <WorkflowTemplates />}
          {activeNav === 'settings' && <SettingsPage />}
        </Suspense>
      </main>
    </div>
  );
}
