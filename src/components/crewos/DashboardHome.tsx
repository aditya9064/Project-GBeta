import { useState, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  Zap,
  GitBranch,
  Plus,
  ArrowRight,
  Rocket,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  FileText,
  Mail,
  BarChart3,
  Play,
  Settings2,
  ExternalLink,
  Wand2,
  MessageSquare,
  BrainCircuit,
  Workflow,
} from 'lucide-react';
import './DashboardHome.css';

interface DeployedAgentSummary {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'idle' | 'error' | 'provisioning';
  category: string;
  accuracy?: string;
  latency?: string;
  icon: 'bot' | 'mail' | 'file' | 'chart' | 'workflow';
  createdAt: string;
}

interface DashboardHomeProps {
  agents: DeployedAgentSummary[];
  onCreateAgent: () => void;
  onPromptSubmit: (prompt: string) => void;
  onNavigateToWorkflow: () => void;
  onNavigateToAgents: () => void;
  onAgentClick: (agent: DeployedAgentSummary) => void;
}

const statusConfig = {
  running: { label: 'Running', color: '#16a34a', bg: 'rgba(22,163,74,0.12)', icon: CheckCircle2 },
  idle: { label: 'Idle', color: '#9a9ab0', bg: 'rgba(154,154,176,0.12)', icon: Clock },
  error: { label: 'Error', color: '#dc2626', bg: 'rgba(220,38,38,0.12)', icon: AlertCircle },
  provisioning: { label: 'Starting', color: '#e07a3a', bg: 'rgba(224,122,58,0.12)', icon: Loader2 },
};

const categoryIcons = {
  bot: Bot,
  mail: Mail,
  file: FileText,
  chart: BarChart3,
  workflow: GitBranch,
};

const examplePrompts = [
  "Create an agent that summarizes incoming emails and prioritizes urgent ones",
  "Build a workflow that extracts data from invoices and updates my spreadsheet",
  "Make an automation that monitors Slack for support requests and creates tickets",
  "Design an agent that generates weekly reports from my sales data",
];

export function DashboardHome({
  agents,
  onCreateAgent,
  onPromptSubmit,
  onNavigateToWorkflow,
  onNavigateToAgents,
  onAgentClick,
}: DashboardHomeProps) {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    onPromptSubmit(prompt.trim());
    
    // Simulate processing
    setTimeout(() => {
      setIsSubmitting(false);
      setPrompt('');
    }, 1500);
  }, [prompt, isSubmitting, onPromptSubmit]);

  const handleExampleClick = useCallback((example: string) => {
    setPrompt(example);
  }, []);

  const runningAgents = agents.filter(a => a.status === 'running');
  const recentAgents = agents.slice(0, 6);

  return (
    <div className="dashboard-home">
      {/* Hero Section with Prompt Input */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-glow" />
        
        <div className="dashboard-hero-badge">
          <Sparkles size={14} />
          <span>AI-Powered Automation</span>
        </div>

        <h1 className="dashboard-hero-title">
          What would you like to <span className="gradient-text">automate</span> today?
        </h1>
        
        <p className="dashboard-hero-subtitle">
          Describe your automation in plain English and we'll create an AI agent for you.
        </p>

        {/* Prompt Input */}
        <form className="dashboard-prompt-form" onSubmit={handleSubmit}>
          <div className="dashboard-prompt-container">
            <div className="dashboard-prompt-icon">
              <Wand2 size={20} />
            </div>
            <textarea
              className="dashboard-prompt-input"
              placeholder="e.g., Create an agent that monitors my inbox and summarizes important emails..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
            <button 
              type="submit" 
              className={`dashboard-prompt-submit ${isSubmitting ? 'loading' : ''}`}
              disabled={!prompt.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 size={20} className="spin" />
              ) : (
                <>
                  <span>Create Agent</span>
                  <Send size={18} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Example Prompts */}
        <div className="dashboard-examples">
          <span className="dashboard-examples-label">Try these:</span>
          <div className="dashboard-examples-list">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                className="dashboard-example-chip"
                onClick={() => handleExampleClick(example)}
              >
                <MessageSquare size={12} />
                <span>{example.length > 50 ? example.slice(0, 50) + '...' : example}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="dashboard-actions">
        <div className="dashboard-action-card" onClick={onCreateAgent}>
          <div className="dashboard-action-icon orange">
            <Plus size={24} />
          </div>
          <div className="dashboard-action-content">
            <h3>Deploy New Agent</h3>
            <p>Choose from 20+ pre-built AI agents</p>
          </div>
          <ArrowRight size={18} className="dashboard-action-arrow" />
        </div>

        <div className="dashboard-action-card" onClick={onNavigateToWorkflow}>
          <div className="dashboard-action-icon purple">
            <Workflow size={24} />
          </div>
          <div className="dashboard-action-content">
            <h3>Build Automation</h3>
            <p>Create custom workflows visually</p>
          </div>
          <ArrowRight size={18} className="dashboard-action-arrow" />
        </div>

        <div className="dashboard-action-card" onClick={onNavigateToAgents}>
          <div className="dashboard-action-icon blue">
            <BrainCircuit size={24} />
          </div>
          <div className="dashboard-action-content">
            <h3>Manage Agents</h3>
            <p>View and configure your AI workforce</p>
          </div>
          <ArrowRight size={18} className="dashboard-action-arrow" />
        </div>
      </section>

      {/* Stats Overview */}
      <section className="dashboard-stats">
        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Bot size={20} />
          </div>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-value">{agents.length}</span>
            <span className="dashboard-stat-label">Total Agents</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon running">
            <Play size={20} />
          </div>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-value">{runningAgents.length}</span>
            <span className="dashboard-stat-label">Running</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <TrendingUp size={20} />
          </div>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-value">--</span>
            <span className="dashboard-stat-label">Tasks Today</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="dashboard-stat-icon">
            <Zap size={20} />
          </div>
          <div className="dashboard-stat-content">
            <span className="dashboard-stat-value">--</span>
            <span className="dashboard-stat-label">Automations</span>
          </div>
        </div>
      </section>

      {/* Deployed Agents Section */}
      <section className="dashboard-agents-section">
        <div className="dashboard-section-header">
          <div className="dashboard-section-title">
            <Rocket size={20} />
            <h2>Your Deployed Agents</h2>
          </div>
          <button className="dashboard-section-link" onClick={onNavigateToAgents}>
            View All
            <ExternalLink size={14} />
          </button>
        </div>

        {recentAgents.length === 0 ? (
          <div className="dashboard-agents-empty">
            <div className="dashboard-agents-empty-icon">
              <Bot size={40} />
            </div>
            <h3>No agents deployed yet</h3>
            <p>Deploy your first AI agent to get started with automation</p>
            <button className="dashboard-agents-empty-cta" onClick={onCreateAgent}>
              <Plus size={18} />
              <span>Deploy Your First Agent</span>
            </button>
          </div>
        ) : (
          <div className="dashboard-agents-grid">
            {recentAgents.map((agent) => {
              const status = statusConfig[agent.status];
              const StatusIcon = status.icon;
              const CategoryIcon = categoryIcons[agent.icon] || Bot;
              
              return (
                <div
                  key={agent.id}
                  className="dashboard-agent-card"
                  onClick={() => onAgentClick(agent)}
                >
                  <div className="dashboard-agent-header">
                    <div className="dashboard-agent-icon">
                      <CategoryIcon size={18} />
                    </div>
                    <div
                      className="dashboard-agent-status"
                      style={{ background: status.bg, color: status.color }}
                    >
                      <StatusIcon size={12} className={agent.status === 'provisioning' ? 'spin' : ''} />
                      <span>{status.label}</span>
                    </div>
                  </div>
                  
                  <h4 className="dashboard-agent-name">{agent.name}</h4>
                  <p className="dashboard-agent-desc">{agent.description}</p>
                  
                  <div className="dashboard-agent-footer">
                    <span className="dashboard-agent-category">{agent.category}</span>
                    {agent.accuracy && agent.accuracy !== '—' && (
                      <span className="dashboard-agent-metric">{agent.accuracy} accuracy</span>
                    )}
                  </div>
                  
                  <button className="dashboard-agent-config">
                    <Settings2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardHome;

