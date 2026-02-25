import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: '1px solid var(--color-accent)' },
  secondary: { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' },
  ghost: { background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid transparent' },
  danger: { background: 'var(--color-error-muted)', color: 'var(--color-error)', border: '1px solid transparent' },
  ai: { background: 'var(--color-ai-muted)', color: 'var(--color-ai)', border: '1px solid transparent' },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 32, padding: '0 0.75rem', fontSize: '0.8125rem' },
  md: { height: 40, padding: '0 1rem', fontSize: '0.8125rem' },
  lg: { height: 48, padding: '0 1.5rem', fontSize: '0.9375rem' },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'secondary', size = 'md', icon, iconPosition = 'left', loading = false, fullWidth = false, className = '', disabled, style, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={className}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontWeight: 500,
          borderRadius: '8px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: 'all 100ms ease',
          width: fullWidth ? '100%' : undefined,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        {...props}
      >
        {icon && iconPosition === 'left' && !loading && <span style={{ display: 'flex' }}>{icon}</span>}
        {children && <span>{children}</span>}
        {icon && iconPosition === 'right' && !loading && <span style={{ display: 'flex' }}>{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
