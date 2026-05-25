import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, Select } from '@/components/ui';
import { useTaxYearData, useTaxYears } from '@/features/insurance/hooks/useTax';
import {
  type BracketDetail,
  simulate,
  type SimulationResult,
  type TaxResult,
} from '@/lib/taxCalculator';

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function BracketRow({ detail }: Readonly<{ detail: BracketDetail }>) {
  const { t } = useTranslation('insurance');
  const label =
    detail.max_income == null
      ? t('per_simulator.bracket_above', { rate: detail.rate })
      : t('per_simulator.bracket_label', { rate: detail.rate });
  return (
    <div className="flex items-center justify-between py-1 text-xs text-stone-600">
      <span className="text-stone-400">{label}</span>
      <span className="tabular-nums font-medium">{fmtEur(detail.tax)}</span>
    </div>
  );
}

function TaxColumn({
  label,
  result,
  colorClass,
}: Readonly<{ label: string; result: TaxResult; colorClass: string }>) {
  const { t } = useTranslation('insurance');
  const activeBrackets = result.bracketDetails.filter((d) => d.rate > 0);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">{label}</p>
      <div className="bg-stone-50 rounded-xl p-3 space-y-1">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-100">
          <span className="text-xs text-stone-500">{t('per_simulator.taxable_income')}</span>
          <span className="text-xs font-semibold tabular-nums">
            {fmtEur(result.revenuNetImposable)}
          </span>
        </div>
        {activeBrackets.map((d) => (
          <BracketRow key={d.rate} detail={d} />
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-stone-200">
          <span className="text-xs font-bold text-stone-700">{t('per_simulator.total_ir')}</span>
          <span className={`text-sm font-bold tabular-nums ${colorClass}`}>
            {fmtEur(result.impotTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export function PerFiscalSimulatorModal({ onClose }: Readonly<Props>) {
  const { t } = useTranslation('insurance');
  const { t: tc } = useTranslation('common');
  const { data: years = [], isLoading: yearsLoading } = useTaxYears();

  const partsOptions = useMemo(
    () => [
      { value: 1, label: t('per_simulator.parts_1') },
      { value: 1.5, label: t('per_simulator.parts_1_5') },
      { value: 2, label: t('per_simulator.parts_2') },
      { value: 2.5, label: t('per_simulator.parts_2_5') },
      { value: 3, label: t('per_simulator.parts_3') },
      { value: 4, label: t('per_simulator.parts_4') },
    ],
    [t],
  );
  const currentYear = new Date().getFullYear();
  const defaultYear = years.includes(currentYear) ? currentYear : (years[0] ?? currentYear);

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [revenuBrut, setRevenuBrut] = useState('');
  const [versementPER, setVersementPER] = useState('');
  const [nbParts, setNbParts] = useState(1);
  const [deductionMode, setDeductionMode] = useState<'forfait' | 'frais_reels'>('forfait');
  const [fraisReels, setFraisReels] = useState('');
  const [appliquerPlafond, setAppliquerPlafond] = useState(true);

  const resolvedYear = years.includes(selectedYear) ? selectedYear : years[0];
  const { data: yearData, isLoading: dataLoading } = useTaxYearData(
    yearsLoading ? undefined : resolvedYear,
  );

  const result = useMemo<SimulationResult | null>(() => {
    const revenu = Number.parseFloat(revenuBrut);
    const versement = Number.parseFloat(versementPER);
    if (!yearData || !revenu || revenu <= 0 || Number.isNaN(versement) || versement < 0)
      return null;

    const frais = deductionMode === 'frais_reels' ? Number.parseFloat(fraisReels) || 0 : undefined;
    return simulate(revenu, versement, nbParts, yearData, frais, appliquerPlafond);
  }, [revenuBrut, versementPER, nbParts, yearData, deductionMode, fraisReels, appliquerPlafond]);

  const canCompute =
    !!revenuBrut &&
    Number.parseFloat(revenuBrut) > 0 &&
    !!versementPER &&
    Number.parseFloat(versementPER) >= 0;

  const activeYear = years.includes(selectedYear) ? selectedYear : years[0];

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-sans text-xl">{t('per_simulator.title')}</h3>
              <p className="text-xs text-stone-400 mt-0.5">{t('per_simulator.subtitle')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-stone-300 hover:text-stone-500 text-xl leading-none ml-4"
              aria-label={t('per_simulator.close_aria')}
            >
              ×
            </button>
          </div>

          {/* Paramètres */}
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <FormGroup label={t('per_simulator.gross_income_label')} htmlFor="sim-revenu">
                <DecimalInput
                  id="sim-revenu"
                  placeholder={t('per_simulator.gross_income_placeholder')}
                  value={revenuBrut}
                  onChange={(e) => setRevenuBrut(e.target.value)}
                  autoFocus
                />
              </FormGroup>
              <FormGroup label={t('per_simulator.per_amount_label')} htmlFor="sim-versement">
                <DecimalInput
                  id="sim-versement"
                  placeholder={t('per_simulator.per_amount_placeholder')}
                  value={versementPER}
                  onChange={(e) => setVersementPER(e.target.value)}
                />
              </FormGroup>
            </div>

            <div className="flex gap-3 flex-wrap">
              <FormGroup label={t('per_simulator.parts_label')} htmlFor="sim-parts">
                <Select
                  id="sim-parts"
                  value={nbParts}
                  onChange={(e) => setNbParts(Number(e.target.value))}
                >
                  {partsOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup label={t('per_simulator.year_label')} htmlFor="sim-year">
                <Select
                  id="sim-year"
                  value={activeYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={yearsLoading}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </FormGroup>
            </div>

            {/* Mode déduction */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 mb-2">
                {t('per_simulator.deduction_title')}
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deduction"
                    value="forfait"
                    checked={deductionMode === 'forfait'}
                    onChange={() => setDeductionMode('forfait')}
                    className="accent-stone-800"
                  />
                  <span className="text-sm text-stone-700">
                    {t('per_simulator.forfait_label')}
                    {yearData && (
                      <span className="text-stone-400 text-xs ml-1">
                        {t('per_simulator.forfait_min_max', {
                          min: fmtEur(yearData.params.abattement_min),
                          max: fmtEur(yearData.params.abattement_max),
                        })}
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deduction"
                    value="frais_reels"
                    checked={deductionMode === 'frais_reels'}
                    onChange={() => setDeductionMode('frais_reels')}
                    className="accent-stone-800"
                  />
                  <span className="text-sm text-stone-700">
                    {t('per_simulator.frais_reels_label')}
                  </span>
                </label>
              </div>
              {deductionMode === 'frais_reels' && (
                <div className="mt-2 max-w-xs">
                  <DecimalInput
                    id="sim-frais"
                    placeholder={t('per_simulator.frais_reels_placeholder')}
                    value={fraisReels}
                    onChange={(e) => setFraisReels(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Plafond PER */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={appliquerPlafond}
                onChange={(e) => setAppliquerPlafond(e.target.checked)}
                className="accent-stone-800 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-stone-700">{t('per_simulator.ceiling_label')}</span>
              {!appliquerPlafond && (
                <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  {t('per_simulator.ceiling_carried_forward')}
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Résultats */}
        {dataLoading && (
          <div className="p-6 text-sm text-stone-400 text-center">
            {t('per_simulator.loading_scale')}
          </div>
        )}

        {!dataLoading && canCompute && result && (
          <div className="p-6 pt-5 border-t border-stone-100 mt-5 space-y-4">
            {/* Colonnes sans / avec PER */}
            <div className="flex gap-3">
              <TaxColumn
                label={t('per_simulator.col_without_per')}
                result={result.sansPER}
                colorClass="text-stone-800"
              />
              <TaxColumn
                label={t('per_simulator.col_with_per')}
                result={result.avecPER}
                colorClass="text-green-700"
              />
            </div>

            {/* Avertissement plafond */}
            {result.plafondDepasse && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  <Trans
                    i18nKey="per_simulator.ceiling_exceeded"
                    ns="insurance"
                    values={{
                      amount: fmtEur(Number.parseFloat(versementPER)),
                      ceiling: fmtEur(result.plafondPER),
                      deductible: fmtEur(result.versementDeductible),
                    }}
                    components={{ bold: <strong /> }}
                  />
                </span>
              </div>
            )}

            {/* Économie */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-800">
                  {t('per_simulator.tax_saving_label')}
                </span>
                <span className="text-xl font-bold text-green-700 tabular-nums">
                  {fmtEur(result.economie)}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1.5 leading-relaxed">
                <Trans
                  i18nKey="per_simulator.tax_saving_note"
                  ns="insurance"
                  components={{ bold: <strong /> }}
                />
              </p>
            </div>
          </div>
        )}

        <div className="p-6 pt-3 flex justify-end border-t border-stone-100">
          <Button onClick={onClose}>{tc('close')}</Button>
        </div>
      </div>
    </div>
  );
}
