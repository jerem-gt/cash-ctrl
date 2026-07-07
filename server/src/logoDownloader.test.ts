import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb } from './db/init.js';
import { initSchema } from './db/schema.js';

// vi.mock hoisté leak entre fichiers avec isolate: false → vi.doMock + imports dynamiques
const fsMock = {
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
};
let logger: (typeof import('./logger.js'))['logger'];
let downloadDefaultBankLogos: (typeof import('./logoDownloader.js'))['downloadDefaultBankLogos'];

beforeAll(async () => {
  vi.doMock('node:fs', () => ({ default: fsMock }));
  vi.resetModules();
  ({ logger } = await import('./logger.js'));
  ({ downloadDefaultBankLogos } = await import('./logoDownloader.js'));
});

afterAll(() => {
  vi.doUnmock('node:fs');
  vi.resetModules();
});

describe('downloadDefaultBankLogos', () => {
  function setupDb() {
    const db = createDb(':memory:');
    initSchema(db);
    return db;
  }

  beforeEach(() => {
    fsMock.existsSync.mockReturnValue(true);
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
    fsMock.existsSync.mockReturnValueOnce(false);
    await downloadDefaultBankLogos(db);
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('skips banks that already have a logo', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankWithLogo',
      '/logos/x.png',
      'https://www.example.com/login',
    );
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('skips banks without a login_url', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankNoUrl',
      null,
      null,
    );
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('updates logo path when logo file already exists on disk', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankFileExists',
      null,
      'https://www.example.com/login',
    );
    const bank = db.prepare('SELECT id FROM banks WHERE name = ?').get('BankFileExists') as {
      id: number;
    };
    fsMock.existsSync
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
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankToFetch',
      null,
      'https://www.example.com/login',
    );
    fsMock.existsSync
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
    expect(fsMock.writeFileSync).toHaveBeenCalled();
  });

  it('logs a warning when fetch returns an HTTP error', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankHttpErr',
      null,
      'https://www.example.com/login',
    );
    fsMock.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await downloadDefaultBankLogos(db);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs a warning and skips when login_url is not a valid URL', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankBadUrl',
      null,
      'pas-une-url',
    );
    vi.stubGlobal('fetch', vi.fn());
    await downloadDefaultBankLogos(db);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('logs a warning when fetch throws', async () => {
    const db = setupDb();
    db.prepare('INSERT INTO banks (name, logo, login_url) VALUES (?, ?, ?)').run(
      'BankThrows',
      null,
      'https://www.example.com/login',
    );
    fsMock.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    await downloadDefaultBankLogos(db);
    expect(logger.warn).toHaveBeenCalled();
  });
});
