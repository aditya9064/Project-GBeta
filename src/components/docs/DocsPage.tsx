import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import './DocsPage.css';

// Icons
const FileIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>;
const FileTextIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>;
const PlusIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const ChevronLeftIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,6 9,12 15,18"/></svg>;
const ChevronDownIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const GripIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const FilterIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>;
const SortIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/></svg>;
const StarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>;
const StarFilledIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>;
const FolderIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const UsersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const LockIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const ArchiveIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>;
const CalendarIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const DownloadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
const ShareIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
const ArrowDownIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>;
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const TargetIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BookIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const ClipboardIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
const LightbulbIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>;
const GlobeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const LayersIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 2,7 12,12 22,7"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>;
const CodeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>;
const SettingsIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const ChartIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const RocketIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>;

// Document icon types
type DocIconType = 'file' | 'file-text' | 'target' | 'edit' | 'book' | 'clipboard' | 'lightbulb' | 'globe' | 'layers' | 'code' | 'settings' | 'chart' | 'rocket' | 'folder' | 'users' | 'calendar' | 'star';

// Icon component that renders the appropriate icon
const DocIcon = ({ type, size = 16, className = '' }: { type: DocIconType; size?: number; className?: string }) => {
  const style = { width: size, height: size };
  const icons: Record<DocIconType, React.ReactElement> = {
    'file': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
    'file-text': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>,
    'target': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    'edit': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    'book': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    'clipboard': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
    'lightbulb': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>,
    'globe': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    'layers': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 2,7 12,12 22,7"/><polyline points="2,17 12,22 22,17"/><polyline points="2,12 12,17 22,12"/></svg>,
    'code': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg>,
    'settings': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    'chart': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    'rocket': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
    'folder': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    'users': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    'calendar': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    'star': <svg style={style} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  };
  return icons[type] || icons['file'];
};

// Block types
type BlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'bulletList' | 'numberedList' | 'todo' | 'quote' | 'divider' | 'callout' | 'code' | 'codeBlock' | 'toggle' | 'image' | 'table';

// Supported programming languages
type CodeLanguage = 
  | 'javascript' | 'typescript' | 'python' | 'java' 
  | 'c' | 'cpp' | 'csharp' | 'go' | 'rust' | 'ruby' | 'php' | 'swift' | 'kotlin'
  | 'html' | 'css' | 'json' | 'sql' | 'bash' | 'markdown';

// Piston API language mappings (https://emkc.org/api/v2/piston/runtimes)
const PISTON_LANGUAGES: Record<string, { language: string; version: string }> = {
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'cpp', version: '10.2.0' },
  csharp: { language: 'csharp', version: '6.12.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.0.1' },
  php: { language: 'php', version: '8.2.3' },
  swift: { language: 'swift', version: '5.3.3' },
  kotlin: { language: 'kotlin', version: '1.8.20' },
  bash: { language: 'bash', version: '5.2.0' },
  python: { language: 'python', version: '3.10.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
};

const SUPPORTED_LANGUAGES: { value: CodeLanguage; label: string; runnable: boolean; usesPiston?: boolean }[] = [
  { value: 'javascript', label: 'JavaScript', runnable: true },
  { value: 'typescript', label: 'TypeScript', runnable: true },
  { value: 'python', label: 'Python', runnable: true },
  { value: 'java', label: 'Java', runnable: true, usesPiston: true },
  { value: 'c', label: 'C', runnable: true, usesPiston: true },
  { value: 'cpp', label: 'C++', runnable: true, usesPiston: true },
  { value: 'csharp', label: 'C#', runnable: true, usesPiston: true },
  { value: 'go', label: 'Go', runnable: true, usesPiston: true },
  { value: 'rust', label: 'Rust', runnable: true, usesPiston: true },
  { value: 'ruby', label: 'Ruby', runnable: true, usesPiston: true },
  { value: 'php', label: 'PHP', runnable: true, usesPiston: true },
  { value: 'swift', label: 'Swift', runnable: true, usesPiston: true },
  { value: 'kotlin', label: 'Kotlin', runnable: true, usesPiston: true },
  { value: 'html', label: 'HTML', runnable: true },
  { value: 'css', label: 'CSS', runnable: false },
  { value: 'json', label: 'JSON', runnable: false },
  { value: 'sql', label: 'SQL', runnable: false },
  { value: 'bash', label: 'Bash', runnable: true, usesPiston: true },
  { value: 'markdown', label: 'Markdown', runnable: false },
];

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  isExpanded?: boolean; // For toggle blocks
  language?: CodeLanguage; // For code blocks
  output?: string; // For code block execution output
  isRunning?: boolean; // For code block execution state
}

interface Doc {
  id: string;
  title: string;
  icon: DocIconType;
  blocks: Block[];
  location: string;
  locationIcon?: DocIconType;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  viewedAt: Date;
  createdBy: { id: string; name: string; avatar?: string };
  isFavorite: boolean;
  isWiki?: boolean;
  pageCount?: number;
}

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Block type menu items with categories
const blockTypeCategories = [
  {
    label: 'Basic blocks',
    items: [
      { type: 'text' as BlockType, label: 'Text', icon: 'T', description: 'Plain text block' },
      { type: 'heading1' as BlockType, label: 'Heading 1', icon: 'H1', shortcut: '#', description: 'Large heading' },
      { type: 'heading2' as BlockType, label: 'Heading 2', icon: 'H2', shortcut: '##', description: 'Medium heading' },
      { type: 'heading3' as BlockType, label: 'Heading 3', icon: 'H3', shortcut: '###', description: 'Small heading' },
      { type: 'bulletList' as BlockType, label: 'Bulleted list', icon: '•', shortcut: '-', description: 'Unordered list' },
      { type: 'numberedList' as BlockType, label: 'Numbered list', icon: '1.', shortcut: '1.', description: 'Ordered list' },
      { type: 'todo' as BlockType, label: 'To-do list', icon: '☐', shortcut: '[]', description: 'Checkbox items' },
      { type: 'toggle' as BlockType, label: 'Toggle list', icon: '▸', shortcut: '>', description: 'Collapsible content' },
    ]
  },
  {
    label: 'Media',
    items: [
      { type: 'image' as BlockType, label: 'Image', icon: '🖼', description: 'Upload or embed image' },
      { type: 'code' as BlockType, label: 'Code', icon: '</>', shortcut: '`', description: 'Inline code snippet' },
      { type: 'codeBlock' as BlockType, label: 'Code block', icon: '{}', shortcut: '```', description: 'Code with syntax highlighting' },
    ]
  },
  {
    label: 'Advanced',
    items: [
      { type: 'quote' as BlockType, label: 'Quote', icon: '"', shortcut: '"', description: 'Quotation block' },
      { type: 'divider' as BlockType, label: 'Divider', icon: '—', shortcut: '---', description: 'Visual separator' },
      { type: 'callout' as BlockType, label: 'Callout', icon: '!', shortcut: '>', description: 'Highlighted info box' },
      { type: 'table' as BlockType, label: 'Table', icon: '⊞', description: 'Simple table' },
    ]
  }
];

// Flat list for backward compatibility
const blockTypes = blockTypeCategories.flatMap(cat => cat.items);

// Keyboard shortcuts reference
const keyboardShortcuts = {
  // Block shortcuts (type at start of line + space)
  blocks: {
    '#': 'heading1',
    '##': 'heading2', 
    '###': 'heading3',
    '-': 'bulletList',
    '*': 'bulletList',
    '+': 'bulletList',
    '1.': 'numberedList',
    '[]': 'todo',
    '[ ]': 'todo',
    '>': 'quote',
    '---': 'divider',
    '***': 'divider',
    '```': 'codeBlock',
    '"': 'quote',
  } as Record<string, BlockType>,
  
  // Text formatting (Cmd/Ctrl + key)
  formatting: {
    'b': 'bold',      // Cmd+B
    'i': 'italic',    // Cmd+I
    'u': 'underline', // Cmd+U
    'e': 'code',      // Cmd+E (inline code)
    'k': 'link',      // Cmd+K
    's': 'strikethrough', // Cmd+Shift+S
    'h': 'highlight', // Cmd+Shift+H
  },
  
  // Navigation & actions
  actions: {
    'Enter': 'newBlock',
    'Shift+Enter': 'lineBreak',
    'Backspace': 'deleteOrConvert',
    'Tab': 'indent',
    'Shift+Tab': 'outdent',
    'Escape': 'clearSelection',
    '/': 'slashCommand',
  }
};

// Document icon options
const docIconOptions: DocIconType[] = ['file', 'file-text', 'target', 'edit', 'book', 'clipboard', 'lightbulb', 'globe', 'layers', 'code', 'settings', 'chart', 'rocket', 'folder', 'users', 'calendar', 'star'];

// Templates
const templates: { id: string; name: string; description: string; icon: DocIconType; color: string; isWiki?: boolean }[] = [
  { 
    id: 'template-1', 
    name: 'Project Overview', 
    description: 'Summarize goals, scope, and milestones',
    icon: 'target',
    color: '#f59e0b'
  },
  { 
    id: 'template-2', 
    name: 'Meeting Notes', 
    description: 'Capture an agenda, notes, and action it...',
    icon: 'edit',
    color: '#8b5cf6'
  },
  { 
    id: 'template-3', 
    name: 'Wiki', 
    description: 'Organize information in one place',
    icon: 'book',
    color: '#3b82f6',
    isWiki: true
  },
];

// Sample docs
const createInitialDocs = (): Doc[] => [
  {
    id: 'doc-1',
    title: 'Wiki Template',
    icon: 'book',
    blocks: [
      { id: 'block-1', type: 'heading1', content: 'Wiki Template' },
      { id: 'block-2', type: 'text', content: 'This is a wiki template for organizing information.' },
    ],
    location: 'Everything',
    locationIcon: 'globe',
    tags: [],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
    viewedAt: new Date(),
    createdBy: { id: 'user-1', name: 'Aditya' },
    isFavorite: false,
    isWiki: true,
    pageCount: 8,
  },
  {
    id: 'doc-2',
    title: 'Project Notes',
    icon: 'file-text',
    blocks: [
      { id: 'block-3', type: 'heading1', content: 'Project Notes' },
      { id: 'block-4', type: 'text', content: 'Project documentation and notes.' },
    ],
    location: 'Team Space',
    locationIcon: 'users',
    tags: [],
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date(Date.now() - 86400000),
    viewedAt: new Date(Date.now() - 86400000),
    createdBy: { id: 'user-1', name: 'Aditya' },
    isFavorite: false,
    pageCount: 2,
  },
];

// Sidebar categories
type SidebarCategory = 'all' | 'my-docs' | 'shared' | 'private' | 'meeting-notes' | 'archived';

// Slash Command Menu Component
interface SlashMenuProps {
  position: { x: number; y: number };
  filter: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  selectedIndex: number;
}

function SlashMenu({ position, filter, onSelect, onClose, selectedIndex }: SlashMenuProps) {
  // Filter categories and items
  const filteredCategories = blockTypeCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(bt => 
      bt.label.toLowerCase().includes(filter.toLowerCase()) ||
      bt.type.toLowerCase().includes(filter.toLowerCase()) ||
      (bt.description && bt.description.toLowerCase().includes(filter.toLowerCase()))
    )
  })).filter(cat => cat.items.length > 0);

  const flatFiltered = filteredCategories.flatMap(cat => cat.items);
  
  if (flatFiltered.length === 0) {
    return (
      <div 
        className="slash-menu"
        style={{ top: position.y + 24, left: Math.min(position.x, window.innerWidth - 320) }}
      >
        <div className="slash-menu-empty">No results for "{filter}"</div>
      </div>
    );
  }

  let itemIndex = 0;

  return (
    <div 
      className="slash-menu"
      style={{ top: position.y + 24, left: Math.min(position.x, window.innerWidth - 320) }}
    >
      <div className="slash-menu-header">
        <span>Add blocks</span>
        <span className="slash-menu-hint">Type to filter</span>
      </div>
      {filteredCategories.map((cat) => (
        <div key={cat.label} className="slash-menu-category">
          <div className="slash-menu-category-label">{cat.label}</div>
          {cat.items.map((bt) => {
            const currentIndex = itemIndex++;
            return (
              <button
                key={bt.type}
                className={`slash-menu-item ${currentIndex === selectedIndex ? 'selected' : ''}`}
                onClick={() => onSelect(bt.type)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="slash-menu-icon">{bt.icon}</span>
                <div className="slash-menu-item-content">
                  <span className="slash-menu-label">{bt.label}</span>
                  {bt.description && <span className="slash-menu-description">{bt.description}</span>}
                </div>
                {bt.shortcut && <span className="slash-menu-shortcut">{bt.shortcut}</span>}
              </button>
            );
          })}
        </div>
      ))}
      <div className="slash-menu-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  );
}

// Block Component
interface BlockComponentProps {
  block: Block;
  index: number;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onAddAfter: (id: string, type?: BlockType) => void;
  onChangeType: (id: string, type: BlockType) => void;
  onToggleTodo: (id: string) => void;
  onRunCode: (id: string, code: string, language: CodeLanguage) => void;
  onChangeLanguage: (id: string, language: CodeLanguage) => void;
  autoFocus?: boolean;
}

function BlockComponent({ 
  block, 
  index, 
  onUpdate, 
  onDelete, 
  onAddAfter,
  onChangeType,
  onToggleTodo,
  onRunCode,
  onChangeLanguage,
  autoFocus
}: BlockComponentProps) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPosition, setSlashPosition] = useState({ x: 0, y: 0 });
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const initialContentSet = useRef(false);

  // Set initial content only once when component mounts
  useEffect(() => {
    if (inputRef.current && !initialContentSet.current) {
      if (block.type === 'codeBlock' && block.content.includes('\n')) {
        // For code blocks with newlines, render them as <br> elements
        inputRef.current.innerHTML = '';
        const lines = block.content.split('\n');
        lines.forEach((line, index) => {
          inputRef.current!.appendChild(document.createTextNode(line));
          if (index < lines.length - 1) {
            inputRef.current!.appendChild(document.createElement('br'));
          }
        });
      } else {
        inputRef.current.textContent = block.content;
      }
      initialContentSet.current = true;
    }
  }, []);

  // Reset content when block type changes (e.g., converting to codeBlock)
  useEffect(() => {
    if (inputRef.current) {
      // Only reset if block type changed AND the DOM content doesn't match
      // This prevents wiping content when run button triggers a re-render
      const currentDomContent = inputRef.current.textContent?.replace(/\u200B/g, '') || '';
      if (currentDomContent !== block.content && !currentDomContent) {
        if (block.type === 'codeBlock' && block.content.includes('\n')) {
          // For code blocks with newlines, render them as <br> elements
          inputRef.current.innerHTML = '';
          const lines = block.content.split('\n');
          lines.forEach((line, index) => {
            inputRef.current!.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) {
              inputRef.current!.appendChild(document.createElement('br'));
            }
          });
        } else {
          inputRef.current.textContent = block.content;
        }
      }
    }
  }, [block.type, block.content]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [autoFocus]);


  // Apply text formatting using execCommand
  const applyFormatting = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const content = inputRef.current?.textContent || '';
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;
    
    // Text formatting shortcuts (Cmd/Ctrl + key)
    if (modKey && !e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'b': // Bold
          e.preventDefault();
          applyFormatting('bold');
          return;
        case 'i': // Italic
          e.preventDefault();
          applyFormatting('italic');
          return;
        case 'u': // Underline
          e.preventDefault();
          applyFormatting('underline');
          return;
        case 'e': // Inline code
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            const code = document.createElement('code');
            code.textContent = selection.toString();
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(code);
          }
          return;
        case 'k': // Link
          e.preventDefault();
          const url = prompt('Enter URL:');
          if (url) {
            applyFormatting('createLink', url);
          }
          return;
      }
    }
    
    // Strikethrough (Cmd+Shift+S) and Highlight (Cmd+Shift+H)
    if (modKey && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 's': // Strikethrough
          e.preventDefault();
          applyFormatting('strikeThrough');
          return;
        case 'h': // Highlight
          e.preventDefault();
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            const mark = document.createElement('mark');
            mark.textContent = selection.toString();
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(mark);
          }
          return;
      }
    }
    
    // Slash command menu - just open the menu, let "/" be typed normally
    if (e.key === '/' && !showSlashMenu) {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setSlashPosition({ x: rect.left, y: rect.top });
        setShowSlashMenu(true);
        setSlashFilter('');
        setSelectedMenuIndex(0);
      }
      // Don't return or preventDefault - let the "/" character be typed normally
    }

    // Navigate slash menu
    if (showSlashMenu) {
      const filteredTypes = blockTypes.filter(bt => 
        bt.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
        bt.type.toLowerCase().includes(slashFilter.toLowerCase())
      );

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex(prev => Math.min(prev + 1, filteredTypes.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTypes[selectedMenuIndex]) {
          handleSlashSelect(filteredTypes[selectedMenuIndex].type);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (filteredTypes[selectedMenuIndex]) {
          handleSlashSelect(filteredTypes[selectedMenuIndex].type);
        }
        return;
      }
    }

    // Enter creates new block (Shift+Enter for line break within block)
    // Exception: In code blocks, Enter should create a new line (not a new block)
    if (e.key === 'Enter' && !e.shiftKey && !showSlashMenu) {
      // For code blocks, insert a newline character
      if (block.type === 'codeBlock') {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          // Insert a <br> element for visual newline
          const br = document.createElement('br');
          range.insertNode(br);
          
          // Move cursor after the <br>
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Also insert an empty text node after <br> for cursor positioning
          // This ensures subsequent typing happens after the line break
          const textNode = document.createTextNode('\u200B'); // Zero-width space
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }
      
      e.preventDefault();
      // For toggle blocks, if empty, add nested block
      if (block.type === 'toggle' && block.isExpanded) {
        onAddAfter(block.id);
      } else {
        onAddAfter(block.id);
      }
      return;
    }

    // Backspace on empty block converts to text or deletes
    if (e.key === 'Backspace' && content === '' && block.type !== 'text') {
      e.preventDefault();
      onChangeType(block.id, 'text');
      return;
    }

    if (e.key === 'Backspace' && content === '' && block.type === 'text') {
      e.preventDefault();
      onDelete(block.id);
      return;
    }

    // Tab for indentation (future feature)
    if (e.key === 'Tab' && !showSlashMenu) {
      e.preventDefault();
      // Indent logic would go here
      return;
    }

    // Markdown-style shortcuts on Space
    if (e.key === ' ' && !showSlashMenu) {
      const shortcuts: Record<string, BlockType> = {
        '#': 'heading1',
        '##': 'heading2',
        '###': 'heading3',
        '-': 'bulletList',
        '*': 'bulletList',
        '+': 'bulletList',
        '1.': 'numberedList',
        '[]': 'todo',
        '[ ]': 'todo',
        '>': 'quote',
        '---': 'divider',
        '***': 'divider',
        '___': 'divider',
        '"': 'quote',
      };
      
      if (shortcuts[content]) {
        e.preventDefault();
        if (inputRef.current) inputRef.current.textContent = '';
        onUpdate(block.id, '');
        onChangeType(block.id, shortcuts[content]);
        return;
      }
    }
    
    // Triple backtick for code block
    if (e.key === '`' && !showSlashMenu) {
      if (content === '``') {
        e.preventDefault();
        if (inputRef.current) inputRef.current.textContent = '';
        onUpdate(block.id, '');
        onChangeType(block.id, 'codeBlock');
        return;
      }
    }
  };

  const handleInput = () => {
    const content = inputRef.current?.textContent || '';
    
    if (showSlashMenu) {
      // Only update filter while slash menu is open
      const slashIndex = content.lastIndexOf('/');
      if (slashIndex >= 0) {
        setSlashFilter(content.slice(slashIndex + 1));
        setSelectedMenuIndex(0);
      } else {
        // Slash was deleted, close menu
        setShowSlashMenu(false);
      }
    }
    // Don't call onUpdate here - we'll sync on blur to prevent cursor issues
  };

  const handleSlashSelect = (type: BlockType) => {
    setShowSlashMenu(false);
    const content = inputRef.current?.textContent || '';
    const slashIndex = content.lastIndexOf('/');
    if (slashIndex >= 0) {
      const newContent = content.slice(0, slashIndex);
      if (inputRef.current) inputRef.current.textContent = newContent;
      onUpdate(block.id, newContent);
    }
    onChangeType(block.id, type);
  };

  const handleBlur = () => {
    setTimeout(() => setShowSlashMenu(false), 150);
    // Sync content to parent state on blur
    // For code blocks, we need to properly extract content with newlines
    if (inputRef.current) {
      let content = '';
      if (block.type === 'codeBlock') {
        // Convert <br> elements to newlines and extract text properly
        const nodes = inputRef.current.childNodes;
        nodes.forEach((node: ChildNode) => {
          if (node.nodeType === Node.TEXT_NODE) {
            // Filter out zero-width spaces we inserted for cursor positioning
            content += (node.textContent || '').replace(/\u200B/g, '');
          } else if (node.nodeName === 'BR') {
            content += '\n';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle nested elements (divs created by browser)
            content += (node as Element).textContent || '';
            content += '\n';
          }
        });
        // Remove trailing newline if present
        content = content.replace(/\n$/, '');
      } else {
        content = inputRef.current.textContent || '';
      }
      onUpdate(block.id, content);
    }
  };

  const getPlaceholder = () => {
    switch (block.type) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'bulletList': return 'List item';
      case 'numberedList': return 'List item';
      case 'todo': return 'To-do';
      case 'quote': return 'Quote';
      case 'callout': return 'Type a callout...';
      case 'toggle': return 'Toggle header';
      case 'code': return 'Inline code';
      case 'codeBlock': return '// Write code...';
      default: return "Type '/' for commands...";
    }
  };

  // Handle toggle expansion
  const handleToggleExpand = () => {
    // This would need to be passed up to manage nested blocks
  };

  // Divider block
  if (block.type === 'divider') {
    return (
      <div className="block-wrapper" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`block-handle ${isHovered ? 'visible' : ''}`}>
          <button className="handle-btn" title="Drag to move"><GripIcon /></button>
          <button className="handle-btn" title="Delete" onClick={() => onDelete(block.id)}><TrashIcon /></button>
        </div>
        <div className="block block-divider"><hr /></div>
      </div>
    );
  }

  // Code block
  if (block.type === 'codeBlock') {
    const currentLanguage = block.language || 'javascript';
    const languageConfig = SUPPORTED_LANGUAGES.find(l => l.value === currentLanguage) || SUPPORTED_LANGUAGES[0];
    const isRunnable = languageConfig.runnable;

    const handleRunCode = () => {
      // Extract code content, preserving newlines from <br> elements
      let code = '';
      if (inputRef.current) {
        const nodes = inputRef.current.childNodes;
        nodes.forEach((node: ChildNode) => {
          if (node.nodeType === Node.TEXT_NODE) {
            code += (node.textContent || '').replace(/\u200B/g, '');
          } else if (node.nodeName === 'BR') {
            code += '\n';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            code += (node as Element).textContent || '';
            code += '\n';
          }
        });
        code = code.replace(/\n$/, '');
      }
      // Save content to state before running
      onUpdate(block.id, code);
      onRunCode(block.id, code, currentLanguage);
    };

    const getPlaceholder = () => {
      switch (currentLanguage) {
        case 'python': return '# Write your Python code here...';
        case 'typescript': return '// Write your TypeScript code here...';
        case 'java': return '// public class Main { public static void main(String[] args) { } }';
        case 'c': return '// #include <stdio.h>\n// int main() { return 0; }';
        case 'cpp': return '// #include <iostream>\n// int main() { return 0; }';
        case 'csharp': return '// using System;\n// class Program { static void Main() { } }';
        case 'go': return '// package main\n// func main() { }';
        case 'rust': return '// fn main() { }';
        case 'ruby': return '# Write your Ruby code here...';
        case 'php': return '<?php\n// Write your PHP code here...';
        case 'swift': return '// Write your Swift code here...';
        case 'kotlin': return '// fun main() { }';
        case 'html': return '<!-- Write your HTML here... -->';
        case 'css': return '/* Write your CSS here... */';
        case 'sql': return '-- Write your SQL here...';
        case 'bash': return '# Write your Bash script here...';
        case 'json': return '// Write your JSON here...';
        case 'markdown': return '# Write your Markdown here...';
        default: return '// Write your JavaScript code here...';
      }
    };

    return (
      <div className="block-wrapper" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`block-handle ${isHovered ? 'visible' : ''}`}>
          <button className="handle-btn" title="Drag to move"><GripIcon /></button>
          <button className="handle-btn" title="Delete" onClick={() => onDelete(block.id)}><TrashIcon /></button>
        </div>
        <div className="block block-codeBlock">
          <div className="code-block-header">
            <select 
              className="code-language-select"
              value={currentLanguage}
              onChange={(e) => onChangeLanguage(block.id, e.target.value as CodeLanguage)}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label} {lang.runnable ? '▶' : ''}
                </option>
              ))}
            </select>
            <div className="code-block-actions">
              {isRunnable && (
                <button 
                  className={`code-run-btn ${block.isRunning ? 'running' : ''}`} 
                  onClick={handleRunCode}
                  disabled={block.isRunning}
                  title={`Run ${languageConfig.label} code`}
                >
                  {block.isRunning ? (
                    <span className="run-spinner" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                  <span>{block.isRunning ? 'Running...' : 'Run'}</span>
                </button>
              )}
              <button className="code-copy-btn" onClick={() => navigator.clipboard.writeText(block.content)} title="Copy code">
                <CopyIcon />
              </button>
            </div>
          </div>
          <pre>
            <code
              ref={inputRef as React.RefObject<HTMLElement>}
              className="block-content code-content"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={getPlaceholder()}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              onBlur={handleBlur}
            />
          </pre>
          {block.output !== undefined && (
            <div className={`code-output ${block.output.startsWith('Error:') ? 'error' : ''}`}>
              <div className="code-output-header">
                <span>Output</span>
                <button 
                  className="code-output-clear" 
                  onClick={() => onUpdate(block.id + ':clearOutput', '')}
                  title="Clear output"
                >
                  ×
                </button>
              </div>
              <pre className="code-output-content">{block.output || '(No output)'}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Image block
  if (block.type === 'image') {
    return (
      <div className="block-wrapper" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`block-handle ${isHovered ? 'visible' : ''}`}>
          <button className="handle-btn" title="Drag to move"><GripIcon /></button>
          <button className="handle-btn" title="Delete" onClick={() => onDelete(block.id)}><TrashIcon /></button>
        </div>
        <div className="block block-image">
          {block.content ? (
            <img src={block.content} alt="Uploaded content" />
          ) : (
            <div className="image-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
              <span>Click to add an image</span>
              <span className="image-hint">or paste a link</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Table block
  if (block.type === 'table') {
    return (
      <div className="block-wrapper" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div className={`block-handle ${isHovered ? 'visible' : ''}`}>
          <button className="handle-btn" title="Drag to move"><GripIcon /></button>
          <button className="handle-btn" title="Delete" onClick={() => onDelete(block.id)}><TrashIcon /></button>
        </div>
        <div className="block block-table">
          <table>
            <tbody>
              <tr>
                <td contentEditable suppressContentEditableWarning></td>
                <td contentEditable suppressContentEditableWarning></td>
                <td contentEditable suppressContentEditableWarning></td>
              </tr>
              <tr>
                <td contentEditable suppressContentEditableWarning></td>
                <td contentEditable suppressContentEditableWarning></td>
                <td contentEditable suppressContentEditableWarning></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="block-wrapper" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={`block-handle ${isHovered ? 'visible' : ''}`}>
        <button className="handle-btn" title="Drag to move"><GripIcon /></button>
        <button className="handle-btn" title="Delete" onClick={() => onDelete(block.id)}><TrashIcon /></button>
      </div>
      
      <div className={`block block-${block.type}`}>
        {block.type === 'todo' && (
          <button className={`todo-checkbox ${block.checked ? 'checked' : ''}`} onClick={() => onToggleTodo(block.id)}>
            {block.checked && <span><CheckIcon /></span>}
          </button>
        )}
        {block.type === 'bulletList' && <span className="list-marker">•</span>}
        {block.type === 'numberedList' && <span className="list-marker">{index + 1}.</span>}
        {block.type === 'toggle' && (
          <button className={`toggle-btn ${block.isExpanded ? 'expanded' : ''}`} onClick={handleToggleExpand}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,6 15,12 9,18"/>
            </svg>
          </button>
        )}
        {block.type === 'callout' && <span className="callout-icon"><LightbulbIcon /></span>}
        {block.type === 'code' && <span className="inline-code-marker">&lt;/&gt;</span>}
        
        <div
          ref={inputRef}
          className={`block-content ${block.checked ? 'checked' : ''}`}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={getPlaceholder()}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onBlur={handleBlur}
        />
      </div>

      {showSlashMenu && (
        <SlashMenu
          position={slashPosition}
          filter={slashFilter}
          onSelect={handleSlashSelect}
          onClose={() => setShowSlashMenu(false)}
          selectedIndex={selectedMenuIndex}
        />
      )}
    </div>
  );
}

// Icon Picker
interface IconPickerProps {
  currentIcon: DocIconType;
  onSelect: (icon: DocIconType) => void;
  onClose: () => void;
}

function IconPicker({ currentIcon, onSelect, onClose }: IconPickerProps) {
  return (
    <div className="icon-picker-overlay" onClick={onClose}>
      <div className="icon-picker" onClick={e => e.stopPropagation()}>
        <div className="icon-picker-header">Choose an icon</div>
        <div className="icon-picker-grid">
          {docIconOptions.map(iconType => (
            <button
              key={iconType}
              className={`icon-picker-item ${iconType === currentIcon ? 'selected' : ''}`}
              onClick={() => { onSelect(iconType); onClose(); }}
            >
              <DocIcon type={iconType} size={24} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Format date
const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Main DocsPage Component
export function DocsPage() {
  const [docs, setDocs] = useState<Doc[]>(createInitialDocs);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [activeCategory, setActiveCategory] = useState<SidebarCategory>('all');
  const [editingTitle, setEditingTitle] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Filter docs based on category and search
  const filteredDocs = docs.filter(doc => {
    if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    switch (activeCategory) {
      case 'my-docs': return doc.createdBy.id === 'user-1';
      case 'shared': return doc.location !== 'Private';
      case 'private': return doc.location === 'Private';
      case 'archived': return false;
      default: return true;
    }
  });

  // Create new doc
  const createNewDoc = useCallback((templateId?: string) => {
    const template = templates.find(t => t.id === templateId);
    const newDoc: Doc = {
      id: generateId(),
      title: template?.name || 'Untitled',
      icon: template?.icon || 'file-text',
      blocks: [{ id: generateId(), type: 'text', content: '' }],
      location: 'Everything',
      locationIcon: 'globe',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      viewedAt: new Date(),
      createdBy: { id: 'user-1', name: 'Aditya' },
      isFavorite: false,
      isWiki: template?.isWiki,
    };
    
    setDocs(prev => [newDoc, ...prev]);
    setSelectedDoc(newDoc);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }, []);

  // Delete doc
  const deleteDoc = useCallback((docId: string) => {
    setDocs(prev => prev.filter(d => d.id !== docId));
    if (selectedDoc?.id === docId) {
      setSelectedDoc(null);
    }
  }, [selectedDoc]);

  // Toggle favorite
  const toggleFavorite = useCallback((docId: string) => {
    setDocs(prev => prev.map(d => 
      d.id === docId ? { ...d, isFavorite: !d.isFavorite } : d
    ));
    if (selectedDoc?.id === docId) {
      setSelectedDoc(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
    }
  }, [selectedDoc]);

  // Update doc title
  const updateDocTitle = useCallback((title: string) => {
    if (!selectedDoc) return;
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, title, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, title } : null);
  }, [selectedDoc]);

  // Update doc icon
  const updateDocIcon = useCallback((icon: DocIconType) => {
    if (!selectedDoc) return;
      setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, icon, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, icon } : null);
  }, [selectedDoc]);

  // Block operations
  const updateBlock = useCallback((blockId: string, content: string) => {
    if (!selectedDoc) return;
    
    // Handle clear output command
    if (blockId.endsWith(':clearOutput')) {
      const actualBlockId = blockId.replace(':clearOutput', '');
      const updatedBlocks = selectedDoc.blocks.map(b => 
        b.id === actualBlockId ? { ...b, output: undefined } : b
      );
      setDocs(prev => prev.map(d => 
        d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
      ));
      setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
      return;
    }
    
    const updatedBlocks = selectedDoc.blocks.map(b => b.id === blockId ? { ...b, content } : b);
      setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
  }, [selectedDoc]);

  // Change code block language
  const changeBlockLanguage = useCallback((blockId: string, language: CodeLanguage) => {
    if (!selectedDoc) return;
    const updatedBlocks = selectedDoc.blocks.map(b => 
      b.id === blockId ? { ...b, language, output: undefined } : b
    );
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
  }, [selectedDoc]);

  // Execute code in a sandboxed environment (supports JavaScript, TypeScript, Python, HTML)
  const runCode = useCallback((blockId: string, code: string, language: CodeLanguage) => {
    if (!selectedDoc) return;
    
    // Set running state
    const setRunning = (isRunning: boolean, output?: string) => {
      const updatedBlocks = selectedDoc.blocks.map(b => 
        b.id === blockId ? { ...b, isRunning, ...(output !== undefined ? { output } : {}) } : b
      );
      setDocs(prev => prev.map(d => 
        d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
      ));
      setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
    };

    setRunning(true);

    // Execute code based on language
    const executeCode = async () => {
      const logs: string[] = [];
      
      // Create a custom console that captures output
      const customConsole = {
        log: (...args: unknown[]) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
        error: (...args: unknown[]) => {
          logs.push('Error: ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
        warn: (...args: unknown[]) => {
          logs.push('Warning: ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
        info: (...args: unknown[]) => {
          logs.push(args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        },
      };

      try {
        switch (language) {
          case 'javascript':
          case 'typescript': {
            // For TypeScript, we strip types and run as JavaScript
            // A full TS transpiler would be needed for complex types
            let jsCode = code;
            if (language === 'typescript') {
              // Basic type stripping (removes common type annotations)
              jsCode = code
                .replace(/:\s*(string|number|boolean|any|void|null|undefined|object|never|unknown)(\[\])?/g, '')
                .replace(/:\s*\{[^}]*\}/g, '')
                .replace(/:\s*[A-Z][a-zA-Z]*(\[\])?/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/as\s+[a-zA-Z]+/g, '')
                .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
                .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');
            }
            
            const wrappedCode = `
              (function(console) {
                ${jsCode}
              })
            `;
            
            // eslint-disable-next-line no-eval
            const fn = eval(wrappedCode);
            const result = fn(customConsole);
            
            if (result !== undefined) {
              logs.push('=> ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
            }
            break;
          }
          
          case 'python': {
            // Check if Pyodide is loaded, if not load it
            const win = window as unknown as { loadPyodide?: () => Promise<unknown>; pyodide?: unknown };
            
            if (!win.pyodide) {
              logs.push('Loading Python runtime...');
              setRunning(true, logs.join('\n'));
              
              // Load Pyodide from CDN
              if (!win.loadPyodide) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
                document.head.appendChild(script);
                await new Promise((resolve, reject) => {
                  script.onload = resolve;
                  script.onerror = reject;
                });
              }
              
              win.pyodide = await (win as unknown as { loadPyodide: () => Promise<unknown> }).loadPyodide();
              logs.length = 0; // Clear "Loading..." message
            }
            
            const pyodide = win.pyodide as {
              runPython: (code: string) => unknown;
              runPythonAsync: (code: string) => Promise<unknown>;
              setStdout: (options: { batched: (text: string) => void }) => void;
            };
            
            // Capture print output
            const outputs: string[] = [];
            pyodide.setStdout({
              batched: (text: string) => outputs.push(text)
            });
            
            const result = await pyodide.runPythonAsync(code);
            
            if (outputs.length > 0) {
              logs.push(...outputs);
            }
            if (result !== undefined && result !== null) {
              logs.push('=> ' + String(result));
            }
            break;
          }
          
          case 'html': {
            // Render HTML in a sandboxed iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(code);
                iframeDoc.close();
                
                // Extract text content as "output"
                const textContent = iframeDoc.body?.textContent || '';
                if (textContent.trim()) {
                  logs.push('Rendered HTML content:');
                  logs.push(textContent.trim().substring(0, 500));
                  if (textContent.length > 500) logs.push('...(truncated)');
                } else {
                  logs.push('HTML rendered successfully (no text content)');
                }
              }
            } finally {
              document.body.removeChild(iframe);
            }
            break;
          }
          
          // Languages that use Piston API for execution
          case 'java':
          case 'c':
          case 'cpp':
          case 'csharp':
          case 'go':
          case 'rust':
          case 'ruby':
          case 'php':
          case 'swift':
          case 'kotlin':
          case 'bash': {
            const pistonConfig = PISTON_LANGUAGES[language];
            if (!pistonConfig) {
              logs.push(`Error: No Piston configuration for ${language}`);
              break;
            }
            
            logs.push(`Running ${language.toUpperCase()}...`);
            setRunning(true, logs.join('\n'));
            
            try {
              const response = await fetch('https://emkc.org/api/v2/piston/execute', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  language: pistonConfig.language,
                  version: pistonConfig.version,
                  files: [
                    {
                      name: language === 'java' ? 'Main.java' : `main.${language}`,
                      content: code,
                    }
                  ],
                }),
              });
              
              if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
              }
              
              const result = await response.json();
              logs.length = 0; // Clear "Running..." message
              
              if (result.compile?.stderr) {
                logs.push('Compilation Error:');
                logs.push(result.compile.stderr);
              } else if (result.run?.stderr) {
                logs.push('Error:');
                logs.push(result.run.stderr);
              } else if (result.run?.stdout) {
                logs.push(result.run.stdout.trim());
              } else if (result.run?.output) {
                logs.push(result.run.output.trim());
              } else {
                logs.push('(no output)');
              }
            } catch (error) {
              logs.length = 0;
              logs.push('Error: ' + (error instanceof Error ? error.message : String(error)));
              logs.push('');
              logs.push('Note: This uses the Piston API (https://piston.readthedocs.io)');
              logs.push('Make sure you have internet connectivity.');
            }
            break;
          }
          
          default:
            logs.push(`Language "${language}" does not support execution.`);
            logs.push('It can be used for syntax highlighting only.');
        }
        
        return logs.join('\n');
      } catch (error) {
        return 'Error: ' + (error instanceof Error ? error.message : String(error));
      }
    };

    executeCode().then(output => {
      setRunning(false, output);
    }).catch(error => {
      setRunning(false, 'Error: ' + (error instanceof Error ? error.message : String(error)));
    });
  }, [selectedDoc]);

  const deleteBlock = useCallback((blockId: string) => {
    if (!selectedDoc || selectedDoc.blocks.length <= 1) return;
    const updatedBlocks = selectedDoc.blocks.filter(b => b.id !== blockId);
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
  }, [selectedDoc]);

  const addBlockAfter = useCallback((blockId: string, type: BlockType = 'text') => {
    if (!selectedDoc) return;
    const newBlock: Block = { id: generateId(), type, content: '' };
    const blockIndex = selectedDoc.blocks.findIndex(b => b.id === blockId);
    const updatedBlocks = [
      ...selectedDoc.blocks.slice(0, blockIndex + 1),
      newBlock,
      ...selectedDoc.blocks.slice(blockIndex + 1)
    ];
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
    setNewBlockId(newBlock.id);
    setTimeout(() => setNewBlockId(null), 100);
  }, [selectedDoc]);

  const changeBlockType = useCallback((blockId: string, type: BlockType) => {
    if (!selectedDoc) return;
    const updatedBlocks = selectedDoc.blocks.map(b => 
      b.id === blockId ? { ...b, type, checked: type === 'todo' ? false : undefined } : b
    );
      setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
  }, [selectedDoc]);

  const toggleTodo = useCallback((blockId: string) => {
    if (!selectedDoc) return;
    const updatedBlocks = selectedDoc.blocks.map(b => 
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
  }, [selectedDoc]);

  const addBlockAtEnd = useCallback(() => {
    if (!selectedDoc) return;
    const newBlock: Block = { id: generateId(), type: 'text', content: '' };
    const updatedBlocks = [...selectedDoc.blocks, newBlock];
    setDocs(prev => prev.map(d => 
      d.id === selectedDoc.id ? { ...d, blocks: updatedBlocks, updatedAt: new Date() } : d
    ));
    setSelectedDoc(prev => prev ? { ...prev, blocks: updatedBlocks } : null);
    setNewBlockId(newBlock.id);
    setTimeout(() => setNewBlockId(null), 100);
  }, [selectedDoc]);

  const categories: { id: SidebarCategory; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'all', label: 'All Docs', icon: <FolderIcon /> },
    { id: 'my-docs', label: 'My Docs', icon: <FileIcon />, count: docs.filter(d => d.createdBy.id === 'user-1').length },
    { id: 'shared', label: 'Shared with me', icon: <UsersIcon /> },
    { id: 'private', label: 'Private', icon: <LockIcon /> },
    { id: 'meeting-notes', label: 'Meeting Notes', icon: <CalendarIcon /> },
    { id: 'archived', label: 'Archived', icon: <ArchiveIcon /> },
  ];

  const favoriteDocs = docs.filter(d => d.isFavorite);

  return (
    <div className="docs-page">
      {/* Sidebar */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar-header">
          <h2 className="docs-sidebar-title">Docs</h2>
          <button className="docs-create-btn" onClick={() => createNewDoc()}>
            <PlusIcon />
            <span>Create</span>
          </button>
            </div>
            
        <div className="docs-sidebar-content">
          {/* Categories */}
          <div className="docs-categories">
            {categories.map(cat => (
                <button
                key={cat.id}
                className={`docs-category-item ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="category-icon">{cat.icon}</span>
                <span className="category-label">{cat.label}</span>
                {cat.count !== undefined && <span className="category-count">{cat.count}</span>}
                </button>
              ))}
            </div>

          <div className="docs-sidebar-divider" />

          {/* Favorites */}
          <div className="docs-favorites-section">
            <div className="section-header">Favorites</div>
            {favoriteDocs.length === 0 ? (
              <div className="favorites-empty">
                <StarIcon />
                <p>Star a Doc to see it here</p>
          </div>
            ) : (
              <div className="favorites-list">
                {favoriteDocs.map(doc => (
              <button
                key={doc.id}
                    className="favorite-item"
                onClick={() => setSelectedDoc(doc)}
              >
                    <span className="favorite-icon"><DocIcon type={doc.icon} size={14} /></span>
                    <span className="favorite-title">{doc.title}</span>
              </button>
            ))}
          </div>
        )}
          </div>

          <div className="docs-sidebar-divider" />

          {/* Popular Wikis */}
          <div className="docs-wikis-section">
            <div className="section-header">Popular Wikis</div>
            <div className="wikis-empty">
              <CheckIcon />
              <p>Most viewed and active Wikis appear here</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="docs-main">
        {selectedDoc ? (
          /* Document Editor View */
          <div className="doc-editor">
            <div className="doc-editor-header">
              <button className="back-btn" onClick={() => setSelectedDoc(null)}>
                <ChevronLeftIcon />
                <span>All Docs</span>
              </button>
              <div className="doc-editor-actions">
              <button 
                  className={`action-btn star-btn ${selectedDoc.isFavorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(selectedDoc.id)}
              >
                {selectedDoc.isFavorite ? <StarFilledIcon /> : <StarIcon />}
              </button>
                <button className="action-btn"><ShareIcon /></button>
                <button className="action-btn delete-btn" onClick={() => deleteDoc(selectedDoc.id)}>
                  <TrashIcon />
              </button>
              </div>
            </div>

            <div className="doc-editor-content">
              <div className="doc-header">
                <button className="doc-icon-btn" onClick={() => setShowIconPicker(true)}>
                  <DocIcon type={selectedDoc.icon} size={56} />
              </button>
              {editingTitle ? (
                <input
                    ref={titleInputRef}
                  type="text"
                    className="doc-title-input"
                    value={selectedDoc.title}
                    onChange={(e) => updateDocTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false); }}
                    placeholder="Untitled"
                />
              ) : (
                  <h1 className="doc-title" onClick={() => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 50); }}>
                    {selectedDoc.title || 'Untitled'}
                </h1>
              )}
            </div>

              <div className="blocks-container">
                {selectedDoc.blocks.map((block, index) => (
                  <BlockComponent
                    key={block.id}
                    block={block}
                    index={index}
                    onUpdate={updateBlock}
                    onDelete={deleteBlock}
                    onAddAfter={addBlockAfter}
                    onChangeType={changeBlockType}
                    onToggleTodo={toggleTodo}
                    onRunCode={runCode}
                    onChangeLanguage={changeBlockLanguage}
                    autoFocus={block.id === newBlockId}
                  />
                ))}
                <div className="add-block-area" onClick={addBlockAtEnd}>
                  <span className="add-block-hint">Click to add a block, or type '/' for commands</span>
              </div>
            </div>
            </div>
                </div>
              ) : (
          /* All Docs View */
          <div className="docs-list-view">
            <div className="docs-list-header">
              <h1 className="docs-list-title">
                {categories.find(c => c.id === activeCategory)?.label || 'All Docs'}
              </h1>
              <div className="docs-list-actions">
                <button className="import-btn">
                  <DownloadIcon />
                  <span>Import</span>
                    </button>
                <button className="new-doc-btn" onClick={() => createNewDoc()}>
                  <span>New Doc</span>
                  <ChevronDownIcon />
                    </button>
              </div>
                  </div>

            {/* Templates */}
            <div className="templates-section">
              <div className="templates-label">Templates</div>
              <div className="templates-grid">
                {templates.map(template => (
                  <button
                    key={template.id}
                    className="template-card"
                    onClick={() => createNewDoc(template.id)}
                  >
                    <div className="template-icon" style={{ background: template.color }}>
                      <DocIcon type={template.icon} size={20} className="template-icon-svg" />
                    </div>
                    <div className="template-info">
                      <div className="template-name">
                        {template.name}
                        {template.isWiki && <CheckIcon />}
                      </div>
                      <div className="template-desc">{template.description}</div>
                    </div>
                    </button>
                ))}
              </div>
                  </div>

            {/* Toolbar */}
            <div className="docs-toolbar">
              <div className="toolbar-left">
                <button className="toolbar-btn">
                  <FilterIcon />
                  <span>Filters</span>
                      </button>
                <button className="toolbar-btn">
                  <SortIcon />
                  <span>Sort</span>
                      </button>
                <div className="toolbar-tags">
                  <span>Tags:</span>
                  <button className="tags-btn">View all</button>
                    </div>
                  </div>
              <div className="toolbar-right">
                <div className="search-box">
                  <SearchIcon />
                  <input 
                    type="text" 
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Docs Table */}
            <div className="docs-table">
              <div className="docs-table-header">
                <div className="table-col col-name">Name</div>
                <div className="table-col col-location">Location</div>
                <div className="table-col col-tags">Tags</div>
                <div className="table-col col-updated">Date updated</div>
                <div className="table-col col-viewed">
                  Date viewed
                  <ArrowDownIcon />
                </div>
                <div className="table-col col-sharing">Sharing</div>
              </div>
              <div className="docs-table-body">
                {filteredDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="docs-table-row"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="table-col col-name">
                      <span className="doc-row-icon"><DocIcon type={doc.icon} size={16} /></span>
                      <span className="doc-row-title">{doc.title}</span>
                      {doc.isWiki && <CheckIcon />}
                      {doc.pageCount && (
                        <span className="doc-row-pages">
                          <CopyIcon />
                          {doc.pageCount}
                        </span>
              )}
            </div>
                    <div className="table-col col-location">
                      <span className="location-icon">{doc.locationIcon && <DocIcon type={doc.locationIcon} size={14} />}</span>
                      <span>{doc.location}</span>
                    </div>
                    <div className="table-col col-tags">
                      {doc.tags.length > 0 ? doc.tags.join(', ') : '—'}
                    </div>
                    <div className="table-col col-updated">
                      {formatDate(doc.updatedAt)}
                    </div>
                    <div className="table-col col-viewed">
                      {formatDate(doc.viewedAt)}
                    </div>
                    <div className="table-col col-sharing">
                      <div className="sharing-avatar">
                        {doc.createdBy.name.charAt(0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Icon Picker Modal */}
      {showIconPicker && selectedDoc && (
        <IconPicker
          currentIcon={selectedDoc.icon}
          onSelect={updateDocIcon}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </div>
  );
}
