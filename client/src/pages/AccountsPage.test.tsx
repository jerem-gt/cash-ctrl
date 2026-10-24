import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

let AccountsPage: typeof import('./AccountsPage').default;
let setGroupBy: typeof import('@/hooks/useAccountsGroupBy').setGroupBy;

beforeAll(async () => {
  vi.doMock('react-router', async () => {
    const actual = await vi.importActual('react-router');
    return { ...actual };
  });
  vi.resetModules();
  AccountsPage = (await import('./AccountsPage')).default;
  ({ setGroupBy } = await import('@/hooks/useAccountsGroupBy'));
});

afterAll(() => {
  vi.doUnmock('react-router');
  vi.resetModules();
});

function renderAccountsPage() {
  return renderWithProviders(<AccountsPage />);
}

beforeEach(() => {
  localStorage.clear();
  act(() => setGroupBy('bank'));
});

describe('AccountsPage', () => {
  it('affiche la liste des comptes groupés par banque par défaut', async () => {
    renderAccountsPage();

    await screen.findByText('BNP');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
    expect(screen.getAllByText(/1.500,00 €/).length).toBeGreaterThan(0);
  });

  it('affiche la liste des comptes groupés par type après switch', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const typeBtn = await screen.findByRole('button', { name: /^type$/i });
    await user.click(typeBtn);

    await screen.findByText('Courant');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });

  it('switche le groupement entre banque et type', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    // Mode banque par défaut : "Courant" n'est pas un label de groupe
    await screen.findByText('BNP');
    expect(screen.queryByRole('heading', { name: /courant/i })).not.toBeInTheDocument();

    // Switch vers type : "Courant" devient un label de groupe
    await user.click(screen.getByRole('button', { name: /^type$/i }));
    await screen.findByText('Courant');

    // Retour vers banque
    await user.click(screen.getByRole('button', { name: /^banque$/i }));
    await screen.findByText('BNP');
    expect(screen.queryByText('Courant')).not.toBeInTheDocument();
  });

  it("affiche un état vide si aucun compte n'existe", async () => {
    // On surcharge le mock pour renvoyer une liste vide
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));

    renderAccountsPage();

    expect(await screen.findByText(/aucun compte pour l'instant/i)).toBeInTheDocument();
  });

  it(`ouvre le modal de création via le menu « Ajouter » → « Compte »`, async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    await user.click(await screen.findByRole('button', { name: /ajouter/i }));
    await user.click(await screen.findByRole('button', { name: /^compte$/i }));

    expect(screen.getByText('Ajouter un compte')).toBeInTheDocument();
  });

  it('affiche le modal de confirmation de suppression et déclenche la suppression', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    // Trouve le bouton de suppression (Trash2) sur le premier compte
    const deleteBtns = await screen.findAllByTitle(/supprimer le compte/i);
    await user.click(deleteBtns[0]);

    // Vérifie que le modal de confirmation est ouvert
    expect(screen.getByText(/cette action est irréversible/i)).toBeInTheDocument();

    // Clique sur confirmer
    const confirmBtn = screen.getByRole('button', { name: /confirmer/i });
    await user.click(confirmBtn);

    // Vérifie l'apparition du toast
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toBe('Compte supprimé');
    });
  });

  it("ouvre le modal d'édition avec les données pré-remplies", async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const editBtns = await screen.findAllByTitle(/modifier le compte/i);
    await user.click(editBtns[0]);

    // Vérifie que le modal d'édition est là
    expect(screen.getByText('Modifier le compte')).toBeInTheDocument();
  });

  it('affiche le bouton Rouvrir sur les comptes clôturés et rouvre après clic', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/accounts', () =>
        HttpResponse.json([
          {
            ...{
              id: 1,
              name: 'Compte test',
              bank_id: 1,
              bank: 'BNP',
              account_type_id: 1,
              type: 'Courant',
              is_investment: 0,
              initial_balance: 0,
              opening_date: '2024-01-01',
              closed_at: '2025-01-01',
              balance: 0,
              balance_stocks: 0,
            },
          },
        ]),
      ),
    );
    renderAccountsPage();

    // Développe la section des comptes clôturés
    const toggle = await screen.findByRole('button', { name: /comptes clôturés/i });
    await user.click(toggle);

    // Le bouton Rouvrir est présent
    const reopenBtn = await screen.findByTitle(/rouvrir le compte/i);
    await user.click(reopenBtn);

    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toMatch(/réouvert/i);
    });
  });
});

describe('AccountsPage - favoris', () => {
  const withFavorites = () =>
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

  it("masque la section Favoris s'il n'y a aucun favori", async () => {
    renderAccountsPage();
    await screen.findByText('BNP');
    expect(screen.queryByText('Favoris')).not.toBeInTheDocument();
  });

  it("affiche la section Favoris dans l'ordre et garde les comptes dans leur groupe", async () => {
    withFavorites();
    renderAccountsPage();
    await screen.findByText('Favoris');
    const links = screen.getAllByRole('link', { name: /Voir les transactions/ });
    expect(links[0]).toHaveAccessibleName(/Livret A/);
    expect(links[1]).toHaveAccessibleName(/Compte test/);
    expect(screen.getAllByText('Livret A')).toHaveLength(2);
  });

  it('affiche une étoile non remplie et ajoute aux favoris au clic', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    server.use(
      http.put('/api/accounts/:id/favorite', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ACCOUNTS[0], favorite_order: 0 });
      }),
    );
    renderAccountsPage();
    await screen.findByText('BNP');
    const stars = screen.getAllByRole('button', { name: 'Mettre en favori' });
    await user.click(stars[0]);
    await waitFor(() => expect(body).toEqual({ favorite: true }));
  });

  it('retire des favoris au clic sur une étoile remplie', async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    withFavorites();
    server.use(
      http.put('/api/accounts/:id/favorite', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ACCOUNTS[1], favorite_order: null });
      }),
    );
    renderAccountsPage();
    await screen.findByText('Favoris');
    await user.click(screen.getAllByRole('button', { name: 'Retirer des favoris' })[0]);
    await waitFor(() => expect(body).toEqual({ favorite: false }));
  });

  it("affiche un toast d'erreur si le basculement échoue", async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/accounts/:id/favorite', () =>
        HttpResponse.json({ error: 'Refusé' }, { status: 409 }),
      ),
    );
    renderAccountsPage();
    await screen.findByText('BNP');
    await user.click(screen.getAllByRole('button', { name: 'Mettre en favori' })[0]);
    expect(await screen.findByText('Refusé')).toBeInTheDocument();
  });

  it('expose une poignée de réordonnancement par favori', async () => {
    withFavorites();
    renderAccountsPage();
    await screen.findByText('Favoris');
    expect(screen.getAllByRole('button', { name: /Réordonner le favori/ })).toHaveLength(2);
  });

  it("n'affiche pas d'étoile sur un compte clôturé", async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/accounts', () =>
        HttpResponse.json([{ ...ACCOUNTS[0], closed_at: '2025-01-01' }]),
      ),
    );
    renderAccountsPage();
    await user.click(await screen.findByRole('button', { name: /Comptes clôturés/ }));
    await screen.findByText('Compte test');
    expect(screen.queryByRole('button', { name: 'Mettre en favori' })).not.toBeInTheDocument();
  });
});
