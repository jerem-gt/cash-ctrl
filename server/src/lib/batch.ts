/** Exécute fn sur les items par lots de `size` (concurrence bornée). */
export async function mapInBatches<T>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  await batches.reduce(
    (prev, batch) => prev.then(() => Promise.all(batch.map(fn)).then(() => undefined)),
    Promise.resolve(),
  );
}
