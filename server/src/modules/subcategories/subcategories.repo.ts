import type { Database } from 'better-sqlite3';

import type {
  CreateSubcategoryInput,
  Subcategory,
  SubcategoryWithCount,
} from './subcategories.types';

export function createSubcategoriesRepo(db: Database, userId: number) {
  const getAllStmt = db.prepare<{ userId: number }, SubcategoryWithCount>(`
      SELECT sub.*, COUNT(t.id) as tx_count
      FROM subcategories sub
      LEFT JOIN transactions t ON t.subcategory_id = sub.id
      WHERE sub.user_id = :userId
      GROUP BY sub.id
      ORDER BY sub.category_id, sub.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number; userId: number }, Subcategory>(
    'SELECT * FROM subcategories WHERE id = :id AND user_id = :userId',
  );
  const createStmt = db.prepare(
    'INSERT INTO subcategories (user_id, category_id, name) VALUES (:userId, :category_id, :name)',
  );
  const updateStmt = db.prepare(
    'UPDATE subcategories SET name = :name WHERE id = :id AND user_id = :userId',
  );
  const deleteStmt = db.prepare('DELETE FROM subcategories WHERE id = :id AND user_id = :userId');

  return {
    getAll: () => getAllStmt.all({ userId }),

    getById: (id: number) => getByIdStmt.get({ id, userId }),

    create: (data: CreateSubcategoryInput) => createStmt.run({ ...data, userId }),

    update: (id: number, name: string) => updateStmt.run({ id, name, userId }),

    delete: (id: number) => deleteStmt.run({ id, userId }),
  };
}
