import { useState } from 'react';
import { X, Link2, Users, Globe, Lock, Copy, Check, Send } from 'lucide-react';
import { useAgents } from '../../contexts/AgentContext';

interface ShareAgentModalProps {
  isOpen: boolean;
  agentId: string;
  agentName: string;
  onClose: () => void;
}

type Visibility = 'private' | 'team' | 'public';

export function ShareAgentModal({ isOpen, agentId, agentName, onClose }: ShareAgentModalProps) {
  const { shareAgent, publishToMarketplace } = useAgents();
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const shareLink = `${window.location.origin}/agents/shared/${agentId}`;

  const handleShare = async () => {
    const emails = emailInput
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setFeedback({ type: 'error', message: 'Enter at least one email address' });
      return;
    }
    setSharing(true);
    try {
      await shareAgent(agentId, emails);
      setFeedback({ type: 'success', message: `Shared with ${emails.length} recipient${emails.length > 1 ? 's' : ''}` });
      setEmailInput('');
    } catch {
      setFeedback({ type: 'error', message: 'Failed to share agent' });
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to copy link' });
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await publishToMarketplace(agentId);
      setFeedback({ type: 'success', message: 'Published to marketplace!' });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to publish to marketplace' });
    } finally {
      setPublishing(false);
    }
  };

  const visibilityOptions: { key: Visibility; label: string; icon: JSX.Element }[] = [
    { key: 'private', label: 'Private', icon: <Lock size={14} /> },
    { key: 'team', label: 'Team', icon: <Users size={14} /> },
    { key: 'public', label: 'Public', icon: <Globe size={14} /> },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 14,
          maxWidth: 480,
          width: '90%',
          padding: '28px 28px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>
            Share {agentName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              color: '#666',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Visibility toggle */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
            Visibility
          </label>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
            {visibilityOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setVisibility(opt.key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                  background: visibility === opt.key ? '#e07a3a' : '#fafafa',
                  color: visibility === opt.key ? '#fff' : '#555',
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email input */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
            Share via email
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              onKeyDown={e => e.key === 'Enter' && handleShare()}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #ddd',
                fontSize: 13,
                outline: 'none',
                color: '#333',
              }}
            />
            <button
              onClick={handleShare}
              disabled={sharing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#e07a3a',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: sharing ? 'not-allowed' : 'pointer',
                opacity: sharing ? 0.7 : 1,
              }}
            >
              <Send size={14} />
              Share
            </button>
          </div>
        </div>

        {/* Copy link */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
            Share link
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #ddd',
                background: '#f8f8f8',
                fontSize: 13,
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Link2 size={14} style={{ flexShrink: 0, color: '#999' }} />
              {shareLink}
            </div>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #ddd',
                background: copied ? '#e8f5e9' : '#fff',
                color: copied ? '#2e7d32' : '#555',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Publish to Marketplace */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            width: '100%',
            padding: '11px 0',
            borderRadius: 8,
            border: '1px solid #e0e0e0',
            background: publishing ? '#f5f5f5' : '#fafafa',
            color: '#333',
            fontSize: 13,
            fontWeight: 600,
            cursor: publishing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <Globe size={15} />
          {publishing ? 'Publishing...' : 'Publish to Marketplace'}
        </button>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              background: feedback.type === 'success' ? '#e8f5e9' : '#fce4ec',
              color: feedback.type === 'success' ? '#2e7d32' : '#c62828',
            }}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}
