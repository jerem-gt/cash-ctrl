import type { Database } from 'better-sqlite3';

import {
  Category,
  CategoryWithCountAndSubCategories,
  CreateCategoryInput,
} from './categories.types';

export function createCategoriesRepo(db: Database, userId: number) {
  const getAllStmt = db.prepare(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM transactions t
         JOIN subcategories sc ON t.subcategory_id = sc.id
         WHERE sc.category_id = c.id AND t.user_id = :userId) as tx_count,
        (SELECT json_group_array(
            json_object(
                    'id', id,
                    'name', name,
                    'category_id', category_id,
                    'tx_count', (SELECT COUNT(*) FROM transactions t WHERE t.subcategory_id = subcategories.id AND t.user_id = :userId)
            )
          )
         FROM subcategories
         WHERE category_id = c.id AND user_id = :userId) as subcategories
      FROM categories c
      WHERE c.user_id = :userId
      ORDER BY c.created_at;
  `);
  const getByIdStmt = db.prepare<{ id: number; userId: number }, Category>(
    'SELECT * FROM categories WHERE id = :id AND user_id = :userId',
  );
  const createStmt = db.prepare(
    'INSERT INTO categories (user_id, name, icon) VALUES (:userId, :name, :icon)',
  );
  const updateStmt = db.prepare(
    'UPDATE categories SET name = :name, icon = :icon WHERE id = :id AND user_id = :userId',
  );
  const deleteStmt = db.prepare('DELETE FROM categories WHERE id = :id AND user_id = :userId');

  return {
    getAll(): CategoryWithCountAndSubCategories[] {
      interface RawCategoryRow extends Category {
        tx_count: number;
        subcategories: string;
      }
      const rows = getAllStmt.all({ userId }) as RawCategoryRow[];
      return rows.map((row) => ({
        ...row,
        subcategories: JSON.parse(row.subcategories ?? '[]') as unknown[],
      }));
    },

    getById: (id: number) => getByIdStmt.get({ id, userId }),

    create: (data: CreateCategoryInput) => createStmt.run({ ...data, userId }),

    update: (id: number, data: CreateCategoryInput) => updateStmt.run({ ...data, id, userId }),

    delete: (id: number) => deleteStmt.run({ id, userId }),
  };
}
