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
  private readonly stmtInsert: Statement<[string, number, number]>;
  private readonly stmtIncrement: Statement<[string]>;
  private readonly stmtDelete: Statement<[string]>;

  constructor(
    db: Database,
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        key      TEXT    PRIMARY KEY,
        count    INTEGER NOT NULL,
        reset_at INTEGER NOT NULL
      )
    `);
    this.stmtGet = db.prepare('SELECT count, reset_at FROM login_attempts WHERE key = ?');
    this.stmtInsert = db.prepare(
      'INSERT OR REPLACE INTO login_attempts (key, count, reset_at) VALUES (?, ?, ?)',
    );
    this.stmtIncrement = db.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?');
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
    const entry = this.stmtGet.get(key) as AttemptRow | undefined;
    if (!entry || entry.reset_at <= now) {
      this.stmtInsert.run(key, 1, now + this.windowMs);
    } else {
      this.stmtIncrement.run(key);
    }
  }

  /** Réinitialise le compteur d'une clé (succès). */
  reset(key: string): void {
    this.stmtDelete.run(key);
  }
}
