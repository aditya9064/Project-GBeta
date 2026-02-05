import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, ArrowUpDown, MoreHorizontal, Mail, Phone, ChevronDown } from 'lucide-react';
import { Contact } from '../../types';
import { Avatar, Badge, Button, Input, IconButton } from '../ui';
import { format } from 'date-fns';

interface ContactsTableProps {
  contacts: Contact[];
  onContactSelect: (contact: Contact) => void;
  selectedContactId?: string;
}

type SortField = 'name' | 'company' | 'status' | 'value' | 'lastContact';
type SortDirection = 'asc' | 'desc';

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  customer: 'success', prospect: 'info', lead: 'warning', churned: 'error',
};

const stageLabels: Record<string, string> = {
  awareness: 'Awareness', interest: 'Interest', consideration: 'Consideration',
  intent: 'Intent', evaluation: 'Evaluation', purchase: 'Purchase',
};

export function ContactsTable({ contacts, onContactSelect, selectedContactId }: ContactsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query) || c.company?.toLowerCase().includes(query));
    }

    if (statusFilter) {
      result = result.filter(c => c.status === statusFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'company': comparison = (a.company || '').localeCompare(b.company || ''); break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
        case 'value': comparison = (a.value || 0) - (b.value || 0); break;
        case 'lastContact': comparison = (a.lastContact?.getTime() || 0) - (b.lastContact?.getTime() || 0); break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [contacts, searchQuery, sortField, sortDirection, statusFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Contacts</h1>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-tertiary)', padding: '0.25rem 0.75rem', borderRadius: 9999 }}>{contacts.length}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Input placeholder="Search contacts..." icon={<Search size={16} />} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: 260 }} />
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select 
              value={statusFilter || ''} 
              onChange={(e) => setStatusFilter(e.target.value || null)}
              style={{
                appearance: 'none',
                padding: '0.5rem 2rem 0.5rem 0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <option value="">All statuses</option>
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="customer">Customer</option>
              <option value="churned">Churned</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
          </div>
          
          <Button variant="primary" size="sm" icon={<Plus size={14} />}>Add Contact</Button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-subtle)', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <input type="checkbox" style={{ width: 16, height: 16 }} />
              </th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Name <ArrowUpDown size={12} /></span>
              </th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }} onClick={() => handleSort('company')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Company <ArrowUpDown size={12} /></span>
              </th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>Status</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>Stage</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }} onClick={() => handleSort('value')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Value <ArrowUpDown size={12} /></span>
              </th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)' }}>Last Contact</th>
              <th style={{ position: 'sticky', top: 0, background: 'var(--color-bg-secondary)', padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border-subtle)', width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedContacts.map((contact, index) => (
              <motion.tr
                key={contact.id}
                onClick={() => onContactSelect(contact)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                style={{ cursor: 'pointer', background: selectedContactId === contact.id ? 'var(--color-bg-selected)' : 'transparent' }}
              >
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" style={{ width: 16, height: 16 }} />
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Avatar src={contact.avatar} name={contact.name} size="sm" />
                    <div>
                      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500 }}>{contact.name}</span>
                      <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{contact.email}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {contact.companyLogo && <img src={contact.companyLogo} alt={contact.company} style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain', background: 'var(--color-bg-primary)' }} />}
                    <div>
                      <span style={{ display: 'block', fontSize: '0.8125rem' }}>{contact.company}</span>
                      {contact.title && <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-tertiary)' }}>{contact.title}</span>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  <Badge variant={statusColors[contact.status]} dot>{contact.status}</Badge>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{stageLabels[contact.stage]}</span>
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  {contact.value && <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>${(contact.value / 1000).toFixed(0)}K</span>}
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle' }}>
                  {contact.lastContact && <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)' }}>{format(contact.lastContact, 'MMM d')}</span>}
                </td>
                <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border-subtle)', verticalAlign: 'middle', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                    <IconButton aria-label="Send email" size="sm"><Mail size={14} /></IconButton>
                    <IconButton aria-label="Call" size="sm"><Phone size={14} /></IconButton>
                    <IconButton aria-label="More actions" size="sm"><MoreHorizontal size={14} /></IconButton>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
