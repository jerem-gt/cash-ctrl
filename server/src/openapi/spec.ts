import { createAuthOpenApiPaths } from '@jerem-gt/ctrl-shared/server/auth';
import {
  body,
  errorResponse,
  errorSchema,
  pathInt,
  pId,
  queryParams,
  r200,
  r201,
  r204,
  r400,
  r404,
  r409,
  sessionAuth,
  sessionCookieScheme,
} from '@jerem-gt/ctrl-shared/server/openapi';
import type { ZodType } from 'zod';

import { ERROR_MESSAGES } from '../lib/errorCodes.js';
import { accountTypeSchema } from '../modules/account-types/account-types.routes.js';
import {
  accountSchema,
  closeSchema,
  favoriteSchema,
  favoritesReorderSchema,
} from '../modules/accounts/accounts.routes.js';
import { LANGUAGES, SESSION_COOKIE } from '../modules/auth/authOptions.js';
import { bankSchema, reorderSchema } from '../modules/banks/banks.routes.js';
import { categorySchema } from '../modules/categories/categories.routes.js';
import {
  matchQuerySchema,
  ruleSchema,
} from '../modules/categorization-rules/categorization-rules.routes.js';
import { executeSchema, jsonFullSchema } from '../modules/import/import.routes.js';
import {
  arbitrageSchema,
  createSupportSchema,
  interetsSchema,
  rachatSchema,
  revaloriserSchema,
  updateOperationSchema,
  versementSchema,
} from '../modules/insurance/insurance.routes.js';
import {
  createLoanSchema,
  updateInstallmentSchema,
  updateLoanSchema,
} from '../modules/loans/loans.routes.js';
import { paymentMethodSchema } from '../modules/payment-methods/payment-methods.routes.js';
import {
  attributedAmountSchema,
  linkSchema,
  statusSchema,
} from '../modules/reimbursements/reimbursements.routes.js';
import { scheduledSchema } from '../modules/scheduled/scheduled.routes.js';
import { settingsSchema, systemRefsSchema } from '../modules/settings/settings.routes.js';
import {
  accountBalanceHistoryQuerySchema,
  forecastQuerySchema,
} from '../modules/stats/stats.routes.js';
import {
  buySchema,
  editOperationSchema,
  stockTransferSchema,
} from '../modules/stocks/stocks.routes.js';
import {
  createSubcategorySchema,
  updateSubcategorySchema,
} from '../modules/subcategories/subcategories.routes.js';
import {
  querySchema as transactionQuerySchema,
  transactionSchema,
  validateSchema,
} from '../modules/transactions/transactions.routes.js';
import { transferSchema, transferUpdateSchema } from '../modules/transfers/transfers.routes.js';

// ─── helpers (communs : @jerem-gt/ctrl-shared/server/openapi) ──────────────

// Génère un POST sur /api/<module>/{accountId}/<action> (insurance, stocks…).
function accountIdPost(
  module: string,
  tag: string,
  action: string,
  summary: string,
  actionSchema: ZodType,
) {
  return {
    [`/api/${module}/{accountId}/${action}`]: {
      post: {
        tags: [tag],
        summary,
        security: sessionAuth,
        parameters: pAccountId,
        requestBody: body(actionSchema),
        // 404 : compte inconnu ou d'un autre utilisateur.
        responses: { ...r201, ...r400, ...r404 },
      },
    },
  };
}

/** Réponses d'une création CRUD (sauf ressource qui dépend d'une autre : 404 en plus). */
const CRUD_CREATE_RESPONSES = { ...r201, ...r400 };

// Génère les 4 opérations standard (list / create / update / delete) pour une ressource CRUD.
function crudPaths(
  base: string,
  tag: string,
  labels: { list: string; create: string; update: string; remove: string },
  createSchema: ZodType,
  updateSchema: ZodType = createSchema,
  createResponses: Record<number, unknown> = CRUD_CREATE_RESPONSES,
) {
  return {
    [base]: {
      get: { tags: [tag], summary: labels.list, security: sessionAuth, responses: r200() },
      post: {
        tags: [tag],
        summary: labels.create,
        security: sessionAuth,
        requestBody: body(createSchema),
        responses: createResponses,
      },
    },
    [`${base}/{id}`]: {
      put: {
        tags: [tag],
        summary: labels.update,
        security: sessionAuth,
        parameters: pId,
        requestBody: body(updateSchema),
        responses: { ...r200(), ...r400, ...r404 },
      },
      delete: {
        tags: [tag],
        summary: labels.remove,
        security: sessionAuth,
        parameters: pId,
        responses: { ...r204, ...r400, ...r404, ...r409 },
      },
    },
  };
}
const pAccountId = [pathInt('accountId')];
const pLoanId = [pathInt('loanId')];
const pTransactionId = [pathInt('transactionId')];
const pAccountIdOperationId = [pathInt('accountId'), pathInt('operationId')];
const pAccountIdSupportId = [pathInt('accountId'), pathInt('supportId')];
const pTransactionIdLinkedId = [pathInt('transactionId'), pathInt('linkedId')];
const pLoanIdInstallmentId = [pathInt('loanId'), pathInt('installmentId')];

// ─── spec ──────────────────────────────────────────────────────────────────

export function buildOpenApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'CashCtrl API',
      version: '1.0.0',
      description: 'API REST interne de CashCtrl (gestion financière personnelle).',
    },
    components: {
      schemas: { Error: errorSchema(Object.keys(ERROR_MESSAGES)) },
      securitySchemes: sessionCookieScheme(SESSION_COOKIE),
    },
    paths: {
      // ── Auth et utilisateurs (admin) : module d'auth de ctrl-shared ─────
      ...createAuthOpenApiPaths({ languages: LANGUAGES, tags: { auth: 'Auth', users: 'Users' } }),

      // ── Accounts ─────────────────────────────────────────────────────────
      '/api/accounts': {
        get: {
          tags: ['Accounts'],
          summary: 'Liste des comptes',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Accounts'],
          summary: 'Créer un compte',
          security: sessionAuth,
          requestBody: body(accountSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/accounts/{id}': {
        put: {
          tags: ['Accounts'],
          summary: 'Modifier un compte',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(accountSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Accounts'],
          summary: 'Supprimer un compte',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      '/api/accounts/{id}/frequent-transactions': {
        get: {
          tags: ['Accounts'],
          summary: 'Transactions fréquentes du compte (6 derniers mois)',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/accounts/favorites/reorder': {
        put: {
          tags: ['Accounts'],
          summary: 'Réordonner les comptes favoris (liste complète des favoris actifs)',
          security: sessionAuth,
          requestBody: body(favoritesReorderSchema),
          responses: { ...r204, ...r400, 409: errorResponse('Favorites out of sync') },
        },
      },
      '/api/accounts/{id}/favorite': {
        put: {
          tags: ['Accounts'],
          summary: 'Ajouter ou retirer un compte des favoris (pas un compte clôturé)',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(favoriteSchema),
          responses: { ...r200(), ...r400, ...r404, ...r409 },
        },
      },
      '/api/accounts/{id}/close': {
        post: {
          tags: ['Accounts'],
          summary: 'Clôturer un compte',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(closeSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/accounts/{id}/reopen': {
        post: {
          tags: ['Accounts'],
          summary: 'Réouvrir un compte',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r400, ...r404 },
        },
      },

      // ── Account Types ─────────────────────────────────────────────────────
      ...crudPaths(
        '/api/account-types',
        'Account Types',
        {
          list: 'Liste des types de compte',
          create: 'Créer un type de compte',
          update: 'Modifier un type de compte',
          remove: 'Supprimer un type de compte',
        },
        accountTypeSchema,
      ),

      // ── Banks ─────────────────────────────────────────────────────────────
      '/api/banks': {
        get: {
          tags: ['Banks'],
          summary: 'Liste des banques',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Banks'],
          summary: 'Créer une banque',
          security: sessionAuth,
          requestBody: body(bankSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/banks/reorder': {
        put: {
          tags: ['Banks'],
          summary: 'Réordonner les banques',
          security: sessionAuth,
          requestBody: body(reorderSchema),
          responses: { ...r204, ...r400 },
        },
      },
      '/api/banks/{id}': {
        put: {
          tags: ['Banks'],
          summary: 'Modifier une banque',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(bankSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Banks'],
          summary: 'Supprimer une banque',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404, ...r409 },
        },
      },
      '/api/banks/{id}/logo': {
        post: {
          tags: ['Banks'],
          summary: "Uploader le logo d'une banque",
          security: sessionAuth,
          parameters: pId,
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { logo: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
          responses: { ...r200(), ...r400, ...r404 },
        },
      },

      // ── Categories ────────────────────────────────────────────────────────
      ...crudPaths(
        '/api/categories',
        'Categories',
        {
          list: 'Liste des catégories',
          create: 'Créer une catégorie',
          update: 'Modifier une catégorie',
          remove: 'Supprimer une catégorie',
        },
        categorySchema,
      ),

      // ── Subcategories ─────────────────────────────────────────────────────
      ...crudPaths(
        '/api/subcategories',
        'Subcategories',
        {
          list: 'Liste des sous-catégories',
          create: 'Créer une sous-catégorie',
          update: 'Modifier une sous-catégorie',
          remove: 'Supprimer une sous-catégorie',
        },
        createSubcategorySchema,
        updateSubcategorySchema,
        // 404 : catégorie parente inconnue.
        { ...r201, ...r400, ...r404 },
      ),

      // ── Payment Methods ───────────────────────────────────────────────────
      ...crudPaths(
        '/api/payment-methods',
        'Payment Methods',
        {
          list: 'Liste des moyens de paiement',
          create: 'Créer un moyen de paiement',
          update: 'Modifier un moyen de paiement',
          remove: 'Supprimer un moyen de paiement',
        },
        paymentMethodSchema,
      ),

      // ── Transactions ──────────────────────────────────────────────────────
      '/api/transactions': {
        get: {
          tags: ['Transactions'],
          summary: 'Liste des transactions (paginée)',
          security: sessionAuth,
          parameters: queryParams(transactionQuerySchema),
          responses: { ...r200('Paginated transaction list'), ...r400 },
        },
        post: {
          tags: ['Transactions'],
          summary: 'Créer une transaction',
          security: sessionAuth,
          requestBody: body(transactionSchema),
          responses: { ...r201, ...r400, ...r404 },
        },
      },
      '/api/transactions/{id}': {
        put: {
          tags: ['Transactions'],
          summary: 'Modifier une transaction',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(transactionSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Transactions'],
          summary: 'Supprimer une transaction',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      '/api/transactions/{id}/validate': {
        patch: {
          tags: ['Transactions'],
          summary: 'Valider / dévalider une transaction',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(validateSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },

      // ── Transfers ─────────────────────────────────────────────────────────
      '/api/transfers': {
        post: {
          tags: ['Transfers'],
          summary: 'Créer un virement',
          security: sessionAuth,
          requestBody: body(transferSchema),
          responses: { ...r201, ...r400, ...r404 },
        },
      },
      '/api/transfers/{id}': {
        put: {
          tags: ['Transfers'],
          summary: 'Modifier un virement',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(transferUpdateSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Transfers'],
          summary: 'Supprimer un virement',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },

      // ── Reimbursements ────────────────────────────────────────────────────
      '/api/reimbursements/pending': {
        get: {
          tags: ['Reimbursements'],
          summary: 'Remboursements en attente',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/reimbursements/recent': {
        get: {
          tags: ['Reimbursements'],
          summary: 'Remboursements récents',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/reimbursements/{transactionId}': {
        get: {
          tags: ['Reimbursements'],
          summary: "Remboursements d'une transaction",
          security: sessionAuth,
          parameters: pTransactionId,
          responses: { ...r200(), ...r400 },
        },
        post: {
          tags: ['Reimbursements'],
          summary: 'Lier un remboursement à une transaction',
          security: sessionAuth,
          parameters: pTransactionId,
          requestBody: body(linkSchema),
          responses: { ...r201, ...r400, ...r404 },
        },
      },
      '/api/reimbursements/{transactionId}/status': {
        patch: {
          tags: ['Reimbursements'],
          summary: 'Changer le statut de remboursement',
          security: sessionAuth,
          parameters: pTransactionId,
          requestBody: body(statusSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/reimbursements/{transactionId}/{linkedId}': {
        patch: {
          tags: ['Reimbursements'],
          summary: 'Modifier le montant attribué',
          security: sessionAuth,
          parameters: pTransactionIdLinkedId,
          requestBody: body(attributedAmountSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Reimbursements'],
          summary: 'Délier un remboursement',
          security: sessionAuth,
          parameters: pTransactionIdLinkedId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },

      // ── Scheduled ─────────────────────────────────────────────────────────
      '/api/scheduled': {
        get: {
          tags: ['Scheduled'],
          summary: 'Liste des opérations récurrentes',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Scheduled'],
          summary: 'Créer une opération récurrente',
          security: sessionAuth,
          requestBody: body(scheduledSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/scheduled/{id}': {
        put: {
          tags: ['Scheduled'],
          summary: 'Modifier une opération récurrente',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(scheduledSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Scheduled'],
          summary: 'Supprimer une opération récurrente',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },

      // ── Categorization Rules ──────────────────────────────────────────────
      '/api/categorization-rules': {
        get: {
          tags: ['Categorization Rules'],
          summary: 'Liste des règles de catégorisation',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Categorization Rules'],
          summary: 'Créer une règle',
          security: sessionAuth,
          requestBody: body(ruleSchema),
          responses: { ...r201, ...r400 },
        },
        delete: {
          tags: ['Categorization Rules'],
          summary: 'Supprimer toutes les règles',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/categorization-rules/match': {
        get: {
          tags: ['Categorization Rules'],
          summary: 'Trouver la règle correspondant à une description',
          security: sessionAuth,
          parameters: queryParams(matchQuerySchema),
          responses: r200(),
        },
      },
      '/api/categorization-rules/init-from-history': {
        post: {
          tags: ['Categorization Rules'],
          summary: "Initialiser les règles depuis l'historique",
          security: sessionAuth,
          responses: r201,
        },
      },
      '/api/categorization-rules/{id}': {
        put: {
          tags: ['Categorization Rules'],
          summary: 'Modifier une règle',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(ruleSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Categorization Rules'],
          summary: 'Supprimer une règle',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },

      // ── Settings ──────────────────────────────────────────────────────────
      '/api/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Récupérer les réglages',
          security: sessionAuth,
          responses: r200(),
        },
        put: {
          tags: ['Settings'],
          summary: 'Mettre à jour les réglages',
          security: sessionAuth,
          requestBody: body(settingsSchema),
          responses: { ...r200(), ...r400 },
        },
      },
      '/api/settings/system-refs': {
        patch: {
          tags: ['Settings'],
          summary: 'Mettre à jour les références système',
          security: sessionAuth,
          requestBody: body(systemRefsSchema),
          responses: { ...r200(), ...r400 },
        },
      },

      // ── Stocks ────────────────────────────────────────────────────────────
      '/api/stocks/{accountId}/positions': {
        get: {
          tags: ['Stocks'],
          summary: "Positions d'un compte investissement",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/stocks/{accountId}/operations': {
        get: {
          tags: ['Stocks'],
          summary: "Opérations d'un compte investissement",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r404 },
        },
      },
      ...accountIdPost('stocks', 'Stocks', 'buy', 'Acheter des titres', buySchema),
      ...accountIdPost('stocks', 'Stocks', 'sell', 'Vendre des titres', buySchema),
      ...accountIdPost(
        'stocks',
        'Stocks',
        'transfer',
        'Transférer des titres entre comptes',
        stockTransferSchema,
      ),
      '/api/stocks/{accountId}/operations/{operationId}': {
        put: {
          tags: ['Stocks'],
          summary: 'Modifier une opération',
          security: sessionAuth,
          parameters: pAccountIdOperationId,
          requestBody: body(editOperationSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/stocks/search': {
        get: {
          tags: ['Stocks'],
          summary: 'Rechercher un ticker (Yahoo Finance)',
          security: sessionAuth,
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 3 } },
          ],
          responses: r200(),
        },
      },
      '/api/stocks/tickers': {
        get: {
          tags: ['Stocks'],
          summary: 'Lister les tickers en cache (cotes)',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/stocks/tickers/{ticker}': {
        delete: {
          tags: ['Stocks'],
          summary: 'Supprimer la cotation en cache d’un ticker inutilisé',
          security: sessionAuth,
          parameters: [{ name: 'ticker', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { ...r204, ...r400, ...r404, ...r409 },
        },
        put: {
          tags: ['Stocks'],
          summary: 'Renommer un ticker et répercuter partout où il est utilisé',
          security: sessionAuth,
          parameters: [{ name: 'ticker', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { new_ticker: { type: 'string' } },
                  required: ['new_ticker'],
                },
              },
            },
          },
          responses: { ...r204, ...r400, ...r404, ...r409 },
        },
      },
      '/api/stocks/price/{ticker}': {
        get: {
          tags: ['Stocks'],
          summary: "Prix actuel d'un ticker",
          security: sessionAuth,
          parameters: [{ name: 'ticker', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/stocks/prices/refresh': {
        post: {
          tags: ['Stocks'],
          summary: "Rafraîchir les prix de l'utilisateur",
          security: sessionAuth,
          responses: r204,
        },
      },

      // ── Insurance ─────────────────────────────────────────────────────────
      '/api/insurance/{accountId}/supports': {
        get: {
          tags: ['Insurance'],
          summary: "Supports d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r404 },
        },
        post: {
          tags: ['Insurance'],
          summary: 'Ajouter un support',
          security: sessionAuth,
          parameters: pAccountId,
          requestBody: body(createSupportSchema),
          responses: { ...r201, ...r400, ...r404 },
        },
      },
      '/api/insurance/{accountId}/supports/{supportId}': {
        delete: {
          tags: ['Insurance'],
          summary: 'Supprimer un support',
          security: sessionAuth,
          parameters: pAccountIdSupportId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      '/api/insurance/{accountId}/positions': {
        get: {
          tags: ['Insurance'],
          summary: "Positions d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/insurance/{accountId}/operations': {
        get: {
          tags: ['Insurance'],
          summary: "Opérations d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/insurance/{accountId}/operations/{operationId}': {
        put: {
          tags: ['Insurance'],
          summary: 'Modifier une opération assurance',
          security: sessionAuth,
          parameters: pAccountIdOperationId,
          requestBody: body(updateOperationSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Insurance'],
          summary: 'Supprimer une opération assurance',
          security: sessionAuth,
          parameters: pAccountIdOperationId,
          responses: { ...r204, ...r400, ...r404 },
        },
      },
      ...accountIdPost(
        'insurance',
        'Insurance',
        'versement',
        'Effectuer un versement',
        versementSchema,
      ),
      ...accountIdPost('insurance', 'Insurance', 'rachat', 'Effectuer un rachat', rachatSchema),
      ...accountIdPost(
        'insurance',
        'Insurance',
        'arbitrage',
        'Effectuer un arbitrage',
        arbitrageSchema,
      ),
      ...accountIdPost(
        'insurance',
        'Insurance',
        'interets',
        'Enregistrer des intérêts',
        interetsSchema,
      ),
      ...accountIdPost(
        'insurance',
        'Insurance',
        'revalorisation',
        'Revaloriser un contrat',
        revaloriserSchema,
      ),

      // ── Loans ─────────────────────────────────────────────────────────────
      '/api/loans': {
        post: {
          tags: ['Loans'],
          summary: 'Créer un prêt',
          security: sessionAuth,
          requestBody: body(createLoanSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/loans/account/{accountId}': {
        get: {
          tags: ['Loans'],
          summary: "Prêts d'un compte",
          security: sessionAuth,
          parameters: pAccountId,
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/loans/{loanId}': {
        patch: {
          tags: ['Loans'],
          summary: 'Modifier un prêt',
          security: sessionAuth,
          parameters: pLoanId,
          requestBody: body(updateLoanSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/loans/{loanId}/installments': {
        get: {
          tags: ['Loans'],
          summary: "Échéancier d'un prêt",
          security: sessionAuth,
          parameters: pLoanId,
          responses: { ...r200(), ...r400 },
        },
      },
      '/api/loans/{loanId}/installments/{installmentId}': {
        patch: {
          tags: ['Loans'],
          summary: 'Modifier une échéance',
          security: sessionAuth,
          parameters: pLoanIdInstallmentId,
          requestBody: body(updateInstallmentSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },

      // ── Stats ─────────────────────────────────────────────────────────────
      '/api/stats': {
        get: {
          tags: ['Stats'],
          summary: 'Statistiques du tableau de bord',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/stats/balance-history': {
        get: {
          tags: ['Stats'],
          summary: 'Historique des soldes',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/stats/forecast': {
        get: {
          tags: ['Stats'],
          summary: 'Prévision du solde (opérations planifiées), tous comptes ou un seul',
          security: sessionAuth,
          parameters: queryParams(forecastQuerySchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/stats/accounts/{accountId}/balance-history': {
        get: {
          tags: ['Stats'],
          summary: "Historique du solde d'un compte",
          security: sessionAuth,
          parameters: [...pAccountId, ...queryParams(accountBalanceHistoryQuerySchema)],
          responses: { ...r200(), ...r400, ...r404 },
        },
      },
      '/api/stats/report-years': {
        get: {
          tags: ['Stats'],
          summary: 'Années disponibles pour le rapport',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/stats/report': {
        get: {
          tags: ['Stats'],
          summary: 'Rapport annuel',
          security: sessionAuth,
          parameters: [
            { name: 'year', in: 'query', required: true, schema: { type: 'integer' } },
            { name: 'account_id', in: 'query', required: false, schema: { type: 'integer' } },
          ],
          responses: { ...r200(), ...r400 },
        },
      },
      '/api/stats/profitability': {
        get: {
          tags: ['Stats'],
          summary: 'Performance du portefeuille boursier',
          security: sessionAuth,
          responses: r200(),
        },
      },

      // ── Tax ───────────────────────────────────────────────────────────────
      '/api/tax/years': {
        get: {
          tags: ['Tax'],
          summary: 'Années fiscales disponibles',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/tax/{year}': {
        get: {
          tags: ['Tax'],
          summary: 'Simulateur fiscal pour une année',
          security: sessionAuth,
          parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { ...r200(), ...r400, ...r404 },
        },
      },

      // ── Search ────────────────────────────────────────────────────────────
      '/api/search': {
        get: {
          tags: ['Search'],
          summary: 'Recherche globale (comptes, transactions, planifications, titres)',
          security: sessionAuth,
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
          ],
          responses: { ...r200(), ...r400 },
        },
      },

      // ── Export ────────────────────────────────────────────────────────────
      '/api/export/json-full': {
        get: {
          tags: ['Export / Import'],
          summary: 'Export complet en JSON',
          security: sessionAuth,
          responses: { ...r200('Full JSON export'), ...r400 },
        },
      },

      // ── Import ────────────────────────────────────────────────────────────
      '/api/import/structured': {
        post: {
          tags: ['Export / Import'],
          summary: 'Importer des transactions structurées (wizard CSV)',
          security: sessionAuth,
          requestBody: body(executeSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/import/json-full': {
        post: {
          tags: ['Export / Import'],
          summary: 'Importer un export JSON complet',
          security: sessionAuth,
          requestBody: body(jsonFullSchema),
          responses: { ...r201, ...r400 },
        },
      },

      // ── Backup ────────────────────────────────────────────────────────────
      '/api/backup/list': {
        get: {
          tags: ['Backup'],
          summary: 'Liste des sauvegardes',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/backup/run': {
        post: {
          tags: ['Backup'],
          summary: 'Lancer une sauvegarde manuelle',
          security: sessionAuth,
          responses: { ...r200('Nothing changed since the last backup'), ...r201 },
        },
      },
      '/api/backup/{filename}': {
        get: {
          tags: ['Backup'],
          summary: 'Télécharger une sauvegarde',
          security: sessionAuth,
          parameters: [
            { name: 'filename', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { ...r200('Backup file download'), ...r400, ...r404 },
        },
      },

      // ── Health / Version ──────────────────────────────────────────────────
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          responses: r200(),
        },
      },
      '/api/version': {
        get: {
          tags: ['System'],
          summary: "Version de l'application",
          responses: r200(),
        },
      },
    },
  };
}
