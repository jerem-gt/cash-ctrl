import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ForecastCard } from '@/features/scheduled/components/ForecastCard';
import { ACCOUNTS, FORECAST_RESPONSE } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderCard(selected: number | 'all' = 'all', onSelect = vi.fn()) {
  return {
    onSelect,
    ...renderWithProviders(
      <ForecastCard accounts={ACCOUNTS} logoMap={{}} selected={selected} onSelect={onSelect} />,
    ),
  };
}

describe('ForecastCard', () => {
  it('affiche le titre, les chips de comptes et le sélecteur d’horizon', async () => {
    renderCard();
    expect(await screen.findByText('Solde projeté')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Compte test/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Livret A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 j' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 j' })).toBeInTheDocument();
  });

  it('sélectionne automatiquement le compte avec le goes_negative_on le plus proche', async () => {
    const onSelect = vi.fn();
    renderCard('all', onSelect);
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(1));
  });

  it('appelle onSelect au clic sur un chip de compte', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCard('all', onSelect);
    const chip = await screen.findByRole('button', { name: /Livret A/i });
    await user.click(chip);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("affiche un message quand aucun compte n'est sélectionné", async () => {
    renderCard('all');
    expect(await screen.findByText(/Sélectionnez un compte/)).toBeInTheDocument();
  });

  it("n'affiche pas de message vide quand un compte est sélectionné", async () => {
    renderCard(1);
    await screen.findByRole('button', { name: /Compte test/i });
    expect(screen.queryByText(/Sélectionnez un compte/)).not.toBeInTheDocument();
  });

  it("affiche l'alerte de solde négatif pour le compte sélectionné", async () => {
    renderCard(1);
    expect(await screen.findByText(/Solde négatif prévu le/)).toBeInTheDocument();
  });

  it('change de période au clic sur "30 j" / "90 j"', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/stats/forecast', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(FORECAST_RESPONSE);
      }),
    );
    const user = userEvent.setup();
    renderCard();
    await screen.findByText('Solde projeté');
    await user.click(screen.getByRole('button', { name: '30 j' }));
    await waitFor(() => expect(capturedUrl).toContain('horizon=30'));
  });

  it("affiche un message quand aucun compte n'a de flux futur", async () => {
    server.use(
      http.get('/api/stats/forecast', () => HttpResponse.json({ horizon: 90, accounts: [] })),
    );
    renderCard();
    expect(await screen.findByText(/Aucun flux futur prévu/)).toBeInTheDocument();
  });
});
