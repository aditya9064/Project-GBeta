import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Bot, FileText, BarChart3, Mail, Shield,
  ArrowRight, Check, ChevronDown, Send as SendIcon,
  Layers, Brain, Activity, Globe, Users, Star,
} from 'lucide-react';
import './LandingPage.css';

interface LandingPageProps {
  onGetStarted?: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.15 } },
};

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const el = document.querySelector('.nova-landing');
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: <Bot size={18} />,
      label: 'AI Agents',
      title: 'Autonomous Agent Workforce',
      desc: 'Deploy intelligent agents that handle complex workflows end-to-end. From email triage to document generation, your agents work 24/7 with human-level understanding.',
      mockIcon: '🤖',
      mockTitle: 'Agent Dashboard',
    },
    {
      icon: <Mail size={18} />,
      label: 'Communications',
      title: 'Unified Communications Hub',
      desc: 'AI-powered inbox that reads, understands, and drafts responses across Gmail, Slack, and Teams. Smart prioritization with VIP detection and context-aware replies.',
      mockIcon: '📬',
      mockTitle: 'Inbox Intelligence',
    },
    {
      icon: <FileText size={18} />,
      label: 'Document AI',
      title: 'Custom Document Intelligence',
      desc: 'Not a GPT wrapper — six specialized models trained on your corpus. OCR, table extraction, classification, structure generation, and cross-reference validation.',
      mockIcon: '📄',
      mockTitle: 'Document Pipeline',
    },
    {
      icon: <BarChart3 size={18} />,
      label: 'Sales Intelligence',
      title: 'AI-Driven Sales Pipeline',
      desc: 'Predictive lead scoring, deal velocity tracking, and competitive intelligence. Automatically surfaces upsell opportunities and alerts on stalling deals.',
      mockIcon: '📊',
      mockTitle: 'Pipeline Analytics',
    },
  ];

  const steps = [
    { title: 'Connect', desc: 'Link your Gmail, Slack, Teams, CRM, and internal tools in minutes.' },
    { title: 'Configure', desc: 'Use the visual builder to create agent workflows or pick from templates.' },
    { title: 'Deploy', desc: 'Agents go live instantly. Monitor, adjust, and scale as needed.' },
  ];

  const plans = [
    {
      name: 'Starter',
      price: '49',
      desc: 'For small teams getting started with automation.',
      features: ['3 AI agents', '1,000 actions/month', 'Email integration', 'Basic analytics', 'Community support'],
      popular: false,
    },
    {
      name: 'Professional',
      price: '149',
      desc: 'For growing teams that need full automation.',
      features: ['Unlimited agents', '25,000 actions/month', 'All integrations', 'Document AI', 'Sales Intelligence', 'Priority support'],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '499',
      desc: 'For organizations with advanced requirements.',
      features: ['Everything in Pro', 'Unlimited actions', 'Custom model training', 'SSO & RBAC', 'Dedicated CSM', 'SLA guarantee'],
      popular: false,
    },
  ];

  const testimonials = [
    { quote: 'OperonAI cut our email response time by 80%. The AI drafts are indistinguishable from what I would write.', name: 'Sarah Chen', role: 'VP of Operations', initials: 'SC' },
    { quote: 'The document intelligence pipeline is genuinely impressive. Not a toy — it handles our 50-page contracts flawlessly.', name: 'Marcus Johnson', role: 'Legal Director', initials: 'MJ' },
    { quote: 'We deployed 12 agents in the first week. The visual builder makes it accessible to non-technical team members.', name: 'Priya Patel', role: 'CTO', initials: 'PP' },
  ];

  const faqs = [
    { q: 'How is OperonAI different from ChatGPT or other AI tools?', a: 'OperonAI is purpose-built for business automation. Unlike general-purpose chatbots, our agents are trained on your specific data and workflows, with built-in integrations for Gmail, Slack, CRM, and more.' },
    { q: 'Is my data secure?', a: 'Absolutely. We use end-to-end encryption, SOC2 compliance, and your data never leaves your environment. We offer on-premise deployment for enterprise customers.' },
    { q: 'How long does it take to set up?', a: 'Most teams are up and running in under an hour. Connect your accounts, pick a template or build a custom workflow, and deploy — no code required.' },
    { q: 'Can I train the AI on my company\'s writing style?', a: 'Yes. Our style analysis engine learns from your past communications and documents to match your tone, formatting, and terminology.' },
  ];

  return (
    <div className="nova-landing">
      {/* Navigation */}
      <nav className={`nova-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-brand">
            <Zap size={24} className="nav-logo" />
            <span className="nav-brand-text">OperonAI</span>
          </div>

          <div className={`nav-links ${mobileMenuOpen ? 'open' : ''}`}>
            <button onClick={() => document.querySelector('.features')?.scrollIntoView({ behavior: 'smooth' })}>Product</button>
            <button onClick={() => document.querySelector('.how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How It Works</button>
            <button onClick={() => document.querySelector('.pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</button>
            <button onClick={() => document.querySelector('.testimonials')?.scrollIntoView({ behavior: 'smooth' })}>Testimonials</button>
          </div>

          <div className="nav-actions">
            <button className="nav-login">Log in</button>
            <button className="nav-cta" onClick={onGetStarted}>Get Started</button>
          </div>

          <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <motion.div className="hero-container" initial="hidden" animate="visible" variants={stagger}>
          <motion.div className="hero-badge" variants={fadeUp}>
            <span className="badge-icon">⚡</span>
            AI-Powered Business Automation
          </motion.div>

          <motion.h1 className="hero-title" variants={fadeUp}>
            We build <span className="gradient-text">AI agents</span> that deliver real impact.
          </motion.h1>

          <motion.p className="hero-subtitle" variants={fadeUp}>
            Deploy intelligent agents that automate communications, generate documents, and accelerate your sales pipeline — all from one platform.
          </motion.p>

          <motion.div className="hero-cta" variants={fadeUp}>
            <button className="btn-primary large" onClick={onGetStarted}>
              Start Free Trial <ArrowRight size={18} />
            </button>
            <button className="btn-secondary large" onClick={() => document.querySelector('.features')?.scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </button>
          </motion.div>

          <motion.div className="hero-stats" variants={fadeUp}>
            <div className="stat-item">
              <span className="stat-value">50K+</span>
              <span className="stat-label">Actions Automated</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">200+</span>
              <span className="stat-label">Teams Using</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">99.9%</span>
              <span className="stat-label">Uptime</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">4.9★</span>
              <span className="stat-label">Rating</span>
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="hero-visual" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}>
          <div className="app-preview">
            <div className="preview-header">
              <div className="preview-dots"><span /><span /><span /></div>
              <span className="preview-title">OperonAI — Agent Workforce</span>
            </div>
            <div className="preview-content">
              <div className="preview-sidebar">
                <div className="sidebar-item active" />
                <div className="sidebar-item" />
                <div className="sidebar-item" />
                <div className="sidebar-item" />
                <div className="sidebar-item" />
              </div>
              <div className="preview-main">
                <div className="preview-card" />
                <div className="preview-card" />
                <div className="preview-card wide" />
              </div>
            </div>
          </div>

          <div className="floating-card card-1">
            <span className="floating-icon">📧</span>
            <div className="floating-text">
              <span className="floating-title">Email Triaged</span>
              <span className="floating-sub">AI draft ready</span>
            </div>
          </div>
          <div className="floating-card card-2">
            <span className="floating-icon">📄</span>
            <div className="floating-text">
              <span className="floating-title">Contract Generated</span>
              <span className="floating-sub">12 pages · validated</span>
            </div>
          </div>
          <div className="floating-card card-3">
            <span className="floating-icon">📊</span>
            <div className="floating-text">
              <span className="floating-title">Lead Scored</span>
              <span className="floating-sub">Score: 92 — Hot</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="section-container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="section-label">Platform</span>
            <h2>Everything You Need</h2>
            <p>Four powerful modules working together as one intelligent platform.</p>
          </motion.div>

          <div className="features-tabs">
            <div className="tabs-nav">
              {features.map((f, i) => (
                <button key={i} className={`tab-btn ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
                  <span className="tab-icon">{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="tabs-content">
              {features.map((f, i) => (
                <div key={i} className={`tab-panel ${activeTab === i ? 'active' : ''}`}>
                  <div className="panel-text">
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                    <button className="btn-link" onClick={onGetStarted}>
                      Try it now <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="feature-mockup">
                    <div className="mockup-header">
                      <span className="mockup-icon">{f.mockIcon}</span>
                      {f.mockTitle}
                    </div>
                    <div className="mockup-content">
                      <div className="mockup-item" />
                      <div className="mockup-item short" />
                      <div className="mockup-item" />
                      <div className="mockup-item short" />
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
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="section-label">Simple Setup</span>
            <h2>Up and Running in Minutes</h2>
            <p>Three steps to transform your workflow.</p>
          </motion.div>

          <motion.div className="steps" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="step-connector" />}
                <motion.div className="step" variants={fadeUp}>
                  <div className="step-number">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </motion.div>
              </React.Fragment>
            ))}
          </motion.div>

          <div className="how-cta">
            <button className="btn-primary" onClick={onGetStarted}>
              Get Started Free <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing">
        <div className="section-container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="section-label">Pricing</span>
            <h2>Simple, Transparent Pricing</h2>
            <p>Start free. Scale when you're ready.</p>
          </motion.div>

          <motion.div className="pricing-grid" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {plans.map((plan) => (
              <motion.div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`} variants={fadeUp}>
                {plan.popular && <span className="popular-badge">Most Popular</span>}
                <div className="plan-name">{plan.name}</div>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">{plan.price}</span>
                  <span className="period">/mo</span>
                </div>
                <p className="plan-description">{plan.desc}</p>
                <button className={`plan-cta ${plan.popular ? 'primary' : 'secondary'}`} onClick={onGetStarted}>
                  Start Free Trial
                </button>
                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}><Check size={16} /> {f}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>

          <div className="pricing-note">
            <Shield size={16} /> 14-day free trial · No credit card required
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="section-container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="section-label">Testimonials</span>
            <h2>Trusted by Leading Teams</h2>
            <p>See what our customers have to say.</p>
          </motion.div>

          <motion.div className="testimonials-grid" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {testimonials.map((t) => (
              <motion.div key={t.name} className="testimonial-card" variants={fadeUp}>
                <div className="testimonial-content">
                  <p>"{t.quote}"</p>
                </div>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.initials}</div>
                  <div className="author-info">
                    <span className="author-name">{t.name}</span>
                    <span className="author-role">{t.role}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq">
        <div className="section-container">
          <motion.div className="section-header" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <span className="section-label">FAQ</span>
            <h2>Frequently Asked Questions</h2>
          </motion.div>

          <div className="faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {faq.q}
                  <ChevronDown size={20} className="faq-icon" />
                </button>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-content">
            <h2>Ready to automate your business?</h2>
            <p>Join hundreds of teams using OperonAI to work smarter, not harder.</p>
            <div className="cta-buttons">
              <button className="btn-primary" onClick={onGetStarted}>
                Start Free Trial <ArrowRight size={16} />
              </button>
              <button className="btn-secondary">
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
                <Zap size={20} />
                <span>OperonAI</span>
              </div>
              <p>AI-powered business automation that actually works. Built for teams that ship.</p>
            </div>

            <div className="footer-links">
              <div className="footer-column">
                <h4>Product</h4>
                <button>AI Agents</button>
                <button>Communications</button>
                <button>Document AI</button>
                <button>Sales Intelligence</button>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <button>About</button>
                <button>Careers</button>
                <button>Blog</button>
                <button>Contact</button>
              </div>
              <div className="footer-column">
                <h4>Resources</h4>
                <button>Documentation</button>
                <button>API Reference</button>
                <button>Status</button>
                <button>Changelog</button>
              </div>
            </div>
          </div>

          <div className="footer-newsletter">
            <h4>Stay in the loop</h4>
            <form onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="your@email.com" />
              <button type="submit">Subscribe</button>
            </form>
          </div>

          <div className="footer-bottom">
            <p>© 2026 OperonAI. All rights reserved.</p>
            <div className="footer-legal">
              <button>Privacy</button>
              <button>Terms</button>
              <button>Security</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
