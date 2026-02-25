import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '4rem 2rem',
        minHeight: 300,
      }}
    >
      {icon && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          background: 'var(--color-bg-tertiary)',
          borderRadius: 16,
          marginBottom: '1.5rem',
          color: 'var(--color-text-tertiary)',
        }}>
          {icon}
        </div>
      )}
      <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h3>
      {description && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', maxWidth: 320, marginBottom: '1.5rem' }}>
          {description}
        </p>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
