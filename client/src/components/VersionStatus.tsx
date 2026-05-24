import { useCallback, useRef } from 'react';

import { useAppVersion } from '../hooks/useAppVersion.ts';
import { showToast } from './ui';

const TRIGGER_CLICKS = 7;

const EASTER_EGG_MESSAGES = [
  'Tu as trouvé le mode développeur. Malheureusement il ne sert à rien.',
  'Félicitations ! Tu viens de perdre 30 secondes que tu aurais pu investir.',
  'À force de cliquer, tu aurais pu faire un budget… mais tu as préféré ça.',
  "Psst — le vrai secret, c'est que l'argent que tu surveilles ici ne te rend pas plus riche.",
];

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
  const { version, isOnline } = useAppVersion();
  const clickCount = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleClick = useCallback(() => {
    clickCount.current += 1;
    clearTimeout(resetTimer.current);

    if (clickCount.current >= TRIGGER_CLICKS) {
      const msg = EASTER_EGG_MESSAGES[Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)];
      showToast(msg);
      launchMoneyConfetti();
      clickCount.current = 0;
      return;
    }

    resetTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 2000);
  }, []);

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
