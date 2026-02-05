import { motion } from 'framer-motion';
import { TrendingUp, Users, DollarSign, Calendar, ArrowRight, Sparkles, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Contact, Task, Deal, Activity } from '../../types';
import { Avatar, Badge, Button } from '../ui';
import { format, formatDistanceToNow } from 'date-fns';

interface HomePageProps {
  contacts: Contact[];
  tasks: Task[];
  deals: Deal[];
  activities: Activity[];
  onContactSelect: (contact: Contact) => void;
  onTaskSelect: (task: Task) => void;
  onViewChange: (view: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export function HomePage({ contacts, tasks, deals, activities, onContactSelect, onTaskSelect, onViewChange }: HomePageProps) {
  const pendingTasks = tasks.filter(t => t.status !== 'done').slice(0, 5);
  const upcomingFollowUps = contacts
    .filter(c => c.nextFollowUp)
    .sort((a, b) => (a.nextFollowUp?.getTime() || 0) - (b.nextFollowUp?.getTime() || 0))
    .slice(0, 4);
  
  const totalPipeline = deals
    .filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost')
    .reduce((acc, d) => acc + d.value * (d.probability / 100), 0);

  const aiInsight = {
    title: "Focus on Stripe deal today",
    description: "The Stripe enterprise expansion deal is in final negotiation. Responding to their contract concerns within 24 hours could increase close probability by 15%.",
    action: "View deal details"
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}
    >
      <header>
        <motion.div variants={itemVariants}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Good morning, Sarah</h1>
          <p style={{ fontSize: '1.0625rem', color: 'var(--color-text-tertiary)' }}>Here's what needs your attention today</p>
        </motion.div>
      </header>

      {/* AI Insight Card */}
      <motion.section variants={itemVariants} style={{ background: 'var(--color-ai-muted)', borderRadius: 16, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--color-ai-gradient)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 28, height: 28, background: 'var(--color-ai)', color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} />
          </div>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-ai)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Insight</span>
        </div>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.5rem' }}>{aiInsight.title}</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.625, marginBottom: '1rem', maxWidth: 600 }}>{aiInsight.description}</p>
        <Button variant="ai" size="sm" icon={<ArrowRight size={14} />} iconPosition="right">{aiInsight.action}</Button>
      </motion.section>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {[
          { icon: DollarSign, value: `$${(totalPipeline / 1000000).toFixed(2)}M`, label: 'Weighted Pipeline' },
          { icon: Users, value: contacts.length, label: 'Active Contacts' },
          { icon: CheckCircle2, value: tasks.filter(t => t.status === 'done').length, label: 'Tasks Completed' },
          { icon: TrendingUp, value: deals.filter(d => d.stage === 'closed_won').length, label: 'Deals Won' },
        ].map((stat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16 }}>
            <div style={{ width: 44, height: 44, background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <stat.icon size={18} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 600 }}>{stat.value}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{stat.label}</span>
            </div>
          </div>
        ))}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        {/* Tasks Section */}
        <motion.section variants={itemVariants} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600 }}>
              <Clock size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              Upcoming Tasks
            </h2>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('tasks')}>View all</Button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pendingTasks.map(task => (
              <div
                key={task.id}
                onClick={() => onTaskSelect(task)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.5rem', borderRadius: 8, cursor: 'pointer' }}
              >
                <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                  {(task.priority === 'urgent' || task.priority === 'high') ? (
                    <AlertCircle size={16} style={{ color: 'var(--color-error)' }} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-border-strong)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.25rem' }}>{task.title}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>
                    {task.dueDate && format(task.dueDate, 'MMM d')}
                    {task.relatedContact && ` • ${task.relatedContact.name}`}
                  </span>
                </div>
                {task.aiGenerated && <Sparkles size={12} style={{ color: 'var(--color-ai)' }} />}
              </div>
            ))}
          </div>
        </motion.section>

        {/* Follow-ups Section */}
        <motion.section variants={itemVariants} style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600 }}>
              <Calendar size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              Upcoming Follow-ups
            </h2>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('contacts')}>View all</Button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {upcomingFollowUps.map(contact => (
              <div
                key={contact.id}
                onClick={() => onContactSelect(contact)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.5rem', borderRadius: 8, cursor: 'pointer' }}
              >
                <Avatar src={contact.avatar} name={contact.name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500 }}>{contact.name}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{contact.company}</span>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-accent)' }}>
                  {contact.nextFollowUp && format(contact.nextFollowUp, 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Activity Section */}
        <motion.section variants={itemVariants} style={{ gridColumn: 'span 2', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16, padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Activity</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            {activities.slice(0, 6).map(activity => (
              <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 8 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  background: activity.type === 'ai_insight' ? 'var(--color-ai-muted)' : activity.type === 'task_completed' ? 'var(--color-success-muted)' : 'var(--color-bg-tertiary)',
                  color: activity.type === 'ai_insight' ? 'var(--color-ai)' : activity.type === 'task_completed' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                }}>
                  {activity.type === 'ai_insight' && <Sparkles size={12} />}
                  {activity.type === 'email' && '✉'}
                  {activity.type === 'call' && '📞'}
                  {activity.type === 'meeting' && '📅'}
                  {activity.type === 'note' && '📝'}
                  {activity.type === 'task_completed' && <CheckCircle2 size={12} />}
                  {activity.type === 'deal_updated' && <TrendingUp size={12} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activity.title}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
