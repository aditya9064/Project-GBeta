/* ═══════════════════════════════════════════════════════════
   Monitoring Dashboard Component
   
   Displays APM metrics, alerts, and system health.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import './MonitoringDashboard.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface DashboardSummary {
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, {
      status: 'pass' | 'warn' | 'fail';
      message?: string;
      responseTime?: number;
      lastCheck: string;
    }>;
    uptime: number;
    version: string;
  };
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
    activeExecutions: number;
  };
  alerts: {
    firing: number;
    total: number;
    recent: Array<{
      ruleId: string;
      status: string;
      value: number;
      triggeredAt?: number;
      message?: string;
    }>;
  };
  system: {
    memoryUsed: number;
    memoryTotal: number;
    cpuUsage: number;
    uptime: number;
  };
}

interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export function MonitoringDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE}/apm/dashboard`),
        fetch(`${API_BASE}/apm/alerts`),
      ]);

      if (!summaryRes.ok || !alertsRes.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const summaryData = await summaryRes.json();
      const alertsData = await alertsRes.json();

      setSummary(summaryData.data);
      setAlerts(alertsData.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return <CheckCircle className="status-icon status-icon--success" />;
      case 'degraded':
      case 'warn':
        return <AlertTriangle className="status-icon status-icon--warning" />;
      case 'unhealthy':
      case 'fail':
        return <XCircle className="status-icon status-icon--error" />;
      default:
        return <Activity className="status-icon" />;
    }
  };

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'severity--critical';
      case 'warning': return 'severity--warning';
      default: return 'severity--info';
    }
  };

  if (loading) {
    return (
      <div className="monitoring-dashboard monitoring-dashboard--loading">
        <RefreshCw className="loading-spinner" />
        <p>Loading monitoring data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-dashboard monitoring-dashboard--error">
        <AlertTriangle />
        <p>{error}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="monitoring-dashboard">
      <header className="monitoring-header">
        <div className="monitoring-header__title">
          <Activity />
          <h1>System Monitoring</h1>
          <span className={`health-badge health-badge--${summary.health.status}`}>
            {getStatusIcon(summary.health.status)}
            {summary.health.status}
          </span>
        </div>
        <div className="monitoring-header__actions">
          <span className="last-refresh">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button className="refresh-btn" onClick={fetchData}>
            <RefreshCw />
            Refresh
          </button>
        </div>
      </header>

      {/* Key Metrics */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card__icon">
            <Zap />
          </div>
          <div className="metric-card__content">
            <span className="metric-card__value">
              {Math.round(summary.metrics.requestsPerMinute)}
            </span>
            <span className="metric-card__label">Requests / min</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__icon metric-card__icon--warning">
            <AlertTriangle />
          </div>
          <div className="metric-card__content">
            <span className={`metric-card__value ${summary.metrics.errorRate > 5 ? 'text-error' : ''}`}>
              {summary.metrics.errorRate.toFixed(2)}%
            </span>
            <span className="metric-card__label">Error Rate</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__icon">
            <Clock />
          </div>
          <div className="metric-card__content">
            <span className={`metric-card__value ${summary.metrics.avgResponseTime > 1000 ? 'text-warning' : ''}`}>
              {Math.round(summary.metrics.avgResponseTime)}ms
            </span>
            <span className="metric-card__label">Avg Response Time</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card__icon">
            <TrendingUp />
          </div>
          <div className="metric-card__content">
            <span className="metric-card__value">
              {summary.metrics.activeExecutions}
            </span>
            <span className="metric-card__label">Active Executions</span>
          </div>
        </div>
      </section>

      {/* Alerts Section */}
      <section className="monitoring-section">
        <h2>
          <AlertTriangle />
          Alerts
          {summary.alerts.firing > 0 && (
            <span className="alert-badge alert-badge--firing">
              {summary.alerts.firing} firing
            </span>
          )}
        </h2>
        
        {summary.alerts.recent.length > 0 ? (
          <div className="alerts-list">
            {summary.alerts.recent.map((alert) => (
              <div 
                key={alert.ruleId} 
                className={`alert-item alert-item--${alert.status}`}
              >
                <div className="alert-item__status">
                  {alert.status === 'firing' ? <XCircle /> : <CheckCircle />}
                </div>
                <div className="alert-item__content">
                  <span className="alert-item__message">{alert.message}</span>
                  {alert.triggeredAt && (
                    <span className="alert-item__time">
                      Triggered: {new Date(alert.triggeredAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <span className="alert-item__value">{alert.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="alerts-empty">
            <CheckCircle />
            <p>No active alerts</p>
          </div>
        )}

        <div className="alert-rules">
          <h3>Alert Rules ({alerts.length})</h3>
          <div className="alert-rules-list">
            {alerts.slice(0, 5).map((rule) => (
              <div 
                key={rule.id} 
                className={`alert-rule ${getSeverityClass(rule.severity)}`}
              >
                <span className="alert-rule__name">{rule.name}</span>
                <span className="alert-rule__condition">
                  {rule.metric} {rule.condition} {rule.threshold}
                </span>
                <span className={`alert-rule__status ${rule.enabled ? 'enabled' : 'disabled'}`}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Health Checks */}
      <section className="monitoring-section">
        <h2>
          <Server />
          Health Checks
        </h2>
        <div className="health-checks-grid">
          {Object.entries(summary.health.checks).map(([name, check]) => (
            <div key={name} className={`health-check health-check--${check.status}`}>
              {getStatusIcon(check.status)}
              <div className="health-check__content">
                <span className="health-check__name">{name}</span>
                {check.message && (
                  <span className="health-check__message">{check.message}</span>
                )}
                {check.responseTime !== undefined && (
                  <span className="health-check__time">{check.responseTime}ms</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Resources */}
      <section className="monitoring-section">
        <h2>
          <Cpu />
          System Resources
        </h2>
        <div className="system-resources-grid">
          <div className="resource-card">
            <div className="resource-card__header">
              <HardDrive />
              <span>Memory</span>
            </div>
            <div className="resource-card__bar">
              <div 
                className="resource-card__bar-fill"
                style={{ 
                  width: `${(summary.system.memoryUsed / summary.system.memoryTotal) * 100}%`,
                  backgroundColor: (summary.system.memoryUsed / summary.system.memoryTotal) > 0.8 
                    ? 'var(--error)' 
                    : 'var(--accent)'
                }}
              />
            </div>
            <div className="resource-card__values">
              <span>{formatBytes(summary.system.memoryUsed)}</span>
              <span>of {formatBytes(summary.system.memoryTotal)}</span>
            </div>
          </div>

          <div className="resource-card">
            <div className="resource-card__header">
              <Clock />
              <span>Uptime</span>
            </div>
            <div className="resource-card__value">
              {formatUptime(summary.system.uptime)}
            </div>
          </div>

          <div className="resource-card">
            <div className="resource-card__header">
              <Database />
              <span>Version</span>
            </div>
            <div className="resource-card__value">
              {summary.health.version}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
