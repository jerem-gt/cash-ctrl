import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { fmt } from '@/lib/format';
import { loadI18nForTests } from '@/tests/helpers/i18nTestUtils';

import type { CollectedBrick } from '../lib/bricks';
import type { GameEvent } from '../lib/engine';

let BudgetBreaker: typeof import('./BudgetBreaker').default;
let MIN_RECORD_PLAY_SECONDS: typeof import('../lib/record').MIN_RECORD_PLAY_SECONDS;
let BEST_KEY: typeof import('../lib/record').BEST_KEY;
let useBudgetBreaker: typeof import('../store').useBudgetBreaker;

const collectBricksMock = vi.fn<() => CollectedBrick[]>();
const stepMock = vi.fn<() => GameEvent[]>();

beforeAll(async () => {
  vi.doMock('../lib/bricks', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/bricks')>()),
    collectBricks: () => collectBricksMock(),
  }));
  vi.doMock('../lib/engine', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../lib/engine')>()),
    step: () => stepMock(),
  }));
  vi.resetModules();
  ({ default: BudgetBreaker } = await import('./BudgetBreaker'));
  ({ MIN_RECORD_PLAY_SECONDS, BEST_KEY } = await import('../lib/record'));
  ({ useBudgetBreaker } = await import('../store'));
  await loadI18nForTests();
});

afterAll(() => {
  vi.doUnmock('../lib/bricks');
  vi.doUnmock('../lib/engine');
  vi.resetModules();
});

function makeBrick(animate?: (...args: unknown[]) => unknown): CollectedBrick {
  const el = document.createElement('button');
  el.textContent = 'Livret A';
  if (animate) (el as unknown as { animate: unknown }).animate = animate;
  document.body.append(el);
  return {
    el,
    rect: { x: 100, y: 100, w: 80, h: 30 },
    category: 'account',
    label: 'Livret A',
  };
}

// Intl insère des espaces insécables que le normaliseur de Testing Library ne remet pas dans le motif.
const money = (n: number) => (content: string) =>
  content.replaceAll(/\s/g, ' ') === fmt(n).replaceAll(/\s/g, ' ');

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderGame(onClose = vi.fn()) {
  const utils = render(<BudgetBreaker onClose={onClose} />);
  return { ...utils, onClose };
}

// Intro terminée, balle lancée : le jeu est en cours.
function startPlaying(onClose = vi.fn()) {
  const utils = renderGame(onClose);
  advance(800);
  fireEvent.keyDown(document, { key: ' ', code: 'Space' });
  return utils;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  collectBricksMock.mockReset();
  collectBricksMock.mockImplementation(() => [makeBrick()]);
  stepMock.mockReset();
  stepMock.mockReturnValue([]);
});

afterEach(() => {
  for (const el of document.body.querySelectorAll(':scope > button')) el.remove();
});

describe('BudgetBreaker', () => {
  it("affiche l'intro puis le HUD", () => {
    renderGame();
    expect(screen.getByRole('dialog', { name: 'Casse-budget' })).toBeInTheDocument();
    expect(screen.getByText(/avant qu'il ne te détruise/)).toBeInTheDocument();
    expect(screen.queryByText('Dégâts')).not.toBeInTheDocument();
    advance(800);
    expect(screen.getByText('Dégâts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitter le jeu' })).toBeInTheDocument();
  });

  it('Échap appelle onClose', () => {
    const { onClose } = renderGame();
    advance(800);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le bouton X appelle onClose', () => {
    const { onClose } = renderGame();
    advance(800);
    fireEvent.click(screen.getByRole('button', { name: 'Quitter le jeu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("affiche le message empty et un bouton Quitter quand il n'y a rien à casser", () => {
    collectBricksMock.mockReturnValue([]);
    const { onClose } = renderGame();
    advance(800);
    expect(screen.getByText(/Rien à casser ici/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lit et affiche le record depuis le storage', () => {
    localStorage.setItem(BEST_KEY, '1200');
    renderGame();
    advance(800);
    expect(screen.getByText(money(1200))).toBeInTheDocument();
  });

  it('ignore un record invalide dans le storage', () => {
    localStorage.setItem(BEST_KEY, 'n’importe quoi');
    renderGame();
    advance(800);
    expect(screen.getAllByText(money(0))).toHaveLength(2);
  });

  it('ne plante pas sans contexte canvas 2D en pleine partie', () => {
    startPlaying();
    stepMock.mockReturnValueOnce([{ type: 'brick', id: 0 }]);
    advance(200);
    expect(screen.getByText(money(500))).toBeInTheDocument();
  });

  it('affiche une bulle sarcastique avec le label après une brique cassée', () => {
    startPlaying();
    stepMock.mockReturnValueOnce([{ type: 'brick', id: 0 }]);
    advance(100);
    const bubble = screen.getByRole('status');
    expect(bubble.textContent).toContain('Livret A');
    expect(bubble.textContent).not.toContain('{{');
  });

  it('affiche un message de vie perdue', () => {
    startPlaying();
    stepMock.mockReturnValueOnce([{ type: 'lifeLost' }]);
    advance(100);
    expect(screen.getByRole('status').textContent).toMatch(/Balle perdue|Raté|Une vie de moins/);
  });
});

describe('BudgetBreaker - record', () => {
  // Évalué à l'usage : la constante n'est importée que dans beforeAll.
  const longEnough = () => (MIN_RECORD_PLAY_SECONDS + 1) * 1000;

  function breakOneBrick() {
    stepMock.mockReturnValueOnce([{ type: 'brick', id: 0 }]);
    advance(100);
  }

  it("n'écrit pas le record en quittant avant la durée minimale", () => {
    startPlaying();
    breakOneBrick();
    advance(5000);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(localStorage.getItem(BEST_KEY)).toBeNull();
  });

  it("écrit le record en quittant après la durée minimale s'il est supérieur", () => {
    startPlaying();
    breakOneBrick();
    advance(longEnough());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(localStorage.getItem(BEST_KEY)).toBe('500');
  });

  it('conserve un record supérieur en quittant après la durée minimale', () => {
    localStorage.setItem(BEST_KEY, '9999');
    startPlaying();
    breakOneBrick();
    advance(longEnough());
    fireEvent.click(screen.getByRole('button', { name: 'Quitter le jeu' }));
    expect(localStorage.getItem(BEST_KEY)).toBe('9999');
  });

  it('écrit le record et affiche « Nouveau record ! » à la victoire après la durée minimale', () => {
    startPlaying();
    breakOneBrick();
    advance(longEnough());
    stepMock.mockReturnValueOnce([{ type: 'won' }]);
    advance(100);
    expect(screen.getByText(/Patrimoine : 0 €/)).toBeInTheDocument();
    expect(screen.getByText('Nouveau record !')).toBeInTheDocument();
    expect(localStorage.getItem(BEST_KEY)).toBe('500');
  });

  it('écrit le record à la défaite après la durée minimale', () => {
    startPlaying();
    breakOneBrick();
    advance(longEnough());
    stepMock.mockReturnValueOnce([{ type: 'lost' }]);
    advance(100);
    expect(screen.getByText(/Game over/)).toBeInTheDocument();
    expect(localStorage.getItem(BEST_KEY)).toBe('500');
  });

  it("n'affiche pas « Nouveau record ! » ni n'écrit si la partie est trop courte", () => {
    startPlaying();
    breakOneBrick();
    stepMock.mockReturnValueOnce([{ type: 'won' }]);
    advance(100);
    expect(screen.getByText(/Patrimoine : 0 €/)).toBeInTheDocument();
    expect(screen.queryByText('Nouveau record !')).not.toBeInTheDocument();
    expect(localStorage.getItem(BEST_KEY)).toBeNull();
  });

  it('recollecte les briques et repart à zéro au clic sur Rejouer', () => {
    startPlaying();
    breakOneBrick();
    stepMock.mockReturnValueOnce([{ type: 'won' }]);
    advance(100);
    collectBricksMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(collectBricksMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Patrimoine : 0 €/)).not.toBeInTheDocument();
    expect(screen.getAllByText(money(0))).toHaveLength(2);
  });
});

describe('BudgetBreaker - restauration', () => {
  function fakeAnimation() {
    return { reverse: vi.fn(), cancel: vi.fn() };
  }

  it('rejoue les animations à l’envers avec le message de remboursement puis ferme', () => {
    const anim = fakeAnimation();
    collectBricksMock.mockReturnValue([makeBrick(() => anim)]);
    const { onClose } = startPlaying();
    stepMock.mockReturnValueOnce([{ type: 'brick', id: 0 }]);
    advance(100);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(anim.reverse).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Remboursement en cours/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    advance(1100);
    expect(anim.cancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('annule immédiatement les animations et le ratio au démontage', () => {
    const anim = fakeAnimation();
    collectBricksMock.mockReturnValue([makeBrick(() => anim)]);
    const { result } = (() => {
      const probe = { current: { remainingRatio: 1 } };
      return { result: probe };
    })();
    function Probe() {
      result.current = useBudgetBreaker();
      return null;
    }
    const { unmount } = render(<Probe />);
    const game = startPlaying();
    stepMock.mockReturnValueOnce([{ type: 'brick', id: 0 }]);
    advance(100);
    game.unmount();
    expect(anim.cancel).toHaveBeenCalledTimes(1);
    expect(anim.reverse).not.toHaveBeenCalled();
    expect(result.current.remainingRatio).toBe(1);
    unmount();
  });
});
