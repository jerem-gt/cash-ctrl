import { describe, expect, it } from 'vitest';

import { detectDecimalSeparator, parseCsvAmount, parseCsvRaw } from './csv-parser';

// ─── parseCsvRaw ─────────────────────────────────────────────────────────────

describe('parseCsvRaw', () => {
  it('parse un CSV à délimiteur point-virgule', () => {
    const csv = 'Date;Libellé;Montant\n15/01/2024;Courses;-50,00\n20/01/2024;Salaire;2000,00';
    const r = parseCsvRaw(csv);
    expect(r.delimiter).toBe(';');
    expect(r.headers).toEqual(['Date', 'Libellé', 'Montant']);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual(['15/01/2024', 'Courses', '-50,00']);
  });

  it('détecte la virgule comme délimiteur', () => {
    const csv = 'Date,Label,Amount\n2024-01-15,Groceries,-50.00';
    const r = parseCsvRaw(csv);
    expect(r.delimiter).toBe(',');
    expect(r.headers).toEqual(['Date', 'Label', 'Amount']);
  });

  it('détecte la tabulation comme délimiteur', () => {
    const csv = 'Date\tLibellé\tMontant\n15/01/2024\tCourses\t-50,00';
    const r = parseCsvRaw(csv);
    expect(r.delimiter).toBe('\t');
    expect(r.rows[0]).toEqual(['15/01/2024', 'Courses', '-50,00']);
  });

  it('gère les champs entre guillemets contenant le délimiteur', () => {
    const csv = 'Date;Libellé;Montant\n15/01/2024;"Virement; BNP";-100,00';
    const r = parseCsvRaw(csv);
    expect(r.rows[0][1]).toBe('Virement; BNP');
  });

  it('gère les guillemets doublés (RFC 4180)', () => {
    const csv = 'Date;Libellé\n15/01/2024;"Dépense ""spéciale"""';
    const r = parseCsvRaw(csv);
    expect(r.rows[0][1]).toBe('Dépense "spéciale"');
  });

  it('ignore les lignes vides', () => {
    const csv = 'Date;Montant\n15/01/2024;-50\n\n20/01/2024;100';
    const r = parseCsvRaw(csv);
    expect(r.rows).toHaveLength(2);
  });

  it('retourne headers et rows vides pour un texte vide', () => {
    const r = parseCsvRaw('');
    expect(r.headers).toHaveLength(0);
    expect(r.rows).toHaveLength(0);
  });

  it('expose un sample de 5 lignes au maximum', () => {
    const lines = ['A;B', ...Array.from({ length: 10 }, (_, i) => `r${i};v${i}`)].join('\n');
    const r = parseCsvRaw(lines);
    expect(r.sample).toHaveLength(5);
  });

  it('utilise le délimiteur forcé quand fourni (override auto-détection)', () => {
    // CSV ambigu : contient autant de ';' que de ',' — on force ','
    const csv = 'Date,Libellé,Montant\n2024-01-15,Courses,-50';
    const r = parseCsvRaw(csv, ',');
    expect(r.delimiter).toBe(',');
    expect(r.headers).toEqual(['Date', 'Libellé', 'Montant']);
    expect(r.rows[0]).toEqual(['2024-01-15', 'Courses', '-50']);
  });
});

// ─── detectDecimalSeparator ───────────────────────────────────────────────────

describe('detectDecimalSeparator', () => {
  it('détecte la virgule comme séparateur décimal', () => {
    expect(detectDecimalSeparator(['-50,00', '1234,56', '-100,00'])).toBe(',');
  });

  it('détecte le point comme séparateur décimal', () => {
    expect(detectDecimalSeparator(['-50.00', '1234.56', '-100.00'])).toBe('.');
  });

  it("retourne ',' par défaut si scores égaux", () => {
    expect(detectDecimalSeparator([])).toBe(',');
  });
});

// ─── parseCsvAmount ───────────────────────────────────────────────────────────

describe('parseCsvAmount', () => {
  it('parse un montant négatif avec virgule décimale', () => {
    expect(parseCsvAmount('-50,00', ',')).toBeCloseTo(-50);
  });

  it('parse un grand montant avec point comme séparateur de milliers', () => {
    expect(parseCsvAmount('1.234,56', ',')).toBeCloseTo(1234.56);
  });

  it('parse un montant positif avec point décimal', () => {
    expect(parseCsvAmount('2000.00', '.')).toBeCloseTo(2000);
  });

  it('retire les espaces comme séparateur de milliers', () => {
    expect(parseCsvAmount('1 234,56', ',')).toBeCloseTo(1234.56);
    expect(parseCsvAmount('1 234.56', '.')).toBeCloseTo(1234.56);
  });

  it('parse un entier sans décimale', () => {
    expect(parseCsvAmount('-12', ',')).toBe(-12);
  });

  it('retourne NaN pour une valeur vide', () => {
    expect(parseCsvAmount('', ',')).toBeNaN();
  });

  it('retourne NaN pour une valeur non numérique', () => {
    expect(parseCsvAmount('n/a', ',')).toBeNaN();
  });
});
