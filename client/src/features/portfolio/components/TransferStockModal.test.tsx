import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransferStockModal } from '@/features/portfolio/components/TransferStockModal';
import {
  ACCOUNTS,
  INVESTMENT_ACCOUNT,
  INVESTMENT_ACCOUNT_2,
  STOCK_POSITIONS,
} from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const position = STOCK_POSITIONS[0]; // account_id: 3, ticker: DCAM.PA, quantity: 10
// accountId=3 → PEA filtré (même compte), CTO (id 5) visible
const accountsWithInvestment = [...ACCOUNTS, INVESTMENT_ACCOUNT, INVESTMENT_ACCOUNT_2];

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <TransferStockModal accountId={3} position={position} onClose={onClose} />,
  );
}

describe('TransferStockModal', () => {
  beforeEach(() => {
    server.use(http.get('/api/accounts', () => HttpResponse.json(accountsWithInvestment)));
  });

  it('affiche le ticker et le PRU', () => {
    renderModal();
    expect(screen.getByText('Transférer des titres')).toBeInTheDocument();
    expect(screen.getByText('DCAM.PA')).toBeInTheDocument();
    expect(screen.getByText(/conservé/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur de compte destination sans le compte source', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByLabelText(/compte destination/i)).toBeInTheDocument());
    expect(screen.getByText('CTO')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PEA' })).not.toBeInTheDocument();
  });

  it('affiche un message quand aucun autre compte investissement disponible', async () => {
    server.use(http.get('/api/accounts', () => HttpResponse.json([])));
    renderModal();
    await waitFor(() =>
      expect(screen.getByText(/Aucun autre compte d'investissement/i)).toBeInTheDocument(),
    );
  });

  it('désactive le bouton Transférer quand la quantité est vide', async () => {
    renderModal();
    // Attendre que les comptes soient chargés (selector visible)
    await waitFor(() => screen.getByLabelText(/compte destination/i));
    expect(screen.getByRole('button', { name: /transférer/i })).toBeDisabled();
  });

  it('désactive le bouton Transférer quand la quantité dépasse le max', async () => {
    const user = userEvent.setup();
    renderModal();
    await waitFor(() => screen.getByLabelText(/compte destination/i));

    await user.type(screen.getByLabelText(/nombre d'actions/i), '999');
    expect(screen.getByRole('button', { name: /transférer/i })).toBeDisabled();
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    const select = await screen.findByLabelText(/compte destination/i);
    await user.selectOptions(select, '5'); // sélectionner CTO (id=5) explicitement
    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await user.click(screen.getByRole('button', { name: /transférer/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('Transfert');
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/stocks/:accountId/transfer', () =>
        HttpResponse.json({ error: 'Quantité insuffisante' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    const select = await screen.findByLabelText(/compte destination/i);
    await user.selectOptions(select, '5');
    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await user.click(screen.getByRole('button', { name: /transférer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Quantité'),
    );
  });

  it('présélectionne le seul compte destination disponible sans sélection manuelle', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await waitFor(() => screen.getByLabelText(/compte destination/i));
    await user.type(screen.getByLabelText(/nombre d'actions/i), '5');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /transférer/i })).not.toBeDisabled(),
    );

    await user.click(screen.getByRole('button', { name: /transférer/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
