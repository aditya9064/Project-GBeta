import { Contact, Task, Activity, User, Deal } from '../types';

export const currentUser: User = {
  id: 'u1',
  name: 'Sarah Chen',
  email: 'sarah@company.com',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
  role: 'admin'
};

export const teamMembers: User[] = [
  currentUser,
  { id: 'u2', name: 'Marcus Johnson', email: 'marcus@company.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face', role: 'member' },
  { id: 'u3', name: 'Emily Parker', email: 'emily@company.com', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face', role: 'member' },
  { id: 'u4', name: 'David Kim', email: 'david@company.com', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face', role: 'member' }
];

export const contacts: Contact[] = [
  {
    id: 'ct1', name: 'Alex Rivera', email: 'alex.rivera@stripe.com', company: 'Stripe',
    companyLogo: 'https://logo.clearbit.com/stripe.com',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face',
    phone: '+1 (415) 555-0123', title: 'VP of Engineering', status: 'customer', stage: 'purchase',
    value: 2500000, lastContact: new Date('2024-01-28'), nextFollowUp: new Date('2024-02-05'),
    tags: ['enterprise', 'technical', 'decision-maker'], assignee: teamMembers[0],
    createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-02-01'),
    aiSummary: 'Key decision maker at Stripe. Highly engaged and responsive.',
    aiInsights: ['Responds best to emails sent before 10 AM PST', 'Values ROI metrics over feature lists']
  },
  {
    id: 'ct2', name: 'Jordan Lee', email: 'jordan@notion.so', company: 'Notion',
    companyLogo: 'https://logo.clearbit.com/notion.so',
    avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&h=150&fit=crop&crop=face',
    phone: '+1 (415) 555-0456', title: 'Head of Operations', status: 'prospect', stage: 'consideration',
    value: 850000, lastContact: new Date('2024-01-25'), nextFollowUp: new Date('2024-02-02'),
    tags: ['growth-stage', 'operations'], assignee: teamMembers[1],
    createdAt: new Date('2024-02-10'), updatedAt: new Date('2024-02-01'),
    aiSummary: 'Actively evaluating solutions. Looking to streamline team workflows.'
  },
  {
    id: 'ct3', name: 'Sam Morgan', email: 'sam@linear.app', company: 'Linear',
    companyLogo: 'https://logo.clearbit.com/linear.app',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    phone: '+1 (415) 555-0789', title: 'CEO', status: 'lead', stage: 'interest',
    value: 320000, lastContact: new Date('2024-01-20'), nextFollowUp: new Date('2024-02-03'),
    tags: ['founder', 'product-led'], assignee: teamMembers[2],
    createdAt: new Date('2024-01-20'), updatedAt: new Date('2024-02-01'),
    aiSummary: 'Founder-led company with strong product focus. Values simplicity.'
  },
  {
    id: 'ct4', name: 'Taylor Brooks', email: 'taylor@figma.com', company: 'Figma',
    companyLogo: 'https://logo.clearbit.com/figma.com',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
    phone: '+1 (415) 555-0321', title: 'Director of Sales', status: 'customer', stage: 'purchase',
    value: 1800000, lastContact: new Date('2024-01-30'), nextFollowUp: new Date('2024-02-10'),
    tags: ['enterprise', 'renewal'], assignee: teamMembers[0],
    createdAt: new Date('2023-11-15'), updatedAt: new Date('2024-02-01'),
    aiSummary: 'Long-term customer with upcoming renewal. High satisfaction scores.',
    aiInsights: ['Contract renewal in 45 days', 'Potential upsell opportunity: +$200K ARR']
  },
  {
    id: 'ct5', name: 'Casey Chen', email: 'casey@vercel.com', company: 'Vercel',
    companyLogo: 'https://logo.clearbit.com/vercel.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    phone: '+1 (415) 555-0654', title: 'CTO', status: 'prospect', stage: 'evaluation',
    value: 650000, lastContact: new Date('2024-01-27'), nextFollowUp: new Date('2024-02-04'),
    tags: ['technical', 'developer-focused'], assignee: teamMembers[3],
    createdAt: new Date('2024-01-05'), updatedAt: new Date('2024-02-01'),
    aiSummary: 'Technical buyer who values developer experience. Currently in evaluation phase.'
  }
];

export const deals: Deal[] = [
  { id: 'd1', name: 'Stripe Enterprise Expansion', value: 2500000, stage: 'negotiation', probability: 80, contact: contacts[0], assignee: teamMembers[0], expectedCloseDate: new Date('2024-02-28'), createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-02-01'), aiInsights: ['Deal velocity is 15% faster than average', 'Stakeholder alignment is strong'] },
  { id: 'd2', name: 'Notion Team Rollout', value: 850000, stage: 'proposal', probability: 60, contact: contacts[1], assignee: teamMembers[1], expectedCloseDate: new Date('2024-03-15'), createdAt: new Date('2024-02-10'), updatedAt: new Date('2024-02-01') },
  { id: 'd3', name: 'Figma Contract Renewal', value: 2000000, stage: 'closed_won', probability: 100, contact: contacts[3], assignee: teamMembers[0], expectedCloseDate: new Date('2024-01-15'), createdAt: new Date('2023-11-15'), updatedAt: new Date('2024-01-15') },
  { id: 'd4', name: 'Vercel Enterprise', value: 650000, stage: 'qualification', probability: 25, contact: contacts[4], assignee: teamMembers[3], expectedCloseDate: new Date('2024-04-30'), createdAt: new Date('2024-01-05'), updatedAt: new Date('2024-02-01') }
];

export const tasks: Task[] = [
  { id: 't1', title: 'Follow up with Alex Rivera on contract terms', description: 'Review the latest contract revision.', status: 'in_progress', priority: 'high', dueDate: new Date('2024-02-02'), assignee: teamMembers[0], relatedContact: contacts[0], tags: ['contract', 'negotiation'], createdAt: new Date('2024-01-28'), updatedAt: new Date('2024-02-01'), aiGenerated: true, aiReason: 'Contract was sent 3 days ago with no response.' },
  { id: 't2', title: 'Prepare demo for Notion team', description: 'Create a customized demo.', status: 'todo', priority: 'high', dueDate: new Date('2024-02-03'), assignee: teamMembers[1], relatedContact: contacts[1], tags: ['demo'], createdAt: new Date('2024-01-30'), updatedAt: new Date('2024-02-01') },
  { id: 't3', title: 'Send case study to Sam Morgan', status: 'todo', priority: 'medium', dueDate: new Date('2024-02-04'), assignee: teamMembers[2], relatedContact: contacts[2], tags: ['content'], createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-02-01'), aiGenerated: true, aiReason: 'Sam recently engaged with our blog post.' },
  { id: 't4', title: 'Schedule renewal discussion with Taylor', status: 'todo', priority: 'urgent', dueDate: new Date('2024-02-05'), assignee: teamMembers[0], relatedContact: contacts[3], tags: ['renewal'], createdAt: new Date('2024-02-01'), updatedAt: new Date('2024-02-01') },
  { id: 't5', title: 'Complete POC setup for Vercel', status: 'in_progress', priority: 'high', dueDate: new Date('2024-02-06'), assignee: teamMembers[3], relatedContact: contacts[4], tags: ['poc'], createdAt: new Date('2024-01-29'), updatedAt: new Date('2024-02-01') },
  { id: 't6', title: 'Review Q1 pipeline metrics', status: 'done', priority: 'medium', dueDate: new Date('2024-01-31'), assignee: teamMembers[0], tags: ['analytics'], createdAt: new Date('2024-01-25'), updatedAt: new Date('2024-01-31'), completedAt: new Date('2024-01-31') }
];

export const activities: Activity[] = [
  { id: 'a1', type: 'ai_insight', title: 'Deal velocity increased', description: 'Stripe deal is progressing 20% faster.', deal: deals[0], timestamp: new Date('2024-02-01T10:30:00') },
  { id: 'a2', type: 'email', title: 'Contract revision sent', user: teamMembers[0], contact: contacts[0], deal: deals[0], timestamp: new Date('2024-02-01T09:15:00') },
  { id: 'a3', type: 'meeting', title: 'Discovery call completed', user: teamMembers[1], contact: contacts[1], timestamp: new Date('2024-01-31T14:00:00') },
  { id: 'a4', type: 'call', title: 'Follow-up call with Casey', user: teamMembers[3], contact: contacts[4], timestamp: new Date('2024-01-31T11:00:00') },
  { id: 'a5', type: 'task_completed', title: 'Pipeline review completed', user: teamMembers[0], timestamp: new Date('2024-01-31T17:30:00') }
];

export const workspaces = [
  { id: 'w1', name: 'Acme Corp', icon: '🏢', color: '#6366F1' },
  { id: 'w2', name: 'Personal', icon: '👤', color: '#10B981' }
];
