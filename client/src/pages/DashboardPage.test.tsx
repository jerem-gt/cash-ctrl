import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import DashboardPage from '@/pages/DashboardPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

describe('DashboardPage', () => {
  it('affiche le squelette pendant le chargement des stats', () => {
    server.use(http.get('/api/stats', () => new Promise<never>(() => {})));
    renderWithProviders(<DashboardPage />);
    expect(screen.queryByText('Tableau de bord')).not.toBeInTheDocument();
    expect(screen.queryByText('Solde total')).not.toBeInTheDocument();
  });

  it('affiche le titre et le sous-titre', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument();
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
    expect(await screen.findByText('3 compte(s)')).toBeInTheDocument();
  });

  it('affiche le titre de la section des dernières transactions', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Dernières transactions validées')).toBeInTheDocument();
  });

  it(`affiche "Aucune dépense ce mois" dans le graphe camembert si vide`, async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Aucune dépense ce mois')).toBeInTheDocument();
  });

  it(`affiche "Aucune transaction" dans la section validées si vide`, async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Aucune transaction')).toBeInTheDocument();
  });

  it(`affiche la section "À venir" quand des transactions upcoming existent`, async () => {
    server.use(
      http.get('/api/stats', () =>
        HttpResponse.json({
          month_income: 0,
          month_expense: 0,
          monthly: [],
          expenses_by_category: [],
          recent: [],
          to_validate: [],
          upcoming: [
            {
              id: 99,
              account_id: 1,
              type: 'expense',
              amount: 800,
              description: 'Loyer à venir',
              category_id: 1,
              subcategory_id: 1,
              category: 'Logement',
              subcategory: 'Loyer',
              date: '2030-01-01',
              transfer_peer_id: null,
              scheduled_id: 1,
              validated: 0,
              payment_method_id: 1,
              payment_method: 'Virement',
              notes: null,
              reimbursement_status: null,
              loan_principal: null,
            },
          ],
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('À venir')).toBeInTheDocument();
    expect(screen.getByText('Loyer à venir')).toBeInTheDocument();
  });

  it(`affiche le graphique "Répartition du patrimoine" quand balanceHistory a des données`, async () => {
    server.use(
      http.get('/api/stats/balance-history', () =>
        HttpResponse.json({
          account_types: ['liquidites', 'epargne'],
          data: [
            { year: '2025', liquidites: 1500, epargne: 500 },
            { year: '2026', liquidites: 2000, epargne: 600 },
          ],
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Répartition du patrimoine')).toBeInTheDocument();
    expect(screen.getByText('Liquidités')).toBeInTheDocument();
    expect(screen.getByText('Épargne')).toBeInTheDocument();
  });
});
