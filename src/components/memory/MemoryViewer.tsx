/* ═══════════════════════════════════════════════════════════
   Memory Viewer — Timeline, Search & Context Viewer
   
   Visual interface for the persistent memory system.
   Shows sessions, observations, search results, and stats.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Search,
  Clock,
  Eye,
  ChevronRight,
  ChevronDown,
  Database,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  MousePointer,
  Bug,
  Lightbulb,
  Navigation,
  Code,
  ArrowRight,
} from 'lucide-react';
import {
  MemoryApi,
  type MemorySession,
  type MemoryObservation,
  type MemorySummary,
  type SearchIndexEntry,
  type TimelineEntry,
  type MemoryStats,
} from '../../services/memoryApi';

const TYPE_ICONS: Record<string, typeof Brain> = {
  decision: Lightbulb,
  bugfix: Bug,
  feature: Zap,
  discovery: Eye,
  action: MousePointer,
  error: AlertCircle,
  navigation: Navigation,
  interaction: MessageSquare,
  api_call: Code,
  conversation: MessageSquare,
};

const TYPE_COLORS: Record<string, string> = {
  decision: '#f59e0b',
  bugfix: '#ef4444',
  feature: '#10b981',
  discovery: '#8b5cf6',
  action: '#3b82f6',
  error: '#ef4444',
  navigation: '#6366f1',
  interaction: '#14b8a6',
  api_call: '#f97316',
  conversation: '#06b6d4',
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

export function MemoryViewer() {
  const [tab, setTab] = useState<'timeline' | 'search' | 'sessions' | 'stats'>('timeline');
  const [sessions, setSessions] = useState<MemorySession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchIndexEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionObservations, setSessionObservations] = useState<MemoryObservation[]>([]);
  const [sessionSummary, setSessionSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MemoryApi.getSessions(20);
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MemoryApi.timeline({ limit: 50 });
      setTimeline(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await MemoryApi.getStats();
      setStats(data);
    } catch {
      // Stats may not be available yet
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadTimeline();
    loadStats();
  }, [loadSessions, loadTimeline, loadStats]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const results = await MemoryApi.search(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionClick = async (sessionId: string) => {
    if (selectedSession === sessionId) {
      setSelectedSession(null);
      return;
    }
    try {
      setSelectedSession(sessionId);
      const data = await MemoryApi.getSession(sessionId);
      setSessionObservations(data.observations || []);
      setSessionSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Brain size={24} style={{ color: '#8b5cf6' }} />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Agent Memory</h2>
        {stats && (
          <span style={{
            fontSize: '12px',
            color: 'var(--text-secondary, #888)',
            background: 'var(--bg-secondary, #f3f4f6)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}>
            {stats.totalSessions} sessions · {stats.totalObservations} observations
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        paddingBottom: '0',
      }}>
        {([
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'search', label: 'Search', icon: Search },
          { id: 'sessions', label: 'Sessions', icon: Database },
          { id: 'stats', label: 'Stats', icon: Activity },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? '#8b5cf6' : 'var(--text-secondary, #888)',
              borderBottom: tab === id ? '2px solid #8b5cf6' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#fef2f2',
          color: '#dc2626',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Timeline Tab */}
      {tab === 'timeline' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : timeline.length === 0 ? (
            <EmptyState message="No memory entries yet. Agents will automatically capture observations as they work." />
          ) : (
            <div style={{ position: 'relative', paddingLeft: '24px' }}>
              <div style={{
                position: 'absolute',
                left: '7px',
                top: '8px',
                bottom: '8px',
                width: '2px',
                background: 'var(--border, #e5e7eb)',
              }} />
              {timeline.map((entry, i) => (
                <TimelineItem key={i} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {tab === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search agent memory..."
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                background: 'var(--bg-primary, white)',
                color: 'var(--text-primary, #111)',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: '10px 20px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                {searchResults.length} results found
              </div>
              {searchResults.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !loading && (
            <EmptyState message="No results found. Try different keywords." />
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {tab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.length === 0 ? (
            <EmptyState message="No memory sessions recorded yet." />
          ) : (
            sessions.map((session) => (
              <div key={session.id}>
                <SessionCard
                  session={session}
                  isExpanded={selectedSession === session.id}
                  onClick={() => handleSessionClick(session.id)}
                />
                {selectedSession === session.id && (
                  <SessionDetail
                    observations={sessionObservations}
                    summary={sessionSummary}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}>
          <StatCard label="Sessions" value={stats.totalSessions} icon={Database} color="#3b82f6" />
          <StatCard label="Observations" value={stats.totalObservations} icon={Eye} color="#8b5cf6" />
          <StatCard label="Summaries" value={stats.totalSummaries} icon={MessageSquare} color="#10b981" />
          {stats.newestSession && (
            <StatCard
              label="Latest Activity"
              value={formatTime(stats.newestSession)}
              icon={Clock}
              color="#f59e0b"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const time = new Date(entry.timestamp).toLocaleString();

  if (entry.type === 'observation') {
    const obs = entry.data as MemoryObservation;
    const Icon = TYPE_ICONS[obs.type] || Zap;
    const color = TYPE_COLORS[obs.type] || '#6b7280';
    return (
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '-21px',
          top: '4px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: color,
          border: '2px solid var(--bg-primary, white)',
        }} />
        <div style={{
          padding: '12px 16px',
          background: 'var(--bg-secondary, #f9fafb)',
          borderRadius: '8px',
          border: '1px solid var(--border, #e5e7eb)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Icon size={14} style={{ color }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #111)' }}>
              {obs.title}
            </span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: `${color}15`,
              color,
              fontWeight: 500,
            }}>
              {obs.type}
            </span>
          </div>
          {obs.subtitle && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #888)', marginBottom: '4px' }}>
              {obs.subtitle}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#aaa' }}>{time}</div>
        </div>
      </div>
    );
  }

  if (entry.type === 'session_start' || entry.type === 'session_end') {
    const session = entry.data as MemorySession;
    return (
      <div style={{ marginBottom: '12px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '-21px',
          top: '4px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: entry.type === 'session_start' ? '#10b981' : '#6b7280',
          border: '2px solid var(--bg-primary, white)',
        }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          color: '#888',
        }}>
          {entry.type === 'session_start' ? (
            <ArrowRight size={12} style={{ color: '#10b981' }} />
          ) : (
            <CheckCircle2 size={12} style={{ color: '#6b7280' }} />
          )}
          {entry.type === 'session_start' ? 'Session started' : 'Session ended'}
          <span style={{ fontWeight: 500 }}>({session.agentType})</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px' }}>{time}</span>
        </div>
      </div>
    );
  }

  if (entry.type === 'summary') {
    const summary = entry.data as MemorySummary;
    return (
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '-21px',
          top: '4px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: '#f59e0b',
          border: '2px solid var(--bg-primary, white)',
        }} />
        <div style={{
          padding: '12px 16px',
          background: '#fffbeb',
          borderRadius: '8px',
          border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '4px' }}>
            Session Summary
          </div>
          {summary.request && <div style={{ fontSize: '12px', color: '#78350f' }}>Request: {summary.request}</div>}
          {summary.completed && <div style={{ fontSize: '12px', color: '#78350f' }}>Completed: {summary.completed}</div>}
          {summary.learned && <div style={{ fontSize: '12px', color: '#78350f' }}>Learned: {summary.learned}</div>}
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>{time}</div>
        </div>
      </div>
    );
  }

  return null;
}

function SearchResultCard({ result }: { result: SearchIndexEntry }) {
  const Icon = TYPE_ICONS[result.type] || Zap;
  const color = TYPE_COLORS[result.type] || '#6b7280';

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--bg-secondary, #f9fafb)',
      borderRadius: '8px',
      border: '1px solid var(--border, #e5e7eb)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
    }}>
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #111)' }}>
          {result.title}
        </div>
        <div style={{ fontSize: '11px', color: '#888', display: 'flex', gap: '8px', marginTop: '2px' }}>
          <span>{result.type}</span>
          <span>·</span>
          <span>{formatTime(result.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onClick,
}: {
  session: MemorySession;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const statusColor = session.status === 'completed' ? '#10b981' : session.status === 'failed' ? '#ef4444' : '#3b82f6';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        background: 'var(--bg-secondary, #f9fafb)',
        borderRadius: '8px',
        border: '1px solid var(--border, #e5e7eb)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: statusColor,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #111)' }}>
          {session.userPrompt.slice(0, 80)}{session.userPrompt.length > 80 ? '...' : ''}
        </div>
        <div style={{ fontSize: '11px', color: '#888', display: 'flex', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontWeight: 500 }}>{session.agentType}</span>
          <span>·</span>
          <span>{session.observationCount} observations</span>
          <span>·</span>
          <span>{formatTime(session.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function SessionDetail({
  observations,
  summary,
}: {
  observations: MemoryObservation[];
  summary: MemorySummary | null;
}) {
  return (
    <div style={{
      marginLeft: '28px',
      marginTop: '4px',
      marginBottom: '8px',
      borderLeft: '2px solid var(--border, #e5e7eb)',
      paddingLeft: '16px',
    }}>
      {summary && (
        <div style={{
          padding: '10px 14px',
          background: '#fffbeb',
          borderRadius: '6px',
          border: '1px solid #fde68a',
          marginBottom: '8px',
          fontSize: '12px',
        }}>
          {summary.request && <div><strong>Request:</strong> {summary.request}</div>}
          {summary.completed && <div><strong>Completed:</strong> {summary.completed}</div>}
          {summary.learned && <div><strong>Learned:</strong> {summary.learned}</div>}
          {summary.nextSteps && <div><strong>Next Steps:</strong> {summary.nextSteps}</div>}
        </div>
      )}
      {observations.map((obs) => {
        const Icon = TYPE_ICONS[obs.type] || Zap;
        const color = TYPE_COLORS[obs.type] || '#6b7280';
        return (
          <div
            key={obs.id}
            style={{
              padding: '8px 12px',
              marginBottom: '4px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <Icon size={12} style={{ color, marginTop: '2px', flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 500 }}>{obs.title}</span>
              {obs.subtitle && (
                <span style={{ color: '#888', marginLeft: '6px' }}>{obs.subtitle}</span>
              )}
            </div>
          </div>
        );
      })}
      {observations.length === 0 && (
        <div style={{ fontSize: '12px', color: '#888', padding: '8px' }}>
          No observations for this session.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: typeof Brain;
  color: string;
}) {
  return (
    <div style={{
      padding: '20px',
      background: 'var(--bg-secondary, #f9fafb)',
      borderRadius: '12px',
      border: '1px solid var(--border, #e5e7eb)',
      textAlign: 'center',
    }}>
      <Icon size={24} style={{ color, marginBottom: '8px' }} />
      <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary, #111)' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '48px 24px',
      color: '#888',
    }}>
      <Brain size={32} style={{ color: '#d1d5db', marginBottom: '12px' }} />
      <div style={{ fontSize: '14px' }}>{message}</div>
    </div>
  );
}
