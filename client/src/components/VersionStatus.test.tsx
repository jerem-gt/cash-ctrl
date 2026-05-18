import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VersionStatus } from './VersionStatus';

vi.mock('../hooks/useAppVersion.ts', () => ({
  useAppVersion: vi.fn(() => ({
    version: '1.2.3',
    isOnline: true,
    isDev: false,
    isLoading: false,
  })),
}));

vi.mock('./ui.tsx', () => ({
  showToast: vi.fn(),
}));

import { useAppVersion } from '../hooks/useAppVersion.ts';
import { showToast } from './ui.tsx';

function clickTimes(el: HTMLElement, n: number) {
  for (let i = 0; i < n; i++) fireEvent.click(el);
}

function getVersionEl() {
  return screen.getByText(/version/).closest('div')!;
}

function countConfettiSpans(before: number) {
  return [...document.body.children].filter((el) => el.tagName === 'SPAN').length - before;
}

describe('VersionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppVersion).mockReturnValue({
      version: '1.2.3',
      isOnline: true,
      isDev: false,
      isLoading: false,
    });
    document.body.querySelectorAll('span').forEach((el) => el.remove());
  });

  it('affiche la version', () => {
    render(<VersionStatus />);
    expect(screen.getByText('version 1.2.3')).toBeInTheDocument();
  });

  it('affiche le point vert quand en ligne', () => {
    const { container } = render(<VersionStatus />);
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).not.toBeInTheDocument();
  });

  it('affiche le point rouge quand hors ligne', () => {
    vi.mocked(useAppVersion).mockReturnValue({
      version: '1.2.3',
      isOnline: false,
      isDev: false,
      isLoading: false,
    });
    const { container } = render(<VersionStatus />);
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-500')).not.toBeInTheDocument();
  });

  it('ne déclenche rien avant 7 clics', () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 6);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('déclenche le toast au 7e clic', () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(typeof vi.mocked(showToast).mock.calls[0][0]).toBe('string');
    expect(vi.mocked(showToast).mock.calls[0][0].length).toBeGreaterThan(0);
  });

  it('lance 35 confetti au 7e clic', () => {
    render(<VersionStatus />);
    const spansBefore = [...document.body.children].filter((el) => el.tagName === 'SPAN').length;
    clickTimes(getVersionEl(), 7);
    expect(countConfettiSpans(spansBefore)).toBe(35);
  });

  it('remet le compteur à zéro après déclenchement (7 clics supplémentaires ne suffisent pas)', () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    vi.clearAllMocks();
    clickTimes(getVersionEl(), 6);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('déclenche à nouveau après un 2e cycle complet de 7 clics', () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    vi.clearAllMocks();
    clickTimes(getVersionEl(), 7);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("remet le compteur à zéro après 2 secondes d'inactivité", () => {
    vi.useFakeTimers();
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 5);
    vi.advanceTimersByTime(2000);
    clickTimes(getVersionEl(), 6);
    expect(showToast).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("n'injecte pas un 2e style money-fall si le premier est déjà là", () => {
    render(<VersionStatus />);
    clickTimes(getVersionEl(), 7);
    const countAfterFirst = [...document.head.querySelectorAll('style')].filter((el) =>
      el.textContent?.includes('money-fall'),
    ).length;
    clickTimes(getVersionEl(), 7);
    const countAfterSecond = [...document.head.querySelectorAll('style')].filter((el) =>
      el.textContent?.includes('money-fall'),
    ).length;
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
