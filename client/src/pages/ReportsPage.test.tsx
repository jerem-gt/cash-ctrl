import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ReportsPage from '@/pages/ReportsPage';
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
