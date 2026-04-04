/* ═══════════════════════════════════════════════════════════
   Memory System — Public API
   ═══════════════════════════════════════════════════════════ */

export { Memory } from './memoryService.js';
export { MemorySessionStore } from './sessionStore.js';
export { MemoryObservationStore } from './observationStore.js';
export { MemorySummaryStore } from './summaryStore.js';
export { MemorySearchService } from './searchService.js';
export { MemoryContextBuilder } from './contextBuilder.js';
export { MemoryDatabase } from './database.js';
export type {
  MemorySession,
  MemoryObservation,
  MemorySummary,
  ObservationInput,
  SummaryInput,
  SearchQuery,
  SearchResult,
  TimelineEntry,
  ContextOutput,
  ObservationType,
  SessionStatus,
  MemoryConfig,
} from './types.js';
