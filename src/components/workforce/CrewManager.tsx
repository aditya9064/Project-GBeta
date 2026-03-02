import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  X,
  Crown,
  Wrench,
  Eye,
  ShieldCheck,
  Trash2,
  Edit3,
  Save,
  AlertCircle,
  Loader2,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  CrewService,
  type Crew,
  type CrewMember,
  type CrewMemberRole,
} from '../../services/workforce';
import { useAgents } from '../../contexts/AgentContext';

interface CrewManagerProps {
  selectedCrewId?: string | null;
  onCrewSelect?: (crewId: string | null) => void;
  onCrewsChange?: () => void;
}

type ManagerView = 'list' | 'create' | 'edit';

export function CrewManager({
  selectedCrewId,
  onCrewSelect,
  onCrewsChange,
}: CrewManagerProps) {
  const { agents } = useAgents();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ManagerView>('list');
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [] as CrewMember[],
    settings: CrewService.getDefaultSettings(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCrews = useCallback(async () => {
    try {
      const data = await CrewService.list();
      setCrews(data);
    } catch (err) {
      console.error('Failed to load crews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrews();
  }, [loadCrews]);

  useEffect(() => {
    if (selectedCrewId) {
      const crew = crews.find(c => c.id === selectedCrewId);
      if (crew) {
        handleEditCrew(crew);
      }
    }
  }, [selectedCrewId, crews]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      members: [],
      settings: CrewService.getDefaultSettings(),
    });
    setEditingCrew(null);
    setError(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setView('create');
    onCrewSelect?.(null);
  };

  const handleEditCrew = (crew: Crew) => {
    setEditingCrew(crew);
    setFormData({
      name: crew.name,
      description: crew.description,
      members: [...crew.members],
      settings: { ...crew.settings },
    });
    setView('edit');
    onCrewSelect?.(crew.id);
  };

  const handleCancel = () => {
    resetForm();
    setView('list');
    onCrewSelect?.(null);
  };

  const handleAddMember = (agentId: string, agentName: string, role: CrewMemberRole) => {
    if (formData.members.some(m => m.agentId === agentId)) return;
    
    const member: CrewMember = {
      agentId,
      agentName,
      role,
      joinedAt: new Date().toISOString(),
      permissions: CrewService.getDefaultPermissions(role),
    };
    
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, member],
    }));
  };

  const handleRemoveMember = (agentId: string) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter(m => m.agentId !== agentId),
    }));
  };

  const handleUpdateMemberRole = (agentId: string, role: CrewMemberRole) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.map(m =>
        m.agentId === agentId
          ? { ...m, role, permissions: CrewService.getDefaultPermissions(role) }
          : m
      ),
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Crew name is required');
      return;
    }
    
    const managerCount = formData.members.filter(m => m.role === 'manager').length;
    if (managerCount === 0) {
      setError('Crew must have at least one manager');
      return;
    }
    
    const specialistCount = formData.members.filter(m => m.role === 'specialist').length;
    if (specialistCount === 0) {
      setError('Crew must have at least one specialist');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      if (editingCrew) {
        await CrewService.update(editingCrew.id, {
          name: formData.name,
          description: formData.description,
          settings: formData.settings,
        });
        
        for (const member of formData.members) {
          if (!editingCrew.members.some(m => m.agentId === member.agentId)) {
            await CrewService.addMember(editingCrew.id, {
              agentId: member.agentId,
              agentName: member.agentName,
              role: member.role,
              permissions: member.permissions,
            });
          } else {
            await CrewService.updateMember(editingCrew.id, member.agentId, {
              role: member.role,
              permissions: member.permissions,
            });
          }
        }
        
        for (const oldMember of editingCrew.members) {
          if (!formData.members.some(m => m.agentId === oldMember.agentId)) {
            await CrewService.removeMember(editingCrew.id, oldMember.agentId);
          }
        }
      } else {
        await CrewService.create({
          name: formData.name,
          description: formData.description,
          members: formData.members,
          settings: formData.settings,
        });
      }
      
      await loadCrews();
      onCrewsChange?.();
      resetForm();
      setView('list');
    } catch (err: any) {
      setError(err.message || 'Failed to save crew');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (crewId: string) => {
    if (!confirm('Are you sure you want to archive this crew?')) return;
    
    try {
      await CrewService.archive(crewId);
      await loadCrews();
      onCrewsChange?.();
      if (selectedCrewId === crewId) {
        onCrewSelect?.(null);
        setView('list');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to archive crew');
    }
  };

  const getRoleIcon = (role: CrewMemberRole) => {
    switch (role) {
      case 'manager': return <Crown size={14} />;
      case 'specialist': return <Wrench size={14} />;
      case 'reviewer': return <Eye size={14} />;
      case 'qa': return <ShieldCheck size={14} />;
    }
  };

  const availableAgents = agents.filter(
    a => !formData.members.some(m => m.agentId === a.id)
  );

  if (loading) {
    return (
      <div className="crew-manager-page">
        <div className="workforce-loading">
          <Loader2 size={32} className="spin" />
          <p>Loading crews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="crew-manager-page">
      {/* List View */}
      {view === 'list' && (
        <>
          <div className="crew-manager-header">
            <h2>Manage Crews</h2>
            <button className="workforce-btn-primary" onClick={handleCreateNew}>
              <Plus size={16} />
              Create Crew
            </button>
          </div>

          {crews.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 24px' }}>
              <Users size={48} />
              <p>No Crews Yet</p>
              <span>Create your first crew to organize agents into teams</span>
              <button 
                className="workforce-btn-primary"
                onClick={handleCreateNew}
                style={{ marginTop: 20 }}
              >
                <Plus size={16} />
                Create First Crew
              </button>
            </div>
          ) : (
            <div className="crew-list-grid">
              {crews.map(crew => (
                <div key={crew.id} className="crew-detail-card">
                  <div className="crew-detail-header">
                    <div className="crew-detail-info">
                      <h3>{crew.name}</h3>
                      <p>{crew.description || 'No description'}</p>
                    </div>
                    <div className="crew-detail-actions">
                      <button 
                        className="workforce-btn-icon"
                        onClick={() => handleEditCrew(crew)}
                        title="Edit crew"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        className="workforce-btn-icon"
                        onClick={() => handleArchive(crew.id)}
                        title="Archive crew"
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="crew-members-section">
                    <h4>Members ({crew.members.length})</h4>
                    <div className="crew-member-list">
                      {crew.members.map(member => (
                        <div key={member.agentId} className="crew-member-item">
                          <div className="crew-member-info">
                            <span className={`crew-member-role ${member.role}`}>
                              {getRoleIcon(member.role)} {member.role}
                            </span>
                            <span className="crew-member-name">{member.agentName}</span>
                          </div>
                        </div>
                      ))}
                      {crew.members.length === 0 && (
                        <span style={{ color: '#9ca3af', fontSize: 13 }}>No members</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="crew-stats" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <span><Zap size={12} /> {crew.stats.totalExecutions} runs</span>
                    <span>
                      <CheckCircle2 size={12} />
                      {crew.stats.totalExecutions > 0
                        ? `${Math.round((crew.stats.successfulExecutions / crew.stats.totalExecutions) * 100)}%`
                        : '-'} success
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit View */}
      {(view === 'create' || view === 'edit') && (
        <>
          <div className="crew-manager-header">
            <h2>{editingCrew ? 'Edit Crew' : 'Create New Crew'}</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="workforce-btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button 
                className="workforce-btn-primary" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Crew'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10, 
              padding: '12px 16px', 
              background: 'rgba(239,68,68,0.1)', 
              borderRadius: 10, 
              color: '#ef4444',
              marginBottom: 20 
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Left Column - Basic Info */}
            <div className="workforce-section">
              <h3>Basic Information</h3>
              
              <div className="feedback-form-group">
                <label className="feedback-form-label">Crew Name *</label>
                <input
                  type="text"
                  className="feedback-select"
                  placeholder="e.g., Sales Team"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="feedback-form-group">
                <label className="feedback-form-label">Description</label>
                <textarea
                  className="feedback-textarea"
                  placeholder="What does this crew do?"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="feedback-form-group">
                <label className="feedback-form-label">Supervision Level</label>
                <select
                  className="feedback-select"
                  value={formData.settings.supervisionLevel}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, supervisionLevel: e.target.value as any }
                  }))}
                >
                  <option value="none">None - Full autonomy</option>
                  <option value="light">Light - Review failures only</option>
                  <option value="strict">Strict - Review all outputs</option>
                </select>
              </div>
            </div>

            {/* Right Column - Members */}
            <div className="workforce-section">
              <h3>Crew Members</h3>
              
              {/* Current Members */}
              <div style={{ marginBottom: 20 }}>
                <label className="feedback-form-label" style={{ marginBottom: 12, display: 'block' }}>
                  Assigned Members ({formData.members.length})
                </label>
                {formData.members.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: 13, padding: '16px 0' }}>
                    No members assigned yet. Add agents below.
                  </div>
                ) : (
                  <div className="crew-member-list">
                    {formData.members.map(member => (
                      <div key={member.agentId} className="crew-member-item">
                        <div className="crew-member-info">
                          <select
                            className={`crew-member-role ${member.role}`}
                            value={member.role}
                            onChange={e => handleUpdateMemberRole(member.agentId, e.target.value as CrewMemberRole)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 11,
                              textTransform: 'uppercase',
                            }}
                          >
                            <option value="manager">Manager</option>
                            <option value="specialist">Specialist</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="qa">QA</option>
                          </select>
                          <span className="crew-member-name">{member.agentName}</span>
                        </div>
                        <button
                          className="workforce-btn-icon"
                          onClick={() => handleRemoveMember(member.agentId)}
                          style={{ width: 28, height: 28, color: '#ef4444' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Members */}
              <div>
                <label className="feedback-form-label" style={{ marginBottom: 12, display: 'block' }}>
                  Add Agents
                </label>
                {availableAgents.length === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: 13 }}>
                    All agents have been assigned
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableAgents.slice(0, 6).map(agent => (
                      <div 
                        key={agent.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          background: '#f8f8fc',
                          borderRadius: 8,
                        }}
                      >
                        <span style={{ fontSize: 14, color: '#1a1a2e' }}>{agent.name}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="workforce-btn-secondary workforce-btn-small"
                            onClick={() => handleAddMember(agent.id, agent.name, 'manager')}
                            title="Add as Manager"
                          >
                            <Crown size={12} /> Manager
                          </button>
                          <button
                            className="workforce-btn-secondary workforce-btn-small"
                            onClick={() => handleAddMember(agent.id, agent.name, 'specialist')}
                            title="Add as Specialist"
                          >
                            <Wrench size={12} /> Specialist
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
