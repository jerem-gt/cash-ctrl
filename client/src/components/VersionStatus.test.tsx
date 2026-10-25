import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let VersionStatus: typeof import('./VersionStatus').VersionStatus;
let useAppVersion: typeof import('../hooks/useAppVersion.ts').useAppVersion;
let stopBudgetBreaker: typeof import('@/features/budget-breaker/store').stopBudgetBreaker;
let startBudgetBreaker: typeof import('@/features/budget-breaker/store').startBudgetBreaker;

beforeAll(async () => {
  vi.doMock('../hooks/useAppVersion.ts', () => ({
    useAppVersion: vi.fn(() => ({
      version: '1.2.3',
      isOnline: true,
      isDev: false,
      isLoading: false,
    })),
  }));
  vi.doMock('@/features/budget-breaker/components/BudgetBreaker', () => ({
    default: ({ onClose }: { onClose: () => void }) => (
      <div data-testid="game-stub">
        <button type="button" onClick={onClose}>
          stub-close
        </button>
      </div>
    ),
  }));
  vi.resetModules();
  ({ VersionStatus } = await import('./VersionStatus'));
  ({ useAppVersion } = await import('../hooks/useAppVersion.ts'));
  ({ stopBudgetBreaker, startBudgetBreaker } = await import('@/features/budget-breaker/store'));
});

afterAll(() => {
  vi.doUnmock('../hooks/useAppVersion.ts');
  vi.doUnmock('@/features/budget-breaker/components/BudgetBreaker');
  vi.resetModules();
});

function clickTimes(el: HTMLElement, n: number) {
  for (let i = 0; i < n; i++) fireEvent.click(el);
}

function getVersionEl() {
  return screen.getByText(/version/).closest('button')!;
}

describe('VersionStatus', () => {
  beforeEach(() => {
    vi.mocked(useAppVersion).mockReturnValue({
      version: '1.2.3',
      isOnline: true,
      isDev: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    act(() => stopBudgetBreaker());
  });

  it('affiche la version', () => {
    render(<VersionStatus />);
    expect(screen.getByText('version 1.2.3')).toBeInTheDocument();
  });

  it('affiche le point vert quand en ligne', () => {
    const { container } = render(<VersionStatus />);
    expect(container.querySelector('.bg-success')).toBeInTheDocument();
    expect(container.querySelector('.bg-danger')).not.toBeInTheDocument();
  });

  it('affiche le point rouge quand hors ligne', () => {
    vi.mocked(useAppVersion).mockReturnValue({
      version: '1.2.3',
      isOnline: false,
      isDev: false,
      isLoading: false,
    });
    const { container } = render(<VersionStatus />);
    expect(container.querySelector('.bg-danger')).toBeInTheDocument();
    expect(container.querySelector('.bg-success')).not.toBeInTheDocument();
  });

  it('est exclu du jeu via data-budget-breaker-ignore', () => {
    render(<VersionStatus />);
    expect(getVersionEl()).toHaveAttribute('data-budget-breaker-ignore');
  });

  it('ne lance pas le jeu avant 7 clics', () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 6);
    expect(screen.queryByTestId('game-stub')).not.toBeInTheDocument();
  });

  it('lance le jeu au 7e clic', async () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    expect(await screen.findByTestId('game-stub')).toBeInTheDocument();
  });

  it('remet le compteur à zéro après déclenchement (6 clics supplémentaires ne suffisent pas)', async () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    await screen.findByTestId('game-stub');
    act(() => stopBudgetBreaker());
    expect(screen.queryByTestId('game-stub')).not.toBeInTheDocument();
    clickTimes(getVersionEl(), 6);
    expect(screen.queryByTestId('game-stub')).not.toBeInTheDocument();
  });

  it("remet le compteur à zéro après 2 secondes d'inactivité", () => {
    vi.useFakeTimers();
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 5);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    clickTimes(getVersionEl(), 6);
    expect(screen.queryByTestId('game-stub')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('démonte le jeu et rend le focus au bouton à la fermeture', async () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    fireEvent.click(await screen.findByText('stub-close'));
    expect(screen.queryByTestId('game-stub')).not.toBeInTheDocument();
    expect(getVersionEl()).toHaveFocus();
  });

  it('affiche le jeu quand le store est déjà actif', async () => {
    act(() => startBudgetBreaker());
    render(<VersionStatus />);
    expect(await screen.findByTestId('game-stub')).toBeInTheDocument();
  });
});
