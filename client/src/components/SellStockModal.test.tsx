import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { SellStockModal } from '@/components/SellStockModal';
import { STOCK_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const position = STOCK_POSITIONS[0];

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <SellStockModal accountId={3} position={position} onClose={onClose} />,
  );
}

describe('SellStockModal', () => {
  it('affiche le formulaire de vente avec le ticker pré-rempli', () => {
    renderModal();
    expect(screen.getByText('Vendre des actions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DCAM.PA')).toBeInTheDocument();
  });

  it('pré-remplit le prix avec le cours actuel', () => {
    renderModal();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
  });

  it('calcule le montant net dynamiquement', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    // price = 15 (pré-rempli), fees = 0 → net = 5*15 - 0 = 75
    await waitFor(() => expect(screen.getByText(/75/)).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await user.click(screen.getByRole('button', { name: /vendre/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('Vente');
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/stocks/:accountId/sell', () =>
        HttpResponse.json({ error: 'Position insuffisante' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await user.click(screen.getByRole('button', { name: /vendre/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Position'),
    );
  });

  it('désactive le bouton Vendre si la quantité est vide', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /vendre/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
