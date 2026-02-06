import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js';
import './SmartCanvasPage.css';

// ============================================
// TYPES
// ============================================
type Tool = 
  | 'select' | 'pan' | 'pen' | 'highlighter' | 'eraser' 
  | 'text' | 'heading' | 'list' | 'todo' | 'code' | 'table'
  | 'shape' | 'connector' | 'sticky' | 'image';

type ShapeType = 
  | 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'triangle' | 'diamond'
  | 'pentagon' | 'hexagon' | 'star' | 'arrow' | 'line' | 'cloud' | 'callout';

type ConnectorType = 'straight' | 'elbow' | 'curved';
type ElementType = 'stroke' | 'shape' | 'textBlock' | 'stickyNote' | 'image' | 'connector' | 'docBlock';
type DocBlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'bulletList' | 'numberedList' | 'todo' | 'quote' | 'code' | 'codeBlock' | 'divider' | 'callout' | 'table';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  locked?: boolean;
  groupId?: string;
}

interface StrokeElement extends BaseElement {
  type: 'stroke';
  tool: 'pen' | 'highlighter' | 'eraser';
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
  textColor?: string;
  fontSize?: number;
}

interface TextBlockElement extends BaseElement {
  type: 'textBlock';
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
}

interface StickyNoteElement extends BaseElement {
  type: 'stickyNote';
  content: string;
  color: string;
}

interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt?: string;
}

interface ConnectorElement extends BaseElement {
  type: 'connector';
  connectorType: ConnectorType;
  startElementId?: string;
  endElementId?: string;
  startPoint: Point;
  endPoint: Point;
  waypoints?: Point[];
  color: string;
  strokeWidth: number;
  startArrow: boolean;
  endArrow: boolean;
  label?: string;
}

interface DocBlockElement extends BaseElement {
  type: 'docBlock';
  blockType: DocBlockType;
  content: string;
  checked?: boolean;
  language?: string;
  output?: string;
  isRunning?: boolean;
}

type CanvasElement = StrokeElement | ShapeElement | TextBlockElement | StickyNoteElement | ImageElement | ConnectorElement | DocBlockElement;

type PageSize = 'unlimited' | 'a4' | 'a3' | 'letter' | 'legal' | 'tabloid';

interface PageDimensions {
  width: number;
  height: number;
  label: string;
}

const PAGE_SIZES: Record<Exclude<PageSize, 'custom'>, PageDimensions> = {
  unlimited: { width: Infinity, height: Infinity, label: 'Unlimited (like OneNote)' },
  a4: { width: 794, height: 1123, label: 'A4 (210 × 297 mm)' },
  a3: { width: 1123, height: 1587, label: 'A3 (297 × 420 mm)' },
  letter: { width: 816, height: 1056, label: 'Letter (8.5 × 11 in)' },
  legal: { width: 816, height: 1344, label: 'Legal (8.5 × 14 in)' },
  tabloid: { width: 1056, height: 1632, label: 'Tabloid (11 × 17 in)' },
};

interface SmartCanvas {
  id: string;
  title: string;
  elements: CanvasElement[];
  createdAt: Date;
  updatedAt: Date;
  collaborators: { id: string; name: string; color: string; cursor?: Point }[];
  versionHistory: { id: string; timestamp: Date; snapshot: string }[];
  isShared: boolean;
  pageSize: PageSize;
  pageDimensions?: { width: number; height: number };
  orientation?: 'portrait' | 'landscape';
}

// ============================================
// ICONS
// ============================================
const Icons = {
  Select: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
      <path d="M13 13l6 6"/>
    </svg>
  ),
  Pan: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  ),
  Pen: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>
  ),
  Highlighter: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l-6 6v3h9l3-3"/>
      <path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
    </svg>
  ),
  Eraser: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0L22.4 6c.8.8.8 2 0 2.8L11 20"/>
      <path d="M6 11l4 4"/>
    </svg>
  ),
  Text: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,7 4,4 20,4 20,7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  ),
  Heading: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h8"/>
      <path d="M4 18V6"/>
      <path d="M12 18V6"/>
      <path d="M17 10v4h4"/>
    </svg>
  ),
  List: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Todo: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  Code: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  Table: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
  Shapes: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <circle cx="17.5" cy="6.5" r="4.5"/>
      <path d="M14 14l3 7 3-7-6 0z"/>
    </svg>
  ),
  Connector: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="3"/>
      <circle cx="19" cy="12" r="3"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  Sticky: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3z"/>
      <polyline points="14 3 14 8 21 8"/>
    </svg>
  ),
  Image: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21,15 16,10 5,21"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
      <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/>
      <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"/>
    </svg>
  ),
  Undo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6"/>
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
    </svg>
  ),
  Redo: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6"/>
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
    </svg>
  ),
  ZoomIn: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  ZoomOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  FitScreen: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/>
      <polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/>
      <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  Share: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  History: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12,6 12,12 16,14"/>
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Trash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Lock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  Unlock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Scan: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <rect x="7" y="7" width="10" height="10" rx="1"/>
    </svg>
  ),
  Wand: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4V2"/>
      <path d="M15 16v-2"/>
      <path d="M8 9h2"/>
      <path d="M20 9h2"/>
      <path d="M17.8 11.8L19 13"/>
      <path d="M15 9h.01"/>
      <path d="M17.8 6.2L19 5"/>
      <path d="M12.2 6.2L11 5"/>
      <path d="M2 12l10 10L22 12 12 2 2 12z"/>
    </svg>
  ),
  AlignLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="17" y1="18" x2="3" y2="18"/>
    </svg>
  ),
  AlignCenter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="10" x2="6" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="18" y1="18" x2="6" y2="18"/>
    </svg>
  ),
  AlignRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="10" x2="7" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="21" y1="18" x2="7" y2="18"/>
    </svg>
  ),
  Rectangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
  ),
  Circle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>
  ),
  Triangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 22h20L12 2z"/></svg>
  ),
  Diamond: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l10 10-10 10L2 12z"/></svg>
  ),
  Star: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
  ),
  Arrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  ),
  Line: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>
  ),
  Loader: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
};

// ============================================
// CONSTANTS
// ============================================
const COLORS = [
  '#1E1E2E', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316', '#F59E0B',
  '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#FFFFFF',
];

const STICKY_COLORS = [
  '#FEF3C7', '#FDE68A', '#FCD34D', // Yellows
  '#D1FAE5', '#A7F3D0', '#6EE7B7', // Greens
  '#DBEAFE', '#BFDBFE', '#93C5FD', // Blues
  '#FCE7F3', '#FBCFE8', '#F9A8D4', // Pinks
  '#F3E8FF', '#E9D5FF', '#D8B4FE', // Purples
];

const SHAPE_TYPES: { type: ShapeType; icon: React.FC }[] = [
  { type: 'rectangle', icon: Icons.Rectangle },
  { type: 'rounded-rectangle', icon: Icons.Rectangle },
  { type: 'circle', icon: Icons.Circle },
  { type: 'triangle', icon: Icons.Triangle },
  { type: 'diamond', icon: Icons.Diamond },
  { type: 'star', icon: Icons.Star },
  { type: 'arrow', icon: Icons.Arrow },
  { type: 'line', icon: Icons.Line },
];

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ============================================
// TOOL CATEGORIES
// ============================================
const TOOL_CATEGORIES = [
  {
    id: 'navigation',
    label: 'Navigate',
    tools: [
      { id: 'select' as Tool, icon: Icons.Select, label: 'Select (V)', shortcut: 'V' },
      { id: 'pan' as Tool, icon: Icons.Pan, label: 'Pan (H)', shortcut: 'H' },
    ]
  },
  {
    id: 'drawing',
    label: 'Draw',
    tools: [
      { id: 'pen' as Tool, icon: Icons.Pen, label: 'Pen (P)', shortcut: 'P' },
      { id: 'highlighter' as Tool, icon: Icons.Highlighter, label: 'Highlighter', shortcut: 'L' },
      { id: 'eraser' as Tool, icon: Icons.Eraser, label: 'Eraser (E)', shortcut: 'E' },
    ]
  },
  {
    id: 'shapes',
    label: 'Shapes',
    tools: [
      { id: 'shape' as Tool, icon: Icons.Shapes, label: 'Shapes (S)', shortcut: 'S' },
      { id: 'connector' as Tool, icon: Icons.Connector, label: 'Connector (C)', shortcut: 'C' },
    ]
  },
  {
    id: 'document',
    label: 'Document',
    tools: [
      { id: 'text' as Tool, icon: Icons.Text, label: 'Text (T)', shortcut: 'T' },
      { id: 'heading' as Tool, icon: Icons.Heading, label: 'Heading', shortcut: '' },
      { id: 'list' as Tool, icon: Icons.List, label: 'List', shortcut: '' },
      { id: 'todo' as Tool, icon: Icons.Todo, label: 'Checklist', shortcut: '' },
      { id: 'code' as Tool, icon: Icons.Code, label: 'Code Block', shortcut: '' },
      { id: 'table' as Tool, icon: Icons.Table, label: 'Table', shortcut: '' },
    ]
  },
  {
    id: 'media',
    label: 'Media',
    tools: [
      { id: 'sticky' as Tool, icon: Icons.Sticky, label: 'Sticky Note (N)', shortcut: 'N' },
      { id: 'image' as Tool, icon: Icons.Image, label: 'Image (I)', shortcut: 'I' },
    ]
  },
];

// ============================================
// MAIN COMPONENT
// ============================================
export function SmartCanvasPage() {
  // Canvas state
  const [canvases, setCanvases] = useState<SmartCanvas[]>(() => [{
    id: generateId(),
    title: 'Untitled Canvas',
    elements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    collaborators: [{ id: 'user-1', name: 'You', color: '#8B5CF6' }],
    versionHistory: [],
    isShared: false,
    pageSize: 'unlimited',
    pageDimensions: { width: Infinity, height: Infinity },
    orientation: 'portrait',
  }]);
  const [activeCanvasId, setActiveCanvasId] = useState(canvases[0].id);
  const activeCanvas = useMemo(() => canvases.find(c => c.id === activeCanvasId) || canvases[0], [canvases, activeCanvasId]);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedColor, setSelectedColor] = useState('#1E1E2E');
  const [selectedFill, setSelectedFill] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // UI state
  const [showDashboard, setShowDashboard] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPageSizeModal, setShowPageSizeModal] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ============================================
  // CANVAS RENDERING
  // ============================================
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    drawGrid(ctx, canvas.width / zoom, canvas.height / zoom);

    // Draw page boundary for fixed page sizes
    if (activeCanvas.pageSize !== 'unlimited' && activeCanvas.pageDimensions) {
      const { width, height } = activeCanvas.pageDimensions;
      if (isFinite(width) && isFinite(height)) {
        // Draw page background (white area)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        
        // Draw page shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillRect(0, 0, width, height);
        ctx.shadowColor = 'transparent';
        
        // Draw page border
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(0, 0, width, height);
        
        // Draw inner grid only within page bounds
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        drawGrid(ctx, width, height);
        ctx.restore();
      }
    }

    // Draw elements
    activeCanvas.elements
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(element => {
        drawElement(ctx, element);
      });

    // Draw current stroke
    if (isDrawing && currentStroke.length > 0) {
      drawStroke(ctx, currentStroke, selectedColor, strokeWidth, 1);
    }

    // Draw selection handles
    if (selectedElements.length > 0) {
      selectedElements.forEach(id => {
        const element = activeCanvas.elements.find(e => e.id === id);
        if (element) {
          drawSelectionHandles(ctx, element);
        }
      });
    }

    ctx.restore();
  }, [activeCanvas.elements, pan, zoom, isDrawing, currentStroke, selectedColor, strokeWidth, selectedElements]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20;
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
    ctx.lineWidth = 1;

    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize;
    const endX = startX + width / zoom + gridSize * 2;
    const endY = startY + height / zoom + gridSize * 2;

    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number, opacity: number) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    ctx.save();
    
    if (element.rotation) {
      const cx = element.x + element.width / 2;
      const cy = element.y + element.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((element.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    switch (element.type) {
      case 'stroke':
        drawStroke(ctx, element.points, element.color, element.strokeWidth, element.opacity);
        break;
      case 'shape':
        drawShape(ctx, element);
        break;
      case 'textBlock':
        drawTextBlock(ctx, element);
        break;
      case 'stickyNote':
        drawStickyNote(ctx, element);
        break;
      case 'docBlock':
        drawDocBlock(ctx, element);
        break;
    }

    ctx.restore();
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: ShapeElement) => {
    const { x, y, width, height, shapeType, fill, stroke, strokeWidth: sw, text, textColor, fontSize } = shape;

    ctx.beginPath();
    ctx.fillStyle = fill || 'transparent';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = sw;

    switch (shapeType) {
      case 'rectangle':
        ctx.rect(x, y, width, height);
        break;
      case 'rounded-rectangle':
        const radius = Math.min(width, height) * 0.15;
        ctx.roundRect(x, y, width, height, radius);
        break;
      case 'circle':
      case 'ellipse':
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
        break;
      case 'star':
        drawStar(ctx, x + width / 2, y + height / 2, 5, width / 2, width / 4);
        break;
      case 'line':
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y + height);
        break;
      case 'arrow':
        const arrowSize = 12;
        ctx.moveTo(x, y + height / 2);
        ctx.lineTo(x + width - arrowSize, y + height / 2);
        ctx.moveTo(x + width, y + height / 2);
        ctx.lineTo(x + width - arrowSize, y + height / 2 - arrowSize / 2);
        ctx.moveTo(x + width, y + height / 2);
        ctx.lineTo(x + width - arrowSize, y + height / 2 + arrowSize / 2);
        break;
    }

    if (fill && fill !== 'transparent') {
      ctx.fill();
    }
    ctx.stroke();

    // Draw text if present
    if (text) {
      ctx.fillStyle = textColor || '#000000';
      ctx.font = `${fontSize || 14}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + width / 2, y + height / 2);
    }
  };

  const drawStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };

  const drawTextBlock = (ctx: CanvasRenderingContext2D, textBlock: TextBlockElement) => {
    const { x, y, width, content, fontSize, color, fontWeight, textAlign } = textBlock;

    ctx.fillStyle = color;
    ctx.font = `${fontWeight || 'normal'} ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = textAlign || 'left';
    ctx.textBaseline = 'top';

    // Word wrap
    const words = content.split(' ');
    let line = '';
    let lineY = y;
    const lineHeight = fontSize * 1.5;

    words.forEach(word => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > width && line !== '') {
        const textX = textAlign === 'center' ? x + width / 2 : textAlign === 'right' ? x + width : x;
        ctx.fillText(line.trim(), textX, lineY);
        line = word + ' ';
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    });
    const textX = textAlign === 'center' ? x + width / 2 : textAlign === 'right' ? x + width : x;
    ctx.fillText(line.trim(), textX, lineY);
  };

  const drawStickyNote = (ctx: CanvasRenderingContext2D, sticky: StickyNoteElement) => {
    const { x, y, width, height, content, color } = sticky;

    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(x + 3, y + 3, width, height);

    // Draw note
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    // Draw fold effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.beginPath();
    ctx.moveTo(x + width - 20, y);
    ctx.lineTo(x + width, y + 20);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#333333';
    ctx.font = '14px "Caveat", cursive, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const padding = 12;
    const maxWidth = width - padding * 2;
    const words = content.split(' ');
    let line = '';
    let lineY = y + padding;
    const lineHeight = 20;

    words.forEach(word => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line.trim(), x + padding, lineY);
        line = word + ' ';
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line.trim(), x + padding, lineY);
  };

  const drawDocBlock = (ctx: CanvasRenderingContext2D, docBlock: DocBlockElement) => {
    const { x, y, width, height, blockType, content, checked } = docBlock;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();

    // Content based on block type
    ctx.fillStyle = checked ? '#9CA3AF' : '#1F2937';
    let fontSize = 15;
    let fontWeight = 'normal';
    let textX = x + 16;
    let textY = y + height / 2;

    switch (blockType) {
      case 'heading1':
        fontSize = 28;
        fontWeight = 'bold';
        break;
      case 'heading2':
        fontSize = 22;
        fontWeight = '600';
        break;
      case 'heading3':
        fontSize = 18;
        fontWeight = '600';
        break;
      case 'bulletList':
        ctx.fillStyle = '#6B7280';
        ctx.beginPath();
        ctx.arc(x + 24, y + height / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = checked ? '#9CA3AF' : '#1F2937';
        textX = x + 40;
        break;
      case 'todo':
        // Draw checkbox
        ctx.strokeStyle = checked ? '#8B5CF6' : '#D1D5DB';
        ctx.fillStyle = checked ? '#8B5CF6' : 'transparent';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x + 16, y + height / 2 - 9, 18, 18, 3);
        ctx.fill();
        ctx.stroke();
        if (checked) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 21, y + height / 2);
          ctx.lineTo(x + 25, y + height / 2 + 4);
          ctx.lineTo(x + 31, y + height / 2 - 4);
          ctx.stroke();
        }
        ctx.fillStyle = checked ? '#9CA3AF' : '#1F2937';
        textX = x + 44;
        break;
      case 'code':
      case 'codeBlock':
        ctx.fillStyle = '#F3F4F6';
        ctx.beginPath();
        ctx.roundRect(x + 4, y + 4, width - 8, height - 8, 4);
        ctx.fill();
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillStyle = '#1F2937';
        break;
      case 'quote':
        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(x + 8, y + 8, 4, height - 16);
        ctx.fillStyle = '#6B7280';
        textX = x + 24;
        break;
    }

    ctx.font = `${fontWeight} ${fontSize}px Inter, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    if (checked && (blockType === 'todo' || blockType === 'bulletList')) {
      ctx.fillStyle = '#9CA3AF';
    }

    ctx.fillText(content, textX, textY, width - textX + x - 16);
  };

  const drawSelectionHandles = (ctx: CanvasRenderingContext2D, element: CanvasElement) => {
    const { x, y, width, height } = element;
    const handleSize = 8;
    
    // Selection border
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    ctx.setLineDash([]);

    // Corner handles
    const handles = [
      { x: x - handleSize / 2, y: y - handleSize / 2 },
      { x: x + width - handleSize / 2, y: y - handleSize / 2 },
      { x: x + width - handleSize / 2, y: y + height - handleSize / 2 },
      { x: x - handleSize / 2, y: y + height - handleSize / 2 },
    ];

    handles.forEach(handle => {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 2;
      ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
      ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
    });

    // Rotation handle
    ctx.beginPath();
    ctx.arc(x + width / 2, y - 30, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Line to rotation handle
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x + width / 2, y - 24);
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================
  const getCanvasPoint = useCallback((e: React.MouseEvent | MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = getCanvasPoint(e);

    if (activeTool === 'pan' || (e.button === 1) || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      setIsDrawing(true);
      setCurrentStroke([point]);
      return;
    }

    if (activeTool === 'eraser') {
      // Erase strokes at point
      eraseAtPoint(point);
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'select') {
      const clickedElement = findElementAtPoint(point);
      if (clickedElement) {
        if (e.shiftKey) {
          setSelectedElements(prev => 
            prev.includes(clickedElement.id) 
              ? prev.filter(id => id !== clickedElement.id)
              : [...prev, clickedElement.id]
          );
        } else {
          setSelectedElements([clickedElement.id]);
        }
      } else {
        setSelectedElements([]);
      }
      return;
    }

    if (activeTool === 'text') {
      addTextBlock(point);
      return;
    }

    if (activeTool === 'heading') {
      addDocBlock(point, 'heading1');
      return;
    }

    if (activeTool === 'list') {
      addDocBlock(point, 'bulletList');
      return;
    }

    if (activeTool === 'todo') {
      addDocBlock(point, 'todo');
      return;
    }

    if (activeTool === 'code') {
      addDocBlock(point, 'codeBlock');
      return;
    }

    if (activeTool === 'shape') {
      addShape(point);
      return;
    }

    if (activeTool === 'sticky') {
      addStickyNote(point);
      return;
    }
  }, [activeTool, getCanvasPoint, selectedShape, selectedColor, selectedFill]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isDrawing) {
      const point = getCanvasPoint(e);
      
      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setCurrentStroke(prev => [...prev, point]);
      } else if (activeTool === 'eraser') {
        eraseAtPoint(point);
      }
    }
  }, [isPanning, lastPanPoint, isDrawing, activeTool, getCanvasPoint]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (isDrawing && currentStroke.length > 1) {
      const newStroke: StrokeElement = {
        id: generateId(),
        type: 'stroke',
        tool: activeTool as 'pen' | 'highlighter',
        x: Math.min(...currentStroke.map(p => p.x)),
        y: Math.min(...currentStroke.map(p => p.y)),
        width: Math.max(...currentStroke.map(p => p.x)) - Math.min(...currentStroke.map(p => p.x)),
        height: Math.max(...currentStroke.map(p => p.y)) - Math.min(...currentStroke.map(p => p.y)),
        points: currentStroke,
        color: selectedColor,
        strokeWidth: activeTool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
        opacity: activeTool === 'highlighter' ? 0.4 : 1,
        zIndex: activeCanvas.elements.length,
      };

      addElement(newStroke);
    }

    setIsDrawing(false);
    setCurrentStroke([]);
  }, [isPanning, isDrawing, currentStroke, activeTool, selectedColor, strokeWidth]);

  // ============================================
  // ELEMENT OPERATIONS
  // ============================================
  const addElement = useCallback((element: CanvasElement) => {
    setCanvases(prev => prev.map(canvas => 
      canvas.id === activeCanvasId
        ? { ...canvas, elements: [...canvas.elements, element], updatedAt: new Date() }
        : canvas
    ));
    pushToHistory();
  }, [activeCanvasId]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCanvases(prev => prev.map(canvas => 
      canvas.id === activeCanvasId
        ? {
            ...canvas,
            elements: canvas.elements.map(el => 
              el.id === id ? { ...el, ...updates } as CanvasElement : el
            ),
            updatedAt: new Date(),
          }
        : canvas
    ));
  }, [activeCanvasId]);

  const deleteElements = useCallback((ids: string[]) => {
    setCanvases(prev => prev.map(canvas => 
      canvas.id === activeCanvasId
        ? {
            ...canvas,
            elements: canvas.elements.filter(el => !ids.includes(el.id)),
            updatedAt: new Date(),
          }
        : canvas
    ));
    setSelectedElements([]);
    pushToHistory();
  }, [activeCanvasId]);

  const findElementAtPoint = useCallback((point: Point): CanvasElement | null => {
    const elements = [...activeCanvas.elements].reverse();
    for (const element of elements) {
      if (
        point.x >= element.x &&
        point.x <= element.x + element.width &&
        point.y >= element.y &&
        point.y <= element.y + element.height
      ) {
        return element;
      }
    }
    return null;
  }, [activeCanvas.elements]);

  const eraseAtPoint = useCallback((point: Point) => {
    const eraserRadius = strokeWidth * 2;
    setCanvases(prev => prev.map(canvas => {
      if (canvas.id !== activeCanvasId) return canvas;

      const updatedElements = canvas.elements.filter(element => {
        if (element.type !== 'stroke') return true;
        
        // Check if any point of the stroke is within eraser radius
        return !element.points.some(p => {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          return Math.sqrt(dx * dx + dy * dy) < eraserRadius;
        });
      });

      return { ...canvas, elements: updatedElements, updatedAt: new Date() };
    }));
  }, [activeCanvasId, strokeWidth]);

  const addTextBlock = useCallback((point: Point) => {
    const textBlock: TextBlockElement = {
      id: generateId(),
      type: 'textBlock',
      x: point.x,
      y: point.y,
      width: 200,
      height: 40,
      content: 'Type here...',
      fontSize: 16,
      fontFamily: 'Inter, sans-serif',
      color: selectedColor,
      zIndex: activeCanvas.elements.length,
    };
    addElement(textBlock);
    setSelectedElements([textBlock.id]);
  }, [addElement, selectedColor, activeCanvas.elements.length]);

  const addDocBlock = useCallback((point: Point, blockType: DocBlockType) => {
    const docBlock: DocBlockElement = {
      id: generateId(),
      type: 'docBlock',
      blockType,
      x: point.x,
      y: point.y,
      width: 400,
      height: blockType === 'codeBlock' ? 120 : blockType.startsWith('heading') ? 50 : 40,
      content: '',
      zIndex: activeCanvas.elements.length,
    };
    addElement(docBlock);
    setSelectedElements([docBlock.id]);
  }, [addElement, activeCanvas.elements.length]);

  const addShape = useCallback((point: Point) => {
    const shape: ShapeElement = {
      id: generateId(),
      type: 'shape',
      shapeType: selectedShape,
      x: point.x,
      y: point.y,
      width: 100,
      height: 100,
      fill: selectedFill,
      stroke: selectedColor,
      strokeWidth,
      zIndex: activeCanvas.elements.length,
    };
    addElement(shape);
    setSelectedElements([shape.id]);
  }, [addElement, selectedShape, selectedFill, selectedColor, strokeWidth, activeCanvas.elements.length]);

  const addStickyNote = useCallback((point: Point) => {
    const sticky: StickyNoteElement = {
      id: generateId(),
      type: 'stickyNote',
      x: point.x,
      y: point.y,
      width: 200,
      height: 200,
      content: '',
      color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      zIndex: activeCanvas.elements.length,
    };
    addElement(sticky);
    setSelectedElements([sticky.id]);
  }, [addElement, activeCanvas.elements.length]);

  // ============================================
  // HISTORY
  // ============================================
  const pushToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...activeCanvas.elements]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, activeCanvas.elements]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCanvases(prev => prev.map(canvas =>
        canvas.id === activeCanvasId
          ? { ...canvas, elements: history[newIndex] }
          : canvas
      ));
    }
  }, [historyIndex, history, activeCanvasId]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCanvases(prev => prev.map(canvas =>
        canvas.id === activeCanvasId
          ? { ...canvas, elements: history[newIndex] }
          : canvas
      ));
    }
  }, [historyIndex, history, activeCanvasId]);

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Tool shortcuts
      if (!modKey && !e.shiftKey) {
        const shortcuts: Record<string, Tool> = {
          'v': 'select', 'h': 'pan', 'p': 'pen', 'l': 'highlighter',
          'e': 'eraser', 't': 'text', 's': 'shape', 'c': 'connector',
          'n': 'sticky', 'i': 'image',
        };
        if (shortcuts[key]) {
          e.preventDefault();
          setActiveTool(shortcuts[key]);
          return;
        }
      }

      // Undo/Redo
      if (modKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Delete
      if ((key === 'delete' || key === 'backspace') && selectedElements.length > 0) {
        e.preventDefault();
        deleteElements(selectedElements);
        return;
      }

      // Escape
      if (key === 'escape') {
        setSelectedElements([]);
        setShowShapeMenu(false);
        setShowColorPicker(false);
        return;
      }

      // Zoom
      if (modKey && (key === '=' || key === '+')) {
        e.preventDefault();
        setZoom(prev => Math.min(5, prev * 1.2));
      }
      if (modKey && key === '-') {
        e.preventDefault();
        setZoom(prev => Math.max(0.1, prev / 1.2));
      }
      if (modKey && key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElements, undo, redo, deleteElements]);

  // ============================================
  // CANVAS RESIZE
  // ============================================
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = `${container.clientWidth}px`;
        canvas.style.height = `${container.clientHeight}px`;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Native wheel event listener for proper zoom handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prevZoom => {
          const newZoom = Math.max(0.1, Math.min(5, prevZoom * delta));
          
          // Zoom towards cursor
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          setPan(prev => ({
            x: x - (x - prev.x) * (newZoom / prevZoom),
            y: y - (y - prev.y) * (newZoom / prevZoom),
          }));
          
          return newZoom;
        });
      } else {
        // Pan with scroll
        setPan(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    // Use passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  // ============================================
  // RENDER LOOP
  // ============================================
  useEffect(() => {
    let animationFrame: number;
    const render = () => {
      renderCanvas();
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [renderCanvas]);

  // ============================================
  // CREATE NEW CANVAS
  // ============================================
  // Show page size selection modal
  const createNewCanvas = useCallback(() => {
    setShowPageSizeModal(true);
  }, []);

  // Actually create the canvas with selected page size
  const createCanvasWithPageSize = useCallback((pageSize: PageSize, orientation: 'portrait' | 'landscape' = 'portrait') => {
    const dimensions = pageSize === 'unlimited' 
      ? { width: Infinity, height: Infinity }
      : orientation === 'landscape' 
        ? { width: PAGE_SIZES[pageSize].height, height: PAGE_SIZES[pageSize].width }
        : { width: PAGE_SIZES[pageSize].width, height: PAGE_SIZES[pageSize].height };

    const newCanvas: SmartCanvas = {
      id: generateId(),
      title: 'Untitled Canvas',
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      collaborators: [{ id: 'user-1', name: 'You', color: '#8B5CF6' }],
      versionHistory: [],
      isShared: false,
      pageSize,
      pageDimensions: dimensions,
      orientation,
    };
    setCanvases(prev => [...prev, newCanvas]);
    setActiveCanvasId(newCanvas.id);
    setHistory([[]]);
    setHistoryIndex(0);
    
    // Center the page in the viewport for fixed page sizes
    if (pageSize !== 'unlimited' && canvasRef.current) {
      const canvasWidth = canvasRef.current.width;
      const canvasHeight = canvasRef.current.height;
      const pageWidth = dimensions.width;
      const pageHeight = dimensions.height;
      
      // Calculate zoom to fit the page with some padding
      const padding = 80;
      const scaleX = (canvasWidth - padding * 2) / pageWidth;
      const scaleY = (canvasHeight - padding * 2) / pageHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1);
      
      // Center the page
      const newPanX = (canvasWidth - pageWidth * fitZoom) / 2;
      const newPanY = (canvasHeight - pageHeight * fitZoom) / 2;
      
      setZoom(fitZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      // Reset to default for unlimited
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
    
    setShowDashboard(false);
    setShowPageSizeModal(false);
  }, []);

  // Open an existing canvas
  const openCanvas = useCallback((canvasId: string) => {
    setActiveCanvasId(canvasId);
    setShowDashboard(false);
  }, []);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="smart-canvas-page">
      {/* Sidebar - hidden on dashboard view */}
      {!showDashboard && (
      <aside className={`smart-canvas-sidebar ${showSidebar ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          {!showDashboard && (
            <button className="back-to-dashboard-btn" onClick={() => setShowDashboard(true)} title="Back to Dashboard">
              <Icons.ChevronLeft />
            </button>
          )}
          <h2>Canvas</h2>
          <button className="new-canvas-btn" onClick={createNewCanvas} title="New Canvas">
            <Icons.Plus />
          </button>
        </div>

        <div className="canvas-list">
          {canvases.map(canvas => (
            <button
              key={canvas.id}
              className={`canvas-item ${canvas.id === activeCanvasId && !showDashboard ? 'active' : ''}`}
              onClick={() => openCanvas(canvas.id)}
            >
              <div className="canvas-icon">
                <Icons.Shapes />
              </div>
              <div className="canvas-info">
                <span className="canvas-title">{canvas.title}</span>
                <span className="canvas-meta">
                  {canvas.elements.length} elements
                </span>
              </div>
              {canvas.isShared && (
                <span className="shared-badge">
                  <Icons.Users />
                </span>
              )}
            </button>
          ))}
        </div>

        {!showDashboard && (
          <button 
            className="sidebar-toggle"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <Icons.ChevronLeft /> : <Icons.ChevronRight />}
          </button>
        )}
      </aside>
      )}

      {/* Main Area */}
      <main className="smart-canvas-main">
        {showDashboard ? (
          /* Dashboard View */
          <div className="canvas-dashboard">
            {/* Create New Section */}
            <div className="dashboard-section">
              <h2>Start a new canvas</h2>
              <div className="create-cards">
                <button className="create-card blank-card" onClick={createNewCanvas}>
                  <div className="card-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                  <span className="card-label">Blank page</span>
                </button>
                
                <div className="templates-section">
                  <div className="templates-header">
                    <h3>Templates</h3>
                    <span className="coming-soon-badge">Coming soon</span>
                  </div>
                  <div className="template-cards">
                    <button className="template-card" disabled>
                      <div className="template-preview brainstorm">
                        <Icons.Sparkles />
                      </div>
                      <span>Brainstorm</span>
                    </button>
                    <button className="template-card" disabled>
                      <div className="template-preview flowchart">
                        <Icons.Connector />
                      </div>
                      <span>Flowchart</span>
                    </button>
                    <button className="template-card" disabled>
                      <div className="template-preview notes">
                        <Icons.Sticky />
                      </div>
                      <span>Meeting Notes</span>
                    </button>
                    <button className="template-card" disabled>
                      <div className="template-preview wireframe">
                        <Icons.Shapes />
                      </div>
                      <span>Wireframe</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Projects Section */}
            <div className="dashboard-section">
              <h2>Your projects</h2>
              {canvases.length === 0 ? (
                <div className="empty-projects">
                  <p>No projects yet. Create your first canvas to get started!</p>
                </div>
              ) : (
                <div className="projects-grid">
                  {canvases.map(canvas => (
                    <button
                      key={canvas.id}
                      className="project-card"
                      onClick={() => openCanvas(canvas.id)}
                    >
                      <div className="project-preview">
                        <Icons.Shapes />
                        <span className="element-count">{canvas.elements.length} elements</span>
                      </div>
                      <div className="project-info">
                        <span className="project-title">{canvas.title}</span>
                        <span className="project-date">
                          {canvas.updatedAt.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: canvas.updatedAt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </span>
                      </div>
                      {canvas.isShared && (
                        <span className="shared-indicator">
                          <Icons.Users />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Canvas Editor View */
          <>
        {/* Toolbar */}
        <div className="smart-canvas-toolbar">
          <div className="toolbar-left">
            <button className="toolbar-btn" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)">
              <Icons.Undo />
            </button>
            <button className="toolbar-btn" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Shift+Z)">
              <Icons.Redo />
            </button>
          </div>

          <div className="toolbar-center">
            {TOOL_CATEGORIES.map(category => (
              <div key={category.id} className="tool-group">
                {category.tools.map(tool => (
                  <button
                    key={tool.id}
                    className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTool(tool.id);
                      if (tool.id === 'shape') setShowShapeMenu(!showShapeMenu);
                    }}
                    title={tool.label}
                  >
                    <tool.icon />
                  </button>
                ))}
                {category.id !== 'media' && <div className="tool-divider" />}
              </div>
            ))}

            {/* Color Picker */}
            <div className="tool-group">
              <button
                className="color-btn"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Color"
              >
                <div className="color-preview" style={{ backgroundColor: selectedColor }} />
              </button>
            </div>

            {/* Brush Size */}
            {(activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') && (
              <div className="brush-control">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="brush-slider"
                />
                <span className="brush-label">{strokeWidth}px</span>
              </div>
            )}

            {/* Shape Menu */}
            <AnimatePresence>
              {showShapeMenu && (
                <motion.div
                  className="shape-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="shape-fill-row">
                    <button
                      className={`fill-btn ${selectedFill === 'transparent' ? 'active' : ''}`}
                      onClick={() => setSelectedFill('transparent')}
                      title="No Fill"
                    >
                      <span className="no-fill-icon">∅</span>
                    </button>
                    {COLORS.slice(0, 8).map(color => (
                      <button
                        key={color}
                        className={`fill-btn ${selectedFill === color ? 'active' : ''}`}
                        onClick={() => setSelectedFill(color)}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="shape-grid">
                    {SHAPE_TYPES.map(({ type, icon: ShapeIcon }) => (
                      <button
                        key={type}
                        className={`shape-btn ${selectedShape === type ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedShape(type);
                          setShowShapeMenu(false);
                        }}
                        title={type}
                      >
                        <ShapeIcon />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Color Picker Popup */}
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  className="color-picker-popup"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="color-grid">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-option ${selectedColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setSelectedColor(color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="toolbar-right">
            {/* AI Assist Button */}
            <button 
              className={`ai-btn ${showAIPanel ? 'active' : ''}`}
              onClick={() => setShowAIPanel(!showAIPanel)}
              title="AI Assistant"
            >
              <Icons.Sparkles />
              <span>AI Assist</span>
            </button>

            {/* Zoom Controls */}
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={() => setZoom(prev => Math.max(0.1, prev / 1.2))}>
                <Icons.ZoomOut />
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button className="zoom-btn" onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}>
                <Icons.ZoomIn />
              </button>
              <button className="zoom-btn" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit to Screen">
                <Icons.FitScreen />
              </button>
            </div>

            {/* Share & Export */}
            <button className="share-btn" onClick={() => setShowShareModal(true)}>
              <Icons.Share />
              <span>Share</span>
            </button>
            <button className="toolbar-btn" onClick={() => setShowExportModal(true)} title="Export">
              <Icons.Download />
            </button>
            <button className="toolbar-btn" onClick={() => setShowVersionHistory(true)} title="Version History">
              <Icons.History />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div 
          ref={containerRef}
          className="canvas-container"
          style={{ cursor: getCursor() }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Element Editors (rendered as HTML overlays) */}
          {selectedElements.map(id => {
            const element = activeCanvas.elements.find(e => e.id === id);
            if (!element) return null;

            if (element.type === 'textBlock' || element.type === 'stickyNote' || element.type === 'docBlock') {
              return (
                <div
                  key={id}
                  className="element-editor"
                  style={{
                    left: element.x * zoom + pan.x,
                    top: element.y * zoom + pan.y,
                    width: element.width * zoom,
                    minHeight: element.height * zoom,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                  }}
                >
                  <textarea
                    className={`element-textarea ${element.type}`}
                    value={
                      element.type === 'textBlock' ? (element as TextBlockElement).content :
                      element.type === 'stickyNote' ? (element as StickyNoteElement).content :
                      (element as DocBlockElement).content
                    }
                    onChange={(e) => updateElement(id, { content: e.target.value })}
                    style={{
                      fontSize: element.type === 'textBlock' 
                        ? (element as TextBlockElement).fontSize * zoom 
                        : 14 * zoom,
                      color: element.type === 'textBlock' 
                        ? (element as TextBlockElement).color 
                        : element.type === 'stickyNote' ? '#333333' : '#1F2937',
                      backgroundColor: element.type === 'stickyNote' 
                        ? (element as StickyNoteElement).color 
                        : undefined,
                    }}
                    placeholder={
                      element.type === 'docBlock' 
                        ? getDocBlockPlaceholder((element as DocBlockElement).blockType)
                        : 'Type here...'
                    }
                  />
                </div>
              );
            }

            return null;
          })}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-left">
            <span className="status-item">{activeCanvas.elements.length} elements</span>
            {selectedElements.length > 0 && (
              <span className="status-item">{selectedElements.length} selected</span>
            )}
            <span className="status-item page-size-indicator">
              {activeCanvas.pageSize === 'unlimited' ? '∞ Unlimited' : PAGE_SIZES[activeCanvas.pageSize].label}
            </span>
          </div>
          <div className="status-center">
            <span className="canvas-title-editable">
              <input
                type="text"
                value={activeCanvas.title}
                onChange={(e) => setCanvases(prev => prev.map(c => 
                  c.id === activeCanvasId ? { ...c, title: e.target.value } : c
                ))}
                className="title-input"
              />
            </span>
          </div>
          <div className="status-right">
            {activeCanvas.collaborators.length > 1 && (
              <div className="collaborators">
                {activeCanvas.collaborators.slice(0, 3).map(collab => (
                  <div
                    key={collab.id}
                    className="collaborator-avatar"
                    style={{ backgroundColor: collab.color }}
                    title={collab.name}
                  >
                    {collab.name.charAt(0)}
                  </div>
                ))}
                {activeCanvas.collaborators.length > 3 && (
                  <div className="collaborator-more">
                    +{activeCanvas.collaborators.length - 3}
                  </div>
                )}
              </div>
            )}
            <span className="status-item">
              Last saved: {activeCanvas.updatedAt.toLocaleTimeString()}
            </span>
          </div>
        </div>
        </>
        )}
      </main>

      {/* AI Assist Panel */}
      <AnimatePresence>
        {showAIPanel && (
          <AIAssistPanel
            isOpen={showAIPanel}
            onClose={() => setShowAIPanel(false)}
            elements={activeCanvas.elements}
            selectedElements={selectedElements}
            onConvert={handleAIConvert}
            onOrganize={handleAIOrganize}
          />
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <ShareModal
            canvas={activeCanvas}
            onClose={() => setShowShareModal(false)}
            onShare={(options) => {
              setCanvases(prev => prev.map(c =>
                c.id === activeCanvasId ? { ...c, isShared: true } : c
              ));
              setShowShareModal(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            canvas={activeCanvas}
            canvasRef={canvasRef}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Version History Panel */}
      <AnimatePresence>
        {showVersionHistory && (
          <VersionHistoryPanel
            canvas={activeCanvas}
            onClose={() => setShowVersionHistory(false)}
            onRestore={(snapshot) => {
              // Restore from snapshot
              setShowVersionHistory(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Page Size Selection Modal */}
      <AnimatePresence>
        {showPageSizeModal && (
          <PageSizeModal
            onSelect={createCanvasWithPageSize}
            onClose={() => setShowPageSizeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );

  function getCursor(): string {
    switch (activeTool) {
      case 'pan': return isPanning ? 'grabbing' : 'grab';
      case 'pen': case 'highlighter': return 'crosshair';
      case 'eraser': return 'cell';
      case 'text': case 'heading': case 'list': case 'todo': case 'code': return 'text';
      case 'shape': case 'connector': case 'sticky': return 'crosshair';
      default: return 'default';
    }
  }

  function getDocBlockPlaceholder(blockType: DocBlockType): string {
    switch (blockType) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'bulletList': return 'List item';
      case 'numberedList': return 'List item';
      case 'todo': return 'To-do item';
      case 'quote': return 'Quote...';
      case 'code': case 'codeBlock': return '// Write code...';
      default: return 'Type here...';
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const imageElement: ImageElement = {
            id: generateId(),
            type: 'image',
            x: 100,
            y: 100,
            width: Math.min(img.width, 400),
            height: Math.min(img.height, 400),
            src: event.target?.result as string,
            zIndex: activeCanvas.elements.length,
          };
          addElement(imageElement);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function handleAIConvert(type: 'drawingToText' | 'textToDiagram' | 'imageToContent') {
    // AI conversion logic would go here
    console.log('AI Convert:', type);
  }

  function handleAIOrganize() {
    // AI auto-organize logic would go here
    console.log('AI Organize');
  }
}

// ============================================
// AI ASSIST PANEL
// ============================================
interface AIAssistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  selectedElements: string[];
  onConvert: (type: 'drawingToText' | 'textToDiagram' | 'imageToContent') => void;
  onOrganize: () => void;
}

function AIAssistPanel({ isOpen, onClose, elements, selectedElements, onConvert, onOrganize }: AIAssistPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const aiActions = [
    { id: 'drawingToText', label: 'Convert Drawing to Text', icon: Icons.Text, description: 'Recognize handwritten text from drawings' },
    { id: 'textToDiagram', label: 'Create Diagram from Text', icon: Icons.Shapes, description: 'Generate visual diagrams from text descriptions' },
    { id: 'imageToContent', label: 'Extract Content from Image', icon: Icons.Scan, description: 'OCR and extract text from uploaded images' },
    { id: 'organize', label: 'Auto-Organize Canvas', icon: Icons.Wand, description: 'Automatically arrange and align elements' },
  ];

  return (
    <motion.div
      className="ai-assist-panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <Icons.Sparkles />
          <h3>AI Assistant</h3>
        </div>
        <button className="close-btn" onClick={onClose}>
          <Icons.X />
        </button>
      </div>

      <div className="ai-panel-content">
        <div className="ai-actions">
          {aiActions.map(action => (
            <button
              key={action.id}
              className="ai-action-btn"
              onClick={() => {
                if (action.id === 'organize') {
                  onOrganize();
                } else {
                  onConvert(action.id as 'drawingToText' | 'textToDiagram' | 'imageToContent');
                }
              }}
              disabled={isProcessing}
            >
              <div className="action-icon">
                <action.icon />
              </div>
              <div className="action-info">
                <span className="action-label">{action.label}</span>
                <span className="action-desc">{action.description}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="ai-prompt-section">
          <h4>Ask AI</h4>
          <div className="ai-prompt-input">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to create or modify..."
              rows={3}
            />
            <button 
              className="ai-submit-btn"
              disabled={!prompt.trim() || isProcessing}
            >
              {isProcessing ? <Icons.Loader /> : <Icons.Sparkles />}
              <span>{isProcessing ? 'Processing...' : 'Generate'}</span>
            </button>
          </div>
        </div>

        {selectedElements.length > 0 && (
          <div className="ai-selection-info">
            <span>{selectedElements.length} element(s) selected</span>
            <p>AI actions will apply to selected elements</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================
// PAGE SIZE MODAL
// ============================================
interface PageSizeModalProps {
  onSelect: (pageSize: PageSize, orientation: 'portrait' | 'landscape') => void;
  onClose: () => void;
}

function PageSizeModal({ onSelect, onClose }: PageSizeModalProps) {
  const [selectedSize, setSelectedSize] = useState<PageSize>('unlimited');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const pageSizeOptions: { id: PageSize; icon: React.ReactNode }[] = [
    { 
      id: 'unlimited', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3h18v18H3z" strokeDasharray="4 2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    },
    { 
      id: 'a4', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="1" />
          <text x="12" y="14" fontSize="6" textAnchor="middle" fill="currentColor">A4</text>
        </svg>
      )
    },
    { 
      id: 'a3', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="2" width="16" height="20" rx="1" />
          <text x="12" y="14" fontSize="6" textAnchor="middle" fill="currentColor">A3</text>
        </svg>
      )
    },
    { 
      id: 'letter', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="2" width="14" height="20" rx="1" />
          <text x="12" y="14" fontSize="5" textAnchor="middle" fill="currentColor">Letter</text>
        </svg>
      )
    },
    { 
      id: 'legal', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="1" width="12" height="22" rx="1" />
          <text x="12" y="13" fontSize="5" textAnchor="middle" fill="currentColor">Legal</text>
        </svg>
      )
    },
    { 
      id: 'tabloid', 
      icon: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="2" width="18" height="20" rx="1" />
          <text x="12" y="13" fontSize="4" textAnchor="middle" fill="currentColor">Tabloid</text>
        </svg>
      )
    },
  ];

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="page-size-modal"
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Choose Page Size</h3>
          <button className="close-btn" onClick={onClose}>
            <Icons.X />
          </button>
        </div>

        <div className="page-size-content">
          <p className="page-size-description">
            Select a page size for your canvas. Choose "Unlimited" for a free-form infinite canvas like OneNote, 
            or select a fixed size for document-style layouts.
          </p>

          <div className="page-size-grid">
            {pageSizeOptions.map((option) => (
              <button
                key={option.id}
                className={`page-size-option ${selectedSize === option.id ? 'selected' : ''}`}
                onClick={() => setSelectedSize(option.id)}
              >
                <div className="page-size-icon">{option.icon}</div>
                <span className="page-size-label">{PAGE_SIZES[option.id].label}</span>
                {option.id !== 'unlimited' && (
                  <span className="page-size-dimensions">
                    {PAGE_SIZES[option.id].width} × {PAGE_SIZES[option.id].height} px
                  </span>
                )}
              </button>
            ))}
          </div>

          {selectedSize !== 'unlimited' && (
            <div className="orientation-selector">
              <span className="orientation-label">Orientation:</span>
              <div className="orientation-options">
                <button
                  className={`orientation-btn ${orientation === 'portrait' ? 'active' : ''}`}
                  onClick={() => setOrientation('portrait')}
                >
                  <svg width="20" height="24" viewBox="0 0 20 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="16" height="20" rx="1" />
                  </svg>
                  Portrait
                </button>
                <button
                  className={`orientation-btn ${orientation === 'landscape' ? 'active' : ''}`}
                  onClick={() => setOrientation('landscape')}
                >
                  <svg width="24" height="20" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="16" rx="1" />
                  </svg>
                  Landscape
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSelect(selectedSize, orientation)}>
            Create Canvas
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// SHARE MODAL
// ============================================
interface ShareModalProps {
  canvas: SmartCanvas;
  onClose: () => void;
  onShare: (options: { isPublic: boolean; collaborators: string[] }) => void;
}

function ShareModal({ canvas, onClose, onShare }: ShareModalProps) {
  const [isPublic, setIsPublic] = useState(canvas.isShared);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const shareLink = `https://app.smartcanvas.io/canvas/${canvas.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="share-modal"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Share "{canvas.title}"</h3>
          <button className="close-btn" onClick={onClose}>
            <Icons.X />
          </button>
        </div>

        <div className="share-content">
          <div className="share-section">
            <h4><Icons.Users /> Collaborators</h4>
            <div className="invite-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email to invite..."
                className="invite-input"
              />
              <button className="invite-btn">Invite</button>
            </div>
            <div className="collaborators-list">
              {canvas.collaborators.map(collab => (
                <div key={collab.id} className="collaborator-item">
                  <div className="collab-avatar" style={{ backgroundColor: collab.color }}>
                    {collab.name.charAt(0)}
                  </div>
                  <span className="collab-name">{collab.name}</span>
                  <span className="collab-role">Owner</span>
                </div>
              ))}
            </div>
          </div>

          <div className="share-section">
            <h4><Icons.Share /> Share Link</h4>
            <div className="link-row">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="link-input"
              />
              <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <label className="public-toggle">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Anyone with the link can view</span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="share-confirm-btn"
            onClick={() => onShare({ isPublic, collaborators: [] })}
          >
            Save & Share
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// EXPORT MODAL
// ============================================
interface ExportModalProps {
  canvas: SmartCanvas;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClose: () => void;
}

function ExportModal({ canvas, canvasRef, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'png' | 'pdf' | 'svg' | 'json'>('png');
  const [filename, setFilename] = useState(canvas.title);

  const handleExport = () => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    if (format === 'png') {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvasEl.toDataURL('image/png');
      link.click();
    } else if (format === 'json') {
      const data = JSON.stringify({
        title: canvas.title,
        elements: canvas.elements,
        createdAt: canvas.createdAt,
        updatedAt: canvas.updatedAt,
      }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `${filename}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
    }
    // PDF and SVG export would require additional libraries
    
    onClose();
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="export-modal"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Export Canvas</h3>
          <button className="close-btn" onClick={onClose}>
            <Icons.X />
          </button>
        </div>

        <div className="export-content">
          <div className="export-section">
            <label>Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="filename-input"
            />
          </div>

          <div className="export-section">
            <label>Format</label>
            <div className="format-options">
              {(['png', 'pdf', 'svg', 'json'] as const).map(f => (
                <button
                  key={f}
                  className={`format-btn ${format === f ? 'active' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  <span className="format-label">{f.toUpperCase()}</span>
                  <span className="format-desc">
                    {f === 'png' && 'High-quality image'}
                    {f === 'pdf' && 'Document format'}
                    {f === 'svg' && 'Vector graphics'}
                    {f === 'json' && 'Raw data'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="export-confirm-btn" onClick={handleExport}>
            <Icons.Download />
            <span>Export</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// VERSION HISTORY PANEL
// ============================================
interface VersionHistoryPanelProps {
  canvas: SmartCanvas;
  onClose: () => void;
  onRestore: (snapshot: string) => void;
}

function VersionHistoryPanel({ canvas, onClose, onRestore }: VersionHistoryPanelProps) {
  return (
    <motion.div
      className="version-history-panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="panel-header">
        <h3><Icons.History /> Version History</h3>
        <button className="close-btn" onClick={onClose}>
          <Icons.X />
        </button>
      </div>

      <div className="panel-content">
        {canvas.versionHistory.length === 0 ? (
          <div className="empty-history">
            <Icons.History />
            <p>No version history yet</p>
            <span>Changes will be saved automatically</span>
          </div>
        ) : (
          <div className="version-list">
            {canvas.versionHistory.map(version => (
              <div key={version.id} className="version-item">
                <div className="version-info">
                  <span className="version-time">
                    {version.timestamp.toLocaleString()}
                  </span>
                </div>
                <button
                  className="restore-btn"
                  onClick={() => onRestore(version.snapshot)}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SmartCanvasPage;

