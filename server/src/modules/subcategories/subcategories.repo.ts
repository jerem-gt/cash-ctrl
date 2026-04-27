import type { Database } from 'better-sqlite3';

import type {
  CreateSubcategoryInput,
  Subcategory,
  SubcategoryWithCount,
} from './subcategories.types';

export function createSubcategoriesRepo(db: Database) {
  return {
    getAll(): SubcategoryWithCount[] {
      return db
        .prepare<[], SubcategoryWithCount>(
          `
        SELECT sub.*, COUNT(t.id) as tx_count
        FROM subcategories sub
        LEFT JOIN transactions t ON t.subcategory_id = sub.id
        GROUP BY sub.id
        ORDER BY sub.category_id, sub.created_at
      `,
        )
        .all();
    },

    getById(id: number): Subcategory | undefined {
      return (
        db.prepare<[number], Subcategory>('SELECT * FROM subcategories WHERE id = ?').get(id) ??
        undefined
      );
    },

    getTxCount(id: number): number {
      return (
        db
          .prepare<
            [number],
            { n: number }
          >('SELECT COUNT(*) as n FROM transactions WHERE subcategory_id = ?')
          .get(id)?.n ?? 0
      );
    },

    create(data: CreateSubcategoryInput) {
      return db
        .prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)')
        .run(data.category_id, data.name);
    },

    update(id: number, name: string) {
      return db.prepare('UPDATE subcategories SET name = ? WHERE id = ?').run(name, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
    },
  };
}
