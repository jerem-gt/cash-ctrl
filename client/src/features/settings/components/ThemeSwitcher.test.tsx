import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setTheme } from '@/hooks/useTheme';
import i18n from '@/i18n';

import { ThemeSwitcher } from './ThemeSwitcher';

const KEY = 'cashctrl.theme';

function resetTheme() {
  setTheme('system');
  localStorage.clear();
  document.documentElement.classList.remove('dark');
}

describe('ThemeSwitcher', () => {
  beforeEach(async () => {
    resetTheme();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => cleanup());
  afterAll(() => resetTheme());

  it('affiche les trois options de thème', () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole('button', { name: /clair/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sombre/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /système/i })).toBeInTheDocument();
  });

  it('bascule en sombre au clic sur Sombre', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole('button', { name: /sombre/i }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it("marque l'option active via aria-pressed", () => {
    setTheme('dark');
    render(<ThemeSwitcher />);

    expect(screen.getByRole('button', { name: /sombre/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /clair/i })).toHaveAttribute('aria-pressed', 'false');
  });
});
