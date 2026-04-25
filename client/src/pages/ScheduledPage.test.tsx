import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { ScheduledPage } from './ScheduledPage';

describe('ScheduledPage', () => {
  it('affiche le titre', () => {
    renderWithProviders(<ScheduledPage />);
    expect(screen.getByText('Transactions planifiées')).toBeInTheDocument();
  });

  it("affiche le paramètre de délai d'anticipation", async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText("Délai d'anticipation");
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('affiche la planification chargée', async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    expect(screen.getByText('Loyer')).toBeInTheDocument();
  });

  it('affiche le label de récurrence', async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    expect(screen.getByText(/chaque mois/i)).toBeInTheDocument();
  });

  it('affiche "Aucune planification" quand la liste est vide', async () => {
    server.use(http.get('/api/scheduled', () => HttpResponse.json([])));
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Aucune planification.');
  });

  it('ouvre le modal de création au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
  });
});
