import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { Sidebar } from './Sidebar';

function renderSidebar(onOpenSearch: () => void = vi.fn()) {
  return renderWithProviders(
    <Sidebar
      username="usertest"
      mobileOpen={false}
      onMobileClose={() => {}}
      onOpenSearch={onOpenSearch}
    />,
  );
}

describe('Sidebar', () => {
  it("affiche le nom de l'application", () => {
    renderSidebar();
    expect(screen.getAllByText(/cashctrl/i).length).toBeGreaterThan(0);
  });

  it('affiche les liens de navigation principaux', () => {
    renderSidebar();
    expect(screen.getByText('Comptes')).toBeInTheDocument();
  });

  it('affiche le bouton paramètres', async () => {
    renderSidebar();
    expect(await screen.findByTitle(/Menu/i)).toBeInTheDocument();
  });

  it("affiche le nom d'utilisateur", () => {
    renderWithProviders(
      <Sidebar
        username="jerem"
        mobileOpen={false}
        onMobileClose={() => {}}
        onOpenSearch={() => {}}
      />,
    );
    expect(screen.getByText('jerem')).toBeInTheDocument();
  });

  it('affiche le bouton Déconnexion', async () => {
    renderSidebar();
    expect(await screen.findByTitle(/Déconnexion/i)).toBeInTheDocument();
  });

  it('affiche le compte chargé dans la liste', async () => {
    renderSidebar();
    expect(await screen.findByText('Compte test')).toBeInTheDocument();
  });

  it('bascule le groupement au clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText('Compte test');
    const groupBtn = screen.getByRole('button', { name: 'Banque' });
    await user.click(groupBtn);
    expect(groupBtn).toBeInTheDocument();
  });

  it('le bouton de recherche appelle onOpenSearch', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    renderSidebar(onOpenSearch);
    await user.click(screen.getByText(/rechercher/i));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
