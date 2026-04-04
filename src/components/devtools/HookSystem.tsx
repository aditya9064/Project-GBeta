/* ═══════════════════════════════════════════════════════════
   Feature 7: Hook System — deterministic event-triggered
   scripts for CI/CD, notifications, validations
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect } from 'react';
import {
  Webhook, Plus, Loader2, Trash2, Play, Pause, Edit3,
  CheckCircle, XCircle, Clock, Zap, Settings, Save,
  Code2, RefreshCw, Filter,
} from 'lucide-react';

interface HookDefinition {
  id: string;
  name: string;
  event: string;
  script: string;
  enabled: boolean;
  matcher?: string;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

const EVENTS = [
  { value: 'pre_tool_use', label: 'Pre Tool Use', desc: 'Before any tool executes' },
  { value: 'post_tool_use', label: 'Post Tool Use', desc: 'After any tool executes' },
  { value: 'pre_execution', label: 'Pre Execution', desc: 'Before an agent run starts' },
  { value: 'post_execution', label: 'Post Execution', desc: 'After an agent run completes' },
  { value: 'on_error', label: 'On Error', desc: 'When an error occurs' },
  { value: 'on_approval', label: 'On Approval', desc: 'When approval is requested' },
  { value: 'on_schedule', label: 'On Schedule', desc: 'On a scheduled trigger' },
];

const TEMPLATES = [
  {
    name: 'Log Tool Usage',
    event: 'post_tool_use',
    script: `console.log('Tool used:', context.toolName);
return { logged: true };`,
    matcher: '*',
  },
  {
    name: 'Block Dangerous Emails',
    event: 'pre_tool_use',
    script: `if (context.toolArgs?.to?.includes('all@company.com')) {
  return { blocked: true, reason: 'Cannot send to all@company' };
}
return { allowed: true };`,
    matcher: 'gmail_send',
  },
  {
    name: 'Notify on Completion',
    event: 'post_execution',
    script: `return { notify: true, message: 'Agent completed: ' + context.goal };`,
  },
  {
    name: 'Validate Before Commit',
    event: 'pre_tool_use',
    script: `if (context.toolName === 'git_commit') {
  const msg = context.toolArgs?.message || '';
  if (msg.length < 10) return { blocked: true, reason: 'Commit message too short' };
}
return { allowed: true };`,
    matcher: 'git_*',
  },
];

export function HookSystem() {
  const [hooks, setHooks] = useState<HookDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingHook, setEditingHook] = useState<HookDefinition | null>(null);

  const [newName, setNewName] = useState('');
  const [newEvent, setNewEvent] = useState('post_tool_use');
  const [newScript, setNewScript] = useState('');
  const [newMatcher, setNewMatcher] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>('all');

  const fetchHooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devtools/hooks');
      const data = await res.json();
      if (data.success) setHooks(data.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHooks(); }, [fetchHooks]);

  const createHook = useCallback(async () => {
    if (!newName.trim() || !newScript.trim()) return;
    try {
      const res = await fetch('/api/devtools/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          event: newEvent,
          script: newScript,
          matcher: newMatcher || undefined,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setHooks(prev => [...prev, data.data]);
        setShowCreate(false);
        setNewName(''); setNewScript(''); setNewMatcher('');
      }
    } catch { /* */ }
  }, [newName, newEvent, newScript, newMatcher]);

  const toggleHook = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/devtools/hooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setHooks(prev => prev.map(h => h.id === id ? { ...h, enabled } : h));
    } catch { /* */ }
  }, []);

  const deleteHook = useCallback(async (id: string) => {
    try {
      await fetch(`/api/devtools/hooks/${id}`, { method: 'DELETE' });
      setHooks(prev => prev.filter(h => h.id !== id));
    } catch { /* */ }
  }, []);

  const testHook = useCallback(async (id: string) => {
    const hook = hooks.find(h => h.id === id);
    if (!hook) return;
    try {
      const res = await fetch('/api/devtools/hooks/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: hook.event, context: { toolName: 'test', toolArgs: {} } }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Hook triggered! Results: ${JSON.stringify(data.data, null, 2)}`);
        fetchHooks();
      }
    } catch { /* */ }
  }, [hooks, fetchHooks]);

  const applyTemplate = useCallback((template: typeof TEMPLATES[0]) => {
    setNewName(template.name);
    setNewEvent(template.event);
    setNewScript(template.script);
    setNewMatcher(template.matcher || '');
    setShowCreate(true);
  }, []);

  const filtered = filterEvent === 'all' ? hooks : hooks.filter(h => h.event === filterEvent);

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Webhook size={22} />
          <h1>Hook System</h1>
          <span className="devtools-badge">Event-Driven</span>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="devtools-btn devtools-btn-primary">
          <Plus size={16} /> Create Hook
        </button>
      </div>

      <div className="devtools-info-banner">
        <Zap size={16} style={{ color: '#f59e0b' }} />
        Hooks are deterministic scripts triggered on events (pre/post tool use, execution start/end, errors, etc.).
        They enable CI/CD integration, validation, and custom automation.
      </div>

      {!showCreate && (
        <div className="devtools-section-header" style={{ marginTop: 16 }}>
          <span>Quick Templates</span>
        </div>
      )}
      {!showCreate && (
        <div className="devtools-template-grid">
          {TEMPLATES.map((t, i) => (
            <button key={i} className="devtools-template-card" onClick={() => applyTemplate(t)}>
              <div className="devtools-template-name">{t.name}</div>
              <div className="devtools-template-event">{t.event}</div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="devtools-create-panel" style={{ marginTop: 16 }}>
          <div className="devtools-create-header">
            <h3>{editingHook ? 'Edit Hook' : 'Create Hook'}</h3>
            <button onClick={() => setShowCreate(false)} className="devtools-btn-icon">×</button>
          </div>
          <div className="devtools-form">
            <div className="devtools-form-row">
              <label>Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="devtools-input" placeholder="My hook" />
            </div>
            <div className="devtools-form-row">
              <label>Event</label>
              <select value={newEvent} onChange={e => setNewEvent(e.target.value)} className="devtools-select">
                {EVENTS.map(ev => (
                  <option key={ev.value} value={ev.value}>{ev.label} — {ev.desc}</option>
                ))}
              </select>
            </div>
            <div className="devtools-form-row">
              <label>Matcher (optional, e.g. gmail_* or * for all)</label>
              <input type="text" value={newMatcher} onChange={e => setNewMatcher(e.target.value)} className="devtools-input" placeholder="*" />
            </div>
            <div className="devtools-form-row">
              <label>Script (JavaScript, receives `context` object)</label>
              <textarea
                value={newScript}
                onChange={e => setNewScript(e.target.value)}
                className="devtools-textarea devtools-code-textarea"
                rows={8}
                placeholder={`// context.toolName, context.toolArgs, context.goal, etc.
return { allowed: true };`}
              />
            </div>
            <button onClick={createHook} disabled={!newName.trim() || !newScript.trim()} className="devtools-btn devtools-btn-primary">
              <Save size={16} /> {editingHook ? 'Update' : 'Create'} Hook
            </button>
          </div>
        </div>
      )}

      <div className="devtools-filter-row" style={{ marginTop: 16 }}>
        <button className={`devtools-filter-btn ${filterEvent === 'all' ? 'active' : ''}`} onClick={() => setFilterEvent('all')}>All</button>
        {EVENTS.map(ev => (
          <button key={ev.value} className={`devtools-filter-btn ${filterEvent === ev.value ? 'active' : ''}`} onClick={() => setFilterEvent(ev.value)}>
            {ev.label}
          </button>
        ))}
      </div>

      <div className="devtools-list" style={{ marginTop: 12 }}>
        {filtered.map(hook => (
          <div key={hook.id} className="devtools-list-item">
            <Webhook size={16} style={{ color: hook.enabled ? '#10b981' : '#6b7280', flexShrink: 0 }} />
            <div className="devtools-list-item-content">
              <div className="devtools-list-item-title">
                {hook.name}
                <span className="devtools-code-tag">{hook.event}</span>
                {hook.matcher && <span className="devtools-code-tag">{hook.matcher}</span>}
              </div>
              <div className="devtools-list-item-desc">
                Triggered {hook.triggerCount} times
                {hook.lastTriggered && ` · Last: ${new Date(hook.lastTriggered).toLocaleString()}`}
              </div>
            </div>
            <div className="devtools-list-item-actions">
              <label className="devtools-toggle-small">
                <input type="checkbox" checked={hook.enabled} onChange={e => toggleHook(hook.id, e.target.checked)} />
                <span className="devtools-toggle-slider-small" />
              </label>
              <button onClick={() => testHook(hook.id)} className="devtools-btn-icon" title="Test">
                <Play size={14} />
              </button>
              <button onClick={() => deleteHook(hook.id)} className="devtools-btn-icon" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="devtools-empty">
            <Webhook size={32} />
            <p>No hooks created yet. Use templates above or create a custom hook.</p>
          </div>
        )}
      </div>
    </div>
  );
}
