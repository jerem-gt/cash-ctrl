import type { Bank, BankWithCount } from './banks.types';
import type { Database } from 'better-sqlite3';

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

    create(name: string) {
      return db.prepare('INSERT INTO banks (name, logo) VALUES (?, ?)').run(name, null);
    },

    update(id: number, name: string, logo: string | null) {
      return db.prepare('UPDATE banks SET name = ?, logo = ? WHERE id = ?').run(name, logo, id);
    },

    updateLogo(id: number, logo: string): void {
      db.prepare('UPDATE banks SET logo = ? WHERE id = ?').run(logo, id);
    },

    delete(id: number) {
      return db.prepare('DELETE FROM banks WHERE id = ?').run(id);
    },
  };
}
