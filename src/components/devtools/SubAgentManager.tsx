/* ═══════════════════════════════════════════════════════════
   Feature 5: Sub-Agent Delegation — spawn, monitor, and
   manage parallel isolated-context sub-agents
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Users, Plus, Loader2, Play, Pause, XCircle, CheckCircle,
  Clock, BarChart3, Cpu, RefreshCw, ChevronRight, Trash2,
  Target, Layers,
} from 'lucide-react';

interface SubAgentState {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  parentId?: string;
  isolatedContext: Record<string, any>;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  pending: { color: '#6b7280', icon: Clock, label: 'Pending' },
  running: { color: '#60a5fa', icon: Loader2, label: 'Running' },
  completed: { color: '#10b981', icon: CheckCircle, label: 'Completed' },
  failed: { color: '#ef4444', icon: XCircle, label: 'Failed' },
  cancelled: { color: '#f59e0b', icon: Pause, label: 'Cancelled' },
};

export function SubAgentManager() {
  const [agents, setAgents] = useState<SubAgentState[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [parentId] = useState('root');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/devtools/subagents');
      const data = await res.json();
      if (data.success) setAgents(data.data);
    } catch { /* */ }
  }, []);

  const createAgent = useCallback(async () => {
    if (!newGoal.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/devtools/subagents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, goal: newGoal }),
      });
      const data = await res.json();
      if (data.success) {
        setAgents(prev => [...prev, data.data]);
        setNewGoal('');
      }
    } catch { /* */ }
    finally { setCreating(false); }
  }, [newGoal, parentId]);

  const cancelAgent = useCallback(async (id: string) => {
    try {
      await fetch(`/api/devtools/subagents/${id}/cancel`, { method: 'POST' });
      fetchAgents();
    } catch { /* */ }
  }, [fetchAgents]);

  const startAgent = useCallback(async (id: string) => {
    try {
      await fetch(`/api/devtools/subagents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'running', progress: 10 }),
      });
      fetchAgents();
    } catch { /* */ }
  }, [fetchAgents]);

  useEffect(() => {
    fetchAgents();
    pollRef.current = setInterval(fetchAgents, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAgents]);

  const runningCount = agents.filter(a => a.status === 'running').length;
  const completedCount = agents.filter(a => a.status === 'completed').length;
  const selected = agents.find(a => a.id === selectedAgent);

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Users size={22} />
          <h1>Sub-Agent Manager</h1>
          <span className="devtools-badge">Parallel Delegation</span>
        </div>
        <button onClick={fetchAgents} className="devtools-btn devtools-btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="devtools-stats-row">
        <div className="devtools-stat-card">
          <Cpu size={18} />
          <div>
            <div className="devtools-stat-value">{agents.length}</div>
            <div className="devtools-stat-label">Total Agents</div>
          </div>
        </div>
        <div className="devtools-stat-card" style={{ borderLeft: '3px solid #60a5fa' }}>
          <Loader2 size={18} style={{ color: '#60a5fa' }} />
          <div>
            <div className="devtools-stat-value">{runningCount}</div>
            <div className="devtools-stat-label">Running</div>
          </div>
        </div>
        <div className="devtools-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <CheckCircle size={18} style={{ color: '#10b981' }} />
          <div>
            <div className="devtools-stat-value">{completedCount}</div>
            <div className="devtools-stat-label">Completed</div>
          </div>
        </div>
      </div>

      <div className="devtools-input-row" style={{ marginTop: 16 }}>
        <input
          type="text"
          placeholder="Describe the sub-agent's goal (e.g. 'Research competitor pricing')"
          value={newGoal}
          onChange={e => setNewGoal(e.target.value)}
          className="devtools-input"
          onKeyDown={e => e.key === 'Enter' && createAgent()}
        />
        <button onClick={createAgent} disabled={creating || !newGoal.trim()} className="devtools-btn devtools-btn-primary">
          {creating ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
          Spawn Agent
        </button>
      </div>

      <div className="devtools-content-split" style={{ marginTop: 16 }}>
        <div className="devtools-panel" style={{ flex: selected ? '0 0 55%' : '1' }}>
          <div className="devtools-list">
            {agents.map(agent => {
              const cfg = STATUS_CONFIG[agent.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={agent.id}
                  className={`devtools-list-item devtools-list-item-clickable ${selectedAgent === agent.id ? 'devtools-list-item-active' : ''}`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <Icon
                    size={18}
                    style={{ color: cfg.color, flexShrink: 0 }}
                    className={agent.status === 'running' ? 'spin' : ''}
                  />
                  <div className="devtools-list-item-content">
                    <div className="devtools-list-item-title">{agent.goal}</div>
                    <div className="devtools-list-item-desc">
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                      {' · '}
                      {new Date(agent.startedAt).toLocaleTimeString()}
                      {agent.progress > 0 && ` · ${agent.progress}%`}
                    </div>
                    {agent.status === 'running' && (
                      <div className="devtools-progress-bar">
                        <div className="devtools-progress-fill" style={{ width: `${agent.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="devtools-list-item-actions">
                    {agent.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); startAgent(agent.id); }} className="devtools-btn-icon" title="Start">
                        <Play size={14} />
                      </button>
                    )}
                    {(agent.status === 'pending' || agent.status === 'running') && (
                      <button onClick={(e) => { e.stopPropagation(); cancelAgent(agent.id); }} className="devtools-btn-icon" title="Cancel">
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {agents.length === 0 && (
              <div className="devtools-empty">
                <Users size={32} />
                <p>No sub-agents spawned yet. Create one to delegate work.</p>
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="devtools-panel devtools-detail-panel">
            <div className="devtools-detail-header">
              <Target size={16} /> Agent Detail
              <button onClick={() => setSelectedAgent(null)} className="devtools-btn-icon">×</button>
            </div>
            <div className="devtools-detail-body">
              <div className="devtools-detail-row">
                <span className="devtools-detail-label">ID</span>
                <span className="devtools-code-tag">{selected.id}</span>
              </div>
              <div className="devtools-detail-row">
                <span className="devtools-detail-label">Goal</span>
                <span>{selected.goal}</span>
              </div>
              <div className="devtools-detail-row">
                <span className="devtools-detail-label">Status</span>
                <span style={{ color: STATUS_CONFIG[selected.status].color }}>{STATUS_CONFIG[selected.status].label}</span>
              </div>
              <div className="devtools-detail-row">
                <span className="devtools-detail-label">Started</span>
                <span>{new Date(selected.startedAt).toLocaleString()}</span>
              </div>
              {selected.completedAt && (
                <div className="devtools-detail-row">
                  <span className="devtools-detail-label">Completed</span>
                  <span>{new Date(selected.completedAt).toLocaleString()}</span>
                </div>
              )}
              {selected.result && (
                <div className="devtools-detail-section">
                  <div className="devtools-detail-label">Result</div>
                  <pre className="devtools-code-block"><code>{selected.result}</code></pre>
                </div>
              )}
              {selected.error && (
                <div className="devtools-detail-section">
                  <div className="devtools-detail-label">Error</div>
                  <pre className="devtools-error-block">{selected.error}</pre>
                </div>
              )}
              {Object.keys(selected.isolatedContext).length > 0 && (
                <div className="devtools-detail-section">
                  <div className="devtools-detail-label">Isolated Context</div>
                  <pre className="devtools-code-block">
                    <code>{JSON.stringify(selected.isolatedContext, null, 2)}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
