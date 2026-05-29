import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';

import { LanguageSwitcher } from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('fr');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders both language buttons', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button', { name: /français/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /english/i })).toBeInTheDocument();
  });

  it('changes i18n.language to "en" when English is clicked', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(i18n.language).toBe('en');
  });

  it('persists language choice to localStorage', async () => {
    const user = userEvent.setup();
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: /english/i }));

    expect(localStorage.getItem('i18nextLng')).toBe('en');
  });

  it('switches back to French when Français is clicked', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('en');
    render(<LanguageSwitcher />);

    await user.click(screen.getByRole('button', { name: /français/i }));

    expect(i18n.language).toBe('fr');
    expect(localStorage.getItem('i18nextLng')).toBe('fr');
  });
});
