import { useState } from 'react';
import { createPortal } from 'react-dom';
import './TeamsPage.css';
import './TeamChat.css';
import { useTeams, Team } from '../../hooks/useTeams';
import { useAuth } from '../../contexts/AuthContext';
import { TeamChat } from './TeamChat';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status: 'online' | 'busy' | 'away' | 'offline';
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

// Icons
const Icons = {
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  ),
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  List: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  MoreHorizontal: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Bookmark: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  Target: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  MessageSquare: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Layers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 2,7 12,12 22,7"/>
      <polyline points="2,17 12,22 22,17"/>
      <polyline points="2,12 12,17 22,12"/>
    </svg>
  ),
  Activity: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12,19 5,12 12,5"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
    </svg>
  ),
  ExternalLink: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15,3 21,3 21,9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  ),
};

// Sample members (will be replaced with Firestore data later)
const sampleMembers: TeamMember[] = [];

// Get initials
const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Get avatar color
const getAvatarColor = (name: string) => {
  const colors = [
    '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'
  ];
  return colors[name.length % colors.length];
};

type SidebarTab = 'all-teams' | 'all-people' | 'analytics';
type DetailTab = 'overview' | 'chat' | 'analytics' | 'priorities' | 'team' | 'standup' | 'workload' | 'timesheet';

export function TeamsPage() {
  const { userProfile } = useAuth();
  const { teams, loading: teamsLoading, addTeam } = useTeams();
  
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('all-teams');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamHandle, setNewTeamHandle] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [bookmarkedTeams, setBookmarkedTeams] = useState<Set<string>>(new Set());
  const [notificationTeams, setNotificationTeams] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    setDetailTab('overview');
  };

  const handleBackToList = () => {
    setSelectedTeam(null);
  };

  const handleCreateTeam = async () => {
    if (newTeamName.trim() && !isCreating) {
      setIsCreating(true);
      const { error } = await addTeam({
        name: newTeamName,
        handle: newTeamHandle || undefined,
        description: newTeamDescription || undefined,
      });
      
      if (error) {
        console.error('Error creating team:', error);
      } else {
        setNewTeamName('');
        setNewTeamHandle('');
        setNewTeamDescription('');
        setIsCreateModalOpen(false);
      }
      setIsCreating(false);
    }
  };

  const handleToggleBookmark = (teamId: string) => {
    const newBookmarks = new Set(bookmarkedTeams);
    if (newBookmarks.has(teamId)) {
      newBookmarks.delete(teamId);
    } else {
      newBookmarks.add(teamId);
    }
    setBookmarkedTeams(newBookmarks);
  };

  const handleToggleNotification = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newNotifications = new Set(notificationTeams);
    if (newNotifications.has(teamId)) {
      newNotifications.delete(teamId);
    } else {
      newNotifications.add(teamId);
    }
    setNotificationTeams(newNotifications);
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = sampleMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const detailTabs: { id: DetailTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'chat', label: 'Chat', icon: <Icons.MessageSquare /> },
    { id: 'analytics', label: 'Analytics', icon: <Icons.BarChart /> },
    { id: 'priorities', label: 'Priorities', icon: <Icons.Target /> },
    { id: 'team', label: 'Team', icon: <Icons.Users /> },
    { id: 'standup', label: 'Standup', icon: <Icons.MessageSquare /> },
    { id: 'workload', label: 'Workload', icon: <Icons.Layers /> },
    { id: 'timesheet', label: 'Timesheet', icon: <Icons.Clock /> },
  ];

  return (
    <div className="teams-page">
      {/* Teams Sidebar */}
      <aside className="teams-sidebar">
        <div className="teams-sidebar-header">
          <h2 className="teams-sidebar-title">Teams</h2>
          <button className="teams-create-btn" onClick={() => setIsCreateModalOpen(true)}>
            <Icons.Plus />
            <span>Create</span>
          </button>
        </div>

        <nav className="teams-sidebar-nav">
          <button
            className={`teams-nav-item ${sidebarTab === 'all-teams' ? 'active' : ''}`}
            onClick={() => { setSidebarTab('all-teams'); setSelectedTeam(null); }}
          >
            <Icons.Users />
            <span>All Teams</span>
            <span className="nav-count">{teams.length}</span>
          </button>
          <button
            className={`teams-nav-item ${sidebarTab === 'all-people' ? 'active' : ''}`}
            onClick={() => { setSidebarTab('all-people'); setSelectedTeam(null); }}
          >
            <Icons.User />
            <span>All People</span>
            <span className="nav-count">{sampleMembers.length}</span>
          </button>
          <button
            className={`teams-nav-item ${sidebarTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setSidebarTab('analytics'); setSelectedTeam(null); }}
          >
            <Icons.Activity />
            <span>Analytics</span>
          </button>
        </nav>

        <div className="teams-sidebar-section">
          <h3 className="section-title">My Teams</h3>
          <div className="my-teams-empty">
            <div className="empty-avatars">
              <div className="empty-avatar"></div>
              <div className="empty-avatar highlight"></div>
              <div className="empty-avatar"></div>
            </div>
            <p>Once you join or create a Team you will see it here</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="teams-main">
        {selectedTeam ? (
          /* Team Detail View */
          <div className="team-detail">
            <header className="team-detail-header">
              <div className="team-detail-info">
                <button className="back-btn" onClick={handleBackToList} title="Back to teams">
                  <Icons.ArrowLeft />
                </button>
                <div 
                  className="team-avatar-large" 
                  style={{ backgroundColor: selectedTeam.color }}
                >
                  {selectedTeam.avatar}
                </div>
                <div className="team-header-text">
                  <div className="team-name-row">
                    <h1 className="team-detail-name">{selectedTeam.name}</h1>
                    <span className="team-handle">{selectedTeam.handle}</span>
                    <button 
                      className={`icon-btn-sm ${bookmarkedTeams.has(selectedTeam.id) ? 'active' : ''}`}
                      onClick={() => handleToggleBookmark(selectedTeam.id)}
                      title={bookmarkedTeams.has(selectedTeam.id) ? 'Remove bookmark' : 'Bookmark team'}
                    >
                      <Icons.Bookmark />
                    </button>
                  </div>
                </div>
              </div>
              <button className="add-member-btn" onClick={() => setIsAddMemberModalOpen(true)}>
                <Icons.Plus />
                <span>Add member</span>
              </button>
            </header>

            <nav className="team-detail-tabs">
              {detailTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`detail-tab ${detailTab === tab.id ? 'active' : ''}`}
                  onClick={() => setDetailTab(tab.id)}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="team-detail-content">
              {detailTab === 'overview' && (
                <div className="overview-layout">
                  <div className="overview-main">
                    {/* Description Section */}
                    <div className="overview-card description-card">
                      <p className="placeholder-text">Add Team description, information, and wiki</p>
                    </div>

                    {/* Bookmarks Section */}
                    <div className="overview-card bookmarks-card">
                      <div className="card-header">
                        <h3>Bookmarks</h3>
                        <div className="card-header-actions">
                          <button className="icon-btn-sm" onClick={() => setIsAddBookmarkModalOpen(true)} title="Add bookmark">
                            <Icons.Plus />
                          </button>
                          <button className="visibility-btn" title="Change visibility">
                            <span>Public</span>
                            <Icons.ChevronDown />
                          </button>
                        </div>
                      </div>
                      <div className="bookmarks-empty">
                        <div className="bookmark-icon-large">
                          <Icons.Bookmark />
                          <span className="plus-badge">+</span>
                        </div>
                        <p>Bookmarks make it easy to save ClickUp items or any URL from around the web.</p>
                        <button className="add-bookmark-btn" onClick={() => setIsAddBookmarkModalOpen(true)}>Add Bookmark</button>
                      </div>
                    </div>

                    {/* Feed Section */}
                    <div className="overview-card feed-card">
                      <div className="card-header">
                        <h3>Feed</h3>
                        <div className="card-header-actions">
                          <button className="filter-pill">
                            <span>Filter by type</span>
                            <Icons.ChevronDown />
                          </button>
                          <button className="filter-tag">
                            <span>Subtasks: Shown</span>
                            <Icons.X />
                          </button>
                        </div>
                      </div>
                      <div className="feed-empty">
                        <div className="feed-empty-illustration">
                          <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
                            <rect x="20" y="20" width="80" height="60" rx="8" fill="var(--bg-tertiary)"/>
                            <circle cx="95" cy="75" r="15" fill="var(--accent-purple)" opacity="0.2"/>
                            <path d="M90 75 L95 80 L100 70" stroke="var(--accent-purple)" strokeWidth="2" fill="none"/>
                          </svg>
                        </div>
                        <h4>Nothing to see here</h4>
                        <p>Activity will appear when team members complete tasks</p>
                      </div>
                    </div>
                  </div>

                  <div className="overview-sidebar">
                    {/* Members Card */}
                    <div className="sidebar-card members-card">
                      <div className="card-header">
                        <h3>Members</h3>
                      </div>
                      <button className="add-member-circle" onClick={() => setIsAddMemberModalOpen(true)} title="Add member">
                        <Icons.Plus />
                      </button>
                    </div>

                    {/* Team Analytics Card */}
                    <div className="sidebar-card analytics-card" onClick={() => setDetailTab('analytics')} style={{ cursor: 'pointer' }}>
                      <div className="card-header">
                        <h3>Team Analytics</h3>
                      </div>
                      <div className="analytics-empty">
                        <div className="analytics-icon">
                          <Icons.BarChart />
                        </div>
                        <p>Not enough data.</p>
                      </div>
                    </div>

                    {/* Priorities Promo Card */}
                    <div className="sidebar-card priorities-promo">
                      <div className="priorities-preview">
                        <div className="preview-members">
                          {sampleMembers.slice(0, 2).map(member => (
                            <div key={member.id} className="preview-member">
                              <div 
                                className="preview-avatar"
                                style={{ backgroundColor: getAvatarColor(member.name) }}
                              >
                                {getInitials(member.name)}
                              </div>
                              <div className="preview-info">
                                <span className="preview-name">{member.name}</span>
                                <span className="preview-role">{member.role}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <h4>Stay focused with Priorities</h4>
                      <p>Instantly know what each team member is working on now and what's up next for them.</p>
                      <button className="go-to-priorities-btn" onClick={() => setDetailTab('priorities')}>Go to Priorities</button>
                    </div>

                    {/* Status Card */}
                    <div className="sidebar-card status-card">
                      <div className="status-badges">
                        <span className="status-badge needs-updates">
                          <span className="status-dot"></span>
                          Needs Updates
                          <span className="status-count">5</span>
                        </span>
                        <span className="status-badge closed">
                          <span className="status-dot"></span>
                          Closed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'team' && (
                <div className="team-members-view">
                  <div className="members-header">
                    <h3>Team Members ({sampleMembers.length})</h3>
                    <button className="add-member-btn-sm">
                      <Icons.Plus />
                      <span>Add Member</span>
                    </button>
                  </div>
                  <div className="members-list">
                    {sampleMembers.map(member => (
                      <div key={member.id} className="member-row">
                        <div 
                          className="member-avatar"
                          style={{ backgroundColor: getAvatarColor(member.name) }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-role">{member.role}</span>
                        </div>
                        <span className={`member-status ${member.status}`}>
                          {member.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailTab === 'chat' && selectedTeam && (
                <div className="chat-tab-container">
                  <TeamChat teamId={selectedTeam.id} teamName={selectedTeam.name} />
                </div>
              )}

              {(detailTab === 'analytics' || detailTab === 'priorities' || 
                detailTab === 'standup' || detailTab === 'workload' || detailTab === 'timesheet') && (
                <div className="coming-soon">
                  <div className="coming-soon-icon">
                    {detailTab === 'analytics' && <Icons.BarChart />}
                    {detailTab === 'priorities' && <Icons.Target />}
                    {detailTab === 'standup' && <Icons.MessageSquare />}
                    {detailTab === 'workload' && <Icons.Layers />}
                    {detailTab === 'timesheet' && <Icons.Clock />}
                  </div>
                  <h3>{detailTabs.find(t => t.id === detailTab)?.label}</h3>
                  <p>This feature will be available soon.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Teams List View */
          <>
            <header className="teams-list-header">
              <h1 className="teams-list-title">
                {sidebarTab === 'all-teams' && 'All Teams'}
                {sidebarTab === 'all-people' && 'All People'}
                {sidebarTab === 'analytics' && 'Analytics'}
              </h1>
            </header>

            {sidebarTab === 'all-teams' && (
              <>
                <div className="teams-toolbar">
                  <div className="filter-pills">
                    <button className="filter-pill" title="Filter by member count">
                      <span>Members</span>
                      <Icons.ChevronDown />
                    </button>
                    <button className="filter-pill" title="Filter by creation date">
                      <span>Created</span>
                      <Icons.ChevronDown />
                    </button>
                    <button className="filter-pill" title="Filter by creator">
                      <span>Creator</span>
                      <Icons.ChevronDown />
                    </button>
                    <button className="filter-pill" title="Sort teams">
                      <span>Sort</span>
                      <Icons.ChevronDown />
                    </button>
                  </div>
                  <div className="toolbar-right">
                    {isSearchOpen ? (
                      <div className="search-input-wrapper">
                        <Icons.Search />
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search teams..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                        <button 
                          className="search-close-btn"
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                        >
                          <Icons.X />
                        </button>
                      </div>
                    ) : (
                      <button className="icon-btn-sm" onClick={() => setIsSearchOpen(true)} title="Search teams">
                        <Icons.Search />
                      </button>
                    )}
                    <div className="view-toggle">
                      <button
                        className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                      >
                        <Icons.List />
                      </button>
                      <button
                        className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                      >
                        <Icons.Grid />
                      </button>
                    </div>
                    <button className="create-team-btn" onClick={() => setIsCreateModalOpen(true)}>
                      Create Team
                    </button>
                  </div>
                </div>

                <div className={`teams-grid ${viewMode}`}>
                  {filteredTeams.length === 0 ? (
                    <div className="empty-state">
                      <Icons.Users />
                      <h3>No teams found</h3>
                      <p>{searchQuery ? 'Try a different search term' : 'Create your first team to get started'}</p>
                      <button className="create-team-btn" onClick={() => setIsCreateModalOpen(true)}>
                        Create Team
                      </button>
                    </div>
                  ) : (
                    filteredTeams.map(team => (
                      <div 
                        key={team.id} 
                        className="team-card"
                        onClick={() => handleTeamClick(team)}
                      >
                        <div className="team-card-preview">
                          <div className="preview-content">
                            <div className="preview-lines">
                              <div className="preview-line"></div>
                              <div className="preview-line short"></div>
                              <div className="preview-line medium"></div>
                            </div>
                          </div>
                          <button className="team-card-menu" onClick={(e) => e.stopPropagation()} title="Team options">
                            <Icons.MoreHorizontal />
                          </button>
                        </div>
                        <div className="team-card-info">
                          <div 
                            className="team-card-avatar"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.avatar}
                          </div>
                          <div className="team-card-details">
                            <h3 className="team-card-name">{team.name}</h3>
                            <span className="team-card-members">{team.memberCount} members</span>
                          </div>
                          <div className="team-card-actions">
                            <button 
                              className={`icon-btn-sm ${notificationTeams.has(team.id) ? 'active' : ''}`} 
                              onClick={(e) => handleToggleNotification(team.id, e)}
                              title={notificationTeams.has(team.id) ? 'Notifications on' : 'Turn on notifications'}
                            >
                              <Icons.Bell />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {sidebarTab === 'all-people' && (
              <>
                <div className="teams-toolbar">
                  <div className="filter-pills">
                    <button className="filter-pill" title="Filter by role">
                      <span>Role</span>
                      <Icons.ChevronDown />
                    </button>
                    <button className="filter-pill" title="Filter by status">
                      <span>Status</span>
                      <Icons.ChevronDown />
                    </button>
                  </div>
                  <div className="toolbar-right">
                    {isSearchOpen ? (
                      <div className="search-input-wrapper">
                        <Icons.Search />
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search people..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                        <button 
                          className="search-close-btn"
                          onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}
                        >
                          <Icons.X />
                        </button>
                      </div>
                    ) : (
                      <button className="icon-btn-sm" onClick={() => setIsSearchOpen(true)} title="Search people">
                        <Icons.Search />
                      </button>
                    )}
                  </div>
                </div>
                <div className="people-list">
                  {filteredMembers.length === 0 ? (
                    <div className="empty-state">
                      <Icons.User />
                      <h3>No people found</h3>
                      <p>Try a different search term</p>
                    </div>
                  ) : (
                    filteredMembers.map(member => (
                      <div key={member.id} className="person-card">
                        <div 
                          className="person-avatar"
                          style={{ backgroundColor: getAvatarColor(member.name) }}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div className="person-info">
                          <span className="person-name">{member.name}</span>
                          <span className="person-email">{member.email}</span>
                        </div>
                        <span className="person-role">{member.role}</span>
                        <span className={`person-status ${member.status}`}>
                          {member.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {sidebarTab === 'analytics' && (
              <div className="analytics-view">
                <div className="analytics-empty-state">
                  <Icons.BarChart />
                  <h3>Team Analytics</h3>
                  <p>Analytics will appear once you have teams with activity.</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create Team Modal */}
      {isCreateModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal create-team-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Team</h3>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Team Name</label>
                <input 
                  type="text" 
                  placeholder="Enter team name" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Handle</label>
                <input 
                  type="text" 
                  placeholder="@team-handle" 
                  value={newTeamHandle}
                  onChange={(e) => setNewTeamHandle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea 
                  placeholder="What is this team about?"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreateTeam}
                disabled={!newTeamName.trim()}
              >
                Create Team
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsAddMemberModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Member</h3>
              <button className="modal-close" onClick={() => setIsAddMemberModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter email address" />
              </div>
              <div className="form-group">
                <label>Role (optional)</label>
                <input type="text" placeholder="e.g. Developer, Designer" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsAddMemberModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setIsAddMemberModalOpen(false)}>
                Send Invite
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Bookmark Modal */}
      {isAddBookmarkModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsAddBookmarkModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Bookmark</h3>
              <button className="modal-close" onClick={() => setIsAddBookmarkModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Title</label>
                <input type="text" placeholder="Bookmark title" />
              </div>
              <div className="form-group">
                <label>URL</label>
                <input type="url" placeholder="https://..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsAddBookmarkModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setIsAddBookmarkModalOpen(false)}>
                Add Bookmark
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
