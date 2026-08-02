import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { AccountBalanceHistoryCard } from '@/features/accounts/components/AccountBalanceHistoryCard';
import { ACCOUNT_BALANCE_HISTORY, FORECAST_RESPONSE } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderCard(accountId = 1) {
  return renderWithProviders(<AccountBalanceHistoryCard accountId={accountId} />);
}

describe('AccountBalanceHistoryCard', () => {
  it('affiche le titre et le sélecteur de période', async () => {
    renderCard();
    expect(await screen.findByText('Solde')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 j' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 j' })).toBeInTheDocument();
  });

  it("affiche le passé seul, sans alerte, quand le compte n'a aucun flux futur", async () => {
    server.use(
      http.get('/api/stats/forecast', () => HttpResponse.json({ horizon: 90, accounts: [] })),
    );
    renderCard();
    await screen.findByText('Solde');
    expect(screen.queryByText(/prévu le/)).not.toBeInTheDocument();
  });

  it('affiche le passé + le projeté et alerte si le solde devient négatif', async () => {
    // Fixture par défaut : le compte 1 a un flux projeté (FORECAST_RESPONSE) qui passe négatif le 2026-08-15.
    renderCard(1);
    expect(await screen.findByText(/Solde négatif prévu le/)).toBeInTheDocument();
  });

  it("n'alerte pas sur un découvert passé résorbé, même si le futur reste positif", async () => {
    server.use(
      http.get('/api/stats/accounts/:accountId/balance-history', () =>
        HttpResponse.json({
          account_id: 1,
          days: 90,
          points: [
            { date: '2026-06-07', balance: -20000 },
            { date: '2026-06-20', balance: 10000 },
            { date: '2026-07-07', balance: 150000 },
          ],
        }),
      ),
      http.get('/api/stats/forecast', () =>
        HttpResponse.json({
          horizon: 90,
          accounts: [{ ...FORECAST_RESPONSE.accounts[0], goes_negative_on: null }],
        }),
      ),
    );
    renderCard(1);
    await screen.findByText('Solde');
    expect(screen.queryByText(/prévu le/)).not.toBeInTheDocument();
  });

  it('change de période au clic sur "30 j"', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/stats/accounts/:accountId/balance-history', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(ACCOUNT_BALANCE_HISTORY);
      }),
    );
    const user = userEvent.setup();
    renderCard();
    await screen.findByText('Solde');
    await user.click(screen.getByRole('button', { name: '30 j' }));
    await waitFor(() => expect(capturedUrl).toContain('days=30'));
  });
});
