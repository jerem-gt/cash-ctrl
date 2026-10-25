import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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

  it("reprend categoryId de l'année principale, y compris null", () => {
    const result = buildCatComparison(
      [
        { category_id: 3, category: 'Alimentation', amount: 700 },
        { category_id: null, category: '', amount: 50 },
      ],
      [
        { category_id: 8, category: 'Alimentation', amount: 500 },
        { category_id: null, category: '', amount: 20 },
      ],
    );
    expect(result.find((r) => r.category === 'Alimentation')?.categoryId).toBe(3);
    expect(result.find((r) => r.category === '')?.categoryId).toBeNull();
  });

  it("laisse categoryId undefined pour une catégorie présente seulement dans l'année comparée", () => {
    const result = buildCatComparison([], [{ category_id: 9, category: 'Loisirs', amount: 300 }]);
    expect(result[0].categoryId).toBeUndefined();
  });

  it('inclut les catégories absentes du courant (compare only)', () => {
    const result = buildCatComparison([], [{ category: 'Loisirs', amount: 300 }]);
    expect(result).toEqual([{ category: 'Loisirs', current: 0, compare: 300, delta: -300 }]);
  });
});

describe('CategoryComparisonCard — liens', () => {
  const renderCard = (accountId?: number) =>
    render(
      <MemoryRouter>
        <CategoryComparisonCard
          catTab="expense"
          setCatTab={vi.fn()}
          mergedCatData={{
            expense: [
              { category: 'Alimentation', categoryId: 3, current: 700, compare: 500, delta: 200 },
              { category: '', categoryId: null, current: 50, compare: 0, delta: 50 },
              { category: 'Loisirs', categoryId: undefined, current: 0, compare: 300, delta: -300 },
            ],
            income: [],
          }}
          year={2026}
          compareYear={2025}
          accountId={accountId}
        />
      </MemoryRouter>,
    );

  it('lie une catégorie définie et une catégorie null (none) à la liste filtrée', () => {
    renderCard();
    const range = 'date_from=2026-01-01&date_to=2026-12-31';
    expect(screen.getByRole('link', { name: 'Alimentation' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=3&${range}&validated=true&exclude_transfers=true`,
    );
    expect(screen.getByRole('link', { name: '—' })).toHaveAttribute(
      'href',
      `/transactions?type=expense&category_id=none&${range}&validated=true&exclude_transfers=true`,
    );
  });

  it('affiche un texte simple quand categoryId est undefined', () => {
    renderCard();
    expect(screen.getByText('Loisirs')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Loisirs' })).toBeNull();
  });

  it('propage account_id dans les liens', () => {
    renderCard(2);
    expect(screen.getByRole('link', { name: 'Alimentation' })).toHaveAttribute(
      'href',
      expect.stringContaining('account_id=2'),
    );
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
