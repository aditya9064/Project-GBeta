import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowUp, X, Zap, ListTodo, Mail, Calendar, Lightbulb } from 'lucide-react';
import { IconButton } from '../ui';

interface AIInputBarProps {
  expanded: boolean;
  onToggleExpand: () => void;
}

const quickActions = [
  { id: 'task', label: 'Create a task', icon: ListTodo },
  { id: 'email', label: 'Draft an email', icon: Mail },
  { id: 'schedule', label: 'Schedule follow-up', icon: Calendar },
  { id: 'insights', label: 'Get insights', icon: Lightbulb },
];

const suggestions = [
  'What should I focus on today?',
  'Summarize my pipeline status',
  'Which deals need attention this week?',
  'Create follow-up tasks for overdue contacts',
];

export function AIInputBar({ expanded, onToggleExpand }: AIInputBarProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showSuggestions = isFocused && !value && !response;

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const handleSubmit = async () => {
    if (!value.trim()) return;
    setIsThinking(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setResponse(`Based on your request "${value}", I've identified 3 high-priority items for today.`);
    setIsThinking(false);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div style={{ position: 'relative', padding: '1rem 1.5rem', background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border-subtle)' }}>
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '1.5rem',
              right: '1.5rem',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-ai)',
              borderRadius: 16,
              padding: '1rem',
              marginBottom: '0.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-ai)' }}>
              <div style={{ width: 24, height: 24, background: 'var(--color-ai-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} />
              </div>
              <span style={{ flex: 1 }}>Nova AI</span>
              <IconButton aria-label="Dismiss" size="sm" onClick={() => setResponse(null)}><X size={14} /></IconButton>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.625 }}>{response}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'var(--color-bg-primary)',
        border: `1px solid ${isFocused ? 'var(--color-ai)' : 'var(--color-border-default)'}`,
        borderRadius: 16,
        boxShadow: isFocused ? '0 0 0 3px var(--color-ai-muted)' : 'none',
        transition: 'all 100ms ease',
      }}>
        <div style={{ color: 'var(--color-ai)' }}>
          {isThinking ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Zap size={18} />
            </motion.div>
          ) : (
            <Sparkles size={18} />
          )}
        </div>

        <textarea
          ref={inputRef}
          placeholder="Ask Nova anything..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isThinking}
          style={{
            flex: 1,
            resize: 'none',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            background: 'transparent',
            minHeight: 24,
            maxHeight: 120,
          }}
        />

        <AnimatePresence>
          {value && (
            <motion.button
              onClick={handleSubmit}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              disabled={isThinking}
              style={{
                width: 28,
                height: 28,
                background: 'var(--color-ai)',
                color: 'var(--color-text-inverse)',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUp size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        <kbd style={{ fontSize: 11, padding: '2px 6px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-subtle)', borderRadius: 4, color: 'var(--color-text-tertiary)' }}>⌘J</kbd>
      </div>

      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '1.5rem',
              right: '1.5rem',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 16,
              padding: '1rem',
              marginBottom: '0.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: '0.75rem' }}>
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleSuggestionClick(action.label)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-ai-muted)',
                    color: 'var(--color-ai)',
                    borderRadius: 9999,
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <action.icon size={14} />
                  {action.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: 'transparent',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
