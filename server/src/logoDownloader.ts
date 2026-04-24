import fs from 'node:fs';
import path from 'node:path';
import type { Database } from 'better-sqlite3';
import { createBanksRepo } from './modules/banks/banks.repo.js';
import { DATA_DIR } from './db/init';

export const LOGOS_DIR = path.join(DATA_DIR, 'logos');

export async function downloadDefaultBankLogos(db: Database): Promise<void> {
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const banksRepo = createBanksRepo(db);

  for (const bank of banksRepo.getAll()) {
    if (bank.logo || !bank.domain) continue;

    const filename = `bank-${bank.id}.png`;
    const filepath = path.join(LOGOS_DIR, filename);
    if (fs.existsSync(filepath)) {
      banksRepo.updateLogo(bank.id, `/logos/${filename}`);
      continue;
    }

    try {
      const res = await fetch(
        `https://www.google.com/s2/favicons?domain=${bank.domain}&sz=64`
      );
      if (!res.ok) { console.warn(`[logos] ${bank.name}: HTTP ${res.status}`); continue; }
      fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
      banksRepo.updateLogo(bank.id, `/logos/${filename}`);
      console.log(`[logos] Downloaded logo for ${bank.name}`);
    } catch (err) {
      console.warn(`[logos] Failed for ${bank.name}:`, (err as Error).message);
    }
  }
}
