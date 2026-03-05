import { useState, useRef, useCallback } from 'react';
import {
  FileText, Upload, Search, Trash2, Tag, Plus, X, Eye,
  BookOpen, Loader2, AlertCircle, File,
} from 'lucide-react';
import { useKnowledgeBase, type KnowledgeEntry } from '../../hooks/useKnowledgeBase';

export function KnowledgeBase() {
  const { entries, addEntry, removeEntry, updateEntryTags, searchKnowledge } = useKnowledgeBase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [previewEntry, setPreviewEntry] = useState<KnowledgeEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const searchResults = searchQuery.trim() ? searchKnowledge(searchQuery) : null;
  const matchedIds = searchResults ? new Set(searchResults.map(r => r.entryId)) : null;
  const visibleEntries = matchedIds ? entries.filter(e => matchedIds.has(e.id)) : entries;

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'txt' && ext !== 'md') continue;
      const content = await file.text();
      const type = ext === 'md' ? 'markdown' : 'text';
      addEntry(file.name, content, type, []);
    }
    setUploading(false);
  }, [addEntry]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleManualAdd = () => {
    if (!manualName.trim() || !manualContent.trim()) return;
    addEntry(manualName.trim(), manualContent, 'text', []);
    setManualName('');
    setManualContent('');
    setShowAddModal(false);
  };

  const handleAddTag = (id: string) => {
    if (!tagInput.trim()) return;
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const newTags = [...new Set([...entry.tags, tagInput.trim()])];
    updateEntryTags(id, newTags);
    setTagInput('');
  };

  const handleRemoveTag = (id: string, tag: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    updateEntryTags(id, entry.tags.filter(t => t !== tag));
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  const formatSize = (len: number) => {
    if (len < 1024) return `${len} chars`;
    return `${(len / 1024).toFixed(1)}K chars`;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BookOpen size={28} style={{ color: '#e07a3a' }} />
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary, #1a1a2e)' }}>Knowledge Base</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.95rem' }}>
          Upload and manage documents for your AI agents
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary, #94a3b8)' }} />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8,
              border: '1px solid var(--color-border-default, #e5e7eb)', background: 'var(--color-bg-tertiary, #f4f5f7)',
              color: 'var(--color-text-primary, #1a1a2e)', fontSize: '0.9rem', outline: 'none',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-tertiary, #94a3b8)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            borderRadius: 8, border: 'none', background: '#e07a3a', color: '#fff',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          }}
        >
          <Plus size={16} /> Add Text
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            borderRadius: 8, border: '1px solid rgba(224,122,58,0.4)', background: 'rgba(224,122,58,0.08)',
            color: '#e07a3a', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem',
          }}
        >
          <Upload size={16} /> Upload File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && handleFileUpload(e.target.files)}
        />
      </div>

      {/* Drag and drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#e07a3a' : 'var(--color-border-default, #e5e7eb)'}`,
          borderRadius: 12, padding: '2rem', textAlign: 'center',
          marginBottom: '1.5rem', transition: 'all 0.2s',
          background: isDragging ? 'rgba(224,122,58,0.06)' : 'transparent',
        }}
      >
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-secondary, #6b7280)' }}>
            <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Processing files...
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-tertiary, #94a3b8)', fontSize: '0.9rem' }}>
            <Upload size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>Drag & drop <strong>.txt</strong> or <strong>.md</strong> files here</div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          border: '1px solid var(--color-border-subtle, #e5e7eb)', borderRadius: 12,
          background: 'var(--color-bg-tertiary, #f4f5f7)',
        }}>
          <BookOpen size={48} style={{ color: 'var(--color-text-tertiary, #94a3b8)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-primary, #1a1a2e)', fontWeight: 600 }}>No documents yet</h3>
          <p style={{ margin: 0, color: 'var(--color-text-secondary, #6b7280)', maxWidth: 400, marginInline: 'auto' }}>
            Upload text or markdown files to build your knowledge base. Your AI agents will use these documents to provide more accurate and relevant responses.
          </p>
        </div>
      )}

      {/* Search result info */}
      {searchResults && (
        <div style={{ marginBottom: 12, color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.85rem' }}>
          Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
        </div>
      )}

      {/* Document list */}
      <div style={{ display: 'grid', gap: 12 }}>
        {visibleEntries.map(entry => (
          <div
            key={entry.id}
            style={{
              background: 'var(--color-bg-secondary, #fff)', border: '1px solid var(--color-border-subtle, #e5e7eb)',
              borderRadius: 12, padding: '1rem 1.25rem', transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {entry.type === 'markdown' ? <FileText size={20} style={{ color: '#e07a3a', flexShrink: 0 }} /> : <File size={20} style={{ color: '#d46b2c', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #1a1a2e)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: 'var(--color-text-tertiary, #94a3b8)', marginTop: 2 }}>
                  <span style={{
                    padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                    background: entry.type === 'markdown' ? 'rgba(224,122,58,0.1)' : 'rgba(212,107,44,0.1)',
                    color: entry.type === 'markdown' ? '#e07a3a' : '#d46b2c',
                  }}>
                    {entry.type}
                  </span>
                  <span>{formatDate(entry.uploadedAt)}</span>
                  <span>{formatSize(entry.content.length)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPreviewEntry(previewEntry?.id === entry.id ? null : entry)}
                  title="Preview"
                  style={{ background: 'var(--color-bg-tertiary, #f4f5f7)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--color-text-secondary, #6b7280)' }}
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => setTagEditId(tagEditId === entry.id ? null : entry.id)}
                  title="Tags"
                  style={{ background: 'var(--color-bg-tertiary, #f4f5f7)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: 'var(--color-text-secondary, #6b7280)' }}
                >
                  <Tag size={16} />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(entry.id)}
                  title="Delete"
                  style={{ background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#ef4444' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Tags */}
            {entry.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {entry.tags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => handleRemoveTag(entry.id, tag)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                      background: 'rgba(224,122,58,0.1)', color: '#e07a3a',
                      cursor: 'pointer',
                    }}
                  >
                    {tag} <X size={10} />
                  </span>
                ))}
              </div>
            )}

            {/* Tag editor */}
            {tagEditId === entry.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag(entry.id)}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6,
                    border: '1px solid var(--color-border-default, #e5e7eb)', background: 'var(--color-bg-tertiary, #f4f5f7)',
                    color: 'var(--color-text-primary, #1a1a2e)', fontSize: '0.85rem', outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleAddTag(entry.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    background: '#e07a3a', color: '#fff', fontSize: '0.85rem',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Add
                </button>
              </div>
            )}

            {/* Delete confirmation */}
            {deleteConfirmId === entry.id && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
                padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: '#ef4444', fontSize: '0.85rem', flex: 1 }}>Delete this document?</span>
                <button
                  onClick={() => { removeEntry(entry.id); setDeleteConfirmId(null); }}
                  style={{
                    padding: '4px 14px', borderRadius: 6, border: 'none',
                    background: '#ef4444', color: '#fff', fontSize: '0.8rem',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  style={{
                    padding: '4px 14px', borderRadius: 6, border: '1px solid var(--color-border-default, #e5e7eb)',
                    background: 'transparent', color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Preview */}
            {previewEntry?.id === entry.id && (
              <div style={{
                marginTop: 12, padding: '1rem', borderRadius: 8,
                background: 'var(--color-bg-tertiary, #f4f5f7)', border: '1px solid var(--color-border-subtle, #e5e7eb)',
                maxHeight: 400, overflow: 'auto',
              }}>
                <pre style={{
                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontSize: '0.85rem', color: 'var(--color-text-primary, #1a1a2e)', fontFamily: 'inherit', lineHeight: 1.6,
                }}>
                  {entry.content}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Text Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div style={{
            background: 'var(--color-bg-elevated, #fff)', borderRadius: 16, padding: '2rem',
            width: '90%', maxWidth: 560, border: '1px solid var(--color-border-subtle, #e5e7eb)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary, #1a1a2e)' }}>Add Text Document</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-tertiary, #94a3b8)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.85rem', fontWeight: 600 }}>Document Name</label>
              <input
                type="text"
                placeholder="e.g., Company FAQ"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--color-border-default, #e5e7eb)', background: 'var(--color-bg-tertiary, #f4f5f7)',
                  color: 'var(--color-text-primary, #1a1a2e)', fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: 6, color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.85rem', fontWeight: 600 }}>Content</label>
              <textarea
                placeholder="Paste or type your document content here..."
                value={manualContent}
                onChange={e => setManualContent(e.target.value)}
                rows={10}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--color-border-default, #e5e7eb)', background: 'var(--color-bg-tertiary, #f4f5f7)',
                  color: 'var(--color-text-primary, #1a1a2e)', fontSize: '0.9rem', outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: '1px solid var(--color-border-default, #e5e7eb)', background: 'transparent',
                  color: 'var(--color-text-secondary, #6b7280)', cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualAdd}
                disabled={!manualName.trim() || !manualContent.trim()}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: !manualName.trim() || !manualContent.trim() ? 'var(--color-bg-tertiary, #e5e7eb)' : '#e07a3a',
                  color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  opacity: !manualName.trim() || !manualContent.trim() ? 0.5 : 1,
                }}
              >
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
