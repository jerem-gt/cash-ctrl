import type { ImportExecuteBody } from '@/api/client';
import {
  findTransferPeer,
  parseQifDate,
  type QifParseResult,
  type QifTransaction,
} from '@/lib/qif-parser';
import { transferLabel } from '@/lib/transfer-label';
import type { Account, Category } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountChoice =
  | { action: 'map'; account_id: number }
  | {
      action: 'create';
      name: string;
      bank_id: number | null;
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

export type PreviewItem =
  | {
      kind: 'transaction';
      idx: number;
      date: string;
      type: 'income' | 'expense';
      amount: number;
      description: string;
      accountId: number | null;
      newAccountQifName: string | null;
      accountName: string;
      subcategoryId: number | null;
      newSubcategoryKey: string | null;
      categoryLabel: string;
      notes: string | null;
      validated: boolean;
    }
  | {
      kind: 'transfer';
      idxPrimary: number;
      date: string;
      amount: number;
      description: string;
      fromAccountId: number | null;
      fromAccountQifName: string | null;
      fromAccountName: string;
      toAccountId: number | null;
      toAccountQifName: string | null;
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
      reason: string;
    };

export type CategoryInfo = {
  subcategoryId: number | null;
  newSubcategoryKey: string | null;
  categoryLabel: string;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function findAutoCategory(qifCat: string, categories: Category[]): CategoryChoice | null {
  const parts = qifCat.split(':');
  const subcatName = parts[parts.length - 1].trim().toLowerCase();
  const catName = parts.length > 1 ? parts[0].trim().toLowerCase() : null;

  for (const cat of categories) {
    if (catName && cat.name.toLowerCase() !== catName) continue;
    const sub = cat.subcategories.find((s) => s.name.toLowerCase() === subcatName);
    if (sub) return { action: 'map', subcategory_id: sub.id };
  }
  return null;
}

export function resolveAccountInfo(
  qifName: string,
  choice: AccountChoice | undefined,
  accounts: Account[],
): {
  accountId: number | null;
  newAccountQifName: string | null;
  accountName: string;
  resolved: boolean;
} {
  if (!choice || choice.action === 'skip') {
    return { accountId: null, newAccountQifName: null, accountName: qifName, resolved: false };
  }
  if (choice.action === 'map') {
    const acc = accounts.find((a) => a.id === choice.account_id);
    return {
      accountId: choice.account_id,
      newAccountQifName: null,
      accountName: acc?.name ?? '',
      resolved: true,
    };
  }
  return {
    accountId: null,
    newAccountQifName: qifName,
    accountName: `${choice.name} (nouveau)`,
    resolved: true,
  };
}

export function resolveCategoryInfo(
  category: string,
  categoryChoices: Map<string, CategoryChoice>,
  categories: Category[],
): CategoryInfo | null {
  if (!category) return { subcategoryId: null, newSubcategoryKey: null, categoryLabel: '' };
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
        };
    }
    return { subcategoryId, newSubcategoryKey: null, categoryLabel: '' };
  }
  const catName = catChoice.existing_category_id
    ? (categories.find((c) => c.id === catChoice.existing_category_id)?.name ?? '')
    : catChoice.new_category_name;
  return {
    subcategoryId: null,
    newSubcategoryKey: category,
    categoryLabel: `${catName} / ${catChoice.subcategory_name} (nouveau)`,
  };
}

export function safeParseDate(raw: string, format: 'MM/DD' | 'DD/MM'): string {
  try {
    return parseQifDate(raw, format);
  } catch {
    return '2000-01-01';
  }
}

export function resolveTransferItem(
  tx: QifTransaction,
  i: number,
  parsed: QifParseResult,
  processed: Set<number>,
  accountChoices: Map<string, AccountChoice>,
  accounts: Account[],
  date: string,
): PreviewItem {
  const skip = (reason: string): PreviewItem => ({
    kind: 'skip',
    idx: i,
    date,
    amount: Math.abs(tx.amount),
    description: tx.description,
    reason,
  });

  const peerIdx = findTransferPeer(parsed.transactions, i, processed);
  processed.add(i);

  let fromQifName: string;
  let toQifName: string;
  let notes: string | null;

  if (peerIdx === -1) {
    if (!tx.transferTarget) return skip('Virement sans contrepartie');
    fromQifName = tx.amount < 0 ? tx.qifAccountName : tx.transferTarget;
    toQifName = tx.amount < 0 ? tx.transferTarget : tx.qifAccountName;
    notes = tx.memo;
  } else {
    processed.add(peerIdx);
    const peer = parsed.transactions[peerIdx];
    const fromTx = tx.amount < 0 ? tx : peer;
    const toTx = tx.amount < 0 ? peer : tx;
    fromQifName = fromTx.qifAccountName;
    toQifName = toTx.qifAccountName;
    notes = tx.memo ?? peer.memo ?? null;
  }

  const fromInfo = resolveAccountInfo(fromQifName, accountChoices.get(fromQifName), accounts);
  const toInfo = resolveAccountInfo(toQifName, accountChoices.get(toQifName), accounts);
  if (!fromInfo.resolved || !toInfo.resolved) return skip('Compte non mappé');

  const fromAccount =
    fromInfo.accountId == null ? undefined : accounts.find((a) => a.id === fromInfo.accountId);
  const toAccount =
    toInfo.accountId == null ? undefined : accounts.find((a) => a.id === toInfo.accountId);
  const description = transferLabel(
    { name: fromInfo.accountName, bank: fromAccount?.bank },
    { name: toInfo.accountName, bank: toAccount?.bank },
  );

  return {
    kind: 'transfer',
    idxPrimary: i,
    date,
    amount: Math.abs(tx.amount),
    description,
    fromAccountId: fromInfo.accountId,
    fromAccountQifName: fromInfo.newAccountQifName,
    fromAccountName: fromInfo.accountName,
    toAccountId: toInfo.accountId,
    toAccountQifName: toInfo.newAccountQifName,
    toAccountName: toInfo.accountName,
    notes,
    validated: true,
  };
}

export function resolvePreview(
  parsed: QifParseResult,
  dateFormat: 'MM/DD' | 'DD/MM',
  accountChoices: Map<string, AccountChoice>,
  categoryChoices: Map<string, CategoryChoice>,
  accounts: Account[],
  categories: Category[],
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
      tx.qifAccountName,
      accountChoices.get(tx.qifAccountName),
      accounts,
    );
    if (!accInfo.resolved) {
      items.push({
        kind: 'skip',
        idx: i,
        date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'Compte non mappé',
      });
      continue;
    }

    const catInfo = resolveCategoryInfo(tx.category, categoryChoices, categories);
    if (catInfo === null) {
      items.push({
        kind: 'skip',
        idx: i,
        date,
        amount: Math.abs(tx.amount),
        description: tx.description,
        reason: 'Catégorie ignorée',
      });
      continue;
    }
    const { subcategoryId, newSubcategoryKey, categoryLabel } = catInfo;

    items.push({
      kind: 'transaction',
      idx: i,
      date,
      type: tx.amount >= 0 ? 'income' : 'expense',
      amount: Math.abs(tx.amount),
      description: tx.description || '(sans description)',
      accountId: accInfo.accountId,
      newAccountQifName: accInfo.newAccountQifName,
      accountName: accInfo.accountName,
      subcategoryId,
      newSubcategoryKey,
      categoryLabel,
      notes: tx.memo,
      validated: true,
    });
  }

  return items;
}

export function buildExecuteBody(
  items: PreviewItem[],
  selected: Set<number>,
  accountChoices: Map<string, AccountChoice>,
  categoryChoices: Map<string, CategoryChoice>,
): ImportExecuteBody {
  const newAccountsMap = new Map<string, ImportExecuteBody['newAccounts'][number]>();
  const newSubcategoriesMap = new Map<string, ImportExecuteBody['newSubcategories'][number]>();
  const transactions: ImportExecuteBody['transactions'] = [];
  const transfers: ImportExecuteBody['transfers'] = [];

  const ensureNewAccount = (qifName: string | null) => {
    if (!qifName || newAccountsMap.has(qifName)) return;
    const choice = accountChoices.get(qifName);
    if (choice?.action === 'create') {
      newAccountsMap.set(qifName, {
        qif_name: qifName,
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
        qif_key: key,
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
      ensureNewAccount(item.fromAccountQifName);
      ensureNewAccount(item.toAccountQifName);
      transfers.push({
        from_account_id: item.fromAccountId,
        from_account_qif_name: item.fromAccountQifName,
        to_account_id: item.toAccountId,
        to_account_qif_name: item.toAccountQifName,
        amount: item.amount,
        description: item.description,
        date: item.date,
        notes: item.notes,
        validated: item.validated,
      });
    } else {
      ensureNewAccount(item.newAccountQifName);
      ensureNewSubcategory(item.newSubcategoryKey);
      transactions.push({
        account_id: item.accountId,
        new_account_qif_name: item.newAccountQifName,
        type: item.type,
        amount: item.amount,
        description: item.description,
        subcategory_id: item.subcategoryId,
        new_subcategory_key: item.newSubcategoryKey,
        date: item.date,
        notes: item.notes,
        validated: item.validated,
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
