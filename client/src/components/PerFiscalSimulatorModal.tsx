import { useMemo, useState } from 'react';

import { useTaxYearData, useTaxYears } from '@/hooks/useTax';
import {
  type BracketDetail,
  simulate,
  type SimulationResult,
  type TaxResult,
} from '@/lib/taxCalculator';

import { Button, FormGroup, Input, Select } from './ui';

const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const PARTS_OPTIONS = [
  { value: 1, label: '1 part (célibataire / divorcé)' },
  { value: 1.5, label: '1,5 parts' },
  { value: 2, label: '2 parts (couple)' },
  { value: 2.5, label: '2,5 parts (couple + 1 enfant)' },
  { value: 3, label: '3 parts (couple + 2 enfants)' },
  { value: 4, label: '4 parts (couple + 3 enfants)' },
];

function BracketRow({ detail }: Readonly<{ detail: BracketDetail }>) {
  const label =
    detail.max_income == null ? `Tranche ${detail.rate}% (supérieure)` : `Tranche ${detail.rate}%`;
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
  const activeBrackets = result.bracketDetails.filter((d) => d.rate > 0);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">{label}</p>
      <div className="bg-stone-50 rounded-xl p-3 space-y-1">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-100">
          <span className="text-xs text-stone-500">Revenu imposable</span>
          <span className="text-xs font-semibold tabular-nums">
            {fmtEur(result.revenuNetImposable)}
          </span>
        </div>
        {activeBrackets.map((d) => (
          <BracketRow key={d.rate} detail={d} />
        ))}
        <div className={`flex items-center justify-between pt-2 mt-1 border-t border-stone-200`}>
          <span className="text-xs font-bold text-stone-700">IR total</span>
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
  const { data: years = [], isLoading: yearsLoading } = useTaxYears();
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
              <h3 className="font-sans text-xl">Simulateur fiscal PER</h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Calcul simplifié — sans plafonnement du quotient familial
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-stone-300 hover:text-stone-500 text-xl leading-none ml-4"
              aria-label="Fermer la modale"
            >
              ×
            </button>
          </div>

          {/* Paramètres */}
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <FormGroup label="Revenu brut annuel (€)" htmlFor="sim-revenu">
                <Input
                  id="sim-revenu"
                  type="number"
                  step="100"
                  min="0"
                  placeholder="ex : 45 000"
                  value={revenuBrut}
                  onChange={(e) => setRevenuBrut(e.target.value)}
                  autoFocus
                />
              </FormGroup>
              <FormGroup label="Versement PER prévu (€)" htmlFor="sim-versement">
                <Input
                  id="sim-versement"
                  type="number"
                  step="100"
                  min="0"
                  placeholder="ex : 3 000"
                  value={versementPER}
                  onChange={(e) => setVersementPER(e.target.value)}
                />
              </FormGroup>
            </div>

            <div className="flex gap-3 flex-wrap">
              <FormGroup label="Nombre de parts fiscales" htmlFor="sim-parts">
                <Select
                  id="sim-parts"
                  value={nbParts}
                  onChange={(e) => setNbParts(Number(e.target.value))}
                >
                  {PARTS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>
              <FormGroup label="Année fiscale" htmlFor="sim-year">
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
                Déduction professionnelle
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
                    Abattement 10% (forfait)
                    {yearData && (
                      <span className="text-stone-400 text-xs ml-1">
                        min {fmtEur(yearData.params.abattement_min)} / max{' '}
                        {fmtEur(yearData.params.abattement_max)}
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
                  <span className="text-sm text-stone-700">Frais réels</span>
                </label>
              </div>
              {deductionMode === 'frais_reels' && (
                <div className="mt-2 max-w-xs">
                  <Input
                    id="sim-frais"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="Montant frais réels (€)"
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
              <span className="text-sm text-stone-700">
                Tenir compte du plafond de déduction annuel
              </span>
              {!appliquerPlafond && (
                <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  report des années précédentes appliqué
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Résultats */}
        {dataLoading && (
          <div className="p-6 text-sm text-stone-400 text-center">Chargement du barème…</div>
        )}

        {!dataLoading && canCompute && result && (
          <div className="p-6 pt-5 border-t border-stone-100 mt-5 space-y-4">
            {/* Colonnes sans / avec PER */}
            <div className="flex gap-3">
              <TaxColumn
                label="Sans versement PER"
                result={result.sansPER}
                colorClass="text-stone-800"
              />
              <TaxColumn
                label="Avec versement PER"
                result={result.avecPER}
                colorClass="text-green-700"
              />
            </div>

            {/* Avertissement plafond */}
            {result.plafondDepasse && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>
                  Versement saisi ({fmtEur(Number.parseFloat(versementPER))}) dépasse le plafond
                  déductible ({fmtEur(result.plafondPER)}). Seuls{' '}
                  <strong>{fmtEur(result.versementDeductible)}</strong> ont été pris en compte dans
                  le calcul.
                </span>
              </div>
            )}

            {/* Économie */}
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-green-800">Économie d'impôt</span>
                <span className="text-xl font-bold text-green-700 tabular-nums">
                  {fmtEur(result.economie)}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1.5 leading-relaxed">
                Cet avantage fiscal correspond à un impôt <strong>différé</strong>, non supprimé. À
                la sortie du PER (rente ou capital), les sommes versées seront imposées à l'IR selon
                votre tranche de l'époque.
              </p>
            </div>
          </div>
        )}

        <div className="p-6 pt-3 flex justify-end border-t border-stone-100">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}
