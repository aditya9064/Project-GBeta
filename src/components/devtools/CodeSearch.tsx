/* ═══════════════════════════════════════════════════════════
   Feature 9: Code Search at Scale — ripgrep-powered search
   with regex, glob filtering, and file finding
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef } from 'react';
import {
  Search, FileCode2, Loader2, Filter, Code2, File,
  RefreshCw, ChevronDown, ChevronRight, Copy, CheckCircle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';

interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  matchLength: number;
}

export function CodeSearch() {
  const [rootPath, setRootPath] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [fileGlob, setFileGlob] = useState('');
  const [maxResults, setMaxResults] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  const [filePattern, setFilePattern] = useState('');
  const [fileResults, setFileResults] = useState<string[]>([]);
  const [fileSearching, setFileSearching] = useState(false);

  const [activeTab, setActiveTab] = useState<'code' | 'files'>('code');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [groupByFile, setGroupByFile] = useState(true);

  const searchCode = useCallback(async () => {
    if (!rootPath.trim() || !query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/search/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPath,
          query,
          regex: useRegex,
          caseSensitive,
          fileGlob: fileGlob || undefined,
          maxResults,
        }),
      });
      const data = await res.json();
      if (data.success) setResults(data.data.results);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [rootPath, query, useRegex, caseSensitive, fileGlob, maxResults]);

  const searchFiles = useCallback(async () => {
    if (!rootPath.trim() || !filePattern.trim()) return;
    setFileSearching(true);
    try {
      const res = await fetch('/api/devtools/search/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, pattern: filePattern }),
      });
      const data = await res.json();
      if (data.success) setFileResults(data.data.files);
    } catch { /* */ }
    finally { setFileSearching(false); }
  }, [rootPath, filePattern]);

  const copyContent = useCallback((content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const groupedResults = groupByFile
    ? results.reduce<Record<string, SearchResult[]>>((acc, r) => {
        if (!acc[r.file]) acc[r.file] = [];
        acc[r.file].push(r);
        return acc;
      }, {})
    : null;

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Search size={22} />
          <h1>Code Search</h1>
          <span className="devtools-badge">At Scale</span>
        </div>
      </div>

      <div className="devtools-input-row">
        <input
          type="text"
          placeholder="Project root path"
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="devtools-input"
          style={{ maxWidth: 400 }}
        />
      </div>

      <div className="devtools-tabs" style={{ marginTop: 12 }}>
        <button className={`devtools-tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>
          <Code2 size={14} /> Search Code
        </button>
        <button className={`devtools-tab ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
          <File size={14} /> Find Files
        </button>
      </div>

      {activeTab === 'code' && (
        <>
          <div className="devtools-search-bar" style={{ marginTop: 12 }}>
            <div className="devtools-search-input-wrap">
              <Search size={16} className="devtools-search-icon" />
              <input
                ref={searchRef}
                type="text"
                placeholder={useRegex ? 'Regex pattern (e.g. function\\s+\\w+)' : 'Search text...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="devtools-search-input"
                onKeyDown={e => e.key === 'Enter' && searchCode()}
              />
            </div>
            <button
              onClick={() => setUseRegex(!useRegex)}
              className={`devtools-btn-icon devtools-toggle-icon ${useRegex ? 'active' : ''}`}
              title="Regular Expression"
            >
              .*
            </button>
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`devtools-btn-icon devtools-toggle-icon ${caseSensitive ? 'active' : ''}`}
              title="Case Sensitive"
            >
              Aa
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className="devtools-btn-icon" title="Filters">
              <Filter size={16} />
            </button>
            <button onClick={searchCode} disabled={loading || !query.trim()} className="devtools-btn devtools-btn-primary">
              {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              Search
            </button>
          </div>

          {showFilters && (
            <div className="devtools-filter-panel" style={{ marginTop: 8 }}>
              <div className="devtools-input-row">
                <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>File glob:</label>
                <input
                  type="text"
                  placeholder="e.g. *.tsx, *.py"
                  value={fileGlob}
                  onChange={e => setFileGlob(e.target.value)}
                  className="devtools-input"
                  style={{ maxWidth: 200 }}
                />
                <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Max results:</label>
                <input
                  type="number"
                  min={10}
                  max={500}
                  value={maxResults}
                  onChange={e => setMaxResults(parseInt(e.target.value) || 50)}
                  className="devtools-input"
                  style={{ width: 80 }}
                />
                <button
                  onClick={() => setGroupByFile(!groupByFile)}
                  className={`devtools-btn devtools-btn-secondary`}
                >
                  {groupByFile ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  Group by file
                </button>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="devtools-search-status" style={{ marginTop: 12 }}>
              <span>{results.length} results found</span>
              {Object.keys(groupedResults || {}).length > 0 && (
                <span> in {Object.keys(groupedResults!).length} files</span>
              )}
            </div>
          )}

          <div className="devtools-search-results" style={{ marginTop: 8 }}>
            {groupByFile && groupedResults ? (
              Object.entries(groupedResults).map(([file, fileResults]) => (
                <FileGroup key={file} file={file} results={fileResults} onCopy={copyContent} copiedIndex={copiedIndex} />
              ))
            ) : (
              results.map((r, i) => (
                <div key={i} className="devtools-search-result">
                  <div className="devtools-search-result-header">
                    <FileCode2 size={14} />
                    <span className="devtools-file-link">{r.file}:{r.line}:{r.column}</span>
                    <button onClick={() => copyContent(r.content, i)} className="devtools-btn-icon" title="Copy">
                      {copiedIndex === i ? <CheckCircle size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <pre className="devtools-search-result-code"><code>{r.content}</code></pre>
                </div>
              ))
            )}
            {!loading && results.length === 0 && query && (
              <div className="devtools-empty">
                <Search size={32} />
                <p>No results found for "{query}"</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'files' && (
        <>
          <div className="devtools-input-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="File name pattern (e.g. *.tsx, test_*)"
              value={filePattern}
              onChange={e => setFilePattern(e.target.value)}
              className="devtools-input"
              onKeyDown={e => e.key === 'Enter' && searchFiles()}
            />
            <button onClick={searchFiles} disabled={fileSearching || !filePattern.trim()} className="devtools-btn devtools-btn-primary">
              {fileSearching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              Find Files
            </button>
          </div>

          <div className="devtools-list" style={{ marginTop: 12 }}>
            {fileResults.map((f, i) => (
              <div key={i} className="devtools-list-item">
                <File size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span className="devtools-file-link">{f}</span>
              </div>
            ))}
            {!fileSearching && fileResults.length === 0 && filePattern && (
              <div className="devtools-empty">
                <File size={32} />
                <p>No files matching "{filePattern}"</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FileGroup({ file, results, onCopy, copiedIndex }: {
  file: string;
  results: SearchResult[];
  onCopy: (content: string, index: number) => void;
  copiedIndex: number | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="devtools-file-group">
      <button className="devtools-file-group-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FileCode2 size={14} />
        <span>{file}</span>
        <span className="devtools-badge-small">{results.length}</span>
      </button>
      {expanded && results.map((r, i) => (
        <div key={i} className="devtools-search-result" style={{ marginLeft: 20 }}>
          <div className="devtools-search-result-header">
            <span className="devtools-line-num">L{r.line}</span>
            <pre className="devtools-search-result-code" style={{ flex: 1 }}><code>{r.content}</code></pre>
          </div>
        </div>
      ))}
    </div>
  );
}
