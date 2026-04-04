/* ═══════════════════════════════════════════════════════════
   Feature 6: Persistent Project Context — OPERON.md /
   CLAUDE.md-style auto-injected context per project
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import {
  FileText, Save, Loader2, RefreshCw, Wand2, CheckCircle,
  Eye, Edit3, Download, BookOpen,
} from 'lucide-react';

export function ProjectContext() {
  const [projectPath, setProjectPath] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fileName, setFileName] = useState('OPERON.md');

  const loadContext = useCallback(async () => {
    if (!projectPath.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/context/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setContent(data.data.context);
        setSource(data.data.source);
        setEditing(false);
      } else {
        setContent('');
        setSource(null);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [projectPath]);

  const saveContext = useCallback(async () => {
    if (!projectPath.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/devtools/context/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, content, fileName }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setSource(fileName);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* */ }
    finally { setSaving(false); }
  }, [projectPath, content, fileName]);

  const generateContext = useCallback(async () => {
    if (!projectPath.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/devtools/context/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });
      const data = await res.json();
      if (data.success) {
        setContent(data.data.context);
        setEditing(true);
      }
    } catch { /* */ }
    finally { setGenerating(false); }
  }, [projectPath]);

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <BookOpen size={22} />
          <h1>Project Context</h1>
          <span className="devtools-badge">Persistent Instructions</span>
        </div>
      </div>

      <div className="devtools-info-banner" style={{ marginBottom: 16 }}>
        <BookOpen size={16} style={{ color: '#60a5fa' }} />
        Project context files (like OPERON.md or CLAUDE.md) are automatically injected into every agent interaction,
        ensuring consistent behavior across sessions.
      </div>

      <div className="devtools-input-row">
        <input
          type="text"
          placeholder="Project root path (e.g. /Users/you/my-project)"
          value={projectPath}
          onChange={e => setProjectPath(e.target.value)}
          className="devtools-input"
          onKeyDown={e => e.key === 'Enter' && loadContext()}
        />
        <button onClick={loadContext} disabled={loading || !projectPath.trim()} className="devtools-btn devtools-btn-primary">
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          Load
        </button>
        <button onClick={generateContext} disabled={generating || !projectPath.trim()} className="devtools-btn devtools-btn-secondary">
          {generating ? <Loader2 size={16} className="spin" /> : <Wand2 size={16} />}
          Auto-Generate
        </button>
      </div>

      {source && (
        <div className="devtools-info-banner" style={{ marginTop: 12 }}>
          <CheckCircle size={16} style={{ color: '#10b981' }} />
          Loaded from: <strong>{source}</strong>
        </div>
      )}

      <div className="devtools-input-row" style={{ marginTop: 12 }}>
        <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Save as:</label>
        <select value={fileName} onChange={e => setFileName(e.target.value)} className="devtools-select">
          <option value="OPERON.md">OPERON.md</option>
          <option value="CLAUDE.md">CLAUDE.md</option>
          <option value=".ai/context.md">.ai/context.md</option>
        </select>
        {!editing && content && (
          <button onClick={() => setEditing(true)} className="devtools-btn devtools-btn-secondary">
            <Edit3 size={16} /> Edit
          </button>
        )}
        {editing && (
          <button onClick={() => setEditing(false)} className="devtools-btn devtools-btn-secondary">
            <Eye size={16} /> Preview
          </button>
        )}
      </div>

      <div className="devtools-context-editor" style={{ marginTop: 16 }}>
        {editing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="devtools-textarea devtools-context-textarea"
            placeholder={`# Project Context

## Overview
Describe what this project does.

## Conventions
- Code style guidelines
- Architecture patterns
- Naming conventions

## Key Information
- Entry points
- Important directories
- Testing approach`}
            rows={20}
          />
        ) : (
          <div className="devtools-context-preview">
            {content ? (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{content}</pre>
            ) : (
              <div className="devtools-empty">
                <FileText size={32} />
                <p>No project context found. Click "Auto-Generate" to create one from your codebase, or write your own.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {content && (
        <div className="devtools-input-row" style={{ marginTop: 12 }}>
          <button onClick={saveContext} disabled={saving || !content.trim()} className="devtools-btn devtools-btn-primary">
            {saving ? <Loader2 size={16} className="spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'Saved!' : 'Save Context'}
          </button>
        </div>
      )}
    </div>
  );
}
