/* ═══════════════════════════════════════════════════════════
   Loading Spinner Component
   
   Reusable loading indicator for lazy-loaded components
   and async operations.
   ═══════════════════════════════════════════════════════════ */

import { Loader2 } from 'lucide-react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  size = 'medium', 
  message = 'Loading...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeMap = {
    small: 16,
    medium: 32,
    large: 48,
  };

  const content = (
    <div className={`loading-spinner loading-spinner--${size}`}>
      <Loader2 
        className="loading-spinner__icon" 
        size={sizeMap[size]} 
      />
      {message && (
        <span className="loading-spinner__message">{message}</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-spinner__overlay">
        {content}
      </div>
    );
  }

  return content;
}

export function PageLoader({ message = 'Loading page...' }: { message?: string }) {
  return (
    <div className="page-loader">
      <LoadingSpinner size="large" message={message} />
    </div>
  );
}
