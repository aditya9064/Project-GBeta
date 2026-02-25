import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAgents } from '../../contexts/AgentContext';
import type { ExecutionRecord, DeployedAgent } from '../../services/automation/types';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  Search,
  RotateCcw,
  Copy,
  ArrowLeft,
  Activity,
  Timer,
  TrendingUp,
  Calendar,
  Play,
  CircleDot,
  Terminal,
  Layers,
} from 'lucide-react';
import './ExecutionLogs.css';

interface ExecutionLogsProps {
  agentId?: string;
  onBack?: () => void;
}

export function ExecutionLogs({ agentId, onBack }: ExecutionLogsProps) {
  const { agents, getExecutionHistory } = useAgents();
  const [allLogs, setAllLogs] = useState<{ agent: DeployedAgent; executions: ExecutionRecord[] }[]>([]);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'output' | 'nodes' | 'error'>>({});
  const hasLoaded = useRef(false);

  // Stable refs to avoid re-render loops
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const getHistoryRef = useRef(getExecutionHistory);
  getHistoryRef.current = getExecutionHistory;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const currentAgents = agentsRef.current;
    const targetAgents = agentId ? currentAgents.filter(a => a.id === agentId) : currentAgents;
    const results: { agent: DeployedAgent; executions: ExecutionRecord[] }[] = [];

    for (const agent of targetAgents) {
      const history = await getHistoryRef.current(agent.id);
      if (history.length > 0) {
        results.push({ agent, executions: history });
      }
    }

    results.sort((a, b) => {
      const aTime = a.executions[0]?.startedAt?.getTime() || 0;
      const bTime = b.executions[0]?.startedAt?.getTime() || 0;
      return bTime - aTime;
    });

    setAllLogs(results);
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      loadLogs();
    }
  }, [loadLogs]);

  const toggleExecution = (e: React.MouseEvent, execId: string) => {
    e.stopPropagation();
    setExpandedExecution(prev => prev === execId ? null : execId);
    setExpandedNode(null);
  };

  const toggleNode = (e: React.MouseEvent, nodeKey: string) => {
    e.stopPropagation();
    setExpandedNode(prev => prev === nodeKey ? null : nodeKey);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const setTabForExec = (execId: string, tab: 'output' | 'nodes' | 'error') => {
    setActiveTab(prev => ({ ...prev, [execId]: tab }));
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatTime = (date?: Date) => {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const relativeTime = (date?: Date) => {
    if (!date) return '';
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return '';
  };

  const formatJson = (data: any): string => {
    if (data === undefined || data === null) return 'null';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  // Filter executions
  const filteredLogs = allLogs
    .map(entry => {
      const filtered = entry.executions.filter(exec => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'completed' && exec.status === 'completed') ||
          (statusFilter === 'failed' && exec.status === 'failed');
        const matchesSearch =
          !searchTerm ||
          entry.agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          exec.id.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
      });
      return { ...entry, executions: filtered };
    })
    .filter(entry => entry.executions.length > 0);

  const totalExecutions = filteredLogs.reduce((sum, e) => sum + e.executions.length, 0);

  // Compute stats
  const stats = useMemo(() => {
    const allExecs = allLogs.flatMap(e => e.executions);
    const total = allExecs.length;
    const completed = allExecs.filter(e => e.status === 'completed').length;
    const failed = allExecs.filter(e => e.status === 'failed').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgDuration = total > 0
      ? Math.round(allExecs.reduce((s, e) => s + (e.duration || 0), 0) / total)
      : 0;
    const lastRun = allExecs.length > 0
      ? allExecs.reduce((latest, e) => {
          const t = new Date(e.startedAt || 0).getTime();
          return t > latest ? t : latest;
        }, 0)
      : 0;

    return { total, completed, failed, successRate, avgDuration, lastRun };
  }, [allLogs]);

  if (loading) {
    return (
      <div className="el">
        <div className="el-loading">
          <div className="el-loading-pulse">
            <Activity size={24} />
          </div>
          <span>Loading execution logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="el">
      {/* ─── Header Banner ─── */}
      <div className="el-banner">
        <div className="el-banner-bg" />
        <div className="el-banner-content">
          <div className="el-banner-left">
            {onBack && (
              <button className="el-back-btn" onClick={onBack}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="el-banner-icon">
              <Activity size={26} />
            </div>
            <div>
              <h2 className="el-banner-title">Execution Logs</h2>
              <p className="el-banner-sub">
                {totalExecutions} execution{totalExecutions !== 1 ? 's' : ''} across {filteredLogs.length} agent{filteredLogs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button className="el-refresh" onClick={loadLogs} title="Refresh logs">
            <RotateCcw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="el-stats">
        <div className="el-stat">
          <div className="el-stat-icon runs"><Play size={18} /></div>
          <div className="el-stat-body">
            <span className="el-stat-value">{stats.total}</span>
            <span className="el-stat-label">Total Runs</span>
          </div>
        </div>
        <div className="el-stat">
          <div className="el-stat-icon success"><TrendingUp size={18} /></div>
          <div className="el-stat-body">
            <span className="el-stat-value">{stats.successRate}%</span>
            <span className="el-stat-label">Success Rate</span>
          </div>
        </div>
        <div className="el-stat">
          <div className="el-stat-icon duration"><Timer size={18} /></div>
          <div className="el-stat-body">
            <span className="el-stat-value">{formatDuration(stats.avgDuration)}</span>
            <span className="el-stat-label">Avg Duration</span>
          </div>
        </div>
        <div className="el-stat">
          <div className="el-stat-icon last"><Calendar size={18} /></div>
          <div className="el-stat-body">
            <span className="el-stat-value">
              {stats.lastRun ? relativeTime(new Date(stats.lastRun)) || formatTime(new Date(stats.lastRun)) : '—'}
            </span>
            <span className="el-stat-label">Last Run</span>
          </div>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="el-toolbar">
        <div className="el-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search by agent or execution ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="el-search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
        <div className="el-filters">
          {(['all', 'completed', 'failed'] as const).map(f => (
            <button
              key={f}
              className={`el-filter ${statusFilter === f ? 'active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f === 'completed' && <CheckCircle2 size={13} />}
              {f === 'failed' && <XCircle size={13} />}
              {f === 'all' && <Layers size={13} />}
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'all' && <span className="el-filter-count">{stats.total}</span>}
              {f === 'completed' && <span className="el-filter-count">{stats.completed}</span>}
              {f === 'failed' && <span className="el-filter-count">{stats.failed}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Empty ─── */}
      {filteredLogs.length === 0 && (
        <div className="el-empty">
          <div className="el-empty-icon">
            <Terminal size={48} />
          </div>
          <h3>No execution logs found</h3>
          <p>
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters or search term.'
              : 'Run an agent to see its execution output here.'}
          </p>
        </div>
      )}

      {/* ─── Logs List ─── */}
      <div className="el-list">
        {filteredLogs.map(({ agent, executions }) => (
          <div key={agent.id} className="el-agent-group">
            {/* Agent header */}
            <div className="el-agent-head">
              <div className="el-agent-avatar">
                <Zap size={14} />
              </div>
              <span className="el-agent-name">{agent.name}</span>
              <span className="el-agent-runs">{executions.length} run{executions.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Timeline */}
            <div className="el-timeline">
              {executions.map((exec, execIdx) => {
                const isExpanded = expandedExecution === exec.id;
                const successNodes = exec.nodeExecutions.filter(n => n.status === 'completed').length;
                const failedNodes = exec.nodeExecutions.filter(n => n.status === 'failed').length;
                const totalNodes = exec.nodeExecutions.length;
                const progressPct = totalNodes > 0 ? Math.round((successNodes / totalNodes) * 100) : 0;
                const tab = activeTab[exec.id] || 'nodes';
                const rel = relativeTime(exec.startedAt);
                const isLast = execIdx === executions.length - 1;

                return (
                  <div key={exec.id} className={`el-tl-item ${isExpanded ? 'expanded' : ''} ${isLast ? 'last' : ''}`}>
                    {/* Timeline dot + line */}
                    <div className="el-tl-track">
                      <div className={`el-tl-dot ${exec.status}`}>
                        {exec.status === 'completed' ? (
                          <CheckCircle2 size={14} />
                        ) : exec.status === 'failed' ? (
                          <XCircle size={14} />
                        ) : (
                          <CircleDot size={14} />
                        )}
                      </div>
                      {!isLast && <div className="el-tl-line" />}
                    </div>

                    {/* Card */}
                    <div className={`el-card ${exec.status} ${isExpanded ? 'expanded' : ''}`}>
                      <button
                        className="el-card-head"
                        onClick={(e) => toggleExecution(e, exec.id)}
                      >
                        <div className="el-card-main">
                          <div className="el-card-top-row">
                            <span className="el-card-time">{formatTime(exec.startedAt)}</span>
                            {rel && <span className="el-card-rel">{rel}</span>}
                          </div>
                          <span className="el-card-id">{exec.id}</span>
                        </div>

                        <div className="el-card-badges">
                          <span className="el-card-trigger">{exec.triggeredBy}</span>
                          <span className={`el-card-status-pill ${exec.status}`}>
                            {exec.status === 'completed' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                            {exec.status}
                          </span>
                        </div>

                        {/* Mini node pipeline */}
                        <div className="el-card-pipeline">
                          {exec.nodeExecutions.map((n, ni) => (
                            <div key={ni} className={`el-pip-dot ${n.status}`} title={n.nodeName} />
                          ))}
                        </div>

                        <div className="el-card-metrics">
                          <span className="el-card-nodes">
                            {successNodes}/{totalNodes}
                            {failedNodes > 0 && <span className="el-card-failed"> · {failedNodes} failed</span>}
                          </span>
                          <span className="el-card-dur">
                            <Clock size={12} />
                            {formatDuration(exec.duration)}
                          </span>
                        </div>

                        <span className="el-card-chevron">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                      </button>

                      {/* Node progress bar */}
                      <div className="el-card-progress">
                        <div
                          className={`el-card-progress-fill ${exec.status}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* ─── Expanded Detail ─── */}
                      {isExpanded && (
                        <div className="el-detail">
                          {/* Tabs */}
                          <div className="el-tabs">
                            <button
                              className={`el-tab ${tab === 'nodes' ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setTabForExec(exec.id, 'nodes'); }}
                            >
                              <Layers size={14} /> Nodes ({totalNodes})
                            </button>
                            {exec.output && (
                              <button
                                className={`el-tab ${tab === 'output' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setTabForExec(exec.id, 'output'); }}
                              >
                                <Terminal size={14} /> Output
                              </button>
                            )}
                            {exec.error && (
                              <button
                                className={`el-tab ${tab === 'error' ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); setTabForExec(exec.id, 'error'); }}
                              >
                                <AlertTriangle size={14} /> Error
                              </button>
                            )}
                          </div>

                          {/* Tab: Nodes */}
                          {tab === 'nodes' && (
                            <div className="el-nodes">
                              {exec.nodeExecutions.map((node, idx) => {
                                const nodeKey = `${exec.id}-${node.nodeId}-${idx}`;
                                const isNodeExp = expandedNode === nodeKey;
                                const hasOutput = node.output !== undefined && node.output !== null;
                                const hasInput = node.input !== undefined && node.input !== null;
                                const isSimulated = node.output?._simulated === true;
                                const isLastNode = idx === exec.nodeExecutions.length - 1;

                                return (
                                  <div key={nodeKey} className={`el-node ${node.status} ${isNodeExp ? 'expanded' : ''}`}>
                                    <button
                                      className="el-node-head"
                                      onClick={(e) => toggleNode(e, nodeKey)}
                                    >
                                      {/* Vertical step connector */}
                                      <div className="el-node-step">
                                        <div className={`el-node-dot ${node.status}`} />
                                        {!isLastNode && <div className="el-node-connector" />}
                                      </div>

                                      <span className="el-node-idx">{idx + 1}</span>
                                      <span className="el-node-name">{node.nodeName}</span>
                                      <span className="el-node-type">{node.nodeType}</span>
                                      {isSimulated && (
                                        <span className="el-node-sim">SIM</span>
                                      )}
                                      <span className="el-node-dur">{formatDuration(node.duration)}</span>
                                      {node.error && (
                                        <span className="el-node-err-icon" title={node.error}>
                                          <XCircle size={13} />
                                        </span>
                                      )}
                                      <span className="el-node-chevron">
                                        {isNodeExp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </span>
                                    </button>

                                    {isNodeExp && (
                                      <div className="el-node-body">
                                        <div className="el-node-timing">
                                          <span><Clock size={11} /> Started: {formatTime(node.startedAt)}</span>
                                          {node.completedAt && <span><CheckCircle2 size={11} /> Completed: {formatTime(node.completedAt)}</span>}
                                          <span><Timer size={11} /> Duration: {formatDuration(node.duration)}</span>
                                        </div>

                                        {node.error && (
                                          <div className="el-node-error">
                                            <h5><AlertTriangle size={12} /> Error</h5>
                                            <pre className="el-code el-code-error">{node.error}</pre>
                                          </div>
                                        )}

                                        {hasInput && (
                                          <div className="el-node-data">
                                            <div className="el-node-data-head">
                                              <h5>Input</h5>
                                              <button
                                                className="el-copy"
                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(formatJson(node.input), `input-${nodeKey}`); }}
                                              >
                                                <Copy size={11} />
                                                {copiedId === `input-${nodeKey}` ? 'Copied!' : 'Copy'}
                                              </button>
                                            </div>
                                            <pre className="el-code">{formatJson(node.input)}</pre>
                                          </div>
                                        )}

                                        {hasOutput && (
                                          <div className="el-node-data">
                                            <div className="el-node-data-head">
                                              <h5>Output</h5>
                                              <button
                                                className="el-copy"
                                                onClick={(e) => { e.stopPropagation(); copyToClipboard(formatJson(node.output), `output-${nodeKey}`); }}
                                              >
                                                <Copy size={11} />
                                                {copiedId === `output-${nodeKey}` ? 'Copied!' : 'Copy'}
                                              </button>
                                            </div>
                                            <pre className="el-code">{formatJson(node.output)}</pre>
                                          </div>
                                        )}

                                        {!hasInput && !hasOutput && !node.error && (
                                          <div className="el-node-empty">
                                            No input/output data recorded for this node.
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Tab: Output */}
                          {tab === 'output' && exec.output && (
                            <div className="el-output">
                              <div className="el-output-head">
                                <h4><Terminal size={14} /> Final Output</h4>
                                <button
                                  className="el-copy"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(formatJson(exec.output), `output-${exec.id}`); }}
                                >
                                  <Copy size={11} />
                                  {copiedId === `output-${exec.id}` ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                              <pre className="el-code el-code-output">{formatJson(exec.output)}</pre>
                            </div>
                          )}

                          {/* Tab: Error */}
                          {tab === 'error' && exec.error && (
                            <div className="el-error-section">
                              <h4><AlertTriangle size={14} /> Error Details</h4>
                              <div className="el-error-box">
                                <span className="el-error-node">Node: {exec.error.nodeId}</span>
                                <span className="el-error-msg">{exec.error.message}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
