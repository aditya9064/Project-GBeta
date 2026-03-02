import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Send,
  Loader2,
} from 'lucide-react';
import {
  FeedbackService,
  type ExecutionFeedback,
  type FeedbackOutcome,
  LearningService,
} from '../../services/workforce';
import { useAgents } from '../../contexts/AgentContext';

interface FeedbackPanelProps {
  selectedAgentId?: string | null;
  onAgentSelect?: (agentId: string | null) => void;
}

export function FeedbackPanel({
  selectedAgentId,
  onAgentSelect,
}: FeedbackPanelProps) {
  const { agents } = useAgents();
  const [feedback, setFeedback] = useState<ExecutionFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    executionId: `exec-${Date.now()}`,
    outcome: 'success' as FeedbackOutcome,
    rating: 0,
    feedbackText: '',
  });

  useEffect(() => {
    if (selectedAgentId) {
      loadFeedback(selectedAgentId);
    } else {
      setFeedback([]);
    }
  }, [selectedAgentId]);

  const loadFeedback = async (agentId: string) => {
    setLoading(true);
    try {
      const data = await FeedbackService.getForAgent(agentId, 50);
      setFeedback(data);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAgentId) return;
    
    setSubmitting(true);
    try {
      const newFeedback = await FeedbackService.submit({
        executionId: formData.executionId,
        agentId: selectedAgentId,
        outcome: formData.outcome,
        rating: formData.rating > 0 ? formData.rating : undefined,
        feedbackText: formData.feedbackText || undefined,
      });
      
      setFeedback(prev => [newFeedback, ...prev]);
      setFormData({
        executionId: `exec-${Date.now()}`,
        outcome: 'success',
        rating: 0,
        feedbackText: '',
      });
      
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) {
        LearningService.analyzeAgent(selectedAgentId, agent.name);
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getOutcomeIcon = (outcome: FeedbackOutcome) => {
    switch (outcome) {
      case 'success': return <CheckCircle2 size={16} style={{ color: '#10b981' }} />;
      case 'failure': return <AlertCircle size={16} style={{ color: '#ef4444' }} />;
      case 'partial': return <Edit3 size={16} style={{ color: '#f59e0b' }} />;
      case 'user_corrected': return <Edit3 size={16} style={{ color: '#3b82f6' }} />;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="feedback-rating">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={14}
            className={`feedback-star ${star <= rating ? '' : 'empty'}`}
            fill={star <= rating ? '#f59e0b' : 'none'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="feedback-page">
      <div className="feedback-header">
        <h2>Execution Feedback</h2>
      </div>

      <div className="feedback-grid">
        {/* Agent Selection & Feedback List */}
        <div className="feedback-list-card">
          <h3>Select Agent</h3>
          <div style={{ marginBottom: 20 }}>
            <select
              className="feedback-select"
              value={selectedAgentId || ''}
              onChange={e => onAgentSelect?.(e.target.value || null)}
            >
              <option value="">Choose an agent...</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          {selectedAgentId && (
            <>
              <h3 style={{ marginTop: 24 }}>Feedback History</h3>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#6a6a80' }}>
                  <Loader2 size={18} className="spin" />
                  Loading feedback...
                </div>
              ) : feedback.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0' }}>
                  No feedback recorded for this agent yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                  {feedback.map(fb => (
                    <div key={fb.id} className="feedback-item">
                      <div style={{ flex: '0 0 auto' }}>
                        {getOutcomeIcon(fb.outcome)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ 
                            fontSize: 12, 
                            fontWeight: 600, 
                            textTransform: 'uppercase',
                            color: fb.outcome === 'success' ? '#10b981' : 
                                   fb.outcome === 'failure' ? '#ef4444' : '#f59e0b'
                          }}>
                            {fb.outcome.replace('_', ' ')}
                          </span>
                          {fb.rating && renderStars(fb.rating)}
                        </div>
                        {fb.feedbackText && (
                          <p style={{ fontSize: 13, color: '#3a3a52', margin: '4px 0' }}>
                            {fb.feedbackText}
                          </p>
                        )}
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(fb.timestamp).toLocaleDateString()} at{' '}
                          {new Date(fb.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Submit Feedback Form */}
        <div className="feedback-form-card">
          <h3>Submit Feedback</h3>
          
          {!selectedAgentId ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <MessageSquare size={40} />
              <p>Select an Agent</p>
              <span>Choose an agent to submit feedback</span>
            </div>
          ) : (
            <>
              <div className="feedback-form-group">
                <label className="feedback-form-label">Outcome</label>
                <select
                  className="feedback-select"
                  value={formData.outcome}
                  onChange={e => setFormData(prev => ({ ...prev, outcome: e.target.value as FeedbackOutcome }))}
                >
                  <option value="success">Success - Task completed correctly</option>
                  <option value="partial">Partial - Some issues but usable</option>
                  <option value="user_corrected">User Corrected - Had to fix output</option>
                  <option value="failure">Failure - Did not complete task</option>
                </select>
              </div>

              <div className="feedback-form-group">
                <label className="feedback-form-label">Rating</label>
                <div className="feedback-rating-input">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      className={`feedback-rating-btn ${formData.rating === rating ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, rating }))}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-form-group">
                <label className="feedback-form-label">Comments (optional)</label>
                <textarea
                  className="feedback-textarea"
                  placeholder="What went well or could be improved?"
                  value={formData.feedbackText}
                  onChange={e => setFormData(prev => ({ ...prev, feedbackText: e.target.value }))}
                  rows={4}
                />
              </div>

              <button
                className="workforce-btn-primary"
                onClick={handleSubmitFeedback}
                disabled={submitting}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Feedback
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
