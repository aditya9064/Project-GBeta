import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, ArrowLeft, Copy, Check, Trash2, ExternalLink,
  Play, Loader2, X, AlertCircle, CheckCircle, ArrowDownLeft,
  ArrowUpRight, RefreshCw,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAgents } from '../../contexts/AgentContext';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');

interface WebhookData {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  events: string[];
  status: 'active' | 'inactive';
  url?: string;
  targetAgentId?: string;
  endpointUrl?: string;
  secret?: string;
  lastTriggered?: string;
  createdAt?: string;
}

interface DeliveryLog {
  id: string;
  timestamp: string;
  status: 'success' | 'failure';
  statusCode?: number;
  message?: string;
}

const EVENT_OPTIONS = [
  'agent.completed',
  'agent.failed',
  'agent.started',
  'message.received',
  'task.completed',
  'escalation.created',
];

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function generateHexSecret(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

type View = 'list' | 'detail';

export function WebhookManager() {
  const { agents } = useAgents();
  const [view, setView] = useState<View>('list');
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDirection, setFormDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formTargetAgent, setFormTargetAgent] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail view state
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/webhooks`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch webhooks (${res.status})`);
      const data = await res.json();
      setWebhooks(Array.isArray(data) ? data : data.webhooks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load webhooks');
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const headers = await getAuthHeaders();
      const body: any = {
        name: formName.trim(),
        direction: formDirection,
        events: formEvents,
      };
      if (formDirection === 'inbound' && formTargetAgent) body.targetAgentId = formTargetAgent;
      if (formDirection === 'outbound' && formUrl) body.url = formUrl;

      const res = await fetch(`${API_BASE}/api/webhooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to create webhook (${res.status})`);
      resetForm();
      setShowCreate(false);
      fetchWebhooks();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/webhooks/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Failed to delete webhook (${res.status})`);
      setView('list');
      setSelectedWebhook(null);
      setDeleteConfirm(false);
      fetchWebhooks();
    } catch (err: any) {
      setError(err.message || 'Failed to delete webhook');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/webhooks/${id}/test`, { method: 'POST', headers });
      if (!res.ok) throw new Error(`Test failed (${res.status})`);
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const fetchLogs = async (id: string) => {
    setLogsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/webhooks/${id}/logs`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch logs (${res.status})`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const openDetail = (webhook: WebhookData) => {
    setSelectedWebhook({ ...webhook, secret: webhook.secret || generateHexSecret() });
    setView('detail');
    setTestResult(null);
    setDeleteConfirm(false);
    fetchLogs(webhook.id);
  };

  const resetForm = () => {
    setFormName('');
    setFormDirection('inbound');
    setFormEvents([]);
    setFormTargetAgent('');
    setFormUrl('');
    setCreateError(null);
  };

  const toggleEvent = (ev: string) => {
    setFormEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── List View ───
  if (view === 'list') {
    return (
      <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Webhook size={28} /> Webhook Manager
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary, #888)', fontSize: '0.95rem' }}>
              Create and manage webhook endpoints
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchWebhooks} style={iconBtnStyle} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button onClick={() => { resetForm(); setShowCreate(true); }} style={primaryBtnStyle}>
              <Plus size={16} /> Create Webhook
            </button>
          </div>
        </div>

        {error && (
          <div style={errorBannerStyle}>
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)} style={{ ...iconBtnSmall, marginLeft: 'auto' }}><X size={14} /></button>
          </div>
        )}

        {loading ? (
          <div style={centerStyle}><Loader2 size={24} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div style={emptyStateStyle}>
            <Webhook size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px' }}>No webhooks yet</p>
            <p style={{ color: 'var(--text-secondary, #888)', margin: 0, fontSize: '0.9rem' }}>
              Create your first webhook to start receiving or sending events.
            </p>
            <button onClick={() => { resetForm(); setShowCreate(true); }} style={{ ...primaryBtnStyle, marginTop: 16 }}>
              <Plus size={16} /> Create Webhook
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {webhooks.map(wh => (
              <div key={wh.id} style={rowStyle}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {wh.direction === 'inbound'
                      ? <ArrowDownLeft size={16} style={{ color: '#e07a3a' }} />
                      : <ArrowUpRight size={16} style={{ color: '#d46b2c' }} />}
                    <span style={badgeStyle(wh.direction === 'inbound' ? '#e07a3a' : '#d46b2c')}>
                      {wh.direction}
                    </span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {wh.name}
                  </span>
                  <span style={badgeStyle(wh.status === 'active' ? '#22c55e' : '#6b7280')}>
                    {wh.status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  {wh.lastTriggered && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #888)' }}>
                      Last: {new Date(wh.lastTriggered).toLocaleDateString()}
                    </span>
                  )}
                  <button onClick={() => openDetail(wh)} style={iconBtnStyle} title="View details">
                    <ExternalLink size={15} />
                  </button>
                  <button onClick={() => handleDelete(wh.id)} style={{ ...iconBtnStyle, color: '#ef4444' }} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Create Webhook</h2>
                <button onClick={() => setShowCreate(false)} style={iconBtnSmall}><X size={18} /></button>
              </div>

              {createError && (
                <div style={{ ...errorBannerStyle, marginBottom: 16 }}>
                  <AlertCircle size={14} /> {createError}
                </div>
              )}

              <label style={labelStyle}>Name *</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Slack Notifications"
                style={inputStyle}
              />

              <label style={labelStyle}>Direction</label>
              <select value={formDirection} onChange={e => setFormDirection(e.target.value as any)} style={inputStyle}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>

              <label style={labelStyle}>Events</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {EVENT_OPTIONS.map(ev => (
                  <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: formEvents.includes(ev) ? 'var(--accent-bg, rgba(224,122,58,0.15))' : 'var(--bg-tertiary, rgba(255,255,255,0.05))', border: '1px solid', borderColor: formEvents.includes(ev) ? 'var(--accent, #e07a3a)' : 'var(--border, rgba(255,255,255,0.1))' }}>
                    <input
                      type="checkbox"
                      checked={formEvents.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                      style={{ display: 'none' }}
                    />
                    {formEvents.includes(ev) ? <CheckCircle size={14} style={{ color: 'var(--accent, #e07a3a)' }} /> : <AlertCircle size={14} style={{ opacity: 0.3 }} />}
                    {ev}
                  </label>
                ))}
              </div>

              {formDirection === 'inbound' && (
                <>
                  <label style={labelStyle}>Target Agent</label>
                  <select value={formTargetAgent} onChange={e => setFormTargetAgent(e.target.value)} style={inputStyle}>
                    <option value="">Select an agent...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </>
              )}

              {formDirection === 'outbound' && (
                <>
                  <label style={labelStyle}>URL</label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                    style={inputStyle}
                  />
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowCreate(false)} style={secondaryBtnStyle}>Cancel</button>
                <button onClick={handleCreate} disabled={creating || !formName.trim()} style={{ ...primaryBtnStyle, opacity: creating || !formName.trim() ? 0.6 : 1 }}>
                  {creating ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><Plus size={14} /> Create</>}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ─── Detail View ───
  if (view === 'detail' && selectedWebhook) {
    return (
      <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => { setView('list'); setSelectedWebhook(null); }} style={{ ...secondaryBtnStyle, marginBottom: 20 }}>
          <ArrowLeft size={16} /> Back to list
        </button>

        {error && (
          <div style={errorBannerStyle}>
            <AlertCircle size={16} /> {error}
            <button onClick={() => setError(null)} style={{ ...iconBtnSmall, marginLeft: 'auto' }}><X size={14} /></button>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.35rem', fontWeight: 700 }}>{selectedWebhook.name}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {selectedWebhook.direction === 'inbound'
                  ? <ArrowDownLeft size={14} style={{ color: '#e07a3a' }} />
                  : <ArrowUpRight size={14} style={{ color: '#d46b2c' }} />}
                <span style={badgeStyle(selectedWebhook.direction === 'inbound' ? '#e07a3a' : '#d46b2c')}>
                  {selectedWebhook.direction}
                </span>
                <span style={badgeStyle(selectedWebhook.status === 'active' ? '#22c55e' : '#6b7280')}>
                  {selectedWebhook.status}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleTest(selectedWebhook.id)} disabled={testing} style={primaryBtnStyle}>
                {testing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
                Send Test
              </button>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} style={{ ...secondaryBtnStyle, color: '#ef4444', borderColor: '#ef4444' }}>
                  <Trash2 size={14} /> Delete
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleDelete(selectedWebhook.id)} disabled={deleting} style={{ ...primaryBtnStyle, background: '#ef4444' }}>
                    {deleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm Delete'}
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} style={secondaryBtnStyle}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Events */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={sectionTitle}>Events</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(selectedWebhook.events || []).length > 0
              ? selectedWebhook.events.map(ev => (
                  <span key={ev} style={badgeStyle('#e07a3a')}>{ev}</span>
                ))
              : <span style={{ color: 'var(--text-secondary, #888)', fontSize: '0.9rem' }}>No events configured</span>}
          </div>
        </div>

        {/* Endpoint / URL */}
        {selectedWebhook.direction === 'inbound' && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h3 style={sectionTitle}>Endpoint URL</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', borderRadius: 8, padding: '10px 14px' }}>
              <code style={{ flex: 1, fontSize: '0.85rem', wordBreak: 'break-all' }}>
                {selectedWebhook.endpointUrl || `${window.location.origin}/api/webhooks/${selectedWebhook.id}/receive`}
              </code>
              <button
                onClick={() => copyToClipboard(selectedWebhook.endpointUrl || `${window.location.origin}/api/webhooks/${selectedWebhook.id}/receive`)}
                style={iconBtnStyle}
                title="Copy"
              >
                {copied ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Secret */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={sectionTitle}>Secret Key</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', borderRadius: 8, padding: '10px 14px' }}>
            <code style={{ flex: 1, fontSize: '0.85rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              {selectedWebhook.secret}
            </code>
            <button onClick={() => copyToClipboard(selectedWebhook.secret || '')} style={iconBtnStyle} title="Copy secret">
              {copied ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={sectionTitle}>Test Response</h3>
              <button onClick={() => setTestResult(null)} style={iconBtnSmall}><X size={14} /></button>
            </div>
            <pre style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', borderRadius: 8, padding: 14, fontSize: '0.82rem', overflow: 'auto', maxHeight: 200, margin: 0 }}>
              {testResult}
            </pre>
          </div>
        )}

        {/* Delivery Logs */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={sectionTitle}>Recent Deliveries</h3>
            <button onClick={() => fetchLogs(selectedWebhook.id)} style={iconBtnStyle} title="Refresh logs">
              <RefreshCw size={14} />
            </button>
          </div>
          {logsLoading ? (
            <div style={centerStyle}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading logs...</div>
          ) : logs.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #888)', fontSize: '0.9rem', margin: 0 }}>No delivery logs yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {logs.map((log, i) => (
                <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.03))' }}>
                  {log.status === 'success'
                    ? <CheckCircle size={14} style={{ color: '#22c55e' }} />
                    : <AlertCircle size={14} style={{ color: '#ef4444' }} />}
                  <span style={{ fontSize: '0.85rem', flex: 1 }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span style={badgeStyle(log.status === 'success' ? '#22c55e' : '#ef4444')}>
                    {log.status}{log.statusCode ? ` (${log.statusCode})` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return null;
}

// ─── Styles ───

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8,
  background: 'var(--accent, #e07a3a)', color: '#fff',
  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 8,
  background: 'transparent', color: 'var(--text-primary, #fff)',
  border: '1px solid var(--border, rgba(255,255,255,0.15))', cursor: 'pointer',
  fontWeight: 500, fontSize: '0.9rem',
};

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.15))',
  background: 'transparent', color: 'var(--text-primary, #fff)', cursor: 'pointer',
};

const iconBtnSmall: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 6, border: 'none',
  background: 'transparent', color: 'var(--text-secondary, #888)', cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid var(--border, rgba(255,255,255,0.15))',
  background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
  color: 'var(--text-primary, #fff)', fontSize: '0.9rem',
  marginBottom: 16, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.85rem', fontWeight: 600,
  marginBottom: 6, color: 'var(--text-secondary, #ccc)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  borderRadius: 12, padding: '20px 24px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 18px', borderRadius: 10,
  background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
  border: '1px solid var(--border, rgba(255,255,255,0.08))',
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-primary, #1a1a2e)',
  border: '1px solid var(--border, rgba(255,255,255,0.15))',
  borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflowY: 'auto',
};

const errorBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 14px', borderRadius: 8, marginBottom: 16,
  background: 'rgba(239,68,68,0.12)', color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.9rem',
};

const centerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 10, padding: '3rem 0', color: 'var(--text-secondary, #888)', fontSize: '0.95rem',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', padding: '4rem 2rem',
  background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
  borderRadius: 16, border: '1px dashed var(--border, rgba(255,255,255,0.12))',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 600,
};

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
    background: `${color}22`, color, textTransform: 'capitalize',
  };
}
