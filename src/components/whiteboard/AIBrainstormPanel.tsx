import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AIBrainstormPanel.css';

// ============================================
// TYPES
// ============================================
export interface BrainstormIdea {
  id: string;
  content: string;
  role: ExpertRole;
  category: IdeaCategory;
  priority: 'high' | 'medium' | 'low';
  timestamp: Date;
}

type ExpertRole = 
  | 'strategist'
  | 'programmer'
  | 'ceo'
  | 'cfo'
  | 'cmo'
  | 'chairman'
  | 'manager'
  | 'designer'
  | 'analyst';

type IdeaCategory = 
  | 'strategy'
  | 'technical'
  | 'financial'
  | 'marketing'
  | 'operations'
  | 'design'
  | 'risk'
  | 'growth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  expertRole?: ExpertRole;
  ideas?: BrainstormIdea[];
  timestamp: Date;
}

interface AIBrainstormPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAddIdea: (idea: BrainstormIdea) => void;
  onAddMultipleIdeas: (ideas: BrainstormIdea[]) => void;
  context?: string; // Current whiteboard context/content
}

// ============================================
// ICONS
// ============================================
const Icons = {
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
      <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/>
      <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"/>
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  X: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Lightbulb: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8a6 6 0 0 0-12 0c0 1.28.5 2.5 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Target: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  DollarSign: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Code: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Megaphone: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l18-5v12L3 13v-2z"/>
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
    </svg>
  ),
  Shield: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Loader: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  Copy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10"/>
      <polyline points="1,20 1,14 7,14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
};

// ============================================
// EXPERT ROLES CONFIG
// ============================================
const expertRoles: { id: ExpertRole; label: string; icon: React.FC; color: string; description: string }[] = [
  { id: 'strategist', label: 'Strategist', icon: Icons.Target, color: '#8B5CF6', description: 'Strategic planning & vision' },
  { id: 'ceo', label: 'CEO', icon: Icons.Shield, color: '#EC4899', description: 'Executive leadership & decisions' },
  { id: 'cfo', label: 'CFO', icon: Icons.DollarSign, color: '#10B981', description: 'Financial planning & analysis' },
  { id: 'cmo', label: 'CMO', icon: Icons.Megaphone, color: '#F59E0B', description: 'Marketing & brand strategy' },
  { id: 'programmer', label: 'Tech Lead', icon: Icons.Code, color: '#3B82F6', description: 'Technical architecture & solutions' },
  { id: 'manager', label: 'Manager', icon: Icons.User, color: '#6366F1', description: 'Operations & team coordination' },
  { id: 'analyst', label: 'Analyst', icon: Icons.TrendingUp, color: '#14B8A6', description: 'Data insights & market analysis' },
];

// ============================================
// PROMPT TEMPLATES
// ============================================
const promptTemplates = [
  { label: 'Business Strategy', prompt: 'Help me develop a comprehensive business strategy for' },
  { label: 'Product Ideas', prompt: 'Generate innovative product ideas for' },
  { label: 'Problem Solving', prompt: 'Help me solve this challenge:' },
  { label: 'SWOT Analysis', prompt: 'Conduct a SWOT analysis for' },
  { label: 'Growth Hacking', prompt: 'Suggest growth strategies for' },
  { label: 'Revenue Model', prompt: 'Propose revenue models for' },
  { label: 'User Experience', prompt: 'Improve the user experience for' },
  { label: 'Market Entry', prompt: 'Develop a market entry strategy for' },
];

// ============================================
// AI RESPONSE GENERATOR (Simulated)
// ============================================
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const generateAIResponse = async (
  query: string,
  selectedRole: ExpertRole | 'all'
): Promise<{ response: string; ideas: BrainstormIdea[] }> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  // Generate expert-specific insights
  const roleResponses: Record<ExpertRole, { prefix: string; ideas: string[] }> = {
    strategist: {
      prefix: 'From a strategic perspective',
      ideas: [
        'Define clear market positioning to differentiate from competitors',
        'Develop a 3-year roadmap with measurable milestones',
        'Identify key partnerships for strategic growth',
        'Create contingency plans for market disruptions',
      ],
    },
    ceo: {
      prefix: 'As a CEO, I would recommend',
      ideas: [
        'Establish clear company vision and communicate it effectively',
        'Build a strong leadership team with diverse expertise',
        'Focus on sustainable growth over short-term gains',
        'Create a culture of innovation and accountability',
      ],
    },
    cfo: {
      prefix: 'From a financial standpoint',
      ideas: [
        'Implement robust financial forecasting models',
        'Optimize cash flow management and working capital',
        'Evaluate ROI for all major investments',
        'Establish risk management frameworks',
      ],
    },
    cmo: {
      prefix: 'From a marketing perspective',
      ideas: [
        'Develop a strong brand identity and messaging',
        'Create multi-channel marketing campaigns',
        'Leverage data analytics for customer insights',
        'Build community engagement strategies',
      ],
    },
    programmer: {
      prefix: 'From a technical architecture perspective',
      ideas: [
        'Design scalable system architecture for growth',
        'Implement CI/CD pipelines for faster deployment',
        'Prioritize security and data protection',
        'Use modular design for flexibility',
      ],
    },
    manager: {
      prefix: 'From an operational standpoint',
      ideas: [
        'Streamline workflows for maximum efficiency',
        'Establish clear KPIs and performance metrics',
        'Foster team collaboration and communication',
        'Implement agile project management practices',
      ],
    },
    chairman: {
      prefix: 'From a governance perspective',
      ideas: [
        'Ensure proper corporate governance structures',
        'Balance stakeholder interests effectively',
        'Maintain ethical business practices',
        'Plan for long-term sustainability',
      ],
    },
    designer: {
      prefix: 'From a design thinking perspective',
      ideas: [
        'Focus on user-centered design principles',
        'Create intuitive and accessible interfaces',
        'Iterate based on user feedback',
        'Maintain consistent brand aesthetics',
      ],
    },
    analyst: {
      prefix: 'Based on data analysis',
      ideas: [
        'Leverage market trends for strategic decisions',
        'Identify patterns in customer behavior',
        'Benchmark against industry standards',
        'Use predictive analytics for forecasting',
      ],
    },
  };

  let response = '';
  const ideas: BrainstormIdea[] = [];

  if (selectedRole === 'all') {
    // Generate comprehensive multi-expert response
    response = `I've analyzed your query "${query}" from multiple expert perspectives:\n\n`;
    
    const selectedExperts: ExpertRole[] = ['strategist', 'ceo', 'cfo', 'cmo', 'programmer'];
    
    selectedExperts.forEach((role, index) => {
      const roleData = roleResponses[role];
      response += `**${expertRoles.find(r => r.id === role)?.label}:**\n`;
      response += `${roleData.prefix}, here are key recommendations:\n`;
      
      roleData.ideas.slice(0, 2).forEach((idea, i) => {
        response += `${i + 1}. ${idea}\n`;
        ideas.push({
          id: generateId(),
          content: idea,
          role: role,
          category: getCategoryForRole(role),
          priority: i === 0 ? 'high' : 'medium',
          timestamp: new Date(),
        });
      });
      
      if (index < selectedExperts.length - 1) response += '\n';
    });
  } else {
    const roleData = roleResponses[selectedRole];
    response = `${roleData.prefix} on "${query}":\n\n`;
    
    roleData.ideas.forEach((idea, i) => {
      response += `${i + 1}. ${idea}\n`;
      ideas.push({
        id: generateId(),
        content: idea,
        role: selectedRole,
        category: getCategoryForRole(selectedRole),
        priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
        timestamp: new Date(),
      });
    });
  }

  return { response, ideas };
};

const getCategoryForRole = (role: ExpertRole): IdeaCategory => {
  const mapping: Record<ExpertRole, IdeaCategory> = {
    strategist: 'strategy',
    ceo: 'strategy',
    cfo: 'financial',
    cmo: 'marketing',
    programmer: 'technical',
    manager: 'operations',
    chairman: 'strategy',
    designer: 'design',
    analyst: 'growth',
  };
  return mapping[role];
};

// ============================================
// MAIN COMPONENT
// ============================================
export function AIBrainstormPanel({
  isOpen,
  onClose,
  onAddIdea,
  onAddMultipleIdeas,
}: AIBrainstormPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<ExpertRole | 'all'>('all');
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [addedIdeas, setAddedIdeas] = useState<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { response, ideas } = await generateAIResponse(inputValue.trim(), selectedRole);

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response,
        expertRole: selectedRole === 'all' ? undefined : selectedRole,
        ideas,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, selectedRole]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAddIdea = (idea: BrainstormIdea) => {
    onAddIdea(idea);
    setAddedIdeas(prev => new Set([...prev, idea.id]));
  };

  const handleAddAllIdeas = (ideas: BrainstormIdea[]) => {
    onAddMultipleIdeas(ideas);
    setAddedIdeas(prev => new Set([...prev, ...ideas.map(i => i.id)]));
  };

  const handlePromptTemplate = (prompt: string) => {
    setInputValue(prompt + ' ');
    inputRef.current?.focus();
  };

  const clearConversation = () => {
    setMessages([]);
    setAddedIdeas(new Set());
  };

  const getRoleColor = (role: ExpertRole) => {
    return expertRoles.find(r => r.id === role)?.color || '#8B5CF6';
  };

  const getCategoryColor = (category: IdeaCategory): string => {
    const colors: Record<IdeaCategory, string> = {
      strategy: '#8B5CF6',
      technical: '#3B82F6',
      financial: '#10B981',
      marketing: '#F59E0B',
      operations: '#6366F1',
      design: '#EC4899',
      risk: '#EF4444',
      growth: '#14B8A6',
    };
    return colors[category];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-brainstorm-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="ai-panel-header">
            <div className="ai-panel-title">
              <div className="ai-icon-wrapper">
                <Icons.Sparkles />
              </div>
              <div className="title-text">
                <h3>AI Brainstorm</h3>
                <span className="subtitle">Multi-expert advisor</span>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="header-btn" 
                onClick={clearConversation}
                title="Clear conversation"
              >
                <Icons.Refresh />
              </button>
              <button className="header-btn close-btn" onClick={onClose}>
                <Icons.X />
              </button>
            </div>
          </div>

          {/* Role Selector */}
          <div className="role-selector-section">
            <button 
              className="role-selector-trigger"
              onClick={() => setShowRoleSelector(!showRoleSelector)}
            >
              <span className="role-label">
                Consulting: {selectedRole === 'all' ? 'All Experts' : expertRoles.find(r => r.id === selectedRole)?.label}
              </span>
              <span className="role-toggle">{showRoleSelector ? '▲' : '▼'}</span>
            </button>
            
            <AnimatePresence>
              {showRoleSelector && (
                <motion.div
                  className="role-options"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <button
                    className={`role-option ${selectedRole === 'all' ? 'active' : ''}`}
                    onClick={() => { setSelectedRole('all'); setShowRoleSelector(false); }}
                  >
                    <div className="role-icon all-experts">
                      <Icons.Sparkles />
                    </div>
                    <div className="role-info">
                      <span className="role-name">All Experts</span>
                      <span className="role-desc">Get insights from all perspectives</span>
                    </div>
                  </button>
                  
                  {expertRoles.map(role => (
                    <button
                      key={role.id}
                      className={`role-option ${selectedRole === role.id ? 'active' : ''}`}
                      onClick={() => { setSelectedRole(role.id); setShowRoleSelector(false); }}
                    >
                      <div className="role-icon" style={{ backgroundColor: `${role.color}20`, color: role.color }}>
                        <role.icon />
                      </div>
                      <div className="role-info">
                        <span className="role-name">{role.label}</span>
                        <span className="role-desc">{role.description}</span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Messages Area */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icons.Lightbulb />
                </div>
                <h4>Start Brainstorming</h4>
                <p>Ask questions and get expert advice from multiple perspectives. Ideas can be added directly to your whiteboard.</p>
                
                <div className="prompt-templates">
                  <span className="templates-label">Quick prompts:</span>
                  <div className="templates-grid">
                    {promptTemplates.map((template, i) => (
                      <button
                        key={i}
                        className="template-chip"
                        onClick={() => handlePromptTemplate(template.prompt)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <div 
                    key={message.id} 
                    className={`message ${message.role}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="message-avatar">
                        <Icons.Sparkles />
                      </div>
                    )}
                    
                    <div className="message-content">
                      {message.role === 'assistant' && message.expertRole && (
                        <div 
                          className="expert-badge"
                          style={{ backgroundColor: `${getRoleColor(message.expertRole)}15`, color: getRoleColor(message.expertRole) }}
                        >
                          {expertRoles.find(r => r.id === message.expertRole)?.label}
                        </div>
                      )}
                      
                      <div className="message-text">{message.content}</div>
                      
                      {message.ideas && message.ideas.length > 0 && (
                        <div className="ideas-section">
                          <div className="ideas-header">
                            <span className="ideas-title">
                              <Icons.Lightbulb /> Generated Ideas ({message.ideas.length})
                            </span>
                            <button
                              className="add-all-btn"
                              onClick={() => handleAddAllIdeas(message.ideas!)}
                              disabled={message.ideas.every(i => addedIdeas.has(i.id))}
                            >
                              {message.ideas.every(i => addedIdeas.has(i.id)) ? (
                                <>
                                  <Icons.Check /> All Added
                                </>
                              ) : (
                                <>
                                  <Icons.Plus /> Add All to Board
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className="ideas-list">
                            {message.ideas.map(idea => (
                              <div 
                                key={idea.id} 
                                className={`idea-card ${addedIdeas.has(idea.id) ? 'added' : ''}`}
                                style={{ borderLeftColor: getCategoryColor(idea.category) }}
                              >
                                <div className="idea-content">
                                  <span className="idea-text">{idea.content}</span>
                                  <div className="idea-meta">
                                    <span 
                                      className="category-tag"
                                      style={{ backgroundColor: `${getCategoryColor(idea.category)}15`, color: getCategoryColor(idea.category) }}
                                    >
                                      {idea.category}
                                    </span>
                                    <span className={`priority-tag ${idea.priority}`}>
                                      {idea.priority}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  className="add-idea-btn"
                                  onClick={() => handleAddIdea(idea)}
                                  disabled={addedIdeas.has(idea.id)}
                                  title={addedIdeas.has(idea.id) ? 'Already added' : 'Add to whiteboard'}
                                >
                                  {addedIdeas.has(idea.id) ? <Icons.Check /> : <Icons.Plus />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="message assistant loading">
                    <div className="message-avatar">
                      <Icons.Loader />
                    </div>
                    <div className="message-content">
                      <div className="thinking-indicator">
                        <span>Consulting experts</span>
                        <div className="thinking-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="input-area">
            <div className="input-wrapper">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask for brainstorming help..."
                disabled={isLoading}
                rows={1}
              />
              <button 
                className="send-btn"
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isLoading}
              >
                {isLoading ? <Icons.Loader /> : <Icons.Send />}
              </button>
            </div>
            <div className="input-hint">
              Press Enter to send • Shift+Enter for new line
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AIBrainstormPanel;





