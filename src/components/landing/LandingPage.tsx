import { useState, useEffect, useRef } from 'react';
import './LandingPage.css';

// Feature data for CrewOS
const features = [
  {
    id: 'agents',
    label: 'AI Agents',
    title: 'Deploy an army of AI agents',
    description: 'Deploy, train, and manage intelligent agents for document processing, support triage, content generation, compliance monitoring, and more — all from one dashboard.',
    icon: '🤖'
  },
  {
    id: 'docgen',
    label: 'Document Generation',
    title: 'Generate any document in minutes',
    description: 'Commercial leases, MSAs, invoices, insurance certificates, employment agreements, and vendor packages — all generated from guided intake forms with full legal compliance.',
    icon: '📄'
  },
  {
    id: 'comms',
    label: 'Communications',
    title: 'AI-powered email & outreach',
    description: 'Draft contextual email responses, manage campaigns, and let AI handle routine communications while you focus on high-value relationships.',
    icon: '✉️'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    title: 'Real-time insights & monitoring',
    description: 'Track agent performance, accuracy metrics, and latency in real-time. Get alerts for errors and monitor compliance across your entire AI workforce.',
    icon: '📊'
  }
];

// Stripe payment links
const STRIPE_LINKS = {
  monthly: 'https://buy.stripe.com/14A3cu5Y43iM4ng2LU8Zq00',
  annual: 'https://buy.stripe.com/7sYeVc9ag1aEf1UfyG8Zq01',
};

// Pricing tiers
const pricing = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: '',
    badge: null,
    description: 'Perfect for individuals exploring AI-powered workflows.',
    features: [
      'Up to 3 AI agents',
      '5 document generations / month',
      'Basic analytics dashboard',
      'Email support',
      'Community access'
    ],
    cta: 'Get Started Free',
    href: null as string | null,
    popular: false
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: 15,
    period: '/mo',
    badge: 'Most Popular',
    description: 'For professionals who need full power, no commitment.',
    features: [
      'Unlimited AI agents',
      'Unlimited document generation',
      'All 6 document templates',
      'Communications agent',
      'Priority support',
      'Advanced analytics',
      'API access'
    ],
    cta: 'Subscribe Monthly',
    href: STRIPE_LINKS.monthly,
    popular: true
  },
  {
    id: 'annual',
    name: 'Annual',
    price: 150,
    period: '/yr',
    badge: 'Save $30',
    description: 'Best value — everything in Monthly at 2 months free.',
    features: [
      'Everything in Monthly',
      'Custom agent training',
      'Dedicated account manager',
      'SSO & advanced security',
      'Unlimited storage',
      'Custom integrations',
      'SLA guarantee'
    ],
    cta: 'Subscribe Annually',
    href: STRIPE_LINKS.annual,
    popular: false
  }
];

// FAQ items
const faqs = [
  {
    q: "What AI agents are available?",
    a: "CrewOS includes 12+ pre-built agents: Invoice Processing, Support Triage, Content Writer, Code Review, Compliance Monitor, Contract Review, Receipt Scanner, Research Analyst, and more. Plus 6 document generation models."
  },
  {
    q: "How does document generation work?",
    a: "Select a template (lease, MSA, invoice, COI, vendor package, or employment agreement), answer guided intake questions, and our AI generates a fully formatted, legally compliant document in under 3 minutes."
  },
  {
    q: "Is my data secure?",
    a: "Absolutely. We use bank-level encryption (AES-256) for all data at rest and in transit. Your data is stored in SOC 2 certified data centers with regular security audits."
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes. Monthly subscriptions can be canceled at any time. Annual subscriptions can be canceled and will remain active until the end of the billing period. No hidden fees."
  },
  {
    q: "What integrations are available?",
    a: "CrewOS integrates with Slack, Google Workspace, Microsoft 365, Salesforce, HubSpot, and 50+ other tools. We also offer a full REST API for custom integrations."
  }
];

// Stats
const stats = [
  { value: '12+', label: 'AI Agents' },
  { value: '99.8%', label: 'Accuracy' },
  { value: '6', label: 'Doc Templates' },
  { value: '<3min', label: 'Generation Time' }
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
                <path d="M22 11.5Q22 8 16 8Q10 8 10 11.5V20.5Q10 24 16 24Q22 24 22 20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <span className="nav-brand-text">CrewOS</span>
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
            <span className="badge-icon">⚡</span>
            <span>AI Agent Workforce Platform</span>
          </div>
          
          <h1 className="hero-title">
            Deploy AI agents that
            <span className="gradient-text"> work for you</span>
          </h1>
          
          <p className="hero-subtitle">
            Build, train, and manage intelligent AI agents and generate professional documents — 
            all from one powerful platform.
          </p>

          <div className="hero-cta">
            <button className="btn-primary large" onClick={handleGetStarted}>
              Start for Free
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <button className="btn-secondary large" onClick={() => scrollToSection('pricing')}>
              View Pricing
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
              <span className="preview-title">CrewOS — Agent Workforce</span>
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
            <div className="floating-icon">🤖</div>
            <div className="floating-text">
              <span className="floating-title">Agent deployed</span>
              <span className="floating-sub">Invoice Processing v3.0</span>
            </div>
          </div>
          
          <div className="floating-card card-2">
            <div className="floating-icon">📄</div>
            <div className="floating-text">
              <span className="floating-title">Document generated</span>
              <span className="floating-sub">Commercial Lease — 34 pages</span>
            </div>
          </div>
          
          <div className="floating-card card-3">
            <div className="floating-icon">⚡</div>
            <div className="floating-text">
              <span className="floating-title">98.7% accuracy</span>
              <span className="floating-sub">All agents running</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features">
        <div className="section-container">
          <div className="section-header">
            <span className="section-label">Features</span>
            <h2>Everything you need to run AI at scale</h2>
            <p>CrewOS brings together AI agents, document generation, and analytics in one platform.</p>
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
              <h3>Choose your agents</h3>
              <p>Browse our catalog of 12+ AI agents and 6 document generation models. Deploy in one click.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Configure & deploy</h3>
              <p>Select versions, set parameters, and deploy agents to your workforce. Monitor in real-time.</p>
            </div>
            <div className="step-connector"></div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Scale with confidence</h3>
              <p>Track accuracy, latency, and uptime. Let AI handle the work while you focus on strategy.</p>
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
            <p>Start free. Upgrade when you need full power.</p>
          </div>

          <div className="pricing-grid">
            {pricing.map((plan) => (
              <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
                {plan.badge && <span className={`popular-badge ${plan.id === 'annual' ? 'save-badge' : ''}`}>{plan.badge}</span>}
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  {plan.price === 0 ? (
                    <span className="amount">Free</span>
                  ) : (
                    <>
                      <span className="currency">$</span>
                      <span className="amount">{plan.price}</span>
                      <span className="period">{plan.period}</span>
                    </>
                  )}
                </div>
                {plan.id === 'annual' && (
                  <div className="plan-savings">That's just $12.50/mo — save $30 vs monthly</div>
                )}
                <p className="plan-description">{plan.description}</p>
                {plan.href ? (
                  <a 
                    className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`}
                    href={plan.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button 
                    className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`}
                    onClick={handleGetStarted}
                  >
                    {plan.cta}
                  </button>
                )}
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

          <div className="pricing-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Secure payments powered by Stripe. Cancel anytime.
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
                <p>"CrewOS's document generation saved our legal team 40 hours a month. Lease agreements that took days now take minutes."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">SK</div>
                <div className="author-info">
                  <span className="author-name">Sarah Kim</span>
                  <span className="author-role">General Counsel, Realty Holdings</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"We deployed the support triage agent and cut our response time by 70%. The accuracy is incredible."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">MJ</div>
                <div className="author-info">
                  <span className="author-name">Mike Johnson</span>
                  <span className="author-role">VP of Support, ScaleUp</span>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-content">
                <p>"The invoice processing agent handles 98.7% of our documents automatically. It paid for itself in a week."</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">EC</div>
                <div className="author-info">
                  <span className="author-name">Emily Chen</span>
                  <span className="author-role">CFO, TechForward</span>
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
            <h2>Ready to deploy your AI workforce?</h2>
            <p>Join hundreds of teams using CrewOS to automate their operations.</p>
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
                  <path d="M22 11.5Q22 8 16 8Q10 8 10 11.5V20.5Q10 24 16 24Q22 24 22 20.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                  <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.9"/>
                </svg>
                <span>CrewOS</span>
              </div>
              <p>AI agent workforce platform for modern teams.</p>
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
            <p>© 2026 CrewOS. All rights reserved.</p>
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
