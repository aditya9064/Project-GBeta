type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'ai';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' },
  success: { bg: 'var(--color-success-muted)', color: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-muted)', color: 'var(--color-warning)' },
  error: { bg: 'var(--color-error-muted)', color: 'var(--color-error)' },
  info: { bg: 'var(--color-info-muted)', color: 'var(--color-info)' },
  accent: { bg: 'var(--color-accent-muted)', color: 'var(--color-accent)' },
  ai: { bg: 'var(--color-ai-muted)', color: 'var(--color-ai)' },
};

export function Badge({ children, variant = 'default', size = 'md', dot = false, className = '' }: BadgeProps) {
  const styles = variantStyles[variant];
  
  return (
    <span 
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontWeight: 500,
        borderRadius: '9999px',
        whiteSpace: 'nowrap',
        padding: size === 'sm' ? '2px 0.5rem' : '0.25rem 0.75rem',
        fontSize: size === 'sm' ? '10px' : '0.6875rem',
        background: styles.bg,
        color: styles.color,
        textTransform: 'capitalize',
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
      {children}
    </span>
  );
}
