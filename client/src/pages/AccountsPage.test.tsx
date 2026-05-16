import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setGroupBy } from '@/hooks/useAccountsGroupBy';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import AccountsPage from './AccountsPage';

function renderAccountsPage() {
  return renderWithProviders(<AccountsPage />);
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual };
});

beforeEach(() => {
  localStorage.clear();
  act(() => setGroupBy('bank'));
});

describe('AccountsPage', () => {
  it('affiche le squelette pendant le chargement des comptes', () => {
    server.use(http.get('/api/accounts', () => new Promise<never>(() => {})));
    renderAccountsPage();
    expect(screen.queryByText('BNP')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ nouveau compte/i })).not.toBeInTheDocument();
  });

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

  it(`ouvre le modal de création lors du clic sur "Nouveau compte"`, async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const addBtn = await screen.findByRole('button', { name: /\+ nouveau compte/i });
    await user.click(addBtn);

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

  it("masque le logo de la banque si l'image échoue à charger", async () => {
    renderAccountsPage();

    // On attend qu'une image de logo soit présente (via AccountBadge)
    const logo = await screen.findByAltText(/logo bnp/i);

    // Simule une erreur de chargement
    fireEvent.error(logo);

    // Vérifie que le style display: none est appliqué via onError du composant
    expect(logo).toHaveStyle({ display: 'none' });
  });
});
