/* ═══════════════════════════════════════════════════════════
   ApprovalPopup — Bottom-right toast for AI reply approval
   
   Shows pending AI drafts one-at-a-time with:
   - Original message preview (truncated, with "Show more")
   - AI-generated reply preview (truncated, with "Show more")
   - Three actions: Approve · Review · Cancel
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Eye,
  X,
  Sparkles,
  Mail,
  Hash,
  Users,
  Bot,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
} from 'lucide-react';
import type { ApprovalItem, VIPNotification, Channel } from '../../services/commsApi';
import './ApprovalPopup.css';

/* ─── Constants ────────────────────────────────────────── */

const PREVIEW_LENGTH = 140;

const channelIcons: Record<Channel, React.ReactNode> = {
  email: <Mail size={12} />,
  slack: <Hash size={12} />,
  teams: <Users size={12} />,
};

const channelLabels: Record<Channel, string> = {
  email: 'Email',
  slack: 'Slack',
  teams: 'Teams',
};

/* ─── VIP Notification Component ───────────────────────── */

interface VIPNotificationPopupProps {
  notification: VIPNotification;
  onView: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function VIPNotificationPopup({ notification, onView, onDismiss }: VIPNotificationPopupProps) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), 8000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div className="vip-notif-popup">
      <div className="vip-notif-header">
        <div className="vip-notif-header-left">
          <div className="vip-notif-icon">
            <Shield size={14} />
          </div>
          <span className="vip-notif-title">VIP Message</span>
        </div>
        <button className="vip-notif-close" onClick={() => onDismiss(notification.id)}>
          <X size={13} />
        </button>
      </div>

      <div className="vip-notif-body">
        <div className="vip-notif-avatar" style={{ background: notification.fromColor }}>
          {notification.fromInitial}
        </div>
        <div className="vip-notif-info">
          <span className="vip-notif-from">{notification.from}</span>
          {notification.subject && (
            <span className="vip-notif-subject">{notification.subject}</span>
          )}
          <p className="vip-notif-preview">
            {notification.preview.slice(0, 100)}
            {notification.preview.length > 100 ? '...' : ''}
          </p>
        </div>
      </div>

      <button className="vip-notif-view-btn" onClick={() => onView(notification.id)}>
        <Eye size={13} />
        <span>View Message</span>
      </button>
    </div>
  );
}

/* ─── Approval Popup Component ─────────────────────────── */

interface ApprovalPopupProps {
  items: ApprovalItem[];
  onApprove: (id: string) => void;
  onReview: (id: string) => void;
  onCancel: (id: string) => void;
}

export function ApprovalPopup({ items, onApprove, onReview, onCancel }: ApprovalPopupProps) {
  const [expandedSection, setExpandedSection] = useState<'original' | 'reply' | null>(null);

  const current = items[0];

  // Reset expanded state when current item changes
  useEffect(() => {
    setExpandedSection(null);
  }, [current?.id]);

  if (!current) return null;

  const originalNeedsTruncate = current.originalFull.length > PREVIEW_LENGTH;
  const replyNeedsTruncate = current.aiDraft.length > PREVIEW_LENGTH;

  const originalText =
    expandedSection === 'original'
      ? current.originalFull
      : current.originalFull.slice(0, PREVIEW_LENGTH) + (originalNeedsTruncate ? '...' : '');

  const replyText =
    expandedSection === 'reply'
      ? current.aiDraft
      : current.aiDraft.slice(0, PREVIEW_LENGTH) + (replyNeedsTruncate ? '...' : '');

  return (
    <div className="approval-popup">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="approval-popup-header">
        <div className="approval-popup-header-left">
          <div className="approval-popup-icon">
            <Bot size={15} />
          </div>
          <span className="approval-popup-title">AI Reply Ready</span>
          {items.length > 1 && (
            <span className="approval-popup-queue-count">
              +{items.length - 1} more
            </span>
          )}
        </div>
        <button
          className="approval-popup-close"
          onClick={() => onCancel(current.id)}
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Original Message ────────────────────────────── */}
      <div className="approval-popup-section">
        <div className="approval-popup-from">
          <div
            className="approval-popup-avatar"
            style={{ background: current.fromColor }}
          >
            {current.fromInitial}
          </div>
          <div className="approval-popup-from-info">
            <span className="approval-popup-from-name">{current.from}</span>
            <span className="approval-popup-channel">
              {channelIcons[current.channel]} {channelLabels[current.channel]}
              {current.slackChannel && ` · ${current.slackChannel}`}
              {current.teamsChannel && ` · ${current.teamsChannel}`}
            </span>
          </div>
        </div>
        {current.subject && (
          <div className="approval-popup-subject">{current.subject}</div>
        )}
        <p className="approval-popup-text">{originalText}</p>
        {originalNeedsTruncate && (
          <button
            className="approval-popup-expand"
            onClick={() =>
              setExpandedSection(expandedSection === 'original' ? null : 'original')
            }
          >
            {expandedSection === 'original' ? (
              <>
                <ChevronUp size={12} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={12} /> Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* ── AI Reply ────────────────────────────────────── */}
      <div className="approval-popup-section approval-popup-reply-section">
        <div className="approval-popup-reply-label">
          <Sparkles size={13} />
          <span>Your AI Reply</span>
          <span className="approval-popup-confidence">{current.confidence}%</span>
        </div>
        <p className="approval-popup-text">{replyText}</p>
        {replyNeedsTruncate && (
          <button
            className="approval-popup-expand"
            onClick={() =>
              setExpandedSection(expandedSection === 'reply' ? null : 'reply')
            }
          >
            {expandedSection === 'reply' ? (
              <>
                <ChevronUp size={12} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={12} /> Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="approval-popup-actions">
        <button
          className="approval-popup-btn approve"
          onClick={() => onApprove(current.id)}
        >
          <CheckCircle size={14} />
          <span>Approve</span>
        </button>
        <button
          className="approval-popup-btn review"
          onClick={() => onReview(current.id)}
        >
          <Eye size={14} />
          <span>Review</span>
        </button>
        <button
          className="approval-popup-btn cancel"
          onClick={() => onCancel(current.id)}
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}





