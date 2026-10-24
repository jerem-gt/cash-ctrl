import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { Sidebar } from './Sidebar';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('est inert quand fermé sous le breakpoint md', () => {
    stubMatchMedia(false);
    const { container } = renderSidebar();
    expect(container.querySelector('aside')).toHaveAttribute('inert');
  });

  it("n'est jamais inert en desktop", () => {
    stubMatchMedia(true);
    const { container } = renderSidebar();
    expect(container.querySelector('aside')).not.toHaveAttribute('inert');
  });

  it('Échap ferme le tiroir ouvert et le focus va au bouton de fermeture', async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <Sidebar username="u" mobileOpen onMobileClose={onClose} onOpenSearch={() => {}} />,
    );
    expect(container.querySelector('aside')).not.toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveFocus();
    onClose.mockClear();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar - favoris', () => {
  it("n'affiche pas la section Favoris sans favori", async () => {
    renderSidebar();
    await screen.findByText('Compte test');
    expect(screen.queryByText('Favoris')).not.toBeInTheDocument();
  });

  it("affiche la section Favoris dans l'ordre en tête de liste", async () => {
    server.use(
      http.get('/api/accounts', () =>
        HttpResponse.json(
          ACCOUNTS.map((a) => {
            if (a.id === 2) return { ...a, favorite_order: 0 };
            if (a.id === 1) return { ...a, favorite_order: 1 };
            return a;
          }),
        ),
      ),
    );
    renderSidebar();
    await screen.findByText('Favoris');
    const links = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('/accounts/'));
    expect(links[0]).toHaveAttribute('href', '/accounts/2');
    expect(links[1]).toHaveAttribute('href', '/accounts/1');
  });
});
