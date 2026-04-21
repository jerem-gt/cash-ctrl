import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import ConnectSQLite from 'connect-sqlite3';
import path from 'node:path';
import { DB_PATH } from './db.js';
import { LOGOS_DIR, downloadDefaultBankLogos } from './logoDownloader.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { transfersRouter } from './routes/transfers.js';
import { exportRouter } from './routes/export.js';
import { categoriesRouter } from './routes/categories.js';
import { accountTypesRouter } from './routes/account-types.js';
import { banksRouter } from './routes/banks.js';

const SQLiteStore = ConnectSQLite(session);

const PORT = Number.parseInt(process.env.PORT ?? '3000');
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files served before session middleware (no session needed)
app.use('/logos', express.static(LOGOS_DIR));
if (IS_PROD) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.dirname(DB_PATH) }) as session.Store,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/export', exportRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/account-types', accountTypesRouter);
app.use('/api/banks', banksRouter);

app.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`[cashctrl] Server running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})\n`);
  downloadDefaultBankLogos().catch((err: unknown) => { process.stderr.write(`${String(err)}\n`); });
});
