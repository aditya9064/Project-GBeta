import { useState, useCallback } from 'react';
import {
  Sparkles, Link2, Bot, CheckCircle, ArrowRight, ChevronLeft,
  Mail, FileText, TrendingUp, MessageSquare, Briefcase,
  Code2, Megaphone, Settings2, Users, Wand2, Star, Heart,
  Zap, Target, Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type UserRole = 'business' | 'marketer' | 'operations' | 'developer' | 'other';

interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  route: string;
}

const BRAND = '#e97428';

const ROLES: Array<{ id: UserRole; label: string; description: string; icon: React.ReactNode; emoji: string }> = [
  { id: 'business', label: 'Business Owner', description: 'I run a business and want to save time', icon: <Briefcase size={24} />, emoji: '🏢' },
  { id: 'marketer', label: 'Marketing / Sales', description: 'I do marketing, sales, or customer work', icon: <Megaphone size={24} />, emoji: '📣' },
  { id: 'operations', label: 'Operations / Admin', description: 'I manage processes, docs, and teams', icon: <Settings2 size={24} />, emoji: '⚙️' },
  { id: 'developer', label: 'Developer / Technical', description: 'I write code and build software', icon: <Code2 size={24} />, emoji: '💻' },
  { id: 'other', label: 'Just Exploring', description: 'I want to see what AI can do for me', icon: <Star size={24} />, emoji: '✨' },
];

const USE_CASES: UseCase[] = [
  { id: 'email', title: 'Automate My Email', description: 'AI reads, sorts, and drafts replies to your emails', icon: <Mail size={22} />, color: '#0ea5e9', route: '/comms' },
  { id: 'docs', title: 'Create Documents', description: 'Generate contracts, invoices, reports — any document', icon: <FileText size={22} />, color: '#8b5cf6', route: '/docai' },
  { id: 'sales', title: 'Track My Sales', description: 'Manage contacts, pipelines, and follow-ups', icon: <TrendingUp size={22} />, color: '#10b981', route: '/sales' },
  { id: 'chat', title: 'Just Ask AI Anything', description: 'Chat with an AI that can take action for you', icon: <Sparkles size={22} />, color: '#f59e0b', route: '/chat' },
  { id: 'team', title: 'Coordinate My Team', description: 'Assign tasks and automate team workflows', icon: <Users size={22} />, color: '#6366f1', route: '/workforce' },
  { id: 'browse', title: 'Browse Ready-Made Solutions', description: 'Find and install pre-built automations', icon: <Wand2 size={22} />, color: '#ec4899', route: '/marketplace' },
];

const integrations = [
  { key: 'gmail', label: 'Gmail', desc: 'Read and send emails automatically', icon: '📧' },
  { key: 'slack', label: 'Slack', desc: 'Send messages to your team channels', icon: '💬' },
  { key: 'hubspot', label: 'HubSpot', desc: 'Sync your contacts and deals', icon: '📊' },
] as const;

const oauthEndpoints: Record<string, string> = {
  gmail: '/api/connections/gmail',
  slack: '/api/connections/slack',
  hubspot: '/api/connections/hubspot',
};

const STEPS = ['Welcome', 'About You', 'Connect', 'Get Started'] as const;

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [selectedUseCases, setSelectedUseCases] = useState<Set<string>>(new Set());

  const firstName = user?.displayName?.split(' ')[0] || '';

  const handleConnect = (key: string) => {
    const url = oauthEndpoints[key];
    if (url) {
      window.open(url, '_blank', 'width=600,height=700');
      setConnected(prev => ({ ...prev, [key]: true }));
    }
  };

  const toggleUseCase = (id: string) => {
    setSelectedUseCases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveAndComplete = useCallback(() => {
    if (selectedRole) {
      const uid = user?.uid;
      if (uid) {
        const prefs = {
          role: selectedRole,
          experience: selectedRole === 'developer' ? 'intermediate' : 'beginner',
          showDevTools: selectedRole === 'developer',
          simplifiedMode: selectedRole !== 'developer',
          completedTours: ['role-selection', 'onboarding'],
          useCasesViewed: Array.from(selectedUseCases),
        };
        localStorage.setItem(`operonai-prefs-${uid}`, JSON.stringify(prefs));
      }
    }

    const firstUseCase = USE_CASES.find(uc => selectedUseCases.has(uc.id));
    if (firstUseCase) {
      onComplete();
      window.dispatchEvent(new CustomEvent('crewos:navigate', { detail: firstUseCase.route.replace('/', '') }));
    } else {
      onComplete();
    }
  }, [selectedRole, selectedUseCases, onComplete, user?.uid]);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 24, width: 580, maxWidth: '94vw',
    boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', maxHeight: '90vh',
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
    padding: '24px 32px 32px', flex: 1, overflowY: 'auto',
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
    transition: 'transform 0.1s, box-shadow 0.2s',
  };

  const btnSecondary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 10, border: '1px solid #e5e7eb',
    background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 500, cursor: 'pointer',
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: `${BRAND}12`, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={32} color={BRAND} />
            </div>
            <h2 style={{ ...heading, marginTop: 20 }}>
              Welcome{firstName ? `, ${firstName}` : ''}! 👋
            </h2>
            <p style={sub}>
              OperonAI helps you <strong>automate the boring stuff</strong> so you can focus
              on what matters. No coding or technical skills needed.
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24,
              padding: '16px 20px', borderRadius: 14, background: '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="#3b82f6" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Tell it what to do in plain English</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>"Summarize my emails every morning"</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={16} color="#16a34a" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>It handles the work automatically</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Your AI assistant takes care of the rest</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>You stay in control</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Review and approve important actions</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 28 }}>
              <button style={btnPrimary} onClick={next}>
                Let's Go <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 1:
        return (
          <div>
            <h2 style={heading}>What best describes you?</h2>
            <p style={sub}>
              This helps us show you the most relevant features. You can change this anytime.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
              {ROLES.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14, textAlign: 'left',
                    border: selectedRole === role.id ? `2px solid ${BRAND}` : '1px solid #e5e7eb',
                    background: selectedRole === role.id ? `${BRAND}06` : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit', width: '100%',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{role.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>{role.label}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{role.description}</div>
                  </div>
                  {selectedRole === role.id && <CheckCircle size={20} color={BRAND} />}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <button style={btnSecondary} onClick={back}><ChevronLeft size={16} /> Back</button>
              <button style={btnPrimary} onClick={next} disabled={!selectedRole}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: '#e07a3a15', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Link2 size={24} color="#e07a3a" />
            </div>
            <h2 style={{ ...heading, marginTop: 16 }}>Connect your tools</h2>
            <p style={sub}>
              Link the services you already use. This lets your AI assistant read your emails,
              send messages, and work with your real data. <em>You can always do this later.</em>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              {integrations.map(i => (
                <div key={i.key} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', borderRadius: 14,
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: BRAND }}>
                      <CheckCircle size={16} /> Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(i.key)}
                      style={{
                        padding: '8px 18px', borderRadius: 10, border: '1px solid #e5e7eb',
                        background: '#fff', color: '#334155', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <button style={btnSecondary} onClick={back}><ChevronLeft size={16} /> Back</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btnSecondary, border: 'none', color: '#94a3b8' }} onClick={next}>Skip for now</button>
                <button style={btnPrimary} onClick={next}>Continue <ArrowRight size={16} /></button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 style={heading}>What would you like to do first?</h2>
            <p style={sub}>
              Pick one or more — we'll take you right there. You can explore everything else later.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
              {USE_CASES.map(uc => (
                <button
                  key={uc.id}
                  onClick={() => toggleUseCase(uc.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    gap: 8, padding: '16px', borderRadius: 14, textAlign: 'left',
                    border: selectedUseCases.has(uc.id) ? `2px solid ${uc.color}` : '1px solid #e5e7eb',
                    background: selectedUseCases.has(uc.id) ? `${uc.color}08` : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit', width: '100%', position: 'relative',
                  }}
                >
                  {selectedUseCases.has(uc.id) && (
                    <CheckCircle size={16} color={uc.color} style={{ position: 'absolute', top: 10, right: 10 }} />
                  )}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${uc.color}12`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: uc.color,
                  }}>
                    {uc.icon}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{uc.title}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{uc.description}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              <button style={btnSecondary} onClick={back}><ChevronLeft size={16} /> Back</button>
              <button style={btnPrimary} onClick={saveAndComplete}>
                {selectedUseCases.size > 0 ? (
                  <>Take Me There <ArrowRight size={16} /></>
                ) : (
                  <>Go to Dashboard <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget && step === STEPS.length - 1) saveAndComplete(); }}>
      <div style={card}>
        <div style={progressBar}>
          {STEPS.map((_, i) => <div key={i} style={dot(i === step, i < step)} />)}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '8px 28px 0', justifyContent: 'space-between' }}>
          {STEPS.map((label, i) => (
            <span key={label} style={{
              flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600,
              color: i <= step ? BRAND : '#cbd5e1', transition: 'color 0.3s',
            }}>
              {label}
            </span>
          ))}
        </div>
        <div style={body}>{renderStep()}</div>
      </div>
    </div>
  );
}
