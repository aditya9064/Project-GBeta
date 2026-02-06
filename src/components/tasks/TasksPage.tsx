

port { useState } from 'react';
import { createPortal } from 'react-dom';
import './TasksPage.css';
import { useTasks, Task, TaskStatus, TaskPriority } from '../../hooks/useTasks';

// Icons
const Icons = {
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Circle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  Flag: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  ),
  MoreHorizontal: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,9 12,15 18,9"/>
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
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
    </svg>
  ),
};

const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'TO DO', color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.1)' },
  in_progress: { label: 'IN PROGRESS', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  review: { label: 'REVIEW', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' },
  done: { label: 'DONE', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#9CA3AF' },
  normal: { label: 'Normal', color: '#3B82F6' },
  high: { label: 'High', color: '#F59E0B' },
  urgent: { label: 'Urgent', color: '#EF4444' },
};

export function TasksPage() {
  const { tasks, loading, addTask, updateTask, deleteTask, getTasksByStatus } = useTasks();
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('normal');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedStatuses, setExpandedStatuses] = useState<Set<TaskStatus>>(
    new Set(['todo', 'in_progress', 'review', 'done'])
  );
  const [searchQuery, setSearchQuery] = useState('');

  const tasksByStatus = getTasksByStatus();

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || isCreating) return;
    
    setIsCreating(true);
    const { error } = await addTask({
      title: newTaskTitle,
      description: newTaskDescription,
      priority: newTaskPriority,
    });

    if (!error) {
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('normal');
      setIsAddModalOpen(false);
    }
    setIsCreating(false);
  };

  const handleQuickAddTask = async (status: TaskStatus) => {
    const title = prompt('Task name:');
    if (!title?.trim()) return;
    
    await addTask({ title, status });
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('Delete this task?')) {
      await deleteTask(taskId);
    }
  };

  const toggleStatusExpanded = (status: TaskStatus) => {
    const newExpanded = new Set(expandedStatuses);
    if (newExpanded.has(status)) {
      newExpanded.delete(status);
    } else {
      newExpanded.add(status);
    }
    setExpandedStatuses(newExpanded);
  };

  const filteredTasks = (statusTasks: Task[]) => {
    if (!searchQuery) return statusTasks;
    return statusTasks.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const renderTaskRow = (task: Task) => (
    <div key={task.id} className="task-row">
      <button 
        className={`task-status-btn ${task.status}`}
        onClick={() => handleStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
        title={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
      >
        {task.status === 'done' ? <Icons.Check /> : <Icons.Circle />}
      </button>
      
      <div className="task-content">
        <span className={`task-title ${task.status === 'done' ? 'completed' : ''}`}>
          {task.title}
        </span>
        {task.description && (
          <span className="task-description">{task.description}</span>
        )}
      </div>

      <div className="task-meta">
        {task.dueDate && (
          <span className="task-due-date">
            <Icons.Clock />
            {task.dueDate.toLocaleDateString()}
          </span>
        )}
        <span className={`task-priority priority-${task.priority}`} title={`Priority: ${priorityConfig[task.priority].label}`}>
          <Icons.Flag />
        </span>
      </div>

      <div className="task-actions">
        <button className="task-action-btn" onClick={() => handleDeleteTask(task.id)} title="Delete task">
          <Icons.Trash />
        </button>
      </div>
    </div>
  );

  const renderStatusSection = (status: TaskStatus) => {
    const config = statusConfig[status];
    const statusTasks = filteredTasks(tasksByStatus[status]);
    const isExpanded = expandedStatuses.has(status);

    return (
      <div key={status} className="status-section">
        <div 
          className="status-header"
          onClick={() => toggleStatusExpanded(status)}
        >
          <div className="status-header-left">
            <button className={`expand-btn ${isExpanded ? 'expanded' : ''}`}>
              <Icons.ChevronDown />
            </button>
            <span 
              className="status-indicator" 
              style={{ backgroundColor: config.color }}
            />
            <span className="status-label">{config.label}</span>
            <span className="status-count">{statusTasks.length}</span>
          </div>
        </div>

        {isExpanded && (
          <div className="status-tasks">
            {statusTasks.map(renderTaskRow)}
            <button 
              className="add-task-inline"
              onClick={() => handleQuickAddTask(status)}
            >
              <Icons.Plus />
              <span>Add Task</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tasks-page">
        <div className="tasks-loading">
          <div className="loading-spinner" />
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      {/* Header */}
      <header className="tasks-header">
        <div className="tasks-header-left">
          <h1 className="tasks-title">My Tasks</h1>
          <span className="tasks-count">{tasks.length} tasks</span>
        </div>
        <div className="tasks-header-right">
          <div className="search-box">
            <Icons.Search />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <Icons.List />
            </button>
            <button 
              className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
              title="Board view"
            >
              <Icons.Grid />
            </button>
          </div>
          <button className="add-task-btn" onClick={() => setIsAddModalOpen(true)}>
            <Icons.Plus />
            <span>Add Task</span>
          </button>
        </div>
      </header>

      {/* Task List */}
      <div className={`tasks-content ${viewMode}`}>
        {viewMode === 'list' ? (
          <div className="tasks-list">
            {(['todo', 'in_progress', 'review', 'done'] as TaskStatus[]).map(renderStatusSection)}
          </div>
        ) : (
          <div className="tasks-board">
            {(['todo', 'in_progress', 'review', 'done'] as TaskStatus[]).map(status => {
              const config = statusConfig[status];
              const statusTasks = filteredTasks(tasksByStatus[status]);
              
              return (
                <div key={status} className="board-column">
                  <div className="board-column-header" style={{ borderTopColor: config.color }}>
                    <span className="status-label">{config.label}</span>
                    <span className="status-count">{statusTasks.length}</span>
                  </div>
                  <div className="board-column-tasks">
                    {statusTasks.map(task => (
                      <div key={task.id} className="board-task-card">
                        <div className="board-task-title">{task.title}</div>
                        {task.description && (
                          <div className="board-task-description">{task.description}</div>
                        )}
                        <div className="board-task-footer">
                          <span className={`task-priority priority-${task.priority}`}>
                            <Icons.Flag />
                          </span>
                          {task.dueDate && (
                            <span className="task-due-date">
                              <Icons.Clock />
                              {task.dueDate.toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <button 
                      className="add-task-inline board"
                      onClick={() => handleQuickAddTask(status)}
                    >
                      <Icons.Plus />
                      <span>Add Task</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal add-task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Task</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Task Name</label>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  placeholder="Add more details..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <div className="priority-options">
                  {(['low', 'normal', 'high', 'urgent'] as TaskPriority[]).map(priority => (
                    <button
                      key={priority}
                      className={`priority-option ${newTaskPriority === priority ? 'active' : ''}`}
                      style={{ 
                        borderColor: newTaskPriority === priority ? priorityConfig[priority].color : undefined,
                        color: newTaskPriority === priority ? priorityConfig[priority].color : undefined,
                      }}
                      onClick={() => setNewTaskPriority(priority)}
                    >
                      <Icons.Flag />
                      {priorityConfig[priority].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}



