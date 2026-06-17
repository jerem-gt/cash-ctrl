import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { buildCatComparison, CategoryComparisonCard } from './CategoryComparisonCard';

const MERGED_DATA = {
  expense: [{ category: 'Alimentation', current: 700, compare: 500, delta: 200 }],
  income: [{ category: 'Salaire', current: 3000, compare: 2800, delta: 200 }],
};

describe('buildCatComparison', () => {
  it('fusionne les catégories et calcule le delta', () => {
    const result = buildCatComparison(
      [{ category: 'Alimentation', amount: 700 }],
      [{ category: 'Alimentation', amount: 500 }],
    );
    expect(result).toEqual([{ category: 'Alimentation', current: 700, compare: 500, delta: 200 }]);
  });

  it('inclut les catégories absentes du courant (compare only)', () => {
    const result = buildCatComparison([], [{ category: 'Loisirs', amount: 300 }]);
    expect(result).toEqual([{ category: 'Loisirs', current: 0, compare: 300, delta: -300 }]);
  });
});

describe('CategoryComparisonCard', () => {
  it("bascule sur l'onglet Revenus", async () => {
    const setCatTab = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryComparisonCard
        catTab="expense"
        setCatTab={setCatTab}
        mergedCatData={MERGED_DATA}
        year={2026}
        compareYear={2025}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Revenus' }));
    expect(setCatTab).toHaveBeenCalledWith('income');
  });

  it('affiche text-success pour un delta négatif sur les dépenses', () => {
    render(
      <CategoryComparisonCard
        catTab="expense"
        setCatTab={vi.fn()}
        mergedCatData={{
          expense: [{ category: 'Alimentation', current: 300, compare: 500, delta: -200 }],
          income: [],
        }}
        year={2026}
        compareYear={2025}
      />,
    );
    const deltaTd = screen.getAllByRole('cell').find((el) => el.className.includes('text-success'));
    expect(deltaTd).toBeDefined();
  });
});
