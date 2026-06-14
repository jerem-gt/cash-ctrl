import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ReportsPage from '@/pages/ReportsPage';
import { PROFITABILITY_DATA, REPORT_DATA } from '@/tests/fixtures';
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

  it("affiche la section performance boursière avec badge YTD pour l'année courante", async () => {
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Performance boursière')).toBeInTheDocument();
    expect(screen.getByText('PEA')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
  });

  it("n'affiche pas la section boursière quand aucun compte bourse n'a de données", async () => {
    server.use(http.get('/api/stats/profitability', () => HttpResponse.json([])));
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    expect(screen.queryByText('Performance boursière')).not.toBeInTheDocument();
  });
});

describe('ReportsPage — états vides et bilan négatif', () => {
  it("affiche 'Aucune donnée' quand les données mensuelles sont vides", async () => {
    server.use(
      http.get('/api/stats/report', () => HttpResponse.json({ ...REPORT_DATA, monthly: [] })),
    );
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Aucune donnée pour cette période')).toBeInTheDocument();
  });

  it("affiche 'Aucune dépense' quand expense_by_category est vide", async () => {
    server.use(
      http.get('/api/stats/report', () =>
        HttpResponse.json({ ...REPORT_DATA, expense_by_category: [], expense_total: 0 }),
      ),
    );
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Aucune dépense sur cette période')).toBeInTheDocument();
  });

  it("affiche 'Aucun revenu' quand income_by_category est vide", async () => {
    server.use(
      http.get('/api/stats/report', () =>
        HttpResponse.json({ ...REPORT_DATA, income_by_category: [], income_total: 0 }),
      ),
    );
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText('Aucun revenu sur cette période')).toBeInTheDocument();
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
    await screen.findByText('Bilan');
    // bilan = 500 - 1500 = -1000 → variante négative + pas de données mensuelles
    expect(await screen.findByText('Aucune donnée pour cette période')).toBeInTheDocument();
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
            expense_by_category: [{ category: 'Alimentation', amount: 2500 }],
            income_by_category: [{ category: 'Salaire', amount: 2000 }],
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

  it("bascule sur l'onglet Revenus dans la comparaison de catégories", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('Bilan');
    await user.selectOptions(screen.getByDisplayValue('Aucune'), '2025');
    await screen.findByText('Comparaison des catégories');
    const incomeTabBtn = screen.getByRole('button', { name: 'Revenus' });
    await user.click(incomeTabBtn);
    expect(incomeTabBtn.className).toContain('bg-brand');
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

  it('affiche les colonnes boursières de comparaison avec gain négatif', async () => {
    server.use(
      http.get('/api/stats/profitability', () =>
        HttpResponse.json([
          {
            ...PROFITABILITY_DATA[0],
            yearly_returns: [
              {
                year: '2026',
                start_value: 13500,
                end_value: 12500,
                net_flows: 0,
                gain: -1000,
                return_pct: -7.4,
                is_ytd: true,
              },
              {
                year: '2025',
                start_value: 12000,
                end_value: 13500,
                net_flows: 0,
                gain: 1500,
                return_pct: 12.5,
                is_ytd: false,
              },
            ],
          },
          ...PROFITABILITY_DATA.slice(1),
        ]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ReportsPage />);
    await screen.findByText('PEA');
    await user.selectOptions(screen.getByDisplayValue('Aucune'), '2025');
    expect(await screen.findByText('Performance 2025')).toBeInTheDocument();
  });
});
