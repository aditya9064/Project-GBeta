/* ═══════════════════════════════════════════════════════════
   Feature 1: Codebase Explorer — Deep codebase understanding
   with file tree, language stats, architecture analysis, and
   AI-powered explanations.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import {
  FolderTree, FileCode2, BarChart3, Brain, Loader2, ChevronRight,
  ChevronDown, File, Folder, RefreshCw, Eye, Search, ArrowRight,
  Code2, Layers, GitBranch,
} from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  language?: string;
  children?: FileNode[];
}

interface CodebaseAnalysis {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  totalLines: number;
  languages: Record<string, { files: number; lines: number }>;
  tree: FileNode[];
  summary: string;
  entryPoints: string[];
  dependencies: Record<string, string>;
}

function TreeNode({ node, depth, onSelect }: { node: FileNode; depth: number; onSelect: (path: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'directory';

  return (
    <div>
      <button
        className="devtools-tree-item"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => isDir ? setExpanded(!expanded) : onSelect(node.path)}
      >
        {isDir ? (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : <span style={{ width: 14 }} />}
        {isDir ? <Folder size={14} style={{ color: 'var(--accent-blue, #60a5fa)', marginLeft: 4 }} />
               : <File size={14} style={{ color: 'var(--text-secondary, #94a3b8)', marginLeft: 4 }} />}
        <span style={{ marginLeft: 6, fontSize: '13px' }}>{node.name}</span>
        {node.language && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>{node.language}</span>
        )}
        {node.size !== undefined && (
          <span style={{ marginLeft: 8, fontSize: '11px', opacity: 0.4 }}>
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}KB` : `${node.size}B`}
          </span>
        )}
      </button>
      {isDir && expanded && node.children?.map((child, i) => (
        <TreeNode key={`${child.path}-${i}`} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function CodebaseExplorer() {
  const [rootPath, setRootPath] = useState('');
  const [analysis, setAnalysis] = useState<CodebaseAnalysis | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tree' | 'languages' | 'deps' | 'architecture'>('tree');

  const analyze = useCallback(async () => {
    if (!rootPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/codebase/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (data.success) setAnalysis(data.data);
    } catch (err) { console.error('Analysis failed:', err); }
    finally { setLoading(false); }
  }, [rootPath]);

  const explain = useCallback(async () => {
    if (!rootPath.trim()) return;
    setExplaining(true);
    try {
      const res = await fetch('/api/devtools/codebase/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (data.success) setExplanation(data.data.explanation);
    } catch (err) { console.error('Explain failed:', err); }
    finally { setExplaining(false); }
  }, [rootPath]);

  const readFile = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const res = await fetch('/api/devtools/codebase/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const data = await res.json();
      if (data.success) setFileContent(data.data.content);
    } catch { setFileContent('Error reading file'); }
  }, []);

  const sortedLanguages = analysis
    ? Object.entries(analysis.languages).sort((a, b) => b[1].lines - a[1].lines)
    : [];

  const maxLines = sortedLanguages.length > 0 ? sortedLanguages[0][1].lines : 1;

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <FolderTree size={22} />
          <h1>Codebase Explorer</h1>
          <span className="devtools-badge">Deep Understanding</span>
        </div>
      </div>

      <div className="devtools-input-row">
        <input
          type="text"
          placeholder="Enter project root path (e.g. /Users/you/project)"
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="devtools-input"
          onKeyDown={e => e.key === 'Enter' && analyze()}
        />
        <button onClick={analyze} disabled={loading || !rootPath.trim()} className="devtools-btn devtools-btn-primary">
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          Analyze
        </button>
        <button onClick={explain} disabled={explaining || !rootPath.trim()} className="devtools-btn devtools-btn-secondary">
          {explaining ? <Loader2 size={16} className="spin" /> : <Brain size={16} />}
          AI Explain
        </button>
      </div>

      {analysis && (
        <>
          <div className="devtools-stats-row">
            <div className="devtools-stat-card">
              <FileCode2 size={18} />
              <div>
                <div className="devtools-stat-value">{analysis.totalFiles.toLocaleString()}</div>
                <div className="devtools-stat-label">Files</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <Folder size={18} />
              <div>
                <div className="devtools-stat-value">{analysis.totalDirectories.toLocaleString()}</div>
                <div className="devtools-stat-label">Directories</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <Code2 size={18} />
              <div>
                <div className="devtools-stat-value">{analysis.totalLines.toLocaleString()}</div>
                <div className="devtools-stat-label">Lines of Code</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <Layers size={18} />
              <div>
                <div className="devtools-stat-value">{Object.keys(analysis.languages).length}</div>
                <div className="devtools-stat-label">Languages</div>
              </div>
            </div>
            <div className="devtools-stat-card">
              <GitBranch size={18} />
              <div>
                <div className="devtools-stat-value">{analysis.entryPoints.length}</div>
                <div className="devtools-stat-label">Entry Points</div>
              </div>
            </div>
          </div>

          {explanation && (
            <div className="devtools-ai-box">
              <div className="devtools-ai-box-header">
                <Brain size={16} /> AI Architecture Analysis
              </div>
              <div className="devtools-ai-box-content">{explanation}</div>
            </div>
          )}

          <div className="devtools-tabs">
            <button className={`devtools-tab ${activeTab === 'tree' ? 'active' : ''}`} onClick={() => setActiveTab('tree')}>
              <FolderTree size={14} /> File Tree
            </button>
            <button className={`devtools-tab ${activeTab === 'languages' ? 'active' : ''}`} onClick={() => setActiveTab('languages')}>
              <BarChart3 size={14} /> Languages
            </button>
            <button className={`devtools-tab ${activeTab === 'deps' ? 'active' : ''}`} onClick={() => setActiveTab('deps')}>
              <Layers size={14} /> Dependencies
            </button>
          </div>

          <div className="devtools-content-split">
            <div className="devtools-panel" style={{ flex: selectedFile ? '0 0 50%' : '1' }}>
              {activeTab === 'tree' && (
                <div className="devtools-tree">
                  {analysis.tree.map((node, i) => (
                    <TreeNode key={`${node.path}-${i}`} node={node} depth={0} onSelect={readFile} />
                  ))}
                </div>
              )}

              {activeTab === 'languages' && (
                <div className="devtools-lang-list">
                  {sortedLanguages.map(([lang, stats]) => (
                    <div key={lang} className="devtools-lang-item">
                      <div className="devtools-lang-name">{lang}</div>
                      <div className="devtools-lang-bar-wrap">
                        <div
                          className="devtools-lang-bar"
                          style={{ width: `${(stats.lines / maxLines) * 100}%` }}
                        />
                      </div>
                      <div className="devtools-lang-stats">
                        {stats.files} files · {stats.lines.toLocaleString()} lines
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'deps' && (
                <div className="devtools-deps-list">
                  {Object.entries(analysis.dependencies).map(([name, version]) => (
                    <div key={name} className="devtools-dep-item">
                      <span className="devtools-dep-name">{name}</span>
                      <span className="devtools-dep-version">{version}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="devtools-panel devtools-file-preview">
                <div className="devtools-file-preview-header">
                  <FileCode2 size={14} />
                  <span>{selectedFile.split('/').pop()}</span>
                  <button onClick={() => { setSelectedFile(null); setFileContent(null); }} className="devtools-btn-icon">×</button>
                </div>
                <pre className="devtools-code-block">
                  <code>{fileContent || 'Loading...'}</code>
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
