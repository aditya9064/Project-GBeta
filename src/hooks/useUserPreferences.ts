/* ═══════════════════════════════════════════════════════════
   User Preferences — Stores user role, experience level,
   and display preferences. Powers the accessibility layer
   that adapts terminology, sidebar visibility, and guided
   experiences based on who the user is.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type UserRole = 'business' | 'marketer' | 'operations' | 'developer' | 'other';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface UserPreferences {
  role: UserRole;
  experience: ExperienceLevel;
  completedTours: string[];
  showDevTools: boolean;
  simplifiedMode: boolean;
  useCasesViewed: string[];
}

const PREFS_KEY_PREFIX = 'operonai-prefs-';

const DEFAULT_PREFS: UserPreferences = {
  role: 'other',
  experience: 'beginner',
  completedTours: [],
  showDevTools: false,
  simplifiedMode: true,
  useCasesViewed: [],
};

function loadPrefs(uid: string | undefined): UserPreferences {
  if (!uid) return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(`${PREFS_KEY_PREFIX}${uid}`);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch { /* corrupted */ }
  return DEFAULT_PREFS;
}

function savePrefs(uid: string | undefined, prefs: UserPreferences) {
  if (!uid) return;
  localStorage.setItem(`${PREFS_KEY_PREFIX}${uid}`, JSON.stringify(prefs));
}

/* ─── Terminology mapping by experience level ──────────── */

const SIMPLE_TERMS: Record<string, string> = {
  'Agents': 'Assistants',
  'Agent': 'Assistant',
  'agents': 'assistants',
  'agent': 'assistant',
  'Workflow': 'Automation',
  'Workflows': 'Automations',
  'workflow': 'automation',
  'Workflow Builder': 'Automation Builder',
  'Execution': 'Task Run',
  'Executions': 'Task Runs',
  'execution': 'task run',
  'Total Executions': 'Tasks Completed',
  'Execution Logs': 'Activity History',
  'Deploy': 'Activate',
  'deploy': 'activate',
  'Deployed': 'Active',
  'deployed': 'active',
  'Crews & Orchestration': 'Team Management',
  'Knowledge Base': 'Saved Information',
  'Sub-Agents': 'Helper Assistants',
  'Marketplace': 'Template Gallery',
  'Sales Intelligence': 'Sales Tracker',
  'Document AI': 'Document Creator',
  'Communications': 'Messages & Email',
  'Success Rate': 'Completion Rate',
  'Active': 'Running',
};

export function useUserPreferences() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [prefs, setPrefsState] = useState<UserPreferences>(() => loadPrefs(uid));

  const setPrefs = useCallback((update: Partial<UserPreferences>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...update };
      savePrefs(uid, next);
      return next;
    });
  }, [uid]);

  const setRole = useCallback((role: UserRole) => {
    const showDevTools = role === 'developer';
    const simplifiedMode = role !== 'developer';
    const experience: ExperienceLevel = role === 'developer' ? 'intermediate' : 'beginner';
    setPrefs({ role, showDevTools, simplifiedMode, experience });
  }, [setPrefs]);

  const completeTour = useCallback((tourId: string) => {
    setPrefsState(prev => {
      const next = { ...prev, completedTours: [...new Set([...prev.completedTours, tourId])] };
      savePrefs(uid, next);
      return next;
    });
  }, [uid]);

  const markUseCaseViewed = useCallback((useCaseId: string) => {
    setPrefsState(prev => {
      const next = { ...prev, useCasesViewed: [...new Set([...prev.useCasesViewed, useCaseId])] };
      savePrefs(uid, next);
      return next;
    });
  }, [uid]);

  const t = useCallback((term: string): string => {
    if (!prefs.simplifiedMode) return term;
    return SIMPLE_TERMS[term] || term;
  }, [prefs.simplifiedMode]);

  const hasCompletedRoleSelection = prefs.role !== 'other' || prefs.completedTours.includes('role-selection');
  const isNewUser = prefs.completedTours.length === 0;
  const isDeveloper = prefs.role === 'developer';

  return {
    prefs,
    setPrefs,
    setRole,
    completeTour,
    markUseCaseViewed,
    t,
    hasCompletedRoleSelection,
    isNewUser,
    isDeveloper,
  };
}
