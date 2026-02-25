import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  xs: { width: 24, height: 24, fontSize: '0.6875rem' },
  sm: { width: 32, height: 32, fontSize: '0.8125rem' },
  md: { width: 40, height: 40, fontSize: '0.9375rem' },
  lg: { width: 48, height: 48, fontSize: '1.0625rem' },
  xl: { width: 64, height: 64, fontSize: '1.25rem' },
};

export function Avatar({ src, alt, name, size = 'md', className = '' }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const sizeConfig = sizes[size];

  const initials = name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const showImage = src && !hasError;

  return (
    <div 
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        background: 'var(--color-bg-tertiary)',
        overflow: 'hidden',
        flexShrink: 0,
        width: sizeConfig.width,
        height: sizeConfig.height,
        fontSize: sizeConfig.fontSize,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          onError={() => setHasError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>{initials}</span>
      )}
    </div>
  );
}
