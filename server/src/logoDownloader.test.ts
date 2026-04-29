import fs from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb } from './db/init.js';
import { initSchema } from './db/schema.js';
import { logger } from './logger.js';
import { downloadDefaultBankLogos } from './logoDownloader.js';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

describe('downloadDefaultBankLogos', () => {
  function setupDb() {
    const db = createDb(':memory:');
    initSchema(db);
    return db;
  }

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates LOGOS_DIR when it does not exist', async () => {
    const db = setupDb();
    vi.mocked(fs.existsSync).mockReturnValueOnce(false);
    await downloadDefaultBankLogos(db);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('skips banks that already have a logo', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankWithLogo',
      '/logos/x.png',
      'example.com',
    );
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('skips banks without a domain', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankNoDomain',
      null,
      null,
    );
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('updates logo path when logo file already exists on disk', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankFileExists',
      null,
      'example.com',
    );
    const bank = db.prepare('SELECT id FROM banks WHERE name = ?').get('BankFileExists') as {
      id: number;
    };
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true) // LOGOS_DIR exists
      .mockReturnValueOnce(true); // logo file exists → update path, no fetch
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    const updated = db.prepare('SELECT logo FROM banks WHERE id = ?').get(bank.id) as {
      logo: string;
    };
    expect(updated.logo).toMatch(/\/logos\/bankfileexists-\d+\.png/);
  });

  it('fetches and saves logo when file does not exist on disk', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankToFetch',
      null,
      'example.com',
    );
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true) // LOGOS_DIR exists
      .mockReturnValueOnce(false); // logo file absent → fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }),
    );
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('logs a warning when fetch returns an HTTP error', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankHttpErr',
      null,
      'example.com',
    );
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await downloadDefaultBankLogos(db);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs a warning when fetch throws', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, domain) VALUES (?, ?, ?)').run(
      'BankThrows',
      null,
      'example.com',
    );
    vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    await downloadDefaultBankLogos(db);
    expect(logger.warn).toHaveBeenCalled();
  });
});
