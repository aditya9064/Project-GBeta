import { useState, useEffect, useCallback } from 'react';
import { auth } from '../lib/firebase';

export interface KnowledgeEntry {
  id: string;
  name: string;
  content: string;
  type: 'text' | 'markdown';
  uploadedAt: string;
  tags: string[];
}

export interface KnowledgeSearchResult {
  entryId: string;
  entryName: string;
  snippet: string;
  score: number;
}

function getStorageKey() {
  const uid = auth.currentUser?.uid || 'anon';
  return `crewos-knowledge-base-${uid}`;
}

export function useKnowledgeBase() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey());
    if (stored) {
      try { setEntries(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const persist = useCallback((updated: KnowledgeEntry[]) => {
    setEntries(updated);
    localStorage.setItem(getStorageKey(), JSON.stringify(updated));
  }, []);

  const addEntry = useCallback((name: string, content: string, type: 'text' | 'markdown', tags: string[] = []) => {
    const entry: KnowledgeEntry = {
      id: crypto.randomUUID(),
      name,
      content,
      type,
      uploadedAt: new Date().toISOString(),
      tags,
    };
    persist([...entries, entry]);
    return entry;
  }, [entries, persist]);

  const removeEntry = useCallback((id: string) => {
    persist(entries.filter(e => e.id !== id));
  }, [entries, persist]);

  const updateEntryTags = useCallback((id: string, tags: string[]) => {
    persist(entries.map(e => e.id === id ? { ...e, tags } : e));
  }, [entries, persist]);

  const searchKnowledge = useCallback((query: string, kbId?: string): KnowledgeSearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: KnowledgeSearchResult[] = [];
    const source = kbId ? entries.filter(e => e.id === kbId) : entries;
    
    for (const entry of source) {
      const idx = entry.content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(entry.content.length, idx + query.length + 80);
        results.push({
          entryId: entry.id,
          entryName: entry.name,
          snippet: (start > 0 ? '...' : '') + entry.content.slice(start, end) + (end < entry.content.length ? '...' : ''),
          score: 1,
        });
      }
    }
    return results;
  }, [entries]);

  return { entries, addEntry, removeEntry, updateEntryTags, searchKnowledge };
}
