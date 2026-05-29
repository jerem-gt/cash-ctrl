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

### Server (`/server`)
- **Test**: `npm run test` (Vitest)
- *Note : Utilise les scripts npm définis dans `/server/package.json` pour le développement.*

### Hook pre-commit
Le projet utilise Husky et lint-staged pour corriger automatiquement les problèmes de lint avant chaque commit. Le hook exécute `lint-staged` qui applique ESLint et Stylelint sur les fichiers stagés.

## TypeScript & Code Quality
- **Strict Mode**: Activé (`strict: true`). Ne jamais utiliser `any`, préférer `unknown`.
- **Path Aliases**: Utiliser `@/*` pour les imports dans `src/` (configuré dans `tsconfig.json`).
- **Pratiques TS**: Interdiction des variables locales/paramètres inutilisés et des cas de fallthrough dans les switchs.
- **Target**: Client ES2023 / Server ES2024.
- **Ternaires imbriqués** (règle Sonar) : Ne jamais imbriquer des ternaires. Extraire dans une variable `let` avec `if/else`, ou dans une fonction nommée. Un seul niveau de ternaire est acceptable.
- **Conditions négatives** (règle Sonar) : Dans un `if/else`, mettre la branche positive en premier (`=== null` plutôt que `!= null` comme condition principale).

## Architecture & Tech Stack

### Frontend (React)
- **State Management**: Utiliser **TanStack Query** (`@tanstack/react-query`) pour tout l'état asynchrone.
- **Routing**: `react-router-dom` v7+.
- **Components**: Préférer les composants fonctionnels. Utiliser les icônes de `lucide-react`.
- **Styling**: Tailwind CSS 4 avec PostCSS.
- **Charts**: Utiliser `recharts` pour la visualisation financière.
- **Mobile-first**: Toute interface doit être affichable sur mobile. Utiliser les breakpoints Tailwind (`md:`, `lg:`) pour adapter la mise en page. Éviter les largeurs fixes qui dépassent la largeur d'écran mobile.

### Internationalisation (i18n)
L'application est bilingue **français / anglais**. La langue est détectée automatiquement (`i18next-browser-languagedetector` : localStorage puis navigateur, `fallbackLng: 'fr'`) et modifiable via le sélecteur dans les Réglages. Les traductions sont découpées par namespace, chacun mappé à une feature ou page (`client/src/locales/fr/` et `client/src/locales/en/`). Utiliser `useTranslation('<namespace>')` dans le composant concerné. Les strings partagées entre plusieurs features vont dans `common`. Les fichiers `en/` doivent rester un miroir exact des clés `fr/` (mêmes clés, placeholders `{{var}}` et suffixes de pluriel).

Pour ajouter un **nouveau namespace**, mettre à jour :
1. Créer `client/src/locales/fr/<namespace>.json` **et** `client/src/locales/en/<namespace>.json`
2. `client/src/i18n.ts` — ajouter l'import et la ressource dans `resources.fr` **et** `resources.en`
3. `client/src/i18next.d.ts` — ajouter l'import type et la clé dans `CustomTypeOptions.resources`

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

### Écrire les TUs avec chaque évolution
Pour tout ajout ou modification non trivial, mettre à jour systématiquement :

1. **Test de route serveur** (`modules/<module>/<module>.routes.test.ts`) — comportement nominal, validation 400, cas 404/409.
2. **Test de hook client** (`hooks/use<Feature>.test.ts`) — happy path pour chaque mutation/query ajoutée.
3. **Test de composant** (`components/` ou `features/**/components/`) — interactions utilisateur, toasts, états loading/error.
4. **Handler MSW** (`tests/msw/handlers.ts`) — ajouter l'intercepteur du nouvel endpoint. Placer les handlers littéraux (ex. `/api/banks/reorder`) **avant** les handlers paramétriques (`/api/banks/:id`) pour éviter le masquage.
5. **Fixtures** (`tests/fixtures.ts`) — mettre à jour les objets typés si un type gagne un nouveau champ requis.

## Project Structure
- `client/src/` : Code source React.
- `server/src/` : Code source de l'API.

## Environnement
- Utiliser l'outil **Bash** (pas PowerShell) pour les commandes shell.
- Les chemins Windows doivent utiliser des slashes et être entre guillemets : `cd "C:/Users/jerem/WebstormProjects/cash-ctrl"`
- PowerShell est bloqué par la politique d'exécution — ne pas l'utiliser pour les commandes `npm`.
- **GitHub CLI** : `gh` est disponible dans le Bash PATH (ajouté via `~/.bashrc`). Utiliser directement `gh pr create ...`