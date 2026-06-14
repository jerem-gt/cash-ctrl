import { detectDateFormat, type ParsedLedger, type ParsedTransaction } from './import-model';

// Re-exports pour la compatibilité (les types pivots vivent maintenant dans import-model)
export type { ParsedLedger as QifParseResult, ParsedTransaction as QifTransaction };
export { parseLedgerDate as parseQifDate } from './import-model';

type PartialTx = Partial<Omit<ParsedTransaction, 'isTransfer' | 'transferTarget'>>;

// ─── Helpers ─────────────────────

function applyTxField(tx: PartialTx, code: string, value: string): void {
  switch (code) {
    case 'D':
      tx.date = value;
      break;
    case 'T':
      // Séparateurs de milliers (virgule façon US, espace) — tous retirés ; le point reste décimal.
      tx.amount = Number.parseFloat(value.replace(/[,\s]/g, ''));
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

function finalizeTransaction(tx: PartialTx | null, accountName: string): ParsedTransaction | null {
  if (tx?.date === undefined || tx?.amount === undefined) return null;
  const category = tx.category ?? '';
  const isTransfer = category.startsWith('[') && category.endsWith(']');
  return {
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
    ...new Set(transactions.flatMap((t) => (!t.isTransfer && t.category ? [t.category] : []))),
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

    const tx = finalizeTransaction(txData, currentAccountName);
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
  for (let i = 0; i < transactions.length; i++) {
    if (i === idx || processed.has(i)) continue;
    const other = transactions[i];
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
