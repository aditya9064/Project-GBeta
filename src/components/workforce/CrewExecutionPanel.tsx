/* ═══════════════════════════════════════════════════════════
   Crew Execution Panel — Run crews with goals and watch progress
   
   Allows users to:
   - Select a crew and input a goal
   - Watch real-time task decomposition and delegation
   - See specialist results and reviewer feedback
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Crown,
  Wrench,
  Eye,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  Users,
  Zap,
  Target,
  ListChecks,
} from 'lucide-react';
import { CrewService, type Crew, type CrewMemberRole } from '../../services/workforce';
import { CrewExecutor, type CrewExecutionResult } from '../../services/workforce/crewExecutor';
import { useExecutionStream, type ExecutionEvent } from '../../hooks/useExecutionStream';

interface CrewExecutionPanelProps {
  onClose?: () => void;
}

type ExecutionPhase = 'idle' | 'decomposing' | 'executing' | 'aggregating' | 'reviewing' | 'completed' | 'failed';

interface TaskProgress {
  description: string;
  assignedTo?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export function CrewExecutionPanel({ onClose }: CrewExecutionPanelProps) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');
  const [goal, setGoal] = useState('');
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [phase, setPhase] = useState<ExecutionPhase>('idle');
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [result, setResult] = useState<CrewExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const { events, connected } = useExecutionStream({
    onEvent: (event) => {
      setLogs(prev => [...prev, `[${event.type}] ${event.nodeName || event.message || ''}`]);
    },
  });

  useEffect(() => {
    loadCrews();
  }, []);

  const loadCrews = async () => {
    try {
      const data = await CrewService.list();
      setCrews(data.filter(c => c.status === 'active' && c.members.length >= 2));
    } catch (err) {
      console.error('Failed to load crews:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedCrew = crews.find(c => c.id === selectedCrewId);

  const getRoleIcon = (role: CrewMemberRole) => {
    switch (role) {
      case 'manager': return <Crown size={14} />;
      case 'specialist': return <Wrench size={14} />;
      case 'reviewer': return <Eye size={14} />;
      case 'qa': return <ShieldCheck size={14} />;
    }
  };

  const handleExecute = async () => {
    if (!selectedCrewId || !goal.trim()) return;

    setExecuting(true);
    setError(null);
    setResult(null);
    setTasks([]);
    setLogs([]);
    setPhase('decomposing');

    try {
      setLogs(prev => [...prev, '🚀 Starting crew execution...']);
      
      // Parse input data if provided
      let parsedInput: Record<string, unknown> | undefined;
      if (inputData.trim()) {
        try {
          parsedInput = JSON.parse(inputData);
        } catch {
          parsedInput = { rawInput: inputData };
        }
      }

      setLogs(prev => [...prev, '📋 Decomposing goal into tasks...']);

      // Execute the crew
      const execResult = await CrewExecutor.execute({
        crewId: selectedCrewId,
        goal: goal.trim(),
        inputData: parsedInput,
        onPhaseChange: (newPhase) => {
          setPhase(newPhase as ExecutionPhase);
          setLogs(prev => [...prev, `📌 Phase: ${newPhase}`]);
        },
        onTaskUpdate: (taskIdx, status, result) => {
          setTasks(prev => {
            const updated = [...prev];
            if (updated[taskIdx]) {
              updated[taskIdx] = { ...updated[taskIdx], status, result };
            }
            return updated;
          });
        },
        onTasksDecomposed: (decomposedTasks) => {
          setTasks(decomposedTasks.map(t => ({
            description: t.description,
            status: 'pending',
          })));
          setPhase('executing');
        },
      });

      setResult(execResult);
      setPhase(execResult.success ? 'completed' : 'failed');
      setLogs(prev => [...prev, execResult.success ? '✅ Execution completed!' : `❌ Execution failed: ${execResult.error}`]);

    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setPhase('failed');
      setLogs(prev => [...prev, `❌ Error: ${err.message}`]);
    } finally {
      setExecuting(false);
    }
  };

  const getPhaseLabel = (p: ExecutionPhase): string => {
    switch (p) {
      case 'idle': return 'Ready';
      case 'decomposing': return 'Manager analyzing goal...';
      case 'executing': return 'Specialists working...';
      case 'aggregating': return 'Manager aggregating results...';
      case 'reviewing': return 'Reviewer checking output...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
    }
  };

  if (loading) {
    return (
      <div className="workforce-section" style={{ minHeight: 400 }}>
        <div className="workforce-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading crews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="crew-execution-panel">
      <div className="workforce-section">
        <div className="workforce-section-header">
          <h3><Zap size={18} /> Execute Crew Task</h3>
          {connected && (
            <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} />
              Live
            </span>
          )}
        </div>

        {/* Crew Selection */}
        <div className="feedback-form-group">
          <label className="feedback-form-label">Select Crew</label>
          <select
            className="feedback-select"
            value={selectedCrewId}
            onChange={e => setSelectedCrewId(e.target.value)}
            disabled={executing}
          >
            <option value="">Choose a crew...</option>
            {crews.map(crew => (
              <option key={crew.id} value={crew.id}>
                {crew.name} ({crew.members.length} members)
              </option>
            ))}
          </select>
        </div>

        {/* Selected Crew Members */}
        {selectedCrew && (
          <div style={{ marginBottom: 20 }}>
            <label className="feedback-form-label" style={{ marginBottom: 8, display: 'block' }}>
              Crew Members
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedCrew.members.map(member => (
                <div 
                  key={member.agentId}
                  className="crew-member"
                  style={{ 
                    background: member.role === 'manager' ? 'rgba(224,122,58,0.1)' : '#f8f8fc',
                    borderColor: member.role === 'manager' ? 'rgba(224,122,58,0.3)' : 'transparent',
                  }}
                >
                  {getRoleIcon(member.role)}
                  <span>{member.agentName}</span>
                  <span style={{ 
                    fontSize: 10, 
                    textTransform: 'uppercase', 
                    color: '#9ca3af',
                    marginLeft: 4,
                  }}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goal Input */}
        <div className="feedback-form-group">
          <label className="feedback-form-label">
            <Target size={14} style={{ marginRight: 6 }} />
            Goal
          </label>
          <textarea
            className="feedback-textarea"
            placeholder="What do you want this crew to accomplish? Be specific..."
            value={goal}
            onChange={e => setGoal(e.target.value)}
            disabled={executing}
            rows={3}
          />
        </div>

        {/* Optional Input Data */}
        <div className="feedback-form-group">
          <label className="feedback-form-label">
            Input Data (optional, JSON or text)
          </label>
          <textarea
            className="feedback-textarea"
            placeholder='{"url": "https://example.com", "keywords": ["sales", "leads"]}'
            value={inputData}
            onChange={e => setInputData(e.target.value)}
            disabled={executing}
            rows={2}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {/* Execute Button */}
        <button
          className="workforce-btn-primary"
          onClick={handleExecute}
          disabled={!selectedCrewId || !goal.trim() || executing}
          style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
        >
          {executing ? (
            <>
              <Loader2 size={16} className="spin" />
              {getPhaseLabel(phase)}
            </>
          ) : (
            <>
              <Play size={16} />
              Execute Crew
            </>
          )}
        </button>

        {error && (
          <div style={{ 
            marginTop: 16, 
            padding: '12px 16px', 
            background: 'rgba(239,68,68,0.1)', 
            borderRadius: 10, 
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}
      </div>

      {/* Execution Progress */}
      {(executing || result) && (
        <div className="workforce-section" style={{ marginTop: 20 }}>
          <div className="workforce-section-header">
            <h3><ListChecks size={18} /> Execution Progress</h3>
            <span style={{ 
              fontSize: 12, 
              padding: '4px 10px', 
              borderRadius: 6,
              background: phase === 'completed' ? 'rgba(16,185,129,0.1)' : 
                         phase === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(224,122,58,0.1)',
              color: phase === 'completed' ? '#10b981' : 
                     phase === 'failed' ? '#ef4444' : '#e07a3a',
            }}>
              {getPhaseLabel(phase)}
            </span>
          </div>

          {/* Tasks */}
          {tasks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label className="feedback-form-label" style={{ marginBottom: 12, display: 'block' }}>
                Tasks ({tasks.filter(t => t.status === 'completed').length}/{tasks.length} completed)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map((task, i) => (
                  <div 
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: '#f8f8fc',
                      borderRadius: 8,
                    }}
                  >
                    {task.status === 'completed' && <CheckCircle2 size={16} style={{ color: '#10b981' }} />}
                    {task.status === 'failed' && <XCircle size={16} style={{ color: '#ef4444' }} />}
                    {task.status === 'running' && <Loader2 size={16} className="spin" style={{ color: '#e07a3a' }} />}
                    {task.status === 'pending' && <ChevronRight size={16} style={{ color: '#9ca3af' }} />}
                    <span style={{ flex: 1, fontSize: 13, color: '#3a3a52' }}>
                      {task.description}
                    </span>
                    {task.assignedTo && (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {task.assignedTo}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          <div>
            <label className="feedback-form-label" style={{ marginBottom: 8, display: 'block' }}>
              Execution Log
            </label>
            <div 
              style={{
                background: '#1a1a2e',
                borderRadius: 8,
                padding: 16,
                maxHeight: 200,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#a0a0b0',
              }}
            >
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <span style={{ color: '#6a6a80' }}>[{new Date().toLocaleTimeString()}]</span> {log}
                </div>
              ))}
              {logs.length === 0 && (
                <span style={{ color: '#6a6a80' }}>Waiting for execution...</span>
              )}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div style={{ marginTop: 20 }}>
              <label className="feedback-form-label" style={{ marginBottom: 8, display: 'block' }}>
                Result
              </label>
              <div 
                style={{
                  background: result.success ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                  border: `1px solid ${result.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                {result.success ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                      <span style={{ fontWeight: 600, color: '#10b981' }}>Success</span>
                      <span style={{ fontSize: 12, color: '#6a6a80' }}>
                        {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : ''}
                      </span>
                    </div>
                    <pre style={{ 
                      background: '#f8f8fc', 
                      padding: 12, 
                      borderRadius: 6, 
                      fontSize: 12, 
                      overflow: 'auto',
                      maxHeight: 200,
                    }}>
                      {JSON.stringify(result.output, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <XCircle size={18} style={{ color: '#ef4444' }} />
                    <span style={{ color: '#ef4444' }}>{result.error || 'Execution failed'}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {crews.length === 0 && (
        <div className="empty-state" style={{ marginTop: 20 }}>
          <Users size={40} />
          <p>No Eligible Crews</p>
          <span>Create a crew with at least one manager and one specialist to execute tasks.</span>
        </div>
      )}
    </div>
  );
}
