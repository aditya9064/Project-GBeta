import { useState, useEffect } from 'react';
import { User, Mail, Building2, Briefcase, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './SettingsPage.css';

export function SettingsPage() {
  const { user, updateProfile, getProfileExtras } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setEmail(user.email ?? '');
      const extras = getProfileExtras();
      setFullName(extras.fullName ?? '');
      setCompany(extras.company ?? '');
      setRole(extras.role ?? '');
    }
  }, [user, getProfileExtras]);

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

  if (!user) return null;

  return (
    <div className="crewos-settings">
      <div className="crewos-settings-inner">
        <header className="crewos-settings-header">
          <h1 className="crewos-settings-title">Settings</h1>
          <p className="crewos-settings-subtitle">Manage your profile and account details.</p>
        </header>

        <form onSubmit={handleSave} className="crewos-settings-form">
          {/* Account / Profile section */}
          <section className="crewos-settings-section">
            <h2 className="crewos-settings-section-title">Account &amp; profile</h2>
            <p className="crewos-settings-section-desc">Edit your information. These details are used across CrewOS.</p>

            <div className="crewos-settings-fields">
              <div className="crewos-settings-field">
                <label htmlFor="displayName">
                  <User size={16} />
                  Display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you appear in the app"
                />
              </div>

              <div className="crewos-settings-field">
                <label htmlFor="email">
                  <Mail size={16} />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <div className="crewos-settings-field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full legal name"
                />
              </div>

              <div className="crewos-settings-field">
                <label htmlFor="company">
                  <Building2 size={16} />
                  Company
                </label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company or organization"
                />
              </div>

              <div className="crewos-settings-field">
                <label htmlFor="role">
                  <Briefcase size={16} />
                  Role
                </label>
                <input
                  id="role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Product Manager, Developer"
                />
              </div>
            </div>

            <div className="crewos-settings-actions">
              <button type="submit" className="crewos-settings-save" disabled={saving}>
                {saving ? (
                  <>Saving…</>
                ) : saved ? (
                  <>
                    <CheckCircle size={18} />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Create account / Account info */}
          <section className="crewos-settings-section">
            <h2 className="crewos-settings-section-title">Account</h2>
            <p className="crewos-settings-section-desc">
              You are signed in. Update your profile above to complete your account details. 
              To create a new account or sign in elsewhere, use the login page.
            </p>
            <div className="crewos-settings-account-card">
              <div className="crewos-settings-account-avatar">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="crewos-settings-account-info">
                <div className="crewos-settings-account-name">
                  {user.displayName || fullName || 'No name set'}
                </div>
                <div className="crewos-settings-account-email">{user.email || 'No email'}</div>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
