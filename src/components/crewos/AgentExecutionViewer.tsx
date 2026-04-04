import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Minus, Maximize2, Eye, Monitor, Loader2, CheckCircle,
  AlertCircle, MousePointer, Type, ArrowDown, Keyboard, Globe,
  Clock, Database, ChevronRight,
} from 'lucide-react';
import './AgentExecutionViewer.css';
import { getAuthHeaders } from '../../lib/firebase';

/* ─── Types ──────────────────────────────────────────────── */

interface VisionAction {
  action: string;
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  url?: string;
  direction?: string;
  reason: string;
  extractedData?: any;
}

interface LogEntry {
  id: string;
  type: string;
  step?: number;
  action?: VisionAction;
  message: string;
  timestamp: string;
}

export interface AgentRunResult {
  agentId: string;
  agentName: string;
  task: string;
  status: 'done' | 'error';
  extractedData: any;
  totalSteps: number;
  completedAt: string;
  error?: string;
}

interface AgentExecutionViewerProps {
  agentId: string;
  agentName: string;
  task: string;
  url?: string;
  appName?: string;
  index?: number;
  onClose: () => void;
  onComplete?: (result: AgentRunResult) => void;
}

// In production, use relative /api paths. In dev, VITE_API_URL points to localhost:3001
const BACKEND = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || '');

/* ─── Component ──────────────────────────────────────────── */

export function AgentExecutionViewer({
  agentId,
  agentName,
  task,
  url,
  appName,
  index = 0,
  onClose,
  onComplete,
}: AgentExecutionViewerProps) {
  const [minimized, setMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [currentTitle, setCurrentTitle] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(25);
  const [selectedLogIdx, setSelectedLogIdx] = useState(-1);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logOffsetRef = useRef(0);

  // Generate a stable session ID once (outside useEffect so it survives StrictMode re-mount)
  const sessionId = useRef(`${agentId}-${Date.now()}`).current;

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLogs = useCallback((entries: Array<{ type: string; step?: number; action?: VisionAction; message: string; timestamp: string }>) => {
    setLogs(prev => [
      ...prev,
      ...entries.map(e => ({
        ...e,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);
  }, []);

  // Start the task once
  const taskStarted = useRef(false);
  useEffect(() => {
    if (taskStarted.current) return;
    taskStarted.current = true;

    getAuthHeaders().then(headers =>
      fetch(`${BACKEND}/api/browser/vision/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task, url, appName, sessionId }),
      })
    ).catch(err => {
      setStatus('error');
      addLogs([{ type: 'error', message: `Failed to start: ${err.message}`, timestamp: new Date().toISOString() }]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for state updates (separate effect — restarts correctly on StrictMode re-mount)
  useEffect(() => {
    let stopped = false;

    const pollInterval = setInterval(async () => {
      if (stopped) return;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${BACKEND}/api/browser/vision/poll/${sessionId}?since=${logOffsetRef.current}`, { headers });
        const data = await res.json();
        if (!data.success) return;

        if (data.logs && data.logs.length > 0) {
          addLogs(data.logs);
          logOffsetRef.current = data.totalLogs;
          const lastLog = data.logs[data.logs.length - 1];
          setIsThinking(lastLog.type === 'thinking');
        }

        if (data.currentUrl) setCurrentUrl(data.currentUrl);
        if (data.currentTitle) setCurrentTitle(data.currentTitle);
        if (data.progress) setProgress(data.progress);
        if (data.totalSteps) setTotalSteps(data.totalSteps);
        if (data.extractedData) setExtractedData(data.extractedData);

        if (data.status === 'done' || data.status === 'error') {
          setStatus(data.status);
          setIsThinking(false);
          if (data.error) {
            addLogs([{ type: 'error', message: data.error, timestamp: new Date().toISOString() }]);
          }
          stopped = true;
          clearInterval(pollInterval);

          onComplete?.({
            agentId,
            agentName,
            task,
            status: data.status,
            extractedData: data.extractedData || null,
            totalSteps: data.progress || 0,
            completedAt: new Date().toISOString(),
            error: data.error,
          });
        }
      } catch { /* ignore polling errors */ }
    }, 600);

    const screenshotInterval = setInterval(async () => {
      if (stopped) return;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${BACKEND}/api/browser/vision/screenshot/${sessionId}`, { headers });
        const data = await res.json();
        if (data.success && data.screenshot) {
          setCurrentScreenshot(data.screenshot);
        }
      } catch { /* ignore */ }
    }, 800);

    return () => {
      stopped = true;
      clearInterval(pollInterval);
      clearInterval(screenshotInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actionIcon = (action?: string) => {
    switch (action) {
      case 'click': return <MousePointer size={11} />;
      case 'type': return <Type size={11} />;
      case 'scroll': return <ArrowDown size={11} />;
      case 'press_key': return <Keyboard size={11} />;
      case 'navigate': return <Globe size={11} />;
      case 'wait': return <Clock size={11} />;
      case 'done': return <CheckCircle size={11} />;
      case 'fail': return <AlertCircle size={11} />;
      default: return <ChevronRight size={11} />;
    }
  };

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return ''; }
  };

  const renderDataValue = (data: any, depth = 0): JSX.Element => {
    if (data === null || data === undefined) return <span className="val">null</span>;
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return <span className="val">{String(data)}</span>;
    if (Array.isArray(data)) {
      return (
        <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
          {data.map((item, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span className="key">[{i}]</span>{' '}
              {renderDataValue(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    if (typeof data === 'object') {
      return (
        <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
          {Object.entries(data).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 4 }}>
              <span className="key">{key}:</span>{' '}
              {renderDataValue(val, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    return <span>{String(data)}</span>;
  };

  if (minimized) {
    return (
      <div className="aev-container minimized" style={{ bottom: `${20 + index * 56}px` }} onClick={() => setMinimized(false)}>
        <div className="aev-minimized-bar">
          <div className="aev-minimized-icon"><Eye size={14} /></div>
          <div className="aev-minimized-info">
            <div className="aev-minimized-name">{agentName}</div>
            <div className="aev-minimized-status">
              <span className={`aev-status-dot ${status}`} />
              {status === 'running' ? `Step ${progress}/${totalSteps}` : status === 'done' ? 'Completed' : 'Error'}
            </div>
          </div>
          <div className="aev-minimized-actions">
            <button className="aev-header-btn" onClick={(e) => { e.stopPropagation(); setMinimized(false); }}><Maximize2 size={13} /></button>
            <button className="aev-header-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}><X size={13} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aev-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMinimized(true); }}>
      <div className="aev-container">
        <div className="aev-header">
          <div className="aev-header-left">
            <div className="aev-header-icon"><Eye size={16} /></div>
            <div className="aev-header-info">
              <div className="aev-header-name">{agentName}</div>
              <div className="aev-header-status">
                <span className={`aev-status-dot ${status}`} />
                {status === 'running' && `Running — Step ${progress}/${totalSteps}`}
                {status === 'done' && `Completed in ${progress} steps`}
                {status === 'error' && 'Failed'}
              </div>
            </div>
          </div>
          <div className="aev-header-actions">
            <button
              onClick={() => setMinimized(true)}
              title="Minimize — keep running in background while you start another agent"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid #e2e8f0', background: '#f8fafc',
                color: '#475569', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e07a3a'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#e07a3a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <Minus size={13} /> Minimize
            </button>
            <button className="aev-header-btn" onClick={onClose} title={status === 'running' ? 'Stop & Close' : 'Close'}><X size={14} /></button>
          </div>
        </div>

        {status === 'running' && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '6px 16px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
              fontSize: 12, color: '#1e40af', cursor: 'pointer',
            }}
            onClick={() => setMinimized(true)}
          >
            <Minus size={12} />
            <span>Want to start another agent? Click <strong>Minimize</strong> or click here — this agent keeps running in the background.</span>
          </div>
        )}

        <div className="aev-progress">
          <div className="aev-progress-bar" style={{ width: `${totalSteps ? (progress / totalSteps) * 100 : 0}%` }} />
        </div>

        <div className="aev-body">
          {/* Left: Logs */}
          <div className="aev-logs">
            <div className="aev-logs-title">Steps & Logs</div>
            <div className="aev-logs-list">
              {logs.map((log, idx) => (
                <div key={log.id} className={`aev-log-item ${selectedLogIdx === idx ? 'active' : ''}`} onClick={() => setSelectedLogIdx(idx)}>
                  <div className={`aev-log-step-badge ${log.action?.action || log.type}`}>
                    {log.step ? log.step : actionIcon(log.action?.action || log.type)}
                  </div>
                  <div className="aev-log-content">
                    <div className="aev-log-action">
                      {log.action?.action || log.type}
                      {log.action?.action === 'click' && log.action.x !== undefined && (
                        <span style={{ fontWeight: 400, color: '#64748b', fontSize: 10, marginLeft: 6 }}>({log.action.x}, {log.action.y})</span>
                      )}
                      {log.action?.action === 'type' && log.action.text && (
                        <span style={{ fontWeight: 400, color: '#64748b', fontSize: 10, marginLeft: 6 }}>"{log.action.text.substring(0, 20)}"</span>
                      )}
                    </div>
                    <div className="aev-log-reason">{log.message}</div>
                  </div>
                  <div className="aev-log-time">{formatTime(log.timestamp)}</div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Center: Browser View */}
          <div className="aev-browser">
            <div className="aev-url-bar">
              <div className="aev-url-dots">
                <div className="aev-url-dot red" />
                <div className="aev-url-dot yellow" />
                <div className="aev-url-dot green" />
              </div>
              <div className="aev-url-input">{currentUrl || 'about:blank'}</div>
            </div>
            <div className="aev-screenshot-container">
              {currentScreenshot ? (
                <img className="aev-screenshot-img" src={`data:image/jpeg;base64,${currentScreenshot}`} alt="Browser view" />
              ) : (
                <div className="aev-screenshot-placeholder">
                  <Monitor size={48} />
                  <span>Waiting for browser to load...</span>
                </div>
              )}
              {isThinking && (
                <div className="aev-thinking-overlay">
                  <Loader2 size={14} className="spinning" />
                  Analyzing page...
                </div>
              )}
            </div>
          </div>

          {/* Right: Extracted Data */}
          <div className="aev-data">
            <div className="aev-data-title">
              <Database size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
              Extracted Data
            </div>
            <div className="aev-data-content">
              {extractedData ? (
                <div className="aev-data-summary">
                  <div className="aev-data-card">
                    <div className="aev-data-card-title">Task</div>
                    <div className="aev-data-card-value">{task}</div>
                  </div>
                  <div className="aev-data-card">
                    <div className="aev-data-card-title">Results</div>
                    <div className="aev-data-card-value">{renderDataValue(extractedData)}</div>
                  </div>
                </div>
              ) : (
                <div className="aev-data-empty">
                  <Database size={32} style={{ opacity: 0.3 }} />
                  <span>
                    {status === 'running' ? 'Data will appear here as the agent extracts information...'
                      : status === 'error' ? 'No data was extracted'
                      : 'Waiting for data...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
