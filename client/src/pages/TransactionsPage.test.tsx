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
});
