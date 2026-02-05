import { forwardRef } from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  'aria-label': string;
}

const sizeConfig = {
  sm: { size: 28, iconSize: 14 },
  md: { size: 32, iconSize: 18 },
  lg: { size: 40, iconSize: 20 },
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, size = 'md', active = false, className = '', style, ...props }, ref) => {
    const config = sizeConfig[size];

    return (
      <button
        ref={ref}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: config.size,
          height: config.size,
          borderRadius: '8px',
          cursor: 'pointer',
          color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          background: active ? 'var(--color-bg-selected)' : 'transparent',
          transition: 'all 100ms ease',
          flexShrink: 0,
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
