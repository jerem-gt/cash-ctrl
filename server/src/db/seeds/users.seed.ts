import bcrypt from 'bcrypt';
import type { Database } from 'better-sqlite3';

export function seedAdminUser(db: Database) {
    const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';

    const existing = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(ADMIN_USER);

    if (existing) return;

    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

    db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
    `).run(ADMIN_USER, hash);

    console.log(`[seed] Admin user "${ADMIN_USER}" created`);
}