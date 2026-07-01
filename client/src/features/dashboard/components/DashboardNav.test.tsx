import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { NavSection } from '@/features/dashboard/components/DashboardNav';
import { DashboardNav } from '@/features/dashboard/components/DashboardNav';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const allSections: NavSection[] = [
  { id: 'section-this-month', label: 'Ce mois-ci', show: true },
  { id: 'section-pending', label: 'À traiter', badge: 3, show: true },
  { id: 'section-wealth', label: 'Patrimoine', show: true },
  { id: 'section-recent', label: 'Récent', show: true },
];

describe('DashboardNav', () => {
  it('affiche les boutons de toutes les sections visibles', () => {
    renderWithProviders(<DashboardNav sections={allSections} />);
    expect(screen.getByRole('button', { name: /Ce mois-ci/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Patrimoine/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Récent/ })).toBeInTheDocument();
  });

  it('affiche le badge quand il est > 0', () => {
    renderWithProviders(<DashboardNav sections={allSections} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('ne rend rien quand une seule section est visible', () => {
    renderWithProviders(<DashboardNav sections={[{ id: 's1', label: 'Seul', show: true }]} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('masque les sections avec show: false', () => {
    const sections: NavSection[] = [
      { id: 'section-this-month', label: 'Ce mois-ci', show: true },
      { id: 'section-pending', label: 'À traiter', show: false },
      { id: 'section-wealth', label: 'Patrimoine', show: true },
    ];
    renderWithProviders(<DashboardNav sections={sections} />);
    expect(screen.queryByRole('button', { name: 'À traiter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ce mois-ci' })).toBeInTheDocument();
  });

  it('ne rend pas le badge quand il est 0', () => {
    const sections: NavSection[] = [
      { id: 'section-this-month', label: 'Ce mois-ci', show: true },
      { id: 'section-pending', label: 'À traiter', badge: 0, show: true },
    ];
    renderWithProviders(<DashboardNav sections={sections} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it("appelle scrollTo sur le clic d'un bouton", async () => {
    const el = document.createElement('div');
    el.id = 'section-this-month';
    document.body.appendChild(el);

    renderWithProviders(<DashboardNav sections={allSections} />);
    const scrollSpy = vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => undefined);

    await userEvent.click(screen.getByRole('button', { name: /Ce mois-ci/ }));
    expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    scrollSpy.mockRestore();
    document.body.removeChild(el);
  });
});
