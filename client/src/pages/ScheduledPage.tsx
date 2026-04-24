import { useState, useMemo, type SyntheticEvent } from 'react';
import { useScheduled, useCreateScheduled, useUpdateScheduled, useDeleteScheduled } from '@/hooks/useScheduled';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useBanks } from '@/hooks/useBanks';
import { Card, CardTitle, Button, Input, Select, FormGroup, ConfirmModal, showToast } from '@/components/ui';
import { TxCoreFields, type TxCoreState } from '@/components/TxCoreFields';
import { fmtDec, today } from '@/lib/format';
import type { ScheduledTransaction, RecurrenceUnit, WeekendHandling } from '@/types';
import type { ScheduledPayload } from '@/api/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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
  const month = s.recurrence_month ? ` ${MONTH_NAMES[(s.recurrence_month - 1)]}` : '';
  const when = day || month ? ` le ${day}${month}` : '';
  return n === 1 ? `Chaque année${when}` : `Tous les ${n} ans${when}`;
}

const WEEKEND_LABELS: Record<WeekendHandling, string> = {
  allow: 'Week-ends autorisés',
  before: 'Décaler au vendredi',
  after: 'Décaler au lundi',
};

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  account_id: string;
  to_account_id: string;
  type: 'income' | 'expense';
  amount: string;
  description: string;
  category_id: string;
  payment_method_id: string;
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

function emptyForm(firstAccountId?: number, firstCategoryId?: number): FormState {
  return {
    account_id: firstAccountId ? String(firstAccountId) : '',
    to_account_id: '',
    type: 'expense',
    amount: '',
    description: '',
    category_id: firstCategoryId ? String(firstCategoryId) : '',
    payment_method_id: '',
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
  return {
    account_id: String(s.account_id),
    to_account_id: s.to_account_id == null ? '' : String(s.to_account_id),
    type: s.type,
    amount: String(s.amount),
    description: s.description,
    category_id: String(s.category_id ?? ''),
    payment_method_id: String(s.payment_method_id ?? ''),
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

function formToPayload(f: FormState, paymentMethods: { id: number; name: string }[]): ScheduledPayload {
  const unit = f.recurrence_unit;
  const selectedPm = paymentMethods.find(m => String(m.id) === f.payment_method_id);
  const isTransfer = selectedPm?.name === 'Transfert';
  return {
    account_id: Number.parseInt(f.account_id),
    to_account_id: isTransfer && f.to_account_id ? Number.parseInt(f.to_account_id) : null,
    type: 'expense',
    amount: Number.parseFloat(f.amount),
    description: f.description.trim(),
    category_id: Number.parseInt(f.category_id),
    payment_method_id: Number.parseInt(f.payment_method_id),
    notes: f.notes.trim() || null,
    recurrence_unit: unit,
    recurrence_interval: Number.parseInt(f.recurrence_interval) || 1,
    recurrence_day: (unit === 'month' || unit === 'year') ? (Number.parseInt(f.recurrence_day) || 1) : null,
    recurrence_month: unit === 'year' ? (Number.parseInt(f.recurrence_month) || 1) : null,
    weekend_handling: f.weekend_handling,
    start_date: f.start_date,
    end_date: f.end_date || null,
    active: f.active,
  };
}

// ─── Modal formulaire ─────────────────────────────────────────────────────────

interface ModalProps {
  initial: FormState;
  accounts: ReturnType<typeof useAccounts>['data'];
  logoMap: Record<string, string | null>;
  categories: { id: number; name: string }[];
  paymentMethods: { id: number; name: string; icon: string }[];
  title: string;
  isPending: boolean;
  onSave: (f: FormState) => void;
  onCancel: () => void;
}

function ScheduledModal({ initial, accounts = [], logoMap, categories, paymentMethods, title, isPending, onSave, onCancel }: Readonly<ModalProps>) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const selectedPm = paymentMethods.find(m => String(m.id) === form.payment_method_id);
  const isTransfer = selectedPm?.name === 'Transfert';

  const coreValue: TxCoreState = {
    type: form.type,
    amount: form.amount,
    description: form.description,
    category_id: form.category_id,
    account_id: form.account_id,
    to_account_id: form.to_account_id,
    payment_method_id: form.payment_method_id,
  };

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.account_id || !form.amount || !form.description || !form.payment_method_id || !form.start_date) {
      showToast('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (isTransfer && !form.to_account_id) {
      showToast('Veuillez choisir un compte destination.');
      return;
    }
    if (Number.parseFloat(form.amount) <= 0) {
      showToast('Le montant doit être positif.');
      return;
    }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/35 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-7 w-full max-w-2xl shadow-xl my-4">
        <h3 className="font-serif text-xl mb-5">{title}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Champs communs : type, montant, description, catégorie, comptes, moyen de paiement */}
          <TxCoreFields
            value={coreValue}
            onChange={patch => setForm(f => ({ ...f, ...patch }))}
            accounts={accounts}
            logoMap={logoMap}
            categories={categories}
            paymentMethods={paymentMethods}
          />

          {/* Ligne 3 : récurrence */}
          <div className="border border-black/[0.07] rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Récurrence</p>
            <div className="flex gap-3 flex-wrap">
              <FormGroup label="Tous les…">
                <Input
                  type="number"
                  value={form.recurrence_interval}
                  onChange={e => set('recurrence_interval', e.target.value)}
                  min="1"
                  className="w-20"
                />
              </FormGroup>
              <FormGroup label="Unité">
                <Select value={form.recurrence_unit} onChange={e => set('recurrence_unit', e.target.value as RecurrenceUnit)}>
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
                    onChange={e => set('recurrence_day', e.target.value)}
                    min="1"
                    max="31"
                    className="w-20"
                  />
                </FormGroup>
              )}
              {form.recurrence_unit === 'year' && (
                <FormGroup label="Mois">
                  <Select value={form.recurrence_month} onChange={e => set('recurrence_month', e.target.value)}>
                    {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                  </Select>
                </FormGroup>
              )}
            </div>

            {/* Week-end */}
            <div className="flex gap-4 flex-wrap">
              {(['allow', 'before', 'after'] as WeekendHandling[]).map(v => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm text-stone-700 select-none">
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

          {/* Ligne 4 : dates + actif */}
          <div className="flex gap-3 flex-wrap items-end">
            <FormGroup label="Date de début">
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </FormGroup>
            <FormGroup label="Date de fin (optionnel)">
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </FormGroup>
            <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => set('active', e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="text-sm text-stone-700">Actif</span>
            </label>
          </div>

          {/* Notes */}
          <FormGroup label="Notes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Informations complémentaires…"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-black/13 rounded-lg outline-none focus:border-green-500 transition-all resize-none"
            />
          </FormGroup>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" onClick={onCancel}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending}>{isPending ? '…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </div>
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
  const isTransfer = sched.payment_method === 'Transfert';
  const toAccount = isTransfer ? accounts.find(a => a.id === sched.to_account_id) : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/[0.06] last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{sched.description}</p>
          {isTransfer && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium shrink-0">↔ Transfert</span>
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
          {sched.end_date ? ` · jusqu'au ${sched.end_date}` : ''}
        </p>
      </div>
      <span className={`text-sm font-medium tabular-nums shrink-0 ${isTransfer ? 'text-stone-500' : sched.type === 'income' ? 'text-green-800' : 'text-red-700'}`}>
        {isTransfer ? '' : sched.type === 'income' ? '+' : '−'}{fmtDec(sched.amount)}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => onEdit(sched)} className="text-xs text-stone-400 hover:text-stone-700 transition-colors px-1">Modifier</button>
        <button onClick={() => onDelete(sched)} className="text-xs text-stone-300 hover:text-red-400 transition-colors px-1">×</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ScheduledPage() {
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

  const logoMap = useMemo(() => Object.fromEntries(banks.map(b => [b.name, b.logo])), [banks]);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTransaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTransaction | null>(null);
  const [leadDays, setLeadDays] = useState<string>('');

  // Sync local leadDays input when settings load
  const settingsLeadDays = settings?.lead_days;
  const displayLeadDays = leadDays === '' ? (settingsLeadDays == null ? '30' : String(settingsLeadDays)) : leadDays;

  const handleSaveLeadDays = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const val = Number.parseInt(displayLeadDays);
    if (Number.isNaN(val) || val < 0 || val > 365) { showToast('Valeur entre 0 et 365.'); return; }
    updateSettings.mutate({ lead_days: val }, {
      onSuccess: () => { setLeadDays(''); showToast('Délai d\'anticipation mis à jour ✓'); },
      onError: err => showToast(err.message),
    });
  };

  const handleCreate = (f: FormState) => {
    createScheduled.mutate(formToPayload(f, paymentMethods), {
      onSuccess: () => { setShowModal(false); showToast('Planification créée ✓'); },
      onError: err => showToast(err.message),
    });
  };

  const handleUpdate = (f: FormState) => {
    if (!editTarget) return;
    updateScheduled.mutate({ id: editTarget.id, ...formToPayload(f, paymentMethods) }, {
      onSuccess: () => { setEditTarget(null); showToast('Planification mise à jour ✓'); },
      onError: err => showToast(err.message),
    });
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    deleteScheduled.mutate(pendingDelete.id, {
      onSuccess: () => { setPendingDelete(null); showToast('Planification supprimée'); },
      onError: err => showToast(err.message),
    });
  };

  const firstAccountId = accounts[0]?.id;
  const firstCategoryId = categories[0]?.id;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Transactions planifiées</h2>
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
              onChange={e => setLeadDays(e.target.value)}
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

      {/* Liste des planifications */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Planifications</p>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>+ Nouvelle</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-stone-400 py-2">Chargement…</p>
        ) : scheduled.length === 0 ? (
          <p className="text-sm text-stone-400 py-2">Aucune planification.</p>
        ) : (
          scheduled.map(s => (
            <ScheduledRow
              key={s.id}
              sched={s}
              accounts={accounts}
              onEdit={s => setEditTarget(s)}
              onDelete={s => setPendingDelete(s)}
            />
          ))
        )}
      </Card>

      {/* Modal création */}
      {showModal && (
        <ScheduledModal
          initial={emptyForm(firstAccountId, firstCategoryId)}
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
