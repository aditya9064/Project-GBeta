import { useState, useCallback, KeyboardEvent } from 'react';

interface AICalendarInputProps {
  onSubmit: (input: string) => void;
}

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L14.5 8.5L20 11L14.5 13.5L12 19L9.5 13.5L4 11L9.5 8.5L12 3Z"/>
  </svg>
);

const placeholders = [
  'Schedule a meeting with Sarah tomorrow at 4pm',
  'Book a 30-minute call with the Stripe team',
  'Set a daily standup at 10am for the next 2 weeks',
  'Remind me to follow up with Alex on Friday',
  'Schedule a demo with the marketing team',
];

export function AICalendarInput({ onSubmit }: AICalendarInputProps) {
  const [value, setValue] = useState('');
  const [placeholderIndex] = useState(
    Math.floor(Math.random() * placeholders.length)
  );

  const handleSubmit = useCallback(() => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue('');
    }
  }, [value, onSubmit]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="ai-calendar-input">
      <div className="ai-input-container">
        <div className="ai-input-icon">
          <SparklesIcon />
        </div>
        <input
          type="text"
          className="ai-input"
          placeholder={placeholders[placeholderIndex]}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="ai-input-hint">⏎</span>
      </div>
    </div>
  );
}










