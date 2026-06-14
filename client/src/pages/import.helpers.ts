import type { ImportExecuteBody } from '@/api/client';
import { type ParsedLedger, type ParsedTransaction, parseLedgerDate } from '@/lib/import-model';
import { findTransferPeer } from '@/lib/qif-parser';
import { transferLabel } from '@/lib/transfer-label';
import type { XhbParseResult } from '@/lib/xhb-parser';
import type { Account, Category, PaymentMethod } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountChoice =
  | { action: 'map'; account_id: number }
  | {
      action: 'create';
      name: string;
      bank_id: number | null;
      bank_name: string | null;
      account_type_id: number | null;
      initial_balance: number;
      opening_date: string | null;
    }
  | { action: 'skip' };

export type CategoryChoice =
  | { action: 'map'; subcategory_id: number }
  | {
      action: 'create';
      existing_category_id: number | null;
      new_category_name: string;
      new_category_icon: string;
      subcategory_name: string;
    }
  | { action: 'skip' };

/** Motif d'exclusion d'un item du preview, traduit à l'affichage (cf. PreviewStep). */
export type SkipReason = 'unmapped_account' | 'skipped_category' | 'transfer_no_peer';

export type PreviewItem =
  | {
      kind: 'transaction';
      idx: number;
      date: string;
      type: 'income' | 'expense';
      amount: number;
      description: string;
      accountId: number | null;
      newAccountSourceName: string | null;
      accountName: string;
      subcategoryId: number | null;
      newSubcategoryKey: string | null;
      categoryLabel: string;
      categoryIsNew: boolean;
      notes: string | null;
      validated: boolean;
      paymentMethodId: number | null;
    }
  | {
      kind: 'transfer';
      idxPrimary: number;
      date: string;
      amount: number;
      description: string;
      fromAccountId: number | null;
      fromAccountSourceName: string | null;
      fromAccountName: string;
      toAccountId: number | null;
      toAccountSourceName: string | null;
      toAccountName: string;
      notes: string | null;
      validated: boolean;
    }
  | {
      kind: 'skip';
      idx: number;
      date: string;
      amount: number;
      description: string;
      reason: SkipReason;
    };

export type CategoryInfo = {
  subcategoryId: number | null;
  newSubcategoryKey: string | null;
  categoryLabel: string;
  isNew: boolean;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function findAutoCategory(
  categoryPath: string,
  categories: Category[],
): CategoryChoice | null {
  const parts = categoryPath.split(':').map((p) => p.trim().toLowerCase());
  const [subcatName = ''] = parts.slice(-1);
  const catName = parts.length > 1 ? parts[0] : null;

  for (const cat of categories) {
    if (catName && cat.name.toLowerCase() !== catName) continue;
    const sub = cat.subcategories.find((s) => s.name.toLowerCase() === subcatName);
    if (sub) return { action: 'map', subcategory_id: sub.id };
  }
  return null;
}

export function resolveAccountInfo(
  sourceName: string,
  choice: AccountChoice | undefined,
  accounts: Account[],
): {
  accountId: number | null;
  newAccountSourceName: string | null;
  accountName: string;
  bankName: string | null;
  resolved: boolean;
} {
  if (!choice || choice.action === 'skip') {
    return {
      accountId: null,
      newAccountSourceName: null,
      accountName: sourceName,
      bankName: null,
      resolved: false,
    };
  }
  if (choice.action === 'map') {
    const acc = accounts.find((a) => a.id === choice.account_id);
    return {
      accountId: choice.account_id,
      newAccountSourceName: null,
      accountName: acc?.name ?? '',
      bankName: acc?.bank ?? null,
      resolved: true,
    };
  }
  return {
    accountId: null,
    newAccountSourceName: sourceName,
    accountName: choice.name,
    bankName: choice.bank_name,
    resolved: true,
  };
}

export function resolveCategoryInfo(
  category: string,
  categoryChoices: Map<string, CategoryChoice>,
  categories: Category[],
): CategoryInfo | null {
  if (!category)
    return { subcategoryId: null, newSubcategoryKey: null, categoryLabel: '', isNew: false };
  const catChoice = categoryChoices.get(category);
  if (!catChoice || catChoice.action === 'skip') return null;
  if (catChoice.action === 'map') {
    const subcategoryId = catChoice.subcategory_id;
    for (const cat of categories) {
      const sub = cat.subcategories.find((s) => s.id === subcategoryId);
      if (sub)
        return {
          subcategoryId,
          newSubcategoryKey: null,
          categoryLabel: `${cat.name} / ${sub.name}`,
          isNew: false,
        };
    }
    return { subcategoryId, newSubcategoryKey: null, categoryLabel: '', isNew: false };
  }
  const catName = catChoice.existing_category_id
    ? (categories.find((c) => c.id === catChoice.existing_category_id)?.name ?? '')
    : catChoice.new_category_name;
  return {
    subcategoryId: null,
    newSubcategoryKey: category,
    categoryLabel: `${catName} / ${catChoice.subcategory_name}`,
    isNew: true,
  };
}

export function safeParseDate(raw: string, format: 'MM/DD' | 'DD/MM'): string {
  try {
    return parseLedgerDate(raw, format);
  } catch {
    return '2000-01-01';
  }
}

export function resolveTransferItem(
  tx: ParsedTransaction,
  i: number,
  parsed: ParsedLedger,
  processed: Set<number>,
  accountChoices: Map<string, AccountChoice>,
  accounts: Account[],
  date: string,
): PreviewItem {
  const skip = (reason: SkipReason): PreviewItem => ({
    kind: 'skip',
    idx: i,
    date,
    amount: Math.abs(tx.amount),
    description: tx.description,
    reason,
  });

  const peerIdx = findTransferPeer(parsed.transactions, i, processed);
  processed.add(i);

  let fromSourceName: string;
  let toSourceName: string;
  let notes: string | null;

  if (peerIdx === -1) {
    if (!tx.transferTarget) return skip('transfer_no_peer');
    fromSourceName = tx.amount < 0 ? tx.accountName : tx.transferTarget;
    toSourceName = tx.amount < 0 ? tx.transferTarget : tx.accountName;
    notes = tx.memo;
  } else {
    processed.add(peerIdx);
    const peer = parsed.transactions[peerIdx];
    const fromTx = tx.amount < 0 ? tx : peer;
    const toTx = tx.amount < 0 ? peer : tx;
    fromSourceName = fromTx.accountName;
    toSourceName = toTx.accountName;
    notes = tx.memo ?? peer.memo ?? null;
  }

  const fromInfo = resolveAccountInfo(fromSourceName, accountChoices.get(fromSourceName), accounts);
  const toInfo = resolveAccountInfo(toSourceName, accountChoices.get(toSourceName), accounts);
  if (!fromInfo.resolved || !toInfo.resolved) return skip('unmapped_account');

  const description = transferLabel(
    { name: fromInfo.accountName, bank: fromInfo.bankName },
    { name: toInfo.accountName, bank: toInfo.bankName },
  );

  return {
    kind: 'transfer',
    idxPrimary: i,
    date,
    amount: Math.abs(tx.amount),
    description,
    fromAccountId: fromInfo.accountId,
    fromAccountSourceName: fromInfo.newAccountSourceName,
    fromAccountName: fromInfo.accountName,
    toAccountId: toInfo.accountId,
    toAccountSourceName: toInfo.newAccountSourceName,
    toAccountName: toInfo.accountName,
    notes,
    validated: true,
  };
}

/** Évalue un pattern SQL LIKE (avec % comme joker) contre un texte. */
function likeMatchSegment(
  t: string,
  seg: string,
  i: number,
  last: number,
  pos: { value: number },
): boolean {
  if (i === 0 && last === 0) return t === seg;
  if (i === 0) {
    if (!t.startsWith(seg)) return false;
    pos.value = seg.length;
    return true;
  }
  if (i === last) return t.endsWith(seg);
  const idx = t.indexOf(seg, pos.value);
  if (idx === -1) return false;
  pos.value = idx + seg.length;
  return true;
}

export function likeMatch(text: string, pattern: string): boolean {
  const segments = pattern.toLowerCase().split('%');
  const t = text.toLowerCase();
  const pos = { value: 0 };
  for (let i = 0; i < segments.length; i++) {
    if (!likeMatchSegment(t, segments[i], i, segments.length - 1, pos)) return false;
  }
  return true;
}

type ResolvedCategory = {
  subcategoryId: number | null;
  newSubcategoryKey: string | null;
  categoryLabel: string;
  isNew: boolean;
};

function resolveTxCategory(
  description: string,
  categoryPath: string,
  descriptionRuleMatcher: ((description: string) => number | null) | undefined,
  categoryChoices: Map<string, CategoryChoice>,
  categories: Category[],
): ResolvedCategory | null {
  if (descriptionRuleMatcher !== undefined) {
    const matchedId = descriptionRuleMatcher(description);
    const found =
      matchedId === null
        ? undefined
        : categories
            .flatMap((c) => c.subcategories.map((s) => ({ cat: c, sub: s })))
            .find(({ sub }) => sub.id === matchedId);
    return {
      subcategoryId: matchedId,
      newSubcategoryKey: null,
      categoryLabel: found ? `${found.cat.name} / ${found.sub.name}` : '',
      isNew: false,
    };
  }
  return resolveCategoryInfo(categoryPath, categoryChoices, categories);
}

export function resolvePreview(
  parsed: ParsedLedger,
  dateFormat: 'MM/DD' | 'DD/MM',
  accountChoices: Map<string, AccountChoice>,
  categoryChoices: Map<string, CategoryChoice>,
  accounts: Account[],
  categories: Category[],
  descriptionRuleMatcher?: (description: string) => number | null,
): PreviewItem[] {
  const items: PreviewItem[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < parsed.transactions.length; i++) {
    if (processed.has(i)) continue;
    const tx = parsed.transactions[i];
    const date = safeParseDate(tx.date, dateFormat);

    if (tx.isTransfer) {
      items.push(resolveTransferItem(tx, i, parsed, processed, accountChoices, accounts, date));
      continue;
    }

    processed.add(i);
    const accInfo = resolveAccountInfo(
      tx.accountName,
      accountChoices.get(tx.accountName),
      accounts,
    );
    if (!accInfo.resolved) {
      items.push({
        kind: 'skip',
        idx: i,
        date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'unmapped_account',
      });
      continue;
    }

    const catInfo = resolveTxCategory(
      tx.description,
      tx.category,
      descriptionRuleMatcher,
      categoryChoices,
      categories,
    );
    if (catInfo === null) {
      items.push({
        kind: 'skip',
        idx: i,
        date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'skipped_category',
      });
      continue;
    }

    items.push({
      kind: 'transaction',
      idx: i,
      date,
      type: tx.amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(tx.amount),
      description: tx.description,
      accountId: accInfo.accountId,
      newAccountSourceName: accInfo.newAccountSourceName,
      accountName: accInfo.accountName,
      subcategoryId: catInfo.subcategoryId,
      newSubcategoryKey: catInfo.newSubcategoryKey,
      categoryLabel: catInfo.categoryLabel,
      categoryIsNew: catInfo.isNew,
      notes: tx.memo,
      validated: true,
      paymentMethodId: null,
    });
  }

  return items;
}

export function buildExecuteBody(
  items: PreviewItem[],
  selected: Set<number>,
  accountChoices: Map<string, AccountChoice>,
  categoryChoices: Map<string, CategoryChoice>,
  // Repli pour les transactions sans libellé : le serveur exige description.min(1).
  noDescriptionLabel: string,
): ImportExecuteBody {
  const newAccountsMap = new Map<string, ImportExecuteBody['newAccounts'][number]>();
  const newSubcategoriesMap = new Map<string, ImportExecuteBody['newSubcategories'][number]>();
  const transactions: ImportExecuteBody['transactions'] = [];
  const transfers: ImportExecuteBody['transfers'] = [];

  const ensureNewAccount = (sourceName: string | null) => {
    if (!sourceName || newAccountsMap.has(sourceName)) return;
    const choice = accountChoices.get(sourceName);
    if (choice?.action === 'create') {
      newAccountsMap.set(sourceName, {
        source_name: sourceName,
        name: choice.name,
        bank_id: choice.bank_id,
        account_type_id: choice.account_type_id,
        initial_balance: choice.initial_balance,
        opening_date: choice.opening_date,
      });
    }
  };

  const ensureNewSubcategory = (key: string | null) => {
    if (!key || newSubcategoriesMap.has(key)) return;
    const choice = categoryChoices.get(key);
    if (choice?.action === 'create') {
      newSubcategoriesMap.set(key, {
        source_key: key,
        category_id: choice.existing_category_id ?? undefined,
        new_category_name: choice.new_category_name || undefined,
        new_category_icon: choice.new_category_icon || undefined,
        subcategory_name: choice.subcategory_name,
      });
    }
  };

  for (let i = 0; i < items.length; i++) {
    if (!selected.has(i)) continue;
    const item = items[i];
    if (item.kind === 'skip') continue;

    if (item.kind === 'transfer') {
      ensureNewAccount(item.fromAccountSourceName);
      ensureNewAccount(item.toAccountSourceName);
      transfers.push({
        from_account_id: item.fromAccountId,
        from_account_source_name: item.fromAccountSourceName,
        to_account_id: item.toAccountId,
        to_account_source_name: item.toAccountSourceName,
        amount: item.amount,
        description: item.description,
        date: item.date,
        notes: item.notes,
        validated: item.validated,
      });
    } else {
      ensureNewAccount(item.newAccountSourceName);
      ensureNewSubcategory(item.newSubcategoryKey);
      transactions.push({
        account_id: item.accountId,
        new_account_source_name: item.newAccountSourceName,
        type: item.type,
        amount: item.amount,
        description: item.description || noDescriptionLabel,
        subcategory_id: item.subcategoryId,
        new_subcategory_key: item.newSubcategoryKey,
        date: item.date,
        notes: item.notes,
        validated: item.validated,
        payment_method_id: item.paymentMethodId,
      });
    }
  }

  return {
    newAccounts: [...newAccountsMap.values()],
    newSubcategories: [...newSubcategoriesMap.values()],
    transactions,
    transfers,
  };
}

/** Erreurs d'import : messages par index de ligne d'aperçu + erreurs globales (sans ligne). */
export interface ImportErrors {
  rows: Map<number, string[]>;
  global: string[];
}

/**
 * Correspondance entre les index des tableaux envoyés au serveur
 * (`transactions[K]` / `transfers[K]`) et l'index de la ligne d'aperçu.
 * Rejoue **exactement** l'itération de `buildExecuteBody` (mêmes filtres :
 * non sélectionné et `skip` ignorés) pour rester aligné.
 */
export function buildRowIndex(
  items: PreviewItem[],
  selected: Set<number>,
): { txRows: number[]; tfRows: number[] } {
  const txRows: number[] = [];
  const tfRows: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!selected.has(i)) continue;
    const item = items[i];
    if (item.kind === 'transfer') tfRows.push(i);
    else if (item.kind === 'transaction') txRows.push(i);
  }
  return { txRows, tfRows };
}

// ─── XHB-specific helpers ─────────────────────────────────────────────────────

export const XHB_PAYMODE_NAMES: Record<number, string> = {
  0: 'Aucun',
  1: 'Carte de crédit',
  2: 'Chèque',
  3: 'Espèces',
  4: 'Virement',
  5: 'Virement interne',
  6: 'Carte de débit',
  7: 'Ordre permanent',
  8: 'Paiement électronique',
  9: 'Dépôt',
  10: 'Frais bancaires',
  11: 'Prélèvement',
};

export function findAutoPaymentMethod(
  paymode: number,
  paymentMethods: PaymentMethod[],
): number | null {
  const name = XHB_PAYMODE_NAMES[paymode];
  if (!name) return null;
  const match = paymentMethods.find((pm) => pm.name.toLowerCase() === name.toLowerCase());
  return match?.id ?? null;
}

export function resolveXhbPreview(
  parsed: XhbParseResult,
  accountChoices: Map<string, AccountChoice>,
  categoryChoices: Map<string, CategoryChoice>,
  paymodeChoices: Map<number, number | null>,
  accounts: Account[],
  categories: Category[],
): PreviewItem[] {
  const items: PreviewItem[] = [];

  // Transfers first (indices 0..transfers.length-1)
  for (let i = 0; i < parsed.transfers.length; i++) {
    const tf = parsed.transfers[i];
    const fromInfo = resolveAccountInfo(
      tf.fromAccountName,
      accountChoices.get(tf.fromAccountName),
      accounts,
    );
    const toInfo = resolveAccountInfo(
      tf.toAccountName,
      accountChoices.get(tf.toAccountName),
      accounts,
    );

    if (!fromInfo.resolved || !toInfo.resolved) {
      items.push({
        kind: 'skip',
        idx: i,
        date: tf.date,
        amount: tf.amount,
        description: tf.description,
        reason: 'unmapped_account',
      });
      continue;
    }

    const description = transferLabel(
      { name: fromInfo.accountName, bank: fromInfo.bankName },
      { name: toInfo.accountName, bank: toInfo.bankName },
    );

    items.push({
      kind: 'transfer',
      idxPrimary: i,
      date: tf.date,
      amount: tf.amount,
      description,
      fromAccountId: fromInfo.accountId,
      fromAccountSourceName: fromInfo.newAccountSourceName,
      fromAccountName: fromInfo.accountName,
      toAccountId: toInfo.accountId,
      toAccountSourceName: toInfo.newAccountSourceName,
      toAccountName: toInfo.accountName,
      notes: tf.notes,
      validated: tf.validated,
    });
  }

  // Regular transactions (indices offset by transfers count)
  const offset = parsed.transfers.length;
  for (let i = 0; i < parsed.transactions.length; i++) {
    const tx = parsed.transactions[i];
    const accInfo = resolveAccountInfo(
      tx.accountName,
      accountChoices.get(tx.accountName),
      accounts,
    );

    if (!accInfo.resolved) {
      items.push({
        kind: 'skip',
        idx: offset + i,
        date: tx.date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'unmapped_account',
      });
      continue;
    }

    const catInfo = resolveCategoryInfo(tx.categoryString, categoryChoices, categories);
    if (catInfo === null) {
      items.push({
        kind: 'skip',
        idx: offset + i,
        date: tx.date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'skipped_category',
      });
      continue;
    }

    const { subcategoryId, newSubcategoryKey, categoryLabel, isNew } = catInfo;

    items.push({
      kind: 'transaction',
      idx: offset + i,
      date: tx.date,
      type: tx.amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(tx.amount),
      description: tx.description,
      accountId: accInfo.accountId,
      newAccountSourceName: accInfo.newAccountSourceName,
      accountName: accInfo.accountName,
      subcategoryId,
      newSubcategoryKey,
      categoryLabel,
      categoryIsNew: isNew,
      notes: tx.notes,
      validated: tx.validated,
      paymentMethodId: paymodeChoices.get(tx.paymode) ?? null,
    });
  }

  return items;
}
