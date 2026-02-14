// Automation Services - Main Export
export * from './types';
export * from './agentService';
export { ExecutionEngine } from './executionEngine';
export type { ExecutionLog } from './executionEngine';
export { 
  checkAutomationBackend, 
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationSlackAPI,
  AutomationAIAPI,
  AutomationHttpAPI,
} from './automationApi';
export type { AutomationStatus } from './automationApi';

