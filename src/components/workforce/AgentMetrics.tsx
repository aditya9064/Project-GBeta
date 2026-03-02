import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Activity,
  Loader2,
  Zap,
} from 'lucide-react';
import {
  MetricsService,
  type AgentMetrics as AgentMetricsType,
  type MetricPeriod,
  type MetricsTrend,
} from '../../services/workforce';
import { useAgents } from '../../contexts/AgentContext';

interface AgentMetricsProps {
  selectedAgentId?: string | null;
  onAgentSelect?: (agentId: string | null) => void;
}

export function AgentMetrics({
  selectedAgentId,
  onAgentSelect,
}: AgentMetricsProps) {
  const { agents } = useAgents();
  const [period, setPeriod] = useState<MetricPeriod>('weekly');
  const [metrics, setMetrics] = useState<AgentMetricsType[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<AgentMetricsType | null>(null);
  const [trends, setTrends] = useState<MetricsTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [period]);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentMetrics(selectedAgentId);
    } else {
      setSelectedMetrics(null);
    }
  }, [selectedAgentId, period]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await MetricsService.getAllAgentMetrics(period);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentMetrics = async (agentId: string) => {
    try {
      const [agentMetrics, agentTrends] = await Promise.all([
        MetricsService.getAgentMetrics(agentId, period),
        MetricsService.getTrends(agentId, 7),
      ]);
      setSelectedMetrics(agentMetrics);
      setTrends(agentTrends);
    } catch (err) {
      console.error('Failed to load agent metrics:', err);
    }
  };

  if (loading) {
    return (
      <div className="metrics-page">
        <div className="workforce-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h2>Agent Performance Metrics</h2>
        <div className="metrics-period-tabs">
          {(['daily', 'weekly', 'monthly'] as MetricPeriod[]).map(p => (
            <button
              key={p}
              className={`metrics-period-tab ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'daily' ? 'Day' : p === 'weekly' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        {/* Agent List */}
        <div className="metrics-agent-list">
          <h3>Agents</h3>
          {agents.map(agent => {
            const agentMetric = metrics.find(m => m.agentId === agent.id);
            return (
              <div
                key={agent.id}
                className={`metrics-agent-item ${selectedAgentId === agent.id ? 'selected' : ''}`}
                onClick={() => onAgentSelect?.(agent.id)}
              >
                <span className="metrics-agent-name">{agent.name}</span>
                <span className="metrics-agent-runs">
                  {agentMetric?.totalExecutions || 0} runs
                </span>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>
              No agents deployed
            </div>
          )}
        </div>

        {/* Metrics Detail */}
        <div className="metrics-detail">
          {selectedMetrics ? (
            <>
              <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
                {selectedMetrics.agentName}
              </h3>
              
              {/* Simple Chart Placeholder */}
              <div className="metrics-chart-placeholder">
                <BarChart3 size={32} />
                <span style={{ marginLeft: 10 }}>7-day trend visualization</span>
              </div>

              {/* Stats Grid */}
              <div className="metrics-stats-grid">
                <div className="metrics-stat-card">
                  <div className="metrics-stat-value">{selectedMetrics.totalExecutions}</div>
                  <div className="metrics-stat-label">Total Runs</div>
                </div>
                <div className="metrics-stat-card">
                  <div className={`metrics-stat-value ${selectedMetrics.successRate >= 0.8 ? 'success' : selectedMetrics.successRate >= 0.5 ? 'warning' : 'error'}`}>
                    {Math.round(selectedMetrics.successRate * 100)}%
                  </div>
                  <div className="metrics-stat-label">Success Rate</div>
                </div>
                <div className="metrics-stat-card">
                  <div className="metrics-stat-value">
                    {MetricsService.formatDuration(selectedMetrics.avgDurationMs)}
                  </div>
                  <div className="metrics-stat-label">Avg Duration</div>
                </div>
              </div>

              {/* Additional Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: 16, 
                marginTop: 20 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: 16, 
                  background: '#f8f8fc', 
                  borderRadius: 10 
                }}>
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>
                      {selectedMetrics.successCount}
                    </div>
                    <div style={{ fontSize: 12, color: '#6a6a80' }}>Successful</div>
                  </div>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: 16, 
                  background: '#f8f8fc', 
                  borderRadius: 10 
                }}>
                  <XCircle size={20} style={{ color: '#ef4444' }} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>
                      {selectedMetrics.failureCount}
                    </div>
                    <div style={{ fontSize: 12, color: '#6a6a80' }}>Failed</div>
                  </div>
                </div>
              </div>

              {/* Trends */}
              {trends.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#3a3a52' }}>
                    Daily Breakdown
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {trends.slice(0, 7).map((trend, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#f8f8fc',
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 13, color: '#3a3a52' }}>{trend.date}</span>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <span style={{ fontSize: 13, color: '#6a6a80' }}>
                            {trend.executions} runs
                          </span>
                          <span style={{ 
                            fontSize: 13, 
                            color: trend.successRate >= 0.8 ? '#10b981' : trend.successRate >= 0.5 ? '#f59e0b' : '#ef4444' 
                          }}>
                            {Math.round(trend.successRate * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ height: 300 }}>
              <BarChart3 size={48} />
              <p>Select an Agent</p>
              <span>Click on an agent to view detailed metrics</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
