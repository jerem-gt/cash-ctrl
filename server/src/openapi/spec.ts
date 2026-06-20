import type { ZodType } from 'zod';
import { toJSONSchema } from 'zod';

import { accountTypeSchema } from '../modules/account-types/account-types.routes';
import { accountSchema, closeSchema } from '../modules/accounts/accounts.routes';
import {
  changePasswordSchema,
  disableTotpSchema,
  enableTotpSchema,
  loginSchema,
  verifyTotpSchema,
} from '../modules/auth/auth.routes';
import { bankSchema, reorderSchema } from '../modules/banks/banks.routes';
import { categorySchema } from '../modules/categories/categories.routes';
import {
  matchQuerySchema,
  ruleSchema,
} from '../modules/categorization-rules/categorization-rules.routes';
import { executeSchema, jsonFullSchema } from '../modules/import/import.routes';
import {
  arbitrageSchema,
  createSupportSchema,
  interetsSchema,
  rachatSchema,
  revaloriserSchema,
  updateOperationSchema,
  versementSchema,
} from '../modules/insurance/insurance.routes';
import {
  createLoanSchema,
  updateInstallmentSchema,
  updateLoanSchema,
} from '../modules/loans/loans.routes';
import { paymentMethodSchema } from '../modules/payment-methods/payment-methods.routes';
import {
  attributedAmountSchema,
  linkSchema,
  statusSchema,
} from '../modules/reimbursements/reimbursements.routes';
import { scheduledSchema } from '../modules/scheduled/scheduled.routes';
import { settingsSchema, systemRefsSchema } from '../modules/settings/settings.routes';
import {
  buySchema,
  editOperationSchema,
  stockTransferSchema,
} from '../modules/stocks/stocks.routes';
import {
  createSubcategorySchema,
  updateSubcategorySchema,
} from '../modules/subcategories/subcategories.routes';
import {
  querySchema as transactionQuerySchema,
  transactionSchema,
  validateSchema,
} from '../modules/transactions/transactions.routes';
import { transferSchema, transferUpdateSchema } from '../modules/transfers/transfers.routes';
import { createUserSchema, updateUserSchema } from '../modules/users/users.routes';

// ─── helpers ───────────────────────────────────────────────────────────────

const TO_JSON_OPTS = { unrepresentable: 'any' } as const;

function schema(zod: ZodType) {
  return toJSONSchema(zod, TO_JSON_OPTS);
}

function body(zod: ZodType) {
  return {
    required: true,
    content: { 'application/json': { schema: schema(zod) } },
  };
}

// Converts a Zod object schema's properties into OpenAPI query parameters.
function queryParams(zod: ZodType) {
  const js = toJSONSchema(zod, TO_JSON_OPTS) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  if (!js.properties) return [];
  return Object.entries(js.properties).map(([name, propSchema]) => ({
    name,
    in: 'query',
    required: (js.required ?? []).includes(name),
    schema: propSchema,
  }));
}

const r200 = (description = 'OK') => ({ 200: { description } });
const r201 = { 201: { description: 'Created' } };
const r400 = { 400: { description: 'Validation error' } };
const r401 = { 401: { description: 'Unauthorized' } };
const r404 = { 404: { description: 'Not found' } };
const r409 = { 409: { description: 'Conflict' } };

const sessionAuth = [{ sessionCookie: [] }];

// Path parameter helpers — avoids repeating the same schema object on every route.
function pathInt(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'integer' } };
}

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
        responses: { ...r201, ...r400 },
      },
    },
  };
}

// Génère les 4 opérations standard (list / create / update / delete) pour une ressource CRUD.
function crudPaths(
  base: string,
  tag: string,
  labels: { list: string; create: string; update: string; remove: string },
  createSchema: ZodType,
  updateSchema: ZodType = createSchema,
) {
  return {
    [base]: {
      get: { tags: [tag], summary: labels.list, security: sessionAuth, responses: r200() },
      post: {
        tags: [tag],
        summary: labels.create,
        security: sessionAuth,
        requestBody: body(createSchema),
        responses: { ...r201, ...r400 },
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
        responses: { ...r200(), ...r404, ...r409 },
      },
    },
  };
}
const pId = [pathInt('id')];
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
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie set by POST /api/auth/login.',
        },
      },
    },
    paths: {
      // ── Auth ─────────────────────────────────────────────────────────────
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Connexion',
          requestBody: body(loginSchema),
          responses: { ...r200('Session started'), ...r400, ...r401 },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Déconnexion',
          security: sessionAuth,
          responses: r200(),
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Utilisateur courant',
          security: sessionAuth,
          responses: { ...r200(), ...r401 },
        },
      },
      '/api/auth/change-password': {
        post: {
          tags: ['Auth'],
          summary: 'Changer le mot de passe',
          security: sessionAuth,
          requestBody: body(changePasswordSchema),
          responses: { ...r200(), ...r400, ...r401 },
        },
      },
      '/api/auth/2fa/setup': {
        post: {
          tags: ['Auth'],
          summary: 'Préparer la 2FA (génère secret + URI)',
          security: sessionAuth,
          responses: { ...r200(), ...r401, ...r409 },
        },
      },
      '/api/auth/2fa/enable': {
        post: {
          tags: ['Auth'],
          summary: 'Activer la 2FA',
          security: sessionAuth,
          requestBody: body(enableTotpSchema),
          responses: { ...r200(), ...r400, ...r401, ...r409 },
        },
      },
      '/api/auth/2fa/disable': {
        post: {
          tags: ['Auth'],
          summary: 'Désactiver la 2FA',
          security: sessionAuth,
          requestBody: body(disableTotpSchema),
          responses: { ...r200(), ...r400, ...r401, ...r409 },
        },
      },
      '/api/auth/2fa/verify': {
        post: {
          tags: ['Auth'],
          summary: 'Valider le code TOTP après login',
          requestBody: body(verifyTotpSchema),
          responses: { ...r200(), ...r400, ...r401 },
        },
      },

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
          responses: { ...r200(), ...r404 },
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
          responses: { ...r200(), ...r400 },
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
          responses: { ...r200(), ...r404, ...r409 },
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
          responses: { ...r200(), ...r404 },
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
          responses: r200('Paginated transaction list'),
        },
        post: {
          tags: ['Transactions'],
          summary: 'Créer une transaction',
          security: sessionAuth,
          requestBody: body(transactionSchema),
          responses: { ...r201, ...r400 },
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
          responses: { ...r200(), ...r404 },
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
          responses: { ...r201, ...r400 },
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
          responses: { ...r200(), ...r404 },
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
          responses: r200(),
        },
        post: {
          tags: ['Reimbursements'],
          summary: 'Lier un remboursement à une transaction',
          security: sessionAuth,
          parameters: pTransactionId,
          requestBody: body(linkSchema),
          responses: { ...r201, ...r400 },
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
          responses: { ...r200(), ...r404 },
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
          responses: { ...r200(), ...r404 },
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
          responses: r200(),
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
          responses: { ...r200(), ...r404 },
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

      // ── Users ─────────────────────────────────────────────────────────────
      '/api/users': {
        get: {
          tags: ['Users'],
          summary: 'Liste des utilisateurs (admin)',
          security: sessionAuth,
          responses: r200(),
        },
        post: {
          tags: ['Users'],
          summary: 'Créer un utilisateur (admin)',
          security: sessionAuth,
          requestBody: body(createUserSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/users/{id}': {
        patch: {
          tags: ['Users'],
          summary: 'Modifier un utilisateur (admin)',
          security: sessionAuth,
          parameters: pId,
          requestBody: body(updateUserSchema),
          responses: { ...r200(), ...r400, ...r404 },
        },
        delete: {
          tags: ['Users'],
          summary: 'Supprimer un utilisateur (admin)',
          security: sessionAuth,
          parameters: pId,
          responses: { ...r200(), ...r404 },
        },
      },

      // ── Stocks ────────────────────────────────────────────────────────────
      '/api/stocks/{accountId}/positions': {
        get: {
          tags: ['Stocks'],
          summary: "Positions d'un compte investissement",
          security: sessionAuth,
          parameters: pAccountId,
          responses: r200(),
        },
      },
      '/api/stocks/{accountId}/operations': {
        get: {
          tags: ['Stocks'],
          summary: "Opérations d'un compte investissement",
          security: sessionAuth,
          parameters: pAccountId,
          responses: r200(),
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
          responses: r200(),
        },
      },

      // ── Insurance ─────────────────────────────────────────────────────────
      '/api/insurance/{accountId}/supports': {
        get: {
          tags: ['Insurance'],
          summary: "Supports d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: r200(),
        },
        post: {
          tags: ['Insurance'],
          summary: 'Ajouter un support',
          security: sessionAuth,
          parameters: pAccountId,
          requestBody: body(createSupportSchema),
          responses: { ...r201, ...r400 },
        },
      },
      '/api/insurance/{accountId}/supports/{supportId}': {
        delete: {
          tags: ['Insurance'],
          summary: 'Supprimer un support',
          security: sessionAuth,
          parameters: pAccountIdSupportId,
          responses: { ...r200(), ...r404 },
        },
      },
      '/api/insurance/{accountId}/positions': {
        get: {
          tags: ['Insurance'],
          summary: "Positions d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: r200(),
        },
      },
      '/api/insurance/{accountId}/operations': {
        get: {
          tags: ['Insurance'],
          summary: "Opérations d'un contrat",
          security: sessionAuth,
          parameters: pAccountId,
          responses: r200(),
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
          responses: { ...r200(), ...r404 },
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
          responses: r200(),
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
          responses: r200(),
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
          responses: r200(),
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
          responses: r200(),
        },
      },

      // ── Export ────────────────────────────────────────────────────────────
      '/api/export/json-full': {
        get: {
          tags: ['Export / Import'],
          summary: 'Export complet en JSON',
          security: sessionAuth,
          responses: r200('Full JSON export'),
        },
      },

      // ── Import ────────────────────────────────────────────────────────────
      '/api/import/structured': {
        post: {
          tags: ['Export / Import'],
          summary: 'Importer des transactions structurées (wizard CSV)',
          security: sessionAuth,
          requestBody: body(executeSchema),
          responses: { ...r200(), ...r400 },
        },
      },
      '/api/import/json-full': {
        post: {
          tags: ['Export / Import'],
          summary: 'Importer un export JSON complet',
          security: sessionAuth,
          requestBody: body(jsonFullSchema),
          responses: { ...r200(), ...r400 },
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
          responses: r200(),
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
          responses: { ...r200('Backup file download'), ...r404 },
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
