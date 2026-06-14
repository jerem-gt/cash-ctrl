import { describe, expect, it } from 'vitest';

import type { CsvParseResult } from '@/lib/csv-parser';

import { buildLedgerFromCsv, type CsvMapping } from './csv-import.helpers';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResult(rows: string[][], headers = ['Date', 'Libellé', 'Montant']): CsvParseResult {
  return { headers, rows, delimiter: ';', sample: rows.slice(0, 5) };
}

const BASE_MAPPING_SIGNED: CsvMapping = {
  dateCol: 0,
  descriptionCol: 1,
  amountMode: 'signed',
  amountCol: 2,
  decimalSep: ',',
  dateFormat: 'DD/MM',
};

// ─── buildLedgerFromCsv ───────────────────────────────────────────────────────

describe('buildLedgerFromCsv', () => {
  it('produit un ParsedLedger avec les comptes et transactions', () => {
    const result = makeResult([['15/01/2024', 'Courses', '-50,00']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'Mon Compte');
    expect(ledger.accounts).toEqual(['Mon Compte']);
    expect(ledger.transactions).toHaveLength(1);
    expect(ledger.transactions[0].accountName).toBe('Mon Compte');
  });

  it('convertit la date au format ISO', () => {
    const result = makeResult([['15/01/2024', 'Test', '-10,00']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'Compte');
    expect(ledger.transactions[0].date).toBe('2024-01-15');
  });

  it('colonne signée : montant négatif → dépense', () => {
    const result = makeResult([['15/01/2024', 'Courses', '-50,00']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions[0].amount).toBeCloseTo(-50);
  });

  it('colonne signée : montant positif → revenu', () => {
    const result = makeResult([['15/01/2024', 'Salaire', '2000,00']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions[0].amount).toBeCloseTo(2000);
  });

  it('mode split : colonne débit renseignée → montant négatif', () => {
    const headers = ['Date', 'Libellé', 'Débit', 'Crédit'];
    const result = makeResult([['15/01/2024', 'Courses', '50,00', '']], headers);
    const mapping: CsvMapping = {
      dateCol: 0,
      descriptionCol: 1,
      amountMode: 'split',
      debitCol: 2,
      creditCol: 3,
      decimalSep: ',',
      dateFormat: 'DD/MM',
    };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].amount).toBeCloseTo(-50);
  });

  it('mode split : colonne crédit renseignée → montant positif', () => {
    const headers = ['Date', 'Libellé', 'Débit', 'Crédit'];
    const result = makeResult([['20/01/2024', 'Salaire', '', '2000,00']], headers);
    const mapping: CsvMapping = {
      dateCol: 0,
      descriptionCol: 1,
      amountMode: 'split',
      debitCol: 2,
      creditCol: 3,
      decimalSep: ',',
      dateFormat: 'DD/MM',
    };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].amount).toBeCloseTo(2000);
  });

  it('extrait les catégories uniques', () => {
    const headers = ['Date', 'Libellé', 'Montant', 'Catégorie'];
    const result = makeResult(
      [
        ['15/01/2024', 'Courses', '-50,00', 'Alimentation'],
        ['16/01/2024', 'Bio', '-30,00', 'Alimentation'],
        ['17/01/2024', 'Cinéma', '-15,00', 'Loisirs'],
      ],
      headers,
    );
    const mapping: CsvMapping = { ...BASE_MAPPING_SIGNED, categoryCol: 3 };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.uniqueCategories).toHaveLength(2);
    expect(ledger.uniqueCategories).toContain('Alimentation');
    expect(ledger.uniqueCategories).toContain('Loisirs');
  });

  it('ignore les lignes sans date', () => {
    const result = makeResult([
      ['', 'Courses', '-50,00'],
      ['20/01/2024', 'Salaire', '2000,00'],
    ]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions).toHaveLength(1);
  });

  it('ignore les lignes avec montant invalide', () => {
    const result = makeResult([['15/01/2024', 'Test', 'n/a']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions).toHaveLength(0);
  });

  it('ignore les lignes avec une date invalide (format ne correspond pas au mapping)', () => {
    const result = makeResult([['32/01/2024', 'Test', '-10,00']]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions).toHaveLength(0);
  });

  it('mappe la colonne notes si fournie', () => {
    const headers = ['Date', 'Libellé', 'Montant', 'Notes'];
    const result = makeResult([['15/01/2024', 'Test', '-10,00', 'détail achat']], headers);
    const mapping: CsvMapping = { ...BASE_MAPPING_SIGNED, notesCol: 3 };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].memo).toBe('détail achat');
  });

  it('retourne un ledger vide pour un CSV sans lignes', () => {
    const result = makeResult([]);
    const ledger = buildLedgerFromCsv(result, BASE_MAPPING_SIGNED, 'C');
    expect(ledger.transactions).toHaveLength(0);
    expect(ledger.uniqueCategories).toHaveLength(0);
  });

  it('supporte le format de date MM/DD avec point décimal', () => {
    const result = makeResult([['01/15/2024', 'Test', '-10.00']]);
    const mapping: CsvMapping = {
      ...BASE_MAPPING_SIGNED,
      dateFormat: 'MM/DD',
      decimalSep: '.',
    };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].date).toBe('2024-01-15');
    expect(ledger.transactions[0].amount).toBeCloseTo(-10);
  });

  it('supporte le format de date YYYY-MM-DD (ISO, style Bourso)', () => {
    const result = makeResult([['2024-01-15', 'Courses', '-50,00']]);
    const mapping: CsvMapping = {
      ...BASE_MAPPING_SIGNED,
      dateFormat: 'YYYY-MM-DD',
    };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].date).toBe('2024-01-15');
  });

  it('supporte le format YYYY/MM/DD avec slashes', () => {
    const result = makeResult([['2024/01/15', 'Test', '-10,00']]);
    const mapping: CsvMapping = {
      ...BASE_MAPPING_SIGNED,
      dateFormat: 'YYYY-MM-DD',
    };
    const ledger = buildLedgerFromCsv(result, mapping, 'C');
    expect(ledger.transactions[0].date).toBe('2024-01-15');
  });
});
