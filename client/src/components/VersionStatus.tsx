import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';

import {
  startBudgetBreaker,
  stopBudgetBreaker,
  useBudgetBreaker,
} from '@/features/budget-breaker/store';

import { useAppVersion } from '../hooks/useAppVersion.ts';

const BudgetBreaker = lazy(() => import('@/features/budget-breaker/components/BudgetBreaker'));

const TRIGGER_CLICKS = 7;

export function VersionStatus() {
  const { version, isOnline } = useAppVersion();
  const { active } = useBudgetBreaker();
  const clickCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    clickCountRef.current += 1;
    clearTimeout(resetTimerRef.current);

    if (clickCountRef.current >= TRIGGER_CLICKS) {
      startBudgetBreaker();
      clickCountRef.current = 0;
      return;
    }

    resetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);
  }, []);

  // Démontage en cours de partie (déconnexion…) : remet le store à l'état inactif.
  useEffect(() => stopBudgetBreaker, []);

  const handleClose = useCallback(() => {
    stopBudgetBreaker();
    const button = buttonRef.current;
    const focusable =
      button !== null &&
      button.closest('[inert]') === null &&
      button.getBoundingClientRect().width > 0;
    if (focusable) button.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-budget-breaker-ignore
        className="flex items-center gap-2 px-5 py-2 transition-opacity duration-300 cursor-default opacity-40 hover:opacity-100 focus:outline-none"
        onClick={handleClick}
      >
        <div
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            isOnline ? 'bg-success' : 'bg-danger'
          }`}
        />
        <span className="text-[10px] font-mono tracking-wider text-content-subtle uppercase">
          version {version}
        </span>
      </button>
      {active && (
        <Suspense fallback={null}>
          <BudgetBreaker onClose={handleClose} />
        </Suspense>
      )}
    </>
  );
}
