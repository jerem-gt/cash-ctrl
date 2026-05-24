import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { PAYMENT_METHODS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { PaymentMethodsManager } from './PaymentMethodsManager';

describe('PaymentMethodsManager', () => {
  it('affiche le squelette pendant le chargement des moyens de paiement', () => {
    server.use(http.get('/api/payment-methods', () => new Promise<never>(() => {})));
    renderWithProviders(<PaymentMethodsManager />);
    expect(screen.queryByText('CB')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche la section', async () => {
    renderWithProviders(<PaymentMethodsManager />);
    expect(await screen.findByText('Moyens de paiement')).toBeInTheDocument();
  });

  it('affiche les moyens de paiement chargés', async () => {
    renderWithProviders(<PaymentMethodsManager />);
    expect(await screen.findByText('CB')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un moyen de paiement avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("soumet le formulaire d'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const nameInput = screen.getByDisplayValue('CB');
    await user.clear(nameInput);
    await user.type(nameInput, 'Carte bancaire');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("annule l'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('pas de bouton Supprimer dans le panneau quand tx_count > 0', async () => {
    server.use(
      http.get('/api/payment-methods', () =>
        HttpResponse.json([{ ...PAYMENT_METHODS[0], tx_count: 2 }]),
      ),
    );
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/payment-methods/:id', () =>
        HttpResponse.json({ error: 'Erreur PM' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
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
    renderWithProviders(<PaymentMethodsManager />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout PM'),
    );
  });
});
