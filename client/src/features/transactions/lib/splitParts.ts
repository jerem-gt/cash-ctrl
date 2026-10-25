import type { Category, TransactionSplit } from '@cashctrl/types';

import { generateColor } from '@/lib/colors';

export interface SplitPart {
  splitId: number;
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  subcategoryName: string;
  amount: number;
  color: string;
}

// Résout chaque ligne de ventilation en catégorie/sous-catégorie ; ignore les lignes introuvables.
export function resolveSplitParts(
  splits: readonly TransactionSplit[],
  categories: readonly Category[],
): SplitPart[] {
  const parts: SplitPart[] = [];
  for (const split of splits) {
    for (const category of categories) {
      const sub = category.subcategories.find((s) => s.id === split.subcategory_id);
      if (sub) {
        parts.push({
          splitId: split.id,
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          subcategoryName: sub.name,
          amount: split.amount,
          color: generateColor(category.id),
        });
        break;
      }
    }
  }
  return parts;
}

// Catégories distinctes, dans l'ordre d'apparition des lignes.
export function distinctSplitCategories(parts: readonly SplitPart[]): SplitPart[] {
  const seen = new Set<number>();
  return parts.filter((p) => {
    if (seen.has(p.categoryId)) return false;
    seen.add(p.categoryId);
    return true;
  });
}
