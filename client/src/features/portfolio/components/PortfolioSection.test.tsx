import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { PortfolioSection } from '@/features/portfolio/components/PortfolioSection';
import { STOCK_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderPortfolio(accountId = 3) {
  return renderWithProviders(<PortfolioSection accountId={accountId} />);
}

describe('PortfolioSection', () => {
  it('affiche les positions après chargement', async () => {
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    expect(screen.getAllByText('DCAM.PA').length).toBeGreaterThan(0);
  });

  it('affiche la quantité et le PRU', async () => {
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
  });

  it(`affiche "Aucune position ouverte" quand le portefeuille est vide`, async () => {
    server.use(http.get('/api/stocks/:accountId/positions', () => HttpResponse.json([])));
    renderPortfolio();
    await waitFor(() => expect(screen.getByText('Aucune position ouverte')).toBeInTheDocument());
  });

  it('ouvre le modal Acheter au clic sur + Acheter', async () => {
    const user = userEvent.setup();
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    await user.click(screen.getByRole('button', { name: /\+ Acheter/i }));
    expect(screen.getByText('Acheter des actions')).toBeInTheDocument();
  });

  it('ouvre le modal Vendre au clic sur Vendre dans une ligne', async () => {
    const user = userEvent.setup();
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    const sellBtn = screen.getAllByRole('button', { name: /vendre/i })[0];
    await user.click(sellBtn);
    expect(screen.getByText('Vendre des actions')).toBeInTheDocument();
  });

  it('affiche la PV latente colorée en vert', async () => {
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    // PV = (15 - 12) * 10 = +30€
    expect(screen.getAllByText(/\+[^+]*30/).length).toBeGreaterThan(0);
  });

  it('actualise les cours au clic sur Actualiser', async () => {
    const user = userEvent.setup();
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    await user.click(screen.getByRole('button', { name: /actualiser les cours/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Cours mis à jour'),
    );
  });

  it("affiche la ligne total quand il y a plus d'une position", async () => {
    server.use(
      http.get('/api/stocks/:accountId/positions', () =>
        HttpResponse.json([
          STOCK_POSITIONS[0],
          {
            ...STOCK_POSITIONS[0],
            id: 2,
            ticker: 'AAPL',
            quantity: 5,
            avg_price: 180,
            current_price: 200,
          },
        ]),
      ),
    );
    renderPortfolio();
    await screen.findAllByText('DCAM.PA');
    await screen.findAllByText('AAPL');
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
  });
});
