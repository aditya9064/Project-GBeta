/* ═══════════════════════════════════════════════════════════
   Feature 8: Plugin Ecosystem — install, manage, and create
   shareable plugins for tools, hooks, MCP configs
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect } from 'react';
import {
  Package, Plus, Loader2, Trash2, CheckCircle, XCircle,
  Download, Settings, Eye, Code2, Zap, Puzzle, Shield,
  RefreshCw, Star, ExternalLink,
} from 'lucide-react';

interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'tools' | 'hooks' | 'mcp' | 'theme' | 'workflow';
  entryPoint: string;
  config: Record<string, any>;
  enabled: boolean;
  installedAt: string;
  tools?: string[];
  hooks?: string[];
}

interface BuiltinPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  type: string;
  entryPoint: string;
  config: Record<string, any>;
  enabled: boolean;
  tools?: string[];
  hooks?: string[];
}

const TYPE_CONFIG: Record<string, { color: string; icon: typeof Package; label: string }> = {
  tools: { color: '#60a5fa', icon: Zap, label: 'Tools' },
  hooks: { color: '#f59e0b', icon: Code2, label: 'Hooks' },
  mcp: { color: '#a78bfa', icon: Puzzle, label: 'MCP' },
  theme: { color: '#ec4899', icon: Eye, label: 'Theme' },
  workflow: { color: '#10b981', icon: Settings, label: 'Workflow' },
};

export function PluginEcosystem() {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [builtins, setBuiltins] = useState<BuiltinPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'available' | 'create'>('installed');
  const [filterType, setFilterType] = useState('all');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginDefinition | null>(null);

  const [newName, setNewName] = useState('');
  const [newVersion, setNewVersion] = useState('1.0.0');
  const [newDesc, setNewDesc] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newType, setNewType] = useState<string>('tools');
  const [newEntry, setNewEntry] = useState('');
  const [installing, setInstalling] = useState(false);

  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const [pluginsRes, builtinsRes] = await Promise.all([
        fetch('/api/devtools/plugins'),
        fetch('/api/devtools/plugins/builtin'),
      ]);
      const pluginsData = await pluginsRes.json();
      const builtinsData = await builtinsRes.json();
      if (pluginsData.success) setPlugins(pluginsData.data);
      if (builtinsData.success) setBuiltins(builtinsData.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

  const installPlugin = useCallback(async (plugin?: BuiltinPlugin) => {
    setInstalling(true);
    const body = plugin || {
      name: newName,
      version: newVersion,
      description: newDesc,
      author: newAuthor || 'User',
      type: newType,
      entryPoint: newEntry,
      config: {},
      enabled: true,
    };

    try {
      const res = await fetch('/api/devtools/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setPlugins(prev => [...prev, data.data]);
        if (!plugin) {
          setNewName(''); setNewDesc(''); setNewEntry('');
          setActiveTab('installed');
        }
      }
    } catch { /* */ }
    finally { setInstalling(false); }
  }, [newName, newVersion, newDesc, newAuthor, newType, newEntry]);

  const togglePlugin = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/devtools/plugins/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled } : p));
    } catch { /* */ }
  }, []);

  const uninstallPlugin = useCallback(async (id: string) => {
    try {
      await fetch(`/api/devtools/plugins/${id}`, { method: 'DELETE' });
      setPlugins(prev => prev.filter(p => p.id !== id));
      if (selectedPlugin?.id === id) setSelectedPlugin(null);
    } catch { /* */ }
  }, [selectedPlugin]);

  const filteredPlugins = filterType === 'all' ? plugins : plugins.filter(p => p.type === filterType);
  const installedNames = new Set(plugins.map(p => p.name));

  return (
    <div className="devtools-page">
      <div className="devtools-header">
        <div className="devtools-header-left">
          <Package size={22} />
          <h1>Plugin Ecosystem</h1>
          <span className="devtools-badge">Extensible</span>
        </div>
        <button onClick={fetchPlugins} className="devtools-btn devtools-btn-secondary">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="devtools-stats-row">
        <div className="devtools-stat-card">
          <Package size={18} />
          <div>
            <div className="devtools-stat-value">{plugins.length}</div>
            <div className="devtools-stat-label">Installed</div>
          </div>
        </div>
        <div className="devtools-stat-card" style={{ borderLeft: '3px solid #10b981' }}>
          <CheckCircle size={18} style={{ color: '#10b981' }} />
          <div>
            <div className="devtools-stat-value">{plugins.filter(p => p.enabled).length}</div>
            <div className="devtools-stat-label">Active</div>
          </div>
        </div>
        <div className="devtools-stat-card">
          <Download size={18} />
          <div>
            <div className="devtools-stat-value">{builtins.length}</div>
            <div className="devtools-stat-label">Available</div>
          </div>
        </div>
      </div>

      <div className="devtools-tabs" style={{ marginTop: 16 }}>
        <button className={`devtools-tab ${activeTab === 'installed' ? 'active' : ''}`} onClick={() => setActiveTab('installed')}>
          <Package size={14} /> Installed ({plugins.length})
        </button>
        <button className={`devtools-tab ${activeTab === 'available' ? 'active' : ''}`} onClick={() => setActiveTab('available')}>
          <Download size={14} /> Available ({builtins.length})
        </button>
        <button className={`devtools-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
          <Plus size={14} /> Create Plugin
        </button>
      </div>

      {activeTab === 'installed' && (
        <>
          <div className="devtools-filter-row" style={{ marginTop: 12 }}>
            <button className={`devtools-filter-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All</button>
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
              <button key={type} className={`devtools-filter-btn ${filterType === type ? 'active' : ''}`} onClick={() => setFilterType(type)}>
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="devtools-content-split" style={{ marginTop: 12 }}>
            <div className="devtools-panel" style={{ flex: selectedPlugin ? '0 0 55%' : '1' }}>
              <div className="devtools-list">
                {filteredPlugins.map(plugin => {
                  const cfg = TYPE_CONFIG[plugin.type] || TYPE_CONFIG.tools;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={plugin.id}
                      className={`devtools-list-item devtools-list-item-clickable ${selectedPlugin?.id === plugin.id ? 'devtools-list-item-active' : ''}`}
                      onClick={() => setSelectedPlugin(plugin)}
                    >
                      <Icon size={18} style={{ color: cfg.color, flexShrink: 0 }} />
                      <div className="devtools-list-item-content">
                        <div className="devtools-list-item-title">
                          {plugin.name}
                          <span className="devtools-code-tag">{plugin.version}</span>
                          <span className="devtools-code-tag" style={{ color: cfg.color }}>{cfg.label}</span>
                        </div>
                        <div className="devtools-list-item-desc">{plugin.description}</div>
                      </div>
                      <div className="devtools-list-item-actions">
                        <label className="devtools-toggle-small">
                          <input type="checkbox" checked={plugin.enabled} onChange={e => { e.stopPropagation(); togglePlugin(plugin.id, e.target.checked); }} />
                          <span className="devtools-toggle-slider-small" />
                        </label>
                        <button onClick={(e) => { e.stopPropagation(); uninstallPlugin(plugin.id); }} className="devtools-btn-icon" title="Uninstall">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredPlugins.length === 0 && (
                  <div className="devtools-empty">
                    <Package size={32} />
                    <p>No plugins installed. Browse available plugins or create your own.</p>
                  </div>
                )}
              </div>
            </div>

            {selectedPlugin && (
              <div className="devtools-panel devtools-detail-panel">
                <div className="devtools-detail-header">
                  <Package size={16} /> Plugin Detail
                  <button onClick={() => setSelectedPlugin(null)} className="devtools-btn-icon">×</button>
                </div>
                <div className="devtools-detail-body">
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Name</span><span>{selectedPlugin.name}</span></div>
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Version</span><span>{selectedPlugin.version}</span></div>
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Author</span><span>{selectedPlugin.author}</span></div>
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Type</span><span>{selectedPlugin.type}</span></div>
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Entry</span><span className="devtools-code-tag">{selectedPlugin.entryPoint}</span></div>
                  <div className="devtools-detail-row"><span className="devtools-detail-label">Installed</span><span>{new Date(selectedPlugin.installedAt).toLocaleString()}</span></div>
                  {selectedPlugin.tools && selectedPlugin.tools.length > 0 && (
                    <div className="devtools-detail-section">
                      <div className="devtools-detail-label">Tools</div>
                      <div className="devtools-tag-list">
                        {selectedPlugin.tools.map(t => <span key={t} className="devtools-code-tag">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'available' && (
        <div className="devtools-list" style={{ marginTop: 12 }}>
          {builtins.map((plugin, i) => {
            const isInstalled = installedNames.has(plugin.name);
            const cfg = TYPE_CONFIG[plugin.type] || TYPE_CONFIG.tools;
            const Icon = cfg.icon;
            return (
              <div key={i} className="devtools-list-item">
                <Icon size={18} style={{ color: cfg.color, flexShrink: 0 }} />
                <div className="devtools-list-item-content">
                  <div className="devtools-list-item-title">
                    {plugin.name}
                    <span className="devtools-code-tag">{plugin.version}</span>
                  </div>
                  <div className="devtools-list-item-desc">{plugin.description}</div>
                  {plugin.tools && (
                    <div className="devtools-tag-list" style={{ marginTop: 4 }}>
                      {plugin.tools.map(t => <span key={t} className="devtools-code-tag">{t}</span>)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => installPlugin(plugin)}
                  disabled={isInstalled || installing}
                  className={`devtools-btn ${isInstalled ? 'devtools-btn-secondary' : 'devtools-btn-primary'}`}
                >
                  {isInstalled ? <><CheckCircle size={14} /> Installed</> : <><Download size={14} /> Install</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="devtools-create-panel" style={{ marginTop: 16 }}>
          <div className="devtools-form">
            <div className="devtools-form-row">
              <label>Plugin Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="devtools-input" placeholder="My Plugin" />
            </div>
            <div className="devtools-form-row">
              <label>Version</label>
              <input type="text" value={newVersion} onChange={e => setNewVersion(e.target.value)} className="devtools-input" placeholder="1.0.0" />
            </div>
            <div className="devtools-form-row">
              <label>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="devtools-textarea" rows={3} placeholder="What does this plugin do?" />
            </div>
            <div className="devtools-form-row">
              <label>Author</label>
              <input type="text" value={newAuthor} onChange={e => setNewAuthor(e.target.value)} className="devtools-input" placeholder="Your name" />
            </div>
            <div className="devtools-form-row">
              <label>Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="devtools-select">
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                  <option key={type} value={type}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div className="devtools-form-row">
              <label>Entry Point</label>
              <input type="text" value={newEntry} onChange={e => setNewEntry(e.target.value)} className="devtools-input" placeholder="module-name or path" />
            </div>
            <button onClick={() => installPlugin()} disabled={!newName.trim() || installing} className="devtools-btn devtools-btn-primary">
              {installing ? <Loader2 size={16} className="spin" /> : <Package size={16} />}
              Create & Install Plugin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
