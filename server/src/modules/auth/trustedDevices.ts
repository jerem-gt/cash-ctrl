import type { Database } from 'better-sqlite3';

/** Révoque tous les appareils mémorisés du compte (mot de passe ou 2FA modifié, « oublier tous »). */
export function revokeTrustedDevices(db: Database, userId: number): void {
  db.prepare('DELETE FROM trusted_devices WHERE user_id = ?').run(userId);
}
