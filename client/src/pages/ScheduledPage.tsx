import { type SyntheticEvent, useMemo, useState } from 'react';

import type { ScheduledPayload } from '@/api/client';
import { AccountSelect } from '@/components/AccountSelect';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import {
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  FormGroup,
  Input,
  Select,
  showToast,
  Skeleton,
} from '@/components/ui';
import { useAccounts } from '@/hooks/useAccounts';
import { useBanks } from '@/hooks/useBanks';
import { useCategories } from '@/hooks/useCategories';
import { useInsuranceSupports } from '@/hooks/useInsurance';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import {
  useCreateScheduled,
  useDeleteScheduled,
  useScheduled,
  useUpdateScheduled,
} from '@/hooks/useScheduled';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { fmtDec, today } from '@/lib/format';
import type {
  Account,
  RecurrenceUnit,
  ScheduledTransaction,
  Subcategory,
  WeekendHandling,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

function recurrenceLabel(s: ScheduledTransaction): string {
  const n = s.recurrence_interval;
  const unit = s.recurrence_unit;

  if (unit === 'day') return n === 1 ? 'Chaque jour' : `Tous les ${n} jours`;
  if (unit === 'week') return n === 1 ? 'Chaque semaine' : `Toutes les ${n} semaines`;
  if (unit === 'month') {
    const day = s.recurrence_day ? ` le ${s.recurrence_day}` : '';
    return n === 1 ? `Chaque mois${day}` : `Tous les ${n} mois${day}`;
  }
  // year
  const day = s.recurrence_day ?? '';
  const month = s.recurrence_month ? ` ${MONTH_NAMES[s.recurrence_month - 1]}` : '';
  const when = day || month ? ` le ${day}${month}` : '';
  return n === 1 ? `Chaque année${when}` : `Tous les ${n} ans${when}`;
}

const WEEKEND_LABELS: Record<WeekendHandling, string> = {
  allow: 'Week-ends autorisés',
  before: 'Décaler au vendredi',
  after: 'Décaler au lundi',
};

function isInsuranceAccount(a: Account) {
  return a.envelope_type === 'life_insurance' || a.envelope_type === 'per';
}

// ─── Form state ───────────────────────────────────────────────────────────────

type ScheduledMode = 'transaction' | 'transfer' | 'versement';

type FormState = {
  mode: ScheduledMode;
  account_id: string;
  to_account_id: string;
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  payment_method_id: string;
  insurance_support_id: string;
  insurance_fees: string;
  notes: string;
  recurrence_unit: RecurrenceUnit;
  recurrence_interval: string;
  recurrence_day: string;
  recurrence_month: string;
  weekend_handling: WeekendHandling;
  start_date: string;
  end_date: string;
  active: boolean;
};

function emptyForm(firstAccountId?: number): FormState {
  return {
    mode: 'transaction',
    account_id: firstAccountId ? String(firstAccountId) : '',
    to_account_id: '',
    type: 'expense',
    amount: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    payment_method_id: '',
    insurance_support_id: '',
    insurance_fees: '0',
    notes: '',
    recurrence_unit: 'month',
    recurrence_interval: '1',
    recurrence_day: '1',
    recurrence_month: '1',
    weekend_handling: 'allow',
    start_date: today(),
    end_date: '',
    active: true,
  };
}

function schedToForm(s: ScheduledTransaction): FormState {
  const mode: ScheduledMode =
    s.insurance_support_id != null
      ? 'versement'
      : s.to_account_id != null
        ? 'transfer'
        : 'transaction';
  return {
    mode,
    account_id: String(s.account_id),
    to_account_id: s.to_account_id == null ? '' : String(s.to_account_id),
    type: s.type,
    amount: s.amount.toFixed(2),
    description: s.description,
    category_id: String(s.category_id ?? ''),
    subcategory_id: String(s.subcategory_id ?? ''),
    payment_method_id: String(s.payment_method_id ?? ''),
    insurance_support_id: s.insurance_support_id == null ? '' : String(s.insurance_support_id),
    insurance_fees: s.insurance_fees.toFixed(2),
    notes: s.notes ?? '',
    recurrence_unit: s.recurrence_unit,
    recurrence_interval: String(s.recurrence_interval),
    recurrence_day: s.recurrence_day == null ? '1' : String(s.recurrence_day),
    recurrence_month: s.recurrence_month == null ? '1' : String(s.recurrence_month),
    weekend_handling: s.weekend_handling,
    start_date: s.start_date,
    end_date: s.end_date ?? '',
    active: !!s.active,
  };
}

function formToPayload(
  f: FormState,
  paymentMethods: { id: number; name: string }[],
): ScheduledPayload {
  const unit = f.recurrence_unit;
  const recurrenceDay =
    unit === 'month' || unit === 'year' ? Number.parseInt(f.recurrence_day) || 1 : null;
  const recurrenceMonth = unit === 'year' ? Number.parseInt(f.recurrence_month) || 1 : null;

  const base = {
    amount: Number.parseFloat(f.amount),
    description: f.description.trim(),
    notes: f.notes.trim() || null,
    recurrence_unit: unit,
    recurrence_interval: Number.parseInt(f.recurrence_interval) || 1,
    recurrence_day: recurrenceDay,
    recurrence_month: recurrenceMonth,
    weekend_handling: f.weekend_handling,
    start_date: f.start_date,
    end_date: f.end_date || null,
    active: f.active,
  };

  if (f.mode === 'transfer') {
    const transferPm = paymentMethods.find((m) => m.name === 'Transfert');
    return {
      ...base,
      account_id: Number.parseInt(f.account_id),
      to_account_id: f.to_account_id ? Number.parseInt(f.to_account_id) : null,
      type: 'expense',
      subcategory_id: null,
      payment_method_id: transferPm?.id ?? null,
      insurance_support_id: null,
      insurance_fees: 0,
    };
  }

  if (f.mode === 'versement') {
    return {
      ...base,
      account_id: Number.parseInt(f.account_id),
      to_account_id: f.to_account_id ? Number.parseInt(f.to_account_id) : null,
      type: 'expense',
      subcategory_id: null,
      payment_method_id: null,
      insurance_support_id: f.insurance_support_id ? Number.parseInt(f.insurance_support_id) : null,
      insurance_fees: Number.parseFloat(f.insurance_fees) || 0,
    };
  }

  // transaction
  return {
    ...base,
    account_id: Number.parseInt(f.account_id),
    to_account_id: null,
    type: f.type,
    subcategory_id: Number.parseInt(f.subcategory_id) || null,
    payment_method_id: Number.parseInt(f.payment_method_id) || null,
    insurance_support_id: null,
    insurance_fees: 0,
  };
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

interface ModalProps {
  initial: FormState;
  accounts: ReturnType<typeof useAccounts>['data'];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string; subcategories: Subcategory[] }[];
  paymentMethods: { id: number; name: string; icon: string }[];
  title: string;
  isPending: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}

const MODE_LABELS: Record<ScheduledMode, string> = {
  transaction: 'Transaction',
  transfer: 'Transfert',
  versement: 'Versement AV/PER',
};

function ScheduledModal({
  initial,
  accounts = [],
  logoMap,
  categories,
  paymentMethods,
  title,
  isPending,
  onSave,
  onCancel,
}: Readonly<ModalProps>) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const insuranceAccounts = accounts.filter(isInsuranceAccount);
  const regularAccounts = accounts.filter((a) => !isInsuranceAccount(a));

  const { data: supports = [] } = useInsuranceSupports(
    form.mode === 'versement' ? Number(form.account_id) || 0 : 0,
  );

  const handleModeChange = (mode: ScheduledMode) => {
    setForm((f) => ({
      ...f,
      mode,
      account_id:
        mode === 'versement'
          ? insuranceAccounts[0]
            ? String(insuranceAccounts[0].id)
            : ''
          : mode === 'transfer' || f.mode === 'versement'
            ? regularAccounts[0]
              ? String(regularAccounts[0].id)
              : ''
            : f.account_id,
      to_account_id: '',
      insurance_support_id: '',
    }));
  };

  const coreValue: TxCoreState = {
    type: form.type,
    amount: form.amount,
    description: form.description,
    category_id: form.category_id,
    subcategory_id: form.subcategory_id,
    account_id: form.account_id,
    to_account_id: form.to_account_id,
    payment_method_id: form.payment_method_id,
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.amount || !form.description || !form.start_date) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (Number.parseFloat(form.amount) <= 0) {
      showToast('Le montant doit être positif.');
      return;
    }
    if (form.mode === 'transaction' && !form.account_id) {
      showToast('Veuillez choisir un compte.');
      return;
    }
    if (form.mode === 'transfer') {
      if (!form.account_id || !form.to_account_id) {
        showToast('Veuillez choisir les comptes source et destination.');
        return;
      }
    }
    if (form.mode === 'versement') {
      if (!form.account_id || !form.insurance_support_id || !form.to_account_id) {
        showToast('Veuillez choisir le compte AV/PER, le support et le compte source.');
        return;
      }
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-7 w-full max-w-2xl shadow-xl my-4">
        <h3 className="font-sans text-xl mb-5">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélecteur de mode */}
          <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
            {(['transaction', 'transfer', 'versement'] as ScheduledMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-lg transition-all ${
                  form.mode === m
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Champs selon le mode */}
          {form.mode === 'transaction' && (
            <TxCoreFields
              value={coreValue}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              accounts={accounts}
              logoMap={logoMap}
              categories={categories}
              paymentMethods={paymentMethods}
              isTransfer={false}
            />
          )}

          {form.mode === 'transfer' && (
            <TxCoreFields
              value={coreValue}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              accounts={accounts}
              logoMap={logoMap}
              categories={categories}
              paymentMethods={paymentMethods}
              isTransfer={true}
            />
          )}

          {form.mode === 'versement' && (
            <VersementFields
              form={form}
              patch={(updates) => setForm((f) => ({ ...f, ...updates }))}
              insuranceAccounts={insuranceAccounts}
              regularAccounts={regularAccounts}
              logoMap={logoMap}
              supports={supports}
            />
          )}

          {/* Récurrence */}
          <div className="border border-black/[0.07] rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Récurrence
            </p>
            <div className="flex gap-3 flex-wrap">
              <FormGroup label="Tous les…">
                <Input
                  type="number"
                  value={form.recurrence_interval}
                  onChange={(e) => set('recurrence_interval', e.target.value)}
                  min="1"
                  className="w-20"
                />
              </FormGroup>
              <FormGroup label="Unité">
                <Select
                  value={form.recurrence_unit}
                  onChange={(e) => set('recurrence_unit', e.target.value as RecurrenceUnit)}
                >
                  <option value="day">Jour(s)</option>
                  <option value="week">Semaine(s)</option>
                  <option value="month">Mois</option>
                  <option value="year">An(s)</option>
                </Select>
              </FormGroup>
              {(form.recurrence_unit === 'month' || form.recurrence_unit === 'year') && (
                <FormGroup label="Jour du mois">
                  <Input
                    type="number"
                    value={form.recurrence_day}
                    onChange={(e) => set('recurrence_day', e.target.value)}
                    min="1"
                    max="31"
                    className="w-20"
                  />
                </FormGroup>
              )}
              {form.recurrence_unit === 'year' && (
                <FormGroup label="Mois">
                  <Select
                    value={form.recurrence_month}
                    onChange={(e) => set('recurrence_month', e.target.value)}
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </FormGroup>
              )}
            </div>

            {/* Week-end */}
            <div className="flex gap-4 flex-wrap">
              {(['allow', 'before', 'after'] as WeekendHandling[]).map((v) => (
                <label
                  key={v}
                  className="flex items-center gap-1.5 cursor-pointer text-sm text-stone-700 select-none"
                >
                  <input
                    type="radio"
                    name="weekend_handling"
                    value={v}
                    checked={form.weekend_handling === v}
                    onChange={() => set('weekend_handling', v)}
                    className="accent-green-500"
                  />
                  {WEEKEND_LABELS[v]}
                </label>
              ))}
            </div>
          </div>

          {/* Dates + actif */}
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label="Date de début">
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Date de fin (optionnel)">
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
              />
            </FormGroup>
            <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => set('active', e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-stone-700">Actif</span>
            </label>
          </div>

          {/* Notes */}
          <FormGroup label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Informations complémentaires…"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all resize-none"
            />
          </FormGroup>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? '…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Champs spécifiques Versement ─────────────────────────────────────────────

function buildVersementDescription(
  accountName: string,
  support: { name: string; type: string } | undefined,
): string {
  if (!support) return '';
  const prefix = accountName ? `${accountName} · ` : '';
  return support.type === 'uc'
    ? `Versement UC — ${prefix}${support.name}`
    : `Versement fonds euro — ${prefix}${support.name}`;
}

interface VersementFieldsProps {
  form: FormState;
  patch: (updates: Partial<FormState>) => void;
  insuranceAccounts: Account[];
  regularAccounts: Account[];
  logoMap: Record<string, string | null>;
  supports: { id: number; name: string; type: string }[];
}

function VersementFields({
  form,
  patch,
  insuranceAccounts,
  regularAccounts,
  logoMap,
  supports,
}: Readonly<VersementFieldsProps>) {
  const accountName = insuranceAccounts.find((a) => String(a.id) === form.account_id)?.name ?? '';

  const handleAvAccountChange = (v: string) => {
    patch({ account_id: v, insurance_support_id: '', description: '' });
  };

  const handleSupportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supportId = e.target.value;
    const support = supports.find((s) => String(s.id) === supportId);
    const autoDesc = buildVersementDescription(accountName, support);
    patch({ insurance_support_id: supportId, description: autoDesc });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Compte AV / PER">
          <AccountSelect
            id="versement-av-account"
            value={form.account_id}
            onChange={handleAvAccountChange}
            accounts={insuranceAccounts}
            logoMap={logoMap}
            placeholder="— Choisir —"
          />
        </FormGroup>
        <FormGroup label="Support">
          <Select
            value={form.insurance_support_id}
            onChange={handleSupportChange}
            disabled={!form.account_id || supports.length === 0}
          >
            <option value="">— Choisir —</option>
            {supports.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name} ({s.type === 'euro' ? 'Euro' : 'UC'})
              </option>
            ))}
          </Select>
        </FormGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Compte source (débit)">
          <AccountSelect
            id="versement-source-account"
            value={form.to_account_id}
            onChange={(v) => patch({ to_account_id: v })}
            accounts={regularAccounts}
            logoMap={logoMap}
            placeholder="— Choisir —"
          />
        </FormGroup>
        <div className="flex gap-3">
          <FormGroup label="Montant (€)" className="flex-1">
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => patch({ amount: e.target.value })}
              placeholder="0,00"
              min="0.01"
              step="0.01"
            />
          </FormGroup>
          <FormGroup label="Frais (€)" className="w-28">
            <Input
              type="number"
              value={form.insurance_fees}
              onChange={(e) => patch({ insurance_fees: e.target.value })}
              placeholder="0,00"
              min="0"
              step="0.01"
            />
          </FormGroup>
        </div>
      </div>
      <FormGroup label="Description (modifiable)">
        <Input
          type="text"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Auto-généré à la sélection du support"
        />
      </FormGroup>
    </div>
  );
}

// ─── Ligne planification ──────────────────────────────────────────────────────

interface RowProps {
  sched: ScheduledTransaction;
  accounts: { id: number; name: string }[];
  onEdit: (s: ScheduledTransaction) => void;
  onDelete: (s: ScheduledTransaction) => void;
}

function ScheduledRow({ sched, accounts, onEdit, onDelete }: Readonly<RowProps>) {
  const isVersement = sched.insurance_support_id != null;
  const isTransfer = !isVersement && sched.to_account_id != null;
  const toAccount = isTransfer ? accounts.find((a) => a.id === sched.to_account_id) : null;
  const sourceAccount = isVersement ? accounts.find((a) => a.id === sched.to_account_id) : null;

  const typeColor = sched.type === 'income' ? 'text-green-800' : 'text-red-700';
  const amountColor = isTransfer || isVersement ? 'text-stone-500' : typeColor;
  const typeSign = sched.type === 'income' ? '+' : '−';
  const amountSign = isTransfer || isVersement ? '' : typeSign;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/6 last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{sched.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              ↔ Transfert
            </span>
          )}
          {isVersement && (
            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              ↑ Versement AV
            </span>
          )}
          {!sched.active && (
            <span className="text-[10px] bg-stone-100 text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 font-medium shrink-0">
              Suspendu
            </span>
          )}
        </div>
        <p className="text-[11px] text-stone-400 mt-0.5">
          {recurrenceLabel(sched)} · {sched.account_name}
          {isTransfer && toAccount ? ` → ${toAccount.name}` : ''}
          {isVersement && sched.insurance_support_name ? ` · ${sched.insurance_support_name}` : ''}
          {isVersement && sourceAccount ? ` · depuis ${sourceAccount.name}` : ''}
          {sched.end_date ? ` · jusqu'au ${sched.end_date}` : ''}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ${amountColor}`}>
        {amountSign}
        {fmtDec(sched.amount)}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onEdit(sched)}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors px-1"
        >
          Modifier
        </button>
        <button
          onClick={() => onDelete(sched)}
          className="text-xs text-stone-300 hover:text-red-400 transition-colors px-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScheduledPage() {
  const { data: scheduled = [], isLoading } = useScheduled();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const createScheduled = useCreateScheduled();
  const updateScheduled = useUpdateScheduled();
  const deleteScheduled = useDeleteScheduled();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: banks = [] } = useBanks();

  const logoMap = useMemo(() => Object.fromEntries(banks.map((b) => [b.name, b.logo])), [banks]);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTransaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTransaction | null>(null);
  const [leadDays, setLeadDays] = useState<string>('');

  const settingsLeadDays = settings?.lead_days;
  const defaultLeadDays = settingsLeadDays == null ? '30' : String(settingsLeadDays);
  const displayLeadDays = leadDays === '' ? defaultLeadDays : leadDays;

  const handleSaveLeadDays = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = Number.parseInt(displayLeadDays);
    if (Number.isNaN(val) || val < 0 || val > 365) {
      showToast('Valeur entre 0 et 365.');
      return;
    }
    updateSettings.mutate(
      {
        backup_enabled: settings?.backup_enabled ?? false,
        backup_frequency_h: settings?.backup_frequency_h ?? 24,
        backup_max_files: settings?.backup_max_files ?? 7,
        backup_last_at: settings?.backup_last_at ?? null,
        lead_days: val,
      },
      {
        onSuccess: () => {
          setLeadDays('');
          showToast("Délai d'anticipation mis à jour ✓");
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleCreate = (f: FormState) => {
    createScheduled.mutate(formToPayload(f, paymentMethods), {
      onSuccess: () => {
        setShowModal(false);
        showToast('Planification créée ✓');
      },
      onError: (err) => showToast(err.message),
    });
  };

  const handleUpdate = (f: FormState) => {
    if (!editTarget) return;
    updateScheduled.mutate(
      { id: editTarget.id, ...formToPayload(f, paymentMethods) },
      {
        onSuccess: () => {
          setEditTarget(null);
          showToast('Planification mise à jour ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    deleteScheduled.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        showToast('Planification supprimée');
      },
      onError: (err) => showToast(err.message),
    });
  };

  const firstAccountId = accounts.find((a) => !isInsuranceAccount(a))?.id;

  const scheduledListOrEmpty =
    scheduled.length === 0 ? (
      <p className="text-sm text-stone-400 py-2">Aucune planification.</p>
    ) : (
      scheduled.map((s) => (
        <ScheduledRow
          key={s.id}
          sched={s}
          accounts={accounts}
          onEdit={(s) => setEditTarget(s)}
          onDelete={(s) => setPendingDelete(s)}
        />
      ))
    );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-2xl tracking-tight">Planifications</h2>
        <p className="text-sm text-stone-400 mt-0.5">Récurrences automatiques</p>
      </div>

      {/* Paramètre global : délai d'anticipation */}
      <Card className="max-w-sm">
        <CardTitle>Délai d&apos;anticipation</CardTitle>
        <p className="text-xs text-stone-400 mb-3">
          Nombre de jours à l&apos;avance où les transactions planifiées sont générées.
        </p>
        <form onSubmit={handleSaveLeadDays} className="flex gap-2 items-end">
          <FormGroup label="Jours">
            <Input
              type="number"
              value={displayLeadDays}
              onChange={(e) => setLeadDays(e.target.value)}
              min="0"
              max="365"
              className="w-24"
            />
          </FormGroup>
          <Button type="submit" variant="primary" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? '…' : 'Enregistrer'}
          </Button>
        </form>
      </Card>
      <div className="flex items-center justify-end mb-4">
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          + Nouvelle
        </Button>
      </div>

      {/* Liste des planifications */}
      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-black/6 last:border-0"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          scheduledListOrEmpty
        )}
      </Card>

      {/* Modal création */}
      {showModal && (
        <ScheduledModal
          initial={emptyForm(firstAccountId)}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          title="Nouvelle planification"
          isPending={createScheduled.isPending}
          onSave={handleCreate}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* Modal édition */}
      {editTarget && (
        <ScheduledModal
          initial={schedToForm(editTarget)}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          title="Modifier la planification"
          isPending={updateScheduled.isPending}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Confirmation suppression */}
      {pendingDelete && (
        <ConfirmModal
          title="Supprimer la planification"
          body={`Supprimer "${pendingDelete.description}" ? Les transactions futures non validées seront également supprimées. Les transactions passées sont conservées.`}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
          isPending={deleteScheduled.isPending}
        />
      )}
    </div>
  );
}
