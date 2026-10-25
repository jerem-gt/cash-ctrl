import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { monthRange } from '@/features/transactions/lib/txLinks';
import DashboardPage from '@/pages/DashboardPage.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const UNVALIDATED_TX = {
  id: 20,
  account_id: 1,
  type: 'expense',
  amount: 12,
  description: 'À valider ici',
  category_id: 1,
  subcategory_id: 1,
  category: 'Alimentation',
  subcategory: 'Supermarché',
  date: '2026-04-20',
  transfer_peer_id: null,
  scheduled_id: null,
  validated: 0,
  payment_method_id: 1,
  payment_method: 'CB',
  notes: null,
  reimbursement_status: null,
  loan_principal: null,
};

describe('DashboardPage — liens vers les transactions', () => {
  const { date_from, date_to } = monthRange();
  const range = `date_from=${date_from}&date_to=${date_to}`;

  beforeEach(() => {
    server.use(
      http.get('/api/stats', () =>
        HttpResponse.json({
          month_income: 3000,
          month_expense: 1200,
          monthly: [],
          expenses_by_category: [
            { category_id: 3, category: 'Alimentation', amount: 700 },
            { category_id: null, category: '', amount: 500 },
          ],
          recent: [],
          to_validate: [UNVALIDATED_TX],
          upcoming: [],
        }),
      ),
    );
  });

  it('lie la légende du camembert à la catégorie du mois courant', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: 'Alimentation' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=3&${range}&validated=true&exclude_transfers=true`,
    );
  });

  it('lie le groupe sans catégorie à category_id=none', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: '—' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=none&${range}&validated=true&exclude_transfers=true`,
    );
  });

  it('lie les métriques Revenus et Dépenses au mois courant', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: /3\s?000/ })).toHaveAttribute(
      'href',
      `/transactions?type=income&${range}&validated=true&exclude_transfers=true`,
    );
    expect(screen.getByRole('link', { name: /1\s?200/ })).toHaveAttribute(
      'href',
      `/transactions?type=expense&${range}&validated=true&exclude_transfers=true`,
    );
  });

  it('lie « Voir tout » de la carte À valider aux non validées sans dates', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('link', { name: 'Voir tout' })).toHaveAttribute(
      'href',
      '/transactions?validated=false',
    );
  });
});

describe('DashboardPage', () => {
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

  it('affiche la section "Récent" quand des transactions récentes existent', async () => {
    server.use(
      http.get('/api/stats', () =>
        HttpResponse.json({
          month_income: 0,
          month_expense: 0,
          monthly: [],
          expenses_by_category: [],
          recent: [
            {
              id: 10,
              account_id: 1,
              type: 'expense',
              amount: 24.5,
              description: 'Courses',
              category_id: 1,
              subcategory_id: 1,
              category: 'Alimentation',
              subcategory: 'Supermarché',
              date: '2026-04-20',
              transfer_peer_id: null,
              scheduled_id: null,
              validated: 1,
              payment_method_id: 1,
              payment_method: 'CB',
              notes: null,
              reimbursement_status: null,
              loan_principal: null,
            },
          ],
          to_validate: [],
          upcoming: [],
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Dernières transactions validées')).toBeInTheDocument();
    expect(screen.getByText('Courses')).toBeInTheDocument();
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

  it('masque la section "Récent" quand il n\'y a aucune transaction récente', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Tableau de bord');
    expect(screen.queryByText('Dernières transactions validées')).toBeNull();
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
    expect((await screen.findAllByText('À venir')).length).toBeGreaterThan(0);
    expect(screen.getByText('Loyer à venir')).toBeInTheDocument();
  });

  // ─── Alerte de découvert prévisionnel ────────────────────────────────────

  it('affiche la carte de découvert prévisionnel quand un compte passe en négatif', async () => {
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText('Découvert prévisionnel')).toBeInTheDocument();
    expect(screen.getByText(/Compte test en négatif prévu le/)).toBeInTheDocument();
  });

  it("masque la carte de découvert prévisionnel quand aucun compte n'est concerné", async () => {
    server.use(
      http.get('/api/stats/forecast', () =>
        HttpResponse.json({
          horizon: 90,
          accounts: [
            {
              account_id: 1,
              account_name: 'Compte test',
              bank_id: 1,
              current_balance: 150000,
              points: [{ date: '2026-07-07', balance: 150000 }],
              goes_negative_on: null,
            },
          ],
        }),
      ),
    );
    renderWithProviders(<DashboardPage />);
    await screen.findByText('Tableau de bord');
    expect(screen.queryByText('Découvert prévisionnel')).not.toBeInTheDocument();
  });

  it('affiche la WealthCard avec les boutons de vue quand balanceHistory a des données', async () => {
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
    expect(await screen.findByText('Mon patrimoine')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solde net' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Répartition' })).toBeInTheDocument();
  });
});
