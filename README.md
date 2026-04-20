# CashCtrl

Application de suivi de comptes bancaires personnels.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| État serveur | TanStack Query v5 |
| Routing | React Router v6 |
| Graphiques | Recharts |
| Backend | Node.js + Express + TypeScript |
| Base de données | SQLite (better-sqlite3) |
| Auth | Sessions serveur + bcrypt |
| Validation | Zod |
| CI/CD | GitHub Actions → ghcr.io → Watchtower |

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
- Le proxy Vite redirige `/api/*` vers Express automatiquement

Identifiants par défaut : `admin` / `changeme`

## Structure

```
cashctrl/
├── client/                  # React + Vite
│   └── src/
│       ├── api/             # Fetch wrappers typés
│       ├── components/      # Sidebar, UI primitives
│       ├── hooks/           # TanStack Query hooks
│       ├── lib/             # Utilitaires (format, dates)
│       ├── pages/           # Dashboard, Transactions, etc.
│       └── types/           # Types partagés
├── server/                  # Express + TypeScript
│   └── src/
│       ├── db.ts            # SQLite + queries typées
│       ├── middleware.ts    # Auth guard
│       └── routes/          # auth, accounts, transactions, export
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
└── package.json             # npm workspace racine
```

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
