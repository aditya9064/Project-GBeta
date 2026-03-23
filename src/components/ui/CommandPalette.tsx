import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Home,
  Bot,
  Mail,
  FileText,
  TrendingUp,
  GitBranch,
  ShoppingCart,
  Settings,
  Plus,
  Moon,
  Sun,
  Search,
  Users,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

interface Command {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  section: 'Navigation' | 'Actions' | 'Settings';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  theme: string;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({ isOpen, onClose, onNavigate, onToggleTheme, theme }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Command[] = useMemo(() => [
    { id: 'nav-home', icon: Home, label: 'Go to Dashboard', section: 'Navigation', action: () => onNavigate('/dashboard') },
    { id: 'nav-agents', icon: Bot, label: 'Go to Agents', section: 'Navigation', action: () => onNavigate('/agents') },
    { id: 'nav-workforce', icon: Users, label: 'Go to Crews & Orchestration', section: 'Navigation', action: () => onNavigate('/workforce') },
    { id: 'nav-chat', icon: Sparkles, label: 'Go to Chat Agent', section: 'Navigation', action: () => onNavigate('/chat') },
    { id: 'nav-comms', icon: Mail, label: 'Go to Communications', section: 'Navigation', action: () => onNavigate('/comms') },
    { id: 'nav-docai', icon: FileText, label: 'Go to Document AI', section: 'Navigation', action: () => onNavigate('/docai') },
    { id: 'nav-sales', icon: TrendingUp, label: 'Go to Sales', section: 'Navigation', action: () => onNavigate('/sales') },
    { id: 'nav-workflow', icon: GitBranch, label: 'Go to Workflow Builder', section: 'Navigation', action: () => onNavigate('/workflow') },
    { id: 'nav-knowledge', icon: FileText, label: 'Go to Knowledge Base', section: 'Navigation', action: () => onNavigate('/knowledge') },
    { id: 'nav-marketplace', icon: ShoppingCart, label: 'Go to Marketplace', section: 'Navigation', action: () => onNavigate('/marketplace') },
    { id: 'nav-settings', icon: Settings, label: 'Go to Settings', section: 'Navigation', action: () => onNavigate('/settings') },
    { id: 'act-new-agent', icon: Plus, label: 'Create New Agent', section: 'Actions', action: () => onNavigate('/workflow') },
    { id: 'set-theme', icon: theme === 'dark' ? Sun : Moon, label: 'Toggle Dark Mode', shortcut: '⌘D', section: 'Settings', action: onToggleTheme },
  ], [onNavigate, onToggleTheme, theme]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter(c => fuzzyMatch(c.label, query));
  }, [query, commands]);

  const sections = useMemo(() => {
    const order: Command['section'][] = ['Navigation', 'Actions', 'Settings'];
    return order
      .map(s => ({ section: s, items: filtered.filter(c => c.section === s) }))
      .filter(g => g.items.length > 0);
  }, [filtered]);

  const flatItems = useMemo(() => sections.flatMap(s => s.items), [sections]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = useCallback(() => {
    const cmd = flatItems[selectedIndex];
    if (cmd) {
      cmd.action();
      onClose();
    }
  }, [flatItems, selectedIndex, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % flatItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + flatItems.length) % flatItems.length);
          break;
        case 'Enter':
          e.preventDefault();
          executeSelected();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flatItems.length, executeSelected, onClose]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          background: theme === 'dark' ? '#1e1e2e' : '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 18px',
            borderBottom: `1px solid ${theme === 'dark' ? '#333' : '#e5e5e5'}`,
          }}
        >
          <Search size={18} style={{ color: theme === 'dark' ? '#888' : '#999', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 15,
              background: 'transparent',
              color: theme === 'dark' ? '#e0e0e0' : '#111',
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
              color: theme === 'dark' ? '#888' : '#999',
              fontFamily: 'inherit',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 0' }}>
          {flatItems.length === 0 && (
            <div style={{ padding: '24px 18px', textAlign: 'center', color: theme === 'dark' ? '#666' : '#999', fontSize: 14 }}>
              No matching commands
            </div>
          )}
          {sections.map(({ section, items }) => (
            <div key={section}>
              <div
                style={{
                  padding: '8px 18px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: theme === 'dark' ? '#777' : '#999',
                }}
              >
                {section}
              </div>
              {items.map(cmd => {
                const idx = runningIndex++;
                const isActive = idx === selectedIndex;
                const Icon = cmd.icon;
                return (
                  <div
                    key={cmd.id}
                    data-active={isActive}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 18px',
                      cursor: 'pointer',
                      margin: '0 6px',
                      borderRadius: 8,
                      background: isActive
                        ? (theme === 'dark' ? 'rgba(224,122,58,0.15)' : 'rgba(224,122,58,0.1)')
                        : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <Icon size={16} style={{ color: isActive ? '#e07a3a' : (theme === 'dark' ? '#aaa' : '#666'), flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: theme === 'dark' ? '#e0e0e0' : '#222' }}>
                      {cmd.label}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        style={{
                          fontSize: 11,
                          padding: '1px 5px',
                          borderRadius: 4,
                          border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
                          color: theme === 'dark' ? '#777' : '#aaa',
                          fontFamily: 'inherit',
                        }}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
