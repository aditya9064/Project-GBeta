/* ═══════════════════════════════════════════════════════════
   Feature 10: Shell Executor — full shell command execution
   with iterative debugging, error analysis, and session mgmt
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Terminal, Play, Loader2, XCircle, CheckCircle, Clock,
  RefreshCw, Trash2, Plus, StopCircle, RotateCcw, Send,
  AlertTriangle, Wand2, ChevronRight,
} from 'lucide-react';

interface ShellSession {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startedAt: string;
  completedAt?: string;
  cwd: string;
  pid?: number;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  running: { color: '#60a5fa', icon: Loader2, label: 'Running' },
  completed: { color: '#10b981', icon: CheckCircle, label: 'Completed' },
  failed: { color: '#ef4444', icon: XCircle, label: 'Failed' },
  killed: { color: '#f59e0b', icon: StopCircle, label: 'Killed' },
};

export function ShellExecutor() {
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('');
  const [sessions, setSessions] = useState<ShellSession[]>([]);
  const [executing, setExecuting] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [runAsync, setRunAsync] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoFix, setAutoFix] = useState(false);
  const [fixIteration, setFixIteration] = useState(0);
  const [maxFixIterations, setMaxFixIterations] = useState(3);
  const outputRef = useRef<HTMLPreElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/devtools/shell/sessions');
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch { /* */ }
  }, []);

  const pollSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/devtools/shell/${id}`);
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.map(s => s.id === id ? data.data : s));
        if (data.data.status === 'running') {
          setTimeout(() => pollSession(id), 1000);
        }
      }
    } catch { /* */ }
  }, []);

  const executeCommand = useCallback(async (cmd?: string) => {
    const cmdToRun = cmd || command;
    if (!cmdToRun.trim()) return;
    setExecuting(true);

    if (!cmd) {
      setHistory(prev => [cmdToRun, ...prev.filter(h => h !== cmdToRun)].slice(0, 50));
      setHistoryIndex(-1);
    }

    try {
      const res = await fetch('/api/devtools/shell/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdToRun, cwd: cwd || undefined, async: runAsync }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => [data.data, ...prev]);
        setSelectedSession(data.data.id);
        if (!cmd) setCommand('');

        if (data.data.status === 'running') {
          pollSession(data.data.id);
        }

        return data.data;
      }
    } catch { /* */ }
    finally { setExecuting(false); }
    return null;
  }, [command, cwd, runAsync, pollSession]);

  const killSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/devtools/shell/${id}/kill`, { method: 'POST' });
      fetchSessions();
    } catch { /* */ }
  }, [fetchSessions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  }, [executeCommand, history, historyIndex]);

  const startAutoFix = useCallback(async () => {
    if (!command.trim()) return;
    setAutoFix(true);
    setFixIteration(0);

    let currentCmd = command;
    for (let i = 0; i < maxFixIterations; i++) {
      setFixIteration(i + 1);
      const session = await executeCommand(currentCmd);
      if (!session) break;

      if (session.status === 'completed' && session.exitCode === 0) {
        break;
      }

      // Wait for async commands to finish
      if (session.status === 'running') {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    setAutoFix(false);
  }, [command, maxFixIterations, executeCommand]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [selectedSession, sessions]);

  const selected = sessions.find(s => s.id === selectedSession);
  const quickCommands = [
    { label: 'npm test', cmd: 'npm test' },
    { label: 'npm run build', cmd: 'npm run build' },
    { label: 'npm run lint', cmd: 'npm run lint' },
    { label: 'git status', cmd: 'git status' },
    { label: 'ls -la', cmd: 'ls -la' },
    { label: 'pwd', cmd: 'pwd' },
  ];

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Terminal size={22} />
          <h1>Shell Executor</h1>
          <span className="devtools-badge">Iterative Debug</span>
        </div>
        <button onClick={fetchSessions} className="devtools-btn devtools-btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="devtools-shell-prompt">
        <div className="devtools-input-row">
          <input
            type="text"
            placeholder="Working directory (optional)"
            value={cwd}
            onChange={e => setCwd(e.target.value)}
            className="devtools-input"
            style={{ maxWidth: 300 }}
          />
          <label className="devtools-toggle-label">
            <input type="checkbox" checked={runAsync} onChange={e => setRunAsync(e.target.checked)} />
            Async
          </label>
        </div>

        <div className="devtools-terminal-input">
          <span className="devtools-terminal-prompt">$</span>
          <input
            type="text"
            placeholder="Enter command..."
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="devtools-terminal-command"
            autoFocus
          />
          <button onClick={() => executeCommand()} disabled={executing || !command.trim()} className="devtools-btn devtools-btn-primary">
            {executing ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            Run
          </button>
        </div>

        <div className="devtools-quick-commands">
          {quickCommands.map(qc => (
            <button key={qc.cmd} onClick={() => { setCommand(qc.cmd); executeCommand(qc.cmd); }} className="devtools-quick-cmd">
              <ChevronRight size={12} /> {qc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="devtools-section-header" style={{ marginTop: 16 }}>
        <Wand2 size={16} />
        <span>Auto-Fix Mode</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>Runs command, analyzes errors, re-runs until success</span>
      </div>
      <div className="devtools-input-row" style={{ marginTop: 4 }}>
        <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Max iterations:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={maxFixIterations}
          onChange={e => setMaxFixIterations(parseInt(e.target.value) || 3)}
          className="devtools-input"
          style={{ width: 60 }}
        />
        <button onClick={startAutoFix} disabled={autoFix || !command.trim()} className="devtools-btn devtools-btn-primary">
          {autoFix ? (
            <><Loader2 size={16} className="spin" /> Fix Iteration {fixIteration}/{maxFixIterations}</>
          ) : (
            <><RotateCcw size={16} /> Run &amp; Auto-Fix</>
          )}
        </button>
      </div>

      <div className="devtools-content-split" style={{ marginTop: 16 }}>
        <div className="devtools-panel" style={{ flex: '0 0 35%' }}>
          <div className="devtools-panel-header">Sessions ({sessions.length})</div>
          <div className="devtools-list">
            {sessions.map(session => {
              const cfg = STATUS_CONFIG[session.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={session.id}
                  className={`devtools-list-item devtools-list-item-clickable ${selectedSession === session.id ? 'devtools-list-item-active' : ''}`}
                  onClick={() => setSelectedSession(session.id)}
                >
                  <Icon
                    size={16}
                    style={{ color: cfg.color, flexShrink: 0 }}
                    className={session.status === 'running' ? 'spin' : ''}
                  />
                  <div className="devtools-list-item-content">
                    <div className="devtools-terminal-cmd-preview">{session.command}</div>
                    <div className="devtools-list-item-desc">
                      {cfg.label}
                      {session.exitCode !== null && ` · Exit ${session.exitCode}`}
                      {' · '}
                      {new Date(session.startedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  {session.status === 'running' && (
                    <button onClick={(e) => { e.stopPropagation(); killSession(session.id); }} className="devtools-btn-icon" title="Kill">
                      <StopCircle size={14} />
                    </button>
                  )}
                </div>
              );
            })}
            {sessions.length === 0 && (
              <div className="devtools-empty" style={{ padding: '20px' }}>
                <Terminal size={24} />
                <p style={{ fontSize: 13 }}>No sessions yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="devtools-panel devtools-terminal-output-panel">
          {selected ? (
            <>
              <div className="devtools-terminal-output-header">
                <span className="devtools-code-tag">{selected.command}</span>
                {selected.exitCode !== null && (
                  <span className={`devtools-badge-small ${selected.exitCode === 0 ? 'green' : 'red'}`}>
                    Exit {selected.exitCode}
                  </span>
                )}
                {selected.cwd && <span style={{ fontSize: 11, opacity: 0.5 }}>{selected.cwd}</span>}
              </div>
              <pre ref={outputRef} className="devtools-terminal-output">
                <code>{selected.output || '(no output)'}</code>
              </pre>
              {selected.status === 'failed' && (
                <div className="devtools-terminal-error-hint">
                  <AlertTriangle size={14} />
                  Command failed with exit code {selected.exitCode}. Use Auto-Fix mode to iterate.
                </div>
              )}
            </>
          ) : (
            <div className="devtools-empty">
              <Terminal size={32} />
              <p>Select a session to view output, or run a command</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
