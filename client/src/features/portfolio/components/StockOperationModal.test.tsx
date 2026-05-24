import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { StockOperationModal } from '@/features/portfolio/components/StockOperationModal';
import { STOCK_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const position = STOCK_POSITIONS[0];

function renderBuy(onClose = vi.fn()) {
  return renderWithProviders(<StockOperationModal mode="buy" accountId={3} onClose={onClose} />);
}

function renderSell(onClose = vi.fn()) {
  return renderWithProviders(
    <StockOperationModal mode="sell" accountId={3} position={position} onClose={onClose} />,
  );
}

describe('StockOperationModal — achat', () => {
  it("affiche le formulaire d'achat", () => {
    renderBuy();
    expect(screen.getByText('Acheter des actions')).toBeInTheDocument();
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument();
  });

  it('calcule le total dynamiquement', async () => {
    const user = userEvent.setup();
    renderBuy();

    await user.type(screen.getByLabelText(/ticker/i), 'DCAM.PA');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '10');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12');
    // fees default 0 → total = 10*12 = 120
    await waitFor(() => expect(screen.getByText(/120/)).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBuy(onClose);

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
    renderBuy();

    await user.type(screen.getByLabelText(/ticker/i), 'DCAM.PA');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '10');
    await user.type(screen.getByLabelText(/prix unitaire/i), '12');
    await user.click(screen.getByRole('button', { name: /acheter/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('Erreur'));
  });

  it('désactive le bouton Acheter si les champs sont vides', () => {
    renderBuy();
    expect(screen.getByRole('button', { name: /acheter/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBuy(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('StockOperationModal — vente', () => {
  it('affiche le formulaire de vente avec le ticker pré-rempli', () => {
    renderSell();
    expect(screen.getByText('Vendre des actions')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DCAM.PA')).toBeInTheDocument();
  });

  it('pré-remplit le prix avec le cours actuel', () => {
    renderSell();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
  });

  it('calcule le montant net dynamiquement', async () => {
    const user = userEvent.setup();
    renderSell();

    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    // price = 15 (pré-rempli), fees = 0 → net = 5*15 - 0 = 75
    await waitFor(() => expect(screen.getByText(/75/)).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSell(onClose);

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
    renderSell();

    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await user.click(screen.getByRole('button', { name: /vendre/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Position'),
    );
  });

  it('désactive le bouton Vendre si la quantité est vide', () => {
    renderSell();
    expect(screen.getByRole('button', { name: /vendre/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSell(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
