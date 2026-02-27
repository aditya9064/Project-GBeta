// Automation Services - Main Export
export * from './types';
export * from './agentService';
export { ExecutionEngine, executeWorkflow } from './executionEngine';
export type { ExecutionLog, RequiredInputField, ExecutionResult } from './executionEngine';
export { 
  checkAutomationBackend, 
  isBackendAvailable,
  AutomationGmailAPI,
  AutomationSlackAPI,
  AutomationAIAPI,
  AutomationHttpAPI,
  AutomationBrowserAPI,
} from './automationApi';
export type { AutomationStatus, BrowserActionResult } from './automationApi';
export { AgentMemoryService } from './memoryService';
export { AgentBus } from './agentBus';
export { generatePlan, generateAgentFromPrompt } from './planGenerator';
export type { AIGeneratedAgent } from './planGenerator';
export { planToWorkflow } from './planConverter';

