tu peux initial# CashCtrl

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
| Auth | Sessions serveur + bcrypt |
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

### Export
- Export CSV des transactions avec filtres

### Paramètres
- Gestion des catégories de transactions (nom + couleur)
- Gestion des types de compte
- Gestion des banques (nom + logo)

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
│       │   └── useTransactions.ts
│       ├── lib/             # Utilitaires (format, dates)
│       ├── pages/           # Dashboard, Transactions, Accounts, Settings, Export
│       └── types/           # Types partagés
├── server/                  # Express + TypeScript
│   └── src/
│       ├── db.ts            # SQLite + queries typées
│       ├── logoDownloader.ts # Téléchargement des logos de banques au démarrage
│       ├── middleware.ts    # Auth guard
│       └── routes/
│           ├── auth.ts
│           ├── accounts.ts
│           ├── account-types.ts
│           ├── transactions.ts
│           ├── banks.ts     # CRUD banques + upload logo (Multer)
│           ├── categories.ts
│           └── export.ts
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
| GET | `/api/export/csv` | Export CSV des transactions |
| GET | `/logos/:filename` | Fichiers logo statiques |

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
