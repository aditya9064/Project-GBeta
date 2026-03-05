import { useState, useEffect, useCallback } from 'react';
import {
  Mail, MessageSquare, Video, TrendingUp, Calendar, Table,
  Code, BookOpen, Check, X, ExternalLink, Loader2, RefreshCw, Plug,
} from 'lucide-react';
import { auth } from '../../lib/firebase';

const API_BASE = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL || '/api');

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'coming_soon';
  account?: string;
  oauthPath?: string;
}

const INTEGRATIONS_TEMPLATE: Omit<Integration, 'status' | 'account'>[] = [
  { id: 'gmail', name: 'Gmail', description: 'Send and receive emails through Gmail', icon: <Mail size={28} />, oauthPath: '/api/connections/gmail/connect' },
  { id: 'slack', name: 'Slack', description: 'Team messaging and notifications', icon: <MessageSquare size={28} />, oauthPath: '/api/connections/slack/connect' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Enterprise communication', icon: <Video size={28} />, oauthPath: '/api/connections/teams/connect' },
  { id: 'hubspot', name: 'HubSpot', description: 'CRM and sales pipeline', icon: <TrendingUp size={28} />, oauthPath: '/api/connections/hubspot/connect' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Schedule and manage events', icon: <Calendar size={28} /> },
  { id: 'google_sheets', name: 'Google Sheets', description: 'Spreadsheet automation', icon: <Table size={28} /> },
  { id: 'github', name: 'GitHub', description: 'Code and repository management', icon: <Code size={28} /> },
  { id: 'notion', name: 'Notion', description: 'Knowledge management', icon: <BookOpen size={28} /> },
];

const COMING_SOON_IDS = new Set(['google_calendar', 'google_sheets', 'github', 'notion']);

export function IntegrationsHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/connections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : {};
      const connections: Record<string, { connected?: boolean; account?: string }> = data.connections || data || {};

      setIntegrations(
        INTEGRATIONS_TEMPLATE.map((t) => {
          if (COMING_SOON_IDS.has(t.id)) return { ...t, status: 'coming_soon' as const };
          const conn = connections[t.id];
          return {
            ...t,
            status: conn?.connected ? 'connected' as const : 'disconnected' as const,
            account: conn?.account,
          };
        }),
      );
    } catch {
      setIntegrations(
        INTEGRATIONS_TEMPLATE.map((t) => ({
          ...t,
          status: COMING_SOON_IDS.has(t.id) ? 'coming_soon' as const : 'disconnected' as const,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handleConnect = (integration: Integration) => {
    if (integration.oauthPath) {
      window.location.href = API_BASE + integration.oauthPath.replace(/^\/api/, '');
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_BASE}/connections/${integration.id}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchConnections();
    } catch { /* silently fail */ }
  };

  const badgeStyle = (status: Integration['status']): React.CSSProperties => {
    const base: React.CSSProperties = { padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 };
    if (status === 'connected') return { ...base, background: 'rgba(16,185,129,0.1)', color: '#10B981' };
    if (status === 'disconnected') return { ...base, background: 'rgba(224,122,58,0.1)', color: '#e07a3a' };
    return { ...base, background: 'var(--color-bg-tertiary, #F4F5F7)', color: 'var(--color-text-tertiary, #6B7280)' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#e07a3a' }} />
        <span style={{ color: 'var(--color-text-secondary, #6B7280)', fontSize: 14 }}>Loading integrations…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-text-primary, #1a1a2e)' }}>
            <Plug size={28} style={{ color: '#e07a3a' }} /> Integrations Hub
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary, #6B7280)', fontSize: 15 }}>Connect your tools and services</p>
        </div>
        <button
          onClick={fetchConnections}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border-default, #E5E7EB)', background: 'var(--color-bg-secondary, #fff)', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary, #374151)' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {integrations.map((ig) => {
          const comingSoon = ig.status === 'coming_soon';
          return (
            <div
              key={ig.id}
              style={{
                background: 'var(--color-bg-secondary, #fff)',
                border: '1px solid var(--color-border-subtle, #E5E7EB)',
                borderRadius: 14,
                padding: 24,
                opacity: comingSoon ? 0.6 : 1,
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: comingSoon ? 'default' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
              onMouseEnter={(e) => { if (!comingSoon) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(224,122,58,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e07a3a' }}>
                  {ig.icon}
                </div>
                <span style={badgeStyle(ig.status)}>
                  {ig.status === 'connected' && <><Check size={12} /> Connected</>}
                  {ig.status === 'disconnected' && <><X size={12} /> Not Connected</>}
                  {ig.status === 'coming_soon' && 'Coming Soon'}
                </span>
              </div>

              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary, #1a1a2e)' }}>{ig.name}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary, #6B7280)', fontSize: 13, lineHeight: 1.4 }}>{ig.description}</p>
              </div>

              {ig.account && ig.status === 'connected' && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary, #9CA3AF)' }}>{ig.account}</p>
              )}

              {!comingSoon && (
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  {ig.status === 'connected' ? (
                    <button
                      onClick={() => handleDisconnect(ig)}
                      style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <X size={14} /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(ig)}
                      style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#e07a3a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <ExternalLink size={14} /> Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
