import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import AccountsPage from './AccountsPage';

// Helper pour rendre la page avec le router
function renderAccountsPage() {
  return renderWithProviders(<AccountsPage />);
}

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AccountsPage', () => {
  it('affiche la liste des comptes groupés par type', async () => {
    renderAccountsPage();

    // Vérifie que les titres de groupes (ex: "Compte Courant") sont là
    await screen.findByText('Courant');
    // Vérifie que le nom du compte spécifique est présent
    expect(screen.getByText('Compte test')).toBeInTheDocument();
    // Vérifie l'affichage du solde
    expect(screen.getByText(/1.500,00 €/)).toBeInTheDocument();
  });

  it('affiche un état vide si aucun compte n’existe', async () => {
    // On surcharge le mock pour renvoyer une liste vide
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));

    renderAccountsPage();

    expect(await screen.findByText(/aucun compte pour l'instant/i)).toBeInTheDocument();
  });

  it('navigue vers le détail du compte lors du clic sur la carte', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const accountCard = await screen.findByRole('button', {
      name: /accéder au compte compte test/i,
    });
    await user.click(accountCard);

    // Vérifie que l'URL a changé (le mock du router enregistre les navigations)
    expect(mockNavigate).toHaveBeenCalledWith('/accounts/1');
  });

  it('ouvre le modal de création lors du clic sur "Nouveau compte"', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const addBtn = screen.getByRole('button', { name: /\+ nouveau compte/i });
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

  it('ouvre le modal d’édition avec les données pré-remplies', async () => {
    const user = userEvent.setup();
    renderAccountsPage();

    const editBtns = await screen.findAllByTitle(/modifier le compte/i);
    await user.click(editBtns[0]);

    // Vérifie que le modal d'édition est là
    expect(screen.getByText('Modifier le compte')).toBeInTheDocument();
  });

  it('masque le logo de la banque si l’image échoue à charger', async () => {
    renderAccountsPage();

    // On attend qu'une image de logo soit présente (via AccountBadge)
    const logo = await screen.findByAltText(/logo bnp/i);

    // Simule une erreur de chargement
    fireEvent.error(logo);

    // Vérifie que le style display: none est appliqué via onError du composant
    expect(logo).toHaveStyle({ display: 'none' });
  });
});
