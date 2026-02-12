import { useState } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import './PromptModal.css';

interface PromptModalProps {
  onClose: () => void;
  onSubmit: (prompt: string) => void;
}

export function PromptModal({ onClose, onSubmit }: PromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    // Simulate AI processing
    setTimeout(() => {
      onSubmit(prompt);
      setIsGenerating(false);
    }, 1000);
  };

  const examplePrompts = [
    'When I receive an email, analyze it with AI and create a task in Notion',
    'Every morning at 9 AM, check my calendar and send a summary email',
    'When a new lead is added to Salesforce, enrich it with data from HubSpot and send a Slack notification',
    'Monitor my Gmail for important emails, analyze them with AI, and save insights to my knowledge base',
    'When a form is submitted, process it with AI, update the database, and send a confirmation email',
  ];

  return (
    <div className="prompt-modal-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-modal-header">
          <div className="prompt-modal-header-left">
            <div className="prompt-modal-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="prompt-modal-title">Create Automation from Prompt</h2>
              <p className="prompt-modal-subtitle">
                Describe what you want to automate, and we'll build the workflow for you
              </p>
            </div>
          </div>
          <button className="prompt-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="prompt-modal-content">
          <div className="prompt-input-wrapper">
            <textarea
              className="prompt-input"
              placeholder="Example: When I receive an email, analyze it with AI and create a task in Notion..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
            />
            <div className="prompt-input-footer">
              <span className="prompt-hint">
                💡 Be specific about triggers, apps, and actions you want to connect
              </span>
            </div>
          </div>

          <div className="prompt-examples">
            <div className="prompt-examples-header">
              <span>Example Prompts:</span>
            </div>
            <div className="prompt-examples-list">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  className="prompt-example"
                  onClick={() => setPrompt(example)}
                >
                  <span>{example}</span>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="prompt-modal-footer">
          <button className="prompt-btn prompt-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="prompt-btn prompt-btn-primary"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <div className="prompt-spinner" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

