import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import TransactionsPage from '@/pages/TransactionsPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

describe('TransactionsPage', () => {
  it('affiche les transactions après le chargement', async () => {
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it('affiche le compteur de transactions', async () => {
    renderWithProviders(<TransactionsPage />);
    await waitFor(() => expect(screen.getByText('1 transaction(s)')).toBeInTheDocument());
  });

  it("soumet le formulaire d'édition d'une transaction (intégration page → modal → API)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />);
    await screen.findByText('Courses');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Modifier la transaction');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('modifiée'),
    );
  });
});
