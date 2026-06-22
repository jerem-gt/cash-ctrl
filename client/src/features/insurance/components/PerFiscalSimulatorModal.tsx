import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, DecimalInput, FormGroup, ModalFrame, Select } from '@/components/ui';
import { useTaxYearData, useTaxYears } from '@/features/insurance/hooks/useTax';
import { fmt } from '@/lib/format';
import {
  type BracketDetail,
  simulate,
  type SimulationResult,
  type TaxResult,
} from '@/lib/taxCalculator';

const CURRENT_YEAR = new Date().getFullYear();

function BracketRow({ detail }: Readonly<{ detail: BracketDetail }>) {
  const { t } = useTranslation('insurance');
  const label =
    detail.max_income == null
      ? t('per_simulator.bracket_above', { rate: detail.rate })
      : t('per_simulator.bracket_label', { rate: detail.rate });
  return (
    <div className="flex items-center justify-between py-1 text-xs text-content-secondary">
      <span className="text-content-subtle">{label}</span>
      <span className="tabular-nums font-medium">{fmt(detail.tax)}</span>
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-content-subtle mb-2">
        {label}
      </p>
      <div className="bg-surface-muted rounded-xl p-3 space-y-1">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-line-subtle">
          <span className="text-xs text-content-muted">{t('per_simulator.taxable_income')}</span>
          <span className="text-xs font-semibold tabular-nums">
            {fmt(result.revenuNetImposable)}
          </span>
        </div>
        {activeBrackets.map((d) => (
          <BracketRow key={d.rate} detail={d} />
        ))}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-line">
          <span className="text-xs font-bold text-content-secondary">
            {t('per_simulator.total_ir')}
          </span>
          <span className={`text-sm font-bold tabular-nums ${colorClass}`}>
            {fmt(result.impotTotal)}
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
  const defaultYear = years.includes(CURRENT_YEAR) ? CURRENT_YEAR : (years[0] ?? CURRENT_YEAR);

  // view state is only meaningful on mobile; on md+ both panels are always visible via CSS
  const [view, setView] = useState<'form' | 'results'>('form');
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [revenuBrut, setRevenuBrut] = useState('');
  const [versementPER, setVersementPER] = useState('');
  const [nbParts, setNbParts] = useState(1);
  const [deductionMode, setDeductionMode] = useState<'forfait' | 'frais_reels'>('forfait');
  const [fraisReels, setFraisReels] = useState('');
  const [appliquerPlafond, setAppliquerPlafond] = useState(true);
  const [plafondBase, setPlafondBase] = useState('');
  const [reportN1, setReportN1] = useState('');
  const [reportN2, setReportN2] = useState('');
  const [reportN3, setReportN3] = useState('');

  const totalReport =
    (Number.parseFloat(reportN1) || 0) +
    (Number.parseFloat(reportN2) || 0) +
    (Number.parseFloat(reportN3) || 0);

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
    const base = Number.parseFloat(plafondBase) || undefined;
    return simulate(
      revenu,
      versement,
      nbParts,
      yearData,
      frais,
      appliquerPlafond,
      totalReport,
      base,
    );
  }, [
    revenuBrut,
    versementPER,
    nbParts,
    yearData,
    deductionMode,
    fraisReels,
    appliquerPlafond,
    totalReport,
    plafondBase,
  ]);

  const footer = (
    <>
      {/* Mobile : navigation entre les deux vues */}
      <div className="flex justify-between w-full md:hidden">
        {view === 'form' ? (
          <>
            <Button variant="default" onClick={onClose}>
              {tc('close')}
            </Button>
            <Button onClick={() => setView('results')} disabled={!result}>
              {t('per_simulator.simulate_btn')}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </>
        ) : (
          <>
            <Button variant="default" onClick={() => setView('form')}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {t('per_simulator.edit_btn')}
            </Button>
            <Button onClick={onClose}>{tc('close')}</Button>
          </>
        )}
      </div>
      {/* Desktop : juste le bouton Fermer */}
      <div className="hidden md:block">
        <Button onClick={onClose}>{tc('close')}</Button>
      </div>
    </>
  );

  return (
    <ModalFrame
      title={t('per_simulator.title')}
      subtitle={t('per_simulator.subtitle')}
      size="4xl"
      onClose={onClose}
      footer={footer}
    >
      <div className="md:flex md:gap-6">
        {/* ── Panneau formulaire ── */}
        <div
          className={`md:w-[44%] md:shrink-0 space-y-4 ${view === 'results' ? 'hidden md:block' : ''}`}
        >
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
                value={resolvedYear}
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
            <p className="text-[11px] font-medium uppercase tracking-wider text-content-subtle mb-2">
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
                <span className="text-sm text-content-secondary">
                  {t('per_simulator.forfait_label')}
                  {yearData && (
                    <span className="text-content-subtle text-xs ml-1">
                      {t('per_simulator.forfait_min_max', {
                        min: fmt(yearData.params.abattement_min),
                        max: fmt(yearData.params.abattement_max),
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
                <span className="text-sm text-content-secondary">
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
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={appliquerPlafond}
                onChange={(e) => setAppliquerPlafond(e.target.checked)}
                className="accent-stone-800 w-4 h-4 shrink-0"
              />
              <span className="text-sm text-content-secondary">
                {t('per_simulator.ceiling_label')}
              </span>
            </label>

            {appliquerPlafond && (
              <div className="ml-6 bg-surface-muted rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-content-subtle">
                  {t('per_simulator.carryforward_section', {
                    year: resolvedYear ?? CURRENT_YEAR,
                  })}
                </p>
                <p className="text-xs text-content-muted">{t('per_simulator.carryforward_hint')}</p>
                <div className="space-y-1.5">
                  {[
                    {
                      id: 'sim-report-n3',
                      label: t('per_simulator.carryforward_unused_label', {
                        year: (resolvedYear ?? CURRENT_YEAR) - 3,
                      }),
                      value: reportN3,
                      onChange: setReportN3,
                    },
                    {
                      id: 'sim-report-n2',
                      label: t('per_simulator.carryforward_unused_label', {
                        year: (resolvedYear ?? CURRENT_YEAR) - 2,
                      }),
                      value: reportN2,
                      onChange: setReportN2,
                    },
                    {
                      id: 'sim-report-n1',
                      label: t('per_simulator.carryforward_unused_label', {
                        year: (resolvedYear ?? CURRENT_YEAR) - 1,
                      }),
                      value: reportN1,
                      onChange: setReportN1,
                    },
                    {
                      id: 'sim-plafond-base',
                      label: t('per_simulator.carryforward_base_label', {
                        year: (resolvedYear ?? CURRENT_YEAR) - 1,
                      }),
                      value: plafondBase,
                      onChange: setPlafondBase,
                    },
                  ].map(({ id, label, value, onChange }) => (
                    <div key={id} className="flex items-center gap-3">
                      <label
                        htmlFor={id}
                        className="flex-1 text-xs text-content-subtle leading-snug"
                      >
                        {label}
                      </label>
                      <div className="w-28 shrink-0">
                        <DecimalInput
                          id={id}
                          placeholder={t('per_simulator.carryforward_placeholder')}
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {dataLoading && (
            <p className="text-sm text-content-subtle text-center">
              {t('per_simulator.loading_scale')}
            </p>
          )}
        </div>

        {/* ── Séparateur vertical desktop ── */}
        <div className="hidden md:block w-px bg-line-subtle shrink-0" />

        {/* ── Panneau résultats ── */}
        <div className={`md:flex-1 min-w-0 ${view === 'form' ? 'hidden md:block' : ''}`}>
          {result ? (
            <div className="space-y-4">
              {/* Mini récap — mobile uniquement */}
              <div className="md:hidden bg-surface-muted rounded-xl px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span className="text-content-subtle">
                  {t('per_simulator.recap_income', { year: resolvedYear })}
                </span>
                <span className="text-right font-medium tabular-nums">
                  {fmt(Number.parseFloat(revenuBrut))}
                </span>
                <span className="text-content-subtle">{t('per_simulator.recap_versement')}</span>
                <span className="text-right font-medium tabular-nums">
                  {fmt(Number.parseFloat(versementPER))}
                </span>
                <span className="text-content-subtle">{t('per_simulator.recap_parts')}</span>
                <span className="text-right font-medium">
                  {partsOptions.find((o) => o.value === nbParts)?.label ?? nbParts}
                </span>
                {deductionMode === 'frais_reels' && (
                  <>
                    <span className="text-content-subtle">{t('per_simulator.recap_frais')}</span>
                    <span className="text-right font-medium tabular-nums">
                      {fmt(Number.parseFloat(fraisReels) || 0)}
                    </span>
                  </>
                )}
                {appliquerPlafond && (
                  <>
                    <span className="text-content-subtle">{t('per_simulator.recap_ceiling')}</span>
                    <span className="text-right font-medium tabular-nums">
                      {fmt(result.plafondTotal)}
                    </span>
                  </>
                )}
              </div>

              {/* Colonnes sans / avec PER */}
              <div className="flex gap-3">
                <TaxColumn
                  label={t('per_simulator.col_without_per')}
                  result={result.sansPER}
                  colorClass="text-content"
                />
                <TaxColumn
                  label={t('per_simulator.col_with_per')}
                  result={result.avecPER}
                  colorClass="text-success"
                />
              </div>

              {/* Détail plafond avec report */}
              {appliquerPlafond && totalReport > 0 && (
                <div className="bg-surface-muted rounded-xl px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-content-subtle mb-1">
                    {t('per_simulator.ceiling_total_label')}
                  </p>
                  <div className="flex justify-between text-xs text-content-secondary">
                    <span>
                      {t('per_simulator.ceiling_year_label', {
                        year: (resolvedYear ?? CURRENT_YEAR) - 1,
                      })}
                    </span>
                    <span className="tabular-nums">{fmt(result.plafondPER)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-content-secondary">
                    <span>{t('per_simulator.ceiling_report_label')}</span>
                    <span className="tabular-nums">{fmt(totalReport)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold border-t border-line-subtle pt-1 text-content">
                    <span>{t('per_simulator.ceiling_total_value_label')}</span>
                    <span className="tabular-nums">{fmt(result.plafondTotal)}</span>
                  </div>
                </div>
              )}

              {/* Avertissement plafond dépassé */}
              {result.plafondDepasse && (
                <div className="flex items-start gap-2 bg-warning-surface border border-warning/30 rounded-xl px-3 py-2.5 text-xs text-warning">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>
                    <Trans
                      i18nKey="per_simulator.ceiling_exceeded"
                      ns="insurance"
                      values={{
                        amount: fmt(Number.parseFloat(versementPER)),
                        ceiling: fmt(result.plafondTotal),
                        deductible: fmt(result.versementDeductible),
                      }}
                      components={{ bold: <strong /> }}
                    />
                  </span>
                </div>
              )}

              {/* Économie d'impôt */}
              <div className="bg-success-surface border border-success/30 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-success">
                    {t('per_simulator.tax_saving_label')}
                  </span>
                  <span className="text-xl font-bold text-success tabular-nums">
                    {fmt(result.economie)}
                  </span>
                </div>
                <p className="text-xs text-success mt-1.5 leading-relaxed">
                  <Trans
                    i18nKey="per_simulator.tax_saving_note"
                    ns="insurance"
                    components={{ bold: <strong /> }}
                  />
                </p>
              </div>
            </div>
          ) : (
            /* Placeholder desktop quand aucun résultat calculé */
            <div className="hidden md:flex items-center justify-center h-full min-h-[240px] rounded-xl border border-dashed border-line-subtle">
              <p className="text-sm text-content-subtle text-center px-6 leading-relaxed">
                {t('per_simulator.results_placeholder')}
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalFrame>
  );
}
