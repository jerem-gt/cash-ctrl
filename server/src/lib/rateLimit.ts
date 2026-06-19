import type { Database, Statement } from 'better-sqlite3';

interface AttemptRow {
  count: number;
  reset_at: number;
}

/**
 * Limiteur de tentatives persisté en SQLite, pensé pour freiner le brute-force
 * sur le login. Survivre aux redémarrages du process (cible NAS/Docker).
 *
 * On ne compte que les échecs : une authentification réussie remet le compteur
 * à zéro. Les entrées expirées sont purgées paresseusement à chaque accès.
 */
export class FailureRateLimiter {
  private readonly stmtGet: Statement<[string]>;
  private readonly stmtUpsert: Statement<[string, number, number, number]>;
  private readonly stmtDelete: Statement<[string]>;

  constructor(
    db: Database,
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {
    this.stmtGet = db.prepare('SELECT count, reset_at FROM login_attempts WHERE key = ?');
    this.stmtUpsert = db.prepare(`
      INSERT INTO login_attempts (key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count    = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
        reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
    `);
    this.stmtDelete = db.prepare('DELETE FROM login_attempts WHERE key = ?');
  }

  /** true si la clé est sous le seuil (tentative autorisée). */
  isAllowed(key: string): boolean {
    const entry = this.stmtGet.get(key) as AttemptRow | undefined;
    if (!entry) return true;
    if (entry.reset_at <= Date.now()) {
      this.stmtDelete.run(key);
      return true;
    }
    return entry.count < this.maxAttempts;
  }

  /** Enregistre un échec et (re)démarre la fenêtre si nécessaire. */
  recordFailure(key: string): void {
    const now = Date.now();
    this.stmtUpsert.run(key, now + this.windowMs, now, now);
  }

  /** Réinitialise le compteur d'une clé (succès). */
  reset(key: string): void {
    this.stmtDelete.run(key);
  }
}
