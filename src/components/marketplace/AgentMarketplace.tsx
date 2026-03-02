/* ═══════════════════════════════════════════════════════════
   Agent Marketplace Component
   
   Public template gallery with search, categories, ratings,
   and one-click cloning.
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Star,
  Download,
  Filter,
  Grid,
  List,
  ChevronRight,
  Clock,
  TrendingUp,
  Award,
  Copy,
  ExternalLink,
  Users,
  Tag,
} from 'lucide-react';
import './AgentMarketplace.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type TemplateCategory = 
  | 'productivity' 
  | 'sales' 
  | 'marketing' 
  | 'support' 
  | 'engineering' 
  | 'data' 
  | 'communication'
  | 'automation'
  | 'other';

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  category: TemplateCategory;
  tags: string[];
  capabilities: string[];
  authorId: string;
  authorName: string;
  usageCount: number;
  rating: number;
  ratingCount: number;
  version: string;
  createdAt: string;
  publishedAt?: string;
}

interface TemplateReview {
  id: string;
  templateId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  createdAt: string;
}

const CATEGORY_ICONS: Record<TemplateCategory, string> = {
  productivity: '📋',
  sales: '💰',
  marketing: '📢',
  support: '🎧',
  engineering: '⚙️',
  data: '📊',
  communication: '💬',
  automation: '🤖',
  other: '📦',
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  productivity: 'Productivity',
  sales: 'Sales',
  marketing: 'Marketing',
  support: 'Support',
  engineering: 'Engineering',
  data: 'Data & Analytics',
  communication: 'Communication',
  automation: 'Automation',
  other: 'Other',
};

export function AgentMarketplace() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [featuredTemplates, setFeaturedTemplates] = useState<AgentTemplate[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<AgentTemplate[]>([]);
  const [categories, setCategories] = useState<{ category: TemplateCategory; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [reviews, setReviews] = useState<TemplateReview[]>([]);
  const [cloning, setCloning] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('visibility', 'public');
      if (selectedCategory) params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);

      const [templatesRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE}/templates?${params}`),
        fetch(`${API_BASE}/templates/categories`),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.data || []);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  const fetchFeaturedAndPopular = useCallback(async () => {
    try {
      const [featuredRes, popularRes] = await Promise.all([
        fetch(`${API_BASE}/templates/top-rated?limit=6`),
        fetch(`${API_BASE}/templates/popular?limit=6`),
      ]);

      if (featuredRes.ok) {
        const data = await featuredRes.json();
        setFeaturedTemplates(data.data || []);
      }

      if (popularRes.ok) {
        const data = await popularRes.json();
        setPopularTemplates(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch featured templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchFeaturedAndPopular();
  }, [fetchFeaturedAndPopular]);

  const fetchReviews = async (templateId: string) => {
    try {
      const res = await fetch(`${API_BASE}/templates/${templateId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const handleTemplateClick = (template: AgentTemplate) => {
    setSelectedTemplate(template);
    fetchReviews(template.id);
  };

  const handleClone = async (templateId: string) => {
    setCloning(true);
    try {
      const res = await fetch(`${API_BASE}/templates/${templateId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'current-user',
          userName: 'Current User',
        }),
      });

      if (res.ok) {
        alert('Template cloned successfully! Check your templates.');
      } else {
        throw new Error('Clone failed');
      }
    } catch (err) {
      console.error('Failed to clone template:', err);
      alert('Failed to clone template');
    } finally {
      setCloning(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className={`star star--filled star--${size}`} />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Star key={i} className={`star star--half star--${size}`} />);
      } else {
        stars.push(<Star key={i} className={`star star--empty star--${size}`} />);
      }
    }

    return <div className="stars">{stars}</div>;
  };

  const TemplateCard = ({ template }: { template: AgentTemplate }) => (
    <div 
      className="template-card"
      onClick={() => handleTemplateClick(template)}
    >
      <div className="template-card-header">
        <div 
          className="template-card-icon"
          style={{ backgroundColor: template.color || '#6366f1' }}
        >
          {template.icon || CATEGORY_ICONS[template.category]}
        </div>
        <div className="template-card-badges">
          <span className="template-badge">{CATEGORY_LABELS[template.category]}</span>
        </div>
      </div>
      
      <div className="template-card-content">
        <h3>{template.name}</h3>
        <p className="template-card-description">{template.description}</p>
        
        <div className="template-card-tags">
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className="template-tag">{tag}</span>
          ))}
          {template.tags.length > 3 && (
            <span className="template-tag template-tag--more">+{template.tags.length - 3}</span>
          )}
        </div>
      </div>

      <div className="template-card-footer">
        <div className="template-card-stats">
          <div className="template-card-rating">
            {renderStars(template.rating)}
            <span>({template.ratingCount})</span>
          </div>
          <span className="template-card-downloads">
            <Download size={14} />
            {template.usageCount}
          </span>
        </div>
        <span className="template-card-author">by {template.authorName}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="marketplace marketplace--loading">
        <div className="loading-spinner" />
        <p>Loading marketplace...</p>
      </div>
    );
  }

  return (
    <div className="marketplace">
      {/* Header */}
      <header className="marketplace-header">
        <div className="marketplace-header__content">
          <h1>Agent Marketplace</h1>
          <p>Discover and use pre-built agent templates from the community</p>
        </div>
        
        <div className="marketplace-header__search">
          <Search />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Categories */}
      <section className="marketplace-categories">
        <button
          className={`category-chip ${!selectedCategory ? 'category-chip--active' : ''}`}
          onClick={() => setSelectedCategory(null)}
        >
          All
        </button>
        {categories.map(({ category, count }) => (
          <button
            key={category}
            className={`category-chip ${selectedCategory === category ? 'category-chip--active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]} ({count})
          </button>
        ))}
      </section>

      {/* Featured Section */}
      {!searchQuery && !selectedCategory && featuredTemplates.length > 0 && (
        <section className="marketplace-section">
          <div className="marketplace-section__header">
            <Award />
            <h2>Top Rated</h2>
            <ChevronRight />
          </div>
          <div className="templates-scroll">
            {featuredTemplates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Section */}
      {!searchQuery && !selectedCategory && popularTemplates.length > 0 && (
        <section className="marketplace-section">
          <div className="marketplace-section__header">
            <TrendingUp />
            <h2>Most Popular</h2>
            <ChevronRight />
          </div>
          <div className="templates-scroll">
            {popularTemplates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        </section>
      )}

      {/* All Templates */}
      <section className="marketplace-section marketplace-section--full">
        <div className="marketplace-section__header">
          <Tag />
          <h2>
            {selectedCategory 
              ? `${CATEGORY_LABELS[selectedCategory]} Templates` 
              : searchQuery 
                ? `Results for "${searchQuery}"`
                : 'All Templates'}
          </h2>
          <span className="template-count">{templates.length} templates</span>
          <div className="view-toggle">
            <button 
              className={viewMode === 'grid' ? 'active' : ''} 
              onClick={() => setViewMode('grid')}
            >
              <Grid size={18} />
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''} 
              onClick={() => setViewMode('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
        
        {templates.length > 0 ? (
          <div className={`templates-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
            {templates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <div className="templates-empty">
            <p>No templates found</p>
            <button onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="template-modal" onClick={() => setSelectedTemplate(null)}>
          <div className="template-modal__content" onClick={e => e.stopPropagation()}>
            <button className="template-modal__close" onClick={() => setSelectedTemplate(null)}>
              ×
            </button>
            
            <div className="template-modal__header">
              <div 
                className="template-modal__icon"
                style={{ backgroundColor: selectedTemplate.color || '#6366f1' }}
              >
                {selectedTemplate.icon || CATEGORY_ICONS[selectedTemplate.category]}
              </div>
              <div className="template-modal__info">
                <h2>{selectedTemplate.name}</h2>
                <p className="template-modal__author">by {selectedTemplate.authorName}</p>
                <div className="template-modal__rating">
                  {renderStars(selectedTemplate.rating, 'md')}
                  <span>{selectedTemplate.rating.toFixed(1)} ({selectedTemplate.ratingCount} reviews)</span>
                </div>
              </div>
            </div>
            
            <p className="template-modal__description">{selectedTemplate.description}</p>
            
            <div className="template-modal__meta">
              <div className="meta-item">
                <Download size={16} />
                <span>{selectedTemplate.usageCount} uses</span>
              </div>
              <div className="meta-item">
                <Clock size={16} />
                <span>v{selectedTemplate.version}</span>
              </div>
              <div className="meta-item">
                <Users size={16} />
                <span>{CATEGORY_LABELS[selectedTemplate.category]}</span>
              </div>
            </div>
            
            {selectedTemplate.capabilities.length > 0 && (
              <div className="template-modal__capabilities">
                <h4>Capabilities</h4>
                <ul>
                  {selectedTemplate.capabilities.map(cap => (
                    <li key={cap}>{cap}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="template-modal__tags">
              {selectedTemplate.tags.map(tag => (
                <span key={tag} className="template-tag">{tag}</span>
              ))}
            </div>
            
            <div className="template-modal__actions">
              <button 
                className="btn btn--primary"
                onClick={() => handleClone(selectedTemplate.id)}
                disabled={cloning}
              >
                <Copy size={16} />
                {cloning ? 'Cloning...' : 'Use This Template'}
              </button>
              <button className="btn btn--secondary">
                <ExternalLink size={16} />
                View Workflow
              </button>
            </div>
            
            {/* Reviews */}
            <div className="template-modal__reviews">
              <h4>Reviews ({reviews.length})</h4>
              {reviews.length > 0 ? (
                <div className="reviews-list">
                  {reviews.map(review => (
                    <div key={review.id} className="review-item">
                      <div className="review-item__header">
                        <span className="review-item__author">{review.userName}</span>
                        {renderStars(review.rating)}
                        <span className="review-item__date">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h5 className="review-item__title">{review.title}</h5>
                      <p className="review-item__content">{review.content}</p>
                      <button className="review-item__helpful">
                        👍 Helpful ({review.helpful})
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="reviews-empty">No reviews yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
