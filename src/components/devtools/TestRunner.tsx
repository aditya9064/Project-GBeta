/* ═══════════════════════════════════════════════════════════
   Feature 3: Test Runner — Iterative test-driven loops with
   fix-until-green automation
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import {
  PlayCircle, CheckCircle, XCircle, Clock, Loader2,
  RefreshCw, SkipForward, FileCode2, Repeat, Pause,
  BarChart3, Zap, AlertCircle,
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  file?: string;
}

interface TestRunResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  output: string;
}

interface TestFramework {
  framework: string;
  command: string;
}

const STATUS_CONFIG = {
  passed: { icon: CheckCircle, color: '#10b981', label: 'Passed' },
  failed: { icon: XCircle, color: '#ef4444', label: 'Failed' },
  skipped: { icon: SkipForward, color: '#6b7280', label: 'Skipped' },
};

export function TestRunner() {
  const [rootPath, setRootPath] = useState('');
  const [testFile, setTestFile] = useState('');
  const [framework, setFramework] = useState<TestFramework | null>(null);
  const [runResult, setRunResult] = useState<TestRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [iterativeMode, setIterativeMode] = useState(false);
  const [iterationCount, setIterationCount] = useState(0);
  const [maxIterations, setMaxIterations] = useState(5);
  const [iterativeRunning, setIterativeRunning] = useState(false);
  const [iterativeHistory, setIterativeHistory] = useState<TestRunResult[]>([]);

  const detectFramework = useCallback(async () => {
    if (!rootPath.trim()) return;
    setDetecting(true);
    try {
      const res = await fetch('/api/devtools/tests/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (data.success) setFramework(data.data);
    } catch { /* */ }
    finally { setDetecting(false); }
  }, [rootPath]);

  const runTests = useCallback(async () => {
    if (!rootPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, testFile: testFile || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setRunResult(data.data);
        return data.data;
      }
    } catch { /* */ }
    finally { setLoading(false); }
    return null;
  }, [rootPath, testFile]);

  const startIterativeLoop = useCallback(async () => {
    setIterativeRunning(true);
    setIterativeHistory([]);
    setIterationCount(0);

    for (let i = 0; i < maxIterations; i++) {
      setIterationCount(i + 1);
      const result = await runTests();
      if (!result) break;

      setIterativeHistory(prev => [...prev, result]);

      if (result.failed === 0) {
        break;
      }

      // Small delay between iterations
      await new Promise(r => setTimeout(r, 1000));
    }

    setIterativeRunning(false);
  }, [maxIterations, runTests]);

  const passRate = runResult ? (runResult.total > 0 ? ((runResult.passed / runResult.total) * 100).toFixed(1) : '0') : null;

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <PlayCircle size={22} />
          <h1>Test Runner</h1>
          <span className="devtools-badge">Fix Until Green</span>
        </div>
      </div>

      <div className="devtools-input-row">
        <input
          type="text"
          placeholder="Project root path"
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="devtools-input"
        />
        <button onClick={detectFramework} disabled={detecting} className="devtools-btn devtools-btn-secondary">
          {detecting ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
          Detect Framework
        </button>
      </div>

      {framework && (
        <div className="devtools-info-banner">
          <CheckCircle size={16} style={{ color: '#10b981' }} />
          Detected: <strong>{framework.framework}</strong> — {framework.command}
        </div>
      )}

      <div className="devtools-input-row" style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Test file path (optional, runs all tests if empty)"
          value={testFile}
          onChange={e => setTestFile(e.target.value)}
          className="devtools-input"
        />
        <button onClick={runTests} disabled={loading || !rootPath.trim()} className="devtools-btn devtools-btn-primary">
          {loading ? <Loader2 size={16} className="spin" /> : <PlayCircle size={16} />}
          Run Tests
        </button>
      </div>

      <div className="devtools-section-header" style={{ marginTop: 16 }}>
        <Repeat size={16} />
        <span>Iterative Mode (Fix Until Green)</span>
        <label className="devtools-toggle">
          <input type="checkbox" checked={iterativeMode} onChange={e => setIterativeMode(e.target.checked)} />
          <span className="devtools-toggle-slider" />
        </label>
      </div>

      {iterativeMode && (
        <div className="devtools-iterative-panel">
          <div className="devtools-input-row">
            <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Max Iterations:</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxIterations}
              onChange={e => setMaxIterations(parseInt(e.target.value) || 5)}
              className="devtools-input"
              style={{ width: 80 }}
            />
            <button
              onClick={startIterativeLoop}
              disabled={iterativeRunning || !rootPath.trim()}
              className="devtools-btn devtools-btn-primary"
            >
              {iterativeRunning ? <Loader2 size={16} className="spin" /> : <Repeat size={16} />}
              {iterativeRunning ? `Iteration ${iterationCount}/${maxIterations}` : 'Start Loop'}
            </button>
          </div>

          {iterativeHistory.length > 0 && (
            <div className="devtools-iteration-timeline">
              {iterativeHistory.map((run, i) => (
                <div key={i} className={`devtools-iteration-dot ${run.failed === 0 ? 'green' : 'red'}`}>
                  <span>#{i + 1}</span>
                  <span>{run.passed}✓ {run.failed}✗</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {runResult && (
        <>
          <div className="devtools-stats-row" style={{ marginTop: 16 }}>
            <div className="devtools-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
              <CheckCircle size={18} style={{ color: '#10b981' }} />
              <div>
                <div className="devtools-stat-value">{runResult.passed}</div>
                <div className="devtools-stat-label">Passed</div>
              </div>
            </div>
            <div className="devtools-stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
              <XCircle size={18} style={{ color: '#ef4444' }} />
              <div>
                <div className="devtools-stat-value">{runResult.failed}</div>
                <div className="devtools-stat-label">Failed</div>
              </div>
            </div>
            <div className="devtools-stat-card" style={{ borderLeft: '3px solid #6b7280' }}>
              <SkipForward size={18} style={{ color: '#6b7280' }} />
              <div>
                <div className="devtools-stat-value">{runResult.skipped}</div>
                <div className="devtools-stat-label">Skipped</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <Clock size={18} />
              <div>
                <div className="devtools-stat-value">{(runResult.duration / 1000).toFixed(1)}s</div>
                <div className="devtools-stat-label">Duration</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <BarChart3 size={18} />
              <div>
                <div className="devtools-stat-value">{passRate}%</div>
                <div className="devtools-stat-label">Pass Rate</div>
              </div>
            </div>
          </div>

          <div className="devtools-list" style={{ marginTop: 16 }}>
            {runResult.results.map((t, i) => {
              const cfg = STATUS_CONFIG[t.status];
              const Icon = cfg.icon;
              return (
                <div key={i} className="devtools-list-item">
                  <Icon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
                  <div className="devtools-list-item-content">
                    <div className="devtools-list-item-title">{t.name}</div>
                    {t.file && <div className="devtools-list-item-desc">{t.file}</div>}
                    {t.error && <pre className="devtools-error-block">{t.error}</pre>}
                  </div>
                  {t.duration !== undefined && (
                    <span style={{ fontSize: 12, opacity: 0.5 }}>{t.duration}ms</span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="devtools-btn devtools-btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => setShowOutput(!showOutput)}
          >
            {showOutput ? 'Hide' : 'Show'} Raw Output
          </button>

          {showOutput && (
            <pre className="devtools-code-block" style={{ marginTop: 8 }}>
              <code>{runResult.output}</code>
            </pre>
          )}
        </>
      )}
    </div>
  );
}
