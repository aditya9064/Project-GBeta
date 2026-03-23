/* ═══════════════════════════════════════════════════════════
   useComputerUse — React hook for the desktop Computer Use agent

   When the app runs inside the Electron desktop shell,
   this hook connects to the Computer Use agent running in
   the main process. It enables the UI to start tasks, show
   live screenshots, display actions, and gate approvals.

   When running in a regular browser, isDesktop is false
   and none of the Computer Use features are available.
   ═══════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useRef } from 'react';

/* ─── Type declarations for the Electron preload bridge ─── */

interface OperonDesktop {
  isDesktop: boolean;
  platform: string;
  computerUse: {
    start: (args: {
      goal: string;
      model?: string;
      maxTurns?: number;
      maxBudgetUsd?: number;
      allowedApps?: string[];
    }) => Promise<{ executionId: string }>;
    approve: (executionId: string, approved: boolean) => Promise<{ success: boolean }>;
    cancel: (executionId: string) => Promise<{ success: boolean }>;
    takeScreenshot: () => Promise<string | null>;
    onStep: (callback: (data: any) => void) => () => void;
    onScreenshot: (callback: (data: any) => void) => () => void;
    onComplete: (callback: (data: any) => void) => () => void;
    onError: (callback: (data: any) => void) => () => void;
    onApprovalRequired: (callback: (data: any) => void) => () => void;
  };
  getPlatformInfo: () => Promise<{
    platform: string;
    arch: string;
    screenSize: { width: number; height: number };
    displays: Array<{ id: number; bounds: any; scaleFactor: number }>;
  }>;
}

declare global {
  interface Window {
    operonDesktop?: OperonDesktop;
  }
}

/* ─── Types ──────────────────────────────────────────────── */

export interface ComputerUseStep {
  type: 'thinking' | 'action' | 'screenshot' | 'result' | 'error' | 'approval';
  content?: string;
  action?: {
    type: string;
    coordinate?: [number, number];
    text?: string;
    key?: string;
  };
  timestamp: string;
}

export interface ComputerUseState {
  isDesktop: boolean;
  status: 'idle' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  executionId: string | null;
  steps: ComputerUseStep[];
  latestScreenshot: string | null;
  result: string | null;
  error: string | null;
  pendingApproval: { description: string; action: any } | null;
}

/* ─── Hook ───────────────────────────────────────────────── */

export function useComputerUse() {
  const isDesktop = typeof window !== 'undefined' && !!window.operonDesktop?.isDesktop;

  const [state, setState] = useState<ComputerUseState>({
    isDesktop,
    status: 'idle',
    executionId: null,
    steps: [],
    latestScreenshot: null,
    result: null,
    error: null,
    pendingApproval: null,
  });

  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!isDesktop) return;
    const desktop = window.operonDesktop!;

    const unsubs: Array<() => void> = [];

    unsubs.push(desktop.computerUse.onStep((data) => {
      setState(prev => ({
        ...prev,
        steps: [...prev.steps, data.step],
      }));
    }));

    unsubs.push(desktop.computerUse.onScreenshot((data) => {
      setState(prev => ({
        ...prev,
        latestScreenshot: data.screenshot,
      }));
    }));

    unsubs.push(desktop.computerUse.onComplete((data) => {
      setState(prev => ({
        ...prev,
        status: 'completed',
        result: data.result,
      }));
    }));

    unsubs.push(desktop.computerUse.onError((data) => {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: data.error,
      }));
    }));

    unsubs.push(desktop.computerUse.onApprovalRequired((data) => {
      setState(prev => ({
        ...prev,
        status: 'awaiting_approval',
        pendingApproval: data.action,
      }));
    }));

    cleanupRef.current = unsubs;
    return () => unsubs.forEach(fn => fn());
  }, [isDesktop]);

  const startTask = useCallback(async (goal: string, options?: {
    model?: string;
    maxTurns?: number;
    maxBudgetUsd?: number;
    allowedApps?: string[];
  }) => {
    if (!isDesktop) return;

    setState(prev => ({
      ...prev,
      status: 'running',
      steps: [],
      latestScreenshot: null,
      result: null,
      error: null,
      pendingApproval: null,
    }));

    const { executionId } = await window.operonDesktop!.computerUse.start({
      goal,
      ...options,
    });

    setState(prev => ({ ...prev, executionId }));
  }, [isDesktop]);

  const approve = useCallback(async (approved: boolean) => {
    if (!isDesktop || !state.executionId) return;

    await window.operonDesktop!.computerUse.approve(state.executionId, approved);
    setState(prev => ({
      ...prev,
      status: 'running',
      pendingApproval: null,
    }));
  }, [isDesktop, state.executionId]);

  const cancel = useCallback(async () => {
    if (!isDesktop || !state.executionId) return;

    await window.operonDesktop!.computerUse.cancel(state.executionId);
    setState(prev => ({ ...prev, status: 'cancelled' }));
  }, [isDesktop, state.executionId]);

  const takeScreenshot = useCallback(async () => {
    if (!isDesktop) return null;
    return window.operonDesktop!.computerUse.takeScreenshot();
  }, [isDesktop]);

  const reset = useCallback(() => {
    setState({
      isDesktop,
      status: 'idle',
      executionId: null,
      steps: [],
      latestScreenshot: null,
      result: null,
      error: null,
      pendingApproval: null,
    });
  }, [isDesktop]);

  return {
    ...state,
    startTask,
    approve,
    cancel,
    takeScreenshot,
    reset,
  };
}
