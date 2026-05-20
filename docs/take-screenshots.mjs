/**
 * Génère les captures d'écran pour le README.
 *
 * Prérequis : les deux serveurs doivent être lancés.
 *   cd server && npm run dev
 *   cd client && npm run dev
 *
 * Usage :
 *   node docs/take-screenshots.mjs
 *
 * Les captures sont enregistrées dans docs/screenshots/.
 */

import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE = 'http://localhost:5173';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
console.log('Login...');
await page.goto(`${BASE}/login`);
await page.waitForSelector('#username');
await page.fill('#username', 'test');
await page.fill('#password', 'test');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// ── Pages principales ─────────────────────────────────────────────────────────
console.log('Captures...');

await page.goto(`${BASE}/`);
await shot('dashboard');

await page.goto(`${BASE}/transactions`);
await shot('transactions');

await page.goto(`${BASE}/accounts`);
await shot('accounts');

// Détail compte courant (premier lien /accounts/*)
await page.goto(`${BASE}/accounts`);
await page.waitForTimeout(1000);
const firstAccount = page.locator('a[href^="/accounts/"]').first();
if (await firstAccount.count()) {
  await firstAccount.click();
  await shot('account-detail');
}

// Détail PEA (portefeuille boursier)
const peaLink = page.locator('a').filter({ hasText: 'PEA' }).first();
if (await peaLink.count()) {
  await peaLink.click();
  await shot('account-pea');
}

// Détail assurance-vie
const avLink = page.locator('a').filter({ hasText: 'AV' }).first();
if (await avLink.count()) {
  await avLink.click();
  await shot('account-av');
}

await page.goto(`${BASE}/scheduled`);
await shot('scheduled');

await page.goto(`${BASE}/settings`);
await shot('settings');

await browser.close();
console.log('Terminé — captures dans docs/screenshots/');
