import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Sparkles, CheckCircle2, Circle, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { Task } from '../../types';
import { Avatar, Badge, Button } from '../ui';
import { format, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';

interface TasksViewProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  selectedTaskId?: string;
}

type TaskGroup = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'no_date';

const priorityConfig = {
  urgent: { color: 'error' as const, icon: AlertCircle },
  high: { color: 'warning' as const, icon: AlertCircle },
  medium: { color: 'info' as const, icon: Circle },
  low: { color: 'default' as const, icon: Circle },
};

const statusIcons = {
  todo: Circle,
  in_progress: Clock,
  review: AlertCircle,
  done: CheckCircle2,
};

function getTaskGroup(task: Task): TaskGroup {
  if (!task.dueDate) return 'no_date';
  if (task.status === 'done') return 'later';
  if (isPast(task.dueDate) && !isToday(task.dueDate)) return 'overdue';
  if (isToday(task.dueDate)) return 'today';
  if (isTomorrow(task.dueDate)) return 'tomorrow';
  if (isThisWeek(task.dueDate)) return 'this_week';
  return 'later';
}

const groupLabels: Record<TaskGroup, string> = {
  overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', later: 'Later', no_date: 'No Due Date',
};

const groupOrder: TaskGroup[] = ['overdue', 'today', 'tomorrow', 'this_week', 'later', 'no_date'];

export function TasksView({ tasks, onTaskSelect, selectedTaskId }: TasksViewProps) {
  const [filter, setFilter] = useState<'all' | 'mine' | 'ai'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<TaskGroup>>(new Set(['overdue', 'today', 'tomorrow']));

  const groupedTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (filter === 'ai') return t.aiGenerated;
      return true;
    });

    const groups = new Map<TaskGroup, Task[]>();
    groupOrder.forEach(g => groups.set(g, []));
    filtered.forEach(task => {
      const group = getTaskGroup(task);
      groups.get(group)?.push(task);
    });

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    groups.forEach((tasks) => {
      tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    });

    return groups;
  }, [tasks, filter]);

  const toggleGroup = (group: TaskGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const aiGeneratedCount = tasks.filter(t => t.aiGenerated).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Tasks</h1>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '0.25rem 0.75rem', borderRadius: 9999 }}>{tasks.filter(t => t.status !== 'done').length} open</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-bg-tertiary)', padding: '0.25rem', borderRadius: 12 }}>
            {(['all', 'mine', 'ai'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  background: filter === f ? 'var(--color-bg-secondary)' : 'transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxShadow: filter === f ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {f === 'ai' && <Sparkles size={12} style={{ color: 'var(--color-ai)' }} />}
                {f === 'all' ? 'All' : f === 'mine' ? 'My Tasks' : 'AI Suggested'}
                {f === 'ai' && aiGeneratedCount > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 5px', background: 'var(--color-ai-muted)', color: 'var(--color-ai)', borderRadius: 9999 }}>{aiGeneratedCount}</span>
                )}
              </button>
            ))}
          </div>
          
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>New Task</Button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {groupOrder.map(group => {
          const groupTasks = groupedTasks.get(group) || [];
          if (groupTasks.length === 0) return null;

          const isExpanded = expandedGroups.has(group);
          const isOverdue = group === 'overdue';

          return (
            <div key={group} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16, overflow: 'hidden' }}>
              <button
                onClick={() => toggleGroup(group)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '1rem',
                  background: 'transparent',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  color: isOverdue ? 'var(--color-error)' : 'inherit',
                }}
              >
                <ChevronRight size={16} style={{ color: 'var(--color-text-tertiary)', transition: 'transform 100ms', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
                <span style={{ fontWeight: 600 }}>{groupLabels[group]}</span>
                <span style={{ fontWeight: 500, color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}>{groupTasks.length}</span>
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {groupTasks.map((task, index) => {
                      const StatusIcon = statusIcons[task.status];
                      const priorityInfo = priorityConfig[task.priority];
                      
                      return (
                        <motion.div
                          key={task.id}
                          onClick={() => onTaskSelect(task)}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            padding: '1rem 1.25rem',
                            cursor: 'pointer',
                            borderTop: '1px solid var(--color-border-subtle)',
                            background: selectedTaskId === task.id ? 'var(--color-bg-selected)' : 'transparent',
                            opacity: task.status === 'done' ? 0.6 : 1,
                          }}
                        >
                          <div style={{ padding: '0.25rem' }}>
                            <StatusIcon size={18} style={{ color: task.status === 'done' ? 'var(--color-success)' : task.status === 'in_progress' ? 'var(--color-info)' : 'var(--color-text-tertiary)' }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 500, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                              {task.aiGenerated && <Sparkles size={12} style={{ color: 'var(--color-ai)' }} />}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              {task.dueDate && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                                  <Calendar size={12} />
                                  {format(task.dueDate, 'MMM d')}
                                </span>
                              )}
                              {task.relatedContact && <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{task.relatedContact.name}</span>}
                              {task.tags?.slice(0, 2).map(tag => <Badge key={tag} variant="default" size="sm">{tag}</Badge>)}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                            <Badge variant={priorityInfo.color} size="sm">{task.priority}</Badge>
                            {task.assignee && <Avatar src={task.assignee.avatar} name={task.assignee.name} size="xs" />}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
