import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { BuyStockModal } from '@/components/BuyStockModal';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(<BuyStockModal accountId={3} onClose={onClose} />);
}

describe('BuyStockModal', () => {
  it("affiche le formulaire d'achat", () => {
    renderModal();
    expect(screen.getByText('Acheter des actions')).toBeInTheDocument();
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument();
  });

  it('calcule le total dynamiquement', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/ticker/i), 'DCAM.PA');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '10');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12');
    // fees default 0 → total = 10*12 = 120
    await waitFor(() => expect(screen.getByText(/120/)).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/ticker/i), 'DCAM.PA');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '10');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12');
    await user.click(screen.getByRole('button', { name: /acheter/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('Achat');
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/stocks/:accountId/buy', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/ticker/i), 'DCAM.PA');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '10');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12');
    await user.click(screen.getByRole('button', { name: /acheter/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('Erreur'));
  });

  it('désactive le bouton Acheter si les champs sont vides', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /acheter/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
