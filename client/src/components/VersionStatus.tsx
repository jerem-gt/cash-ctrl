/* eslint-disable sonarjs/pseudo-random */
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppVersion } from '../hooks/useAppVersion.ts';
import { showToast } from './ui';

const TRIGGER_CLICKS = 7;

let confettiStyleInjected = false;

function launchMoneyConfetti() {
  if (!confettiStyleInjected) {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes money-fall {
        0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
        80%  { opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    confettiStyleInjected = true;
  }

  const symbols = ['💸', '💶', '🪙', '💰', '💵'];
  for (let i = 0; i < 35; i++) {
    const el = document.createElement('span');
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    const delay = Math.random() * 0.9;
    const duration = Math.random() * 2 + 2.2;
    el.style.cssText = `
      position: fixed;
      top: -2rem;
      left: ${Math.random() * 100}%;
      font-size: ${Math.random() * 1 + 1}rem;
      animation: money-fall ${duration}s ${delay}s ease-in forwards;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

export function VersionStatus() {
  const { t } = useTranslation('sidebar');
  const { version, isOnline } = useAppVersion();
  const clickCountRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const easterEggMessages = useMemo(
    () => [t('easter_egg_0'), t('easter_egg_1'), t('easter_egg_2'), t('easter_egg_3')],
    [t],
  );

  const handleClick = useCallback(() => {
    clickCountRef.current += 1;
    clearTimeout(resetTimerRef.current);

    if (clickCountRef.current >= TRIGGER_CLICKS) {
      const msg = easterEggMessages[Math.floor(Math.random() * easterEggMessages.length)];
      showToast(msg);
      launchMoneyConfetti();
      clickCountRef.current = 0;
      return;
    }

    resetTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);
  }, [easterEggMessages]);

  return (
    <button
      type="button"
      className="flex items-center gap-2 px-5 py-2 transition-opacity duration-300 cursor-default opacity-40 hover:opacity-100 focus:outline-none"
      onClick={handleClick}
    >
      <div
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
        version {version}
      </span>
    </button>
  );
}
