import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ONBOARDING_KEY_PREFIX = 'crewos-onboarding-';

export function useOnboarding() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [completed, setCompleted] = useState<boolean>(() => {
    if (!uid) return true;
    return localStorage.getItem(`${ONBOARDING_KEY_PREFIX}${uid}`) === 'done';
  });

  const completeOnboarding = useCallback(() => {
    if (uid) {
      localStorage.setItem(`${ONBOARDING_KEY_PREFIX}${uid}`, 'done');
    }
    setCompleted(true);
  }, [uid]);

  return {
    showOnboarding: !!uid && !completed,
    completeOnboarding,
  };
}
