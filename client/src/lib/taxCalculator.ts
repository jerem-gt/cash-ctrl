import type { TaxBracket, TaxYearData, TaxYearParams } from '@cashctrl/types';

export interface BracketDetail {
  rate: number;
  min_income: number;
  max_income: number | null;
  base: number; // montant imposable dans cette tranche
  tax: number; // impôt de cette tranche
}

export interface TaxResult {
  revenuBrut: number;
  abattement: number;
  revenuNetImposable: number;
  revenuParPart: number;
  bracketDetails: BracketDetail[];
  impotParPart: number;
  impotTotal: number;
}

export interface SimulationResult {
  sansPER: TaxResult;
  avecPER: TaxResult;
  versementDeductible: number;
  plafondPER: number;
  plafondTotal: number;
  plafondDepasse: boolean;
  economie: number;
}

export function computeAbattement(
  revenuBrut: number,
  params: TaxYearParams,
  fraisReels?: number,
): number {
  if (fraisReels != null && fraisReels > 0) return fraisReels;
  const raw = revenuBrut * params.abattement_rate;
  return Math.min(Math.max(raw, params.abattement_min), params.abattement_max);
}

export function computePlafondPER(revenuNetImposable: number, params: TaxYearParams): number {
  const plafondMin = params.pass * 0.1;
  const plafondMax = params.pass * 8 * 0.1;
  return Math.min(Math.max(revenuNetImposable * 0.1, plafondMin), plafondMax);
}

function calculateTaxOnRevenu(
  revenuParPart: number,
  brackets: TaxBracket[],
): {
  impotParPart: number;
  bracketDetails: BracketDetail[];
} {
  let impotParPart = 0;
  const bracketDetails: BracketDetail[] = [];

  for (const bracket of brackets) {
    if (bracket.rate === 0) {
      bracketDetails.push({ ...bracket, base: 0, tax: 0 });
      continue;
    }
    const maxIncome = bracket.max_income ?? Infinity;
    if (revenuParPart <= bracket.min_income) {
      bracketDetails.push({ ...bracket, base: 0, tax: 0 });
      continue;
    }
    const base = Math.min(revenuParPart, maxIncome) - bracket.min_income;
    const tax = base * (bracket.rate / 100);
    impotParPart += tax;
    bracketDetails.push({ ...bracket, base, tax });
  }

  return { impotParPart, bracketDetails };
}

function computeTaxResult(
  revenuBrut: number,
  abattement: number,
  nbParts: number,
  brackets: TaxBracket[],
): TaxResult {
  const revenuNetImposable = Math.max(0, revenuBrut - abattement);
  const revenuParPart = revenuNetImposable / nbParts;
  const { impotParPart, bracketDetails } = calculateTaxOnRevenu(revenuParPart, brackets);
  const impotTotal = impotParPart * nbParts;

  return {
    revenuBrut,
    abattement,
    revenuNetImposable,
    revenuParPart,
    bracketDetails,
    impotParPart,
    impotTotal,
  };
}

export interface SimulateOptions {
  fraisReels?: number;
  appliquerPlafond?: boolean;
  reportAnneesPrecedentes?: number;
  plafondBase?: number;
}

export function simulate(
  revenuBrut: number,
  versementPER: number,
  nbParts: number,
  yearData: TaxYearData,
  options: SimulateOptions = {},
): SimulationResult {
  const { fraisReels, appliquerPlafond = true, reportAnneesPrecedentes = 0, plafondBase } = options;
  const { params, brackets } = yearData;

  const abattement = computeAbattement(revenuBrut, params, fraisReels);
  const revenuNetImposable = Math.max(0, revenuBrut - abattement);

  // Quand plafondBase est fourni (saisi depuis l'avis d'imposition), on l'utilise
  // directement plutôt que de le calculer depuis le revenu courant.
  const plafondPER = plafondBase ?? computePlafondPER(revenuNetImposable, params);
  const plafondTotal = plafondPER + reportAnneesPrecedentes;
  const versementDeductible = appliquerPlafond
    ? Math.min(versementPER, plafondTotal)
    : versementPER;
  const plafondDepasse = appliquerPlafond && versementPER > plafondTotal;

  const sansPER = computeTaxResult(revenuBrut, abattement, nbParts, brackets);

  const revenuBrutAvecPER = Math.max(0, revenuNetImposable - versementDeductible) + abattement;
  const avecPER = computeTaxResult(revenuBrutAvecPER, abattement, nbParts, brackets);

  const economie = Math.max(0, sansPER.impotTotal - avecPER.impotTotal);

  return {
    sansPER,
    avecPER,
    versementDeductible,
    plafondPER,
    plafondTotal,
    plafondDepasse,
    economie,
  };
}
