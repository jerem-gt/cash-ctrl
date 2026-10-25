import { describe, expect, it } from 'vitest';

import { generateColor } from '@/lib/colors';
import { CATEGORIES } from '@/tests/fixtures';

import { distinctSplitCategories, resolveSplitParts } from './splitParts';

describe('resolveSplitParts', () => {
  it('résout catégorie, icône, sous-catégorie, montant et couleur', () => {
    const parts = resolveSplitParts(
      [
        { id: 7, subcategory_id: 2, amount: 10 },
        { id: 8, subcategory_id: 1, amount: 5.5 },
      ],
      CATEGORIES,
    );
    expect(parts).toEqual([
      {
        splitId: 7,
        categoryId: 2,
        categoryName: 'Logement',
        categoryIcon: '🏠',
        subcategoryName: 'Loyer',
        amount: 10,
        color: generateColor(2),
      },
      {
        splitId: 8,
        categoryId: 1,
        categoryName: 'Alimentation',
        categoryIcon: '🍴',
        subcategoryName: 'Supermarché',
        amount: 5.5,
        color: generateColor(1),
      },
    ]);
  });

  it('ignore les lignes dont la sous-catégorie est introuvable', () => {
    const parts = resolveSplitParts(
      [
        { id: 1, subcategory_id: 999, amount: 3 },
        { id: 2, subcategory_id: 1, amount: 4 },
      ],
      CATEGORIES,
    );
    expect(parts).toHaveLength(1);
    expect(parts[0].subcategoryName).toBe('Supermarché');
  });

  it('renvoie une liste vide sans catégories', () => {
    expect(resolveSplitParts([{ id: 1, subcategory_id: 1, amount: 1 }], [])).toEqual([]);
  });
});

describe('distinctSplitCategories', () => {
  it("garde une entrée par catégorie dans l'ordre des lignes", () => {
    const parts = resolveSplitParts(
      [
        { id: 1, subcategory_id: 2, amount: 1 },
        { id: 2, subcategory_id: 1, amount: 1 },
        { id: 3, subcategory_id: 2, amount: 1 },
      ],
      CATEGORIES,
    );
    expect(distinctSplitCategories(parts).map((p) => p.categoryId)).toEqual([2, 1]);
  });
});
