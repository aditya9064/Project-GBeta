import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  BarChart3,
  Zap,
  Crown,
  Wrench,
  Eye,
  ShieldCheck,
  Brain,
  Loader2,
  Download,
} from 'lucide-react';
import { CrewManager } from './CrewManager';
import { AgentMetrics } from './AgentMetrics';
import { FeedbackPanel } from './FeedbackPanel';
import { CrewExecutionPanel } from './CrewExecutionPanel';
import { EscalationQueue } from './EscalationQueue';
import { useAgents } from '../../contexts/AgentContext';
import {
  CrewService,
  type Crew,
  MetricsService,
  type WorkforceSummary,
  type ActivityEntry,
  LearningService,
  type LearningInsight,
} from '../../services/workforce';
import './WorkforceDashboard.css';

type DashboardView = 'overview' | 'crews' | 'execute' | 'escalations' | 'metrics' | 'feedback' | 'learning';

interface AgentStatusItem {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'running' | 'error';
  lastActivity?: string;
  crewId?: string;
  crewName?: string;
  successRate?: number;
}

export function WorkforceDashboard() {
  const { agents } = useAgents();
  const [view, setView] = useState<DashboardView>('overview');
  const [crews, setCrews] = useState<Crew[]>([]);
  const [summary, setSummary] = useState<WorkforceSummary | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [crewsData, summaryData, insightsData] = await Promise.all([
        CrewService.list().catch(() => []),
        MetricsService.getSummary().catch(() => null),
        LearningService.generateInsights().catch(() => []),
      ]);
      
      setCrews(crewsData);
      setSummary(summaryData);
      setInsights(insightsData);
      setActivity(MetricsService.getRecentActivity(20));
    } catch (err) {
      console.error('Failed to load workforce data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const getAgentStatuses = (): AgentStatusItem[] => {
    return agents.map(agent => {
      const crew = crews.find(c => c.members.some(m => m.agentId === agent.id));
      return {
        id: agent.id,
        name: agent.name,
        status: agent.status === 'active' ? 'idle' : agent.status === 'error' ? 'error' : 'active',
        crewId: crew?.id,
        crewName: crew?.name,
        successRate: summary?.topPerformers.find(p => p.agentId === agent.id)?.successRate,
      };
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager': return <Crown size={14} />;
      case 'specialist': return <Wrench size={14} />;
      case 'reviewer': return <Eye size={14} />;
      case 'qa': return <ShieldCheck size={14} />;
      default: return <Users size={14} />;
    }
  };

  const getInsightIcon = (type: LearningInsight['type']) => {
    switch (type) {
      case 'improvement': return <TrendingUp size={16} className="insight-icon improvement" />;
      case 'regression': return <TrendingDown size={16} className="insight-icon regression" />;
      case 'opportunity': return <Brain size={16} className="insight-icon opportunity" />;
      case 'achievement': return <CheckCircle2 size={16} className="insight-icon achievement" />;
    }
  };

  if (loading) {
    return (
      <div className="workforce-page">
        <div className="workforce-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading workforce data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="workforce-page">
      {/* Header */}
      <div className="workforce-header">
        <div className="workforce-header-left">
          <h1 className="workforce-header-title">Agent Workforce</h1>
          <div className="workforce-header-tabs">
            {(['overview', 'crews', 'execute', 'escalations', 'metrics', 'feedback', 'learning'] as DashboardView[]).map(tab => (
              <button
                key={tab}
                className={`workforce-header-tab ${view === tab ? 'active' : ''}`}
                onClick={() => setView(tab)}
              >
                {tab === 'overview' && <Activity size={16} />}
                {tab === 'crews' && <Users size={16} />}
                {tab === 'metrics' && <BarChart3 size={16} />}
                {tab === 'feedback' && <CheckCircle2 size={16} />}
                {tab === 'learning' && <Brain size={16} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="workforce-header-right">
          <button
            className="workforce-btn-icon"
            onClick={async () => {
              try {
                const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');
                const { auth } = await import('../../lib/firebase');
                const token = await auth.currentUser?.getIdToken();
                const resp = await fetch(`${API_BASE}/api/analytics/report/markdown`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                const text = await resp.text();
                const blob = new Blob([text], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'workforce-report.md';
                a.click();
                URL.revokeObjectURL(url);
              } catch { /* ignore */ }
            }}
            title="Export Report"
          >
            <Download size={18} />
          </button>
          <button 
            className="workforce-btn-icon" 
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
          <button 
            className="workforce-btn-primary"
            onClick={() => setView('crews')}
          >
            <Plus size={16} />
            New Crew
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="workforce-content">
        {/* Overview View */}
        {view === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="workforce-stats">
              <div className="stat-card">
                <div className="stat-icon blue">
                  <Users size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{summary?.activeAgents || agents.length}</span>
                  <span className="stat-label">Active Agents</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">
                  <Zap size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">{summary?.totalExecutions || 0}</span>
                  <span className="stat-label">Total Executions</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">
                  <CheckCircle2 size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">
                    {summary?.successRate ? `${Math.round(summary.successRate * 100)}%` : '-'}
                  </span>
                  <span className="stat-label">Success Rate</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange">
                  <Clock size={22} />
                </div>
                <div className="stat-content">
                  <span className="stat-value">
                    {summary?.avgDurationMs 
                      ? MetricsService.formatDuration(summary.avgDurationMs) 
                      : '-'}
                  </span>
                  <span className="stat-label">Avg Duration</span>
                </div>
              </div>
            </div>

            <div className="workforce-grid">
              {/* Agent Status Grid */}
              <div className="workforce-section">
                <div className="workforce-section-header">
                  <h3><Activity size={18} /> Agent Status</h3>
                </div>
                <div className="agent-status-grid">
                  {getAgentStatuses().slice(0, 12).map(agent => (
                    <div 
                      key={agent.id} 
                      className={`agent-status-card ${selectedAgentId === agent.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setView('metrics');
                      }}
                    >
                      <div className={`agent-status-indicator ${agent.status}`} />
                      <div className="agent-status-info">
                        <span className="agent-name">{agent.name}</span>
                        {agent.crewName && (
                          <span className="agent-crew">{agent.crewName}</span>
                        )}
                      </div>
                      {agent.successRate !== undefined && (
                        <span className="agent-success-rate">
                          {Math.round(agent.successRate * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
                  {agents.length === 0 && (
                    <div className="empty-state full">
                      <Users size={40} />
                      <p>No agents deployed yet</p>
                      <span>Deploy agents from the Agents tab to get started</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Crews Overview */}
              <div className="workforce-section">
                <div className="workforce-section-header">
                  <h3><Users size={18} /> Crews</h3>
                </div>
                <div className="crews-list">
                  {crews.slice(0, 5).map(crew => (
                    <div 
                      key={crew.id} 
                      className={`crew-card ${selectedCrewId === crew.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCrewId(crew.id);
                        setView('crews');
                      }}
                    >
                      <div className="crew-header">
                        <span className="crew-name">{crew.name}</span>
                        <span className={`crew-status ${crew.status}`}>
                          {crew.status}
                        </span>
                      </div>
                      <div className="crew-members">
                        {crew.members.map(member => (
                          <div key={member.agentId} className="crew-member">
                            {getRoleIcon(member.role)}
                            <span>{member.agentName}</span>
                          </div>
                        ))}
                      </div>
                      <div className="crew-stats">
                        <span><Zap size={12} /> {crew.stats.totalExecutions} runs</span>
                        <span>
                          <CheckCircle2 size={12} />
                          {crew.stats.totalExecutions > 0
                            ? `${Math.round((crew.stats.successfulExecutions / crew.stats.totalExecutions) * 100)}% success`
                            : 'No runs yet'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {crews.length === 0 && (
                    <div className="empty-state">
                      <Users size={40} />
                      <p>No crews created yet</p>
                      <span>Create a crew to organize your agents into teams</span>
                      <button 
                        className="workforce-btn-primary workforce-btn-small"
                        onClick={() => setView('crews')}
                        style={{ marginTop: 16 }}
                      >
                        <Plus size={14} />
                        Create Crew
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="workforce-section">
                <div className="workforce-section-header">
                  <h3><Activity size={18} /> Recent Activity</h3>
                </div>
                <div className="activity-feed">
                  {activity.slice(0, 10).map((entry, i) => (
                    <div key={i} className={`activity-item ${entry.type}`}>
                      <div className="activity-icon">
                        {entry.type === 'execution' && entry.success && <CheckCircle2 size={14} />}
                        {entry.type === 'execution' && !entry.success && <XCircle size={14} />}
                        {entry.type === 'crew_task' && <Users size={14} />}
                        {entry.type === 'feedback' && <CheckCircle2 size={14} />}
                        {entry.type === 'error' && <AlertCircle size={14} />}
                      </div>
                      <div className="activity-content">
                        <span className="activity-agent">
                          {entry.agentName || entry.crewName || 'System'}
                        </span>
                        <span className="activity-desc">{entry.description}</span>
                      </div>
                      <span className="activity-time">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  {activity.length === 0 && (
                    <div className="empty-state">
                      <Activity size={40} />
                      <p>No recent activity</p>
                      <span>Run some agents to see activity here</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Learning Insights */}
              <div className="workforce-section">
                <div className="workforce-section-header">
                  <h3><Brain size={18} /> Learning Insights</h3>
                </div>
                <div className="insights-list">
                  {insights.slice(0, 5).map((insight, i) => (
                    <div key={i} className="insight-card">
                      {getInsightIcon(insight.type)}
                      <div className="insight-content">
                        <span className="insight-title">{insight.title}</span>
                        <span className="insight-desc">{insight.description}</span>
                      </div>
                    </div>
                  ))}
                  {insights.length === 0 && (
                    <div className="empty-state">
                      <Brain size={40} />
                      <p>No insights yet</p>
                      <span>Run some agents to generate insights</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Crews View */}
        {view === 'crews' && (
          <CrewManager 
            selectedCrewId={selectedCrewId}
            onCrewSelect={setSelectedCrewId}
            onCrewsChange={loadData}
          />
        )}

        {/* Execute View */}
        {view === 'execute' && (
          <CrewExecutionPanel />
        )}

        {/* Escalations View */}
        {view === 'escalations' && (
          <EscalationQueue />
        )}

        {/* Metrics View */}
        {view === 'metrics' && (
          <AgentMetrics 
            selectedAgentId={selectedAgentId}
            onAgentSelect={setSelectedAgentId}
          />
        )}

        {/* Feedback View */}
        {view === 'feedback' && (
          <FeedbackPanel 
            selectedAgentId={selectedAgentId}
            onAgentSelect={setSelectedAgentId}
          />
        )}

        {/* Learning View */}
        {view === 'learning' && (
          <div className="learning-view">
            <div className="learning-header">
              <h2>Agent Learning & Development</h2>
              <p>Track skill development and improvement opportunities for your agents.</p>
            </div>

            <div className="insights-full">
              <h3>Latest Insights</h3>
              {insights.map((insight, i) => (
                <div key={i} className="insight-card full">
                  {getInsightIcon(insight.type)}
                  <div className="insight-content">
                    <span className="insight-title">{insight.title}</span>
                    <span className="insight-desc">{insight.description}</span>
                    <span className="insight-time">
                      {new Date(insight.timestamp).toLocaleDateString()} at{' '}
                      {new Date(insight.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              {insights.length === 0 && (
                <div className="empty-state">
                  <Brain size={40} />
                  <p>No insights yet</p>
                  <span>Run agents and provide feedback to generate learning insights</span>
                </div>
              )}
            </div>

            <div className="learning-profiles">
              <h3>Agent Profiles</h3>
              <div className="profiles-grid">
                {agents.slice(0, 6).map(agent => {
                  const profile = LearningService.getAgentProfile(agent.id, agent.name);
                  return (
                    <div key={agent.id} className="profile-card">
                      <div className="profile-header">
                        <span className="profile-name">{agent.name}</span>
                        <span 
                          className={`profile-score ${
                            profile.overallScore >= 70 ? '' : 
                            profile.overallScore >= 50 ? 'medium' : 'low'
                          }`}
                        >
                          {profile.overallScore}
                        </span>
                      </div>
                      <div className="profile-skills">
                        {profile.skills.slice(0, 3).map(skill => (
                          <div key={skill.skillName} className="skill-bar">
                            <span className="skill-name">{skill.skillName}</span>
                            <div className="skill-progress">
                              <div 
                                className="skill-fill" 
                                style={{ width: `${skill.score}%` }} 
                              />
                            </div>
                            <span className="skill-level">{skill.level}</span>
                          </div>
                        ))}
                      </div>
                      {profile.suggestedImprovements.length > 0 && (
                        <div className="profile-improvements">
                          <span className="improvements-label">Suggested Improvement</span>
                          <span className="improvement-text">
                            {profile.suggestedImprovements[0].suggestion}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
