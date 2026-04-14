import { useState, useMemo } from 'react';
import {
  Monitor,
  XOctagon,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useSwarm } from '../../hooks/useComputerUse';
import type { SwarmSession, SwarmTaskInfo, SwarmWorkerInfo, ClaudeAgentStep } from '../../hooks/useComputerUse';

export default function ExecutionView() {
  const { sessionList, cancelSwarm, removeSwarm, refreshSwarm } = useSwarm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  const sortedSessions = useMemo(() =>
    [...sessionList].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ),
    [sessionList]
  );

  const selected = selectedId
    ? sessionList.find(s => s.swarmId === selectedId) || null
    : sortedSessions[0] || null;

  const toggleWorker = (workerId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  return (
    <div className="oa-exec-page">
      {/* ─── Session List Sidebar ─── */}
      <div className="oa-exec-sidebar">
        <div className="oa-exec-sidebar-header">
          <h2>Executions</h2>
          <span style={{ fontSize: 13, color: 'var(--oa-text-muted)' }}>
            {sortedSessions.length}
          </span>
        </div>
        <div className="oa-exec-list">
          {sortedSessions.length === 0 && (
            <div className="oa-exec-empty" style={{ padding: 32 }}>
              <Monitor size={32} />
              <span>No executions yet</span>
            </div>
          )}
          {sortedSessions.map(session => (
            <div
              key={session.swarmId}
              className={`oa-exec-card ${selected?.swarmId === session.swarmId ? 'selected' : ''}`}
              onClick={() => setSelectedId(session.swarmId)}
            >
              <div className="oa-exec-card-goal">{session.goal}</div>
              <div className={`oa-exec-card-status ${session.status}`}>
                <StatusIcon status={session.status} size={12} />
                {session.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Detail Panel ─── */}
      <div className="oa-exec-detail">
        {!selected ? (
          <div className="oa-exec-empty">
            <Monitor size={48} />
            <p>Select an execution to view details</p>
          </div>
        ) : (
          <ExecutionDetail
            session={selected}
            expandedWorkers={expandedWorkers}
            toggleWorker={toggleWorker}
            onCancel={() => cancelSwarm(selected.swarmId)}
            onRemove={() => {
              removeSwarm(selected.swarmId);
              setSelectedId(null);
            }}
            onRefresh={() => refreshSwarm(selected.swarmId)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Execution Detail ─── */

function ExecutionDetail({
  session,
  expandedWorkers,
  toggleWorker,
  onCancel,
  onRemove,
  onRefresh,
}: {
  session: SwarmSession;
  expandedWorkers: Set<string>;
  toggleWorker: (id: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  const isActive = session.status === 'planning' || session.status === 'executing';
  const workers = Array.from(session.workers.values());
  const tasksByStatus = groupTasksByStatus(session.tasks);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
          {session.goal}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`oa-exec-card-status ${session.status}`}>
            <StatusIcon status={session.status} size={12} />
            {session.status}
          </span>
          <span style={{ fontSize: 13, color: 'var(--oa-text-muted)' }}>
            {session.tasks.length} tasks &middot; {workers.length} workers
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="oa-exec-controls">
        {isActive && (
          <button className="oa-ctrl-btn danger" onClick={onCancel}>
            <XOctagon size={14} /> Cancel
          </button>
        )}
        <button className="oa-ctrl-btn" onClick={onRefresh}>
          <RefreshCw size={14} /> Refresh
        </button>
        {!isActive && (
          <button className="oa-ctrl-btn danger" onClick={onRemove}>
            <Trash2 size={14} /> Remove
          </button>
        )}
      </div>

      {/* Result */}
      {session.result && (
        <div className="oa-result-section">
          <h3>Result</h3>
          <div className={`oa-result-box ${session.status === 'completed' ? 'success' : ''}`}>
            {session.result}
          </div>
        </div>
      )}

      {session.error && (
        <div className="oa-result-section">
          <h3>Error</h3>
          <div className="oa-result-box error">{session.error}</div>
        </div>
      )}

      {/* Task List */}
      {session.tasks.length > 0 && (
        <div className="oa-task-section">
          <h3>Task Plan ({session.tasks.length} tasks)</h3>
          <div className="oa-task-list">
            {session.tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* Workers */}
      {workers.length > 0 && (
        <div className="oa-workers-section">
          <h3>Agent Workers ({workers.length})</h3>
          {workers.map(worker => (
            <WorkerCard
              key={worker.workerId}
              worker={worker}
              expanded={expandedWorkers.has(worker.workerId)}
              onToggle={() => toggleWorker(worker.workerId)}
            />
          ))}
        </div>
      )}

      {/* Orchestrator Steps */}
      {session.orchestratorSteps.length > 0 && (
        <div className="oa-workers-section">
          <h3>Orchestrator Log</h3>
          <div className="oa-worker-card">
            <div className="oa-worker-steps" style={{ padding: '12px 14px', maxHeight: 300 }}>
              {session.orchestratorSteps.slice(-20).map((step, i) => (
                <StepItem key={i} step={step} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Task Item ─── */

function TaskItem({ task }: { task: SwarmTaskInfo }) {
  return (
    <div className="oa-task-item">
      <div className={`oa-task-status-icon ${task.status}`}>
        <StatusIcon status={task.status} size={14} />
      </div>
      <div className="oa-task-body">
        <div className="oa-task-title">{task.title}</div>
        {task.description && (
          <div className="oa-task-desc">{task.description}</div>
        )}
        {task.dependencies.length > 0 && (
          <div className="oa-task-deps">
            {task.dependencies.map(dep => (
              <span key={dep} className="oa-dep-tag">depends: {dep.slice(0, 8)}</span>
            ))}
          </div>
        )}
        {task.result && (
          <div className="oa-task-desc" style={{ marginTop: 6, fontStyle: 'italic' }}>
            {task.result.slice(0, 200)}{task.result.length > 200 ? '...' : ''}
          </div>
        )}
        {task.failureReason && (
          <div className="oa-task-desc" style={{ marginTop: 6, color: 'var(--oa-error)' }}>
            {task.failureReason}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Worker Card ─── */

function WorkerCard({
  worker,
  expanded,
  onToggle,
}: {
  worker: SwarmWorkerInfo;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="oa-worker-card">
      <div className="oa-worker-header" onClick={onToggle}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="oa-worker-name">
          {worker.taskTitle || worker.taskId.slice(0, 8)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--oa-text-muted)' }}>
          {worker.stepCount} steps
        </span>
        <span className={`oa-worker-status ${worker.status}`}>
          {worker.status}
        </span>
      </div>
      {expanded && worker.steps.length > 0 && (
        <div className="oa-worker-steps">
          {worker.steps.slice(-15).map((step, i) => (
            <StepItem key={i} step={step} />
          ))}
        </div>
      )}
      {expanded && worker.result && (
        <div style={{ padding: '0 14px 12px' }}>
          <div className="oa-result-box success" style={{ fontSize: 13 }}>
            {worker.result}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step Item ─── */

function StepItem({ step }: { step: ClaudeAgentStep }) {
  return (
    <div className="oa-step-item">
      <span className="oa-step-type">{step.type}</span>
      <span className="oa-step-content">
        {step.toolName && <strong>{step.toolName}: </strong>}
        {step.content?.slice(0, 500)}
      </span>
    </div>
  );
}

/* ─── Status Icon Helper ─── */

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={size} />;
    case 'failed': return <XCircle size={size} />;
    case 'running':
    case 'executing': return <Loader2 size={size} className="oa-spin" />;
    case 'planning': return <Clock size={size} />;
    case 'cancelled': return <XOctagon size={size} />;
    case 'blocked': return <AlertTriangle size={size} />;
    case 'ready': return <Circle size={size} />;
    default: return <Circle size={size} />;
  }
}

/* ─── Helpers ─── */

function groupTasksByStatus(tasks: SwarmTaskInfo[]) {
  const groups: Record<string, SwarmTaskInfo[]> = {};
  for (const task of tasks) {
    if (!groups[task.status]) groups[task.status] = [];
    groups[task.status].push(task);
  }
  return groups;
}
