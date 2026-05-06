import type { Database } from 'better-sqlite3';

import type { Bank, BankWithCount } from './banks.types';

export function createBanksRepo(db: Database) {
  const getAllStmt = db.prepare<[], BankWithCount>(`
      SELECT b.*, COUNT(a.id) as acc_count
      FROM banks b
      LEFT JOIN accounts a ON a.bank_id = b.id
      GROUP BY b.id
      ORDER BY b.name
  `);
  const getByIdStmt = db.prepare<{ id: number }, Bank>('SELECT * FROM banks WHERE id = :id');
  const createStmt = db.prepare(
    'INSERT INTO banks (name, logo, domain) VALUES (:name, :logo, :domain)',
  );
  const updateStmt = db.prepare(
    'UPDATE banks SET name = :name, logo = :logo, domain = :domain WHERE id = :id',
  );
  const updateLogoStmt = db.prepare('UPDATE banks SET logo = :logo WHERE id = :id');
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

    delete: (id: number) => deleteStmt.run({ id }),
  };
}
