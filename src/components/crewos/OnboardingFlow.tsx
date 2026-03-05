import { useState } from 'react';
import { Sparkles, Link2, Bot, CheckCircle, ArrowRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const STEPS = ['Welcome', 'Connect', 'First Agent', 'Done'] as const;
const BRAND = '#e97428';

const integrations = [
  { key: 'gmail', label: 'Gmail', desc: 'Email automation & monitoring', icon: '📧' },
  { key: 'slack', label: 'Slack', desc: 'Team messaging & notifications', icon: '💬' },
  { key: 'hubspot', label: 'HubSpot', desc: 'CRM & sales pipeline', icon: '📊' },
] as const;

const oauthEndpoints: Record<string, string> = {
  gmail: '/api/connections/gmail',
  slack: '/api/connections/slack',
  hubspot: '/api/connections/hubspot',
};

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  const firstName = user?.displayName?.split(' ')[0] || '';

  const handleConnect = (key: string) => {
    const url = oauthEndpoints[key];
    if (url) {
      window.open(url, '_blank', 'width=600,height=700');
      setConnected(prev => ({ ...prev, [key]: true }));
    }
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 20, width: 520, maxWidth: '94vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  };

  const progressBar: React.CSSProperties = {
    display: 'flex', gap: 6, padding: '20px 28px 0',
  };

  const dot = (active: boolean, done: boolean): React.CSSProperties => ({
    flex: 1, height: 4, borderRadius: 4,
    background: done ? BRAND : active ? BRAND : '#e5e7eb',
    opacity: done ? 0.5 : 1,
    transition: 'all 0.3s',
  });

  const body: React.CSSProperties = {
    padding: '28px 32px 32px', flex: 1,
  };

  const heading: React.CSSProperties = {
    fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.3,
  };

  const sub: React.CSSProperties = {
    fontSize: 15, color: '#64748b', marginTop: 8, lineHeight: 1.6,
  };

  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px', borderRadius: 12, border: 'none',
    background: `linear-gradient(135deg, ${BRAND}, #d46b2c)`, color: '#fff',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb',
    background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer',
  };

  const iconCircle = (color: string): React.CSSProperties => ({
    width: 48, height: 48, borderRadius: 14,
    background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <div style={iconCircle(BRAND)}>
              <Sparkles size={24} color={BRAND} />
            </div>
            <h2 style={{ ...heading, marginTop: 20 }}>
              Welcome{firstName ? `, ${firstName}` : ''} to CrewOS
            </h2>
            <p style={sub}>
              CrewOS is your AI-powered operating system for automating workflows,
              managing communications, and deploying intelligent agents — all from
              one place.
            </p>
            <p style={{ ...sub, marginTop: 4 }}>Let's get you set up in a few quick steps.</p>
            <div style={{ marginTop: 28 }}>
              <button style={btnPrimary} onClick={next}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            <div style={iconCircle('#e07a3a')}>
              <Link2 size={24} color="#e07a3a" />
            </div>
            <h2 style={{ ...heading, marginTop: 20 }}>Connect Your Tools</h2>
            <p style={sub}>
              Link the services you use daily so your agents can work with real data.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
              {integrations.map(i => (
                <div key={i.key} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  border: connected[i.key] ? `2px solid ${BRAND}` : '1px solid #e5e7eb',
                  background: connected[i.key] ? `${BRAND}08` : '#fafafa',
                  transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 28 }}>{i.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>{i.label}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{i.desc}</div>
                  </div>
                  {connected[i.key] ? (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 13, fontWeight: 600, color: BRAND,
                    }}>
                      <CheckCircle size={16} /> Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(i.key)}
                      style={{
                        padding: '8px 18px', borderRadius: 10, border: '1px solid #e5e7eb',
                        background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <button style={btnSecondary} onClick={back}>
                <ChevronLeft size={16} /> Back
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btnSecondary, border: 'none', color: '#94a3b8' }} onClick={next}>
                  Skip for now
                </button>
                <button style={btnPrimary} onClick={next}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div style={iconCircle('#d46b2c')}>
              <Bot size={24} color="#d46b2c" />
            </div>
            <h2 style={{ ...heading, marginTop: 20 }}>Create Your First Agent</h2>
            <p style={sub}>
              Agents automate tasks for you — from drafting emails to updating your CRM.
              Head to the Agent Builder to create one, or skip and explore later.
            </p>
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                style={btnPrimary}
                onClick={() => {
                  onComplete();
                  window.dispatchEvent(new CustomEvent('crewos:navigate', { detail: 'agents' }));
                }}
              >
                <Bot size={16} /> Go to Agent Builder
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button style={btnSecondary} onClick={back}>
                  <ChevronLeft size={16} /> Back
                </button>
                <button style={{ ...btnSecondary, border: 'none', color: '#94a3b8' }} onClick={next}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: '#ecfdf5', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <h2 style={heading}>You're All Set!</h2>
            <p style={sub}>
              Your workspace is ready. You can connect more tools, create agents, and
              automate workflows anytime from your dashboard.
            </p>
            <ul style={{
              textAlign: 'left', margin: '20px auto 0', padding: 0,
              listStyle: 'none', maxWidth: 320,
            }}>
              {[
                { label: 'Workspace created', done: true },
                { label: 'Tools connected', done: Object.keys(connected).length > 0 },
                { label: 'First agent', done: false },
              ].map((item, idx) => (
                <li key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', fontSize: 14,
                  color: item.done ? '#0f172a' : '#94a3b8',
                }}>
                  <CheckCircle size={16} color={item.done ? '#10b981' : '#d1d5db'} />
                  {item.label}
                  {!item.done && <span style={{ fontSize: 12, color: '#94a3b8' }}>— skipped</span>}
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 28 }}>
              <button style={btnPrimary} onClick={onComplete}>
                Go to Dashboard <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && step === 3) onComplete(); }}>
      <div style={card}>
        <div style={progressBar}>
          {STEPS.map((_, i) => (
            <div key={i} style={dot(i === step, i < step)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '8px 28px 0', justifyContent: 'space-between' }}>
          {STEPS.map((label, i) => (
            <span key={label} style={{
              flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600,
              color: i <= step ? BRAND : '#cbd5e1',
              transition: 'color 0.3s',
            }}>
              {label}
            </span>
          ))}
        </div>
        <div style={body}>
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
