import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, db, queries } from './db.js';

const BANK_CONFIG: { name: string; domain: string }[] = [
  { name: 'BoursoBank',       domain: 'boursobank.com' },
  { name: 'Fortuneo',         domain: 'fortuneo.fr' },
  { name: 'Credit Agricole',  domain: 'credit-agricole.fr' },
  { name: 'Linxea',           domain: 'linxea.com' },
  { name: 'Amundi',           domain: 'amundi.com' },
  { name: 'BNP Paribas',      domain: 'bnpparibas.com' },
  { name: 'Societe Generale', domain: 'societegenerale.com' },
  { name: 'Revolut',          domain: 'revolut.com' },
  { name: 'N26',              domain: 'n26.com' },
];

// Normalize for accent-insensitive matching
const normalize = (s: string) => s.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '').toLowerCase();

export const LOGOS_DIR = path.join(DATA_DIR, 'logos');

export async function downloadDefaultBankLogos(): Promise<void> {
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

  const updateLogo = db.prepare('UPDATE banks SET logo = ? WHERE id = ?');

  for (const bank of queries.getBanks.all()) {
    if (bank.logo) continue;
    const config = BANK_CONFIG.find(c => normalize(c.name) === normalize(bank.name));
    if (!config) continue;
    const { domain } = config;

    const filename = `bank-${bank.id}.png`;
    const filepath = path.join(LOGOS_DIR, filename);
    if (fs.existsSync(filepath)) {
      updateLogo.run(`/logos/${filename}`, bank.id);
      continue;
    }

    try {
      const res = await fetch(
        `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`
      );
      if (!res.ok) { console.warn(`[logos] ${bank.name}: HTTP ${res.status}`); continue; }
      fs.writeFileSync(filepath, Buffer.from(await res.arrayBuffer()));
      updateLogo.run(`/logos/${filename}`, bank.id);
      console.log(`[logos] Downloaded logo for ${bank.name}`);
    } catch (err) {
      console.warn(`[logos] Failed for ${bank.name}:`, (err as Error).message);
    }
  }
}
