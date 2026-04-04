import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, ArrowRight, Github, Linkedin, Twitter,
  Mail, Send, Hash, Settings, Triangle,
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
  visible: { transition: { staggerChildren: 0.12 } },
};

const products = [
  {
    color: 'orange',
    emoji: '📄',
    name: 'Document Intelligence',
    desc: 'Not a GPT wrapper — six specialized models trained on your corpus. OCR, table extraction, classification, structure generation, and cross-reference validation.',
    features: [
      'Lease agreements, MSAs, invoices, COIs generation',
      'Template replication with variable detection',
      'PDF & DOCX export with formatting preservation',
    ],
    tech: ['React', 'TypeScript', 'OpenAI', 'Firebase', 'PDF.js'],
  },
  {
    color: 'blue',
    emoji: '📬',
    name: 'Communications Agent',
    desc: 'AI-powered inbox that reads, understands, and drafts responses across Gmail, Slack, and Teams. Smart prioritization with VIP detection and context-aware replies.',
    features: [
      'Unified inbox across Gmail, Slack, and Teams',
      'AI-drafted replies matching your writing style',
      'VIP detection and smart message prioritization',
    ],
    tech: ['Gmail API', 'Slack SDK', 'MS Graph', 'Node.js', 'OAuth 2.0'],
  },
  {
    color: 'purple',
    emoji: '📊',
    name: 'Sales Intelligence',
    desc: 'Predictive lead scoring, deal velocity tracking, and competitive intelligence. Automatically surfaces upsell opportunities and alerts on stalling deals.',
    features: [
      'AI-powered lead scoring with 92% accuracy',
      'Deal velocity tracking and win prediction',
      'Automated competitive intel gathering',
    ],
    tech: ['HubSpot', 'React', 'TypeScript', 'Charts', 'ML Pipeline'],
  },
  {
    color: 'green',
    emoji: '⚡',
    name: 'Workflow Builder',
    desc: 'Visual drag-and-drop automation builder powered by n8n. Connect 400+ integrations and deploy autonomous agent workflows in minutes.',
    features: [
      'Visual node-based workflow editor',
      '400+ pre-built integrations via n8n',
      'Real-time execution logs and monitoring',
    ],
    tech: ['n8n', 'React Flow', 'Node.js', 'Firebase', 'Docker'],
  },
];

const skills = [
  'React', 'TypeScript', 'Node.js', 'Firebase', 'OpenAI',
  'n8n', 'Vite', 'Express', 'Gmail API', 'Slack SDK',
  'MS Graph', 'HubSpot', 'Docker', 'OAuth 2.0', 'React Flow',
  'Framer Motion', 'Radix UI', 'PDF.js', 'Git', 'Cloud Functions',
  'Firestore', 'REST APIs', 'WebSockets', 'CI/CD',
];

const marqueeWords = [
  'INTELLIGENT', 'AUTOMATED', 'SCALABLE', 'ENTERPRISE',
  'RELIABLE', 'SECURE', 'REAL-TIME', 'AUTONOMOUS',
];

const testimonials = [
  { quote: 'OperonAI cut our email response time by 80%. The AI drafts are indistinguishable from what I would write.', name: 'Sarah Chen', role: 'VP of Operations', initials: 'SC', av: 1 },
  { quote: 'The document intelligence pipeline is genuinely impressive. Not a toy — it handles our 50-page contracts flawlessly.', name: 'Marcus Johnson', role: 'Legal Director', initials: 'MJ', av: 2 },
  { quote: 'We deployed 12 agents in the first week. The visual builder makes it accessible to non-technical team members.', name: 'Priya Patel', role: 'CTO, TechForward', initials: 'PP', av: 3 },
  { quote: 'The sales intelligence module predicted deal outcomes better than our seasoned reps. Game changer for pipeline management.', name: 'Alex Rodriguez', role: 'Sales Director', initials: 'AR', av: 4 },
  { quote: 'Finally, an AI platform that understands enterprise needs. SOC2 compliant, self-hosted option, and genuinely useful.', name: 'Emily Nakamura', role: 'CISO', initials: 'EN', av: 5 },
  { quote: 'Our team went from drowning in Slack noise to having every message triaged and prioritized automatically.', name: 'David Park', role: 'Engineering Manager', initials: 'DP', av: 6 },
];

const SOCIAL_PROOF_STATS = [
  { value: 10000, label: 'Documents Generated' },
  { value: 500, label: 'Teams Using Operon' },
  { value: 3600, label: 'Agent Templates Ready' },
];

const INTEGRATIONS: { name: string; icon: React.ReactNode }[] = [
  { name: 'Gmail', icon: <Mail size={15} className="op-social-proof-logo-icon" /> },
  { name: 'Slack', icon: <Hash size={15} className="op-social-proof-logo-icon" /> },
  {
    name: 'Microsoft Teams',
    icon: (
      <span className="op-social-proof-logo-icon op-social-proof-logo-letter" aria-hidden>T</span>
    ),
  },
  { name: 'HubSpot', icon: <Settings size={15} className="op-social-proof-logo-icon" /> },
  { name: 'Google Drive', icon: <Triangle size={15} className="op-social-proof-logo-icon" /> },
  {
    name: 'Notion',
    icon: (
      <span className="op-social-proof-logo-icon op-social-proof-logo-letter" aria-hidden>N</span>
    ),
  },
];

/* Showcase: full-width portfolio sections, black + orange only. Panels are freestanding in a collage (no card/box). */
function ShowcaseCollagePanels({ productName, inView }: { productName: string; inView: boolean }) {
  const [expanded, setExpanded] = React.useState(true);
  React.useEffect(() => {
    const t = setInterval(() => setExpanded((e) => !e), 4000);
    return () => clearInterval(t);
  }, []);

  if (productName === 'Document Intelligence') {
    const extractRows = ['Party A: Acme Corp', 'Value: $48,000', 'State: California', 'Confidence: 99.1%'];
    return (
      <>
        <div className="op-showcase-panel op-showcase-panel--back" style={{ transform: 'rotate(-4deg)' }}>
          <div className="op-showcase-panel-inner op-showcase-doc-preview">
            <div className="op-showcase-doc-preview-title">Commercial Lease Agreement</div>
            <motion.div className="op-showcase-scan-line" animate={{ top: ['0%', '100%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }} />
            <div className="op-showcase-doc-preview-section">§1 Parties ✓</div>
            <div className="op-showcase-doc-preview-section">§2 Lease Terms ✓</div>
            <div className="op-showcase-doc-preview-section">§3 Payment ✓</div>
            <div className="op-showcase-doc-preview-section op-showcase-doc-preview-section--last">§4 Jurisdiction…</div>
          </div>
        </div>
        <div className="op-showcase-panel op-showcase-panel--front" style={{ transform: 'rotate(3deg)' }}>
          <div className="op-showcase-panel-inner op-showcase-extract">
            {extractRows.map((text) => (
              <div key={text} className="op-showcase-extract-row">{text}</div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (productName === 'Communications Agent') {
    return (
      <>
        <div className="op-showcase-panel op-showcase-panel--back" style={{ transform: 'rotate(4deg)' }}>
          <div className="op-showcase-panel-inner">
            <div className="op-showcase-comm-inbox-row">
              <span>⭐ John Miller (VIP)</span>
              <span className="op-showcase-pill">VIP</span>
            </div>
            <div className="op-showcase-comm-inbox-row">
              <span>Sarah Chen — Draft Ready</span>
              <span className="op-showcase-pill">Draft Ready</span>
            </div>
            <div className="op-showcase-comm-inbox-row op-showcase-comm-inbox-row--muted">
              <span>Team Slack · 8 mentions</span>
            </div>
          </div>
        </div>
        <div className="op-showcase-panel op-showcase-panel--front" style={{ transform: 'rotate(-3deg)' }}>
          <div className="op-showcase-panel-inner">
            <div className="op-showcase-draft-header">Matching your voice</div>
            <div className="op-showcase-draft-text">Thanks for sending this over. I’ve reviewed the terms and we’re aligned on the key points.<span className="op-showcase-cursor" /></div>
            <motion.div className="op-showcase-draft-actions" animate={{ height: expanded ? 28 : 0, opacity: expanded ? 1 : 0.7 }} transition={{ duration: 0.4 }}>
              <button type="button" className="op-showcase-btn op-showcase-btn--primary">✓ Approve</button>
            </motion.div>
          </div>
        </div>
      </>
    );
  }

  if (productName === 'Sales Intelligence') {
    const leads = [
      { name: 'Acme Corp', score: 87, opacity: 1 },
      { name: 'TechForward', score: 64, opacity: 0.6 },
      { name: 'InnovateCo', score: 31, opacity: 0.3 },
    ];
    return (
      <>
        <div className="op-showcase-panel op-showcase-panel--back" style={{ transform: 'rotate(-4deg)' }}>
          <div className="op-showcase-panel-inner">
            {leads.map((lead) => (
              <div key={lead.name} className="op-showcase-sales-lead-row">
                <span>{lead.name} · {lead.score}/100</span>
                <div className="op-showcase-sales-bar-wrap">
                  <motion.div
                    className="op-showcase-sales-bar op-showcase-sales-bar--orange"
                    style={{ width: inView ? `${lead.score}%` : '0%', opacity: lead.opacity }}
                    transition={{ delay: 0.2, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="op-showcase-panel op-showcase-panel--front" style={{ transform: 'rotate(3deg)' }}>
          <div className="op-showcase-panel-inner">
            <div className="op-showcase-sales-insight-text">⚠ Deal at risk: TechForward engagement dropped 23%</div>
            <button type="button" className="op-showcase-btn op-showcase-btn--primary op-showcase-btn--block">Next Best Action →</button>
            <div className="op-showcase-sales-forecast">$284K forecast</div>
          </div>
        </div>
      </>
    );
  }

  if (productName === 'Workflow Builder') {
    const nodes = [{ label: 'Email Trigger' }, { label: 'AI Classify' }, { label: 'Route' }, { label: 'Slack Notify' }];
    const templates = ['Email to Slack summary', 'VIP contact alert', 'Lead score update'];
    return (
      <>
        <div className="op-showcase-panel op-showcase-panel--back" style={{ transform: 'rotate(4deg)' }}>
          <div className="op-showcase-panel-inner">
            <div className="op-showcase-workflow-canvas">
              {nodes.map((node, i) => (
                <React.Fragment key={node.label}>
                  <div className="op-showcase-workflow-node">{node.label}</div>
                  {i < nodes.length - 1 && <div className="op-showcase-workflow-line" />}
                </React.Fragment>
              ))}
              <motion.div className="op-showcase-workflow-dot" animate={{ left: ['0%', '25%', '50%', '75%', '100%', '0%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
            </div>
          </div>
        </div>
        <div className="op-showcase-panel op-showcase-panel--front" style={{ transform: 'rotate(-3deg)' }}>
          <div className="op-showcase-panel-inner">
            <div className="op-showcase-template-title">Template library</div>
            {templates.map((t) => (
              <div key={t} className="op-showcase-template-row">
                <span>{t}</span>
                <button type="button" className="op-showcase-template-import">Import →</button>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return null;
}

const SHOWCASE_BADGES: Record<string, string> = {
  'Document Intelligence': '6 specialized models · 99.1% accuracy',
  'Communications Agent': 'Gmail · Slack · Teams',
  'Sales Intelligence': '94.2% scoring accuracy',
  'Workflow Builder': '4,343+ templates',
};

function ShowcaseSectionBlock({ product, index }: { product: typeof products[0]; index: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const copyOnLeft = index % 2 === 0; // 0, 2 = left; 1, 3 = right
  const copyFrom = copyOnLeft ? -40 : 40;
  const collageFrom = copyOnLeft ? 40 : -40;

  return (
    <section ref={ref} className={`op-showcase-section ${copyOnLeft ? 'op-showcase-section--left' : 'op-showcase-section--right'}`}>
      <div className="op-showcase-section-inner">
        <motion.div
          className="op-showcase-copy"
          initial={{ opacity: 0, x: copyFrom }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h2 className="op-showcase-copy-title"><span className="op-showcase-copy-dash">—</span> {product.name}</h2>
          <p className="op-showcase-copy-desc">{product.desc}</p>
          <ul className="op-showcase-copy-features">
            {product.features.map((f, i) => (
              <li key={f}><span className="op-showcase-copy-marker">{i === 0 ? '+' : '→'}</span> {f}</li>
            ))}
          </ul>
          <div className="op-showcase-tech-pills">
            {product.tech.map((t) => (
              <span key={t} className="op-showcase-tech-pill">{t}</span>
            ))}
          </div>
        </motion.div>
        <motion.div
          className="op-showcase-collage"
          initial={{ opacity: 0, x: collageFrom }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="op-showcase-collage-glow" />
          <ShowcaseCollagePanels productName={product.name} inView={inView} />
          <span className="op-showcase-floating-badge">{SHOWCASE_BADGES[product.name]}</span>
        </motion.div>
      </div>
    </section>
  );
}

function useCountUp(end: number, inView: boolean, durationMs = 2000) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;
    const start = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, end, durationMs]);
  return count;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clockTime, setClockTime] = useState('');
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const socialProofRef = useRef<HTMLDivElement>(null);
  const socialProofInView = useInView(socialProofRef, { once: true, margin: '-80px' });
  const stat1 = useCountUp(SOCIAL_PROOF_STATS[0].value, socialProofInView);
  const stat2 = useCountUp(SOCIAL_PROOF_STATS[1].value, socialProofInView);
  const stat3 = useCountUp(SOCIAL_PROOF_STATS[2].value, socialProofInView);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const scrollTo = (sel: string) => {
    document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="op-landing">
      {/* Nav */}
      <nav className={`op-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="op-nav-brand" onClick={() => scrollTo('.op-hero')}>
          <Zap size={20} className="op-nav-logo" />
          <span className="op-nav-name">OperonAI</span>
        </div>

        <div className={`op-nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <button onClick={() => scrollTo('.op-showcase')}>Products</button>
          <button onClick={() => scrollTo('.op-skills')}>Stack</button>
          <button onClick={() => scrollTo('.op-about')}>About</button>
          <button onClick={() => scrollTo('.op-testimonials')}>Voices</button>
        </div>

        <button className="op-nav-cta" onClick={onGetStarted}>Get Started</button>

        <button className="op-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <span /><span /><span />
        </button>
      </nav>

      {/* Hero */}
      <section className="op-hero">
        {/* Ambient orb */}
        <motion.div
          className="op-hero-orb"
          aria-hidden="true"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="op-hero-bg-overlay" aria-hidden="true" />

        <div className="op-hero-inner">
          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="op-hero-trust-pill">
              <span className="op-badge-dot" />
              ⚡ Trusted by 500+ teams
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="op-hero-title"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          >
            Automate the boring stuff. No coding needed.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="op-hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
          >
            Tell AI what you need in plain English — emails, documents, sales tracking, and more — and it handles the rest.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="op-hero-cta-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.7 }}
          >
            <button className="op-hero-cta-primary" onClick={onGetStarted}>
              Get Started <ArrowRight size={18} />
            </button>
            <button className="op-hero-cta-secondary" onClick={() => scrollTo('.op-showcase')}>
              See How It Works
            </button>
          </motion.div>

          {/* Product mockup */}
          <motion.div
            className="op-hero-mockup"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 1.0 }}
          >
            <div className="op-hero-mockup-window">
              <div className="op-hero-mockup-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="op-hero-mockup-body">
                <div className="op-hero-mockup-header">
                  <div>
                    <div className="op-hero-mockup-title">Agent workforce</div>
                    <div className="op-hero-mockup-subtitle">Live tasks • 24/7 coverage</div>
                  </div>
                  <span className="op-hero-mockup-status-pill">
                    <span className="op-hero-mockup-status-dot" />
                    All systems online
                  </span>
                </div>
                <div className="op-hero-mockup-table">
                  <div className="op-hero-mockup-row head">
                    <span>Agent</span>
                    <span>Channel</span>
                    <span>Queue</span>
                    <span>Status</span>
                  </div>
                  <div className="op-hero-mockup-row">
                    <span>Contract reviewer</span>
                    <span>Documents</span>
                    <span>18 in review</span>
                    <span className="status success">Running</span>
                  </div>
                  <div className="op-hero-mockup-row">
                    <span>Inbox triage</span>
                    <span>Email</span>
                    <span>42 unread</span>
                    <span className="status success">Running</span>
                  </div>
                  <div className="op-hero-mockup-row">
                    <span>Sales follow-ups</span>
                    <span>CRM</span>
                    <span>9 this hour</span>
                    <span className="status idle">Idle</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="op-social-proof" ref={socialProofRef}>
        <div className="op-social-proof-inner">
          <div className="op-social-proof-stats">
            <div className="op-social-proof-stat">
              <span className="op-social-proof-number">{stat1.toLocaleString()}+</span>
              <span className="op-social-proof-label">{SOCIAL_PROOF_STATS[0].label}</span>
            </div>
            <div className="op-social-proof-divider" aria-hidden="true" />
            <div className="op-social-proof-stat">
              <span className="op-social-proof-number">{stat2.toLocaleString()}+</span>
              <span className="op-social-proof-label">{SOCIAL_PROOF_STATS[1].label}</span>
            </div>
            <div className="op-social-proof-divider" aria-hidden="true" />
            <div className="op-social-proof-stat">
              <span className="op-social-proof-number">{stat3.toLocaleString()}+</span>
              <span className="op-social-proof-label">{SOCIAL_PROOF_STATS[2].label}</span>
            </div>
          </div>
          <motion.div
            className="op-social-proof-logos"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="op-social-proof-logos-label">Integrates with</span>
            <div className="op-social-proof-logos-strip">
              {INTEGRATIONS.map(({ name, icon }) => (
                <span key={name} className="op-social-proof-logo-pill">
                  {icon}
                  {name}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Interactive Cards */}
      <section className="op-cards-section">
        <div className="op-section">
          <div className="op-label">VENTURE</div>

          <motion.div className="op-cards-grid" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            {/* Profile Card */}
            <motion.div className="op-icard op-icard-profile" variants={fadeUp}>
              <div>
                <div className="op-icard-avatar">O</div>
                <div className="op-icard-name">OperonAI</div>
                <div className="op-icard-role">{'< Crafting Intelligent Workflows />'}</div>
              </div>
              <div className="op-icard-carousel">
                <div className="op-carousel-img">📄</div>
                <div className="op-carousel-img">📬</div>
                <div className="op-carousel-img">📊</div>
                <div className="op-carousel-img">⚡</div>
              </div>
            </motion.div>

            {/* Center Card — Clock + Globe */}
            <motion.div className="op-icard op-icard-center" variants={fadeUp}>
              <div className="op-clock-wrap">
                <span className="op-clock-face">{clockTime}</span>
              </div>
              <div className="op-globe-pins">
                <span className="op-globe-pin">🇺🇸 USA</span>
                <span className="op-globe-pin">🇬🇧 UK</span>
                <span className="op-globe-pin">🇮🇳 India</span>
              </div>
              <div className="op-feature-tags">
                <span className="op-ftag">Automation</span>
                <span className="op-ftag">Intelligence</span>
                <span className="op-ftag">Scale</span>
                <span className="op-ftag">Enterprise</span>
              </div>
            </motion.div>

            {/* Contact Card */}
            <motion.div className="op-icard op-icard-contact" variants={fadeUp}>
              <div>
                <div className="op-icard-status">
                  <span className="op-status-dot" />
                  Available for projects
                </div>
                <div className="op-icard-cta-title">Let's build something that actually works.</div>
                <div className="op-icard-cta-sub">AI automation for teams that ship.</div>
                <div className="op-icard-email">h e l l o @ o p e r o n . a i</div>
              </div>
              <button className="op-icard-btn" onClick={onGetStarted}>
                <Send size={16} style={{ display: 'inline', marginRight: 8 }} />
                Get Started
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Showcase — full-width portfolio sections, black + orange only */}
      <section className="op-showcase">
        <div className="op-showcase-intro">
          <span className="op-showcase-intro-label">WHAT WE BUILD</span>
          <h2 className="op-showcase-intro-heading">Four agents. Every workflow covered.</h2>
        </div>
        {products.map((p, i) => (
          <ShowcaseSectionBlock key={p.name} product={p} index={i} />
        ))}
      </section>

      {/* Skills */}
      <section className="op-skills">
        <div className="op-skills-header">
          <span className="op-label">OUR STACK</span>
          <h2>The Technology Behind</h2>
        </div>

        <motion.div className="op-skills-grid" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          {skills.map((s) => (
            <motion.div key={s} className="op-skill-badge" variants={fadeUp}>
              <span className="op-skill-icon">{s[0]}</span>
              {s}
            </motion.div>
          ))}
        </motion.div>

        <div className="op-marquee-wrap">
          <div className="op-marquee-track">
            {[...marqueeWords, ...marqueeWords].map((w, i) => (
              <React.Fragment key={i}>
                <span className="op-marquee-item">{w}</span>
                <span className="op-marquee-dot">★</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="op-about">
        <div className="op-about-inner">
          <div>
            <div className="op-about-label">A QUICK GLANCE</div>
            <h2 className="op-about-title">
              Building the bridge between <span className="op-about-accent">ideas and automation</span>
            </h2>
            <div className="op-about-text">
              <p>
                OperonAI is an engineering-driven platform that turns complex business workflows into autonomous agent systems. We manage the entire stack with a focus on reliability, security, and seamless integration.
              </p>
              <p>
                From communications triage to document generation, our AI agents handle the operational complexity so teams can focus on what matters — building and shipping.
              </p>
              <p className="op-about-highlight">
                Our platform is built to last, helping your team reach the next level.
              </p>
            </div>
          </div>
          <motion.div className="op-about-visual" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
            <motion.div className="op-about-card" variants={fadeUp}>
              <h4>🤖 Agent Workforce</h4>
              <p>Deploy and manage AI agents that run 24/7. Each agent is purpose-built for specific business functions with human-level understanding.</p>
            </motion.div>
            <motion.div className="op-about-card" variants={fadeUp}>
              <h4>🔗 Deep Integrations</h4>
              <p>Native connections to Gmail, Slack, Teams, HubSpot, and 400+ tools via n8n. Your agents work where your team works.</p>
            </motion.div>
            <motion.div className="op-about-card" variants={fadeUp}>
              <h4>🛡️ Enterprise Ready</h4>
              <p>SOC2 compliant, end-to-end encryption, and on-premise deployment options. Built for teams that take security seriously.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="op-testimonials">
        <div className="op-section">
          <div className="op-test-header">
            <span className="op-label">WHAT OTHERS SAY</span>
            <h2>The Voices Behind</h2>
          </div>

          <div className="op-test-scroll">
            {testimonials.map((t) => (
              <div key={t.name} className="op-test-card">
                <p>&ldquo;{t.quote}&rdquo;</p>
                <div className="op-test-author">
                  <div className={`op-test-avatar av-${t.av}`}>{t.initials}</div>
                  <div>
                    <span className="op-test-name">{t.name}</span>
                    <span className="op-test-role">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="op-footer-cta">
        <div className="op-gradient-ring">
          <div className="op-gradient-ring-inner">
            <Zap size={48} />
          </div>
        </div>
        <h2>Let's build something that actually works.</h2>
        <button className="op-cta-btn" onClick={onGetStarted}>
          Get Started <ArrowRight size={18} />
        </button>
      </section>

      {/* Footer */}
      <footer className="op-footer">
        <div className="op-footer-inner">
          <div className="op-footer-top">
            <div className="op-footer-brand">
              <div className="op-footer-logo">
                <Zap size={18} />
                <span>OPERON</span>
              </div>
              <p>AI-powered business automation that actually works. Built for teams that ship. Every workflow has a purpose.</p>
            </div>

            <div className="op-footer-cols">
              <div className="op-footer-col">
                <h4>General</h4>
                <button onClick={() => scrollTo('.op-hero')}>Home</button>
                <button onClick={() => scrollTo('.op-about')}>About</button>
                <button onClick={() => scrollTo('.op-footer-cta')}>Contact</button>
              </div>
              <div className="op-footer-col">
                <h4>Products</h4>
                <button onClick={onGetStarted}>Document Creator</button>
                <button onClick={onGetStarted}>Messages & Email</button>
                <button onClick={onGetStarted}>Sales Tracker</button>
                <button onClick={onGetStarted}>Automation Builder</button>
              </div>
              <div className="op-footer-col">
                <h4>Company</h4>
                <button>Careers</button>
                <button>Blog</button>
                <button>Security</button>
              </div>
              <div className="op-footer-col">
                <h4>Legal</h4>
                <button type="button" onClick={() => setLegalModal('privacy')}>
                  Privacy Policy
                </button>
                <button type="button" onClick={() => setLegalModal('terms')}>
                  Terms of Service
                </button>
              </div>
            </div>
          </div>

          <div className="op-footer-bottom">
            <p>&copy; 2026 OperonAI. All Rights Reserved.</p>
            <div className="op-footer-socials">
              <button aria-label="LinkedIn"><Linkedin size={16} /></button>
              <button aria-label="GitHub"><Github size={16} /></button>
              <button aria-label="Twitter"><Twitter size={16} /></button>
              <button aria-label="Email"><Mail size={16} /></button>
            </div>
          </div>
        </div>
      </footer>

      {/* Legal modals */}
      {legalModal && (
        <div className="op-legal-modal-backdrop" onClick={() => setLegalModal(null)}>
          <div
            className="op-legal-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="op-legal-modal-header">
              <h3>{legalModal === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</h3>
              <button
                type="button"
                className="op-legal-modal-close"
                onClick={() => setLegalModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="op-legal-modal-body">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    This is a demonstration privacy policy for OperonAI. No real user data is
                    collected or stored beyond what is required to show the product experience.
                  </p>
                  <ul>
                    <li>We use sample accounts and mock data in this demo environment.</li>
                    <li>Any information you enter is used only to simulate workflows.</li>
                    <li>Do not enter production secrets, live customer data, or sensitive information.</li>
                  </ul>
                  <p>
                    A production deployment would include a full privacy policy tailored to your
                    organization&apos;s legal and compliance requirements.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    These are demonstration terms of service for the OperonAI demo environment.
                    They are not a legally binding contract.
                  </p>
                  <ul>
                    <li>The demo is provided &quot;as is&quot; for evaluation and showcase purposes only.</li>
                    <li>No uptime, data retention, or support guarantees are provided in this environment.</li>
                    <li>Workflows, agents, and integrations are examples and may change without notice.</li>
                  </ul>
                  <p>
                    Production deployments would operate under a separate, formal agreement
                    negotiated with your legal and procurement teams.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
