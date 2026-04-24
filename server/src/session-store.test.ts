import Database from 'better-sqlite3';
import type { SessionData } from 'express-session';
import { beforeEach, describe, expect, it } from 'vitest';

import { SQLiteSessionStore } from './session-store.js';

function makeSession(offsetMs = 60_000): SessionData {
  return {
    cookie: {
      originalMaxAge: offsetMs,
      expires: new Date(Date.now() + offsetMs),
      maxAge: offsetMs,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    },
  } as unknown as SessionData;
}

function promisify<T>(fn: (cb: (err: unknown, result?: T | null) => void) => void): Promise<T | null | undefined> {
  return new Promise((resolve, reject) => fn((err, result) => err ? reject(err) : resolve(result)));
}

function promisifyVoid(fn: (cb: () => void) => void): Promise<void> {
  return new Promise(resolve => fn(resolve));
}

describe('SQLiteSessionStore', () => {
  let store: SQLiteSessionStore;

  beforeEach(() => {
    store = new SQLiteSessionStore(new Database(':memory:'));
  });

  it('stores and retrieves a session', async () => {
    await promisifyVoid(cb => store.set('s1', makeSession(), cb));
    const sess = await promisify<SessionData>(cb => store.get('s1', cb));
    expect(sess).toBeTruthy();
  });

  it('returns null for an unknown sid', async () => {
    const sess = await promisify<SessionData | null>(cb => store.get('unknown', cb));
    expect(sess).toBeNull();
  });

  it('returns null for an expired session', async () => {
    await promisifyVoid(cb => store.set('s2', makeSession(-1000), cb));
    const sess = await promisify<SessionData | null>(cb => store.get('s2', cb));
    expect(sess).toBeNull();
  });

  it('destroy removes the session', async () => {
    await promisifyVoid(cb => store.set('s3', makeSession(), cb));
    await promisifyVoid(cb => store.destroy('s3', cb));
    const sess = await promisify<SessionData | null>(cb => store.get('s3', cb));
    expect(sess).toBeNull();
  });

  it('touch updates expiry so session stays alive', async () => {
    await promisifyVoid(cb => store.set('s4', makeSession(500), cb));
    await promisifyVoid(cb => store.touch!('s4', makeSession(60_000), cb));
    const sess = await promisify<SessionData>(cb => store.get('s4', cb));
    expect(sess).toBeTruthy();
  });

  it('set overwrites an existing session', async () => {
    await promisifyVoid(cb => store.set('s5', makeSession(), cb));
    const second = { ...makeSession(), extra: 'data' } as unknown as SessionData;
    await promisifyVoid(cb => store.set('s5', second, cb));
    const sess = await promisify<SessionData>(cb => store.get('s5', cb));
    expect((sess as unknown as { extra?: string }).extra).toBe('data');
  });
});
