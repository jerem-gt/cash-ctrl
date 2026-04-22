# AGENTS.md — CashCtrl

Instructions pour les agents IA travaillant sur ce dépôt.

## Vue d'ensemble

CashCtrl est une application de suivi de finances personnelles en monorepo npm workspace :
- `client/` — React 19 + Vite + Tailwind CSS 4 + TanStack Query v5
- `server/` — Node.js 24 + Express 5 + TypeScript + better-sqlite3 + Zod

## Architecture

### Serveur (`server/src/`)

**`db.ts`** — Source de vérité unique pour la base de données.
- Toutes les tables sont créées ici (`CREATE TABLE IF NOT EXISTS`)
- Les migrations légères (ex : `ALTER TABLE`) sont appliquées ici au démarrage
- Les seeds utilisent `INSERT OR IGNORE` pour être idempotents
- Toutes les requêtes préparées sont exportées depuis ce fichier
- Ne pas créer de requêtes SQL ailleurs

**`lib/`** — Logique métier découplée de la couche HTTP.
- `scheduledLogic.ts` — Fonctions **pures** de calcul de dates de récurrence (aucun import DB). À importer depuis les tests unitaires.
- `generateScheduled.ts` — Génération idempotente des transactions planifiées. Accepte un paramètre `database` optionnel (défaut : `defaultDb`) pour l'injection en tests.

**`routes/`** — Un fichier par ressource. Pattern uniforme :
1. Zod schema pour valider le body
2. Appel aux queries préparées de `db.ts`
3. Réponse JSON

**`logoDownloader.ts`** — Télécharge les logos des banques par défaut au démarrage via l'API favicon de Google. Les logos sont stockés dans `DATA_DIR/logos/`.

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
- La correspondance banque ↔ domaine pour le téléchargement auto est dans `logoDownloader.ts` (tableau `BANK_CONFIG`, clés sans accents)
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

Tests serveur (Vitest) :
```bash
npm test --workspace=server        # Exécution unique
npm run test:watch --workspace=server  # Mode watch
```

> **Attention tsx cache** : `tsx watch` maintient un cache disque dans `node_modules/.cache/tsx/`. Le script `dev` utilise `--no-cache` pour éviter de servir du code compilé périmé.

## Déploiement

CI/CD via GitHub Actions → image Docker `ghcr.io/jerem-gt/cash-ctrl:latest` → Watchtower pull auto.

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
- **Testabilité de generateScheduled** : les requêtes SQL sont créées à l'intérieur de `generateScheduledTransactions`, pas en module-level, pour permettre l'injection d'une DB de test via le second paramètre optionnel.
