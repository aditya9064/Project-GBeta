import React from 'react';

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to CrewOS</h1>
      <p>Your intelligent automation platform</p>
      {onGetStarted && (
        <button onClick={onGetStarted} style={{ marginTop: '1rem', padding: '0.75rem 2rem', cursor: 'pointer' }}>
          Get Started
        </button>
      )}
    </div>
  );
};
