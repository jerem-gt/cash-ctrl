import { describe, expect, it } from 'vitest';

import { gDateToISO, parseXhb } from './xhb-parser';

// ─── gDateToISO ───────────────────────────────────────────────────────────────

describe('gDateToISO', () => {
  it('convertit le serial GLib correspondant au 1er janvier 2013', () => {
    // 2013-01-01 = Unix day 15706, GLib serial = 719163 + 15706 = 734869
    expect(gDateToISO(734869)).toBe('2013-01-01');
  });

  it('convertit le serial GLib correspondant au 15 mars 2020', () => {
    // 2020-03-15
    const d = new Date('2020-03-15T00:00:00Z');
    const unixDay = Math.floor(d.getTime() / 86400000);
    const glib = 719163 + unixDay;
    expect(gDateToISO(glib)).toBe('2020-03-15');
  });
});

// ─── parseXhb ─────────────────────────────────────────────────────────────────

function makeXhb(body: string): string {
  return `<?xml version="1.0"?><homebank v="1.6">${body}</homebank>`;
}

const BASE_ACCOUNT = `<account key="1" name="Courant" bankname="BNP" initial="1000" pos="1" type="1" curr="1"/>`;
const BASE_CAT_ROOT = `<cat key="1" name="Alimentation"/>`;
const BASE_CAT_SUB = `<cat key="2" parent="1" flags="1" name="Supermarché"/>`;
const BASE_PAYEE = `<pay key="1" name="Carrefour" paymode="6"/>`;

describe('parseXhb', () => {
  describe('transactions régulières', () => {
    it('parse une transaction simple', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_CAT_ROOT}
        ${BASE_CAT_SUB}
        ${BASE_PAYEE}
        <ope date="734869" amount="-50.5" account="1" category="2" payee="1" wording="Courses" st="1" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions).toHaveLength(1);
      const tx = result.transactions[0];
      expect(tx.accountName).toBe('Courant');
      expect(tx.date).toBe('2013-01-01');
      expect(tx.amount).toBe(-50.5);
      expect(tx.description).toBe('Courses');
      expect(tx.categoryString).toBe('Alimentation:Supermarché');
      expect(tx.validated).toBe(true);
    });

    it('utilise le nom du payee si wording est absent', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_PAYEE}
        <ope date="734869" amount="-20" account="1" payee="1" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].description).toBe('Carrefour');
    });

    it("résout le paymode depuis le payee si absent sur l'opération", () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_PAYEE}
        <ope date="734869" amount="-20" account="1" payee="1" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].paymode).toBe(6);
    });

    it("utilise le paymode de l'opération en priorité sur celui du payee", () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_PAYEE}
        <ope date="734869" amount="-20" account="1" payee="1" paymode="2" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].paymode).toBe(2);
    });

    it('st=0 produit validated=false', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].validated).toBe(false);
    });

    it('st=2 (rapproché) produit validated=true', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="Test" st="2" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].validated).toBe(true);
    });

    it('stocke info comme notes si présent', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="Test" info="ref123" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].notes).toBe('ref123');
    });

    it('notes est null si info absent', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].notes).toBeNull();
    });

    it('catégorie racine (sans parent) donne juste le nom', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_CAT_ROOT}
        <ope date="734869" amount="-20" account="1" category="1" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].categoryString).toBe('Alimentation');
    });

    it('categoryString vide si catégorie = 0', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" category="0" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].categoryString).toBe('');
    });

    it('ignore les opérations avec un compte inconnu', () => {
      const xhb = makeXhb(`
        <ope date="734869" amount="-20" account="99" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe('ventilations', () => {
    const SPLIT_CATS = `
      <cat key="20" name="Logement"/>
      <cat key="53" parent="20" flags="1" name="Loyer"/>
      <cat key="60" name="Assurance"/>
      <cat key="62" parent="60" flags="1" name="Habitation"/>
    `;

    it('parse une dépense ventilée en 4 lignes', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${SPLIT_CATS}
        <ope date="734878" amount="-516.76999999999998" account="1" paymode="11" st="2" flags="256" scat="53||20||60||62" samt="-367.47000000000003||-118.31||-18.91||-12.08" smem="Loyer||Régularisation||||"/>
      `);
      const result = parseXhb(xhb);
      const tx = result.transactions[0];
      expect(tx.categoryString).toBe('');
      expect(tx.splits).toEqual([
        { category: 'Logement:Loyer', amount: -367.47000000000003, memo: 'Loyer' },
        { category: 'Logement', amount: -118.31, memo: 'Régularisation' },
        { category: 'Assurance', amount: -18.91, memo: null },
        { category: 'Assurance:Habitation', amount: -12.08, memo: null },
      ]);
      expect(result.uniqueCategories).toEqual([
        'Logement:Loyer',
        'Logement',
        'Assurance',
        'Assurance:Habitation',
      ]);
    });

    it('parse un revenu ventilé en 2 lignes avec mémos', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${SPLIT_CATS}
        <ope date="734267" amount="61.43" account="1" st="2" flags="258" scat="60||20" samt="36.729999999999997||24.699999999999999" smem="Remise exceptionnelle 2011||Remise"/>
      `);
      const tx = parseXhb(xhb).transactions[0];
      expect(tx.splits).toEqual([
        { category: 'Assurance', amount: 36.73, memo: 'Remise exceptionnelle 2011' },
        { category: 'Logement', amount: 24.7, memo: 'Remise' },
      ]);
    });

    it('conserve une catégorie répétée et dédoublonne uniqueCategories', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${SPLIT_CATS}
        <ope date="734869" amount="-30" account="1" st="0" flags="256" scat="60||60" samt="-10||-20" smem="||"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].splits).toHaveLength(2);
      expect(result.uniqueCategories).toEqual(['Assurance']);
    });

    it('donne une catégorie vide pour une clé à 0 ou inconnue, hors uniqueCategories', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${SPLIT_CATS}
        <ope date="734869" amount="-30" account="1" st="0" flags="256" scat="0||999" samt="-10||-20" smem="||"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transactions[0].splits?.map((s) => s.category)).toEqual(['', '']);
      expect(result.uniqueCategories).toEqual([]);
    });

    it("n'ajoute pas splits à une opération normale", () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${SPLIT_CATS}
        <ope date="734869" amount="-20" account="1" category="60" wording="T" st="0" flags="2"/>
      `);
      const tx = parseXhb(xhb).transactions[0];
      expect(tx.splits).toBeUndefined();
      expect('splits' in tx).toBe(false);
    });
  });

  describe('virements', () => {
    it('déduplique les virements par kxfer', () => {
      const xhb = makeXhb(`
        <account key="1" name="Courant" bankname="BNP" initial="0" pos="1" type="1" curr="1"/>
        <account key="2" name="Épargne" bankname="BNP" initial="0" pos="2" type="1" curr="1"/>
        <ope date="734869" amount="-500" account="1" dst_account="2" st="2" flags="8" wording="Virement" kxfer="1"/>
        <ope date="734869" amount="500" account="2" dst_account="1" st="2" flags="10" wording="Virement" kxfer="1"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transfers).toHaveLength(1);
      expect(result.transactions).toHaveLength(0);
    });

    it('détermine correctement from/to depuis le montant négatif', () => {
      const xhb = makeXhb(`
        <account key="1" name="Courant" bankname="BNP" initial="0" pos="1" type="1" curr="1"/>
        <account key="2" name="Épargne" bankname="BNP" initial="0" pos="2" type="1" curr="1"/>
        <ope date="734869" amount="-500" account="1" dst_account="2" st="2" flags="8" wording="Virement" kxfer="1"/>
        <ope date="734869" amount="500" account="2" dst_account="1" st="2" flags="10" wording="Virement" kxfer="1"/>
      `);
      const result = parseXhb(xhb);
      const tf = result.transfers[0];
      expect(tf.fromAccountName).toBe('Courant');
      expect(tf.toAccountName).toBe('Épargne');
      expect(tf.amount).toBe(500);
    });

    it('parse la date et la description du virement', () => {
      const xhb = makeXhb(`
        <account key="1" name="Courant" bankname="BNP" initial="0" pos="1" type="1" curr="1"/>
        <account key="2" name="Épargne" bankname="BNP" initial="0" pos="2" type="1" curr="1"/>
        <ope date="734869" amount="-200" account="1" dst_account="2" st="2" flags="8" wording="Épargne mensuelle" kxfer="5"/>
        <ope date="734869" amount="200" account="2" dst_account="1" st="2" flags="10" wording="Épargne mensuelle" kxfer="5"/>
      `);
      const result = parseXhb(xhb);
      expect(result.transfers[0].date).toBe('2013-01-01');
      expect(result.transfers[0].description).toBe('Épargne mensuelle');
    });

    it('st=2 (rapproché) produit validated=true sur un virement', () => {
      const xhb = makeXhb(`
        <account key="1" name="Courant" bankname="BNP" initial="0" pos="1" type="1" curr="1"/>
        <account key="2" name="Épargne" bankname="BNP" initial="0" pos="2" type="1" curr="1"/>
        <ope date="734869" amount="-100" account="1" dst_account="2" st="2" flags="8" wording="V" kxfer="1"/>
        <ope date="734869" amount="100" account="2" dst_account="1" st="2" flags="10" wording="V" kxfer="1"/>
      `);
      expect(parseXhb(xhb).transfers[0].validated).toBe(true);
    });

    it('st=0 produit validated=false sur un virement', () => {
      const xhb = makeXhb(`
        <account key="1" name="Courant" bankname="BNP" initial="0" pos="1" type="1" curr="1"/>
        <account key="2" name="Épargne" bankname="BNP" initial="0" pos="2" type="1" curr="1"/>
        <ope date="734869" amount="-100" account="1" dst_account="2" st="0" flags="8" wording="V" kxfer="2"/>
        <ope date="734869" amount="100" account="2" dst_account="1" st="0" flags="10" wording="V" kxfer="2"/>
      `);
      expect(parseXhb(xhb).transfers[0].validated).toBe(false);
    });
  });

  describe('résultat agrégé', () => {
    it('expose les noms de comptes uniques référencés', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="Test" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.accounts).toContain('Courant');
    });

    it('expose les catégories uniques utilisées', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        ${BASE_CAT_ROOT}
        ${BASE_CAT_SUB}
        <ope date="734869" amount="-20" account="1" category="2" wording="T" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.uniqueCategories).toContain('Alimentation:Supermarché');
    });

    it('expose les paymodes distincts non nuls', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" paymode="11" wording="A" st="0" flags="2"/>
        <ope date="734869" amount="-30" account="1" paymode="6" wording="B" st="0" flags="2"/>
        <ope date="734869" amount="-10" account="1" paymode="0" wording="C" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.uniquePaymodes).toContain(6);
      expect(result.uniquePaymodes).toContain(11);
      expect(result.uniquePaymodes).not.toContain(0);
    });

    it('fournit les détails de compte pour le solde initial', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="T" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.accountDetails.get('Courant')?.initial).toBe(1000);
    });

    it('expose le bankname du compte', () => {
      const xhb = makeXhb(`
        ${BASE_ACCOUNT}
        <ope date="734869" amount="-20" account="1" wording="T" st="0" flags="2"/>
      `);
      const result = parseXhb(xhb);
      expect(result.accountDetails.get('Courant')?.bankname).toBe('BNP');
    });
  });
});
