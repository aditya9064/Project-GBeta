export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company?: string;
  companyLogo?: string;
  avatar?: string;
  phone?: string;
  title?: string;
  status: 'lead' | 'prospect' | 'customer' | 'churned';
  stage: 'awareness' | 'interest' | 'consideration' | 'intent' | 'evaluation' | 'purchase';
  value?: number;
  lastContact?: Date;
  nextFollowUp?: Date;
  tags?: string[];
  assignee?: User;
  createdAt: Date;
  updatedAt: Date;
  aiSummary?: string;
  aiInsights?: string[];
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  domain?: string;
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'enterprise';
  location?: string;
  description?: string;
  contacts?: Contact[];
  deals?: Deal[];
  value?: number;
  status: 'active' | 'inactive' | 'churned';
  createdAt: Date;
  updatedAt: Date;
  aiSummary?: string;
}

export interface Deal {
  id: string;
  name: string;
  value: number;
  stage: 'qualification' | 'meeting' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  company?: Company;
  contact?: Contact;
  assignee?: User;
  expectedCloseDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  aiInsights?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  assignee?: User;
  relatedContact?: Contact;
  relatedCompany?: Company;
  relatedDeal?: Deal;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  aiGenerated?: boolean;
  aiReason?: string;
}

export interface Activity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'task_completed' | 'deal_updated' | 'ai_insight';
  title: string;
  description?: string;
  user?: User;
  contact?: Contact;
  company?: Company;
  deal?: Deal;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AIAction[];
  insights?: string[];
}

export interface AIAction {
  id: string;
  type: 'create_task' | 'update_contact' | 'schedule_meeting' | 'send_email' | 'add_note';
  label: string;
  description?: string;
  executed?: boolean;
  data?: Record<string, unknown>;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  href: string;
  badge?: number | string;
  children?: NavItem[];
}

export type ViewMode = 'table' | 'board' | 'list' | 'timeline';
