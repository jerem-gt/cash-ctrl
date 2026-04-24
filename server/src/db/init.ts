import { initSchema } from './schema';
import { seedDatabase } from './seed';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export const DATA_DIR = process.env.DATA_DIR ?? path.join(__dirname, '../../data');

export function createDb(filePath?: string) {
    const isMemory = filePath === ':memory:';

    const DB_PATH =
        filePath ??
        path.join(DATA_DIR, 'cashctrl.db');

    // 👉 création dossier seulement si DB fichier
    if (!isMemory) {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    const db = new Database(DB_PATH);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    return db;
}

export function initDatabase(db: DatabaseType) {
    initSchema(db);
    seedDatabase(db);
}