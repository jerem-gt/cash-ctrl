# CashCtrl

Application de suivi de comptes bancaires personnels.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| État serveur | TanStack Query v5 |
| Routing | React Router v6 |
| Graphiques | Recharts |
| Backend | Node.js 24 + Express 5 + TypeScript |
| Base de données | SQLite (better-sqlite3) |
| Auth | Sessions serveur (SQLiteSessionStore) + bcrypt |
| Validation | Zod |
| Upload fichiers | Multer |
| CI/CD | GitHub Actions → ghcr.io → Watchtower |

## Fonctionnalités

### Comptes
- Création, modification et suppression de comptes bancaires
- Solde calculé dynamiquement (solde initial + transactions)
- Types de compte configurables (Courant, Épargne, Livret, Crédit, Autre…)
- Association à une banque avec affichage du logo

### Transactions
- Ajout, modification et suppression de transactions (revenus / dépenses)
- Catégories configurables avec couleurs
- Filtrage par compte, catégorie et type
- Transferts entre comptes (les deux legs sont créés/modifiés/supprimés ensemble)

### Banques
- Référentiel de banques géré en base de données
- Logo par banque (stockage local sur le serveur)
- Téléchargement automatique des logos au démarrage pour les banques par défaut : BoursoBank, Fortuneo, Crédit Agricole, Linxea, Amundi, BNP Paribas, Société Générale, Revolut, N26
- Upload manuel d'un logo personnalisé via les paramètres

### Tableau de bord
- Solde total, revenus et dépenses du mois, bilan mensuel
- Graphique donut des dépenses par catégorie (mois en cours)
- Histogramme revenus vs dépenses sur 6 mois
- Liste des dernières transactions

### Transactions planifiées
- Définir des transactions récurrentes : tous les X jours / semaines / mois / années
- Génération automatique à l'horizon configuré (`lead_days`, par défaut 30 jours)
- Support des transferts planifiés (crée les deux legs à chaque occurrence)
- Gestion week-end : autoriser, déplacer au vendredi précédent, ou au lundi suivant
- Idempotent : plusieurs appels ne dupliquent pas les occurrences déjà générées
- Les transactions générées conservent leur `scheduled_id` pour traçabilité

### Export
- Export CSV et JSON des transactions

### Paramètres
- Gestion des catégories de transactions (nom + couleur)
- Gestion des types de compte
- Gestion des banques (nom + logo)
- Gestion des moyens de paiement (nom + icône emoji)

### Affichage uniforme des comptes
Partout dans l'interface, un compte est affiché sous la forme **logo + nom + (banque)** grâce au composant `AccountBadge`.

## Démarrage en développement

```bash
# Cloner et installer
git clone https://github.com/VOUS/cashctrl
cd cashctrl
npm install

# Lancer frontend + backend en parallèle
npm run dev
```

- Frontend : http://localhost:5173 (Vite HMR)
- Backend  : http://localhost:3000
- Le proxy Vite redirige `/api/*` et `/logos/*` vers Express automatiquement

Identifiants par défaut : `admin` / `changeme`

## Structure

```
cashctrl/
├── client/                  # React + Vite
│   └── src/
│       ├── api/             # Fetch wrappers typés
│       ├── components/      # AccountBadge, Sidebar, UI primitives
│       ├── hooks/           # TanStack Query hooks
│       │   ├── useAccounts.ts
│       │   ├── useAccountTypes.ts
│       │   ├── useBanks.ts
│       │   ├── useCategories.ts
│       │   ├── usePaymentMethods.ts
│       │   ├── useTransactions.ts
│       │   ├── useScheduled.ts
│       │   └── useSettings.ts
│       ├── lib/             # Utilitaires (format, dates)
│       ├── pages/           # Dashboard, Transactions, Accounts, Settings, Export, Scheduled
│       └── types/           # Types partagés
├── server/                  # Express + TypeScript
│   └── src/
│       ├── app.ts           # Factory createApp(db) — Express + session + routes
│       ├── db.ts            # Initialisation SQLite (tables, migrations, seeds)
│       ├── session-store.ts # SQLiteSessionStore (better-sqlite3)
│       ├── index.ts         # Point d'entrée production
│       ├── logoDownloader.ts # Téléchargement des logos de banques au démarrage
│       ├── middleware.ts    # Auth guard (requireAuth)
│       ├── lib/
│       │   ├── scheduledLogic.ts  # Fonctions pures de calcul de récurrence
│       │   └── generateScheduled.ts # Génération des transactions planifiées
│       ├── routes/          # Factory functions createXxxRouter(db)
│       │   ├── auth.ts
│       │   ├── accounts.ts
│       │   ├── account-types.ts
│       │   ├── transactions.ts
│       │   ├── transfers.ts
│       │   ├── banks.ts     # CRUD banques + upload logo (Multer)
│       │   ├── categories.ts
│       │   ├── payment-methods.ts
│       │   ├── scheduled.ts # CRUD transactions planifiées
│       │   ├── settings.ts  # lead_days par utilisateur
│       │   └── export.ts
│       └── tests/           # Vitest — 133 tests (TU + TI)
│           ├── session-store.test.ts
│           ├── middleware.test.ts
│           ├── scheduledLogic.test.ts
│           ├── generateScheduled.test.ts
│           ├── helpers/
│           │   ├── testDb.ts   # SQLite :memory: avec schéma complet
│           │   └── testApp.ts  # createTestContext() — app + agent supertest authentifié
│           └── routes/      # Tests d'intégration par ressource (11 fichiers)
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
└── package.json             # npm workspace racine
```

## API

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/accounts` | Liste des comptes |
| POST | `/api/accounts` | Créer un compte |
| PUT | `/api/accounts/:id` | Modifier un compte |
| DELETE | `/api/accounts/:id` | Supprimer un compte |
| GET | `/api/account-types` | Liste des types de compte |
| POST | `/api/account-types` | Créer un type |
| PUT | `/api/account-types/:id` | Modifier un type |
| DELETE | `/api/account-types/:id` | Supprimer un type |
| GET | `/api/transactions` | Liste (filtres : account_id, category, type) |
| POST | `/api/transactions` | Créer une transaction |
| PUT | `/api/transactions/:id` | Modifier (gère les deux legs d'un transfert) |
| DELETE | `/api/transactions/:id` | Supprimer |
| POST | `/api/transactions/transfer` | Créer un transfert entre comptes |
| GET | `/api/banks` | Liste des banques |
| POST | `/api/banks` | Créer une banque |
| PUT | `/api/banks/:id` | Modifier le nom |
| POST | `/api/banks/:id/logo` | Uploader un logo (multipart/form-data) |
| DELETE | `/api/banks/:id` | Supprimer |
| GET | `/api/categories` | Liste des catégories |
| POST | `/api/categories` | Créer |
| PUT | `/api/categories/:id` | Modifier |
| DELETE | `/api/categories/:id` | Supprimer |
| GET | `/api/payment-methods` | Liste des moyens de paiement |
| POST | `/api/payment-methods` | Créer |
| PUT | `/api/payment-methods/:id` | Modifier |
| DELETE | `/api/payment-methods/:id` | Supprimer |
| GET | `/api/export/csv` | Export CSV des transactions |
| GET | `/api/export/json` | Export JSON (backup complet) |
| GET | `/logos/:filename` | Fichiers logo statiques |
| GET | `/api/scheduled` | Liste des transactions planifiées |
| POST | `/api/scheduled` | Créer une planification |
| PUT | `/api/scheduled/:id` | Modifier (regénère les occurrences futures) |
| DELETE | `/api/scheduled/:id` | Supprimer (supprime les occurrences futures non validées) |
| GET | `/api/settings` | Paramètres utilisateur (lead_days) |
| PUT | `/api/settings` | Modifier les paramètres |

## Données persistées

Le dossier `data/` (monté en volume Docker) contient :
- `cashctrl.db` — base SQLite
- `logos/` — logos des banques (`bank-{id}.png`)

## Déploiement sur NAS Synology

```bash
# Sur le NAS
mkdir -p ~/docker/cashctrl/data && cd ~/docker/cashctrl
# Copier docker-compose.yml et éditer les variables d'env
nano docker-compose.yml
# Générer SESSION_SECRET : openssl rand -hex 32
docker compose up -d
```

L'app sera accessible sur `http://IP-DU-NAS:3000`.

Watchtower redémarre automatiquement le container dès qu'une nouvelle image est publiée sur ghcr.io (toutes les 5 minutes).

> **Note :** les logos de banques sont téléchargés depuis l'API favicon de Google au premier démarrage. Un accès Internet est requis pour cette étape ; les logos sont ensuite servis localement.
