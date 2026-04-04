/* ═══════════════════════════════════════════════════════════
   Feature 2: Code Intelligence — LSP-like diagnostics,
   go-to-definition, find references, type checking
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, Info, Loader2, Search,
  FileCode2, ArrowRight, XCircle, CheckCircle, Zap,
  Eye, Target, RefreshCw,
} from 'lucide-react';

interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string;
}

interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
}

const SEVERITY_CONFIG = {
  error: { icon: XCircle, color: '#ef4444', label: 'Error' },
  warning: { icon: AlertTriangle, color: '#f59e0b', label: 'Warning' },
  info: { icon: Info, color: '#60a5fa', label: 'Info' },
  hint: { icon: Eye, color: '#a78bfa', label: 'Hint' },
};

export function CodeIntelligence() {
  const [rootPath, setRootPath] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [definitionResults, setDefinitionResults] = useState<SearchResult[]>([]);
  const [referenceResults, setReferenceResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeView, setActiveView] = useState<'diagnostics' | 'definition' | 'references'>('diagnostics');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const runDiagnostics = useCallback(async () => {
    if (!rootPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/intelligence/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (data.success) setDiagnostics(data.data.diagnostics);
    } catch (err) { console.error('Diagnostics failed:', err); }
    finally { setLoading(false); }
  }, [rootPath]);

  const findDef = useCallback(async () => {
    if (!rootPath.trim() || !symbol.trim()) return;
    setSearchLoading(true);
    setActiveView('definition');
    try {
      const res = await fetch('/api/devtools/intelligence/definition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, symbol }),
      });
      const data = await res.json();
      if (data.success) setDefinitionResults(data.data.results);
    } catch { /* */ }
    finally { setSearchLoading(false); }
  }, [rootPath, symbol]);

  const findRefs = useCallback(async () => {
    if (!rootPath.trim() || !symbol.trim()) return;
    setSearchLoading(true);
    setActiveView('references');
    try {
      const res = await fetch('/api/devtools/intelligence/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, symbol }),
      });
      const data = await res.json();
      if (data.success) setReferenceResults(data.data.results);
    } catch { /* */ }
    finally { setSearchLoading(false); }
  }, [rootPath, symbol]);

  const filteredDiagnostics = filterSeverity === 'all'
    ? diagnostics
    : diagnostics.filter(d => d.severity === filterSeverity);

  const errorCount = diagnostics.filter(d => d.severity === 'error').length;
  const warnCount = diagnostics.filter(d => d.severity === 'warning').length;

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Zap size={22} />
          <h1>Code Intelligence</h1>
          <span className="devtools-badge">LSP</span>
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
        <button onClick={runDiagnostics} disabled={loading || !rootPath.trim()} className="devtools-btn devtools-btn-primary">
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          Run Diagnostics
        </button>
      </div>

      <div className="devtools-input-row" style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Symbol to look up (e.g. useState, MyComponent)"
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="devtools-input"
          onKeyDown={e => e.key === 'Enter' && findDef()}
        />
        <button onClick={findDef} disabled={searchLoading || !symbol.trim()} className="devtools-btn devtools-btn-secondary">
          <Target size={16} /> Go to Definition
        </button>
        <button onClick={findRefs} disabled={searchLoading || !symbol.trim()} className="devtools-btn devtools-btn-secondary">
          <Search size={16} /> Find References
        </button>
      </div>

      {diagnostics.length > 0 && (
        <div className="devtools-stats-row" style={{ marginTop: 16 }}>
          <div className="devtools-stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
            <XCircle size={18} style={{ color: '#ef4444' }} />
            <div>
              <div className="devtools-stat-value">{errorCount}</div>
              <div className="devtools-stat-label">Errors</div>
            </div>
          </div>
          <div className="devtools-stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
            <div>
              <div className="devtools-stat-value">{warnCount}</div>
              <div className="devtools-stat-label">Warnings</div>
            </div>
          </div>
          <div className="devtools-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
            <CheckCircle size={18} style={{ color: '#10b981' }} />
            <div>
              <div className="devtools-stat-value">{diagnostics.length === 0 ? '✓' : diagnostics.length}</div>
              <div className="devtools-stat-label">Total Issues</div>
            </div>
          </div>
        </div>
      )}

      <div className="devtools-tabs" style={{ marginTop: 16 }}>
        <button className={`devtools-tab ${activeView === 'diagnostics' ? 'active' : ''}`} onClick={() => setActiveView('diagnostics')}>
          <AlertCircle size={14} /> Diagnostics ({diagnostics.length})
        </button>
        <button className={`devtools-tab ${activeView === 'definition' ? 'active' : ''}`} onClick={() => setActiveView('definition')}>
          <Target size={14} /> Definitions ({definitionResults.length})
        </button>
        <button className={`devtools-tab ${activeView === 'references' ? 'active' : ''}`} onClick={() => setActiveView('references')}>
          <Search size={14} /> References ({referenceResults.length})
        </button>
      </div>

      {activeView === 'diagnostics' && (
        <>
          <div className="devtools-filter-row">
            {['all', 'error', 'warning', 'info'].map(sev => (
              <button
                key={sev}
                className={`devtools-filter-btn ${filterSeverity === sev ? 'active' : ''}`}
                onClick={() => setFilterSeverity(sev)}
              >
                {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
          <div className="devtools-list">
            {filteredDiagnostics.map((d, i) => {
              const cfg = SEVERITY_CONFIG[d.severity];
              const Icon = cfg.icon;
              return (
                <div key={i} className="devtools-list-item">
                  <Icon size={16} style={{ color: cfg.color, flexShrink: 0 }} />
                  <div className="devtools-list-item-content">
                    <div className="devtools-list-item-title">
                      <span className="devtools-file-link">{d.file}:{d.line}:{d.column}</span>
                      {d.code && <span className="devtools-code-tag">{d.code}</span>}
                    </div>
                    <div className="devtools-list-item-desc">{d.message}</div>
                  </div>
                  {d.source && <span className="devtools-source-tag">{d.source}</span>}
                </div>
              );
            })}
            {filteredDiagnostics.length === 0 && !loading && (
              <div className="devtools-empty">
                <CheckCircle size={32} style={{ color: '#10b981' }} />
                <p>No issues found. Your code looks clean!</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeView === 'definition' && (
        <div className="devtools-list">
          {searchLoading && <div className="devtools-loading"><Loader2 size={20} className="spin" /> Searching...</div>}
          {definitionResults.map((r, i) => (
            <div key={i} className="devtools-list-item">
              <FileCode2 size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <div className="devtools-list-item-content">
                <div className="devtools-file-link">{r.file}:{r.line}</div>
                <pre className="devtools-inline-code">{r.content}</pre>
              </div>
            </div>
          ))}
          {!searchLoading && definitionResults.length === 0 && (
            <div className="devtools-empty"><p>Enter a symbol and click "Go to Definition"</p></div>
          )}
        </div>
      )}

      {activeView === 'references' && (
        <div className="devtools-list">
          {searchLoading && <div className="devtools-loading"><Loader2 size={20} className="spin" /> Searching...</div>}
          {referenceResults.map((r, i) => (
            <div key={i} className="devtools-list-item">
              <ArrowRight size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <div className="devtools-list-item-content">
                <div className="devtools-file-link">{r.file}:{r.line}</div>
                <pre className="devtools-inline-code">{r.content}</pre>
              </div>
            </div>
          ))}
          {!searchLoading && referenceResults.length === 0 && (
            <div className="devtools-empty"><p>Enter a symbol and click "Find References"</p></div>
          )}
        </div>
      )}
    </div>
  );
}
