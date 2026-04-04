import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

interface PlanCardProps {
  name: string;
  price: string;
  tag?: string;
  description: string;
  features: string[];
  muted?: boolean;
   featured?: boolean;
  buttonLabel?: string;
  onSelect?: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({
  name,
  price,
  tag,
  description,
  features,
  muted,
  featured,
  buttonLabel,
  onSelect,
}) => {
  return (
    <div className={`op-plan-card ${muted ? 'op-plan-card--muted' : ''} ${featured ? 'op-plan-card--featured' : ''}`}>
      {tag && <div className="op-plan-tag">{tag}</div>}
      <h3 className="op-plan-name">{name}</h3>
      <div className="op-plan-price">{price}</div>
      <p className="op-plan-desc">{description}</p>
      <ul className="op-plan-features">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {buttonLabel && onSelect && (
        <button
          type="button"
          className="op-plan-btn"
          onClick={onSelect}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
};

export const PlanSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSelect = (planId: string) => {
    // For now we simply stash the choice and move to dashboard
    try {
      localStorage.setItem('operonai-selected-plan', planId);
    } catch {
      // ignore storage errors
    }
    navigate('/dashboard');
  };

  return (
    <div className="op-plans-page">
      <div className="op-plans-inner">
        <header className="op-plans-header">
          <span className="op-plans-label">Choose your plan</span>
          <h1>Start automating in minutes. No credit card needed.</h1>
          <p>Pick a plan that works for you. Upgrade or change anytime — no lock-in.</p>
        </header>

        <div className="op-plan-grid">
          <PlanCard
            name="Free"
            price="$0 / month"
            description="Try everything at your own pace. No credit card required."
            features={[
              'Up to 3 AI assistants',
              '50 tasks per month',
              'Basic document creation',
              'Email support',
            ]}
            buttonLabel="Get Started Free"
            onSelect={() => handleSelect('basic')}
          />

          <PlanCard
            name="Plus"
            price="$15 / month"
            description="For individuals and small teams who want to do more."
            features={[
              'Unlimited AI assistants',
              'Unlimited tasks',
              'All document templates',
              'Email & messaging automation',
              'Priority email support',
            ]}
            buttonLabel="Choose Plus"
            onSelect={() => handleSelect('plus')}
          />

          <PlanCard
            name="Pro"
            price="$35 / month"
            tag="Most Popular"
            featured
            description="For teams that want full power and customization."
            features={[
              'Everything in Plus',
              'Analytics dashboard',
              'Custom AI training',
              'Priority support',
              'Connect any app or service',
            ]}
            buttonLabel="Choose Pro"
            onSelect={() => handleSelect('pro')}
          />

          <PlanCard
            name="Enterprise"
            price="$150 / month"
            description="For organizations that need dedicated support and security."
            features={[
              'Everything in Pro',
              'Dedicated account manager',
              'Single sign-on (SSO)',
              'Guaranteed uptime (SLA)',
              'Custom setup & training',
            ]}
            buttonLabel="Talk to Sales"
            onSelect={() => handleSelect('enterprise')}
          />
        </div>
      </div>
    </div>
  );
};

