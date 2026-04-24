# AGENTS.md — CashCtrl

Instructions pour les agents IA travaillant sur ce dépôt.

## Vue d'ensemble

CashCtrl est une application de suivi de finances personnelles en monorepo npm workspace :
- `client/` — React 19 + Vite + Tailwind CSS 4 + TanStack Query v5
- `server/` — Node.js 24 + Express 5 + TypeScript + better-sqlite3 + Zod

## Architecture

### Serveur (`server/src/`)

**`app.ts`** — Factory `createApp(db, options?)` qui configure Express.
- Session middleware avec `SQLiteSessionStore`
- Enregistrement des 11 router factories
- Utilisé par `index.ts` (prod) et `createTestContext()` (tests)

**`session-store.ts`** — `SQLiteSessionStore extends Store` (express-session).
- Stocke les sessions dans la table `sessions` de la même DB SQLite
- Remplace `connect-sqlite3` (failles de sécurité)
- Nettoyage automatique des sessions expirées toutes les heures

**`db/`** — Initialisation de la base de données, découpée en trois responsabilités :
- `db/init.ts` — `createDb(filePath?)` (ouvre/crée le fichier SQLite, active WAL + FK), `initDatabase(db)` (appelle schema + seed), exporte `DATA_DIR`
- `db/schema.ts` — `initSchema(db)` : `CREATE TABLE IF NOT EXISTS` pour toutes les tables + migrations légères (`ALTER TABLE`)
- `db/seed.ts` — `seedDatabase(db)` : orchestre les seeds via `INSERT OR IGNORE` (idempotent)
- `db/seeds/*.seed.ts` — Un fichier par entité seedée (banks, categories, accountTypes, paymentMethods, users)

**`lib/`** — Logique métier découplée de la couche HTTP.
- `scheduledLogic.ts` — Fonctions **pures** de calcul de dates de récurrence (aucun import DB). À importer depuis les tests unitaires.
- `generateScheduled.ts` — Génération idempotente des transactions planifiées. Prend `db` en paramètre pour l'injection en tests. Délègue les INSERT à `transactions.repo.ts` (`createScheduled`, `linkTransferPeers`).

**`modules/`** — Un dossier par ressource, chacun contient trois fichiers :
- `{module}.types.ts` — interfaces TypeScript de la ressource
- `{module}.repo.ts` — factory `createXxxRepo(db: Database)` retournant un objet de méthodes SQL
- `{module}.routes.ts` — factory `createXxxRouter(db: Database)` : Zod schema → repo → réponse JSON

Les 11 modules : `auth`, `accounts`, `account-types`, `transactions`, `transfers`, `banks`, `categories`, `payment-methods`, `scheduled`, `settings`, `export`.

**`logoDownloader.ts`** — Télécharge les logos des banques au démarrage via l'API favicon de Google, pour toutes les banques dont le champ `domain` est renseigné. Les logos sont stockés dans `DATA_DIR/logos/`.

**Serving des fichiers statiques** : `GET /logos/:filename` servi par `express.static`.

### Client (`client/src/`)

**`api/client.ts`** — Tous les fetch sont centralisés ici. Ne pas appeler `fetch` directement dans les hooks ou composants.

**`hooks/`** — Un hook par ressource. Wrappent TanStack Query. Pattern :
- `useXxx()` → `useQuery`
- `useCreateXxx()`, `useUpdateXxx()`, `useDeleteXxx()` → `useMutation` + `invalidateQueries`

**`components/AccountBadge.tsx`** — Composant canonique pour afficher un compte. Toujours utiliser ce composant (pas d'affichage inline du nom/banque). Signature : `{ name, bank?, logo?, className? }`. Le logo est résolu en amont via `logoMap`.

**`components/ui/`** — Primitives UI (Card, Button, Input, Select, FormGroup, Empty, ConfirmModal, showToast). Utiliser ces composants, ne pas créer de nouveaux éléments HTML bruts.

**`pages/`** — Pages routées. Chaque page est responsable de ses propres appels de hooks.

## Conventions importantes

### Formulaires
- Les `<form onSubmit>` utilisent `type SubmitEvent` (React 19), pas `React.FormEvent`
- Les mutations sont toujours appelées avec `onSuccess` / `onError` inline pour afficher les toasts

### Transactions & Transferts
- Un transfert = deux transactions liées via `transfer_peer_id`
- Modifier ou supprimer un transfert doit toujours affecter les deux legs simultanément
- La route `PUT /api/transactions/:id` gère les deux cas (détecte via `transfer_peer_id` en DB)

### Transactions planifiées
- Table `scheduled_transactions`, générées dans `server/src/lib/generateScheduled.ts`
- Génération déclenchée au `GET /api/transactions` et après chaque mutation sur `/api/scheduled`
- **Idempotence** : `last_generated_until` stocke la dernière date nominale générée ; le prochain appel repart de `nextOccurrence(last_generated_until)`
- **Transferts planifiés** : `payment_method = 'Transfert'` + `to_account_id` ≠ null → crée deux legs liés par `transfer_peer_id` à chaque occurrence
- **Weekend handling** : la date nominale est stockée dans `last_generated_until` (avant décalage) ; seule la date effective dans la transaction est décalée
- Sur PUT ou DELETE d'une planification : supprimer d'abord les occurrences futures non validées (`validated = 0 AND date > today`)

### Banques et logos
- Le logo d'une banque est stocké localement dans `data/logos/bank-{id}.png`
- L'URL servie est `/logos/bank-{id}.png` (proxy Vite en dev, Express static en prod)
- Le champ `domain` (ex : `boursobank.com`) est stocké en base dans la table `banks`. `logoDownloader.ts` l'utilise directement — il n'y a plus de tableau `BANK_CONFIG` dans le code.
- Les banques seedées par défaut ont leur domaine pré-rempli. Une migration dans `schema.ts` rétroactive les banques existantes au démarrage.
- Dans les pages, construire un `logoMap` une seule fois via `useMemo` : `Object.fromEntries(banks.map(b => [b.name, b.logo]))`. Passer ce `Record<string, string | null>` aux composants plutôt que le tableau `banks[]` pour éviter les `.find()` répétés.

### Types configurables en base
- Types de compte : table `account_types`, route `/api/account-types`
- Banques : table `banks`, route `/api/banks`
- Catégories : table `categories`, route `/api/categories`
- Moyens de paiement : table `payment_methods`, route `/api/payment-methods`
- Ne pas hard-coder ces valeurs dans le code client

### Tailwind CSS 4
- Pas de `tailwind.config.js` — configuration dans `client/src/index.css`
- Modificateur d'opacité : `/6` = 6% (valeur dans l'échelle), `/[0.07]` = 7% (valeur arbitraire hors échelle). Les crochets `[...]` permettent toute valeur CSS libre.

## Workflow de développement

```bash
npm run dev          # Lance client (5173) + serveur (3000) en parallèle
```

Le proxy Vite (`client/vite.config.ts`) redirige `/api/*` et `/logos/*` vers `localhost:3000`.

Vérification TypeScript :
```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

Tests serveur (Vitest, 135 tests) :
```bash
npm test --workspace=server                    # Exécution unique
npm run test:coverage --workspace=server       # Avec rapport lcov (coverage/)
npm run test:watch --workspace=server          # Mode watch
```

Structure des tests (arborescence miroir des sources) :
- `src/session-store.test.ts` — TU du store de sessions (async/await, pas `done`)
- `src/middleware.test.ts` — TU du guard `requireAuth`
- `src/lib/scheduledLogic.test.ts` / `generateScheduled.test.ts` — TU logique récurrence
- `src/modules/{module}/{module}.routes.test.ts` — TI supertest par ressource (11 fichiers)
- `src/tests/helpers/testDb.ts` — trois helpers de DB :
  - `createTestDb()` — SQLite `:memory:` + `initSchema` + seeds de référence (banks, catégories, PM…)
  - `seedTestReferenceData(db)` — insère uniquement les seeds de référence (utilisé par `createTestDb`)
  - `setupFixtures()` — `createTestDb()` + user + 2 comptes ; pour les TU sans couche HTTP
- `src/tests/helpers/testApp.ts` — `createTestContext()` : `createTestDb()` + `createApp` + agent supertest authentifié

Patterns d'isolation par type de test :
- **Routes** (`modules/{module}/*.routes.test.ts`) : `createTestContext()` dans `beforeAll` — DB et agent partagés au sein d'une suite, isolés entre suites
- **`generateScheduled.test.ts`** : `setupFixtures()` dans `beforeEach` — DB fraîche à chaque test (les tests modifient l'état de la DB)
- **`auth.routes.test.ts`** : `setup()` locale dans chaque `it` — app fraîche par test (les tests modifient la session)

> **Attention tsx cache** : `tsx watch` maintient un cache disque dans `node_modules/.cache/tsx/`. Le script `dev` utilise `--no-cache` pour éviter de servir du code compilé périmé.

## Déploiement

CI/CD via GitHub Actions → image Docker `ghcr.io/jerem-gt/cash-ctrl:latest` → Watchtower pull auto.

Pipeline GitHub Actions (3 jobs) :
1. **`ci`** (container `node:24.15.0-alpine`) — `npm ci` + `test:coverage` + build server & client + `npm prune --omit=dev` → upload artifact (`node_modules` musl + `server/dist` + `client/dist` + `server/coverage/lcov.info`)
2. **`sonar`** (ubuntu, `needs: ci`) — télécharge coverage, lance `SonarSource/sonarcloud-github-action`
3. **`build-and-push`** (ubuntu, `needs: ci`) — télécharge l'artifact, construit l'image Docker (`linux/amd64`) et pousse sur ghcr.io

Le Dockerfile ne contient aucun `npm ci` ni build tools : il copie simplement les artifacts de la CI dans une image `node:24.15.0-alpine` vierge.

**Important** : les changements ne sont visibles en production qu'après rebuild et push de l'image. Tester en dev d'abord.

Le dossier `data/` est monté en volume Docker et contient :
- `cashctrl.db` — base SQLite (ne jamais versionner)
- `logos/` — logos des banques (ne jamais versionner)

## Pièges connus

- **Multer + Express 5** : `req.params.id` peut être typé `string | string[]`, forcer avec `as string`
- **Accents dans les clés d'objet JS** : éviter les accents dans les clés de record/map, utiliser des tableaux avec un champ `name` séparé
- **INSERT OR IGNORE** : tous les seeds doivent utiliser cette forme pour être idempotents au redémarrage
- **`computeBalance`** : définie dans `client/src/lib/account.ts`, importée par Sidebar, DashboardPage et AccountsPage
- **tsx cache** : `tsx watch` peut servir du code compilé périmé si le cache n'est pas invalidé. Utiliser `tsx watch --no-cache` (déjà dans le script `dev`) ou reconstruire avec `npm run build` + `node dist/index.js`
- **DATA_DIR relatif** : `.env` a `DATA_DIR=./data`, résolu depuis le CWD. En workspace, CWD = `server/`, donc la vraie DB est dans `server/data/`. En test, utiliser une DB `:memory:` via injection.
- **Testabilité des routes** : les routers sont des factory functions `createXxxRouter(db)` qui instancient leur repo en interne. Ne pas revenir à des singletons module-level — cela casserait l'isolation des tests.
- **Tests session-store** : utiliser `async/await` + helpers `promisify`/`promisifyVoid`. Le pattern `done` est déprécié dans Vitest 4.x (erreur `done() callback is deprecated`).
- **Testabilité de generateScheduled** : `generateScheduledTransactions` instancie `createTransactionsRepo(db)` en interne, ce qui permet l'injection d'une DB de test via le paramètre `db`. Ne pas extraire le repo en singleton module-level.
