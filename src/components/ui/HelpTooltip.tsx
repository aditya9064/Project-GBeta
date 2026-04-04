/* ═══════════════════════════════════════════════════════════
   Help Tooltip — Contextual help that explains features
   in plain English. Shows on hover/click with a "?" icon.
   ═══════════════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTooltipProps {
  text: string;
  learnMoreUrl?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: number;
}

export function HelpTooltip({ text, learnMoreUrl, position = 'top', size = 14 }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible]);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setVisible(!visible)}
        onMouseEnter={() => setVisible(true)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--text-secondary, #94a3b8)',
          opacity: 0.6,
          transition: 'opacity 0.15s',
        }}
        onMouseOver={e => (e.currentTarget.style.opacity = '1')}
        onMouseOut={e => { if (!visible) e.currentTarget.style.opacity = '0.6'; }}
        aria-label="Help"
      >
        <HelpCircle size={size} />
      </button>

      {visible && (
        <div
          style={{
            position: 'absolute',
            ...positionStyles[position],
            zIndex: 9999,
            background: '#1e293b',
            color: '#e2e8f0',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.5,
            width: 240,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => setVisible(false)}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'none', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: 0,
            }}
          >
            <X size={12} />
          </button>
          <div>{text}</div>
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#60a5fa', fontSize: 12, marginTop: 6, display: 'inline-block' }}
            >
              Learn more →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export const HELP_TEXTS: Record<string, string> = {
  agents: 'Assistants are AI helpers that automate tasks for you — like answering emails, creating documents, or tracking sales. Think of them as virtual employees.',
  workflow: 'An automation is a series of steps that run automatically. For example: "When I get an email, summarize it and send a Slack message." You build these visually, no coding needed.',
  chat: 'Talk to your AI assistant in plain English. Just describe what you want done — like "summarize my emails from today" — and it will do it.',
  comms: 'Manage all your messages in one place. Read and send emails, Slack messages, and more — with AI helping you draft responses.',
  docai: 'Create professional documents automatically. Upload a template or describe what you need, and AI generates it for you — contracts, invoices, reports, and more.',
  sales: 'Track your sales pipeline, manage contacts, and get AI-powered insights to close more deals.',
  knowledge: 'Save important information that your assistants can reference. Like a shared brain for your team.',
  marketplace: 'Browse ready-made assistants and automations created by others. Install them with one click — no setup needed.',
  workforce: 'Organize your assistants into teams. Assign roles, set up coordination rules, and manage who does what.',
  logs: 'See everything your assistants have done — what tasks they ran, whether they succeeded, and how long they took.',
  settings: 'Customize your account, connect new tools, manage your team, and adjust how the platform works for you.',
  hooks: 'Hooks are automatic actions that run when something happens. For example: "Before sending any email, always check with me first."',
  plugins: 'Plugins add new capabilities to your platform. Install them to connect new services or add new features.',
  shell: 'Run commands on your computer directly from the browser. Useful for developers who want to test code or manage servers.',
  git: 'Track changes to your code, save versions, and collaborate with your team — all from within the platform.',
  tests: 'Run your code tests and see which ones pass or fail. The "fix until green" mode keeps retrying until everything works.',
  codebase: 'Explore and understand any code project. See the file structure, what languages are used, and get an AI summary of what the code does.',
  intelligence: 'Find errors in your code before they cause problems. Search for where functions are defined and used.',
  subagents: 'Create helper assistants that work on smaller tasks in parallel. Like delegating work to junior team members.',
  context: 'Set up instructions that every assistant follows automatically. Like an employee handbook for your AI team.',
  search: 'Search through code files instantly. Find any text, function, or pattern across your entire project.',
};
