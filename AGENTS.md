# AGENTS.md — CashCtrl (Short)

## 🔴 RÈGLES ABSOLUES

### Backend
- Toujours injecter `db` (factory repo uniquement, pas de singleton)
- Valider les inputs avec Zod
- Ne jamais exposer d’erreurs SQL

### Frontend
- Ne jamais utiliser `fetch` → utiliser `client/src/api/client.ts`
- Toujours passer par TanStack Query (useQuery / useMutation)
- Ne pas hardcoder (banques, catégories, etc.)

### Métier (CRITIQUE)
- Un transfert = **2 transactions liées (`transfer_peer_id`)**
- Ne jamais modifier un seul leg
- Transactions planifiées = **idempotentes**
- Ne pas dupliquer la logique de `server/src/lib/`

---

## 🏗️ ARCHITECTURE

### Backend (`server/src`)
modules/{module}/
├── {module}.types.ts
├── {module}.repo.ts      (createXxxRepo(db))
├── {module}.routes.ts    (createXxxRouter(db))

- Les routes utilisent Zod → repo → JSON
- Tous les repos prennent `db` en paramètre

### Frontend (`client/src`)
- API centralisée : `api/client.ts`
- Hooks : `hooks/useXxx.ts` (React Query)
  - `useXxx` → query
  - `useCreate/Update/DeleteXxx` → mutation + invalidate

---

## ➕ AJOUTER UNE FEATURE

### Backend
1. Créer repo (`createXxxRepo`)
2. Créer routes (`createXxxRouter`)
3. Ajouter dans `app.ts`
4. Ajouter tests

### Frontend
1. Ajouter API dans `client.ts`
2. Créer hook React Query
3. Invalider les queries

---

## 🔁 MODIFIER DU CODE

- Toujours modifier l’existant en priorité
- Vérifier si repo / hook existe déjà
- Ne pas dupliquer la logique métier
- Respecter les patterns

---

## ♻️ REFACTORING

- Ne pas casser les tests
- Ne pas changer les signatures sans vérifier les usages
- Garder le comportement métier intact

---

## ⚠️ PIÈGES

- fetch direct ❌
- singleton repo ❌
- hardcode ❌
- modifier 1 seul leg d’un transfert ❌
- dupliquer logique ❌

---

## 🧪 TESTS

### Backend
- Routes → `createTestContext()`
- Logique → `setupFixtures()`

### Frontend (283 tests — 80.58% statements)
- Hooks → QueryClient isolé + `renderHook` + `waitFor`
- Pages/composants → `renderWithProviders` (QueryClient + MemoryRouter)
- API mockée via MSW v2 (`server.use()` pour overrides par test)
- Sélecteurs : `getByRole('button', { name: '✎' })`, regex `/pattern/i` si texte partiel
- Toast : `document.getElementById('toast')?.textContent`

---

## 🧠 STRATÉGIE

1. Identifier module
2. Vérifier existant
3. Appliquer pattern
4. Respecter règles métier
5. Ajouter/adapter tests
