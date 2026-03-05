/* ═══════════════════════════════════════════════════════════
   Escalation Queue — Human-in-the-loop review interface
   
   Displays escalated tasks requiring human intervention with
   filtering, detail view, and resolution actions.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Bot,
  ChevronRight,
  Loader2,
  MessageSquare,
  RefreshCw,
  Filter,
  Eye,
  Flag,
  DollarSign,
  ShieldAlert,
} from 'lucide-react';
import {
  EscalationService,
  type Escalation,
  type EscalationStatus,
  type EscalationType,
  type EscalationPriority,
  type EscalationSummary,
} from '../../services/workforce/escalationService';

interface EscalationQueueProps {
  userId?: string;
}

export function EscalationQueue({ userId = 'demo-user' }: EscalationQueueProps) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [summary, setSummary] = useState<EscalationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EscalationStatus[]>(['pending', 'in_review']);
  const [priorityFilter, setPriorityFilter] = useState<EscalationPriority[]>([]);
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [escList, summaryData] = await Promise.all([
        EscalationService.list({
          status: statusFilter.length > 0 ? statusFilter : undefined,
          priority: priorityFilter.length > 0 ? priorityFilter : undefined,
        }),
        EscalationService.getSummary(),
      ]);
      setEscalations(escList);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedEscalation = selectedId ? escalations.find(e => e.id === selectedId) : null;

  const handleResolve = async () => {
    if (!selectedId || !resolution.trim()) return;
    setActionLoading(true);
    try {
      await EscalationService.resolve(selectedId, resolution.trim(), userId, notes.trim() || undefined);
      setResolution('');
      setNotes('');
      setSelectedId(null);
      loadData();
    } catch (err) {
      console.error('Failed to resolve:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async (reason: string) => {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      await EscalationService.dismiss(selectedId, reason, userId);
      setSelectedId(null);
      loadData();
    } catch (err) {
      console.error('Failed to dismiss:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeIcon = (type: EscalationType) => {
    switch (type) {
      case 'execution_failure': return <AlertCircle size={16} />;
      case 'low_confidence': return <AlertTriangle size={16} />;
      case 'flagged_content': return <Flag size={16} />;
      case 'manual_review': return <Eye size={16} />;
      case 'approval_required': return <ShieldAlert size={16} />;
      case 'budget_exceeded': return <DollarSign size={16} />;
    }
  };

  const getPriorityBadge = (priority: EscalationPriority) => {
    const colors: Record<EscalationPriority, { bg: string; text: string }> = {
      critical: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' },
      high: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
      medium: { bg: 'rgba(224,122,58,0.15)', text: '#e07a3a' },
      low: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    };
    const { bg, text } = colors[priority];
    
    return (
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 4,
        background: bg,
        color: text,
      }}>
        {priority}
      </span>
    );
  };

  const getStatusBadge = (status: EscalationStatus) => {
    const colors: Record<EscalationStatus, { bg: string; text: string }> = {
      pending: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
      in_review: { bg: 'rgba(224,122,58,0.15)', text: '#e07a3a' },
      resolved: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
      dismissed: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
      auto_resolved: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    };
    const { bg, text } = colors[status];
    
    return (
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 4,
        background: bg,
        color: text,
      }}>
        {EscalationService.getStatusLabel(status)}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading && escalations.length === 0) {
    return (
      <div className="escalation-queue">
        <div className="workforce-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading escalations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="escalation-queue">
      {/* Summary Stats */}
      {summary && (
        <div className="escalation-summary">
          <div className="escalation-stat">
            <span className="escalation-stat-value" style={{ color: '#f59e0b' }}>{summary.pending}</span>
            <span className="escalation-stat-label">Pending</span>
          </div>
          <div className="escalation-stat">
            <span className="escalation-stat-value" style={{ color: '#e07a3a' }}>{summary.inReview}</span>
            <span className="escalation-stat-label">In Review</span>
          </div>
          <div className="escalation-stat">
            <span className="escalation-stat-value" style={{ color: '#10b981' }}>{summary.resolved}</span>
            <span className="escalation-stat-label">Resolved</span>
          </div>
          <div className="escalation-stat">
            <span className="escalation-stat-value">{summary.total}</span>
            <span className="escalation-stat-label">Total</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="escalation-filters">
        <div className="filter-group">
          <label>Status:</label>
          <div className="filter-buttons">
            {(['pending', 'in_review', 'resolved', 'dismissed'] as EscalationStatus[]).map(status => (
              <button
                key={status}
                className={`filter-btn ${statusFilter.includes(status) ? 'active' : ''}`}
                onClick={() => {
                  if (statusFilter.includes(status)) {
                    setStatusFilter(statusFilter.filter(s => s !== status));
                  } else {
                    setStatusFilter([...statusFilter, status]);
                  }
                }}
              >
                {EscalationService.getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <button className="workforce-btn-icon" onClick={loadData} title="Refresh">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div className="escalation-content">
        {/* List */}
        <div className="escalation-list">
          {escalations.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <CheckCircle2 size={40} />
              <p>No Escalations</p>
              <span>All clear! No items requiring attention.</span>
            </div>
          ) : (
            escalations.map(esc => (
              <div
                key={esc.id}
                className={`escalation-item ${selectedId === esc.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(esc.id)}
              >
                <div className="escalation-item-header">
                  <div className="escalation-item-icon" style={{ color: EscalationService.getPriorityColor(esc.priority) }}>
                    {getTypeIcon(esc.type)}
                  </div>
                  <div className="escalation-item-title">
                    <h4>{esc.title}</h4>
                    <span className="escalation-item-meta">
                      {esc.agentName && <><Bot size={12} /> {esc.agentName}</>}
                      {esc.crewName && <> • {esc.crewName}</>}
                    </span>
                  </div>
                  <ChevronRight size={16} className="escalation-item-arrow" />
                </div>
                <div className="escalation-item-footer">
                  {getPriorityBadge(esc.priority)}
                  {getStatusBadge(esc.status)}
                  <span className="escalation-item-time">
                    <Clock size={12} /> {formatTime(esc.createdAt)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedEscalation && (
          <div className="escalation-detail">
            <div className="escalation-detail-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: EscalationService.getPriorityColor(selectedEscalation.priority) }}>
                  {getTypeIcon(selectedEscalation.type)}
                </span>
                {getPriorityBadge(selectedEscalation.priority)}
                {getStatusBadge(selectedEscalation.status)}
              </div>
              <button
                className="workforce-btn-icon"
                onClick={() => setSelectedId(null)}
              >
                <XCircle size={18} />
              </button>
            </div>

            <h3 className="escalation-detail-title">{selectedEscalation.title}</h3>
            <p className="escalation-detail-desc">{selectedEscalation.description}</p>

            {selectedEscalation.errorMessage && (
              <div className="escalation-error">
                <AlertCircle size={14} />
                <code>{selectedEscalation.errorMessage}</code>
              </div>
            )}

            <div className="escalation-detail-meta">
              {selectedEscalation.agentName && (
                <div className="meta-item">
                  <Bot size={14} />
                  <span>Agent: {selectedEscalation.agentName}</span>
                </div>
              )}
              {selectedEscalation.crewName && (
                <div className="meta-item">
                  <User size={14} />
                  <span>Crew: {selectedEscalation.crewName}</span>
                </div>
              )}
              {selectedEscalation.executionId && (
                <div className="meta-item">
                  <Clock size={14} />
                  <span>Execution: {selectedEscalation.executionId.slice(0, 15)}...</span>
                </div>
              )}
            </div>

            {selectedEscalation.suggestedAction && (
              <div className="escalation-suggestion">
                <h5>Suggested Action</h5>
                <p>{selectedEscalation.suggestedAction}</p>
              </div>
            )}

            {selectedEscalation.originalOutput && (
              <div className="escalation-output">
                <h5>Original Output</h5>
                <pre>{JSON.stringify(selectedEscalation.originalOutput, null, 2)}</pre>
              </div>
            )}

            {(selectedEscalation.status === 'pending' || selectedEscalation.status === 'in_review') && (
              <div className="escalation-actions">
                <div className="feedback-form-group">
                  <label className="feedback-form-label">Resolution</label>
                  <textarea
                    className="feedback-textarea"
                    placeholder="Describe how you resolved this issue..."
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="feedback-form-group">
                  <label className="feedback-form-label">Notes (optional)</label>
                  <textarea
                    className="feedback-textarea"
                    placeholder="Additional notes for future reference..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="escalation-action-buttons">
                  <button
                    className="workforce-btn-primary"
                    onClick={handleResolve}
                    disabled={!resolution.trim() || actionLoading}
                  >
                    {actionLoading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                    Resolve
                  </button>
                  <button
                    className="workforce-btn-secondary"
                    onClick={() => handleDismiss('Not actionable')}
                    disabled={actionLoading}
                  >
                    <XCircle size={16} />
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {selectedEscalation.status === 'resolved' && (
              <div className="escalation-resolution">
                <h5>Resolution</h5>
                <p>{selectedEscalation.resolution}</p>
                {selectedEscalation.reviewerNotes && (
                  <>
                    <h5>Reviewer Notes</h5>
                    <p>{selectedEscalation.reviewerNotes}</p>
                  </>
                )}
                <span className="resolution-by">
                  Resolved by {selectedEscalation.resolvedBy} on {new Date(selectedEscalation.resolvedAt!).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
