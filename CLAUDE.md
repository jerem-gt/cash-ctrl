# CLAUDE.md

## Project Overview
**CashCtrl** est une solution de gestion financière fullstack.
- **Client**: Application React 19 moderne propulsée par Vite, utilisant Tailwind CSS 4 pour le style et TanStack Query pour la gestion des données.
- **Server**: API Node.js/TypeScript gérant la logique métier et les données.

## Development Commands

### Client (`/client`)
- **Dev Server**: `npm run dev` (Vite)
- **Build**: `npm run build` (tsc + vite build)
- **Preview**: `npm run preview`
- **Unit Tests**: `npm run test` (Vitest)
- **Test Watch**: `npm run test:watch`
- **Coverage**: `npm run test:coverage`
- **Types des tests**: `npm run typecheck:test` (`tsc -p tsconfig.test.json` ; `tsconfig.json` exclut les `*.test.ts(x)`, donc `build` ne les vérifie pas)

### Server (`/server`)
- **Test**: `npm run test` (Vitest)
- **Types (tests inclus)**: `npm run typecheck` (`tsc --noEmit` sur tout `src` ; Vitest et `tsup` ne vérifient pas les types)
- *Note : Utilise les scripts npm définis dans `/server/package.json` pour le développement.*

### Hook pre-commit
Le projet utilise Husky et lint-staged pour corriger automatiquement les problèmes de lint avant chaque commit. Le hook exécute `lint-staged` qui applique ESLint et Stylelint sur les fichiers stagés.

### CI (`.github/workflows/ci.yml`) et fichiers communs avec shelf-ctrl
Le workflow CI/Docker, le `Dockerfile`, le script `prepare-runtime-deps` et le preset Renovate sont **communs à cash-ctrl et shelf-ctrl** et vivent dans le dépôt [`jerem-gt/ctrl-shared`](https://github.com/jerem-gt/ctrl-shared) : `.github/workflows/ci.yml` appelle son workflow réutilisable `app.yml`, la devDependency `@jerem-gt/ctrl-shared` (**même tag que le workflow**) fournit script et `Dockerfile`, `renovate.json` étend `github>jerem-gt/ctrl-shared`. Ne pas les recopier ici : un changement se fait dans `ctrl-shared`, puis un nouveau tag que Renovate propose de monter dans les deux projets. Propre à cash-ctrl : `.github/smoke.env` (variables du conteneur) et `.github/smoke-test.sh` (lit le jeton `setup token:` dans `docker logs`, crée le premier compte via `/api/auth/setup`, puis login ; plus aucun admin par défaut), lancés par le smoke test de l'image après santé, front et `/api/docs/`. Les checks s'appellent `app / 🧪 CI & Tests`, etc.

Le job CI lance lint, vérification des types (client `typecheck:test`, server `typecheck`) et tests coverage (server + client) **en parallèle** dans un même step. Le lint utilise un cache ESLint (`.eslintcache`, gitignoré) persisté entre les runs via `actions/cache` :
- Clé de cache : hash de `package-lock.json` + `eslint.config.js` → toute modification de l'un des deux invalide le cache (run suivant plus lent, le temps de le reconstruire).
- `--cache-strategy content` est **obligatoire** : le checkout réécrit les mtimes à chaque run, la stratégie `metadata` par défaut invaliderait tout.
- Si la config ESLint est renommée/éclatée en plusieurs fichiers, mettre à jour le `hashFiles(...)` de la clé dans le workflow de `ctrl-shared` (pour les deux projets).

Deux artifacts distincts : `sonar-assets` (lcov uniquement, consommé par le job SonarCloud) et `build-assets` (`deploy/` : deps runtime extraites par `prepare-runtime-deps` + `Dockerfile` commun, et dists, serveur bundlé par `server/tsup.config.ts`, consommé par le build Docker ; uploadé sur push uniquement, aucune image n'étant construite sur PR). Concurrence : groupes séparés push / PR, seuls les runs de PR sont annulés. Un nouveau rapport destiné à Sonar va dans `sonar-assets`.

## TypeScript & Code Quality
- **Strict Mode**: Activé (`strict: true`). Ne jamais utiliser `any`, préférer `unknown`.
- **Path Aliases**: Utiliser `@/*` pour les imports dans `src/` (configuré dans `tsconfig.json`).
- **Pratiques TS**: Interdiction des variables locales/paramètres inutilisés et des cas de fallthrough dans les switchs.
- **Target**: Client ES2023 / Server ES2025.
- **Ternaires imbriqués** (règle Sonar) : Ne jamais imbriquer des ternaires. Extraire dans une variable `let` avec `if/else`, ou dans une fonction nommée. Un seul niveau de ternaire est acceptable.
- **Conditions négatives** (règle Sonar) : Dans un `if/else`, mettre la branche positive en premier (`=== null` plutôt que `!= null` comme condition principale).

## Architecture & Tech Stack

### Frontend (React)
- **State Management**: Utiliser **TanStack Query** (`@tanstack/react-query`) pour tout l'état asynchrone.
- **Routing**: `react-router` v7+ (importer depuis `react-router`, pas `react-router-dom`).
- **Components**: Préférer les composants fonctionnels. Utiliser les icônes de `lucide-react`.
- **Styling**: Tailwind CSS 4 avec PostCSS.
- **Charts**: Utiliser `recharts` pour la visualisation financière.
- **Mobile-first**: Toute interface doit être affichable sur mobile. Utiliser les breakpoints Tailwind (`md:`, `lg:`) pour adapter la mise en page. Éviter les largeurs fixes qui dépassent la largeur d'écran mobile.

### Internationalisation (i18n)
L'application est bilingue **français / anglais**. La langue est détectée automatiquement (`i18next-browser-languagedetector` : localStorage puis navigateur, `fallbackLng: 'fr'`) et modifiable via le sélecteur dans les Réglages. Les traductions sont découpées par namespace, chacun mappé à une feature ou page (`client/src/locales/fr/` et `client/src/locales/en/`). Utiliser `useTranslation('<namespace>')` dans le composant concerné. Les strings partagées entre plusieurs features vont dans `common`. Les fichiers `en/` doivent rester un miroir exact des clés `fr/` (mêmes clés, placeholders `{{var}}` et suffixes de pluriel).

Les namespaces sont chargés dynamiquement par nom de fichier (`i18next-resources-to-backend`) : il n'y a **pas** de ressources statiques à déclarer dans `i18n.ts`. Pour ajouter un **nouveau namespace** :
1. Créer `client/src/locales/fr/<namespace>.json` **et** `client/src/locales/en/<namespace>.json`
2. `client/src/i18next.d.ts` — ajouter l'import type et la clé dans `CustomTypeOptions.resources`
3. `client/src/tests/helpers/i18nTestUtils.ts` — ajouter le namespace au tableau `LAZY_NAMESPACES`

Le formatage des montants/dates suit la langue via `currentLocale()` de `client/src/lib/format.ts` (`fr-FR` ↔ `en-GB`), la devise restant EUR.

### Backend (Node.js)
- **Logic**: Séparer les responsabilités entre les routes, les services et la validation des données.
- **Export/Import** : Tout ajout ou modification de champ sur une entité exportée (`insurance_operations`, `stock_operations`, `loans`, `transactions`, etc.) doit être répercuté dans les trois endroits suivants :
  1. `export.types.ts` — interface `FullExport*`
  2. `export.repo.ts` — requête SQL `SELECT`
  3. `import.routes.ts` + `import.repo.ts` — schéma Zod et `INSERT`

## Testing Strategy
- **Runner**: **Vitest** est le test runner global du projet.
- **Client Testing**: Utiliser `@testing-library/react` et `jsdom`.
- **Mocks**: Utiliser **MSW** (Mock Service Worker) pour intercepter les appels API et `vi.fn()` pour les mocks unitaires.
- **Intitulés de tests** : laisser Prettier gérer les quotes (`singleQuote: true` dans la config). Prettier bascule automatiquement en double guillemets quand l'intitulé contient une apostrophe française (`d'`, `l'`, `n'`…), ce qui protège déjà contre les bugs de parsing silencieux. Utiliser des backticks `` ` `` uniquement si l'intitulé contient lui-même des guillemets doubles (ex. texte UI cité, valeur d'enum).

### `vi.mock` côté client — pattern obligatoire
Le client tourne avec `isolate: false` : `vi.mock` (hoisté) leak entre fichiers. Utiliser `vi.doMock` + import dynamique du SUT :

```ts
let MyComponent: typeof import('./MyComponent').MyComponent;

beforeAll(async () => {
  vi.doMock('@/some-dep', () => ({ ... }));
  vi.resetModules();
  ({ MyComponent } = await import('./MyComponent'));
});

afterAll(() => {
  vi.doUnmock('@/some-dep');
  vi.resetModules();
});
```

Si un module **avec état** (store, singleton) est partagé entre le test et le SUT, le re-importer aussi après le reset.

### Écrire les TUs avec chaque évolution
Pour tout ajout ou modification non trivial, mettre à jour systématiquement :

1. **Test de route serveur** (`modules/<module>/<module>.routes.test.ts`) — comportement nominal, validation 400, cas 404/409.
2. **Test de hook client** (`hooks/use<Feature>.test.ts`) — happy path pour chaque mutation/query ajoutée.
3. **Test de composant** (`components/` ou `features/**/components/`) — interactions utilisateur, toasts, états loading/error.
4. **Handler MSW** (`tests/msw/handlers.ts`) — ajouter l'intercepteur du nouvel endpoint. Placer les handlers littéraux (ex. `/api/banks/reorder`) **avant** les handlers paramétriques (`/api/banks/:id`) pour éviter le masquage.
5. **Fixtures** (`tests/fixtures.ts`) — mettre à jour les objets typés si un type gagne un nouveau champ requis.

## Review après développement
Toute implémentation non triviale (directe ou déléguée à un sous-agent) se termine par une review :
1. Vérifications vertes : tests server + client, `typecheck:test` (client) + `typecheck` (server), build client, lint des fichiers touchés.
2. Commit de la feature (après accord de l'utilisateur).
3. Skill `mattpocock-skills:code-review` depuis le commit parent : source **Spec** = la spec validée (mémoire, issue ou ticket), source **Standards** = ce fichier.
4. Présenter les deux axes, puis corriger les findings validés par l'utilisateur dans un commit dédié.

Terminé quand chaque finding est corrigé ou explicitement écarté par l'utilisateur.

## Project Structure
- `client/src/` : Code source React.
- `server/src/` : Code source de l'API.

## Mise à jour de la documentation (README + screenshots)

Modifier `README.md` directement pour les features et compteurs. Pour les screenshots, lancer les deux serveurs + `npm run db:seed:test` (server), puis :

```bash
node docs/take-screenshots.mjs
```

Captures dans `docs/screenshots/` (clair + `-dark`). Pour une nouvelle page : ajouter `page.goto` + `shot(...)` dans `captureAll` et une ligne dans le tableau `## Aperçu` du README.

## Déploiement
Stack Portainer sur le NAS Synology, qui lit `docker-compose.yml` tel quel sur la branche `develop` de GitHub : prod (`latest`, port 3000) et dev (`dev`, port 4000) dans la même stack. Watchtower met à jour les **images** automatiquement ; un changement du **compose** ne s'applique qu'au redéploiement manuel de la stack (pull and redeploy). Une variable ajoutée au compose se crée **d'abord** dans la stack Portainer, sinon elle arrive vide. Secrets : `SESSION_SECRET` (prod), `SESSION_SECRET_DEV` (dev, distinct : les cookies ne sont pas isolés par port), `SMTP_PASS` ; `APP_URL` propre à chaque service.

## Environnement
- Utiliser l'outil **Bash** (pas PowerShell) pour les commandes shell.
- Les chemins Windows doivent utiliser des slashes et être entre guillemets : `"C:/Users/jerem/WebstormProjects/cash-ctrl/client"`
- **Jamais de `cd`** (chaque `cd …&&` déclenche une confirmation) : le répertoire courant est déjà la racine ; utiliser `npm --prefix client run test`, `git -C <dir>`, `npx eslint <chemins>` et des chemins absolus.
- PowerShell est bloqué par la politique d'exécution — ne pas l'utiliser pour les commandes `npm`.
- **GitHub CLI** : `gh` est disponible dans le Bash PATH (ajouté via `~/.bashrc`). Utiliser directement `gh pr create ...`