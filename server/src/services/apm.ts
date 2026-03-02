/* ═══════════════════════════════════════════════════════════
   Application Performance Monitoring (APM) Service
   
   Collects and exports metrics to monitoring backends:
   - Google Cloud Monitoring (native for Cloud Run)
   - Custom dashboards via internal API
   - Alert thresholds and anomaly detection
   ═══════════════════════════════════════════════════════════ */

import { logger, Metrics, MetricPoint, Health } from './logger.js';

// Metric aggregation types
interface AggregatedMetric {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  unit: MetricPoint['unit'];
  tags: Record<string, string>;
  window: {
    start: number;
    end: number;
  };
}

// Time series data point
interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

// Dashboard widget configuration
interface DashboardWidget {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'gauge' | 'stat' | 'table';
  metrics: string[];
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p95' | 'p99';
  timeRange: string;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
}

// Dashboard configuration
interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  refreshInterval: number;
}

// Metrics storage (in-memory for now, could be Redis/Firestore)
const metricsHistory: Map<string, TimeSeriesPoint[]> = new Map();
const MAX_HISTORY_POINTS = 1000;
const AGGREGATION_INTERVAL_MS = 60000; // 1 minute

// Alert configuration
interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  window: number; // seconds
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown: number; // seconds between alerts
  lastTriggered?: number;
  notifyChannels: string[];
}

// Alert state
interface AlertState {
  ruleId: string;
  status: 'ok' | 'firing' | 'pending';
  value: number;
  triggeredAt?: number;
  resolvedAt?: number;
  message?: string;
}

const alertRules: Map<string, AlertRule> = new Map();
const alertStates: Map<string, AlertState> = new Map();

// Default alert rules
const DEFAULT_ALERTS: Omit<AlertRule, 'id'>[] = [
  {
    name: 'High Error Rate',
    metric: 'http.request.errors',
    condition: 'gt',
    threshold: 10,
    window: 60,
    severity: 'critical',
    enabled: true,
    cooldown: 300,
    notifyChannels: ['log'],
  },
  {
    name: 'Slow Response Time',
    metric: 'http.request.duration',
    condition: 'gt',
    threshold: 5000,
    window: 60,
    severity: 'warning',
    enabled: true,
    cooldown: 300,
    notifyChannels: ['log'],
  },
  {
    name: 'High Memory Usage',
    metric: 'system.memory.used_percent',
    condition: 'gt',
    threshold: 85,
    window: 120,
    severity: 'warning',
    enabled: true,
    cooldown: 600,
    notifyChannels: ['log'],
  },
  {
    name: 'Agent Execution Failures',
    metric: 'agent.execution.failed',
    condition: 'gt',
    threshold: 5,
    window: 300,
    severity: 'critical',
    enabled: true,
    cooldown: 600,
    notifyChannels: ['log'],
  },
];

// Initialize default alerts
DEFAULT_ALERTS.forEach((rule, index) => {
  const id = `default-${index}`;
  alertRules.set(id, { ...rule, id });
  alertStates.set(id, { ruleId: id, status: 'ok', value: 0 });
});

// Register metrics flush handler
Metrics.onFlush((points) => {
  for (const point of points) {
    APM.recordMetric(point);
  }
});

// System metrics collector
let systemMetricsInterval: ReturnType<typeof setInterval> | null = null;

export const APM = {
  /**
   * Start APM collection
   */
  start() {
    logger.info('APM service starting');
    
    // Collect system metrics every 30 seconds
    systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
    
    // Run alert checks every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60000);
    
    // Initial collection
    this.collectSystemMetrics();
  },

  /**
   * Stop APM collection
   */
  stop() {
    if (systemMetricsInterval) {
      clearInterval(systemMetricsInterval);
      systemMetricsInterval = null;
    }
    logger.info('APM service stopped');
  },

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    Metrics.gauge('system.memory.heap_used', memUsage.heapUsed, 'bytes');
    Metrics.gauge('system.memory.heap_total', memUsage.heapTotal, 'bytes');
    Metrics.gauge('system.memory.rss', memUsage.rss, 'bytes');
    Metrics.gauge('system.memory.external', memUsage.external, 'bytes');
    Metrics.gauge('system.memory.used_percent', 
      Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100), 'percent');
    
    // CPU metrics (microseconds)
    Metrics.gauge('system.cpu.user', cpuUsage.user, 'ms');
    Metrics.gauge('system.cpu.system', cpuUsage.system, 'ms');
    
    // Event loop metrics
    const startHrTime = process.hrtime();
    setImmediate(() => {
      const [seconds, nanoseconds] = process.hrtime(startHrTime);
      const lagMs = (seconds * 1000) + (nanoseconds / 1000000);
      Metrics.gauge('system.eventloop.lag', lagMs, 'ms');
    });
    
    // Active handles and requests
    Metrics.gauge('system.handles.active', (process as any)._getActiveHandles?.()?.length || 0, 'count');
    Metrics.gauge('system.requests.active', (process as any)._getActiveRequests?.()?.length || 0, 'count');
  },

  /**
   * Record a metric point in history
   */
  recordMetric(point: MetricPoint) {
    const key = this.getMetricKey(point.name, point.tags);
    
    if (!metricsHistory.has(key)) {
      metricsHistory.set(key, []);
    }
    
    const history = metricsHistory.get(key)!;
    history.push({ timestamp: point.timestamp, value: point.value });
    
    // Trim old points
    while (history.length > MAX_HISTORY_POINTS) {
      history.shift();
    }
  },

  /**
   * Generate a unique key for metric + tags
   */
  getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) return name;
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${tagStr}}`;
  },

  /**
   * Get aggregated metrics for a time window
   */
  getAggregatedMetrics(
    metricName: string,
    windowMs: number = 60000,
    tags?: Record<string, string>
  ): AggregatedMetric | null {
    const key = this.getMetricKey(metricName, tags);
    const history = metricsHistory.get(key);
    
    if (!history || history.length === 0) return null;
    
    const now = Date.now();
    const windowStart = now - windowMs;
    const windowPoints = history.filter(p => p.timestamp >= windowStart);
    
    if (windowPoints.length === 0) return null;
    
    const values = windowPoints.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      name: metricName,
      count: values.length,
      sum,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      unit: 'count',
      tags: tags || {},
      window: { start: windowStart, end: now },
    };
  },

  /**
   * Get time series data for charting
   */
  getTimeSeries(
    metricName: string,
    windowMs: number = 3600000,
    tags?: Record<string, string>,
    bucketMs: number = 60000
  ): { timestamps: number[]; values: number[] } {
    const key = this.getMetricKey(metricName, tags);
    const history = metricsHistory.get(key);
    
    if (!history || history.length === 0) {
      return { timestamps: [], values: [] };
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    const buckets: Map<number, number[]> = new Map();
    
    for (const point of history) {
      if (point.timestamp < windowStart) continue;
      
      const bucketTime = Math.floor(point.timestamp / bucketMs) * bucketMs;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(point.value);
    }
    
    const timestamps: number[] = [];
    const values: number[] = [];
    
    const sortedBuckets = Array.from(buckets.entries()).sort(([a], [b]) => a - b);
    for (const [timestamp, bucketValues] of sortedBuckets) {
      timestamps.push(timestamp);
      values.push(bucketValues.reduce((a, b) => a + b, 0) / bucketValues.length);
    }
    
    return { timestamps, values };
  },

  /**
   * Check all alert rules
   */
  checkAlerts() {
    for (const [ruleId, rule] of alertRules) {
      if (!rule.enabled) continue;
      
      const aggregated = this.getAggregatedMetrics(rule.metric, rule.window * 1000);
      if (!aggregated) continue;
      
      const value = aggregated.avg;
      let triggered = false;
      
      switch (rule.condition) {
        case 'gt': triggered = value > rule.threshold; break;
        case 'lt': triggered = value < rule.threshold; break;
        case 'eq': triggered = value === rule.threshold; break;
        case 'gte': triggered = value >= rule.threshold; break;
        case 'lte': triggered = value <= rule.threshold; break;
      }
      
      const currentState = alertStates.get(ruleId)!;
      const now = Date.now();
      
      if (triggered) {
        if (currentState.status === 'ok') {
          // Check cooldown
          if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown * 1000) {
            continue;
          }
          
          // Fire alert
          currentState.status = 'firing';
          currentState.triggeredAt = now;
          currentState.value = value;
          currentState.message = `${rule.name}: ${rule.metric} is ${value.toFixed(2)} (threshold: ${rule.threshold})`;
          rule.lastTriggered = now;
          
          this.notifyAlert(rule, currentState);
        }
      } else {
        if (currentState.status === 'firing') {
          // Resolve alert
          currentState.status = 'ok';
          currentState.resolvedAt = now;
          
          logger.info('Alert resolved', {
            alertId: ruleId,
            alertName: rule.name,
            metric: rule.metric,
            value,
          });
        }
      }
      
      currentState.value = value;
    }
  },

  /**
   * Send alert notification
   */
  notifyAlert(rule: AlertRule, state: AlertState) {
    const logLevel = rule.severity === 'critical' ? 'error' : 'warn';
    
    logger[logLevel]('Alert triggered', {
      alertId: rule.id,
      alertName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      value: state.value,
      threshold: rule.threshold,
      condition: rule.condition,
    });
    
    Metrics.increment('apm.alerts.triggered', 1, {
      severity: rule.severity,
      alertName: rule.name,
    });
  },

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(alertRules.values());
  },

  /**
   * Get alert states
   */
  getAlertStates(): AlertState[] {
    return Array.from(alertStates.values());
  },

  /**
   * Add or update alert rule
   */
  setAlertRule(rule: AlertRule) {
    alertRules.set(rule.id, rule);
    if (!alertStates.has(rule.id)) {
      alertStates.set(rule.id, { ruleId: rule.id, status: 'ok', value: 0 });
    }
  },

  /**
   * Delete alert rule
   */
  deleteAlertRule(ruleId: string) {
    alertRules.delete(ruleId);
    alertStates.delete(ruleId);
  },

  /**
   * Get dashboard summary for UI
   */
  async getDashboardSummary(): Promise<{
    health: Awaited<ReturnType<typeof Health.check>>;
    metrics: {
      requestsPerMinute: number;
      errorRate: number;
      avgResponseTime: number;
      activeExecutions: number;
    };
    alerts: {
      firing: number;
      total: number;
      recent: AlertState[];
    };
    system: {
      memoryUsed: number;
      memoryTotal: number;
      cpuUsage: number;
      uptime: number;
    };
  }> {
    const health = await Health.check();
    
    // Request metrics
    const requestsAgg = this.getAggregatedMetrics('http.request.count', 60000);
    const errorsAgg = this.getAggregatedMetrics('http.request.errors', 60000);
    const durationAgg = this.getAggregatedMetrics('http.request.duration', 60000);
    const executionsAgg = this.getAggregatedMetrics('agent.execution.active', 60000);
    
    // Alert summary
    const alertStatesList = this.getAlertStates();
    const firingAlerts = alertStatesList.filter(a => a.status === 'firing');
    
    // System metrics
    const memUsage = process.memoryUsage();
    
    return {
      health,
      metrics: {
        requestsPerMinute: requestsAgg?.sum || 0,
        errorRate: requestsAgg?.sum ? ((errorsAgg?.sum || 0) / requestsAgg.sum) * 100 : 0,
        avgResponseTime: durationAgg?.avg || 0,
        activeExecutions: executionsAgg?.avg || 0,
      },
      alerts: {
        firing: firingAlerts.length,
        total: alertStatesList.length,
        recent: firingAlerts.slice(0, 5),
      },
      system: {
        memoryUsed: memUsage.heapUsed,
        memoryTotal: memUsage.heapTotal,
        cpuUsage: 0, // Would need more sophisticated calculation
        uptime: process.uptime(),
      },
    };
  },

  /**
   * Get available metrics list
   */
  getAvailableMetrics(): string[] {
    const metrics = new Set<string>();
    for (const key of metricsHistory.keys()) {
      const baseName = key.split('{')[0];
      metrics.add(baseName);
    }
    return Array.from(metrics).sort();
  },
};

// Default dashboards
export const DEFAULT_DASHBOARDS: Dashboard[] = [
  {
    id: 'overview',
    name: 'System Overview',
    description: 'High-level system health and performance',
    refreshInterval: 30,
    widgets: [
      {
        id: 'requests-rate',
        title: 'Requests / Minute',
        type: 'stat',
        metrics: ['http.request.count'],
        aggregation: 'sum',
        timeRange: '1m',
      },
      {
        id: 'error-rate',
        title: 'Error Rate',
        type: 'gauge',
        metrics: ['http.request.errors', 'http.request.count'],
        aggregation: 'avg',
        timeRange: '5m',
        thresholds: { warning: 1, critical: 5 },
      },
      {
        id: 'response-time',
        title: 'Avg Response Time',
        type: 'line',
        metrics: ['http.request.duration'],
        aggregation: 'avg',
        timeRange: '1h',
        thresholds: { warning: 1000, critical: 5000 },
      },
      {
        id: 'memory-usage',
        title: 'Memory Usage',
        type: 'gauge',
        metrics: ['system.memory.used_percent'],
        aggregation: 'avg',
        timeRange: '5m',
        thresholds: { warning: 70, critical: 90 },
      },
    ],
  },
  {
    id: 'agents',
    name: 'Agent Performance',
    description: 'Agent execution metrics and health',
    refreshInterval: 30,
    widgets: [
      {
        id: 'active-executions',
        title: 'Active Executions',
        type: 'stat',
        metrics: ['agent.execution.active'],
        aggregation: 'avg',
        timeRange: '1m',
      },
      {
        id: 'execution-success',
        title: 'Success Rate',
        type: 'gauge',
        metrics: ['agent.execution.success', 'agent.execution.total'],
        aggregation: 'avg',
        timeRange: '1h',
        thresholds: { warning: 90, critical: 80 },
      },
      {
        id: 'execution-duration',
        title: 'Execution Duration',
        type: 'line',
        metrics: ['agent.execution.duration'],
        aggregation: 'p95',
        timeRange: '1h',
      },
      {
        id: 'top-agents',
        title: 'Top Agents by Usage',
        type: 'table',
        metrics: ['agent.execution.count'],
        aggregation: 'sum',
        timeRange: '24h',
      },
    ],
  },
];
