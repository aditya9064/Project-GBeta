import { useState, useEffect, useRef } from 'react';
import './LandingPage.css';

// Feature data for Nova
const features = [
  {
    id: 'calendar',
    label: 'Smart Calendar',
    title: 'AI-powered scheduling that works for you',
    description: 'Automatically find the best meeting times, avoid conflicts, and sync across all your calendars. Our AI learns your preferences and optimizes your schedule.',
    icon: '📅'
  },
  {
    id: 'tasks',
    label: 'Task Management',
    title: 'Stay on top of everything',
    description: 'Create, organize, and track tasks with intelligent prioritization. Set due dates, assign to team members, and watch your productivity soar.',
    icon: '✅'
  },
  {
    id: 'teams',
    label: 'Team Chat',
    title: 'Collaborate in real-time',
    description: 'Channels, direct messages, and threaded conversations keep your team aligned. Share files, react to messages, and never miss an important update.',
    icon: '💬'
  },
  {
    id: 'docs',
    label: 'Documents',
    title: 'Create and share knowledge',
    description: 'Rich document editor with real-time collaboration. Create wikis, meeting notes, and project documentation that lives alongside your work.',
    icon: '📄'
  }
];

// Pricing tiers
const pricing = [
  {
    name: 'Free',
    price: 0,
    description: 'Perfect for individuals getting started with productivity tools.',
    features: [
      'Up to 3 projects',
      'Basic calendar & tasks',
      'Team chat (up to 5 members)',
      '1GB document storage',
      'Email support'
    ],
    cta: 'Get Started Free',
    popular: false
  },
  {
    name: 'Pro',
    price: 12,
    description: 'For professionals who need powerful features and integrations.',
    features: [
      'Unlimited projects',
      'AI scheduling assistant',
      'Advanced task automation',
      'Priority support',
      '50GB storage'
    ],
    cta: 'Start Pro Trial',
    popular: true
  },
  {
    name: 'Team',
    price: 29,
    description: 'For teams that need collaboration, security, and admin controls.',
    features: [
      'Everything in Pro',
      'Unlimited team members',
      'Admin dashboard',
      'SSO & advanced security',
      'Unlimited storage'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

// FAQ items
const faqs = [
  {
    q: "How does the AI scheduling work?",
    a: "Our AI analyzes your calendar patterns, meeting preferences, and availability to suggest optimal meeting times. It learns from your behavior to make smarter recommendations over time."
  },
  {
    q: "Can I import data from other tools?",
    a: "Yes! Nova supports imports from Google Calendar, Outlook, Notion, Asana, Trello, and many other popular productivity tools. Migration takes just a few clicks."
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use bank-level encryption (AES-256) for all data at rest and in transit. Your data is stored in SOC 2 certified data centers with regular security audits."
  },
  {
    q: "Can I use Nova offline?",
    a: "Yes, our desktop and mobile apps support offline mode. Your changes sync automatically when you're back online."
  },
  {
    q: "What integrations are available?",
    a: "Nova integrates with Slack, Google Workspace, Microsoft 365, Zoom, GitHub, Figma, and 50+ other tools. We also offer a REST API for custom integrations."
  }
];

// Stats
const stats = [
  { value: '50K+', label: 'Active Users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9/5', label: 'User Rating' },
  { value: '24/7', label: 'Support' }
];

interface LandingPageProps {
  onGetStarted?: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [activeFeature, setActiveFeature] = useState('calendar');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  // Reference to the scrollable container
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle scroll for navbar styling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 20);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to section
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    const container = containerRef.current;
    if (element && container) {
      const offsetTop = element.offsetTop - 80; // Account for fixed nav
      container.scrollTo({ top: offsetTop, behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  // Handle CTA click
  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    }
  };

  // Handle newsletter submit
  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Thanks for subscribing with ${email}!`);
    setEmail('');
  };

  return (
    <div className="nova-landing" ref={containerRef}>
      {/* Navigation */}
      <nav className={`nova-nav ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-brand" onClick={() => scrollToSection('hero')}>
            <div className="nav-logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="currentColor"/>
                <path d="M8 22L14 10L20 18L26 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="nav-brand-text">Nova</span>
          </div>

          <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <button onClick={() => scrollToSection('features')}>Features</button>
            <button onClick={() => scrollToSection('pricing')}>Pricing</button>
            <button onClick={() => scrollToSection('faq')}>FAQ</button>
          </div>

          <div className="nav-actions">
            <button className="nav-login" onClick={handleGetStarted}>Log in</button>
            <button className="nav-cta" onClick={handleGetStarted}>Get Started</button>
          </div>

          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" id="hero" ref={heroRef}>
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge-icon">✨</span>
            <span>Introducing Nova AI Assistant</span>
          </div>
          
          <h1 className="hero-title">
            Your AI-powered workspace for
            <span className="gradient-text"> getting things done</span>
          </h1>
          
          <p className="hero-subtitle">
            Calendar, tasks, docs, and team chat — all in one place. 
            Let AI handle the busywork while you focus on what matters.
          </p>

          <div className="hero-cta">
            <button className="btn-primary large" onClick={handleGetStarted}>
              Start for Free
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button className="btn-secondary large" onClick={() => scrollToSection('features')}>
              See How It Works
            </button>
          </div>

          <div className="hero-stats">
            {stats.map((stat, i) => (
              <div key={i} className="stat-item">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Visual */}
        <div className="hero-visual">
          <div className="app-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="preview-title">Nova Dashboard</span>
            </div>
            <div className="preview-content">
              <div className="preview-sidebar">
                <div className="sidebar-item active"></div>
                <div className="sidebar-item"></div>
                <div className="sidebar-item"></div>
                <div className="sidebar-item"></div>
              </div>
              <div className="preview-main">
                <div className="preview-card"></div>
                <div className="preview-card wide"></div>
                <div className="preview-card"></div>
                <div className="preview-card"></div>
              </div>
            </div>
          </div>
          
          {/* Floating elements */}
          <div className="floating-card card-1">
            <div className="floating-icon">📅</div>
            <div className="floating-text">
              <span className="floating-title">Meeting scheduled</span>
              <span className="floating-sub">Team sync at 2:00 PM</span>
            </div>
          </div>
          
          <div className="floating-card card-2">
            <div className="floating-icon">✅</div>
            <div className="floating-text">
              <span className="floating-title">Task completed</span>
              <span className="floating-sub">Design review done</span>
            </div>
          </div>
          
          <div className="floating-card card-3">
            <div className="floating-icon">🤖</div>
            <div className="floating-text">
              <span className="floating-title">AI Suggestion</span>
              <span className="floating-sub">Block focus time</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Features</span>
            <h2>Everything you need to be productive</h2>
            <p>Nova brings together all your work tools in one intelligent platform.</p>
          </div>

          <div className="features-tabs">
            <div className="tabs-nav">
              {features.map((feature) => (
                <button
                  key={feature.id}
                  className={`tab-btn ${activeFeature === feature.id ? 'active' : ''}`}
                  onClick={() => setActiveFeature(feature.id)}
                >
                  <span className="tab-icon">{feature.icon}</span>
                  <span className="tab-label">{feature.label}</span>
                </button>
              ))}
            </div>

            <div className="tabs-content">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className={`tab-panel ${activeFeature === feature.id ? 'active' : ''}`}
                >
                  <div className="panel-text">
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    <button className="btn-link" onClick={handleGetStarted}>
                      Try {feature.label}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                  <div className="panel-visual">
                    <div className="feature-mockup">
                      <div className="mockup-header">
                        <span className="mockup-icon">{feature.icon}</span>
                        <span>{feature.label}</span>
                      </div>
                      <div className="mockup-content">
                        <div className="mockup-item"></div>
                        <div className="mockup-item"></div>
                        <div className="mockup-item short"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">How It Works</span>
            <h2>Get started in minutes</h2>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Create your workspace</h3>
              <p>Sign up free and set up your workspace in seconds. Import existing data or start fresh.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Invite your team</h3>
              <p>Add team members via email or link. Set permissions and organize into channels.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Let AI optimize</h3>
              <p>Our AI learns your workflow and suggests improvements. Watch productivity soar.</p>
            </div>
          </div>

          <div className="how-cta">
            <button className="btn-primary" onClick={handleGetStarted}>
              Create Free Workspace
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing" id="pricing">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Pricing</span>
            <h2>Simple, transparent pricing</h2>
            <p>Start free, upgrade when you need more power.</p>
          </div>

          <div className="pricing-grid">
            {pricing.map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
                {plan.popular && <span className="popular-badge">Most Popular</span>}
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.price}</span>
                  <span className="period">/mo</span>
                </div>
                <p className="plan-description">{plan.description}</p>
                <button 
                  className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`}
                  onClick={handleGetStarted}
                >
                  {plan.cta}
                </button>
                <ul className="plan-features">
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Testimonials</span>
            <h2>Loved by productive teams</h2>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"Nova has completely transformed how our team works. The AI scheduling alone saves us hours every week."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SK</div>
                <div className="author-info">
                  <span className="author-name">Sarah Kim</span>
                  <span className="author-role">Product Manager, TechCorp</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"Finally, a tool that combines everything we need. No more switching between 5 different apps!"</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">MJ</div>
                <div className="author-info">
                  <span className="author-name">Mike Johnson</span>
                  <span className="author-role">Founder, StartupXYZ</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"The task automation is incredible. What used to take hours now happens automatically."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">EC</div>
                <div className="author-info">
                  <span className="author-name">Emily Chen</span>
                  <span className="author-role">Engineering Lead, DevCo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq" id="faq">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">FAQ</span>
            <h2>Frequently asked questions</h2>
          </div>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span className="faq-icon">{openFaq === i ? '−' : '+'}</span>
                </button>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-content">
            <h2>Ready to boost your productivity?</h2>
            <p>Join thousands of teams using Nova to get more done.</p>
            <div className="cta-buttons">
              <button className="btn-primary large" onClick={handleGetStarted}>
                Get Started Free
              </button>
              <button className="btn-secondary large" onClick={handleGetStarted}>
                Schedule a Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="nova-footer">
        <div className="footer-container">
          <div className="footer-main">
            <div className="footer-brand">
              <div className="footer-logo">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="currentColor"/>
                  <path d="M8 22L14 10L20 18L26 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Nova</span>
              </div>
              <p>AI-powered workspace for modern teams.</p>
            </div>

            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <button onClick={() => scrollToSection('features')}>Features</button>
                <button onClick={() => scrollToSection('pricing')}>Pricing</button>
                <button onClick={handleGetStarted}>Integrations</button>
                <button onClick={handleGetStarted}>Changelog</button>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <button onClick={handleGetStarted}>About</button>
                <button onClick={handleGetStarted}>Careers</button>
                <button onClick={handleGetStarted}>Blog</button>
                <button onClick={handleGetStarted}>Press</button>
              </div>
              <div className="footer-column">
                <h4>Support</h4>
                <button onClick={() => scrollToSection('faq')}>FAQ</button>
                <button onClick={handleGetStarted}>Help Center</button>
                <button onClick={handleGetStarted}>Contact</button>
                <button onClick={handleGetStarted}>Status</button>
              </div>
            </div>
          </div>

          <div className="footer-newsletter">
            <h4>Subscribe to our newsletter</h4>
            <form onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit">Subscribe</button>
            </form>
          </div>

          <div className="footer-bottom">
            <p>© 2026 Nova. All rights reserved.</p>
            <div className="footer-legal">
              <button onClick={handleGetStarted}>Privacy</button>
              <button onClick={handleGetStarted}>Terms</button>
              <button onClick={handleGetStarted}>Cookies</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
