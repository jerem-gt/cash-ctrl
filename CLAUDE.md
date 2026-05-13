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

### Pre-commit Hook
The project uses Husky and lint-staged to automatically fix linting issues before commits. The pre-commit hook runs `lint-staged` which applies ESLint and Stylelint fixes to staged files.

## TypeScript & Code Quality
- **Strict Mode**: Activé (`strict: true`). Ne jamais utiliser `any`, préférer `unknown`.
- **Path Aliases**: Utiliser `@/*` pour les imports dans `src/` (configuré dans `tsconfig.json`).
- **Pratiques TS**: Interdiction des variables locales/paramètres inutilisés et des cas de fallthrough dans les switchs.
- **Target**: ES2020 / ESNext.

## Architecture & Tech Stack

### Frontend (React)
- **State Management**: Utiliser **TanStack Query** (`@tanstack/react-query`) pour tout l'état asynchrone.
- **Routing**: `react-router-dom` v7+.
- **Components**: Préférer les composants fonctionnels. Utiliser les icônes de `lucide-react`.
- **Styling**: Tailwind CSS 4 avec PostCSS.
- **Charts**: Utiliser `recharts` pour la visualisation financière.

### Backend (Node.js)
- **Logic**: Séparer les responsabilités entre les routes, les services et la validation des données.

## Testing Strategy
- **Runner**: **Vitest** est le test runner global du projet.
- **Client Testing**: Utiliser `@testing-library/react` et `jsdom`.
- **Mocks**: Utiliser **MSW** (Mock Service Worker) pour intercepter les appels API et `vi.fn()` pour les mocks unitaires.

## Project Structure
- `client/src/` : Code source React.
- `server/src/` : Code source de l'API.

## Environment
- Use the **Bash tool** (not PowerShell) to run shell commands.
- Windows paths must use forward slashes and be quoted: `cd "C:/Users/jerem/WebstormProjects/cash-ctrl"`
- PowerShell is blocked by execution policy — do not use it for `npm` commands.