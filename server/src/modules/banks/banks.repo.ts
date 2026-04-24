import type { Database } from 'better-sqlite3';

import type { Bank, BankWithCount } from './banks.types';

export function createBanksRepo(db: Database) {
  return {
    getAll(): BankWithCount[] {
      return db.prepare<[], BankWithCount>(
          `SELECT b.*, COUNT(a.id) as acc_count
           FROM banks b
                  LEFT JOIN accounts a ON a.bank_id = b.id
           GROUP BY b.id
           ORDER BY b.name`,
      ).all();
    },

    getById(id: number): Bank | undefined {
      return db.prepare<[number], Bank>('SELECT * FROM banks WHERE id = ?').get(id) ?? undefined;
    },

    getAccountCount(id: number): number {
      return db.prepare<[number], {
        cnt: number
      }>('SELECT COUNT(*) as cnt FROM accounts WHERE bank_id = ?').get(id)?.cnt ?? 0;
    },

    create(name: string, domain: string | null) {
      return db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, NULL, ?)').run(name, domain);
    },

    update(id: number, name: string, logo: string | null, domain: string | null) {
      return db.prepare('UPDATE banks SET name = ?, logo = ?, domain = ? WHERE id = ?').run(name, logo, domain, id);
    },

    updateLogo(id: number, logo: string): void {
      db.prepare('UPDATE banks SET logo = ? WHERE id = ?').run(logo, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM banks WHERE id = ?').run(id);
    },
  };
}
