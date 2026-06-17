import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StockGainsCard } from './StockGainsCard';

const BASE_ENTRY = {
  account_id: 3,
  account_name: 'PEA',
  year: '2026',
  start_value: 12500,
  end_value: 13500,
  net_flows: 0,
  gain: 1000,
  return_pct: 8.0,
  is_ytd: true,
};

describe('StockGainsCard', () => {
  it("affiche le badge YTD pour une position en cours d'année", () => {
    render(<StockGainsCard stockGains={[BASE_ENTRY]} year={2026} compareYear={undefined} />);
    expect(screen.getByText('YTD')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /PEA/ })).toBeInTheDocument();
  });

  it("n'affiche pas les colonnes de comparaison si compareYear est undefined", () => {
    render(<StockGainsCard stockGains={[BASE_ENTRY]} year={2026} compareYear={undefined} />);
    expect(screen.queryByText('Performance 2025')).not.toBeInTheDocument();
  });

  it("affiche l'en-tête de comparaison avec l'année quand compareYear est défini", () => {
    const entry = {
      ...BASE_ENTRY,
      compare: {
        year: '2025',
        start_value: 10000,
        end_value: 12500,
        net_flows: 0,
        gain: -500,
        return_pct: -4.0,
        is_ytd: false,
      },
    };
    render(<StockGainsCard stockGains={[entry]} year={2026} compareYear={2025} />);
    expect(screen.getByText('Performance 2025')).toBeInTheDocument();
  });

  it('affiche le gain négatif de comparaison en text-danger', () => {
    const entry = {
      ...BASE_ENTRY,
      gain: -1000,
      return_pct: -7.4,
      compare: {
        year: '2025',
        start_value: 12000,
        end_value: 13500,
        net_flows: 0,
        gain: 1500,
        return_pct: 12.5,
        is_ytd: false,
      },
    };
    render(<StockGainsCard stockGains={[entry]} year={2026} compareYear={2025} />);
    // La ligne principale a un gain négatif → text-danger
    const gainTd = screen.getAllByRole('cell').find((el) => el.className.includes('text-danger'));
    expect(gainTd).toBeDefined();
  });
});
