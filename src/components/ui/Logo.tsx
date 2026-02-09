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
          <rect width="32" height="32" rx="8" fill="url(#crewos-gradient)" />
          {/* C for CrewOS + sparkle for AI agents */}
          <path
            d="M22 11.5Q22 8 16 8Q10 8 10 11.5V20.5Q10 24 16 24Q22 24 22 20.5"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.9" />
          <defs>
            <linearGradient id="crewos-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#c86a2e" />
              <stop offset="1" stopColor="#e07a3a" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && <span className={styles.text}>CrewOS</span>}
    </div>
  );
}






