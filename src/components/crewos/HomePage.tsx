import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Mail,
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
  Star,
  Wand2,
  MessageSquare,
  Target,
  Play,
  BookOpen,
  Rocket,
} from 'lucide-react';
import { useAgents } from '../../contexts/AgentContext';
import { useAuth } from '../../contexts/AuthContext';

const ACCENT = '#e07a3a';

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
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

interface UseCaseCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
  tag?: string;
}

const USE_CASE_CARDS: UseCaseCard[] = [
  {
    id: 'email',
    title: 'Automate My Email',
    description: 'AI reads your inbox, drafts replies, and sends daily summaries',
    icon: <Mail size={22} />,
    color: '#0ea5e9',
    path: '/comms',
    tag: 'Popular',
  },
  {
    id: 'chat',
    title: 'Ask AI to Do Something',
    description: 'Just describe what you need in plain English — your AI handles the rest',
    icon: <Sparkles size={22} />,
    color: '#f59e0b',
    path: '/chat',
    tag: 'Start Here',
  },
  {
    id: 'docs',
    title: 'Create a Document',
    description: 'Generate contracts, invoices, reports, or any professional document',
    icon: <FileText size={22} />,
    color: '#8b5cf6',
    path: '/docai',
  },
  {
    id: 'sales',
    title: 'Track My Sales',
    description: 'Manage your pipeline, contacts, and follow-ups with AI insights',
    icon: <TrendingUp size={22} />,
    color: '#10b981',
    path: '/sales',
  },
  {
    id: 'browse',
    title: 'Browse Ready-Made Solutions',
    description: 'Install pre-built automations with one click — no setup needed',
    icon: <Wand2 size={22} />,
    color: '#ec4899',
    path: '/marketplace',
  },
  {
    id: 'build',
    title: 'Build a Custom Automation',
    description: 'Create your own step-by-step workflow with the visual builder',
    icon: <GitBranch size={22} />,
    color: '#6366f1',
    path: '/workflow',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { agents } = useAgents();
  const { user } = useAuth();

  const firstName = user?.displayName?.split(' ')[0] || '';

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

  const isNewUser = stats.total === 0;
  const greeting = getGreeting();

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', margin: 0 }}>
          {greeting}{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', margin: '6px 0 0' }}>
          {isNewUser
            ? "Let's get you started — pick something you'd like to automate."
            : 'Here\'s what\'s happening with your AI assistants.'
          }
        </p>
      </div>

      {/* New User: Guided Getting Started */}
      {isNewUser && (
        <>
          {/* Hero CTA */}
          <div style={{
            background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
            border: '1px solid #fed7aa',
            borderRadius: 16,
            padding: '24px 28px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: `${ACCENT}15`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Rocket size={28} color={ACCENT} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>
                Fastest way to start: just tell AI what you need
              </div>
              <div style={{ fontSize: 14, color: '#b45309', marginTop: 4 }}>
                Type what you want to automate in plain English — like "summarize my emails every morning" — and AI will set it up for you.
              </div>
            </div>
            <button
              onClick={() => navigate('/chat')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 12, border: 'none',
                background: ACCENT, color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <Sparkles size={18} /> Try It Now
            </button>
          </div>

          {/* Use Case Grid */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
              What would you like to do?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {USE_CASE_CARDS.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => navigate(uc.path)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 10, padding: '18px 20px', borderRadius: 14, textAlign: 'left',
                    border: '1px solid #e5e7eb', background: '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit', width: '100%', position: 'relative',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = uc.color;
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 12px ${uc.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  }}
                >
                  {uc.tag && (
                    <span style={{
                      position: 'absolute', top: 10, right: 12,
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '2px 8px', borderRadius: 6,
                      background: uc.id === 'chat' ? '#fef3c7' : '#dbeafe',
                      color: uc.id === 'chat' ? '#92400e' : '#1e40af',
                    }}>
                      {uc.tag}
                    </span>
                  )}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${uc.color}12`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: uc.color,
                  }}>
                    {uc.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{uc.title}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{uc.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div style={{
            background: '#f8fafc', borderRadius: 16, padding: '24px 28px',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 16 }}>
              How it works — 3 simple steps
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              {[
                { step: '1', title: 'Describe what you need', desc: 'Tell AI what you want automated, in your own words', icon: <MessageSquare size={20} color="#3b82f6" /> },
                { step: '2', title: 'AI sets it up', desc: 'Your assistant creates the automation and connects your tools', icon: <Wand2 size={20} color="#8b5cf6" /> },
                { step: '3', title: 'It runs automatically', desc: 'Sit back while your tasks get done. Review results anytime.', icon: <Play size={20} color="#10b981" /> },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: '#fff', border: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Returning User: Stats + Activity */}
      {!isNewUser && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={cardStyle}>
              <div style={iconWrapStyle(`${ACCENT}18`)}><Bot size={20} color={ACCENT} /></div>
              <div><div style={statLabel}>My Assistants</div><div style={statValue}>{stats.total}</div></div>
            </div>
            <div style={cardStyle}>
              <div style={iconWrapStyle('#10b98118')}><CheckCircle2 size={20} color="#10b981" /></div>
              <div><div style={statLabel}>Running Now</div><div style={statValue}>{stats.active}</div></div>
            </div>
            <div style={cardStyle}>
              <div style={iconWrapStyle('rgba(99,102,241,0.1)')}><Activity size={20} color="#6366f1" /></div>
              <div><div style={statLabel}>Tasks Completed</div><div style={statValue}>{stats.totalRuns}</div></div>
            </div>
            <div style={cardStyle}>
              <div style={iconWrapStyle('rgba(16,185,129,0.1)')}><TrendingUp size={20} color="#10b981" /></div>
              <div><div style={statLabel}>Success Rate</div><div style={statValue}>{stats.successRate}%</div></div>
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
                  style={{ fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  View all <ArrowRight size={12} />
                </button>
              </div>

              {recentActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
                  <Clock size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div style={{ fontSize: 14 }}>No recent activity</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Your assistant activity will show up here</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {recentActivity.map((item) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.65rem 0', borderBottom: '1px solid #f3f4f6',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: item.status === 'success' ? '#dcfce7' : '#fee2e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {item.status === 'success'
                          ? <Zap size={14} color="#16a34a" />
                          : <AlertCircle size={14} color="#dc2626" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                          {item.totalExecutions} task{item.totalExecutions !== 1 ? 's' : ''} completed
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 600,
                          color: item.status === 'success' ? '#16a34a' : '#dc2626',
                          textTransform: 'uppercase', letterSpacing: '0.03em',
                        }}>
                          {item.status === 'success' ? 'Done' : 'Issue'}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatTimeAgo(item.timestamp)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                What would you like to do?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Ask AI Anything', icon: <Sparkles size={20} />, path: '/chat', color: ACCENT, description: 'Describe a task in your own words' },
                  { label: 'My Assistants', icon: <Bot size={20} />, path: '/agents', color: '#e07a3a', description: 'See what\'s running' },
                  { label: 'Build an Automation', icon: <GitBranch size={20} />, path: '/workflow', color: '#10b981', description: 'Create a step-by-step flow' },
                  { label: 'Team Management', icon: <Users size={20} />, path: '/workforce', color: '#6366f1', description: 'Organize & coordinate' },
                  { label: 'Messages & Email', icon: <Mail size={20} />, path: '/comms', color: '#0ea5e9', description: 'AI-powered inbox' },
                  { label: 'Template Gallery', icon: <ShoppingCart size={20} />, path: '/marketplace', color: '#f59e0b', description: 'Ready-made solutions' },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    style={{
                      ...cardStyle, cursor: 'pointer',
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      border: '1px solid #e5e7eb', width: '100%', textAlign: 'left',
                      background: '#fff', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '1rem 1.25rem', gap: '0.5rem',
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
        </>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
