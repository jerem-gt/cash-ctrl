export type CatRow = { category: string; current: number; compare: number; delta: number };

export function buildCatComparison(
  current: Array<{ category: string; amount: number }>,
  compare: Array<{ category: string; amount: number }> | undefined,
): CatRow[] {
  const currentMap = new Map(current.map((c) => [c.category, c.amount]));
  const compareMap = new Map((compare ?? []).map((c) => [c.category, c.amount]));
  const allCats = new Set([...currentMap.keys(), ...compareMap.keys()]);
  return Array.from(allCats)
    .map((cat) => ({
      category: cat,
      current: currentMap.get(cat) ?? 0,
      compare: compareMap.get(cat) ?? 0,
      delta: (currentMap.get(cat) ?? 0) - (compareMap.get(cat) ?? 0),
    }))
    .sort((a, b) => b.current - a.current);
}
