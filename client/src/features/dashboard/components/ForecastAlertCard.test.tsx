import type { ForecastAccount } from '@cashctrl/types';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ForecastAlertCard } from '@/features/dashboard/components/ForecastAlertCard';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const ALERTS: ForecastAccount[] = [
  {
    account_id: 1,
    account_name: 'Compte test',
    bank_id: 1,
    current_balance: 1500,
    points: [
      { date: '2026-07-07', balance: 1500 },
      { date: '2026-08-15', balance: -200 },
    ],
    goes_negative_on: '2026-08-15',
  },
];

describe('ForecastAlertCard', () => {
  it('affiche le titre et le message par compte concerné', () => {
    renderWithProviders(<ForecastAlertCard alerts={ALERTS} />);
    expect(screen.getByText('Découvert prévisionnel')).toBeInTheDocument();
    expect(screen.getByText(/Compte test en négatif prévu le/)).toBeInTheDocument();
  });

  it('affiche le solde projeté à la date de découvert', () => {
    renderWithProviders(<ForecastAlertCard alerts={ALERTS} />);
    expect(screen.getByText(/-200/)).toBeInTheDocument();
  });

  it('pointe vers la page des planifications', () => {
    renderWithProviders(<ForecastAlertCard alerts={ALERTS} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/scheduled');
  });

  it('affiche une ligne par compte concerné', () => {
    renderWithProviders(
      <ForecastAlertCard
        alerts={[
          ...ALERTS,
          {
            account_id: 2,
            account_name: 'Livret A',
            bank_id: 2,
            current_balance: 300,
            points: [{ date: '2026-09-01', balance: -50 }],
            goes_negative_on: '2026-09-01',
          },
        ]}
      />,
    );
    expect(screen.getByText(/Compte test en négatif prévu le/)).toBeInTheDocument();
    expect(screen.getByText(/Livret A en négatif prévu le/)).toBeInTheDocument();
  });
});
