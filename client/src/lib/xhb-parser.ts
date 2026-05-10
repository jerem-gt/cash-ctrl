export interface XhbAccount {
  key: number;
  name: string;
  bankname: string;
  initial: number;
}

export interface XhbTransaction {
  accountName: string;
  date: string;
  amount: number;
  description: string;
  categoryString: string;
  paymode: number;
  notes: string | null;
  validated: boolean;
}

export interface XhbTransfer {
  fromAccountName: string;
  toAccountName: string;
  date: string;
  amount: number;
  description: string;
  paymode: number;
  notes: string | null;
  validated: boolean;
}

export interface XhbParseResult {
  accounts: string[];
  accountDetails: Map<string, XhbAccount>;
  transactions: XhbTransaction[];
  transfers: XhbTransfer[];
  uniqueCategories: string[];
  uniquePaymodes: number[];
}

// GLib GDate serial: days since Jan 1, year 1. Unix epoch (Jan 1, 1970) = serial 719163.
const GLIB_UNIX_EPOCH = 719163;

export function gDateToISO(gdate: number): string {
  const d = new Date((gdate - GLIB_UNIX_EPOCH) * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function a(el: Element, name: string): string {
  return el.getAttribute(name) ?? '';
}
function n(el: Element, name: string): number {
  return Number.parseInt(el.getAttribute(name) ?? '0', 10);
}
function f(el: Element, name: string): number {
  return Number.parseFloat(el.getAttribute(name) ?? '0');
}

type CategoryMap = Map<number, { name: string; parentKey?: number }>;
type PayeeMap = Map<number, { name: string; paymode: number }>;

function buildCategoryString(catKey: number, categoryMap: CategoryMap): string {
  if (catKey === 0) return '';
  const cat = categoryMap.get(catKey);
  if (!cat) return '';
  if (cat.parentKey !== undefined) {
    const parent = categoryMap.get(cat.parentKey);
    return parent ? `${parent.name}:${cat.name}` : cat.name;
  }
  return cat.name;
}

function resolvePaymode(el: Element, payeeMap: PayeeMap): number {
  const pm = el.getAttribute('paymode');
  if (pm !== null) return Number.parseInt(pm, 10);
  const payeeAttr = el.getAttribute('payee');
  if (payeeAttr !== null) return payeeMap.get(Number.parseInt(payeeAttr, 10))?.paymode ?? 0;
  return 0;
}

function resolveDescription(el: Element, payeeMap: PayeeMap): string {
  const wording = a(el, 'wording');
  if (wording) return wording;
  const payeeAttr = el.getAttribute('payee');
  if (payeeAttr !== null) return payeeMap.get(Number.parseInt(payeeAttr, 10))?.name ?? '';
  return '';
}

function classifyOps(opElements: NodeListOf<Element>): {
  transferGroups: Map<number, Element[]>;
  regularOps: Element[];
} {
  const transferGroups = new Map<number, Element[]>();
  const regularOps: Element[] = [];
  for (const el of opElements) {
    const dstAccount = el.getAttribute('dst_account');
    const kxferAttr = el.getAttribute('kxfer');
    if (dstAccount !== null && kxferAttr !== null) {
      const kxfer = Number.parseInt(kxferAttr, 10);
      if (!transferGroups.has(kxfer)) transferGroups.set(kxfer, []);
      transferGroups.get(kxfer)!.push(el);
    } else {
      regularOps.push(el);
    }
  }
  return { transferGroups, regularOps };
}

function buildTransfers(
  transferGroups: Map<number, Element[]>,
  accountMap: Map<number, XhbAccount>,
  payeeMap: PayeeMap,
): XhbTransfer[] {
  const transfers: XhbTransfer[] = [];
  for (const [, ops] of transferGroups) {
    const src = ops.find((el) => f(el, 'amount') < 0) ?? ops[0];
    const fromAcc = accountMap.get(n(src, 'account'));
    const toAcc = accountMap.get(n(src, 'dst_account'));
    if (!fromAcc || !toAcc) continue;
    const info = a(src, 'info');
    transfers.push({
      fromAccountName: fromAcc.name,
      toAccountName: toAcc.name,
      date: gDateToISO(n(src, 'date')),
      amount: Math.abs(f(src, 'amount')),
      description: resolveDescription(src, payeeMap),
      paymode: resolvePaymode(src, payeeMap),
      notes: info || null,
      validated: n(src, 'st') > 0,
    });
  }
  return transfers;
}

function buildTransactions(
  regularOps: Element[],
  accountMap: Map<number, XhbAccount>,
  categoryMap: CategoryMap,
  payeeMap: PayeeMap,
): XhbTransaction[] {
  const transactions: XhbTransaction[] = [];
  for (const el of regularOps) {
    const acc = accountMap.get(n(el, 'account'));
    if (!acc) continue;
    const info = a(el, 'info');
    transactions.push({
      accountName: acc.name,
      date: gDateToISO(n(el, 'date')),
      amount: f(el, 'amount'),
      description: resolveDescription(el, payeeMap),
      categoryString: buildCategoryString(n(el, 'category'), categoryMap),
      paymode: resolvePaymode(el, payeeMap),
      notes: info || null,
      validated: n(el, 'st') > 0,
    });
  }
  return transactions;
}

function collectUniquePaymodes(transactions: XhbTransaction[], transfers: XhbTransfer[]): number[] {
  const paymodeSet = new Set<number>();
  for (const tx of transactions) if (tx.paymode !== 0) paymodeSet.add(tx.paymode);
  for (const tf of transfers) if (tf.paymode !== 0) paymodeSet.add(tf.paymode);
  return [...paymodeSet].sort((a, b) => a - b);
}

export function parseXhb(content: string): XhbParseResult {
  const doc = new DOMParser().parseFromString(content, 'application/xml');

  const accountMap = new Map<number, XhbAccount>();
  for (const el of doc.querySelectorAll('account')) {
    const key = n(el, 'key');
    accountMap.set(key, {
      key,
      name: a(el, 'name'),
      bankname: a(el, 'bankname'),
      initial: f(el, 'initial'),
    });
  }

  const categoryMap: CategoryMap = new Map();
  for (const el of doc.querySelectorAll('cat')) {
    const key = n(el, 'key');
    const parentAttr = el.getAttribute('parent');
    categoryMap.set(key, {
      name: a(el, 'name'),
      parentKey: parentAttr === null ? undefined : Number.parseInt(parentAttr, 10),
    });
  }

  const payeeMap: PayeeMap = new Map();
  for (const el of doc.querySelectorAll('pay')) {
    const key = n(el, 'key');
    payeeMap.set(key, { name: a(el, 'name'), paymode: n(el, 'paymode') });
  }

  const { transferGroups, regularOps } = classifyOps(doc.querySelectorAll('ope'));
  const transfers = buildTransfers(transferGroups, accountMap, payeeMap);
  const transactions = buildTransactions(regularOps, accountMap, categoryMap, payeeMap);

  const accountNamesSet = new Set<string>();
  for (const tx of transactions) accountNamesSet.add(tx.accountName);
  for (const tf of transfers) {
    accountNamesSet.add(tf.fromAccountName);
    accountNamesSet.add(tf.toAccountName);
  }

  const accountDetails = new Map<string, XhbAccount>();
  for (const acc of accountMap.values()) accountDetails.set(acc.name, acc);

  return {
    accounts: [...accountNamesSet],
    accountDetails,
    transactions,
    transfers,
    uniqueCategories: [...new Set(transactions.map((tx) => tx.categoryString).filter(Boolean))],
    uniquePaymodes: collectUniquePaymodes(transactions, transfers),
  };
}
