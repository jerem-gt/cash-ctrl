import type { Database } from 'better-sqlite3';

import {
  Category,
  CategoryWithCountAndSubCategories,
  CreateCategoryInput,
} from './categories.types';

export function createCategoriesRepo(db: Database) {
  const getAllStmt = db.prepare(`
      SELECT
        c.*,
        -- Nombre total de transactions pour la catégorie (somme de ses sous-catégories)
        (SELECT COUNT(*) FROM transactions t
         JOIN subcategories sc ON t.subcategory_id = sc.id
         WHERE sc.category_id = c.id) as tx_count,
        -- Liste des sous-catégories avec leur propre tx_count
        (SELECT json_group_array(
            json_object(
                    'id', id,
                    'name', name,
                    'category_id', category_id,
                    'tx_count', (SELECT COUNT(*) FROM transactions t WHERE t.subcategory_id = subcategories.id)
            )
          )
         FROM subcategories
         WHERE category_id = c.id) as subcategories
      FROM categories c
      ORDER BY c.created_at;
  `);
  const getByIdStmt = db.prepare<{ id: number }, Category>(
    'SELECT * FROM categories WHERE id = :id',
  );
  const createStmt = db.prepare('INSERT INTO categories (name, icon) VALUES (:name, :icon)');
  const updateStmt = db.prepare('UPDATE categories SET name = :name, icon = :icon WHERE id = :id');
  const deleteStmt = db.prepare('DELETE FROM categories WHERE id = :id');

  return {
    getAll(): CategoryWithCountAndSubCategories[] {
      interface RawCategoryRow extends Category {
        tx_count: number;
        subcategories: string; // SQLite renvoie le JSON sous forme de string
      }
      const rows = getAllStmt.all() as RawCategoryRow[];
      return rows.map((row) => ({
        ...row,
        subcategories: JSON.parse(row.subcategories), // SQLite renvoie une string JSON
      }));
    },

    getById: (id: number) => getByIdStmt.get({ id }),

    create: (data: CreateCategoryInput) => createStmt.run(data),

    update: (id: number, data: CreateCategoryInput) =>
      updateStmt.run({
        ...data,
        id,
      }),

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
