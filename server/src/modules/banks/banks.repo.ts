import type { Database } from 'better-sqlite3';

import type { Bank, BankWithCount } from './banks.types';

export function createBanksRepo(db: Database) {
  const getAllStmt = db.prepare<[], BankWithCount>(`
      SELECT b.*, COUNT(a.id) as acc_count
      FROM banks b
      LEFT JOIN accounts a ON a.bank_id = b.id
      GROUP BY b.id
      ORDER BY b.sort_order ASC, b.name ASC
  `);
  const getByIdStmt = db.prepare<{ id: number }, Bank>('SELECT * FROM banks WHERE id = :id');
  const createStmt = db.prepare(
    'INSERT INTO banks (name, logo, domain, sort_order) VALUES (:name, :logo, :domain, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM banks))',
  );
  const updateStmt = db.prepare(
    'UPDATE banks SET name = :name, logo = :logo, domain = :domain WHERE id = :id',
  );
  const updateLogoStmt = db.prepare('UPDATE banks SET logo = :logo WHERE id = :id');
  const updateSortOrderStmt = db.prepare(
    'UPDATE banks SET sort_order = :sort_order WHERE id = :id',
  );
  const deleteStmt = db.prepare('DELETE FROM banks WHERE id = :id');

  return {
    getAll: () => getAllStmt.all(),

    getById: (id: number) => getByIdStmt.get({ id }),

    create: (name: string, domain: string | null) =>
      createStmt.run({
        name,
        domain,
        logo: null,
      }),

    update: (id: number, name: string, logo: string | null, domain: string | null) =>
      updateStmt.run({
        id,
        name,
        logo,
        domain,
      }),

    updateLogo: (id: number, logo: string) => updateLogoStmt.run({ id, logo }),

    reorder: db.transaction((items: { id: number; sort_order: number }[]) => {
      for (const item of items) {
        updateSortOrderStmt.run(item);
      }
    }),

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
