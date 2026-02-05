import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error = false, fullWidth = false, className = '', style, ...props }, ref) => {
    return (
      <div 
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 40,
          background: 'var(--color-bg-secondary)',
          border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-default)'}`,
          borderRadius: '8px',
          transition: 'all 100ms ease',
          width: fullWidth ? '100%' : undefined,
          ...style,
        }}
      >
        {icon && (
          <span style={{ display: 'flex', padding: '0 0.75rem', color: 'var(--color-text-tertiary)' }}>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          style={{
            flex: 1,
            height: '100%',
            padding: icon ? '0 0.75rem 0 0' : '0 0.75rem',
            fontSize: '0.8125rem',
            color: 'var(--color-text-primary)',
            background: 'transparent',
            minWidth: 0,
          }}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';
