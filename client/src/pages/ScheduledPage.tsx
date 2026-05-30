import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  FormGroup,
  Input,
  showToast,
  Skeleton,
} from '@/components/ui';
import { ScheduledModal } from '@/features/scheduled/components/ScheduledModal';
import { ScheduledRow } from '@/features/scheduled/components/ScheduledRow';
import { ScheduledTxModal } from '@/features/scheduled/components/ScheduledTxModal';
import {
  emptyForm,
  type FormState,
  formToPayload,
  schedToForm,
} from '@/features/scheduled/lib/form';
import {
  useCreateScheduled,
  useDeleteScheduled,
  useScheduled,
  useUpdateScheduled,
} from '@/features/transactions/hooks/useScheduled';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useLogoMap } from '@/hooks/useLogoMap';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import type { ScheduledTransaction } from '@/types';

export default function ScheduledPage() {
  const { t } = useTranslation('scheduled');
  const { t: tc } = useTranslation('common');
  const { data: scheduled = [], isLoading } = useScheduled();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const createScheduled = useCreateScheduled();
  const updateScheduled = useUpdateScheduled();
  const deleteScheduled = useDeleteScheduled();

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const logoMap = useLogoMap();

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledTransaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ScheduledTransaction | null>(null);
  const [txModalTarget, setTxModalTarget] = useState<ScheduledTransaction | null>(null);
  const [leadDays, setLeadDays] = useState<string>('');
  const [showSuspended, setShowSuspended] = useState(false);

  const settingsLeadDays = settings?.lead_days;
  const defaultLeadDays = settingsLeadDays == null ? '30' : String(settingsLeadDays);
  const displayLeadDays = leadDays === '' ? defaultLeadDays : leadDays;

  const handleSaveLeadDays = (e: SubmitEvent) => {
    e.preventDefault();
    const val = Number.parseInt(displayLeadDays);
    if (Number.isNaN(val) || val < 0 || val > 365) {
      showToast(t('lead_days.err_range'));
      return;
    }
    updateSettings.mutate(
      {
        backup_enabled: settings?.backup_enabled ?? false,
        backup_frequency_h: settings?.backup_frequency_h ?? 24,
        backup_max_files: settings?.backup_max_files ?? 7,
        lead_days: val,
      },
      {
        onSuccess: () => {
          setLeadDays('');
          showToast(t('lead_days.success'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const handleCreate = (f: FormState) => {
    createScheduled.mutate(formToPayload(f, paymentMethods), {
      onSuccess: () => {
        setShowModal(false);
        showToast(t('page.create_success'));
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
          showToast(t('page.update_success'));
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
        showToast(t('page.delete_success'));
      },
      onError: (err) => showToast(err.message),
    });
  };

  const activeScheduled = scheduled.filter((s) => s.active);
  const suspendedScheduled = scheduled.filter((s) => !s.active);
  const visibleScheduled = activeScheduled.length === 0 ? scheduled : activeScheduled;
  const hasSuspendedSection = activeScheduled.length > 0 && suspendedScheduled.length > 0;

  const scheduledListOrEmpty =
    scheduled.length === 0 ? (
      <p className="text-sm text-stone-400 py-2">{t('page.no_scheduled')}</p>
    ) : (
      <>
        {visibleScheduled.map((s) => (
          <ScheduledRow
            key={s.id}
            sched={s}
            accounts={accounts}
            onEdit={(s) => setEditTarget(s)}
            onDelete={(s) => setPendingDelete(s)}
            onViewTransactions={(s) => setTxModalTarget(s)}
          />
        ))}
        {hasSuspendedSection && (
          <>
            <button
              type="button"
              onClick={() => setShowSuspended((v) => !v)}
              className="w-full flex items-center justify-between px-1 py-2 bg-stone-50 border-t border-stone-100 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
            >
              <span>{t('page.suspended_section', { count: suspendedScheduled.length })}</span>
              <span>{showSuspended ? '▲' : '▼'}</span>
            </button>
            {showSuspended &&
              suspendedScheduled.map((s) => (
                <ScheduledRow
                  key={s.id}
                  sched={s}
                  accounts={accounts}
                  onEdit={(s) => setEditTarget(s)}
                  onDelete={(s) => setPendingDelete(s)}
                  onViewTransactions={(s) => setTxModalTarget(s)}
                />
              ))}
          </>
        )}
      </>
    );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-2xl tracking-tight">{t('page.title')}</h2>
        <p className="text-sm text-stone-400 mt-0.5">{t('page.subtitle')}</p>
      </div>

      {/* Paramètre global : délai d'anticipation */}
      <Card className="max-w-sm">
        <CardTitle>{t('lead_days.title')}</CardTitle>
        <p className="text-xs text-stone-400 mb-3">{t('lead_days.description')}</p>
        <form onSubmit={handleSaveLeadDays} className="flex gap-2 items-end">
          <FormGroup label={t('lead_days.label')}>
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
            {updateSettings.isPending ? tc('loading') : tc('save')}
          </Button>
        </form>
      </Card>
      <div className="flex items-center justify-end mb-4">
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          {t('page.new_btn')}
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
          initial={emptyForm()}
          accounts={accounts}
          logoMap={logoMap}
          categories={categories}
          paymentMethods={paymentMethods}
          title={t('modal.title_create')}
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
          title={t('modal.title_edit')}
          isPending={updateScheduled.isPending}
          onSave={handleUpdate}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Modale transactions liées */}
      {txModalTarget && (
        <ScheduledTxModal sched={txModalTarget} onClose={() => setTxModalTarget(null)} />
      )}

      {/* Confirmation suppression */}
      {pendingDelete && (
        <ConfirmModal
          title={t('page.delete_title')}
          body={t('page.delete_body', { description: pendingDelete.description })}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
          isPending={deleteScheduled.isPending}
        />
      )}
    </div>
  );
}
