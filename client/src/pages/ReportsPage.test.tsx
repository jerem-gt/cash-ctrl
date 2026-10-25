import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ReportsPage from '@/pages/ReportsPage';
import { REPORT_DATA } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

describe('ReportsPage', () => {
  it('affiche le titre et le sous-titre', async () => {
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Rapports')).toBeInTheDocument();
    expect(screen.getByText('Analyse de vos revenus et dépenses')).toBeInTheDocument();
  });

  it('affiche les 3 métriques avec les valeurs du rapport', async () => {
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Bilan')).toBeInTheDocument();
    expect(screen.getAllByText('Revenus').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dépenses').length).toBeGreaterThan(0);
  });

  it("n'affiche pas la section boursière quand aucun compte bourse n'a de données", async () => {
    server.use(http.get('/api/stats/profitability', () => HttpResponse.json([])));
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    expect(screen.queryByText('Performance boursière')).not.toBeInTheDocument();
  });

  it('affiche le bilan en variante négative quand les dépenses dépassent les revenus', async () => {
    server.use(
      http.get('/api/stats/report', () =>
        HttpResponse.json({
          ...REPORT_DATA,
          income_total: 500,
          expense_total: 1500,
          monthly: [],
        }),
      ),
    );
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Aucune donnée pour cette période')).toBeInTheDocument();
  });
});

describe('ReportsPage — liens vers les transactions', () => {
  const year = new Date().getFullYear();

  it('lie les catégories de dépenses et de revenus à la liste filtrée', async () => {
    server.use(
      http.get('/api/stats/report', () =>
        HttpResponse.json({
          ...REPORT_DATA,
          expense_by_category: [
            { category_id: 3, category: 'Alimentation', amount: 700 },
            { category_id: null, category: '', amount: 500 },
          ],
        }),
      ),
    );
    renderWithProviders(<ReportsPage />);
    const range = `date_from=${year}-01-01&date_to=${year}-12-31`;
    expect(await screen.findByRole('link', { name: 'Alimentation' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=3&${range}&validated=true&exclude_transfers=true`,
    );
    expect(screen.getByRole('link', { name: '—' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=none&${range}&validated=true&exclude_transfers=true`,
    );
    expect(screen.getByRole('link', { name: 'Revenus du travail' })).toHaveAttribute(
      'href',
      `/transactions?type=income&category_id=5&${range}&validated=true&exclude_transfers=true`,
    );
  });

  it('ajoute account_id aux liens quand un compte est filtré', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByRole('link', { name: 'Alimentation' });
    await user.click(screen.getByRole('button', { name: 'Tous les comptes' }));
    await user.click(await screen.findByRole('option', { name: /Livret A/ }));
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Alimentation' })).toHaveAttribute(
        'href',
        expect.stringContaining('account_id=2'),
      ),
    );
  });

  it("lie les lignes de la comparaison à l'année principale, sans lien hors de cette année", async () => {
    server.use(
      http.get('/api/stats/report', ({ request }) => {
        if (new URL(request.url).searchParams.get('year') === '2025') {
          return HttpResponse.json({
            ...REPORT_DATA,
            expense_by_category: [{ category_id: 9, category: 'Loisirs', amount: 300 }],
          });
        }
        return HttpResponse.json(REPORT_DATA);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    await user.selectOptions(screen.getByDisplayValue('Aucune'), '2025');
    const table = (await screen.findByText('Loisirs')).closest('table')!;
    expect(within(table).getByRole('link', { name: 'Alimentation' })).toHaveAttribute(
      'href',
      expect.stringContaining('category_id=3'),
    );
    expect(within(table).getByText('Loisirs')).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: 'Loisirs' })).toBeNull();
  });
});

describe('ReportsPage — comparaison annuelle', () => {
  it('affiche le récapitulatif et la comparaison de catégories avec delta non nul', async () => {
    server.use(
      http.get('/api/stats/report', ({ request }) => {
        const yr = new URL(request.url).searchParams.get('year');
        if (yr === '2025') {
          return HttpResponse.json({
            ...REPORT_DATA,
            income_total: 2000,
            expense_total: 2500,
            expense_by_category: [{ category_id: 3, category: 'Alimentation', amount: 2500 }],
            income_by_category: [{ category_id: 6, category: 'Salaire', amount: 2000 }],
          });
        }
        return HttpResponse.json(REPORT_DATA);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    await user.selectOptions(screen.getByDisplayValue('Aucune'), '2025');
    expect(await screen.findByText('Récapitulatif')).toBeInTheDocument();
    expect(await screen.findByText('Comparaison des catégories')).toBeInTheDocument();
  });

  it('réinitialise compareYear si on sélectionne la même année dans le filtre', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    await user.selectOptions(screen.getByDisplayValue('Aucune'), '2025');
    await screen.findByText('Récapitulatif');
    await user.selectOptions(screen.getByDisplayValue('2026'), '2025');
    await waitFor(() => expect(screen.queryByText('Récapitulatif')).not.toBeInTheDocument());
  });
});
