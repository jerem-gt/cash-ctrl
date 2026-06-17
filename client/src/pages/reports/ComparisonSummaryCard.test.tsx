import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ComparisonSummaryCard } from './ComparisonSummaryCard';

const BASE_PROPS = {
  year: 2026,
  compareYear: 2025,
  incomeTotal: 3000,
  expenseTotal: 1200,
  bilan: 1800,
  compareReport: { income_total: 2500, expense_total: 1000 },
};

describe('ComparisonSummaryCard', () => {
  it('affiche les 3 lignes : Revenus, Dépenses, Bilan', () => {
    render(<ComparisonSummaryCard {...BASE_PROPS} />);
    expect(screen.getByText('Revenus')).toBeInTheDocument();
    expect(screen.getByText('Dépenses')).toBeInTheDocument();
    expect(screen.getByText('Bilan')).toBeInTheDocument();
  });

  it('affiche les deux années en en-tête', () => {
    render(<ComparisonSummaryCard {...BASE_PROPS} />);
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('colore en text-success un delta de revenus positif', () => {
    // income: 3000 vs 2500 → delta +500 → positiveIsGood=true → text-success
    render(<ComparisonSummaryCard {...BASE_PROPS} />);
    const cells = screen.getAllByRole('cell');
    const successCell = cells.find((el) => el.className.includes('text-success'));
    expect(successCell).toBeDefined();
  });

  it('colore en text-danger un delta de dépenses positif (plus de dépenses = mauvais)', () => {
    // expense: 1200 vs 1000 → delta +200 → positiveIsGood=false → text-danger
    render(<ComparisonSummaryCard {...BASE_PROPS} />);
    const cells = screen.getAllByRole('cell');
    const dangerCell = cells.find((el) => el.className.includes('text-danger'));
    expect(dangerCell).toBeDefined();
  });
});
