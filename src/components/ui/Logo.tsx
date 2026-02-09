import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  return (
    <div className={`${styles.logo} ${styles[size]} ${className}`}>
      <div className={styles.mark}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="url(#gradient)" />
          <path
            d="M10 16C10 12.6863 12.6863 10 16 10V10C19.3137 10 22 12.6863 22 16V22H16C12.6863 22 10 19.3137 10 16V16Z"
            fill="white"
            fillOpacity="0.9"
          />
          <circle cx="16" cy="16" r="3" fill="url(#gradient)" />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && <span className={styles.text}>Nova</span>}
    </div>
  );
}






