import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('affiche le titre et le sous-titre', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument();
    expect(screen.getByText("Vue d'ensemble de vos finances")).toBeInTheDocument();
  });

  it('affiche les 4 métriques', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Solde total');
    expect(screen.getByText('Revenus ce mois')).toBeInTheDocument();
    expect(screen.getByText('Dépenses ce mois')).toBeInTheDocument();
    expect(screen.getByText('Bilan mensuel')).toBeInTheDocument();
  });

  it('affiche le solde total des comptes', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('1 compte(s)')).toBeInTheDocument();
  });

  it('affiche le titre de la section des dernières transactions', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Dernières transactions validées')).toBeInTheDocument();
  });

  it('affiche "Aucune dépense ce mois" dans le graphe camembert si vide', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Aucune dépense ce mois')).toBeInTheDocument();
  });

  it('affiche "Aucune transaction" dans la section validées si vide', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Aucune transaction')).toBeInTheDocument();
  });
});
