import type { Database } from 'better-sqlite3';

import type {
  CreateSubcategoryInput,
  Subcategory,
  SubcategoryWithCount,
} from './subcategories.types';

export function createSubcategoriesRepo(db: Database) {
  const getAllStmt = db.prepare<[], SubcategoryWithCount>(`
      SELECT sub.*, COUNT(t.id) as tx_count
      FROM subcategories sub
      LEFT JOIN transactions t ON t.subcategory_id = sub.id
      GROUP BY sub.id
      ORDER BY sub.category_id, sub.created_at
  `);
  const getByIdStmt = db.prepare<{ id: number }, Subcategory>(
    'SELECT * FROM subcategories WHERE id = :id',
  );
  const createStmt = db.prepare(
    'INSERT INTO subcategories (category_id, name) VALUES (:category_id, :name)',
  );
  const updateStmt = db.prepare('UPDATE subcategories SET name = :name WHERE id = :id');
  const deleteStmt = db.prepare('DELETE FROM subcategories WHERE id = :id');

  return {
    getAll: () => getAllStmt.all(),

    getById: (id: number) => getByIdStmt.get({ id }),

    create: (data: CreateSubcategoryInput) => createStmt.run(data),

    update: (id: number, name: string) => updateStmt.run({ id, name }),

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
