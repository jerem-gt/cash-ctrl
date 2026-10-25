// categoryId : id de l'année principale (null = sans catégorie), undefined si absente de cette année.
export type CatRow = {
  category: string;
  categoryId?: number | null;
  current: number;
  compare: number;
  delta: number;
};

type CatAmount = { category_id?: number | null; category: string; amount: number };

export function buildCatComparison(
  current: CatAmount[],
  compare: CatAmount[] | undefined,
): CatRow[] {
  const currentMap = new Map(current.map((c) => [c.category, c.amount]));
  const idMap = new Map(current.map((c) => [c.category, c.category_id]));
  const compareMap = new Map((compare ?? []).map((c) => [c.category, c.amount]));
  const allCats = new Set([...currentMap.keys(), ...compareMap.keys()]);
  return Array.from(allCats)
    .map((cat) => ({
      category: cat,
      categoryId: idMap.get(cat),
      current: currentMap.get(cat) ?? 0,
      compare: compareMap.get(cat) ?? 0,
      delta: (currentMap.get(cat) ?? 0) - (compareMap.get(cat) ?? 0),
    }))
    .sort((a, b) => b.current - a.current);
}
