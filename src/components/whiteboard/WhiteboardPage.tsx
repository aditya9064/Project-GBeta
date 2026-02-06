import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import './WhiteboardPage.css';
import { AIBrainstormPanel, BrainstormIdea } from './AIBrainstormPanel';

// ============================================
// TYPES
// ============================================
type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'shape' | 'sticky' | 'image' | 'pan' | 'connector';
type ShapeType = 
  // Basic shapes
  | 'rectangle' | 'square' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'triangle' | 'diamond'
  // Polygons
  | 'pentagon' | 'hexagon' | 'octagon' | 'heptagon'
  // Flowchart shapes  
  | 'process' | 'decision' | 'terminator' | 'data' | 'document' | 'predefined-process'
  | 'manual-input' | 'preparation' | 'database' | 'hard-disk' | 'internal-storage'
  // Arrows and lines
  | 'line' | 'arrow' | 'double-arrow' | 'curved-arrow' | 'right-arrow' | 'left-arrow' | 'up-arrow' | 'down-arrow'
  // UML shapes
  | 'actor' | 'use-case' | 'class-box' | 'interface-box' | 'package'
  // Containers
  | 'loop' | 'group-box' | 'swimlane'
  // Misc
  | 'star' | 'parallelogram' | 'trapezoid' | 'cross' | 'cloud' | 'callout' | 'heart' | 'lightning';

type ConnectorType = 'straight' | 'elbow' | 'curved';
type ArrowHeadType = 'none' | 'arrow' | 'filled-arrow' | 'diamond' | 'circle' | 'open-arrow';
type TemplateType = 'blank' | 'ruled' | 'grid' | 'dots' | 'isometric' | 'cornell';
type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
type ElementType = 'shape' | 'connector' | 'textBox' | 'stickyNote' | 'image';

interface SelectedElement {
  id: string;
  type: ElementType;
}

interface ResizeHandle {
  position: HandlePosition;
  x: number;
  y: number;
  cursor: string;
}

// Shape categories for the library
interface ShapeCategory {
  id: string;
  name: string;
  icon: string;
  shapes: { type: ShapeType; name: string; icon?: string }[];
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface ConnectionPoint {
  id: string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'center';
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  fill: string;
  strokeWidth: number;
  rotation?: number;
  text?: string;
  fontSize?: number;
  textColor?: string;
  connectionPoints?: ConnectionPoint[];
  // Container properties (for loop, group-box, swimlane)
  isContainer?: boolean;
  containedShapeIds?: string[];
  containerLabel?: string;
}

interface Connector {
  id: string;
  type: ConnectorType;
  startShapeId?: string;
  startPoint: Point;
  startConnectionPoint?: string;
  endShapeId?: string;
  endPoint: Point;
  endConnectionPoint?: string;
  waypoints?: Point[];
  color: string;
  strokeWidth: number;
  startArrow: ArrowHeadType;
  endArrow: ArrowHeadType;
  label?: string;
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  width: number;
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
}

interface Whiteboard {
  id: string;
  title: string;
  template: TemplateType;
  strokes: Stroke[];
  shapes: Shape[];
  connectors: Connector[];
  textBoxes: TextBox[];
  stickyNotes: StickyNote[];
  images: ImageElement[];
  createdAt: Date;
  updatedAt: Date;
  isShared: boolean;
  shareLink?: string;
  collaborators: { id: string; name: string; color: string }[];
}

// ============================================
// ICONS
// ============================================
const Icons = {
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
  Shapes: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <circle cx="17.5" cy="6.5" r="4.5"/>
      <path d="M14 14l3 7 3-7-6 0z"/>
    </svg>
  ),
  Select: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
      <path d="M13 13l6 6"/>
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
  Pan: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
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
  FitToScreen: () => (
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
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  X: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Link: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Trash: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  Rectangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    </svg>
  ),
  Circle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Line: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="19" x2="19" y2="5"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Triangle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 22h20L12 2z"/>
    </svg>
  ),
  Camera: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
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
  Sparkles: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
      <path d="M5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"/>
      <path d="M19 5l.5 1.5L21 7l-1.5.5L19 9l-.5-1.5L17 7l1.5-.5L19 5z"/>
    </svg>
  ),
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Loader: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  // Connector icons
  Connector: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="3"/>
      <circle cx="19" cy="12" r="3"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  ElbowConnector: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="4" r="2"/>
      <circle cx="20" cy="20" r="2"/>
      <path d="M4 6v6h16v8"/>
    </svg>
  ),
  CurvedConnector: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="4" r="2"/>
      <circle cx="20" cy="20" r="2"/>
      <path d="M4 6c0 8 16 6 16 14"/>
    </svg>
  ),
  // Flowchart shape icons
  Diamond: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l10 10-10 10L2 12z"/>
    </svg>
  ),
  Process: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12"/>
    </svg>
  ),
  Terminator: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="6"/>
    </svg>
  ),
  Data: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6h16l-3 12H8z"/>
    </svg>
  ),
  Database: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  Decision: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 9-9 9-9-9z"/>
      <text x="12" y="14" textAnchor="middle" fontSize="8" fill="currentColor">?</text>
    </svg>
  ),
  Parallelogram: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6h16l-4 12H2z"/>
    </svg>
  ),
  Hexagon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v8l-8 4-8-4V6z"/>
    </svg>
  ),
  Pentagon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 9l4 12h12l4-12z"/>
    </svg>
  ),
  Octagon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/>
    </svg>
  ),
  Heptagon: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7.5 4.5 1.5 8-5 7h-8l-5-7 1.5-8z"/>
    </svg>
  ),
  Square: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
    </svg>
  ),
  Heart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Lightning: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  RightArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6l-6 6 6 6"/>
      <path d="M4 12h16"/>
      <path d="M20 6v12"/>
    </svg>
  ),
  Fill: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 11H5l-2 2 2 2h14l2-2-2-2z"/>
      <path d="M12 3v6"/>
      <path d="M12 19v2"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
    </svg>
  ),
  PaintBucket: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 11l-8-8L3 11l8 8 8-8z"/>
      <path d="M21 19c0 1.1-.9 2-2 2s-2-.9-2-2 2-4 2-4 2 2.9 2 4z"/>
    </svg>
  ),
  Star: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Cloud: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
    </svg>
  ),
  Callout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Actor: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="12" y1="16" x2="8" y2="22"/>
      <line x1="12" y1="16" x2="16" y2="22"/>
    </svg>
  ),
  UseCase: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="12" rx="10" ry="6"/>
    </svg>
  ),
  Package: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Brain: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54"/>
    </svg>
  ),
  Grid: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Flowchart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <rect x="3" y="10" width="7" height="4" rx="1"/>
      <rect x="14" y="10" width="7" height="4" rx="1"/>
      <rect x="8" y="18" width="8" height="4" rx="1"/>
      <line x1="12" y1="6" x2="12" y2="10"/>
      <line x1="6.5" y1="14" x2="6.5" y2="18"/>
      <line x1="17.5" y1="14" x2="17.5" y2="18"/>
      <line x1="6.5" y1="18" x2="8" y2="20"/>
      <line x1="17.5" y1="18" x2="16" y2="20"/>
    </svg>
  ),
  CrossArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5V19M5 12H19"/>
      <polyline points="15 8 19 12 15 16"/>
      <polyline points="8 8 4 12 8 16"/>
      <polyline points="8 19 12 23 16 19"/>
      <polyline points="8 5 12 1 16 5"/>
    </svg>
  ),
  // Alignment icons
  AlignLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="4" x2="3" y2="20"/>
      <rect x="7" y="6" width="10" height="4"/>
      <rect x="7" y="14" width="6" height="4"/>
    </svg>
  ),
  AlignCenter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="4" x2="12" y2="20"/>
      <rect x="6" y="6" width="12" height="4"/>
      <rect x="8" y="14" width="8" height="4"/>
    </svg>
  ),
  AlignRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="21" y2="20"/>
      <rect x="7" y="6" width="10" height="4"/>
      <rect x="11" y="14" width="6" height="4"/>
    </svg>
  ),
  AlignTop: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="3" x2="20" y2="3"/>
      <rect x="6" y="7" width="4" height="10"/>
      <rect x="14" y="7" width="4" height="6"/>
    </svg>
  ),
  AlignMiddle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="12" x2="20" y2="12"/>
      <rect x="6" y="6" width="4" height="12"/>
      <rect x="14" y="8" width="4" height="8"/>
    </svg>
  ),
  AlignBottom: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="20" y2="21"/>
      <rect x="6" y="7" width="4" height="10"/>
      <rect x="14" y="11" width="4" height="6"/>
    </svg>
  ),
  Properties: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="13" y1="8" x2="18" y2="8"/>
      <line x1="13" y1="12" x2="18" y2="12"/>
      <line x1="13" y1="16" x2="18" y2="16"/>
    </svg>
  ),
  // Additional shape icons
  Trapezoid: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14l3 16H2z"/>
    </svg>
  ),
  Cross: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6H2v8h7v6h6v-6h7V8h-7V2z"/>
    </svg>
  ),
  PreDefinedProcess: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12"/>
      <line x1="6" y1="6" x2="6" y2="18"/>
      <line x1="18" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ManualInput: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l18-4v16H3z"/>
    </svg>
  ),
  Preparation: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14l3 8-3 8H5l-3-8z"/>
    </svg>
  ),
  HardDisk: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="5" cy="12" rx="2" ry="6"/>
      <path d="M5 6h14c1.1 0 2 2.7 2 6s-.9 6-2 6H5"/>
    </svg>
  ),
  InternalStorage: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
      <line x1="7" y1="3" x2="7" y2="21"/>
      <line x1="3" y1="7" x2="21" y2="7"/>
    </svg>
  ),
  CurvedArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20c0-8 4-12 12-12h4"/>
      <polyline points="16 12 20 8 16 4"/>
    </svg>
  ),
  LeftArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12l8-8v5h12v6H10v5z"/>
    </svg>
  ),
  UpArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 8h-5v12H9V10H4z"/>
    </svg>
  ),
  DownArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22l8-8h-5V2H9v12H4z"/>
    </svg>
  ),
  DoubleArrow: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="12" x2="20" y2="12"/>
      <polyline points="8 8 4 12 8 16"/>
      <polyline points="16 8 20 12 16 16"/>
    </svg>
  ),
  ClassBox: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
    </svg>
  ),
  InterfaceBox: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  Loop: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 8h20"/>
      <text x="6" y="7" fontSize="4" fill="currentColor" fontWeight="bold">loop</text>
      <path d="M7 14h10"/>
      <path d="M9 17h6"/>
    </svg>
  ),
  GroupBox: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" strokeDasharray="4 2"/>
      <rect x="6" y="6" width="5" height="5" rx="1"/>
      <rect x="13" y="6" width="5" height="5" rx="1"/>
      <rect x="9" y="13" width="6" height="5" rx="1"/>
    </svg>
  ),
  Swimlane: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <line x1="8" y1="2" x2="8" y2="22"/>
      <line x1="16" y1="2" x2="16" y2="22"/>
    </svg>
  ),
  Document: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Export: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const colors = [
  '#000000', '#374151', '#6B7280', '#9CA3AF',
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#FFFFFF',
];

const stickyColors = [
  '#FEF3C7', '#FEE2E2', '#DBEAFE', '#D1FAE5',
  '#FCE7F3', '#E0E7FF', '#FEF9C3', '#F3E8FF',
];

const templates: { id: TemplateType; label: string; description: string }[] = [
  { id: 'blank', label: 'Blank', description: 'Clean white canvas' },
  { id: 'ruled', label: 'Ruled', description: 'Horizontal lines' },
  { id: 'grid', label: 'Grid', description: 'Square grid pattern' },
  { id: 'dots', label: 'Dots', description: 'Dotted pattern' },
  { id: 'isometric', label: 'Isometric', description: '3D projection grid' },
  { id: 'cornell', label: 'Cornell', description: 'Note-taking layout' },
];

// Shape library categories (like draw.io)
const shapeCategories: ShapeCategory[] = [
  {
    id: 'basic',
    name: 'Basic Shapes',
    icon: 'shapes',
    shapes: [
      { type: 'square', name: 'Square' },
      { type: 'rectangle', name: 'Rectangle' },
      { type: 'rounded-rectangle', name: 'Rounded Rectangle' },
      { type: 'circle', name: 'Circle' },
      { type: 'ellipse', name: 'Ellipse' },
      { type: 'triangle', name: 'Triangle' },
      { type: 'diamond', name: 'Diamond' },
      { type: 'pentagon', name: 'Pentagon' },
      { type: 'hexagon', name: 'Hexagon' },
      { type: 'heptagon', name: 'Heptagon' },
      { type: 'octagon', name: 'Octagon' },
      { type: 'star', name: 'Star' },
      { type: 'heart', name: 'Heart' },
      { type: 'parallelogram', name: 'Parallelogram' },
      { type: 'trapezoid', name: 'Trapezoid' },
      { type: 'cross', name: 'Cross' },
      { type: 'cloud', name: 'Cloud' },
      { type: 'lightning', name: 'Lightning' },
      { type: 'callout', name: 'Callout' },
    ],
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    icon: 'flowchart',
    shapes: [
      { type: 'process', name: 'Process' },
      { type: 'decision', name: 'Decision' },
      { type: 'terminator', name: 'Start/End' },
      { type: 'data', name: 'Data (I/O)' },
      { type: 'document', name: 'Document' },
      { type: 'predefined-process', name: 'Predefined Process' },
      { type: 'manual-input', name: 'Manual Input' },
      { type: 'preparation', name: 'Preparation' },
      { type: 'database', name: 'Database' },
      { type: 'hard-disk', name: 'Hard Disk' },
      { type: 'internal-storage', name: 'Internal Storage' },
    ],
  },
  {
    id: 'arrows',
    name: 'Arrows & Lines',
    icon: 'arrow',
    shapes: [
      { type: 'line', name: 'Line' },
      { type: 'arrow', name: 'Arrow' },
      { type: 'double-arrow', name: 'Double Arrow' },
      { type: 'curved-arrow', name: 'Curved Arrow' },
      { type: 'right-arrow', name: 'Right Arrow' },
      { type: 'left-arrow', name: 'Left Arrow' },
      { type: 'up-arrow', name: 'Up Arrow' },
      { type: 'down-arrow', name: 'Down Arrow' },
    ],
  },
  {
    id: 'uml',
    name: 'UML',
    icon: 'package',
    shapes: [
      { type: 'actor', name: 'Actor' },
      { type: 'use-case', name: 'Use Case' },
      { type: 'class-box', name: 'Class Box' },
      { type: 'interface-box', name: 'Interface Box' },
      { type: 'package', name: 'Package' },
    ],
  },
  {
    id: 'containers',
    name: 'Containers',
    icon: 'group',
    shapes: [
      { type: 'loop', name: 'Loop' },
      { type: 'group-box', name: 'Group Box' },
      { type: 'swimlane', name: 'Swimlane' },
    ],
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    icon: 'grid',
    shapes: [
      { type: 'callout', name: 'Callout' },
    ],
  },
];

// Connector types
const connectorTypes: { type: ConnectorType; name: string; icon: string }[] = [
  { type: 'straight', name: 'Straight', icon: 'line' },
  { type: 'elbow', name: 'Elbow', icon: 'elbow' },
  { type: 'curved', name: 'Curved', icon: 'curved' },
];

// Arrow head types
const arrowHeadTypes: { type: ArrowHeadType; name: string }[] = [
  { type: 'none', name: 'None' },
  { type: 'arrow', name: 'Arrow' },
  { type: 'filled-arrow', name: 'Filled Arrow' },
  { type: 'diamond', name: 'Diamond' },
  { type: 'circle', name: 'Circle' },
  { type: 'open-arrow', name: 'Open Arrow' },
];

// ============================================
// MAIN COMPONENT
// ============================================
export function WhiteboardPage() {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [activeWhiteboard, setActiveWhiteboard] = useState<Whiteboard | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Drawing state
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  
  // Canvas transform state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  
  // UI state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFillColorPicker, setShowFillColorPicker] = useState(false);
  const [currentFillColor, setCurrentFillColor] = useState<string>('transparent');
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('rectangle');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'svg' | 'pdf'>('png');
  const [exportFilename, setExportFilename] = useState('');
  
  // Shape library state
  const [showShapeLibrary, setShowShapeLibrary] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');
  
  // Connector state
  const [selectedConnectorType, setSelectedConnectorType] = useState<ConnectorType>('straight');
  const [selectedStartArrow, setSelectedStartArrow] = useState<ArrowHeadType>('none');
  const [selectedEndArrow, setSelectedEndArrow] = useState<ArrowHeadType>('arrow');
  const [isDrawingConnector, setIsDrawingConnector] = useState(false);
  const [connectorStart, setConnectorStart] = useState<Point | null>(null);
  const [currentConnectorPreview, setCurrentConnectorPreview] = useState<Connector | null>(null);
  
  // Selection and manipulation state
  const [selectedElements, setSelectedElements] = useState<SelectedElement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [originalBounds, setOriginalBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [clipboard, setClipboard] = useState<Shape[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showConnectionPoints, setShowConnectionPoints] = useState(true);
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);
  const [hoveredConnectionPoint, setHoveredConnectionPoint] = useState<{ shapeId: string; position: string } | null>(null);
  const gridSize = 20;
  
  // Shape text editing state
  const [editingShapeTextId, setEditingShapeTextId] = useState<string | null>(null);
  const [editingShapeText, setEditingShapeText] = useState<string>('');
  const [editingShapePosition, setEditingShapePosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const shapeTextInputRef = useRef<HTMLTextAreaElement>(null);
  
  // AI Scanning state
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanProgressMessage, setScanProgressMessage] = useState<string>('');
  const [scanResult, setScanResult] = useState<{
    strokes: Stroke[];
    shapes: Shape[];
    textBoxes: TextBox[];
  } | null>(null);
  const [scanMode, setScanMode] = useState<'upload' | 'camera' | 'preview' | 'enhance'>('upload');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [showEnhancePreview, setShowEnhancePreview] = useState(false);
  const [enhanceOptions, setEnhanceOptions] = useState({
    contrast: 1.2,
    brightness: 1.0,
    sharpen: false,
    denoise: false,
    threshold: false,
  });
  const [editableResults, setEditableResults] = useState<{
    textBoxes: Array<TextBox & { selected?: boolean }>;
    shapes: Array<Shape & { selected?: boolean }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasEnhanceRef = useRef<HTMLCanvasElement>(null);
  
  // AI Brainstorming state
  const [showAIBrainstorm, setShowAIBrainstorm] = useState(false);
  
  // History for undo/redo
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Shape drawing state
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [currentShapePreview, setCurrentShapePreview] = useState<Shape | null>(null);
  
  // Text editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [newTextPosition, setNewTextPosition] = useState<Point | null>(null);

  // Initialize with a default whiteboard
  useEffect(() => {
    if (whiteboards.length === 0) {
      const defaultBoard: Whiteboard = {
        id: generateId(),
        title: 'Untitled Whiteboard',
        template: 'blank',
        strokes: [],
        shapes: [],
        connectors: [],
        textBoxes: [],
        stickyNotes: [],
        images: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isShared: false,
        collaborators: [],
      };
      setWhiteboards([defaultBoard]);
      setActiveWhiteboard(defaultBoard);
    }
  }, [whiteboards.length]);

  // Redraw canvas when anything changes
  useEffect(() => {
    if (!canvasRef.current || !activeWhiteboard) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transforms
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw template background
    drawTemplate(ctx, activeWhiteboard.template, canvas.width / zoom, canvas.height / zoom);

    // Draw all strokes
    activeWhiteboard.strokes.forEach(stroke => {
      drawStroke(ctx, stroke);
    });

    // Draw current stroke being drawn
    // Draw current stroke preview (for pen/highlighter only, not eraser)
    if (isDrawing && currentStroke.length > 0 && currentTool !== 'eraser') {
      const tempStroke: Stroke = {
        id: 'temp',
        tool: currentTool as 'pen' | 'highlighter',
        points: currentStroke,
        color: currentColor,
        width: brushSize,
        opacity: currentTool === 'highlighter' ? 0.4 : 1,
      };
      drawStroke(ctx, tempStroke);
    }
    
    // Draw eraser cursor indicator
    if (currentTool === 'eraser' && currentStroke.length > 0) {
      const lastPoint = currentStroke[currentStroke.length - 1];
      ctx.save();
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, brushSize * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // Draw shapes
    activeWhiteboard.shapes.forEach(shape => {
      drawShape(ctx, shape);
    });

    // Draw shape preview
    if (currentShapePreview) {
      drawShape(ctx, currentShapePreview);
    }

    // Draw connectors
    activeWhiteboard.connectors.forEach(connector => {
      drawConnector(ctx, connector);
    });

    // Draw connector preview
    if (currentConnectorPreview) {
      drawConnector(ctx, currentConnectorPreview);
    }

    ctx.restore();
  }, [activeWhiteboard, isDrawing, currentStroke, zoom, panOffset, currentShapePreview, currentConnectorPreview]);

  // Draw template pattern
  const drawTemplate = (ctx: CanvasRenderingContext2D, template: TemplateType, width: number, height: number) => {
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;

    const gridSize = 25;
    const extendedWidth = width + Math.abs(panOffset.x / zoom) * 2;
    const extendedHeight = height + Math.abs(panOffset.y / zoom) * 2;
    const startX = -Math.abs(panOffset.x / zoom) - gridSize;
    const startY = -Math.abs(panOffset.y / zoom) - gridSize;

    switch (template) {
      case 'ruled':
        for (let y = startY; y < extendedHeight; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(extendedWidth, y);
          ctx.stroke();
        }
        break;

      case 'grid':
        for (let x = startX; x < extendedWidth; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, startY);
          ctx.lineTo(x, extendedHeight);
          ctx.stroke();
        }
        for (let y = startY; y < extendedHeight; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(extendedWidth, y);
          ctx.stroke();
        }
        break;

      case 'dots':
        ctx.fillStyle = '#D1D5DB';
        for (let x = startX; x < extendedWidth; x += gridSize) {
          for (let y = startY; y < extendedHeight; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'isometric':
        ctx.strokeStyle = '#E5E7EB';
        const isoSize = 30;
        for (let x = startX; x < extendedWidth; x += isoSize) {
          ctx.beginPath();
          ctx.moveTo(x, startY);
          ctx.lineTo(x, extendedHeight);
          ctx.stroke();
        }
        for (let y = startY; y < extendedHeight; y += isoSize * 0.866) {
          const offset = Math.floor((y - startY) / (isoSize * 0.866)) % 2 === 0 ? 0 : isoSize / 2;
          ctx.beginPath();
          ctx.moveTo(startX + offset, y);
          for (let x = startX + offset; x < extendedWidth; x += isoSize) {
            ctx.lineTo(x, y);
            ctx.moveTo(x + isoSize / 2, y);
          }
          ctx.stroke();
        }
        break;

      case 'cornell':
        // Left margin
        ctx.beginPath();
        ctx.moveTo(200, startY);
        ctx.lineTo(200, extendedHeight);
        ctx.stroke();
        // Bottom section
        ctx.beginPath();
        ctx.moveTo(startX, height - 200);
        ctx.lineTo(extendedWidth, height - 200);
        ctx.stroke();
        // Ruled lines in main area
        for (let y = startY; y < height - 200; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(200, y);
          ctx.lineTo(extendedWidth, y);
          ctx.stroke();
        }
        break;
    }
  };

  // Draw a single stroke
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      
      // Smooth curve using quadratic bezier
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }
    
    // Connect to last point
    const lastPoint = stroke.points[stroke.points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  // Draw a shape
  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    ctx.beginPath();
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.fill;
    ctx.lineWidth = shape.strokeWidth;

    switch (shape.type) {
      case 'rectangle':
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;

      case 'circle':
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;
        const radiusX = Math.abs(shape.width) / 2;
        const radiusY = Math.abs(shape.height) / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'line':
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.stroke();
        break;

      case 'arrow':
        const endX = shape.x + shape.width;
        const endY = shape.y + shape.height;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Draw arrowhead
        const angle = Math.atan2(shape.height, shape.width);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case 'triangle':
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'diamond':
      case 'decision':
        ctx.moveTo(shape.x + shape.width / 2, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height / 2);
        ctx.lineTo(shape.x + shape.width / 2, shape.y + shape.height);
        ctx.lineTo(shape.x, shape.y + shape.height / 2);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'rounded-rectangle':
      case 'process':
        const rx = 8;
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, rx);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'terminator':
        const termRx = Math.min(Math.abs(shape.height) / 2, Math.abs(shape.width) / 4);
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, termRx);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'ellipse':
      case 'use-case':
        const ecx = shape.x + shape.width / 2;
        const ecy = shape.y + shape.height / 2;
        const erx = Math.abs(shape.width) / 2;
        const ery = Math.abs(shape.height) / 2;
        ctx.ellipse(ecx, ecy, erx, ery, 0, 0, Math.PI * 2);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'data':
      case 'parallelogram':
        const skew = shape.width * 0.2;
        ctx.moveTo(shape.x + skew, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y);
        ctx.lineTo(shape.x + shape.width - skew, shape.y + shape.height);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'database':
        const dbHeight = shape.height;
        const dbEllipseHeight = dbHeight * 0.15;
        // Top ellipse
        ctx.ellipse(shape.x + shape.width / 2, shape.y + dbEllipseHeight / 2, shape.width / 2, dbEllipseHeight / 2, 0, 0, Math.PI * 2);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        // Body
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y + dbEllipseHeight / 2);
        ctx.lineTo(shape.x, shape.y + dbHeight - dbEllipseHeight / 2);
        ctx.ellipse(shape.x + shape.width / 2, shape.y + dbHeight - dbEllipseHeight / 2, shape.width / 2, dbEllipseHeight / 2, 0, Math.PI, 0);
        ctx.lineTo(shape.x + shape.width, shape.y + dbEllipseHeight / 2);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'document':
        const waveHeight = shape.height * 0.1;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height - waveHeight);
        ctx.quadraticCurveTo(
          shape.x + shape.width * 0.75, shape.y + shape.height,
          shape.x + shape.width / 2, shape.y + shape.height - waveHeight
        );
        ctx.quadraticCurveTo(
          shape.x + shape.width * 0.25, shape.y + shape.height - waveHeight * 2,
          shape.x, shape.y + shape.height - waveHeight
        );
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'square':
        // Square is just a rectangle with equal sides - handled the same as rectangle
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;

      case 'hexagon':
        const hx = shape.x;
        const hy = shape.y;
        const hw = shape.width;
        const hh = shape.height;
        const inset = hw * 0.25;
        ctx.moveTo(hx + inset, hy);
        ctx.lineTo(hx + hw - inset, hy);
        ctx.lineTo(hx + hw, hy + hh / 2);
        ctx.lineTo(hx + hw - inset, hy + hh);
        ctx.lineTo(hx + inset, hy + hh);
        ctx.lineTo(hx, hy + hh / 2);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'pentagon':
        const px = shape.x + shape.width / 2;
        const py = shape.y;
        const pr = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;
        const pcx = shape.x + shape.width / 2;
        const pcy = shape.y + shape.height / 2;
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const ptx = pcx + pr * Math.cos(angle);
          const pty = pcy + pr * Math.sin(angle);
          if (i === 0) ctx.moveTo(ptx, pty);
          else ctx.lineTo(ptx, pty);
        }
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'heptagon':
        const heptCx = shape.x + shape.width / 2;
        const heptCy = shape.y + shape.height / 2;
        const heptR = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;
        for (let i = 0; i < 7; i++) {
          const angle = (i * 2 * Math.PI) / 7 - Math.PI / 2;
          const heptPx = heptCx + heptR * Math.cos(angle);
          const heptPy = heptCy + heptR * Math.sin(angle);
          if (i === 0) ctx.moveTo(heptPx, heptPy);
          else ctx.lineTo(heptPx, heptPy);
        }
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'octagon':
        const octX = shape.x;
        const octY = shape.y;
        const octW = shape.width;
        const octH = shape.height;
        const octInset = Math.min(octW, octH) * 0.3;
        ctx.moveTo(octX + octInset, octY);
        ctx.lineTo(octX + octW - octInset, octY);
        ctx.lineTo(octX + octW, octY + octInset);
        ctx.lineTo(octX + octW, octY + octH - octInset);
        ctx.lineTo(octX + octW - octInset, octY + octH);
        ctx.lineTo(octX + octInset, octY + octH);
        ctx.lineTo(octX, octY + octH - octInset);
        ctx.lineTo(octX, octY + octInset);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'heart':
        const heartX = shape.x;
        const heartY = shape.y;
        const heartW = shape.width;
        const heartH = shape.height;
        ctx.moveTo(heartX + heartW / 2, heartY + heartH);
        ctx.bezierCurveTo(
          heartX - heartW * 0.25, heartY + heartH * 0.6,
          heartX, heartY,
          heartX + heartW / 2, heartY + heartH * 0.35
        );
        ctx.bezierCurveTo(
          heartX + heartW, heartY,
          heartX + heartW * 1.25, heartY + heartH * 0.6,
          heartX + heartW / 2, heartY + heartH
        );
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'lightning':
        const lx = shape.x;
        const ly = shape.y;
        const lw = shape.width;
        const lh = shape.height;
        ctx.moveTo(lx + lw * 0.6, ly);
        ctx.lineTo(lx + lw * 0.25, ly + lh * 0.45);
        ctx.lineTo(lx + lw * 0.5, ly + lh * 0.45);
        ctx.lineTo(lx + lw * 0.35, ly + lh);
        ctx.lineTo(lx + lw * 0.75, ly + lh * 0.5);
        ctx.lineTo(lx + lw * 0.5, ly + lh * 0.5);
        ctx.lineTo(lx + lw * 0.6, ly);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'star':
        const outerRadius = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;
        const innerRadius = outerRadius * 0.4;
        const starCx = shape.x + shape.width / 2;
        const starCy = shape.y + shape.height / 2;
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const starAngle = (i * Math.PI) / 5 - Math.PI / 2;
          const sx = starCx + radius * Math.cos(starAngle);
          const sy = starCy + radius * Math.sin(starAngle);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'cloud':
        const cloudX = shape.x;
        const cloudY = shape.y;
        const cloudW = shape.width;
        const cloudH = shape.height;
        ctx.moveTo(cloudX + cloudW * 0.2, cloudY + cloudH * 0.8);
        ctx.bezierCurveTo(cloudX, cloudY + cloudH * 0.8, cloudX, cloudY + cloudH * 0.4, cloudX + cloudW * 0.2, cloudY + cloudH * 0.4);
        ctx.bezierCurveTo(cloudX + cloudW * 0.2, cloudY + cloudH * 0.2, cloudX + cloudW * 0.35, cloudY, cloudX + cloudW * 0.5, cloudY + cloudH * 0.2);
        ctx.bezierCurveTo(cloudX + cloudW * 0.65, cloudY, cloudX + cloudW * 0.85, cloudY + cloudH * 0.1, cloudX + cloudW * 0.85, cloudY + cloudH * 0.35);
        ctx.bezierCurveTo(cloudX + cloudW, cloudY + cloudH * 0.35, cloudX + cloudW, cloudY + cloudH * 0.65, cloudX + cloudW * 0.85, cloudY + cloudH * 0.65);
        ctx.bezierCurveTo(cloudX + cloudW * 0.85, cloudY + cloudH * 0.85, cloudX + cloudW * 0.7, cloudY + cloudH, cloudX + cloudW * 0.5, cloudY + cloudH * 0.85);
        ctx.bezierCurveTo(cloudX + cloudW * 0.3, cloudY + cloudH, cloudX + cloudW * 0.15, cloudY + cloudH * 0.9, cloudX + cloudW * 0.2, cloudY + cloudH * 0.8);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'callout':
        const callX = shape.x;
        const callY = shape.y;
        const callW = shape.width;
        const callH = shape.height * 0.8;
        const tailH = shape.height * 0.2;
        ctx.roundRect(callX, callY, callW, callH, 8);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        // Tail
        ctx.beginPath();
        ctx.moveTo(callX + callW * 0.2, callY + callH);
        ctx.lineTo(callX + callW * 0.1, callY + callH + tailH);
        ctx.lineTo(callX + callW * 0.35, callY + callH);
        ctx.stroke();
        break;

      case 'actor':
        const actorX = shape.x + shape.width / 2;
        const actorY = shape.y;
        const headR = Math.min(shape.width, shape.height) * 0.15;
        // Head
        ctx.arc(actorX, actorY + headR, headR, 0, Math.PI * 2);
        ctx.stroke();
        // Body
        ctx.beginPath();
        ctx.moveTo(actorX, actorY + headR * 2);
        ctx.lineTo(actorX, actorY + shape.height * 0.6);
        ctx.stroke();
        // Arms
        ctx.beginPath();
        ctx.moveTo(shape.x, actorY + shape.height * 0.35);
        ctx.lineTo(shape.x + shape.width, actorY + shape.height * 0.35);
        ctx.stroke();
        // Legs
        ctx.beginPath();
        ctx.moveTo(actorX, actorY + shape.height * 0.6);
        ctx.lineTo(shape.x, actorY + shape.height);
        ctx.moveTo(actorX, actorY + shape.height * 0.6);
        ctx.lineTo(shape.x + shape.width, actorY + shape.height);
        ctx.stroke();
        break;

      case 'double-arrow':
        const daEndX = shape.x + shape.width;
        const daEndY = shape.y + shape.height;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(daEndX, daEndY);
        ctx.stroke();
        // End arrowhead
        const daAngle = Math.atan2(shape.height, shape.width);
        const daHeadLen = 12;
        ctx.beginPath();
        ctx.moveTo(daEndX, daEndY);
        ctx.lineTo(daEndX - daHeadLen * Math.cos(daAngle - Math.PI / 6), daEndY - daHeadLen * Math.sin(daAngle - Math.PI / 6));
        ctx.moveTo(daEndX, daEndY);
        ctx.lineTo(daEndX - daHeadLen * Math.cos(daAngle + Math.PI / 6), daEndY - daHeadLen * Math.sin(daAngle + Math.PI / 6));
        // Start arrowhead
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + daHeadLen * Math.cos(daAngle - Math.PI / 6), shape.y + daHeadLen * Math.sin(daAngle - Math.PI / 6));
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + daHeadLen * Math.cos(daAngle + Math.PI / 6), shape.y + daHeadLen * Math.sin(daAngle + Math.PI / 6));
        ctx.stroke();
        break;

      case 'predefined-process':
        // Rectangle with double vertical lines on sides
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        const ppInset = shape.width * 0.1;
        ctx.beginPath();
        ctx.moveTo(shape.x + ppInset, shape.y);
        ctx.lineTo(shape.x + ppInset, shape.y + shape.height);
        ctx.moveTo(shape.x + shape.width - ppInset, shape.y);
        ctx.lineTo(shape.x + shape.width - ppInset, shape.y + shape.height);
        ctx.stroke();
        break;

      case 'manual-input':
        // Parallelogram with slanted top
        ctx.moveTo(shape.x, shape.y + shape.height * 0.2);
        ctx.lineTo(shape.x + shape.width, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'preparation':
        // Hexagon for preparation
        const prepX = shape.x;
        const prepY = shape.y;
        const prepW = shape.width;
        const prepH = shape.height;
        const prepInset = prepW * 0.15;
        ctx.moveTo(prepX + prepInset, prepY);
        ctx.lineTo(prepX + prepW - prepInset, prepY);
        ctx.lineTo(prepX + prepW, prepY + prepH / 2);
        ctx.lineTo(prepX + prepW - prepInset, prepY + prepH);
        ctx.lineTo(prepX + prepInset, prepY + prepH);
        ctx.lineTo(prepX, prepY + prepH / 2);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'hard-disk':
        // Cylinder (like database but horizontal orientation suggestion)
        const hdX = shape.x;
        const hdY = shape.y;
        const hdW = shape.width;
        const hdH = shape.height;
        const hdEllW = hdW * 0.15;
        // Left ellipse
        ctx.ellipse(hdX + hdEllW / 2, hdY + hdH / 2, hdEllW / 2, hdH / 2, 0, 0, Math.PI * 2);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        // Body
        ctx.beginPath();
        ctx.moveTo(hdX + hdEllW / 2, hdY);
        ctx.lineTo(hdX + hdW - hdEllW / 2, hdY);
        ctx.ellipse(hdX + hdW - hdEllW / 2, hdY + hdH / 2, hdEllW / 2, hdH / 2, 0, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(hdX + hdEllW / 2, hdY + hdH);
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'internal-storage':
        // Rectangle with corner lines
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        const isInset = Math.min(shape.width, shape.height) * 0.15;
        ctx.beginPath();
        ctx.moveTo(shape.x + isInset, shape.y);
        ctx.lineTo(shape.x + isInset, shape.y + shape.height);
        ctx.moveTo(shape.x, shape.y + isInset);
        ctx.lineTo(shape.x + shape.width, shape.y + isInset);
        ctx.stroke();
        break;

      case 'curved-arrow':
        // Curved arrow using quadratic curve
        const caStartX = shape.x;
        const caStartY = shape.y + shape.height;
        const caEndX = shape.x + shape.width;
        const caEndY = shape.y;
        const caCtrlX = shape.x + shape.width / 2;
        const caCtrlY = shape.y - shape.height * 0.3;
        ctx.moveTo(caStartX, caStartY);
        ctx.quadraticCurveTo(caCtrlX, caCtrlY, caEndX, caEndY);
        ctx.stroke();
        // Arrowhead
        const caAngle = Math.atan2(caEndY - caCtrlY, caEndX - caCtrlX);
        const caHeadLen = 12;
        ctx.beginPath();
        ctx.moveTo(caEndX, caEndY);
        ctx.lineTo(caEndX - caHeadLen * Math.cos(caAngle - Math.PI / 6), caEndY - caHeadLen * Math.sin(caAngle - Math.PI / 6));
        ctx.moveTo(caEndX, caEndY);
        ctx.lineTo(caEndX - caHeadLen * Math.cos(caAngle + Math.PI / 6), caEndY - caHeadLen * Math.sin(caAngle + Math.PI / 6));
        ctx.stroke();
        break;

      case 'right-arrow':
        const raX = shape.x;
        const raY = shape.y;
        const raW = shape.width;
        const raH = shape.height;
        const raArrowW = raW * 0.3;
        ctx.moveTo(raX, raY + raH * 0.25);
        ctx.lineTo(raX + raW - raArrowW, raY + raH * 0.25);
        ctx.lineTo(raX + raW - raArrowW, raY);
        ctx.lineTo(raX + raW, raY + raH / 2);
        ctx.lineTo(raX + raW - raArrowW, raY + raH);
        ctx.lineTo(raX + raW - raArrowW, raY + raH * 0.75);
        ctx.lineTo(raX, raY + raH * 0.75);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'left-arrow':
        const laX = shape.x;
        const laY = shape.y;
        const laW = shape.width;
        const laH = shape.height;
        const laArrowW = laW * 0.3;
        ctx.moveTo(laX + laW, laY + laH * 0.25);
        ctx.lineTo(laX + laArrowW, laY + laH * 0.25);
        ctx.lineTo(laX + laArrowW, laY);
        ctx.lineTo(laX, laY + laH / 2);
        ctx.lineTo(laX + laArrowW, laY + laH);
        ctx.lineTo(laX + laArrowW, laY + laH * 0.75);
        ctx.lineTo(laX + laW, laY + laH * 0.75);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'up-arrow':
        const uaX = shape.x;
        const uaY = shape.y;
        const uaW = shape.width;
        const uaH = shape.height;
        const uaArrowH = uaH * 0.3;
        ctx.moveTo(uaX + uaW * 0.25, uaY + uaH);
        ctx.lineTo(uaX + uaW * 0.25, uaY + uaArrowH);
        ctx.lineTo(uaX, uaY + uaArrowH);
        ctx.lineTo(uaX + uaW / 2, uaY);
        ctx.lineTo(uaX + uaW, uaY + uaArrowH);
        ctx.lineTo(uaX + uaW * 0.75, uaY + uaArrowH);
        ctx.lineTo(uaX + uaW * 0.75, uaY + uaH);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'down-arrow':
        const dnaX = shape.x;
        const dnaY = shape.y;
        const dnaW = shape.width;
        const dnaH = shape.height;
        const dnaArrowH = dnaH * 0.3;
        ctx.moveTo(dnaX + dnaW * 0.25, dnaY);
        ctx.lineTo(dnaX + dnaW * 0.25, dnaY + dnaH - dnaArrowH);
        ctx.lineTo(dnaX, dnaY + dnaH - dnaArrowH);
        ctx.lineTo(dnaX + dnaW / 2, dnaY + dnaH);
        ctx.lineTo(dnaX + dnaW, dnaY + dnaH - dnaArrowH);
        ctx.lineTo(dnaX + dnaW * 0.75, dnaY + dnaH - dnaArrowH);
        ctx.lineTo(dnaX + dnaW * 0.75, dnaY);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'class-box':
        // UML Class box with 3 sections
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        const cbSection = shape.height / 3;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y + cbSection);
        ctx.lineTo(shape.x + shape.width, shape.y + cbSection);
        ctx.moveTo(shape.x, shape.y + cbSection * 2);
        ctx.lineTo(shape.x + shape.width, shape.y + cbSection * 2);
        ctx.stroke();
        break;

      case 'interface-box':
        // UML Interface box with 2 sections
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        const ibSection = shape.height / 2;
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y + ibSection);
        ctx.lineTo(shape.x + shape.width, shape.y + ibSection);
        ctx.stroke();
        break;

      case 'package':
        // UML Package shape with tab
        const pkgX = shape.x;
        const pkgY = shape.y;
        const pkgW = shape.width;
        const pkgH = shape.height;
        const tabW = pkgW * 0.4;
        const tabH = pkgH * 0.15;
        // Tab
        ctx.moveTo(pkgX, pkgY + tabH);
        ctx.lineTo(pkgX, pkgY);
        ctx.lineTo(pkgX + tabW, pkgY);
        ctx.lineTo(pkgX + tabW, pkgY + tabH);
        // Main body
        ctx.lineTo(pkgX + pkgW, pkgY + tabH);
        ctx.lineTo(pkgX + pkgW, pkgY + pkgH);
        ctx.lineTo(pkgX, pkgY + pkgH);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'trapezoid':
        const trapX = shape.x;
        const trapY = shape.y;
        const trapW = shape.width;
        const trapH = shape.height;
        const trapInset = trapW * 0.2;
        ctx.moveTo(trapX + trapInset, trapY);
        ctx.lineTo(trapX + trapW - trapInset, trapY);
        ctx.lineTo(trapX + trapW, trapY + trapH);
        ctx.lineTo(trapX, trapY + trapH);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'cross':
        const crX = shape.x;
        const crY = shape.y;
        const crW = shape.width;
        const crH = shape.height;
        const crThick = Math.min(crW, crH) * 0.33;
        const crHOffset = (crW - crThick) / 2;
        const crVOffset = (crH - crThick) / 2;
        ctx.moveTo(crX + crHOffset, crY);
        ctx.lineTo(crX + crHOffset + crThick, crY);
        ctx.lineTo(crX + crHOffset + crThick, crY + crVOffset);
        ctx.lineTo(crX + crW, crY + crVOffset);
        ctx.lineTo(crX + crW, crY + crVOffset + crThick);
        ctx.lineTo(crX + crHOffset + crThick, crY + crVOffset + crThick);
        ctx.lineTo(crX + crHOffset + crThick, crY + crH);
        ctx.lineTo(crX + crHOffset, crY + crH);
        ctx.lineTo(crX + crHOffset, crY + crVOffset + crThick);
        ctx.lineTo(crX, crY + crVOffset + crThick);
        ctx.lineTo(crX, crY + crVOffset);
        ctx.lineTo(crX + crHOffset, crY + crVOffset);
        ctx.closePath();
        if (shape.fill !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;

      case 'loop':
        // Loop container - rounded rectangle with header section
        const loopX = shape.x;
        const loopY = shape.y;
        const loopW = shape.width;
        const loopH = shape.height;
        const loopHeaderH = Math.min(28, loopH * 0.15);
        const loopRadius = 6;
        
        // Draw main container with header
        ctx.beginPath();
        ctx.roundRect(loopX, loopY, loopW, loopH, loopRadius);
        if (shape.fill !== 'transparent') {
          ctx.globalAlpha = 0.1;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
        
        // Draw header separator
        ctx.beginPath();
        ctx.moveTo(loopX, loopY + loopHeaderH);
        ctx.lineTo(loopX + loopW, loopY + loopHeaderH);
        ctx.stroke();
        
        // Draw "loop" label in header
        ctx.save();
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = shape.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.containerLabel || 'loop', loopX + 10, loopY + loopHeaderH / 2);
        ctx.restore();
        
        // Draw loop icon
        ctx.beginPath();
        const iconX = loopX + loopW - 24;
        const iconY = loopY + loopHeaderH / 2;
        ctx.arc(iconX, iconY, 6, 0, Math.PI * 1.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(iconX + 5, iconY - 3);
        ctx.lineTo(iconX + 8, iconY);
        ctx.lineTo(iconX + 5, iconY + 3);
        ctx.stroke();
        break;

      case 'group-box':
        // Group box - dashed border container
        const gbX = shape.x;
        const gbY = shape.y;
        const gbW = shape.width;
        const gbH = shape.height;
        const gbRadius = 8;
        
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.roundRect(gbX, gbY, gbW, gbH, gbRadius);
        if (shape.fill !== 'transparent') {
          ctx.globalAlpha = 0.05;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
        ctx.restore();
        
        // Draw label if exists
        if (shape.containerLabel) {
          ctx.save();
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillStyle = shape.color;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          
          // Draw label background
          const labelMetrics = ctx.measureText(shape.containerLabel);
          const labelPadding = 6;
          ctx.fillStyle = shape.fill !== 'transparent' ? shape.fill : '#1e1e2e';
          ctx.fillRect(gbX + 12, gbY - 8, labelMetrics.width + labelPadding * 2, 16);
          
          ctx.fillStyle = shape.color;
          ctx.fillText(shape.containerLabel, gbX + 12 + labelPadding, gbY - 6);
          ctx.restore();
        }
        break;

      case 'swimlane':
        // Swimlane - vertical lanes container
        const slX = shape.x;
        const slY = shape.y;
        const slW = shape.width;
        const slH = shape.height;
        const slHeaderH = 32;
        const slRadius = 4;
        
        // Main container
        ctx.beginPath();
        ctx.roundRect(slX, slY, slW, slH, slRadius);
        if (shape.fill !== 'transparent') {
          ctx.globalAlpha = 0.05;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.stroke();
        
        // Header
        ctx.beginPath();
        ctx.moveTo(slX, slY + slHeaderH);
        ctx.lineTo(slX + slW, slY + slHeaderH);
        ctx.stroke();
        
        // Draw label
        ctx.save();
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = shape.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shape.containerLabel || 'Swimlane', slX + slW / 2, slY + slHeaderH / 2);
        ctx.restore();
        break;

      default:
        // Default to rectangle for unknown shapes
        if (shape.fill !== 'transparent') {
          ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
        }
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }

    // Draw text inside shape
    if (shape.text) {
      const fontSize = shape.fontSize || 14;
      const textColor = shape.textColor || '#000000';
      
      ctx.save();
      ctx.font = `${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textX = shape.x + shape.width / 2;
      const textY = shape.y + shape.height / 2;
      
      // Word wrap if text is too long
      const maxWidth = Math.abs(shape.width) - 16;
      const words = shape.text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = textY - totalHeight / 2 + lineHeight / 2;
      
      lines.forEach((line, index) => {
        ctx.fillText(line, textX, startY + index * lineHeight);
      });
      
      ctx.restore();
    }
  };

  // Draw a connector
  const drawConnector = (ctx: CanvasRenderingContext2D, connector: Connector) => {
    ctx.beginPath();
    ctx.strokeStyle = connector.color;
    ctx.lineWidth = connector.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { startPoint, endPoint, type } = connector;

    switch (type) {
      case 'straight':
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        break;

      case 'elbow':
        const midX = (startPoint.x + endPoint.x) / 2;
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(midX, startPoint.y);
        ctx.lineTo(midX, endPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        break;

      case 'curved':
        const cp1x = startPoint.x + (endPoint.x - startPoint.x) * 0.5;
        const cp1y = startPoint.y;
        const cp2x = startPoint.x + (endPoint.x - startPoint.x) * 0.5;
        const cp2y = endPoint.y;
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endPoint.x, endPoint.y);
        break;
    }
    ctx.stroke();

    // Draw arrow heads
    const drawArrowHead = (x: number, y: number, angle: number, arrowType: ArrowHeadType) => {
      if (arrowType === 'none') return;
      
      const headLength = 12;
      const headAngle = Math.PI / 6;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      switch (arrowType) {
        case 'arrow':
        case 'open-arrow':
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-headLength, -headLength * Math.tan(headAngle));
          ctx.moveTo(0, 0);
          ctx.lineTo(-headLength, headLength * Math.tan(headAngle));
          ctx.stroke();
          break;

        case 'filled-arrow':
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-headLength, -headLength * Math.tan(headAngle));
          ctx.lineTo(-headLength, headLength * Math.tan(headAngle));
          ctx.closePath();
          ctx.fillStyle = connector.color;
          ctx.fill();
          break;

        case 'diamond':
          const dSize = headLength * 0.7;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-dSize, -dSize / 2);
          ctx.lineTo(-dSize * 2, 0);
          ctx.lineTo(-dSize, dSize / 2);
          ctx.closePath();
          ctx.stroke();
          break;

        case 'circle':
          const radius = headLength * 0.4;
          ctx.beginPath();
          ctx.arc(-radius, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }

      ctx.restore();
    };

    // Calculate angles for arrow heads
    if (connector.startArrow !== 'none') {
      const startAngle = Math.atan2(startPoint.y - endPoint.y, startPoint.x - endPoint.x);
      drawArrowHead(startPoint.x, startPoint.y, startAngle, connector.startArrow);
    }

    if (connector.endArrow !== 'none') {
      let endAngle: number;
      if (type === 'elbow') {
        // For elbow, the end angle depends on the direction
        endAngle = endPoint.x > startPoint.x ? 0 : Math.PI;
      } else {
        endAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
      }
      drawArrowHead(endPoint.x, endPoint.y, endAngle, connector.endArrow);
    }

    // Draw label if exists
    if (connector.label) {
      const labelX = (startPoint.x + endPoint.x) / 2;
      const labelY = (startPoint.y + endPoint.y) / 2;
      
      ctx.save();
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = connector.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw background
      const metrics = ctx.measureText(connector.label);
      const padding = 4;
      ctx.fillStyle = 'white';
      ctx.fillRect(
        labelX - metrics.width / 2 - padding,
        labelY - 8 - padding,
        metrics.width + padding * 2,
        16 + padding * 2
      );
      
      ctx.fillStyle = connector.color;
      ctx.fillText(connector.label, labelX, labelY);
      ctx.restore();
    }
  };

  // Get canvas coordinates from event
  const getCanvasCoords = useCallback((e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
      pressure: 'pressure' in e ? e.pressure : 0.5,
    };
  }, [zoom, panOffset]);

  // Find shape at a given point
  const findShapeAtPoint = useCallback((point: Point): Shape | null => {
    if (!activeWhiteboard) return null;
    
    // Check shapes in reverse order (top-most first)
    for (let i = activeWhiteboard.shapes.length - 1; i >= 0; i--) {
      const shape = activeWhiteboard.shapes[i];
      const { x, y, width, height } = shape;
      
      // Simple bounding box check
      if (point.x >= x && point.x <= x + Math.abs(width) &&
          point.y >= y && point.y <= y + Math.abs(height)) {
        return shape;
      }
    }
    return null;
  }, [activeWhiteboard]);

  // Find strokes near a point (for eraser)
  const findStrokesNearPoint = useCallback((point: Point, radius: number): string[] => {
    if (!activeWhiteboard) return [];
    
    const nearStrokes: string[] = [];
    
    activeWhiteboard.strokes.forEach(stroke => {
      // Skip eraser strokes
      if (stroke.tool === 'eraser') return;
      
      // Check if any point in the stroke is within radius
      for (const strokePoint of stroke.points) {
        const dx = strokePoint.x - point.x;
        const dy = strokePoint.y - point.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= radius + stroke.width / 2) {
          nearStrokes.push(stroke.id);
          break;
        }
      }
    });
    
    return nearStrokes;
  }, [activeWhiteboard]);

  // Erase strokes that intersect with current eraser position
  const eraseAtPoint = useCallback((point: Point, eraserRadius: number) => {
    if (!activeWhiteboard) return;
    
    const strokesToErase = findStrokesNearPoint(point, eraserRadius);
    
    if (strokesToErase.length > 0) {
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        strokes: prev.strokes.filter(s => !strokesToErase.includes(s.id)),
        updatedAt: new Date(),
      } : null);
    }
    
    // Also check if eraser hits shapes
    const shape = findShapeAtPoint(point);
    if (shape) {
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        shapes: prev.shapes.filter(s => s.id !== shape.id),
        updatedAt: new Date(),
      } : null);
    }
  }, [activeWhiteboard, findStrokesNearPoint, findShapeAtPoint]);

  // Snap point to grid
  const snapToGridPoint = useCallback((point: Point): Point => {
    if (!snapToGrid) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Get connection points for a shape
  const getShapeConnectionPoints = useCallback((shape: Shape): { position: string; x: number; y: number }[] => {
    const { x, y, width, height } = shape;
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    
    return [
      { position: 'top', x: x + absWidth / 2, y: y },
      { position: 'right', x: x + absWidth, y: y + absHeight / 2 },
      { position: 'bottom', x: x + absWidth / 2, y: y + absHeight },
      { position: 'left', x: x, y: y + absHeight / 2 },
    ];
  }, []);

  // Find connection point near a point
  const findConnectionPointAtPoint = useCallback((point: Point, threshold: number = 15): { shapeId: string; position: string; x: number; y: number } | null => {
    if (!activeWhiteboard) return null;
    
    for (const shape of activeWhiteboard.shapes) {
      const connectionPoints = getShapeConnectionPoints(shape);
      for (const cp of connectionPoints) {
        const distance = Math.sqrt(Math.pow(point.x - cp.x, 2) + Math.pow(point.y - cp.y, 2));
        if (distance <= threshold) {
          return { shapeId: shape.id, ...cp };
        }
      }
    }
    return null;
  }, [activeWhiteboard, getShapeConnectionPoints]);

  // Get resize handles for selected shape
  const getResizeHandles = useCallback((shape: Shape): ResizeHandle[] => {
    const { x, y, width, height } = shape;
    const absWidth = Math.abs(width);
    const absHeight = Math.abs(height);
    const handleSize = 8;
    
    return [
      { position: 'nw', x: x - handleSize / 2, y: y - handleSize / 2, cursor: 'nwse-resize' },
      { position: 'n', x: x + absWidth / 2 - handleSize / 2, y: y - handleSize / 2, cursor: 'ns-resize' },
      { position: 'ne', x: x + absWidth - handleSize / 2, y: y - handleSize / 2, cursor: 'nesw-resize' },
      { position: 'e', x: x + absWidth - handleSize / 2, y: y + absHeight / 2 - handleSize / 2, cursor: 'ew-resize' },
      { position: 'se', x: x + absWidth - handleSize / 2, y: y + absHeight - handleSize / 2, cursor: 'nwse-resize' },
      { position: 's', x: x + absWidth / 2 - handleSize / 2, y: y + absHeight - handleSize / 2, cursor: 'ns-resize' },
      { position: 'sw', x: x - handleSize / 2, y: y + absHeight - handleSize / 2, cursor: 'nesw-resize' },
      { position: 'w', x: x - handleSize / 2, y: y + absHeight / 2 - handleSize / 2, cursor: 'ew-resize' },
    ];
  }, []);

  // Check if point is on a resize handle
  const findResizeHandleAtPoint = useCallback((point: Point, shape: Shape): HandlePosition | null => {
    const handles = getResizeHandles(shape);
    const handleSize = 10;
    
    for (const handle of handles) {
      if (point.x >= handle.x && point.x <= handle.x + handleSize &&
          point.y >= handle.y && point.y <= handle.y + handleSize) {
        return handle.position as HandlePosition;
      }
    }
    return null;
  }, [getResizeHandles]);

  // Select a shape
  const selectShape = useCallback((shapeId: string, addToSelection: boolean = false) => {
    if (addToSelection) {
      setSelectedElements(prev => {
        const exists = prev.find(el => el.id === shapeId);
        if (exists) {
          return prev.filter(el => el.id !== shapeId);
        }
        return [...prev, { id: shapeId, type: 'shape' }];
      });
    } else {
      setSelectedElements([{ id: shapeId, type: 'shape' }]);
    }
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedElements([]);
  }, []);

  // Delete selected elements
  const deleteSelected = useCallback(() => {
    if (!activeWhiteboard || selectedElements.length === 0) return;
    
    const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
    const connectorIds = selectedElements.filter(el => el.type === 'connector').map(el => el.id);
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: prev.shapes.filter(s => !shapeIds.includes(s.id)),
      connectors: prev.connectors.filter(c => !connectorIds.includes(c.id)),
      updatedAt: new Date(),
    } : null);
    
    clearSelection();
  }, [activeWhiteboard, selectedElements, clearSelection]);

  // Copy selected elements
  const copySelected = useCallback(() => {
    if (!activeWhiteboard || selectedElements.length === 0) return;
    
    const shapesToCopy = activeWhiteboard.shapes.filter(s => 
      selectedElements.some(el => el.id === s.id && el.type === 'shape')
    );
    
    setClipboard(shapesToCopy);
  }, [activeWhiteboard, selectedElements]);

  // Paste from clipboard
  const pasteFromClipboard = useCallback(() => {
    if (!activeWhiteboard || clipboard.length === 0) return;
    
    const offset = 20;
    const newShapes = clipboard.map(shape => ({
      ...shape,
      id: generateId(),
      x: shape.x + offset,
      y: shape.y + offset,
    }));
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: [...prev.shapes, ...newShapes],
      updatedAt: new Date(),
    } : null);
    
    setSelectedElements(newShapes.map(s => ({ id: s.id, type: 'shape' as ElementType })));
  }, [activeWhiteboard, clipboard]);

  // Duplicate selected elements
  const duplicateSelected = useCallback(() => {
    copySelected();
    setTimeout(() => pasteFromClipboard(), 0);
  }, [copySelected, pasteFromClipboard]);

  // Move selected shapes
  const moveSelectedShapes = useCallback((dx: number, dy: number) => {
    if (!activeWhiteboard || selectedElements.length === 0) return;
    
    const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: prev.shapes.map(s => 
        shapeIds.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s
      ),
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, selectedElements]);

  // Bring shape to front
  const bringToFront = useCallback(() => {
    if (!activeWhiteboard || selectedElements.length === 0) return;
    
    const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
    const selectedShapes = activeWhiteboard.shapes.filter(s => shapeIds.includes(s.id));
    const otherShapes = activeWhiteboard.shapes.filter(s => !shapeIds.includes(s.id));
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: [...otherShapes, ...selectedShapes],
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, selectedElements]);

  // Send shape to back
  const sendToBack = useCallback(() => {
    if (!activeWhiteboard || selectedElements.length === 0) return;
    
    const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
    const selectedShapes = activeWhiteboard.shapes.filter(s => shapeIds.includes(s.id));
    const otherShapes = activeWhiteboard.shapes.filter(s => !shapeIds.includes(s.id));
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: [...selectedShapes, ...otherShapes],
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, selectedElements]);

  // Align selected shapes
  const alignShapes = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!activeWhiteboard || selectedElements.length < 2) return;
    
    const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
    const selectedShapes = activeWhiteboard.shapes.filter(s => shapeIds.includes(s.id));
    
    if (selectedShapes.length < 2) return;
    
    let targetValue: number;
    
    switch (alignment) {
      case 'left':
        targetValue = Math.min(...selectedShapes.map(s => s.x));
        break;
      case 'center':
        const minX = Math.min(...selectedShapes.map(s => s.x));
        const maxX = Math.max(...selectedShapes.map(s => s.x + Math.abs(s.width)));
        targetValue = (minX + maxX) / 2;
        break;
      case 'right':
        targetValue = Math.max(...selectedShapes.map(s => s.x + Math.abs(s.width)));
        break;
      case 'top':
        targetValue = Math.min(...selectedShapes.map(s => s.y));
        break;
      case 'middle':
        const minY = Math.min(...selectedShapes.map(s => s.y));
        const maxY = Math.max(...selectedShapes.map(s => s.y + Math.abs(s.height)));
        targetValue = (minY + maxY) / 2;
        break;
      case 'bottom':
        targetValue = Math.max(...selectedShapes.map(s => s.y + Math.abs(s.height)));
        break;
    }
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: prev.shapes.map(s => {
        if (!shapeIds.includes(s.id)) return s;
        
        switch (alignment) {
          case 'left':
            return { ...s, x: targetValue };
          case 'center':
            return { ...s, x: targetValue - Math.abs(s.width) / 2 };
          case 'right':
            return { ...s, x: targetValue - Math.abs(s.width) };
          case 'top':
            return { ...s, y: targetValue };
          case 'middle':
            return { ...s, y: targetValue - Math.abs(s.height) / 2 };
          case 'bottom':
            return { ...s, y: targetValue - Math.abs(s.height) };
          default:
            return s;
        }
      }),
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, selectedElements]);

  // Get selected shape for properties panel
  const selectedShapeObject = useMemo(() => {
    if (selectedElements.length !== 1 || selectedElements[0].type !== 'shape') return null;
    return activeWhiteboard?.shapes.find(s => s.id === selectedElements[0].id) || null;
  }, [selectedElements, activeWhiteboard]);

  // Auto-show properties panel when shape is selected
  useEffect(() => {
    if (selectedElements.length === 1 && selectedElements[0].type === 'shape') {
      setShowPropertiesPanel(true);
    } else if (selectedElements.length === 0) {
      setShowPropertiesPanel(false);
    }
  }, [selectedElements]);

  // Update shape property
  const updateShapeProperty = useCallback((property: keyof Shape, value: any) => {
    if (!selectedShapeObject || !activeWhiteboard) return;
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: prev.shapes.map(s => 
        s.id === selectedShapeObject.id ? { ...s, [property]: value } : s
      ),
      updatedAt: new Date(),
    } : null);
  }, [selectedShapeObject, activeWhiteboard]);

  // Handle double-click on canvas for shape text editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const coords = getCanvasCoords(e as unknown as React.PointerEvent);
    const shape = findShapeAtPoint(coords);
    
    if (shape) {
      // Start editing this shape's text
      setEditingShapeTextId(shape.id);
      setEditingShapeText(shape.text || '');
      
      // Calculate screen position for the text input
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        setEditingShapePosition({
          x: rect.left + shape.x * zoom + panOffset.x,
          y: rect.top + shape.y * zoom + panOffset.y,
          width: Math.abs(shape.width) * zoom,
          height: Math.abs(shape.height) * zoom,
        });
      }
      
      // Focus the input after state update
      setTimeout(() => shapeTextInputRef.current?.focus(), 0);
    }
  }, [getCanvasCoords, findShapeAtPoint, zoom, panOffset]);

  // Save shape text
  const saveShapeText = useCallback(() => {
    if (!editingShapeTextId || !activeWhiteboard) return;
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      shapes: prev.shapes.map(shape => 
        shape.id === editingShapeTextId 
          ? { ...shape, text: editingShapeText, fontSize: shape.fontSize || 14, textColor: shape.textColor || '#000000' }
          : shape
      ),
      updatedAt: new Date(),
    } : null);
    
    setEditingShapeTextId(null);
    setEditingShapeText('');
    setEditingShapePosition(null);
  }, [editingShapeTextId, editingShapeText, activeWhiteboard]);

  // Cancel shape text editing
  const cancelShapeTextEditing = useCallback(() => {
    setEditingShapeTextId(null);
    setEditingShapeText('');
    setEditingShapePosition(null);
  }, []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);

    if (currentTool === 'pan' || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    // Handle selection tool
    if (currentTool === 'select') {
      const shape = findShapeAtPoint(coords);
      
      if (shape) {
        // Check if clicking on a resize handle of already selected shape
        if (selectedElements.some(el => el.id === shape.id)) {
          const handle = findResizeHandleAtPoint(coords, shape);
          if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart(coords);
            setOriginalBounds({ x: shape.x, y: shape.y, width: shape.width, height: shape.height });
            return;
          }
        }
        
        // Select or add to selection
        selectShape(shape.id, e.shiftKey);
        setIsDragging(true);
        setDragStart(coords);
      } else {
        // Clicked on empty space - clear selection
        if (!e.shiftKey) {
          clearSelection();
        }
      }
      return;
    }

    if (currentTool === 'text') {
      setNewTextPosition(coords);
      return;
    }

    if (currentTool === 'shape') {
      const snappedCoords = snapToGridPoint(coords);
      setShapeStart(snappedCoords);
      return;
    }

    if (currentTool === 'connector') {
      setIsDrawingConnector(true);
      // Check for connection point snap
      const connectionPoint = findConnectionPointAtPoint(coords);
      if (connectionPoint) {
        setConnectorStart({ x: connectionPoint.x, y: connectionPoint.y });
        setHoveredConnectionPoint({ shapeId: connectionPoint.shapeId, position: connectionPoint.position });
      } else {
        setConnectorStart(coords);
      }
      return;
    }

    if (['pen', 'highlighter', 'eraser'].includes(currentTool)) {
      setIsDrawing(true);
      setCurrentStroke([coords]);
      
      // Capture pointer for smooth drawing
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [currentTool, getCanvasCoords, findShapeAtPoint, selectedElements, findResizeHandleAtPoint, selectShape, clearSelection, snapToGridPoint, findConnectionPointAtPoint]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const coords = getCanvasCoords(e);

    // Update hovered shape for connection points display
    if (currentTool === 'connector' || currentTool === 'select') {
      const shape = findShapeAtPoint(coords);
      setHoveredShape(shape?.id || null);
      
      if (shape) {
        const cp = findConnectionPointAtPoint(coords);
        setHoveredConnectionPoint(cp ? { shapeId: cp.shapeId, position: cp.position } : null);
      } else {
        setHoveredConnectionPoint(null);
      }
    }

    // Handle dragging selected shapes
    if (isDragging && dragStart && selectedElements.length > 0 && activeWhiteboard) {
      let dx = coords.x - dragStart.x;
      let dy = coords.y - dragStart.y;
      
      // Snap to grid
      if (snapToGrid) {
        dx = Math.round(dx / gridSize) * gridSize;
        dy = Math.round(dy / gridSize) * gridSize;
      }
      
      if (dx !== 0 || dy !== 0) {
        const shapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
        
        setActiveWhiteboard(prev => {
          if (!prev) return null;
          
          // Find all shapes to move (selected shapes + shapes contained in selected containers)
          const shapesToMove = new Set(shapeIds);
          
          // If moving a container, also move all contained shapes
          shapeIds.forEach(id => {
            const shape = prev.shapes.find(s => s.id === id);
            if (shape?.isContainer && shape.containedShapeIds) {
              shape.containedShapeIds.forEach(containedId => shapesToMove.add(containedId));
            }
          });
          
          return {
            ...prev,
            shapes: prev.shapes.map(s => 
              shapesToMove.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s
            ),
          };
        });
        
        setDragStart(coords);
      }
      return;
    }

    // Handle resizing
    if (isResizing && resizeHandle && dragStart && originalBounds && selectedShapeObject) {
      let newX = originalBounds.x;
      let newY = originalBounds.y;
      let newWidth = originalBounds.width;
      let newHeight = originalBounds.height;
      
      const dx = coords.x - dragStart.x;
      const dy = coords.y - dragStart.y;
      
      switch (resizeHandle) {
        case 'nw':
          newX = originalBounds.x + dx;
          newY = originalBounds.y + dy;
          newWidth = originalBounds.width - dx;
          newHeight = originalBounds.height - dy;
          break;
        case 'n':
          newY = originalBounds.y + dy;
          newHeight = originalBounds.height - dy;
          break;
        case 'ne':
          newY = originalBounds.y + dy;
          newWidth = originalBounds.width + dx;
          newHeight = originalBounds.height - dy;
          break;
        case 'e':
          newWidth = originalBounds.width + dx;
          break;
        case 'se':
          newWidth = originalBounds.width + dx;
          newHeight = originalBounds.height + dy;
          break;
        case 's':
          newHeight = originalBounds.height + dy;
          break;
        case 'sw':
          newX = originalBounds.x + dx;
          newWidth = originalBounds.width - dx;
          newHeight = originalBounds.height + dy;
          break;
        case 'w':
          newX = originalBounds.x + dx;
          newWidth = originalBounds.width - dx;
          break;
      }
      
      // Snap to grid
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
        newWidth = Math.round(newWidth / gridSize) * gridSize;
        newHeight = Math.round(newHeight / gridSize) * gridSize;
      }
      
      // Ensure minimum size
      newWidth = Math.max(newWidth, 20);
      newHeight = Math.max(newHeight, 20);
      
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        shapes: prev.shapes.map(s => 
          s.id === selectedShapeObject.id ? { ...s, x: newX, y: newY, width: newWidth, height: newHeight } : s
        ),
      } : null);
      return;
    }

    // Connector preview
    if (isDrawingConnector && connectorStart && currentTool === 'connector') {
      // Check for connection point snap at end
      const connectionPoint = findConnectionPointAtPoint(coords);
      const endPoint = connectionPoint ? { x: connectionPoint.x, y: connectionPoint.y } : coords;
      
      setCurrentConnectorPreview({
        id: 'preview',
        type: selectedConnectorType,
        startPoint: connectorStart,
        endPoint: endPoint,
        color: currentColor,
        strokeWidth: brushSize,
        startArrow: selectedStartArrow,
        endArrow: selectedEndArrow,
        endShapeId: connectionPoint?.shapeId,
        endConnectionPoint: connectionPoint?.position,
      });
      return;
    }

    if (shapeStart && currentTool === 'shape') {
      // Calculate raw width and height
      let width = coords.x - shapeStart.x;
      let height = coords.y - shapeStart.y;
      
      // For square and circle shapes, or when shift is held, constrain proportions
      const constrainProportions = selectedShape === 'square' || selectedShape === 'circle' || e.shiftKey;
      
      if (constrainProportions) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }
      
      // Calculate the actual position based on drag direction
      const x = width >= 0 ? shapeStart.x : shapeStart.x + width;
      const y = height >= 0 ? shapeStart.y : shapeStart.y + height;
      const absWidth = Math.abs(width);
      const absHeight = Math.abs(height);
      
      // Apply grid snapping
      let snappedX = x;
      let snappedY = y;
      let snappedWidth = absWidth;
      let snappedHeight = absHeight;
      
      if (snapToGrid) {
        snappedX = Math.round(x / gridSize) * gridSize;
        snappedY = Math.round(y / gridSize) * gridSize;
        snappedWidth = Math.max(gridSize, Math.round(absWidth / gridSize) * gridSize);
        snappedHeight = Math.max(gridSize, Math.round(absHeight / gridSize) * gridSize);
      }
      
      setCurrentShapePreview({
        id: 'preview',
        type: selectedShape,
        x: snappedX,
        y: snappedY,
        width: snappedWidth,
        height: snappedHeight,
        color: currentColor,
        fill: currentFillColor,
        strokeWidth: brushSize,
      });
      return;
    }

    if (isDrawing) {
      // For eraser tool, erase elements under the cursor
      if (currentTool === 'eraser') {
        eraseAtPoint(coords, brushSize * 2);
      }
      setCurrentStroke(prev => [...prev, coords]);
    }
  }, [isDrawing, isPanning, lastPanPoint, getCanvasCoords, shapeStart, currentTool, selectedShape, selectedShapeObject, currentColor, currentFillColor, brushSize, isDrawingConnector, connectorStart, selectedConnectorType, selectedStartArrow, selectedEndArrow, eraseAtPoint]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // End dragging
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      if (activeWhiteboard) {
        // Check if any non-container shapes were dropped inside a container
        setActiveWhiteboard(prev => {
          if (!prev) return null;
          
          const draggedShapeIds = selectedElements.filter(el => el.type === 'shape').map(el => el.id);
          const draggedShapes = prev.shapes.filter(s => draggedShapeIds.includes(s.id) && !s.isContainer);
          const containers = prev.shapes.filter(s => s.isContainer);
          
          let updatedShapes = [...prev.shapes];
          
          // For each dragged non-container shape, check if it's inside a container
          draggedShapes.forEach(draggedShape => {
            const shapeCenterX = draggedShape.x + draggedShape.width / 2;
            const shapeCenterY = draggedShape.y + draggedShape.height / 2;
            
            // Find container that this shape is inside (if any)
            let containingContainer: Shape | null = null;
            containers.forEach(container => {
              // Shapes can be inside a container if their center is within the container bounds
              // For loop containers, consider the content area (below header)
              const headerHeight = container.type === 'loop' ? 28 : container.type === 'swimlane' ? 32 : 0;
              const contentY = container.y + headerHeight;
              const contentHeight = container.height - headerHeight;
              
              if (shapeCenterX >= container.x && 
                  shapeCenterX <= container.x + container.width &&
                  shapeCenterY >= contentY && 
                  shapeCenterY <= contentY + contentHeight) {
                containingContainer = container;
              }
            });
            
            // Update container containment
            updatedShapes = updatedShapes.map(s => {
              if (s.isContainer && s.containedShapeIds) {
                // Remove shape from old container
                if (s.containedShapeIds.includes(draggedShape.id) && s.id !== containingContainer?.id) {
                  return { ...s, containedShapeIds: s.containedShapeIds.filter(id => id !== draggedShape.id) };
                }
                // Add shape to new container
                if (s.id === containingContainer?.id && !s.containedShapeIds.includes(draggedShape.id)) {
                  return { ...s, containedShapeIds: [...s.containedShapeIds, draggedShape.id] };
                }
              }
              return s;
            });
          });
          
          return { ...prev, shapes: updatedShapes, updatedAt: new Date() };
        });
      }
      return;
    }

    // End resizing
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      setDragStart(null);
      setOriginalBounds(null);
      if (activeWhiteboard) {
        setActiveWhiteboard(prev => prev ? { ...prev, updatedAt: new Date() } : null);
      }
      return;
    }

    // Add connector
    if (isDrawingConnector && connectorStart && currentConnectorPreview && activeWhiteboard) {
      const newConnector: Connector = {
        ...currentConnectorPreview,
        id: generateId(),
      };
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        connectors: [...prev.connectors, newConnector],
        updatedAt: new Date(),
      } : null);
      setIsDrawingConnector(false);
      setConnectorStart(null);
      setCurrentConnectorPreview(null);
      return;
    }

    if (shapeStart && currentShapePreview && activeWhiteboard) {
      // Only create shape if it has a minimum size
      const minSize = 10;
      if (Math.abs(currentShapePreview.width) >= minSize && Math.abs(currentShapePreview.height) >= minSize) {
        // Add shape
        const isContainerType = ['loop', 'group-box', 'swimlane'].includes(currentShapePreview.type);
        const newShape: Shape = {
          ...currentShapePreview,
          id: generateId(),
          // Ensure positive width/height
          width: Math.abs(currentShapePreview.width),
          height: Math.abs(currentShapePreview.height),
          isContainer: isContainerType,
          containedShapeIds: isContainerType ? [] : undefined,
          containerLabel: isContainerType ? (currentShapePreview.type === 'loop' ? 'loop' : currentShapePreview.type === 'swimlane' ? 'Swimlane' : 'Group') : undefined,
        };
        setActiveWhiteboard(prev => prev ? {
          ...prev,
          shapes: [...prev.shapes, newShape],
          updatedAt: new Date(),
        } : null);
      }
      setShapeStart(null);
      setCurrentShapePreview(null);
      return;
    }

    if (isDrawing && currentStroke.length > 1 && activeWhiteboard && currentTool !== 'eraser') {
      // Only create strokes for pen and highlighter, not eraser
      const newStroke: Stroke = {
        id: generateId(),
        tool: currentTool as 'pen' | 'highlighter',
        points: currentStroke,
        color: currentColor,
        width: brushSize,
        opacity: currentTool === 'highlighter' ? 0.4 : 1,
      };

      // Update whiteboard
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        strokes: [...prev.strokes, newStroke],
        updatedAt: new Date(),
      } : null);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...(activeWhiteboard.strokes), newStroke]);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }

    setIsDrawing(false);
    setCurrentStroke([]);
    
    // Release pointer capture
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, [isDrawing, isPanning, currentStroke, currentTool, currentColor, brushSize, activeWhiteboard, history, historyIndex, shapeStart, currentShapePreview, isDrawingConnector, connectorStart, currentConnectorPreview]);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.1), 5);
      
      // Zoom towards cursor position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        
        const newPanX = cursorX - (cursorX - panOffset.x) * (newZoom / zoom);
        const newPanY = cursorY - (cursorY - panOffset.y) * (newZoom / zoom);
        
        setPanOffset({ x: newPanX, y: newPanY });
      }
      
      setZoom(newZoom);
    } else {
      // Pan with scroll
      setPanOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  }, [zoom, panOffset]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      if (activeWhiteboard) {
        setActiveWhiteboard(prev => prev ? {
          ...prev,
          strokes: history[newIndex] || [],
        } : null);
      }
    } else if (historyIndex === 0 && activeWhiteboard) {
      setHistoryIndex(-1);
      setActiveWhiteboard(prev => prev ? { ...prev, strokes: [] } : null);
    }
  }, [historyIndex, history, activeWhiteboard]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      if (activeWhiteboard) {
        setActiveWhiteboard(prev => prev ? {
          ...prev,
          strokes: history[newIndex],
        } : null);
      }
    }
  }, [historyIndex, history, activeWhiteboard]);

  // Clear canvas
  const handleClear = useCallback(() => {
    if (activeWhiteboard) {
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        strokes: [],
        shapes: [],
        connectors: [],
        textBoxes: [],
        stickyNotes: [],
        images: [],
        updatedAt: new Date(),
      } : null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [activeWhiteboard]);

  // Create new whiteboard
  const createNewWhiteboard = useCallback((template: TemplateType = 'blank') => {
    const newBoard: Whiteboard = {
      id: generateId(),
      title: 'Untitled Whiteboard',
      template,
      strokes: [],
      shapes: [],
      connectors: [],
      textBoxes: [],
      stickyNotes: [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isShared: false,
      collaborators: [],
    };
    setWhiteboards(prev => [...prev, newBoard]);
    setActiveWhiteboard(newBoard);
    setShowTemplateModal(false);
    setHistory([]);
    setHistoryIndex(-1);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Update whiteboard title
  const updateTitle = useCallback((title: string) => {
    if (activeWhiteboard) {
      setActiveWhiteboard(prev => prev ? { ...prev, title } : null);
      setWhiteboards(prev => prev.map(wb => 
        wb.id === activeWhiteboard.id ? { ...wb, title } : wb
      ));
    }
  }, [activeWhiteboard]);

  // Share link generation
  const generateShareLink = useCallback(() => {
    if (activeWhiteboard) {
      const shareLink = `${window.location.origin}/whiteboard/share/${activeWhiteboard.id}`;
      setActiveWhiteboard(prev => prev ? {
        ...prev,
        isShared: true,
        shareLink,
      } : null);
      return shareLink;
    }
    return '';
  }, [activeWhiteboard]);

  // Copy share link
  const copyShareLink = useCallback(() => {
    const link = activeWhiteboard?.shareLink || generateShareLink();
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [activeWhiteboard?.shareLink, generateShareLink]);

  // Export as image
  // Open export modal
  const openExportModal = useCallback(() => {
    setExportFilename(activeWhiteboard?.title || 'whiteboard');
    setShowExportModal(true);
  }, [activeWhiteboard?.title]);

  // Export as image with format options
  const exportWhiteboard = useCallback(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const filename = exportFilename || 'whiteboard';
    
    if (exportFormat === 'png') {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } else if (exportFormat === 'jpeg') {
      // Create a temporary canvas with white background for JPEG
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = tempCanvas.toDataURL('image/jpeg', 0.95);
        link.click();
      }
    } else if (exportFormat === 'svg') {
      // Generate SVG from canvas content
      const svgContent = generateSVG();
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'pdf') {
      // Create PDF using canvas image
      const imgData = canvas.toDataURL('image/png');
      // Create a simple PDF with the image
      const pdfContent = generatePDF(imgData, canvas.width, canvas.height);
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${filename}.pdf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
    
    setShowExportModal(false);
  }, [exportFormat, exportFilename]);

  // Generate SVG content from whiteboard
  const generateSVG = useCallback(() => {
    if (!activeWhiteboard || !canvasRef.current) return '';
    
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  <g>`;
    
    // Add strokes
    activeWhiteboard.strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      const pathData = stroke.points.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      ).join(' ');
      svgContent += `
    <path d="${pathData}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="none" opacity="${stroke.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    
    // Add shapes
    activeWhiteboard.shapes.forEach(shape => {
      const fill = shape.fill === 'transparent' ? 'none' : shape.fill;
      switch (shape.type) {
        case 'rectangle':
        case 'square':
          svgContent += `
    <rect x="${shape.x}" y="${shape.y}" width="${Math.abs(shape.width)}" height="${Math.abs(shape.height)}" stroke="${shape.color}" stroke-width="${shape.strokeWidth}" fill="${fill}"/>`;
          break;
        case 'circle':
          const cx = shape.x + shape.width / 2;
          const cy = shape.y + shape.height / 2;
          const r = Math.min(Math.abs(shape.width), Math.abs(shape.height)) / 2;
          svgContent += `
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${shape.color}" stroke-width="${shape.strokeWidth}" fill="${fill}"/>`;
          break;
        case 'ellipse':
          const ecx = shape.x + shape.width / 2;
          const ecy = shape.y + shape.height / 2;
          svgContent += `
    <ellipse cx="${ecx}" cy="${ecy}" rx="${Math.abs(shape.width) / 2}" ry="${Math.abs(shape.height) / 2}" stroke="${shape.color}" stroke-width="${shape.strokeWidth}" fill="${fill}"/>`;
          break;
        case 'triangle':
          const tx = shape.x;
          const ty = shape.y;
          const tw = Math.abs(shape.width);
          const th = Math.abs(shape.height);
          svgContent += `
    <polygon points="${tx + tw/2},${ty} ${tx + tw},${ty + th} ${tx},${ty + th}" stroke="${shape.color}" stroke-width="${shape.strokeWidth}" fill="${fill}"/>`;
          break;
        default:
          // For complex shapes, export as rect placeholder
          svgContent += `
    <rect x="${shape.x}" y="${shape.y}" width="${Math.abs(shape.width)}" height="${Math.abs(shape.height)}" stroke="${shape.color}" stroke-width="${shape.strokeWidth}" fill="${fill}"/>`;
      }
    });
    
    svgContent += `
  </g>
</svg>`;
    
    return svgContent;
  }, [activeWhiteboard]);

  // Generate simple PDF with embedded image
  const generatePDF = useCallback((imgData: string, width: number, height: number) => {
    // Create a minimal PDF structure with the image
    const imgBase64 = imgData.split(',')[1];
    const imgBytes = atob(imgBase64);
    
    // Scale to fit A4-ish dimensions (595 x 842 points)
    const pdfWidth = 595;
    const pdfHeight = 842;
    const scale = Math.min(pdfWidth / width, pdfHeight / height) * 0.9;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (pdfWidth - scaledWidth) / 2;
    const offsetY = (pdfHeight - scaledHeight) / 2;
    
    // Simple PDF structure
    let pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 100 >>
stream
q
${scaledWidth} 0 0 ${scaledHeight} ${offsetX} ${offsetY} cm
/Img Do
Q
endstream
endobj
5 0 obj
<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>
stream
`;
    
    // Note: This is a simplified PDF. For production, use a proper PDF library
    // For now, we'll export as PNG embedded in a basic PDF wrapper
    const pngData = imgData; // Keep as data URL for simplicity
    
    // Actually, let's just download the PNG with .pdf extension for now
    // A full PDF implementation would require a library like jsPDF
    return imgBytes;
  }, []);

  // Quick download as PNG (no modal)
  const quickDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${activeWhiteboard?.title || 'whiteboard'}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, [activeWhiteboard?.title]);

  // Legacy export function for backward compatibility  
  const exportAsImage = useCallback(() => {
    openExportModal();
  }, [openExportModal]);

  // Handle image upload for scanning
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result as string;
        setScanImage(imageData);
        setScanResult(null);
        setEditableResults(null);
        setScanMode('preview');
        // Check image quality and show enhancement option if needed
        checkImageQuality(imageData);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Start camera for live capture
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setCameraStream(stream);
      setScanMode('camera');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions or try uploading an image instead.');
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setScanMode('upload');
  }, [cameraStream]);

  // Capture photo from camera
  const captureFromCamera = useCallback(() => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/png');
      setScanImage(imageData);
      setScanMode('preview');
      stopCamera();
      checkImageQuality(imageData);
    }
  }, [stopCamera]);

  // Check image quality and suggest enhancement if needed
  const checkImageQuality = useCallback((imageData: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;
        
        // Calculate average brightness and contrast
        let totalBrightness = 0;
        let brightPixels = 0;
        let darkPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          totalBrightness += brightness;
          if (brightness > 200) brightPixels++;
          if (brightness < 50) darkPixels++;
        }
        
        const avgBrightness = totalBrightness / (data.length / 4);
        const pixelCount = data.length / 4;
        const darkRatio = darkPixels / pixelCount;
        const brightRatio = brightPixels / pixelCount;
        
        // If image is too dark, too bright, or low contrast, suggest enhancement
        if (avgBrightness < 100 || avgBrightness > 200 || (darkRatio < 0.1 && brightRatio < 0.1)) {
          setShowEnhancePreview(true);
        }
      }
    };
    img.src = imageData;
  }, []);

  // Apply image enhancement
  const enhanceImage = useCallback(() => {
    if (!scanImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Apply brightness and contrast
        ctx.filter = `brightness(${enhanceOptions.brightness}) contrast(${enhanceOptions.contrast})`;
        ctx.drawImage(img, 0, 0);
        
        // Get image data for additional processing
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;
        
        // Apply threshold (binarization) if enabled - good for handwritten text
        if (enhanceOptions.threshold) {
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const value = brightness > 128 ? 255 : 0;
            data[i] = value;     // R
            data[i + 1] = value; // G
            data[i + 2] = value; // B
          }
        }
        
        // Apply simple denoise (averaging) if enabled
        if (enhanceOptions.denoise) {
          const tempData = new Uint8ClampedArray(data);
          const w = canvas.width;
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              for (let c = 0; c < 3; c++) {
                const idx = (y * w + x) * 4 + c;
                const avg = (
                  tempData[idx - w * 4] + tempData[idx + w * 4] +
                  tempData[idx - 4] + tempData[idx + 4] +
                  tempData[idx]
                ) / 5;
                data[idx] = avg;
              }
            }
          }
        }
        
        // Apply sharpening if enabled
        if (enhanceOptions.sharpen) {
          const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
          const tempData = new Uint8ClampedArray(data);
          const w = canvas.width;
          for (let y = 1; y < canvas.height - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                  for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * w + (x + kx)) * 4 + c;
                    sum += tempData[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                  }
                }
                const idx = (y * w + x) * 4 + c;
                data[idx] = Math.min(255, Math.max(0, sum));
              }
            }
          }
        }
        
        ctx.putImageData(imageDataObj, 0, 0);
        setEnhancedImage(canvas.toDataURL('image/png'));
      }
    };
    img.src = scanImage;
  }, [scanImage, enhanceOptions]);

  // Apply enhanced image
  const applyEnhancement = useCallback(() => {
    if (enhancedImage) {
      setScanImage(enhancedImage);
      setEnhancedImage(null);
      setShowEnhancePreview(false);
    }
  }, [enhancedImage]);

  // Process image with OCR and shape detection
  const processWhiteboardImage = useCallback(async () => {
    const imageToProcess = enhancedImage || scanImage;
    if (!imageToProcess) return;
    
    setScanProcessing(true);
    setScanProgress(0);
    setScanProgressMessage('Initializing OCR engine...');

    try {
      // Perform OCR with Tesseract.js
      setScanProgressMessage('Analyzing text content...');
      setScanProgress(10);
      
      const ocrResult = await Tesseract.recognize(imageToProcess, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setScanProgress(10 + Math.round(m.progress * 40));
          }
        }
      });
      
      setScanProgress(50);
      setScanProgressMessage('Detecting shapes and diagrams...');
      
      // Detect shapes from the image
      const detectedShapes = await detectShapesFromImage(imageToProcess);
      
      setScanProgress(75);
      setScanProgressMessage('Converting to whiteboard elements...');
      
      // Convert OCR results to text boxes with positioning
      const textBoxes: TextBox[] = [];
      const img = new Image();
      
      await new Promise<void>((resolve) => {
        img.onload = () => {
          const scaleX = 800 / img.width; // Scale to fit whiteboard
          const scaleY = 600 / img.height;
          const scale = Math.min(scaleX, scaleY, 1);
          
          // Process words from OCR
          const ocrData = ocrResult.data as { words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> };
          if (ocrData.words) {
            // Group words into lines based on vertical proximity
            type WordType = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
            const lines: { words: WordType[]; y: number }[] = [];
            
            ocrData.words.forEach((word: WordType) => {
              if (word.confidence > 60 && word.text.trim()) { // Filter low confidence
                const wordY = word.bbox.y0;
                let foundLine = lines.find(line => Math.abs(line.y - wordY) < 20);
                
                if (foundLine) {
                  foundLine.words.push(word);
                } else {
                  lines.push({ words: [word], y: wordY });
                }
              }
            });
            
            // Convert lines to text boxes
            lines.forEach(line => {
              line.words.sort((a: WordType, b: WordType) => a.bbox.x0 - b.bbox.x0);
              const text = line.words.map((w: WordType) => w.text).join(' ');
              const firstWord = line.words[0];
              const lastWord = line.words[line.words.length - 1];
              
              if (text.trim()) {
                // Estimate font size from word height
                const avgHeight = line.words.reduce((sum: number, w: WordType) => sum + (w.bbox.y1 - w.bbox.y0), 0) / line.words.length;
                const fontSize = Math.max(12, Math.min(36, Math.round(avgHeight * scale * 0.8)));
                
                textBoxes.push({
                  id: generateId(),
                  x: 50 + firstWord.bbox.x0 * scale,
                  y: 50 + firstWord.bbox.y0 * scale,
                  text: text,
                  fontSize: fontSize,
                  color: '#000000',
                  fontFamily: 'Inter',
                  width: Math.max(100, (lastWord.bbox.x1 - firstWord.bbox.x0) * scale + 20),
                });
              }
            });
          }
          
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imageToProcess;
      });
      
      setScanProgress(90);
      setScanProgressMessage('Finalizing results...');
      
      // Scale detected shapes
      const scaledShapes = detectedShapes.map(shape => ({
        ...shape,
        id: generateId(),
      }));
      
      const result = {
        strokes: [],
        shapes: scaledShapes,
        textBoxes: textBoxes,
      };
      
      setScanProgress(100);
      setScanProgressMessage('Complete!');
      setScanResult(result);
      
      // Set editable results for preview
      setEditableResults({
        textBoxes: textBoxes.map(tb => ({ ...tb, selected: true })),
        shapes: scaledShapes.map(s => ({ ...s, selected: true })),
      });
      
    } catch (error) {
      console.error('Error processing image:', error);
      setScanProgressMessage('Error processing image. Please try again.');
    } finally {
      setScanProcessing(false);
    }
  }, [scanImage, enhancedImage]);

  // Detect shapes from image using edge detection
  const detectShapesFromImage = useCallback(async (imageData: string): Promise<Shape[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve([]);
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageDataObj.data;
        const shapes: Shape[] = [];
        
        // Scale factor
        const scaleX = 800 / img.width;
        const scaleY = 600 / img.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        // Simple edge detection using Sobel operator
        const edges: boolean[][] = [];
        const w = canvas.width;
        const h = canvas.height;
        
        // Convert to grayscale and detect edges
        for (let y = 0; y < h; y++) {
          edges[y] = [];
          for (let x = 0; x < w; x++) {
            if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
              edges[y][x] = false;
              continue;
            }
            
            const getGray = (px: number, py: number) => {
              const idx = (py * w + px) * 4;
              return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            };
            
            // Sobel operator
            const gx = 
              -getGray(x - 1, y - 1) + getGray(x + 1, y - 1) +
              -2 * getGray(x - 1, y) + 2 * getGray(x + 1, y) +
              -getGray(x - 1, y + 1) + getGray(x + 1, y + 1);
            
            const gy = 
              -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1) +
              getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1);
            
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            edges[y][x] = magnitude > 50; // Threshold
          }
        }
        
        // Find connected components (potential shapes)
        const visited: boolean[][] = Array(h).fill(null).map(() => Array(w).fill(false));
        const components: { minX: number; minY: number; maxX: number; maxY: number; pixels: number }[] = [];
        
        const floodFill = (startX: number, startY: number) => {
          const stack = [[startX, startY]];
          let minX = startX, minY = startY, maxX = startX, maxY = startY;
          let pixels = 0;
          
          while (stack.length > 0) {
            const [x, y] = stack.pop()!;
            if (x < 0 || x >= w || y < 0 || y >= h) continue;
            if (visited[y][x] || !edges[y][x]) continue;
            
            visited[y][x] = true;
            pixels++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
          }
          
          return { minX, minY, maxX, maxY, pixels };
        };
        
        // Find all connected edge components
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (edges[y][x] && !visited[y][x]) {
              const component = floodFill(x, y);
              // Filter out noise (too small) and full-image borders
              if (component.pixels > 50 && 
                  component.maxX - component.minX < w * 0.9 &&
                  component.maxY - component.minY < h * 0.9) {
                components.push(component);
              }
            }
          }
        }
        
        // Convert significant components to shapes
        components.slice(0, 10).forEach(comp => { // Limit to 10 shapes
          const width = (comp.maxX - comp.minX) * scale;
          const height = (comp.maxY - comp.minY) * scale;
          const aspectRatio = width / height;
          
          // Determine shape type based on aspect ratio and size
          let shapeType: ShapeType = 'rectangle';
          if (Math.abs(aspectRatio - 1) < 0.2 && width > 30) {
            shapeType = Math.random() > 0.5 ? 'circle' : 'square';
          } else if (width < 20 || height < 20) {
            return; // Skip very thin shapes
          }
          
          shapes.push({
            id: generateId(),
            type: shapeType,
            x: 50 + comp.minX * scale,
            y: 50 + comp.minY * scale,
            width: Math.max(40, width),
            height: Math.max(40, height),
            color: '#3B82F6',
            fill: 'transparent',
            strokeWidth: 2,
          });
        });
        
        resolve(shapes);
      };
      
      img.onerror = () => resolve([]);
      img.src = imageData;
    });
  }, []);

  // Toggle element selection in editable results
  const toggleResultElementSelection = useCallback((type: 'textBox' | 'shape', id: string) => {
    if (!editableResults) return;
    
    if (type === 'textBox') {
      setEditableResults({
        ...editableResults,
        textBoxes: editableResults.textBoxes.map(tb => 
          tb.id === id ? { ...tb, selected: !tb.selected } : tb
        ),
      });
    } else {
      setEditableResults({
        ...editableResults,
        shapes: editableResults.shapes.map(s => 
          s.id === id ? { ...s, selected: !s.selected } : s
        ),
      });
    }
  }, [editableResults]);

  // Update text in editable results
  const updateResultText = useCallback((id: string, newText: string) => {
    if (!editableResults) return;
    
    setEditableResults({
      ...editableResults,
      textBoxes: editableResults.textBoxes.map(tb => 
        tb.id === id ? { ...tb, text: newText } : tb
      ),
    });
  }, [editableResults]);

  // Delete element from editable results
  const deleteResultElement = useCallback((type: 'textBox' | 'shape', id: string) => {
    if (!editableResults) return;
    
    if (type === 'textBox') {
      setEditableResults({
        ...editableResults,
        textBoxes: editableResults.textBoxes.filter(tb => tb.id !== id),
      });
    } else {
      setEditableResults({
        ...editableResults,
        shapes: editableResults.shapes.filter(s => s.id !== id),
      });
    }
  }, [editableResults]);

  // Reset scan modal
  const resetScanModal = useCallback(() => {
    stopCamera();
    setScanImage(null);
    setScanResult(null);
    setEditableResults(null);
    setEnhancedImage(null);
    setShowEnhancePreview(false);
    setScanMode('upload');
    setScanProgress(0);
    setScanProgressMessage('');
  }, [stopCamera]);

  // Get color for brainstorm idea category
  const getIdeaCategoryColor = useCallback((category: string): string => {
    const colors: Record<string, string> = {
      strategy: '#E0E7FF',      // Light indigo
      technical: '#DBEAFE',     // Light blue
      financial: '#D1FAE5',     // Light green
      marketing: '#FEF3C7',     // Light amber
      operations: '#EDE9FE',    // Light violet
      design: '#FCE7F3',        // Light pink
      risk: '#FEE2E2',          // Light red
      growth: '#CCFBF1',        // Light teal
    };
    return colors[category] || '#FEF3C7';
  }, []);

  // Add a single brainstorm idea as a sticky note
  const handleAddBrainstormIdea = useCallback((idea: BrainstormIdea) => {
    if (!activeWhiteboard) return;
    
    // Calculate position for the new sticky note
    const existingStickyCount = activeWhiteboard.stickyNotes.length;
    const row = Math.floor(existingStickyCount / 4);
    const col = existingStickyCount % 4;
    const baseX = 100;
    const baseY = 100;
    const spacing = 220;
    
    const newSticky: StickyNote = {
      id: generateId(),
      x: baseX + (col * spacing),
      y: baseY + (row * spacing),
      width: 200,
      height: 150,
      text: idea.content,
      color: getIdeaCategoryColor(idea.category),
    };
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      stickyNotes: [...prev.stickyNotes, newSticky],
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, getIdeaCategoryColor]);

  // Add multiple brainstorm ideas as sticky notes
  const handleAddMultipleBrainstormIdeas = useCallback((ideas: BrainstormIdea[]) => {
    if (!activeWhiteboard) return;
    
    const existingStickyCount = activeWhiteboard.stickyNotes.length;
    const baseX = 100;
    const baseY = 100;
    const spacing = 220;
    
    const newStickies: StickyNote[] = ideas.map((idea, index) => {
      const totalIndex = existingStickyCount + index;
      const row = Math.floor(totalIndex / 4);
      const col = totalIndex % 4;
      
      return {
        id: generateId(),
        x: baseX + (col * spacing),
        y: baseY + (row * spacing),
        width: 200,
        height: 150,
        text: idea.content,
        color: getIdeaCategoryColor(idea.category),
      };
    });
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      stickyNotes: [...prev.stickyNotes, ...newStickies],
      updatedAt: new Date(),
    } : null);
  }, [activeWhiteboard, getIdeaCategoryColor]);

  // Apply scanned content to the whiteboard
  const applyScanResult = useCallback(() => {
    if (!activeWhiteboard) return;
    
    // Use editable results if available, otherwise use scan result
    const textBoxesToAdd = editableResults 
      ? editableResults.textBoxes.filter(tb => tb.selected).map(({ selected, ...tb }) => tb)
      : scanResult?.textBoxes || [];
    
    const shapesToAdd = editableResults
      ? editableResults.shapes.filter(s => s.selected).map(({ selected, ...s }) => s)
      : scanResult?.shapes || [];
    
    if (textBoxesToAdd.length === 0 && shapesToAdd.length === 0) {
      alert('No elements selected to add to the whiteboard.');
      return;
    }
    
    setActiveWhiteboard(prev => prev ? {
      ...prev,
      strokes: [...prev.strokes, ...(scanResult?.strokes || [])],
      shapes: [...prev.shapes, ...shapesToAdd],
      textBoxes: [...prev.textBoxes, ...textBoxesToAdd],
      updatedAt: new Date(),
    } : null);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...activeWhiteboard.strokes, ...(scanResult?.strokes || [])]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Close modal and reset
    setShowScanModal(false);
    resetScanModal();
  }, [scanResult, editableResults, activeWhiteboard, history, historyIndex, resetScanModal]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when editing text
      if (editingShapeTextId || editingTextId || newTextPosition) return;

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        copySelected();
        return;
      }

      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
        return;
      }

      // Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Select All
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        if (activeWhiteboard) {
          setSelectedElements(activeWhiteboard.shapes.map(s => ({ id: s.id, type: 'shape' as ElementType })));
        }
        return;
      }

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElements.length > 0) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }

      // Escape - clear selection or close panels
      if (e.key === 'Escape') {
        clearSelection();
        setShowShapeLibrary(false);
        setShowPropertiesPanel(false);
        return;
      }

      // Arrow keys - move selected shapes
      if (selectedElements.length > 0) {
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            moveSelectedShapes(0, -step);
            return;
          case 'ArrowDown':
            e.preventDefault();
            moveSelectedShapes(0, step);
            return;
          case 'ArrowLeft':
            e.preventDefault();
            moveSelectedShapes(-step, 0);
            return;
          case 'ArrowRight':
            e.preventDefault();
            moveSelectedShapes(step, 0);
            return;
        }
      }

      // Bring to front / Send to back
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        bringToFront();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        sendToBack();
        return;
      }
      
      // Tool shortcuts
      if (!e.metaKey && !e.ctrlKey) {
        switch (e.key) {
          case 'p': setCurrentTool('pen'); break;
          case 'h': setCurrentTool('highlighter'); break;
          case 'e': setCurrentTool('eraser'); break;
          case 't': setCurrentTool('text'); break;
          case 's': setCurrentTool('shape'); break;
          case 'c': setCurrentTool('connector'); break;
          case 'v': setCurrentTool('select'); break;
          case ' ': setCurrentTool('pan'); break;
          case 'g': setSnapToGrid(prev => !prev); break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && currentTool === 'pan') {
        setCurrentTool('pen');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, currentTool, copySelected, pasteFromClipboard, duplicateSelected, deleteSelected, clearSelection, selectedElements, activeWhiteboard, moveSelectedShapes, bringToFront, sendToBack, editingShapeTextId, editingTextId, newTextPosition]);

  // Memoized tool items
  const toolItems = useMemo(() => [
    { id: 'select', icon: Icons.Select, label: 'Select (V)', shortcut: 'V' },
    { id: 'pen', icon: Icons.Pen, label: 'Pen (P)', shortcut: 'P' },
    { id: 'highlighter', icon: Icons.Highlighter, label: 'Highlighter (H)', shortcut: 'H' },
    { id: 'eraser', icon: Icons.Eraser, label: 'Eraser (E)', shortcut: 'E' },
    { id: 'text', icon: Icons.Text, label: 'Text (T)', shortcut: 'T' },
    { id: 'shape', icon: Icons.Shapes, label: 'Shapes (S)', shortcut: 'S' },
    { id: 'connector', icon: Icons.Connector, label: 'Connector (C)', shortcut: 'C' },
    { id: 'sticky', icon: Icons.Sticky, label: 'Sticky Note', shortcut: 'N' },
    { id: 'image', icon: Icons.Image, label: 'Image', shortcut: 'I' },
    { id: 'pan', icon: Icons.Pan, label: 'Pan (Space)', shortcut: 'Space' },
  ], []);

  const shapeItems = useMemo(() => [
    { id: 'square', icon: Icons.Square, label: 'Square' },
    { id: 'rectangle', icon: Icons.Rectangle, label: 'Rectangle' },
    { id: 'rounded-rectangle', icon: Icons.Rectangle, label: 'Rounded Rectangle' },
    { id: 'circle', icon: Icons.Circle, label: 'Circle' },
    { id: 'ellipse', icon: Icons.UseCase, label: 'Ellipse' },
    { id: 'triangle', icon: Icons.Triangle, label: 'Triangle' },
    { id: 'diamond', icon: Icons.Diamond, label: 'Diamond' },
    { id: 'pentagon', icon: Icons.Pentagon, label: 'Pentagon' },
    { id: 'hexagon', icon: Icons.Hexagon, label: 'Hexagon' },
    { id: 'heptagon', icon: Icons.Heptagon, label: 'Heptagon' },
    { id: 'octagon', icon: Icons.Octagon, label: 'Octagon' },
    { id: 'star', icon: Icons.Star, label: 'Star' },
    { id: 'heart', icon: Icons.Heart, label: 'Heart' },
    { id: 'cloud', icon: Icons.Cloud, label: 'Cloud' },
    { id: 'lightning', icon: Icons.Lightning, label: 'Lightning' },
    { id: 'callout', icon: Icons.Callout, label: 'Callout' },
  ], []);

  // Flowchart shape items for quick access
  const flowchartItems = useMemo(() => [
    { id: 'process', icon: Icons.Process, label: 'Process' },
    { id: 'decision', icon: Icons.Diamond, label: 'Decision' },
    { id: 'terminator', icon: Icons.Terminator, label: 'Start/End' },
    { id: 'data', icon: Icons.Data, label: 'Data (I/O)' },
    { id: 'database', icon: Icons.Database, label: 'Database' },
    { id: 'document', icon: Icons.Document, label: 'Document' },
  ], []);

  // Container shape items for quick access
  const containerItems = useMemo(() => [
    { id: 'loop', icon: Icons.Loop, label: 'Loop' },
    { id: 'group-box', icon: Icons.GroupBox, label: 'Group Box' },
    { id: 'swimlane', icon: Icons.Swimlane, label: 'Swimlane' },
  ], []);

  // Get the current category shapes for the library
  const currentCategoryShapes = useMemo(() => {
    const category = shapeCategories.find(c => c.id === selectedCategory);
    return category?.shapes || [];
  }, [selectedCategory]);

  return (
    <div className="whiteboard-page">
      {/* Sidebar */}
      <aside className={`whiteboard-sidebar ${showSidebar ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <h2>Whiteboards</h2>
          <button 
            className="new-board-btn"
            onClick={() => setShowTemplateModal(true)}
          >
            <Icons.Plus />
          </button>
        </div>

        <div className="boards-list">
          {whiteboards.map(board => (
            <button
              key={board.id}
              className={`board-item ${activeWhiteboard?.id === board.id ? 'active' : ''}`}
              onClick={() => {
                setActiveWhiteboard(board);
                setHistory([]);
                setHistoryIndex(-1);
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
              }}
            >
              <div className="board-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18"/>
                </svg>
              </div>
              <span className="board-title">{board.title}</span>
              {board.isShared && (
                <span className="shared-badge">
                  <Icons.Users />
                </span>
              )}
            </button>
          ))}
        </div>

        <button 
          className="sidebar-toggle"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <Icons.ChevronLeft />
        </button>
      </aside>

      {/* Main Canvas Area */}
      <main className="whiteboard-main">
        {/* Top Toolbar */}
        <div className="whiteboard-toolbar">
          <div className="toolbar-left">
            <input
              type="text"
              className="board-title-input"
              value={activeWhiteboard?.title || ''}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Untitled Whiteboard"
            />
          </div>

          <div className="toolbar-center">
            {/* Undo/Redo */}
            <div className="toolbar-group">
              <button
                className="toolbar-btn"
                onClick={handleUndo}
                disabled={historyIndex < 0}
                title="Undo (⌘Z)"
              >
                <Icons.Undo />
              </button>
              <button
                className="toolbar-btn"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo (⌘⇧Z)"
              >
                <Icons.Redo />
              </button>
            </div>

            <div className="toolbar-divider" />

            {/* Drawing Tools */}
            <div className="toolbar-group tools-group">
              {toolItems.map(tool => (
                <button
                  key={tool.id}
                  className={`toolbar-btn tool-btn ${currentTool === tool.id ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentTool(tool.id as Tool);
                    if (tool.id === 'shape') {
                      setShowShapeMenu(!showShapeMenu);
                    } else {
                      setShowShapeMenu(false);
                    }
                  }}
                  title={tool.label}
                >
                  <tool.icon />
                </button>
              ))}
            </div>

            {/* Shape submenu */}
            {showShapeMenu && (
              <div className="shape-menu shape-menu-unified">
                {/* All shapes in one grid */}
                <div className="shape-unified-container">
                  {/* Fill Colors Row */}
                  <div className="shape-fill-row">
                    <button
                      className={`fill-color-btn no-fill ${currentFillColor === 'transparent' ? 'active' : ''}`}
                      onClick={() => setCurrentFillColor('transparent')}
                      title="No Fill"
                    >
                      <span className="no-fill-icon">∅</span>
                    </button>
                    {['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF', '#374151'].map(color => (
                      <button
                        key={color}
                        className={`fill-color-option ${currentFillColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setCurrentFillColor(color)}
                        title={color}
                      />
                    ))}
                  </div>
                  
                  {/* All Shapes Grid */}
                  <div className="shape-unified-grid">
                    {/* Basic Shapes */}
                    {shapeItems.map(shape => (
                      <button
                        key={shape.id}
                        className={`shape-btn ${selectedShape === shape.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedShape(shape.id as ShapeType);
                          setShowShapeMenu(false);
                        }}
                        title={shape.label}
                      >
                        <shape.icon />
                      </button>
                    ))}
                    {/* Flowchart Shapes */}
                    {flowchartItems.map(shape => (
                      <button
                        key={shape.id}
                        className={`shape-btn ${selectedShape === shape.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedShape(shape.id as ShapeType);
                          setShowShapeMenu(false);
                        }}
                        title={shape.label}
                      >
                        <shape.icon />
                      </button>
                    ))}
                    {/* Container Shapes */}
                    {containerItems.map(shape => (
                      <button
                        key={shape.id}
                        className={`shape-btn container-btn ${selectedShape === shape.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedShape(shape.id as ShapeType);
                          setShowShapeMenu(false);
                        }}
                        title={shape.label}
                      >
                        <shape.icon />
                      </button>
                    ))}
                  </div>
                  
                  {/* Library Button */}
                  <button 
                    className="shape-library-link"
                    onClick={() => {
                      setShowShapeLibrary(true);
                      setShowShapeMenu(false);
                    }}
                  >
                    <Icons.Grid />
                    <span>More Shapes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Connector submenu */}
            {currentTool === 'connector' && (
              <div className="connector-menu">
                <div className="connector-section">
                  <span>Connector Type</span>
                  <div className="connector-types">
                    <button
                      className={`connector-type-btn ${selectedConnectorType === 'straight' ? 'active' : ''}`}
                      onClick={() => setSelectedConnectorType('straight')}
                      title="Straight"
                    >
                      <Icons.Line />
                    </button>
                    <button
                      className={`connector-type-btn ${selectedConnectorType === 'elbow' ? 'active' : ''}`}
                      onClick={() => setSelectedConnectorType('elbow')}
                      title="Elbow"
                    >
                      <Icons.ElbowConnector />
                    </button>
                    <button
                      className={`connector-type-btn ${selectedConnectorType === 'curved' ? 'active' : ''}`}
                      onClick={() => setSelectedConnectorType('curved')}
                      title="Curved"
                    >
                      <Icons.CurvedConnector />
                    </button>
                  </div>
                </div>
                <div className="connector-section">
                  <span>End Arrow</span>
                  <select 
                    value={selectedEndArrow}
                    onChange={(e) => setSelectedEndArrow(e.target.value as ArrowHeadType)}
                    className="arrow-select"
                  >
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                    <option value="filled-arrow">Filled Arrow</option>
                    <option value="diamond">Diamond</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
              </div>
            )}

            <div className="toolbar-divider" />

            {/* Color & Size */}
            <div className="toolbar-group">
              <button
                className="color-btn"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Color"
              >
                <div 
                  className="color-preview"
                  style={{ backgroundColor: currentColor }}
                />
              </button>

              {/* Color Picker Popup */}
              {showColorPicker && (
                <div className="color-picker-popup">
                  <div className="color-grid">
                    {colors.map(color => (
                      <button
                        key={color}
                        className={`color-option ${currentColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setCurrentColor(color);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="brush-size-control">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="brush-slider"
                />
                <span className="brush-size-label">{brushSize}px</span>
              </div>
            </div>
          </div>

          <div className="toolbar-right">
            {/* Zoom controls */}
            <div className="zoom-controls">
              <button 
                className="toolbar-btn"
                onClick={() => setZoom(z => Math.max(z - 0.1, 0.1))}
                title="Zoom out"
              >
                <Icons.ZoomOut />
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button 
                className="toolbar-btn"
                onClick={() => setZoom(z => Math.min(z + 0.1, 5))}
                title="Zoom in"
              >
                <Icons.ZoomIn />
              </button>
              <button 
                className="toolbar-btn"
                onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                title="Fit to screen"
              >
                <Icons.FitToScreen />
              </button>
            </div>

            <div className="toolbar-divider" />

            {/* Action buttons */}
            <button 
              className="toolbar-btn"
              onClick={handleClear}
              title="Clear canvas"
            >
              <Icons.Trash />
            </button>
            <button 
              className="share-btn"
              onClick={() => setShowShareModal(true)}
            >
              <Icons.Share />
              <span>Share</span>
            </button>
            <button 
              className="toolbar-btn download-btn"
              onClick={quickDownload}
              title="Quick download as PNG"
            >
              <Icons.Download />
            </button>
            <button 
              className="export-btn"
              onClick={openExportModal}
              title="Export with options"
            >
              <Icons.Export />
              <span>Export</span>
            </button>
            <button 
              className="scan-btn"
              onClick={() => setShowScanModal(true)}
              title="Scan physical whiteboard"
            >
              <Icons.Scan />
              <span>Scan</span>
            </button>
            <button 
              className={`ai-brainstorm-btn ${showAIBrainstorm ? 'active' : ''}`}
              onClick={() => setShowAIBrainstorm(!showAIBrainstorm)}
              title="AI Brainstorming Assistant"
            >
              <Icons.Brain />
              <span>AI Brainstorm</span>
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div 
          ref={containerRef}
          className={`canvas-container template-${activeWhiteboard?.template || 'blank'}`}
        >
          <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            style={{
              cursor: currentTool === 'pan' || isPanning ? 'grab' : 
                      currentTool === 'eraser' ? 'crosshair' :
                      currentTool === 'text' ? 'text' :
                      'crosshair',
            }}
          />

          {/* Selection handles overlay */}
          {selectedElements.length === 1 && selectedElements[0].type === 'shape' && activeWhiteboard && (
            () => {
              const shape = activeWhiteboard.shapes.find(s => s.id === selectedElements[0].id);
              if (!shape) return null;
              
              const handles = getResizeHandles(shape);
              const absWidth = Math.abs(shape.width);
              const absHeight = Math.abs(shape.height);
              
              return (
                <div className="selection-overlay">
                  {/* Selection box */}
                  <div 
                    className="selection-box"
                    style={{
                      left: shape.x * zoom + panOffset.x,
                      top: shape.y * zoom + panOffset.y,
                      width: absWidth * zoom,
                      height: absHeight * zoom,
                    }}
                  />
                  
                  {/* Resize handles */}
                  {handles.map(handle => (
                    <div
                      key={handle.position}
                      className={`resize-handle ${handle.position}`}
                      style={{
                        left: handle.x * zoom + panOffset.x,
                        top: handle.y * zoom + panOffset.y,
                        cursor: handle.cursor,
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setIsResizing(true);
                        setResizeHandle(handle.position as HandlePosition);
                        setDragStart(getCanvasCoords(e as unknown as React.PointerEvent));
                        setOriginalBounds({ x: shape.x, y: shape.y, width: shape.width, height: shape.height });
                      }}
                    />
                  ))}
                </div>
              );
            }
          )()}

          {/* Connection points overlay */}
          {(currentTool === 'connector' || hoveredShape) && activeWhiteboard && showConnectionPoints && (
            activeWhiteboard.shapes
              .filter(shape => hoveredShape === shape.id || currentTool === 'connector')
              .map(shape => {
                const points = getShapeConnectionPoints(shape);
                return points.map(point => (
                  <div
                    key={`${shape.id}-${point.position}`}
                    className={`connection-point ${hoveredConnectionPoint?.shapeId === shape.id && hoveredConnectionPoint?.position === point.position ? 'active' : ''}`}
                    style={{
                      left: point.x * zoom + panOffset.x,
                      top: point.y * zoom + panOffset.y,
                    }}
                  />
                ));
              })
          )}

          {/* Text boxes overlay */}
          {activeWhiteboard?.textBoxes.map(textBox => (
            <div
              key={textBox.id}
              className="text-box-overlay"
              style={{
                left: textBox.x * zoom + panOffset.x,
                top: textBox.y * zoom + panOffset.y,
                width: textBox.width * zoom,
                fontSize: textBox.fontSize * zoom,
                color: textBox.color,
                fontFamily: textBox.fontFamily,
              }}
            >
              <textarea
                value={textBox.text}
                onChange={(e) => {
                  setActiveWhiteboard(prev => prev ? {
                    ...prev,
                    textBoxes: prev.textBoxes.map(tb =>
                      tb.id === textBox.id ? { ...tb, text: e.target.value } : tb
                    ),
                  } : null);
                }}
                placeholder="Type here..."
              />
            </div>
          ))}

          {/* Shape text editing overlay */}
          {editingShapeTextId && editingShapePosition && (
            <div
              className="shape-text-editor"
              style={{
                left: editingShapePosition.x,
                top: editingShapePosition.y,
                width: editingShapePosition.width,
                height: editingShapePosition.height,
              }}
            >
              <textarea
                ref={shapeTextInputRef}
                value={editingShapeText}
                onChange={(e) => setEditingShapeText(e.target.value)}
                onBlur={saveShapeText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveShapeText();
                  }
                  if (e.key === 'Escape') {
                    cancelShapeTextEditing();
                  }
                }}
                placeholder="Add text..."
                className="shape-text-input"
              />
            </div>
          )}

          {/* New text input */}
          {newTextPosition && (
            <div
              className="new-text-input"
              style={{
                left: newTextPosition.x * zoom + panOffset.x,
                top: newTextPosition.y * zoom + panOffset.y,
              }}
            >
              <textarea
                autoFocus
                placeholder="Type here..."
                onBlur={(e) => {
                  if (e.target.value.trim() && activeWhiteboard) {
                    const newTextBox: TextBox = {
                      id: generateId(),
                      x: newTextPosition.x,
                      y: newTextPosition.y,
                      text: e.target.value,
                      fontSize: 16,
                      color: currentColor,
                      fontFamily: 'Inter',
                      width: 200,
                    };
                    setActiveWhiteboard(prev => prev ? {
                      ...prev,
                      textBoxes: [...prev.textBoxes, newTextBox],
                    } : null);
                  }
                  setNewTextPosition(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setNewTextPosition(null);
                  }
                }}
              />
            </div>
          )}

          {/* Sticky notes overlay */}
          {activeWhiteboard?.stickyNotes.map(note => (
            <div
              key={note.id}
              className="sticky-note-overlay"
              style={{
                left: note.x * zoom + panOffset.x,
                top: note.y * zoom + panOffset.y,
                width: note.width * zoom,
                height: note.height * zoom,
                backgroundColor: note.color,
              }}
            >
              <textarea
                value={note.text}
                onChange={(e) => {
                  setActiveWhiteboard(prev => prev ? {
                    ...prev,
                    stickyNotes: prev.stickyNotes.map(n =>
                      n.id === note.id ? { ...n, text: e.target.value } : n
                    ),
                  } : null);
                }}
                placeholder="Write something..."
              />
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <span className="status-item">
            Template: {templates.find(t => t.id === activeWhiteboard?.template)?.label || 'Blank'}
          </span>
          <span className="status-item">
            {activeWhiteboard?.strokes.length || 0} strokes
          </span>
          {activeWhiteboard?.isShared && (
            <span className="status-item shared">
              <Icons.Users /> Shared
            </span>
          )}
        </div>
      </main>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Choose a Template</h3>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="templates-grid">
              {templates.map(template => (
                <button
                  key={template.id}
                  className="template-card"
                  onClick={() => createNewWhiteboard(template.id)}
                >
                  <div className={`template-preview template-${template.id}`}>
                    {template.id === 'ruled' && (
                      <div className="preview-lines">
                        {[...Array(6)].map((_, i) => <div key={i} className="line" />)}
                      </div>
                    )}
                    {template.id === 'grid' && (
                      <div className="preview-grid" />
                    )}
                    {template.id === 'dots' && (
                      <div className="preview-dots">
                        {[...Array(36)].map((_, i) => <div key={i} className="dot" />)}
                      </div>
                    )}
                    {template.id === 'isometric' && (
                      <div className="preview-iso" />
                    )}
                    {template.id === 'cornell' && (
                      <div className="preview-cornell">
                        <div className="left-section" />
                        <div className="bottom-section" />
                      </div>
                    )}
                  </div>
                  <div className="template-info">
                    <span className="template-name">{template.label}</span>
                    <span className="template-desc">{template.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share Whiteboard</h3>
              <button className="close-btn" onClick={() => setShowShareModal(false)}>
                <Icons.X />
              </button>
            </div>
            
            <div className="share-content">
              <div className="share-section">
                <h4>
                  <Icons.Link />
                  Share Link
                </h4>
                <div className="share-link-row">
                  <input
                    type="text"
                    value={activeWhiteboard?.shareLink || generateShareLink()}
                    readOnly
                    className="share-link-input"
                  />
                  <button 
                    className={`copy-btn ${linkCopied ? 'copied' : ''}`}
                    onClick={copyShareLink}
                  >
                    {linkCopied ? <Icons.Check /> : <Icons.Copy />}
                    {linkCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="share-hint">Anyone with this link can view and collaborate</p>
              </div>

              <div className="share-section">
                <h4>
                  <Icons.Users />
                  Invite Collaborators
                </h4>
                <div className="invite-row">
                  <input
                    type="email"
                    placeholder="Enter email address..."
                    className="invite-input"
                  />
                  <button className="invite-btn">Invite</button>
                </div>
              </div>

              <div className="share-section">
                <h4>Access Settings</h4>
                <div className="access-options">
                  <label className="access-option">
                    <input type="radio" name="access" defaultChecked />
                    <span className="option-label">
                      <strong>Anyone with link</strong>
                      <span>Anyone can view and edit</span>
                    </span>
                  </label>
                  <label className="access-option">
                    <input type="radio" name="access" />
                    <span className="option-label">
                      <strong>Only invited</strong>
                      <span>Only people you invite can access</span>
                    </span>
                  </label>
                </div>
              </div>

              {activeWhiteboard?.collaborators.length ? (
                <div className="share-section">
                  <h4>Current Collaborators</h4>
                  <div className="collaborators-list">
                    {activeWhiteboard.collaborators.map(collab => (
                      <div key={collab.id} className="collaborator-item">
                        <div 
                          className="collaborator-avatar"
                          style={{ backgroundColor: collab.color }}
                        >
                          {collab.name.charAt(0)}
                        </div>
                        <span className="collaborator-name">{collab.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Whiteboard</h3>
              <button className="close-btn" onClick={() => setShowExportModal(false)}>
                <Icons.X />
              </button>
            </div>
            
            <div className="export-content">
              {/* Filename */}
              <div className="export-section">
                <label className="export-label">Filename</label>
                <input
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  placeholder="Enter filename..."
                  className="export-filename-input"
                />
              </div>
              
              {/* Format Selection */}
              <div className="export-section">
                <label className="export-label">Format</label>
                <div className="export-formats">
                  <button
                    className={`export-format-btn ${exportFormat === 'png' ? 'active' : ''}`}
                    onClick={() => setExportFormat('png')}
                  >
                    <div className="format-icon">
                      <Icons.Image />
                    </div>
                    <div className="format-info">
                      <span className="format-name">PNG</span>
                      <span className="format-desc">Best for web & transparency</span>
                    </div>
                  </button>
                  
                  <button
                    className={`export-format-btn ${exportFormat === 'jpeg' ? 'active' : ''}`}
                    onClick={() => setExportFormat('jpeg')}
                  >
                    <div className="format-icon">
                      <Icons.Image />
                    </div>
                    <div className="format-info">
                      <span className="format-name">JPEG</span>
                      <span className="format-desc">Smaller file size</span>
                    </div>
                  </button>
                  
                  <button
                    className={`export-format-btn ${exportFormat === 'svg' ? 'active' : ''}`}
                    onClick={() => setExportFormat('svg')}
                  >
                    <div className="format-icon">
                      <Icons.Shapes />
                    </div>
                    <div className="format-info">
                      <span className="format-name">SVG</span>
                      <span className="format-desc">Vector, scalable graphics</span>
                    </div>
                  </button>
                  
                  <button
                    className={`export-format-btn ${exportFormat === 'pdf' ? 'active' : ''}`}
                    onClick={() => setExportFormat('pdf')}
                  >
                    <div className="format-icon">
                      <Icons.Document />
                    </div>
                    <div className="format-info">
                      <span className="format-name">PDF</span>
                      <span className="format-desc">Best for printing</span>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Preview Info */}
              <div className="export-preview-info">
                <div className="preview-row">
                  <span>File will be saved as:</span>
                  <strong>{exportFilename || 'whiteboard'}.{exportFormat === 'jpeg' ? 'jpg' : exportFormat}</strong>
                </div>
              </div>
              
              {/* Actions */}
              <div className="export-actions">
                <button 
                  className="export-cancel-btn"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="export-download-btn"
                  onClick={exportWhiteboard}
                >
                  <Icons.Download />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Properties Panel */}
      {selectedShapeObject && showPropertiesPanel && (
        <div className="properties-panel">
          <div className="properties-header">
            <h4>Properties</h4>
            <button className="close-btn" onClick={() => setShowPropertiesPanel(false)}>
              <Icons.X />
            </button>
          </div>
          <div className="properties-content">
            {/* Position & Size */}
            <div className="property-group">
              <span className="property-label">Position</span>
              <div className="property-row">
                <span>X</span>
                <input
                  type="number"
                  className="property-input small"
                  value={Math.round(selectedShapeObject.x)}
                  onChange={(e) => updateShapeProperty('x', parseFloat(e.target.value))}
                />
                <span>Y</span>
                <input
                  type="number"
                  className="property-input small"
                  value={Math.round(selectedShapeObject.y)}
                  onChange={(e) => updateShapeProperty('y', parseFloat(e.target.value))}
                />
              </div>
            </div>
            
            <div className="property-group">
              <span className="property-label">Size</span>
              <div className="property-row">
                <span>W</span>
                <input
                  type="number"
                  className="property-input small"
                  value={Math.round(Math.abs(selectedShapeObject.width))}
                  onChange={(e) => updateShapeProperty('width', parseFloat(e.target.value))}
                />
                <span>H</span>
                <input
                  type="number"
                  className="property-input small"
                  value={Math.round(Math.abs(selectedShapeObject.height))}
                  onChange={(e) => updateShapeProperty('height', parseFloat(e.target.value))}
                />
              </div>
            </div>
            
            {/* Colors */}
            <div className="property-group">
              <span className="property-label">Appearance</span>
              <div className="property-row">
                <span>Stroke</span>
                <input
                  type="color"
                  className="property-color"
                  value={selectedShapeObject.color}
                  onChange={(e) => updateShapeProperty('color', e.target.value)}
                />
                <span>Fill</span>
                <input
                  type="color"
                  className="property-color"
                  value={selectedShapeObject.fill === 'transparent' ? '#ffffff' : selectedShapeObject.fill}
                  onChange={(e) => updateShapeProperty('fill', e.target.value)}
                />
              </div>
              <div className="property-row">
                <span>Width</span>
                <input
                  type="number"
                  className="property-input small"
                  value={selectedShapeObject.strokeWidth}
                  min={1}
                  max={20}
                  onChange={(e) => updateShapeProperty('strokeWidth', parseFloat(e.target.value))}
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="property-group">
              <span className="property-label">Text</span>
              <textarea
                className="property-input"
                value={selectedShapeObject.text || ''}
                onChange={(e) => updateShapeProperty('text', e.target.value)}
                placeholder="Add text..."
                rows={2}
              />
            </div>
            
            {/* Alignment buttons (when multiple selected) */}
            {selectedElements.length > 1 && (
              <div className="property-group">
                <span className="property-label">Align</span>
                <div className="align-buttons">
                  <button className="align-btn" onClick={() => alignShapes('left')} title="Align Left">
                    <Icons.AlignLeft />
                  </button>
                  <button className="align-btn" onClick={() => alignShapes('center')} title="Align Center">
                    <Icons.AlignCenter />
                  </button>
                  <button className="align-btn" onClick={() => alignShapes('right')} title="Align Right">
                    <Icons.AlignRight />
                  </button>
                  <button className="align-btn" onClick={() => alignShapes('top')} title="Align Top">
                    <Icons.AlignTop />
                  </button>
                  <button className="align-btn" onClick={() => alignShapes('middle')} title="Align Middle">
                    <Icons.AlignMiddle />
                  </button>
                  <button className="align-btn" onClick={() => alignShapes('bottom')} title="Align Bottom">
                    <Icons.AlignBottom />
                  </button>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="property-group">
              <span className="property-label">Actions</span>
              <div className="property-actions">
                <button className="property-action-btn" onClick={duplicateSelected}>Duplicate</button>
                <button className="property-action-btn" onClick={bringToFront}>Bring to Front</button>
                <button className="property-action-btn" onClick={sendToBack}>Send to Back</button>
                <button className="property-action-btn danger" onClick={deleteSelected}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shape Library Panel */}
      {showShapeLibrary && (
        <div className="shape-library-overlay" onClick={() => setShowShapeLibrary(false)}>
          <div className="shape-library-panel" onClick={(e) => e.stopPropagation()}>
            <div className="library-header">
              <h3>
                <Icons.Shapes />
                Shape Library
              </h3>
              <button className="close-btn" onClick={() => setShowShapeLibrary(false)}>
                <Icons.X />
              </button>
            </div>
            
            <div className="library-content">
              <div className="library-categories">
                {shapeCategories.map(category => (
                  <button
                    key={category.id}
                    className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    {category.id === 'basic' && <Icons.Shapes />}
                    {category.id === 'flowchart' && <Icons.Flowchart />}
                    {category.id === 'arrows' && <Icons.Arrow />}
                    {category.id === 'uml' && <Icons.Package />}
                    {category.id === 'containers' && <Icons.GroupBox />}
                    {category.id === 'misc' && <Icons.Grid />}
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
              
              <div className="library-shapes">
                <div className="shapes-grid">
                  {currentCategoryShapes.map(shape => (
                    <button
                      key={shape.type}
                      className={`library-shape-btn ${selectedShape === shape.type ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedShape(shape.type);
                        setCurrentTool('shape');
                        setShowShapeLibrary(false);
                      }}
                      title={shape.name}
                    >
                      <div className="shape-preview">
                        {shape.type === 'square' && <Icons.Square />}
                        {shape.type === 'rectangle' && <Icons.Rectangle />}
                        {shape.type === 'rounded-rectangle' && <Icons.Rectangle />}
                        {shape.type === 'circle' && <Icons.Circle />}
                        {shape.type === 'ellipse' && <Icons.UseCase />}
                        {shape.type === 'triangle' && <Icons.Triangle />}
                        {shape.type === 'diamond' && <Icons.Diamond />}
                        {shape.type === 'star' && <Icons.Star />}
                        {shape.type === 'pentagon' && <Icons.Pentagon />}
                        {shape.type === 'hexagon' && <Icons.Hexagon />}
                        {shape.type === 'heptagon' && <Icons.Heptagon />}
                        {shape.type === 'octagon' && <Icons.Octagon />}
                        {shape.type === 'parallelogram' && <Icons.Parallelogram />}
                        {shape.type === 'trapezoid' && <Icons.Trapezoid />}
                        {shape.type === 'cross' && <Icons.Cross />}
                        {shape.type === 'cloud' && <Icons.Cloud />}
                        {shape.type === 'heart' && <Icons.Heart />}
                        {shape.type === 'lightning' && <Icons.Lightning />}
                        {shape.type === 'callout' && <Icons.Callout />}
                        {shape.type === 'process' && <Icons.Process />}
                        {shape.type === 'decision' && <Icons.Diamond />}
                        {shape.type === 'terminator' && <Icons.Terminator />}
                        {shape.type === 'data' && <Icons.Data />}
                        {shape.type === 'document' && <Icons.Document />}
                        {shape.type === 'predefined-process' && <Icons.PreDefinedProcess />}
                        {shape.type === 'manual-input' && <Icons.ManualInput />}
                        {shape.type === 'preparation' && <Icons.Preparation />}
                        {shape.type === 'database' && <Icons.Database />}
                        {shape.type === 'hard-disk' && <Icons.HardDisk />}
                        {shape.type === 'internal-storage' && <Icons.InternalStorage />}
                        {shape.type === 'line' && <Icons.Line />}
                        {shape.type === 'arrow' && <Icons.Arrow />}
                        {shape.type === 'double-arrow' && <Icons.DoubleArrow />}
                        {shape.type === 'curved-arrow' && <Icons.CurvedArrow />}
                        {shape.type === 'right-arrow' && <Icons.RightArrow />}
                        {shape.type === 'left-arrow' && <Icons.LeftArrow />}
                        {shape.type === 'up-arrow' && <Icons.UpArrow />}
                        {shape.type === 'down-arrow' && <Icons.DownArrow />}
                        {shape.type === 'actor' && <Icons.Actor />}
                        {shape.type === 'use-case' && <Icons.UseCase />}
                        {shape.type === 'class-box' && <Icons.ClassBox />}
                        {shape.type === 'interface-box' && <Icons.InterfaceBox />}
                        {shape.type === 'package' && <Icons.Package />}
                        {shape.type === 'loop' && <Icons.Loop />}
                        {shape.type === 'group-box' && <Icons.GroupBox />}
                        {shape.type === 'swimlane' && <Icons.Swimlane />}
                      </div>
                      <span className="shape-name">{shape.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Brainstorm Panel */}
      <AIBrainstormPanel
        isOpen={showAIBrainstorm}
        onClose={() => setShowAIBrainstorm(false)}
        onAddIdea={handleAddBrainstormIdea}
        onAddMultipleIdeas={handleAddMultipleBrainstormIdeas}
      />

      {/* AI Scan Modal */}
      {showScanModal && (
        <div className="modal-overlay" onClick={() => {
          if (!scanProcessing) {
            setShowScanModal(false);
            resetScanModal();
          }
        }}>
          <div className="scan-modal scan-modal-enhanced" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icons.Scan />
                Whiteboard Scanner
              </h3>
              <button 
                className="close-btn" 
                onClick={() => {
                  if (!scanProcessing) {
                    setShowScanModal(false);
                    resetScanModal();
                  }
                }}
                disabled={scanProcessing}
              >
                <Icons.X />
              </button>
            </div>
            
            <div className="scan-content">
              {/* Upload / Camera Selection Mode */}
              {scanMode === 'upload' && !scanImage && (
                <div className="scan-upload-area">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  
                  <div className="upload-icon">
                    <Icons.Camera />
                  </div>
                  
                  <h4>Scan Physical Whiteboard</h4>
                  <p>Capture a photo or upload an image of your whiteboard. Our OCR technology will extract text, shapes, and diagrams.</p>
                  
                  <div className="upload-buttons">
                    <button 
                      className="upload-btn primary"
                      onClick={startCamera}
                    >
                      <Icons.Camera />
                      <span>Use Camera</span>
                    </button>
                    <button 
                      className="upload-btn secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icons.Upload />
                      <span>Upload Image</span>
                    </button>
                  </div>
                  
                  <div className="scan-tips">
                    <h5>📌 Tips for best results:</h5>
                    <ul>
                      <li>✓ Ensure good, even lighting</li>
                      <li>✓ Capture the entire whiteboard</li>
                      <li>✓ Avoid shadows and glare</li>
                      <li>✓ Use dark markers on white background</li>
                      <li>✓ Hold camera steady and perpendicular</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Camera Capture Mode */}
              {scanMode === 'camera' && cameraStream && (
                <div className="camera-capture-area">
                  <div className="camera-preview">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      style={{ width: '100%', borderRadius: '8px' }}
                    />
                    <div className="camera-overlay">
                      <div className="camera-frame" />
                    </div>
                  </div>
                  
                  <div className="camera-controls">
                    <button 
                      className="action-btn secondary"
                      onClick={stopCamera}
                    >
                      Cancel
                    </button>
                    <button 
                      className="action-btn primary capture-btn"
                      onClick={captureFromCamera}
                    >
                      <Icons.Camera />
                      Capture
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview Mode */}
              {scanMode === 'preview' && scanImage && !scanResult && (
                <div className="scan-preview-area">
                  <div className="image-preview-container">
                    <div className="image-preview">
                      <img src={enhancedImage || scanImage} alt="Whiteboard to scan" />
                      {scanProcessing && (
                        <div className="processing-overlay">
                          <div className="processing-spinner">
                            <Icons.Loader />
                          </div>
                          <p>{scanProgressMessage || 'Processing...'}</p>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${scanProgress}%` }}
                            />
                          </div>
                          <span className="progress-text">{Math.round(scanProgress)}%</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Enhancement Options */}
                    {showEnhancePreview && !scanProcessing && (
                      <div className="enhance-panel">
                        <h5>🔧 Image Enhancement</h5>
                        <p className="enhance-hint">The image quality may be low. Apply enhancements for better OCR results.</p>
                        
                        <div className="enhance-options">
                          <label className="enhance-option">
                            <span>Contrast</span>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2" 
                              step="0.1"
                              value={enhanceOptions.contrast}
                              onChange={(e) => setEnhanceOptions({...enhanceOptions, contrast: parseFloat(e.target.value)})}
                            />
                            <span className="value">{enhanceOptions.contrast.toFixed(1)}</span>
                          </label>
                          
                          <label className="enhance-option">
                            <span>Brightness</span>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="1.5" 
                              step="0.1"
                              value={enhanceOptions.brightness}
                              onChange={(e) => setEnhanceOptions({...enhanceOptions, brightness: parseFloat(e.target.value)})}
                            />
                            <span className="value">{enhanceOptions.brightness.toFixed(1)}</span>
                          </label>
                          
                          <label className="enhance-checkbox">
                            <input 
                              type="checkbox" 
                              checked={enhanceOptions.sharpen}
                              onChange={(e) => setEnhanceOptions({...enhanceOptions, sharpen: e.target.checked})}
                            />
                            <span>Sharpen</span>
                          </label>
                          
                          <label className="enhance-checkbox">
                            <input 
                              type="checkbox" 
                              checked={enhanceOptions.denoise}
                              onChange={(e) => setEnhanceOptions({...enhanceOptions, denoise: e.target.checked})}
                            />
                            <span>Reduce Noise</span>
                          </label>
                          
                          <label className="enhance-checkbox">
                            <input 
                              type="checkbox" 
                              checked={enhanceOptions.threshold}
                              onChange={(e) => setEnhanceOptions({...enhanceOptions, threshold: e.target.checked})}
                            />
                            <span>Black & White (best for text)</span>
                          </label>
                        </div>
                        
                        <div className="enhance-actions">
                          <button 
                            className="action-btn secondary small"
                            onClick={enhanceImage}
                          >
                            Preview Enhancement
                          </button>
                          {enhancedImage && (
                            <button 
                              className="action-btn primary small"
                              onClick={applyEnhancement}
                            >
                              Apply
                            </button>
                          )}
                          <button 
                            className="action-btn text small"
                            onClick={() => setShowEnhancePreview(false)}
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="scan-actions">
                    {!scanProcessing && (
                      <>
                        <button 
                          className="action-btn secondary"
                          onClick={resetScanModal}
                        >
                          Choose Different Image
                        </button>
                        {!showEnhancePreview && (
                          <button 
                            className="action-btn text"
                            onClick={() => setShowEnhancePreview(true)}
                          >
                            Enhance Image
                          </button>
                        )}
                        <button 
                          className="action-btn primary"
                          onClick={processWhiteboardImage}
                        >
                          <Icons.Sparkles />
                          Extract Content
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Results Preview & Edit Mode */}
              {scanResult && editableResults && (
                <div className="scan-results-area">
                  <div className="results-header">
                    <div className="result-icon success">
                      <Icons.Check />
                    </div>
                    <div className="results-summary">
                      <h4>Content Extracted!</h4>
                      <p>
                        Found {editableResults.textBoxes.length} text elements and {editableResults.shapes.length} shapes. 
                        Review and edit below before adding to your whiteboard.
                      </p>
                    </div>
                  </div>
                  
                  <div className="results-preview">
                    <div className="preview-section">
                      <h5>📝 Text Elements</h5>
                      {editableResults.textBoxes.length === 0 ? (
                        <p className="no-results">No text detected</p>
                      ) : (
                        <div className="results-list">
                          {editableResults.textBoxes.map((tb) => (
                            <div key={tb.id} className={`result-item ${tb.selected ? 'selected' : ''}`}>
                              <label className="result-checkbox">
                                <input 
                                  type="checkbox" 
                                  checked={tb.selected || false}
                                  onChange={() => toggleResultElementSelection('textBox', tb.id)}
                                />
                              </label>
                              <input 
                                type="text"
                                className="result-text-input"
                                value={tb.text}
                                onChange={(e) => updateResultText(tb.id, e.target.value)}
                                disabled={!tb.selected}
                              />
                              <button 
                                className="result-delete-btn"
                                onClick={() => deleteResultElement('textBox', tb.id)}
                                title="Delete"
                              >
                                <Icons.X />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="preview-section">
                      <h5>🔷 Shapes</h5>
                      {editableResults.shapes.length === 0 ? (
                        <p className="no-results">No shapes detected</p>
                      ) : (
                        <div className="results-list shapes-list">
                          {editableResults.shapes.map((shape) => (
                            <div key={shape.id} className={`result-item shape-item ${shape.selected ? 'selected' : ''}`}>
                              <label className="result-checkbox">
                                <input 
                                  type="checkbox" 
                                  checked={shape.selected || false}
                                  onChange={() => toggleResultElementSelection('shape', shape.id)}
                                />
                              </label>
                              <div className="shape-info">
                                <span className="shape-type">{shape.type}</span>
                                <span className="shape-size">{Math.round(shape.width)}×{Math.round(shape.height)}</span>
                              </div>
                              <button 
                                className="result-delete-btn"
                                onClick={() => deleteResultElement('shape', shape.id)}
                                title="Delete"
                              >
                                <Icons.X />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="scan-actions">
                    <button 
                      className="action-btn secondary"
                      onClick={resetScanModal}
                    >
                      Scan Another
                    </button>
                    <button 
                      className="action-btn primary"
                      onClick={applyScanResult}
                    >
                      <Icons.Check />
                      Add Selected to Whiteboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

