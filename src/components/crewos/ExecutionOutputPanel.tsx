import { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Copy,
  ChevronRight,
  Activity,
  ArrowDownUp,
  Braces,
  Table2,
  SkipForward,
  Loader2,
  Timer,
  Zap,
} from 'lucide-react';
import type { ExecutionLog } from '../../services/automation/executionEngine';
import './ExecutionOutputPanel.css';

interface ExecutionOutputPanelProps {
  agentName: string;
  agentIcon?: string;
  logs: ExecutionLog[];
  success: boolean;
  error?: string;
  isReal: boolean;
  onClose: () => void;
  onViewFullLogs?: () => void;
}

type DataView = 'json' | 'table';

export function ExecutionOutputPanel({
  agentName,
  logs,
  success,
  error,
  isReal,
  onClose,
  onViewFullLogs,
}: ExecutionOutputPanelProps) {
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [dataTab, setDataTab] = useState<'input' | 'output'>('output');
  const [dataView, setDataView] = useState<DataView>('table');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedNode = selectedNodeIndex !== null ? logs[selectedNodeIndex] : null;

  const totalDuration = useMemo(() => {
    return logs.reduce((sum, l) => sum + (l.duration || 0), 0);
  }, [logs]);

  const completedCount = logs.filter(l => l.status === 'completed').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const skippedCount = logs.filter(l => l.status === 'skipped').length;

  const formatDuration = (ms?: number) => {
    if (!ms && ms !== 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatJson = (data: any): string => {
    if (data === undefined || data === null) return 'null';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  // Convert data to table rows (key-value pairs for objects, indexed for arrays)
  const getTableData = (data: any): { rows: { key: string; value: string; type: string }[] } => {
    if (data === null || data === undefined) {
      return { rows: [] };
    }

    if (Array.isArray(data)) {
      // If array of objects, show as rows
      if (data.length > 0 && typeof data[0] === 'object') {
        return {
          rows: data.map((item, i) => ({
            key: `[${i}]`,
            value: typeof item === 'object' ? JSON.stringify(item) : String(item),
            type: typeof item,
          })),
        };
      }
      return {
        rows: data.map((item, i) => ({
          key: `[${i}]`,
          value: String(item),
          type: typeof item,
        })),
      };
    }

    if (typeof data === 'object') {
      return {
        rows: Object.entries(data).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          type: typeof value === 'object' ? (value === null ? 'null' : Array.isArray(value) ? 'array' : 'object') : typeof value,
        })),
      };
    }

    return { rows: [{ key: 'value', value: String(data), type: typeof data }] };
  };

  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={14} />;
      case 'failed':
        return <XCircle size={14} />;
      case 'skipped':
        return <SkipForward size={14} />;
      case 'running':
        return <Loader2 size={14} className="eop-spin" />;
      default:
        return <Clock size={14} />;
    }
  };

  const getNodeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      trigger: 'Trigger',
      app: 'App',
      ai: 'AI',
      condition: 'Condition',
      filter: 'Filter',
      delay: 'Delay',
      action: 'Action',
      knowledge: 'Knowledge',
    };
    return labels[type] || type;
  };

  const currentData = selectedNode
    ? (dataTab === 'input' ? selectedNode.input : selectedNode.output)
    : null;

  const tableData = currentData ? getTableData(currentData) : { rows: [] };
  const hasData = currentData !== null && currentData !== undefined;

  return (
    <div className="eop-overlay" onClick={onClose}>
      <div className="eop-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`eop-header ${success ? 'success' : 'error'}`}>
          <div className="eop-header-left">
            <div className={`eop-header-icon ${success ? 'success' : 'error'}`}>
              {success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            </div>
            <div className="eop-header-info">
              <h3 className="eop-header-title">
                {agentName}
              </h3>
              <div className="eop-header-meta">
                <span className={`eop-status-badge ${success ? 'success' : 'error'}`}>
                  {success ? 'Completed' : 'Failed'}
                </span>
                <span className="eop-meta-sep">·</span>
                <span className="eop-meta-item">
                  <Timer size={12} />
                  {formatDuration(totalDuration)}
                </span>
                <span className="eop-meta-sep">·</span>
                <span className="eop-meta-item">
                  {completedCount}/{logs.length} nodes
                  {failedCount > 0 && <span className="eop-meta-fail"> · {failedCount} failed</span>}
                  {skippedCount > 0 && <span className="eop-meta-skip"> · {skippedCount} skipped</span>}
                </span>
                <span className="eop-meta-sep">·</span>
                <span className={`eop-meta-mode ${isReal ? 'real' : 'demo'}`}>
                  {isReal ? '● Live' : '○ Demo'}
                </span>
              </div>
            </div>
          </div>
          <button className="eop-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="eop-error-banner">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Body: Pipeline + Data panel */}
        <div className="eop-body">
          {/* Left: Node pipeline */}
          <div className="eop-pipeline">
            <div className="eop-pipeline-header">
              <Activity size={14} />
              <span>Execution Pipeline</span>
            </div>
            <div className="eop-node-list">
              {logs.map((log, index) => (
                <button
                  key={log.nodeId + index}
                  className={`eop-node ${log.status} ${selectedNodeIndex === index ? 'selected' : ''}`}
                  onClick={() => setSelectedNodeIndex(index)}
                >
                  {/* Connector line */}
                  <div className="eop-node-track">
                    <div className={`eop-node-dot ${log.status}`}>
                      {getNodeStatusIcon(log.status)}
                    </div>
                    {index < logs.length - 1 && <div className={`eop-node-line ${log.status}`} />}
                  </div>

                  {/* Node info */}
                  <div className="eop-node-content">
                    <div className="eop-node-top">
                      <span className="eop-node-name">{log.nodeName}</span>
                      <span className="eop-node-dur">{formatDuration(log.duration)}</span>
                    </div>
                    <div className="eop-node-bottom">
                      <span className="eop-node-type">{getNodeTypeLabel(log.nodeType)}</span>
                      {log.isReal && <span className="eop-node-real">LIVE</span>}
                      {!log.isReal && log.status === 'completed' && <span className="eop-node-sim">SIM</span>}
                      {log.error && <span className="eop-node-err">Error</span>}
                    </div>
                  </div>

                  <ChevronRight size={14} className="eop-node-arrow" />
                </button>
              ))}
            </div>

            {/* View full logs link */}
            {onViewFullLogs && (
              <button className="eop-view-logs" onClick={onViewFullLogs}>
                <Activity size={13} />
                View Full Execution Logs →
              </button>
            )}
          </div>

          {/* Right: Data inspector */}
          <div className="eop-inspector">
            {selectedNode ? (
              <>
                {/* Inspector header */}
                <div className="eop-inspector-header">
                  <div className="eop-inspector-title">
                    <Zap size={14} />
                    <span>{selectedNode.nodeName}</span>
                    <span className={`eop-inspector-status ${selectedNode.status}`}>
                      {selectedNode.status}
                    </span>
                  </div>
                  <div className="eop-inspector-controls">
                    {/* Input / Output tabs */}
                    <div className="eop-data-tabs">
                      <button
                        className={`eop-data-tab ${dataTab === 'input' ? 'active' : ''}`}
                        onClick={() => setDataTab('input')}
                      >
                        <ArrowDownUp size={12} />
                        Input
                      </button>
                      <button
                        className={`eop-data-tab ${dataTab === 'output' ? 'active' : ''}`}
                        onClick={() => setDataTab('output')}
                      >
                        <ArrowDownUp size={12} />
                        Output
                      </button>
                    </div>
                    {/* View toggle */}
                    <div className="eop-view-toggle">
                      <button
                        className={`eop-view-btn ${dataView === 'table' ? 'active' : ''}`}
                        onClick={() => setDataView('table')}
                        title="Table view"
                      >
                        <Table2 size={13} />
                      </button>
                      <button
                        className={`eop-view-btn ${dataView === 'json' ? 'active' : ''}`}
                        onClick={() => setDataView('json')}
                        title="JSON view"
                      >
                        <Braces size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Node error */}
                {selectedNode.error && (
                  <div className="eop-node-error-box">
                    <AlertTriangle size={13} />
                    <span>{selectedNode.error}</span>
                  </div>
                )}

                {/* Data content */}
                <div className="eop-data-content">
                  {!hasData ? (
                    <div className="eop-data-empty">
                      <Braces size={32} />
                      <span>No {dataTab} data recorded for this node</span>
                    </div>
                  ) : dataView === 'json' ? (
                    <div className="eop-json-wrapper">
                      <div className="eop-json-toolbar">
                        <span className="eop-json-label">JSON</span>
                        <button
                          className="eop-copy-btn"
                          onClick={() => copyToClipboard(formatJson(currentData), `${dataTab}-${selectedNode.nodeId}`)}
                        >
                          <Copy size={12} />
                          {copiedKey === `${dataTab}-${selectedNode.nodeId}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="eop-json">{formatJson(currentData)}</pre>
                    </div>
                  ) : (
                    <div className="eop-table-wrapper">
                      <div className="eop-table-toolbar">
                        <span className="eop-table-label">
                          {tableData.rows.length} {tableData.rows.length === 1 ? 'field' : 'fields'}
                        </span>
                        <button
                          className="eop-copy-btn"
                          onClick={() => copyToClipboard(formatJson(currentData), `${dataTab}-${selectedNode.nodeId}`)}
                        >
                          <Copy size={12} />
                          {copiedKey === `${dataTab}-${selectedNode.nodeId}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <table className="eop-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.rows.map((row, i) => (
                            <tr key={i}>
                              <td className="eop-table-key">{row.key}</td>
                              <td className="eop-table-value">
                                <span className="eop-table-value-text">{row.value}</span>
                              </td>
                              <td className="eop-table-type">
                                <span className={`eop-type-badge ${row.type}`}>{row.type}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="eop-inspector-empty">
                <div className="eop-inspector-empty-icon">
                  <Zap size={36} />
                </div>
                <h4>Select a node</h4>
                <p>Click on any node in the pipeline to inspect its input and output data.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

