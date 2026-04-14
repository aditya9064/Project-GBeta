import { useState, useCallback } from 'react';
import { Play, Monitor, Globe, Loader2 } from 'lucide-react';
import { useSwarm } from '../../hooks/useComputerUse';
import type { SwarmSession } from '../../hooks/useComputerUse';

interface GoalInputProps {
  onGoalSubmitted: (swarmId: string) => void;
}

export function GoalInput({ onGoalSubmitted }: GoalInputProps) {
  const { startSwarm, sessionList } = useSwarm();
  const [goal, setGoal] = useState('');
  const [enableGui, setEnableGui] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.swarm;

  const handleSubmit = useCallback(async () => {
    if (!goal.trim() || submitting) return;
    setSubmitting(true);
    try {
      const swarmId = await startSwarm(goal.trim(), {
        enableGui,
        maxWorkers: 5,
      });
      if (swarmId) {
        setGoal('');
        onGoalSubmitted(swarmId);
      }
    } catch (err) {
      console.error('Failed to start execution:', err);
    } finally {
      setSubmitting(false);
    }
  }, [goal, enableGui, submitting, startSwarm, onGoalSubmitted]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const recentSessions = [...sessionList]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 10);

  return (
    <div className="oa-goal-page">
      <div className="oa-goal-header">
        <h1>What work should we complete?</h1>
        <p>
          Describe your goal and our AI agents will plan, execute,
          and deliver results end-to-end.
        </p>
      </div>

      <div className="oa-goal-form">
        <textarea
          className="oa-goal-textarea"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Process incoming leads and send follow-up emails&#10;&#10;Research competitors and create a summary report&#10;&#10;Extract data from invoices and enter into accounting software"
          autoFocus
        />

        <div className="oa-goal-actions">
          <div className="oa-goal-options">
            <button
              className={`oa-option-chip ${enableGui ? 'active' : ''}`}
              onClick={() => setEnableGui(!enableGui)}
              title="Allow agents to use desktop applications"
            >
              <Monitor size={14} />
              Desktop
            </button>
          </div>

          <button
            className="oa-execute-btn"
            onClick={handleSubmit}
            disabled={!goal.trim() || submitting || !isDesktop}
          >
            {submitting ? (
              <><Loader2 size={16} className="oa-spin" /> Starting...</>
            ) : (
              <><Play size={16} /> Execute</>
            )}
          </button>
        </div>

        {!isDesktop && (
          <p style={{ fontSize: 13, color: 'var(--oa-text-muted)', marginTop: 12 }}>
            Desktop app required for agent execution. Running in browser preview mode.
          </p>
        )}
      </div>

      {recentSessions.length > 0 && (
        <div className="oa-recent">
          <h3>Recent Executions</h3>
          <div className="oa-recent-list">
            {recentSessions.map(session => (
              <div
                key={session.swarmId}
                className="oa-recent-item"
                onClick={() => onGoalSubmitted(session.swarmId)}
              >
                <div className={`oa-recent-status ${session.status}`} />
                <div className="oa-recent-info">
                  <div className="oa-recent-goal">{session.goal}</div>
                  <div className="oa-recent-meta">
                    {session.tasks.length} tasks &middot;{' '}
                    {formatTimeAgo(session.startedAt)} &middot;{' '}
                    {session.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentSessions.length === 0 && (
        <div className="oa-recent">
          <div className="oa-recent-empty">
            No executions yet. Enter a goal above to get started.
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
