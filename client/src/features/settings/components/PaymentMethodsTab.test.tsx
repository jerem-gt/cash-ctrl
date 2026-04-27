import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { PaymentMethodsTab } from '@/features/settings';
import { PAYMENT_METHODS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

describe('PaymentMethodsTab', () => {
  it('affiche la section', async () => {
    renderWithProviders(<PaymentMethodsTab />);
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
  });

  it('affiche les moyens de paiement chargés', async () => {
    renderWithProviders(<PaymentMethodsTab />);
    expect(await screen.findByText('CB')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un moyen de paiement avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("soumet le formulaire d'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const nameInput = screen.getByDisplayValue('CB');
    await user.clear(nameInput);
    await user.type(nameInput, 'Carte bancaire');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("annule l'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('CB')).toBeInTheDocument();
  });

  it('PaymentMethodRow : affiche le bouton Modifier seul et ouvre le formulaire quand tx_count > 0', async () => {
    server.use(
      http.get('/api/payment-methods', () =>
        HttpResponse.json([{ ...PAYMENT_METHODS[0], tx_count: 2 }]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('PaymentMethodRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/payment-methods/:id', () =>
        HttpResponse.json({ error: 'Erreur PM' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur PM'),
    );
  });

  it("toast si l'ajout d'un moyen de paiement échoue", async () => {
    server.use(
      http.post('/api/payment-methods', () =>
        HttpResponse.json({ error: 'Erreur ajout PM' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsTab />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout PM'),
    );
  });
});
