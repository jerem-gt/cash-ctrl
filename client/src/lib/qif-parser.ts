import {
  detectDateFormat,
  type ParsedLedger,
  type ParsedSplit,
  type ParsedTransaction,
} from './import-model';

const isAccountRef = (category: string): boolean =>
  category.startsWith('[') && category.endsWith(']');

// Re-exports pour la compatibilité (les types pivots vivent maintenant dans import-model)

export {
  parseLedgerDate as parseQifDate,
  type ParsedLedger as QifParseResult,
  type ParsedTransaction as QifTransaction,
} from './import-model';

type PartialTx = Partial<Omit<ParsedTransaction, 'isTransfer' | 'transferTarget'>>;

// ─── Helpers ─────────────────────

function applyTxField(tx: PartialTx, code: string, value: string): void {
  switch (code) {
    case 'D':
      tx.date = value;
      break;
    case 'T':
      // Séparateurs de milliers (virgule façon US, espace) — tous retirés ; le point reste décimal.
      tx.amount = Number.parseFloat(value.replaceAll(/[,\s]/g, ''));
      break;
    case 'P':
      tx.description = value;
      break;
    case 'L':
      tx.category ??= value;
      break;
    case 'M':
      tx.memo = value && value !== '(NULL)' ? value : null;
      break;
    case 'C':
      tx.cleared = value === 'X' || value === '*';
      break;
  }
}

// Suite de lignes S (catégorie), $ (montant) et E (mémo) ; une ligne S ouvre une ventilation.
function parseSplits(lines: string[]): ParsedSplit[] {
  const splits: ParsedSplit[] = [];
  for (const l of lines) {
    const value = l.slice(1).trim();
    if (l[0] === 'S') {
      splits.push({ category: value, amount: Number.NaN, memo: null });
    } else if (splits.length > 0 && l[0] === '$') {
      splits.at(-1)!.amount = Number.parseFloat(value.replaceAll(/[,\s]/g, ''));
    } else if (splits.length > 0 && l[0] === 'E') {
      splits.at(-1)!.memo = value || null;
    }
  }
  return splits;
}

function finalizeTransaction(
  tx: PartialTx | null,
  accountName: string,
  splits: ParsedSplit[],
): ParsedTransaction | null {
  if (tx?.date === undefined || tx?.amount === undefined) return null;
  // Avec des lignes S, la ligne L (--Split-- ou première catégorie) est ignorée
  const category = splits.length > 0 ? '' : (tx.category ?? '');
  const isTransfer = category.startsWith('[') && category.endsWith(']');
  return {
    ...(splits.length > 0 && { splits }),
    accountName,
    date: tx.date,
    amount: tx.amount,
    description: tx.description ?? '',
    category,
    memo: tx.memo ?? null,
    cleared: tx.cleared ?? false,
    isTransfer,
    transferTarget: isTransfer ? category.slice(1, -1) : null,
  };
}

function buildQifResult(accountsSet: Set<string>, transactions: ParsedTransaction[]): ParsedLedger {
  const allAccounts = [...accountsSet];
  if (allAccounts.length === 0 && transactions.length > 0) allAccounts.push('');

  const uniqueCategories = [
    ...new Set(
      transactions.flatMap((t) => [
        ...(!t.isTransfer && t.category ? [t.category] : []),
        ...(t.splits ?? []).map((s) => s.category).filter((c) => c && !isAccountRef(c)),
      ]),
    ),
  ];
  const uniqueTransferTargets = [
    ...new Set(
      transactions.flatMap((t) => (t.isTransfer && t.transferTarget ? [t.transferTarget] : [])),
    ),
  ];

  return {
    accounts: allAccounts,
    transactions,
    uniqueCategories,
    uniqueTransferTargets,
    detectedDateFormat: detectDateFormat(transactions.map((t) => t.date)),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function parseQif(content: string): ParsedLedger {
  const accountsSet = new Set<string>();
  let currentAccountName = '';

  const transactions = content.split('^').reduce<ParsedTransaction[]>((acc, block) => {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return acc;

    const first = lines[0];

    // Gestion du compte
    if (first === '!Account') {
      currentAccountName = lines.find((l) => l.startsWith('N'))?.slice(1) || currentAccountName;
      accountsSet.add(currentAccountName);
      return acc;
    }

    // Extraction des données (on saute la ligne si elle commence par '!')
    const txData: PartialTx = {};
    lines.forEach((l) => !l.startsWith('!') && applyTxField(txData, l[0], l.slice(1).trim()));

    const tx = finalizeTransaction(txData, currentAccountName, parseSplits(lines));
    return tx ? [...acc, tx] : acc;
  }, []);

  return buildQifResult(accountsSet, transactions);
}

export function findTransferPeer(
  transactions: ParsedTransaction[],
  idx: number,
  processed: Set<number>,
): number {
  const tx = transactions[idx];
  for (const [i, other] of transactions.entries()) {
    if (i === idx || processed.has(i)) continue;
    if (
      other.isTransfer &&
      Math.abs(tx.amount + other.amount) <= 0.005 &&
      tx.date === other.date &&
      tx.transferTarget === other.accountName &&
      other.transferTarget === tx.accountName
    )
      return i;
  }
  return -1;
}
