import type { Database } from 'better-sqlite3';

import {
  Category,
  CategoryWithCountAndSubCategories,
  CreateCategoryInput,
} from './categories.types';

export function createCategoriesRepo(db: Database) {
  return {
    getAll(): CategoryWithCountAndSubCategories[] {
      interface RawCategoryRow extends Category {
        tx_count: number;
        subcategories: string; // SQLite renvoie le JSON sous forme de string
      }
      const rows = db
        .prepare(
          `
        SELECT 
          c.*,
          (SELECT COUNT(*) FROM transactions t 
           JOIN subcategories sc ON t.subcategory_id = sc.id 
           WHERE sc.category_id = c.id) as tx_count,
          (SELECT json_group_array(
                    json_object(
                      'id', id, 
                      'name', name, 
                      'category_id', category_id
                    )
                  )
           FROM subcategories 
           WHERE category_id = c.id) as subcategories
        FROM categories c
        ORDER BY c.created_at
      `,
        )
        .all() as RawCategoryRow[];

      return rows.map((row) => ({
        ...row,
        subcategories: JSON.parse(row.subcategories), // SQLite renvoie une string JSON
      }));
    },

    getById(id: number): Category | undefined {
      return (
        db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?').get(id) ?? undefined
      );
    },

    getTxCount(id: number): number {
      return (
        db
          .prepare<
            [number],
            {
              n: number;
            }
          >(
            'SELECT COUNT(*) as n FROM transactions WHERE subcategory_id in (select id from subcategories where category_id = ?)',
          )
          .get(id)?.n ?? 0
      );
    },

    create(data: CreateCategoryInput) {
      return db
        .prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)')
        .run(data.name, data.color, data.icon);
    },

    update(id: number, data: CreateCategoryInput) {
      return db
        .prepare('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?')
        .run(data.name, data.color, data.icon, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    },
  };
}
