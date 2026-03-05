import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import {
  User, Bell, Shield, Palette, Save, Check,
  AlertCircle, Eye, EyeOff, Sun, Moon, Monitor,
  Mail, Building2, Briefcase, Plug, Webhook,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import './SettingsPage.css';

const IntegrationsHub = lazy(() => import('./IntegrationsHub').then(m => ({ default: m.IntegrationsHub })));
const WebhookManager = lazy(() => import('./WebhookManager').then(m => ({ default: m.WebhookManager })));

type Tab = 'profile' | 'notifications' | 'security' | 'appearance' | 'integrations' | 'webhooks';
type ThemeChoice = 'light' | 'dark' | 'system';

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

const NOTIFICATION_KEYS = [
  { key: 'agentFailure', label: 'Agent failure alerts' },
  { key: 'agentSuccess', label: 'Agent success alerts' },
  { key: 'newMessage', label: 'New message alerts' },
  { key: 'taskDue', label: 'Task due reminders' },
  { key: 'escalation', label: 'Escalation alerts' },
] as const;

type NotifPrefs = Record<string, boolean>;

function resolveSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function tabFromPath(pathname: string): Tab {
  if (pathname === '/integrations') return 'integrations';
  if (pathname === '/webhooks') return 'webhooks';
  return 'profile';
}

export function SettingsPage() {
  const { user, updateProfile, getProfileExtras } = useAuth();
  const { theme: currentTheme, setTheme } = useTheme();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromPath(location.pathname));

  useEffect(() => {
    const derived = tabFromPath(location.pathname);
    if (derived !== 'profile') setActiveTab(derived);
  }, [location.pathname]);

  // --- Profile state ---
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Notification state ---
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({});

  // --- Security state ---
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  // --- Appearance state ---
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem('crewos-theme-mode');
    if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
    return currentTheme;
  });

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setEmail(user.email ?? '');
      const extras = getProfileExtras();
      setFullName(extras.fullName ?? '');
      setCompany(extras.company ?? '');
      setRole(extras.role ?? '');

      const storageKey = `crewos-notification-prefs-${user.uid}`;
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) setNotifPrefs(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, [user, getProfileExtras]);

  // --- Profile handlers ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
        fullName: fullName.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // --- Notification handlers ---
  const toggleNotif = (key: string) => {
    if (!user) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    localStorage.setItem(`crewos-notification-prefs-${user.uid}`, JSON.stringify(updated));
  };

  // --- Security handlers ---
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (!user || !user.email) {
      setPwMsg({ type: 'error', text: 'Password change is only available for email/password accounts.' });
      return;
    }
    setChangingPw(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      const msg = err?.code === 'auth/wrong-password'
        ? 'Current password is incorrect.'
        : err?.message || 'Failed to change password.';
      setPwMsg({ type: 'error', text: msg });
    } finally {
      setChangingPw(false);
    }
  };

  // --- Appearance handlers ---
  const applyTheme = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    localStorage.setItem('crewos-theme-mode', choice);
    if (choice === 'system') {
      setTheme(resolveSystemTheme());
    } else {
      setTheme(choice);
    }
  };

  return (
    <div className="operonai-settings">
      <div className="operonai-settings-inner">
        <header className="operonai-settings-header">
          <h1 className="operonai-settings-title">Settings</h1>
          <p className="operonai-settings-subtitle">Manage your profile, notifications, security, appearance, integrations, and webhooks.</p>
        </header>

        {/* Tab navigation */}
        <nav className="operonai-settings-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`operonai-settings-tab${activeTab === id ? ' operonai-settings-tab--active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="operonai-settings-content">
          {/* ─── Profile Tab ─── */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSave}>
              <section className="operonai-settings-section">
                <h2 className="operonai-settings-section-title">Account &amp; profile</h2>
                <p className="operonai-settings-section-desc">Edit your information. These details are used across OperonAI.</p>

                <div className="operonai-settings-fields">
                  <div className="operonai-settings-field">
                    <label htmlFor="displayName"><User size={16} />Display name</label>
                    <input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How you appear in the app" />
                  </div>
                  <div className="operonai-settings-field">
                    <label htmlFor="email"><Mail size={16} />Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                  </div>
                  <div className="operonai-settings-field">
                    <label htmlFor="fullName">Full name</label>
                    <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" />
                  </div>
                  <div className="operonai-settings-field">
                    <label htmlFor="company"><Building2 size={16} />Company</label>
                    <input id="company" type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company or organization" />
                  </div>
                  <div className="operonai-settings-field">
                    <label htmlFor="role"><Briefcase size={16} />Role</label>
                    <input id="role" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Product Manager, Developer" />
                  </div>
                </div>

                <div className="operonai-settings-actions">
                  <button type="submit" className="operonai-settings-save" disabled={saving}>
                    {saving ? 'Saving…' : saved ? <><Check size={18} />Saved</> : <><Save size={18} />Save changes</>}
                  </button>
                </div>
              </section>

              <section className="operonai-settings-section" style={{ marginTop: 24 }}>
                <h2 className="operonai-settings-section-title">Account</h2>
                <p className="operonai-settings-section-desc">
                  {user ? 'You are signed in. Update your profile above to complete your account details.' : 'Sign in to manage your account details.'}
                </p>
                <div className="operonai-settings-account-card">
                  <div className="operonai-settings-account-avatar">
                    {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="operonai-settings-account-info">
                    <div className="operonai-settings-account-name">{user?.displayName || fullName || 'No name set'}</div>
                    <div className="operonai-settings-account-email">{user?.email || 'No email'}</div>
                  </div>
                </div>
              </section>
            </form>
          )}

          {/* ─── Notifications Tab ─── */}
          {activeTab === 'notifications' && (
            <section className="operonai-settings-section">
              <h2 className="operonai-settings-section-title">Notification preferences</h2>
              <p className="operonai-settings-section-desc">Choose which notifications you'd like to receive.</p>

              <div className="operonai-settings-toggles">
                {NOTIFICATION_KEYS.map(({ key, label }) => (
                  <label key={key} className="operonai-settings-toggle-row">
                    <span className="operonai-settings-toggle-label">{label}</span>
                    <div className="operonai-settings-switch-wrap">
                      <input
                        type="checkbox"
                        className="operonai-settings-switch-input"
                        checked={!!notifPrefs[key]}
                        onChange={() => toggleNotif(key)}
                      />
                      <span className="operonai-settings-switch-track" />
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ─── Security Tab ─── */}
          {activeTab === 'security' && (
            <section className="operonai-settings-section">
              <h2 className="operonai-settings-section-title">Change password</h2>
              <p className="operonai-settings-section-desc">
                Only available for email/password accounts. Google sign-in users should manage passwords through Google.
              </p>

              {pwMsg && (
                <div className={`operonai-settings-msg operonai-settings-msg--${pwMsg.type}`}>
                  {pwMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {pwMsg.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="operonai-settings-fields">
                <div className="operonai-settings-field">
                  <label htmlFor="currentPw"><Shield size={16} />Current password</label>
                  <div className="operonai-settings-pw-wrap">
                    <input
                      id="currentPw"
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder="Enter current password"
                      required
                    />
                    <button type="button" className="operonai-settings-pw-toggle" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="operonai-settings-field">
                  <label htmlFor="newPw">New password</label>
                  <div className="operonai-settings-pw-wrap">
                    <input
                      id="newPw"
                      type={showNewPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                    <button type="button" className="operonai-settings-pw-toggle" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="operonai-settings-field">
                  <label htmlFor="confirmPw">Confirm new password</label>
                  <input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>
                <div className="operonai-settings-actions">
                  <button type="submit" className="operonai-settings-save" disabled={changingPw}>
                    {changingPw ? 'Updating…' : <><Shield size={18} />Update password</>}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* ─── Appearance Tab ─── */}
          {activeTab === 'appearance' && (
            <section className="operonai-settings-section">
              <h2 className="operonai-settings-section-title">Theme</h2>
              <p className="operonai-settings-section-desc">Select your preferred appearance.</p>

              <div className="operonai-settings-theme-options">
                {([
                  { value: 'light' as ThemeChoice, label: 'Light', icon: Sun },
                  { value: 'dark' as ThemeChoice, label: 'Dark', icon: Moon },
                  { value: 'system' as ThemeChoice, label: 'System', icon: Monitor },
                ]).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`operonai-settings-theme-btn${themeChoice === value ? ' operonai-settings-theme-btn--active' : ''}`}
                    onClick={() => applyTheme(value)}
                  >
                    <Icon size={22} />
                    <span>{label}</span>
                    {themeChoice === value && <Check size={16} className="operonai-settings-theme-check" />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ─── Integrations Tab ─── */}
          {activeTab === 'integrations' && (
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#6b6b80' }}>Loading integrations…</div>}>
              <IntegrationsHub />
            </Suspense>
          )}

          {/* ─── Webhooks Tab ─── */}
          {activeTab === 'webhooks' && (
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#6b6b80' }}>Loading webhooks…</div>}>
              <WebhookManager />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
