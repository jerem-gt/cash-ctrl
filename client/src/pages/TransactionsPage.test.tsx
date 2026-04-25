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

  it('affiche les filtres de catégorie et de type', async () => {
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    expect(screen.getByText('Toutes catégories')).toBeInTheDocument();
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
    // Le select de type est le dernier <select> de la page
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[selects.length - 1], 'expense');
    expect(screen.getAllByRole('combobox')[selects.length - 1]).toHaveValue('expense');
  });

  it('filtre par catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    const selects = screen.getAllByRole('combobox');
    // Le select de catégorie est l'avant-dernier <select>
    await user.selectOptions(selects[selects.length - 2], '1');
    expect(selects[selects.length - 2]).toHaveValue('1');
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
