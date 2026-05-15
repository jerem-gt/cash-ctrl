export interface TaxBracket {
  id: number;
  year: number;
  min_income: number; // euros
  max_income: number | null; // euros, null = tranche haute
  rate: number; // pourcentage (0, 11, 30, 41, 45)
  created_at: string;
}

export interface TaxYearParams {
  year: number;
  abattement_rate: number;
  abattement_min: number; // euros
  abattement_max: number; // euros
  pass: number; // euros (PASS)
  created_at: string;
}

export interface TaxYearData {
  year: number;
  params: TaxYearParams;
  brackets: TaxBracket[];
}
