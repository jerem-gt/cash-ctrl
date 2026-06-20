import type { CsvParseResult } from '@/lib/csv-parser';
import { parseCsvAmount } from '@/lib/csv-parser';
import { detectDateFormat, type ParsedLedger, parseLedgerDate } from '@/lib/import-model';

export interface CsvMapping {
  /** Index de la colonne contenant la date. */
  dateCol: number;
  /** Index de la colonne contenant le libellé. */
  descriptionCol: number;
  /**
   * Mode montant :
   * - `signed` : une seule colonne, valeurs positives (crédit) et négatives (débit).
   * - `split`  : deux colonnes séparées Débit / Crédit.
   */
  amountMode: 'signed' | 'split';
  /** Index de la colonne montant signé (mode `signed`). */
  amountCol?: number;
  /** Index de la colonne débit (mode `split`). */
  debitCol?: number;
  /** Index de la colonne crédit (mode `split`). */
  creditCol?: number;
  /** Index de la colonne catégorie (optionnel). */
  categoryCol?: number;
  /** Index de la colonne notes (optionnel). */
  notesCol?: number;
  decimalSep: ',' | '.';
  dateFormat: 'MM/DD' | 'DD/MM' | 'YYYY-MM-DD';
}

function resolveAmount(row: string[], mapping: CsvMapping): number {
  if (mapping.amountMode === 'signed' && mapping.amountCol !== undefined) {
    return parseCsvAmount(row[mapping.amountCol] ?? '', mapping.decimalSep);
  }
  // Mode split : Débit = négatif, Crédit = positif
  const debit =
    mapping.debitCol === undefined
      ? Number.NaN
      : parseCsvAmount(row[mapping.debitCol] ?? '', mapping.decimalSep);
  const credit =
    mapping.creditCol === undefined
      ? Number.NaN
      : parseCsvAmount(row[mapping.creditCol] ?? '', mapping.decimalSep);

  if (!Number.isNaN(credit) && credit !== 0) return credit;
  if (!Number.isNaN(debit) && debit !== 0) return -Math.abs(debit);
  return Number.NaN;
}

/**
 * Convertit les lignes d'un CSV (déjà parsé) en `ParsedLedger` réutilisable
 * par le wizard d'import existant (resolvePreview, buildExecuteBody…).
 */
export function buildLedgerFromCsv(
  parsed: CsvParseResult,
  mapping: CsvMapping,
  accountName: string,
): ParsedLedger {
  const transactions = parsed.rows
    .map((row) => {
      const rawDate = row[mapping.dateCol] ?? '';
      const description = row[mapping.descriptionCol]?.trim() ?? '';
      const amount = resolveAmount(row, mapping);
      const category =
        mapping.categoryCol === undefined ? '' : (row[mapping.categoryCol]?.trim() ?? '');
      const memo = mapping.notesCol === undefined ? null : row[mapping.notesCol]?.trim() || null;

      if (!rawDate || Number.isNaN(amount)) return null;

      let date: string;
      try {
        date = parseLedgerDate(rawDate, mapping.dateFormat);
      } catch {
        return null;
      }

      return {
        accountName,
        date,
        amount,
        description,
        category,
        memo,
        cleared: false,
        isTransfer: false,
        transferTarget: null,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const uniqueCategories = [
    ...new Set(transactions.flatMap((t) => (t.category ? [t.category] : []))),
  ];

  return {
    accounts: [accountName],
    transactions,
    uniqueCategories,
    uniqueTransferTargets: [],
    detectedDateFormat: detectDateFormat(transactions.map((t) => t.date)),
  };
}
