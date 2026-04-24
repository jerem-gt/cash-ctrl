import type { Database } from 'better-sqlite3';

import type { Category, CategoryWithCount, CreateCategoryInput } from './categories.types';

export function createCategoriesRepo(db: Database) {
  return {
    getAll(): CategoryWithCount[] {
      return db.prepare<[], CategoryWithCount>(`
        SELECT c.*, COUNT(t.id) as tx_count
        FROM categories c
               LEFT JOIN transactions t ON t.category_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at
      `).all();
    },

    getById(id: number): Category | undefined {
      return db.prepare<[number], Category>('SELECT * FROM categories WHERE id = ?').get(id) ?? undefined;
    },

    getTxCount(id: number): number {
      return db.prepare<[number], {
        n: number
      }>('SELECT COUNT(*) as n FROM transactions WHERE category_id = ?').get(id)?.n ?? 0;
    },

    create(data: CreateCategoryInput) {
      return db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(data.name, data.color);
    },

    update(id: number, data: CreateCategoryInput) {
      return db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(data.name, data.color, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    },
  };
}
