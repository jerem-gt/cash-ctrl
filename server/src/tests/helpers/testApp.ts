import bcrypt from 'bcrypt';
import supertest from 'supertest';
import { createApp } from '../../app.js';
import { createTestDb } from './testDb';

export const TEST_USER = 'testuser';
export const TEST_PASS = 'test-password-123';

export interface TestContext {
  db: ReturnType<typeof createTestDb>;
  app: ReturnType<typeof createApp>;
  agent: ReturnType<typeof supertest.agent>;
  userId: number;
}

export async function createTestContext(): Promise<TestContext> {
  const db = createTestDb();
  const app = createApp(db);
  const agent = supertest.agent(app);

  const hash = bcrypt.hashSync(TEST_PASS, 4);
  const userId = Number(
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(TEST_USER, hash).lastInsertRowid,
  );

  await agent.post('/api/auth/login').send({ username: TEST_USER, password: TEST_PASS });

  return { db, app, agent, userId };
}
