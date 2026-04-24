import { Store, SessionData } from 'express-session';
import type { Database, Statement } from 'better-sqlite3';

interface SessionRow {
  data: string;
  expires_at: number;
}

export class SQLiteSessionStore extends Store {
  private readonly stmtGet: Statement<[string], SessionRow>;
  private readonly stmtUpsert: Statement<[string, string, number]>;
  private readonly stmtDelete: Statement<[string]>;
  private readonly stmtTouch: Statement<[number, string]>;
  private readonly stmtCleanup: Statement<[number]>;

  constructor(db: Database) {
    super();

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid        TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.stmtGet     = db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?');
    this.stmtUpsert  = db.prepare('INSERT OR REPLACE INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)');
    this.stmtDelete  = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.stmtTouch   = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
    this.stmtCleanup = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

    setInterval(() => this.stmtCleanup.run(Date.now()), 60 * 60 * 1000).unref();
  }

  get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.stmtGet.get(sid);
      if (!row || row.expires_at < Date.now()) {
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.data) as SessionData);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      const expiresAt = session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (session.cookie.maxAge ?? 86_400_000);
      this.stmtUpsert.run(sid, JSON.stringify(session), expiresAt);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.stmtDelete.run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      const expiresAt = session.cookie.expires
        ? new Date(session.cookie.expires).getTime()
        : Date.now() + (session.cookie.maxAge ?? 86_400_000);
      this.stmtTouch.run(expiresAt, sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }
}
