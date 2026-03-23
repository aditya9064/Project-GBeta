import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Mail,
  Plus,
  ArrowRight,
  Activity,
  Clock,
  Zap,
  AlertCircle,
  Users,
  GitBranch,
  Sparkles,
  TrendingUp,
  FileText,
  CheckCircle2,
  ShoppingCart,
} from 'lucide-react';
import { useAgents } from '../../contexts/AgentContext';

const ACCENT = '#e07a3a';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  minWidth: 0,
};

const iconWrapStyle = (bg: string): React.CSSProperties => ({
  width: 42,
  height: 42,
  borderRadius: 10,
  background: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const statLabel: React.CSSProperties = {
  fontSize: 13,
  color: '#6b7280',
  fontWeight: 500,
  marginBottom: 2,
};

const statValue: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: '#111827',
  lineHeight: 1.1,
};

export function HomePage() {
  const navigate = useNavigate();
  const { agents } = useAgents();

  const stats = useMemo(() => {
    const active = agents.filter((a) => a.status === 'active').length;
    const total = agents.length;
    const totalRuns = agents.reduce((sum, a) => sum + (a.totalExecutions || 0), 0);
    const successRuns = agents.reduce((sum, a) => sum + (a.successfulExecutions || 0), 0);
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
    return { active, total, totalRuns, successRate };
  }, [agents]);

  const recentActivity = useMemo(() => {
    return agents
      .filter((a) => a.lastExecutedAt)
      .sort((a, b) => {
        const ta = a.lastExecutedAt instanceof Date ? a.lastExecutedAt.getTime() : new Date(a.lastExecutedAt as any).getTime();
        const tb = b.lastExecutedAt instanceof Date ? b.lastExecutedAt.getTime() : new Date(b.lastExecutedAt as any).getTime();
        return tb - ta;
      })
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        name: a.name,
        status: (a as any).lastExecutionStatus === 'completed' ? 'success' as const : (a as any).lastExecutionStatus === 'failed' ? 'fail' as const : 'success' as const,
        timestamp: a.lastExecutedAt instanceof Date ? a.lastExecutedAt : new Date(a.lastExecutedAt as any),
        totalExecutions: a.totalExecutions,
      }));
  }, [agents]);

  const quickActions = [
    { label: 'Chat with Agent', icon: <Sparkles size={20} />, path: '/chat', color: ACCENT, description: 'Ask AI to do anything' },
    { label: 'My Agents', icon: <Bot size={20} />, path: '/agents', color: '#e07a3a', description: 'View & manage agents' },
    { label: 'Build Workflow', icon: <GitBranch size={20} />, path: '/workflow', color: '#10b981', description: 'Visual automation builder' },
    { label: 'Crews & Orchestration', icon: <Users size={20} />, path: '/workforce', color: '#6366f1', description: 'Team coordination' },
    { label: 'Communications', icon: <Mail size={20} />, path: '/comms', color: '#0ea5e9', description: 'AI-powered email & messaging' },
    { label: 'Marketplace', icon: <ShoppingCart size={20} />, path: '/marketplace', color: '#f59e0b', description: 'Browse agent templates' },
  ];

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
          Your AI workforce at a glance
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={cardStyle}>
          <div style={iconWrapStyle(`${ACCENT}18`)}>
            <Bot size={20} color={ACCENT} />
          </div>
          <div>
            <div style={statLabel}>Total Agents</div>
            <div style={statValue}>{stats.total}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconWrapStyle('#10b98118')}>
            <CheckCircle2 size={20} color="#10b981" />
          </div>
          <div>
            <div style={statLabel}>Active</div>
            <div style={statValue}>{stats.active}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconWrapStyle('rgba(99,102,241,0.1)')}>
            <Activity size={20} color="#6366f1" />
          </div>
          <div>
            <div style={statLabel}>Total Executions</div>
            <div style={statValue}>{stats.totalRuns}</div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={iconWrapStyle('rgba(16,185,129,0.1)')}>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div>
            <div style={statLabel}>Success Rate</div>
            <div style={statValue}>{stats.successRate}%</div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Recent Activity */}
        <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'stretch', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color={ACCENT} />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Recent Activity</span>
            </div>
            <button
              onClick={() => navigate('/logs')}
              style={{
                fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
              <Clock size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontSize: 14 }}>No recent activity</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Run an agent to see results here</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: item.status === 'success' ? '#dcfce7' : '#fee2e2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {item.status === 'success'
                      ? <Zap size={14} color="#16a34a" />
                      : <AlertCircle size={14} color="#dc2626" />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {item.totalExecutions} total run{item.totalExecutions !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: item.status === 'success' ? '#16a34a' : '#dc2626',
                      textTransform: 'uppercase', letterSpacing: '0.03em',
                    }}>
                      {item.status === 'success' ? 'Success' : 'Failed'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
                      {formatTimeAgo(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
            Quick Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                  border: '1px solid #e5e7eb',
                  width: '100%',
                  textAlign: 'left',
                  background: '#fff',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '1rem 1.25rem',
                  gap: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = action.color;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                  <div style={iconWrapStyle(`${action.color}18`)}>
                    {React.cloneElement(action.icon, { color: action.color })}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{action.label}</span>
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af', paddingLeft: 54 }}>{action.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
