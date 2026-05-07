import fs from 'node:fs';
import path from 'node:path';

import { createDb, DATA_DIR, initDatabase } from './init';

const DB_PATH = path.join(DATA_DIR, 'cashctrl.db');

if (fs.existsSync(DB_PATH)) {
  try {
    fs.rmSync(DB_PATH);
    console.log('Ancienne base supprimée.');
  } catch {
    console.error(
      'Impossible de supprimer la base (serveur en cours ?).\nArrête le serveur de dev puis relance db:reset.',
    );
    process.exit(1);
  }
}

const db = createDb();
initDatabase(db);
console.log('Schéma et données de référence initialisés.');
console.log('Identifiants : admin / changeme');
