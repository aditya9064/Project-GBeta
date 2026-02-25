import { motion } from 'framer-motion';
import { X, Mail, Phone, Building2, Calendar, Sparkles, Clock } from 'lucide-react';
import { Contact, Company, Task } from '../../types';
import { Avatar, Badge, IconButton, Button } from '../ui';
import { format } from 'date-fns';

interface DetailPanelProps {
  item: Contact | Company | Task;
  onClose: () => void;
}

function isContact(item: Contact | Company | Task): item is Contact {
  return 'email' in item && 'stage' in item;
}

function isTask(item: Contact | Company | Task): item is Task {
  return 'priority' in item && 'status' in item && 'title' in item;
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
    customer: 'success', prospect: 'info', lead: 'warning', churned: 'error',
    active: 'success', inactive: 'default', done: 'success', in_progress: 'info', todo: 'default', review: 'warning',
  };
  return variants[status] || 'default';
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
    urgent: 'error', high: 'warning', medium: 'info', low: 'default',
  };
  return variants[priority] || 'default';
}

export function DetailPanel({ item, onClose }: DetailPanelProps) {
  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 420,
        background: 'var(--color-bg-secondary)',
        borderLeft: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 400,
        boxShadow: 'var(--shadow-xl)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <IconButton aria-label="Close panel" onClick={onClose}><X size={18} /></IconButton>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {isContact(item) && <ContactDetail contact={item} />}
        {isTask(item) && <TaskDetail task={item} />}
      </div>
    </motion.aside>
  );
}

function ContactDetail({ contact }: { contact: Contact }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <Avatar src={contact.avatar} name={contact.name} size="xl" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.25rem' }}>{contact.name}</h1>
        {contact.title && contact.company && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            {contact.title} at {contact.company}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Badge variant={getStatusBadge(contact.status)} dot>{contact.status}</Badge>
          <Badge variant="default">{contact.stage}</Badge>
        </div>
      </div>

      {contact.aiSummary && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={16} style={{ color: 'var(--color-ai)' }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>AI Summary</h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.625, padding: '1rem', background: 'var(--color-ai-muted)', borderRadius: 12 }}>
            {contact.aiSummary}
          </p>
          {contact.aiInsights && (
            <ul style={{ listStyle: 'none', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {contact.aiInsights.map((insight, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-ai)', marginTop: 8, flexShrink: 0 }} />
                  {insight}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h3 style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Contact</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <Mail size={16} style={{ color: 'var(--color-text-tertiary)' }} />
            <a href={`mailto:${contact.email}`} style={{ color: 'var(--color-accent)' }}>{contact.email}</a>
          </div>
          {contact.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <Phone size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <a href={`tel:${contact.phone}`} style={{ color: 'var(--color-accent)' }}>{contact.phone}</a>
            </div>
          )}
          {contact.company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <Building2 size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span>{contact.company}</span>
            </div>
          )}
        </div>
      </section>

      {contact.value && (
        <section>
          <h3 style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Deal Value</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>${contact.value.toLocaleString()}</p>
        </section>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)', marginTop: 'auto' }}>
        <Button variant="primary" icon={<Mail size={16} />} fullWidth>Send Email</Button>
        <Button variant="secondary" icon={<Calendar size={16} />} fullWidth>Schedule</Button>
      </div>
    </>
  );
}

function TaskDetail({ task }: { task: Task }) {
  return (
    <>
      <div style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <h1 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.75rem', lineHeight: 1.375 }}>{task.title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Badge variant={getStatusBadge(task.status)} dot>{task.status.replace('_', ' ')}</Badge>
          <Badge variant={getPriorityBadge(task.priority)}>{task.priority}</Badge>
        </div>
      </div>

      {task.aiGenerated && task.aiReason && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={16} style={{ color: 'var(--color-ai)' }} />
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Why this task?</h3>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.625, padding: '1rem', background: 'var(--color-ai-muted)', borderRadius: 12 }}>
            {task.aiReason}
          </p>
        </section>
      )}

      {task.description && (
        <section>
          <h3 style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Description</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.625 }}>{task.description}</p>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {task.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <Calendar size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span>{format(task.dueDate, 'EEEE, MMMM d')}</span>
            </div>
          )}
          {task.assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              <Avatar src={task.assignee.avatar} name={task.assignee.name} size="xs" />
              <span>{task.assignee.name}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            <Clock size={16} style={{ color: 'var(--color-text-tertiary)' }} />
            <span>Created {format(task.createdAt, 'MMM d, yyyy')}</span>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border-subtle)', marginTop: 'auto' }}>
        {task.status !== 'done' && <Button variant="primary" fullWidth>Mark Complete</Button>}
        <Button variant="secondary" fullWidth>Edit Task</Button>
      </div>
    </>
  );
}
