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
          <span className="op-plans-label">Business model</span>
          <h1>Your AI workforce, on your terms.</h1>
          <p>Select a plan to explore OperonAI. You can change plans later inside the product.</p>
        </header>

        <div className="op-plan-grid">
          <PlanCard
            name="Basic"
            price="$0 / month"
            description="For trying out the agent workforce with no commitment."
            features={[
              'Limited AI agents',
              'Limited document generation',
              'Basic AI document templates',
              'Email support only',
            ]}
            buttonLabel="Start with Basic"
            onSelect={() => handleSelect('basic')}
          />

          <PlanCard
            name="Plus"
            price="$15 / month"
            description="For teams getting started with AI agents."
            features={[
              'Unlimited AI agents',
              'Unlimited document generation',
              'All AI document templates',
              'Communications agent',
              'Email support',
            ]}
            buttonLabel="Choose Plus"
            onSelect={() => handleSelect('plus')}
          />

          <PlanCard
            name="Pro"
            price="$35 / month"
            tag="Most Popular"
            featured
            description="Full power for growing teams."
            features={[
              'Everything in Plus',
              'Advanced analytics & API access',
              'Custom agent training',
              'Priority support',
              'Custom integrations',
            ]}
            buttonLabel="Choose Pro"
            onSelect={() => handleSelect('pro')}
          />

          <PlanCard
            name="Enterprise"
            price="$150 / month"
            description="For large organizations at scale."
            features={[
              'Everything in Pro',
              'Dedicated account manager',
              'SSO & advanced security',
              'SLA guarantee',
              'Custom onboarding & training',
            ]}
            buttonLabel="Talk to Sales"
            onSelect={() => handleSelect('enterprise')}
          />
        </div>
      </div>
    </div>
  );
};

