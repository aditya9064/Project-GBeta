/* ═══════════════════════════════════════════════════════════
   Feature 4: Git Workflow Automation — commits, branches,
   diffs, stash, conflict resolution
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect } from 'react';
import {
  GitBranch, GitCommitHorizontal, GitMerge, Loader2,
  RefreshCw, Plus, Trash2, Eye, FileText, CheckCircle,
  XCircle, AlertTriangle, Archive, ArrowUpDown,
} from 'lucide-react';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicts: string[];
  clean: boolean;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export function GitWorkflow() {
  const [rootPath, setRootPath] = useState('');
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [diff, setDiff] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'log' | 'diff' | 'branches'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [newBranch, setNewBranch] = useState('');
  const [showStaged, setShowStaged] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!rootPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath }),
      });
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [rootPath]);

  const fetchLog = useCallback(async () => {
    if (!rootPath.trim()) return;
    try {
      const res = await fetch('/api/devtools/git/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, count: 30 }),
      });
      const data = await res.json();
      if (data.success) setCommits(data.data);
    } catch { /* */ }
  }, [rootPath]);

  const fetchDiff = useCallback(async (staged = false) => {
    if (!rootPath.trim()) return;
    setShowStaged(staged);
    try {
      const res = await fetch('/api/devtools/git/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, staged }),
      });
      const data = await res.json();
      if (data.success) setDiff(data.data.diff);
    } catch { /* */ }
  }, [rootPath]);

  const fetchBranches = useCallback(async () => {
    if (!rootPath.trim()) return;
    try {
      const res = await fetch('/api/devtools/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, action: 'list' }),
      });
      const data = await res.json();
      if (data.success) setBranches(data.data);
    } catch { /* */ }
  }, [rootPath]);

  const doCommit = useCallback(async () => {
    if (!rootPath.trim() || !commitMessage.trim()) return;
    setCommitting(true);
    try {
      const res = await fetch('/api/devtools/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, message: commitMessage }),
      });
      const data = await res.json();
      if (data.success && data.data.success) {
        setCommitMessage('');
        fetchStatus();
        fetchLog();
      }
    } catch { /* */ }
    finally { setCommitting(false); }
  }, [rootPath, commitMessage, fetchStatus, fetchLog]);

  const createBranch = useCallback(async () => {
    if (!rootPath.trim() || !newBranch.trim()) return;
    try {
      await fetch('/api/devtools/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, action: 'create', branchName: newBranch }),
      });
      setNewBranch('');
      fetchBranches();
      fetchStatus();
    } catch { /* */ }
  }, [rootPath, newBranch, fetchBranches, fetchStatus]);

  const switchBranch = useCallback(async (branch: string) => {
    if (!rootPath.trim()) return;
    const cleanBranch = branch.replace(/^\*?\s*/, '').replace(/^remotes\/origin\//, '').trim();
    try {
      await fetch('/api/devtools/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, action: 'switch', branchName: cleanBranch }),
      });
      fetchStatus();
      fetchLog();
    } catch { /* */ }
  }, [rootPath, fetchStatus, fetchLog]);

  const doStash = useCallback(async (action: 'push' | 'pop' | 'list') => {
    if (!rootPath.trim()) return;
    try {
      await fetch('/api/devtools/git/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath, action }),
      });
      fetchStatus();
    } catch { /* */ }
  }, [rootPath, fetchStatus]);

  useEffect(() => {
    if (rootPath.trim() && activeTab === 'log') fetchLog();
    if (rootPath.trim() && activeTab === 'diff') fetchDiff();
    if (rootPath.trim() && activeTab === 'branches') fetchBranches();
  }, [activeTab, rootPath]);

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <GitBranch size={22} />
          <h1>Git Workflow</h1>
          <span className="devtools-badge">Automation</span>
        </div>
      </div>

      <div className="devtools-input-row">
        <input
          type="text"
          placeholder="Git repository root path"
          value={rootPath}
          onChange={e => setRootPath(e.target.value)}
          className="devtools-input"
          onKeyDown={e => e.key === 'Enter' && fetchStatus()}
        />
        <button onClick={fetchStatus} disabled={loading || !rootPath.trim()} className="devtools-btn devtools-btn-primary">
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {status && (
        <div className="devtools-git-status-bar">
          <span className="devtools-git-branch-badge">
            <GitBranch size={14} /> {status.branch}
          </span>
          {status.ahead > 0 && <span className="devtools-badge-green">↑ {status.ahead} ahead</span>}
          {status.behind > 0 && <span className="devtools-badge-yellow">↓ {status.behind} behind</span>}
          {status.clean && <span className="devtools-badge-green"><CheckCircle size={12} /> Clean</span>}
          {status.conflicts.length > 0 && <span className="devtools-badge-red"><AlertTriangle size={12} /> {status.conflicts.length} conflicts</span>}
        </div>
      )}

      <div className="devtools-tabs">
        <button className={`devtools-tab ${activeTab === 'status' ? 'active' : ''}`} onClick={() => setActiveTab('status')}>
          <FileText size={14} /> Working Tree
        </button>
        <button className={`devtools-tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          <GitCommitHorizontal size={14} /> Commit Log
        </button>
        <button className={`devtools-tab ${activeTab === 'diff' ? 'active' : ''}`} onClick={() => setActiveTab('diff')}>
          <Eye size={14} /> Diff
        </button>
        <button className={`devtools-tab ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>
          <GitBranch size={14} /> Branches
        </button>
      </div>

      {activeTab === 'status' && status && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {status.staged.length > 0 && (
            <div className="devtools-file-group">
              <div className="devtools-file-group-header"><CheckCircle size={14} style={{ color: '#10b981' }} /> Staged ({status.staged.length})</div>
              {status.staged.map(f => <div key={f} className="devtools-file-item staged">{f}</div>)}
            </div>
          )}
          {status.modified.length > 0 && (
            <div className="devtools-file-group">
              <div className="devtools-file-group-header"><AlertTriangle size={14} style={{ color: '#f59e0b' }} /> Modified ({status.modified.length})</div>
              {status.modified.map(f => <div key={f} className="devtools-file-item modified">{f}</div>)}
            </div>
          )}
          {status.untracked.length > 0 && (
            <div className="devtools-file-group">
              <div className="devtools-file-group-header"><Plus size={14} style={{ color: '#60a5fa' }} /> Untracked ({status.untracked.length})</div>
              {status.untracked.map(f => <div key={f} className="devtools-file-item untracked">{f}</div>)}
            </div>
          )}
          {status.conflicts.length > 0 && (
            <div className="devtools-file-group">
              <div className="devtools-file-group-header"><XCircle size={14} style={{ color: '#ef4444' }} /> Conflicts ({status.conflicts.length})</div>
              {status.conflicts.map(f => <div key={f} className="devtools-file-item conflict">{f}</div>)}
            </div>
          )}

          <div className="devtools-commit-box">
            <textarea
              placeholder="Commit message..."
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              className="devtools-textarea"
              rows={3}
            />
            <div className="devtools-commit-actions">
              <button onClick={doCommit} disabled={committing || !commitMessage.trim()} className="devtools-btn devtools-btn-primary">
                {committing ? <Loader2 size={16} className="spin" /> : <GitCommitHorizontal size={16} />}
                Commit All
              </button>
              <button onClick={() => doStash('push')} className="devtools-btn devtools-btn-secondary">
                <Archive size={16} /> Stash
              </button>
              <button onClick={() => doStash('pop')} className="devtools-btn devtools-btn-secondary">
                <ArrowUpDown size={16} /> Pop Stash
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'log' && (
        <div className="devtools-list" style={{ marginTop: 12 }}>
          {commits.map(c => (
            <div key={c.hash} className="devtools-list-item">
              <GitCommitHorizontal size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <div className="devtools-list-item-content">
                <div className="devtools-list-item-title">
                  <span className="devtools-code-tag">{c.shortHash}</span>
                  {c.message}
                </div>
                <div className="devtools-list-item-desc">{c.author} · {c.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'diff' && (
        <div style={{ marginTop: 12 }}>
          <div className="devtools-input-row">
            <button onClick={() => fetchDiff(false)} className={`devtools-btn ${!showStaged ? 'devtools-btn-primary' : 'devtools-btn-secondary'}`}>
              Unstaged Changes
            </button>
            <button onClick={() => fetchDiff(true)} className={`devtools-btn ${showStaged ? 'devtools-btn-primary' : 'devtools-btn-secondary'}`}>
              Staged Changes
            </button>
          </div>
          <pre className="devtools-diff-block">
            <code>{diff || 'No changes'}</code>
          </pre>
        </div>
      )}

      {activeTab === 'branches' && (
        <div style={{ marginTop: 12 }}>
          <div className="devtools-input-row">
            <input
              type="text"
              placeholder="New branch name"
              value={newBranch}
              onChange={e => setNewBranch(e.target.value)}
              className="devtools-input"
            />
            <button onClick={createBranch} disabled={!newBranch.trim()} className="devtools-btn devtools-btn-primary">
              <Plus size={16} /> Create Branch
            </button>
          </div>
          <div className="devtools-list" style={{ marginTop: 12 }}>
            {branches.map(b => {
              const isCurrent = b.startsWith('*');
              const name = b.replace(/^\*?\s*/, '').trim();
              return (
                <div key={b} className={`devtools-list-item ${isCurrent ? 'devtools-list-item-active' : ''}`}>
                  <GitBranch size={16} style={{ color: isCurrent ? '#10b981' : '#6b7280', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontWeight: isCurrent ? 600 : 400 }}>{name}</span>
                  {!isCurrent && !name.startsWith('remotes/') && (
                    <button onClick={() => switchBranch(name)} className="devtools-btn-icon" title="Switch">
                      <ArrowUpDown size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
