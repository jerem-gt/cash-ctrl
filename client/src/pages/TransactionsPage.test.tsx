import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { TransactionsPage } from './TransactionsPage';

describe('TransactionsPage', () => {
  it("affiche le titre et le bouton d'ajout", () => {
    renderWithProviders(<TransactionsPage />);
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nouvelle transaction/i })).toBeInTheDocument();
  });

  it('affiche les transactions après le chargement', async () => {
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it('affiche le compteur de transactions', async () => {
    renderWithProviders(<TransactionsPage />);
    await waitFor(() => expect(screen.getByText('1 transaction(s)')).toBeInTheDocument());
  });

  it('affiche les filtres de catégorie, de sous-catégorie et de type', async () => {
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    expect(screen.getByText('Toutes catégories')).toBeInTheDocument();
    expect(screen.getByText('Toutes sous-catégories')).toBeInTheDocument();
    expect(screen.getByText('Tous types')).toBeInTheDocument();
  });

  it('ouvre le modal de création au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: /nouvelle transaction/i }));
    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it("ouvre le modal d'édition au clic sur ✎", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '✎' }));
    expect(screen.getByText('Modifier la transaction')).toBeInTheDocument();
  });

  it('ouvre le modal de duplication au clic sur ⧉', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '⧉' }));
    expect(screen.getByText('Dupliquer la transaction')).toBeInTheDocument();
  });

  it('ouvre le modal de suppression au clic sur ×', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(screen.getByText(/supprimer/i)).toBeInTheDocument();
  });

  it('filtre par type (Dépenses)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    const selectType = screen.getByRole('combobox', { name: /choisir un type/i });
    await user.selectOptions(selectType, 'expense');
    expect(selectType).toHaveValue('expense');
  });

  it('filtre par catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    const selectCategorie = screen.getByRole('combobox', { name: /choisir une catégorie/i });
    await user.selectOptions(selectCategorie, '1');
    expect(selectCategorie).toHaveValue('1');
  });

  it('filtre par sous-catégorie non accessible si pas de catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    const selectCategorie = screen.getByRole('combobox', { name: /choisir une catégorie/i });
    await user.selectOptions(selectCategorie, '');
    const selectSousCategorie = screen.getByRole('combobox', {
      name: /choisir une sous-catégorie/i,
    });
    expect(selectSousCategorie).toBeDisabled();
  });

  it('filtre par sous-catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    // On sélectionne déjà un item dans les catégories
    const selectCategorie = screen.getByRole('combobox', { name: /choisir une catégorie/i });
    await user.selectOptions(selectCategorie, '1');
    // Puis une sous-catégorie
    const selectSousCategorie = screen.getByRole('combobox', {
      name: /choisir une sous-catégorie/i,
    });
    await user.selectOptions(selectSousCategorie, '1');
    expect(selectSousCategorie).toHaveValue('1');
  });

  it("confirme la suppression d'une transaction", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '×' }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("soumet le formulaire d'édition d'une transaction", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: '✎' }));
    await screen.findByText('Modifier la transaction');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('modifiée'),
    );
  });
});
