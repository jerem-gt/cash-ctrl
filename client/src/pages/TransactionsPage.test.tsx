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
    expect(await screen.findByText('1 transaction(s)')).toBeInTheDocument();
  });

  it("pré-remplit les champs de filtre depuis l'URL", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TransactionsPage />, {
      initialEntries: ['/transactions?q=cafe&type=income&amount_min=12.5'],
    });
    expect(screen.getByPlaceholderText(/libellé ou notes/i)).toHaveValue('cafe');
    expect(screen.getByLabelText(/choisir un type/i)).toHaveValue('income');
    await user.click(screen.getByRole('button', { name: /filtres avancés/i }));
    expect(screen.getByLabelText(/montant minimum/i)).toHaveValue('12.5');
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
