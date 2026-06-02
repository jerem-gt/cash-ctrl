import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, showToast } from '@/components/ui';
import { AddCard } from '@/features/settings/components/AddCard.tsx';
import { SettingsCard } from '@/features/settings/components/SettingsCard.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from '@/hooks/usePaymentMethods.ts';
import { PaymentMethod } from '@/types.ts';

function PaymentMethodEditForm({
  pm,
  onClose,
}: Readonly<{ pm: PaymentMethod; onClose: () => void }>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const updatePm = useUpdatePaymentMethod();
  const [form, setForm] = useState({ name: pm.name, icon: pm.icon });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        updatePm.mutate(
          { id: pm.id, name: form.name.trim(), icon: form.icon },
          {
            onSuccess: () => {
              onClose();
              showToast(t('payment_methods.success_edit'));
            },
            onError: (err) => showToast(err.message),
          },
        );
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('payment_methods.edit_title')}
      </p>
      <div className="flex items-center gap-3">
        <div className="w-11 shrink-0">
          <Input
            type="text"
            value={form.icon}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            className="px-1 text-center text-lg leading-none"
            placeholder="💶"
          />
        </div>
        <Input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1"
          placeholder={t('payment_methods.name_placeholder')}
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={updatePm.isPending}>
          {updatePm.isPending ? tc('loading') : tc('save')}
        </Button>
        <Button type="button" variant="default" size="sm" onClick={onClose}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}

function PaymentMethodCard({ pm }: Readonly<{ pm: PaymentMethod }>) {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const deletePm = useDeletePaymentMethod();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);
  const txCount = pm.tx_count ?? 0;

  return (
    <>
      <SettingsCard
        title={pm.name}
        icon={pm.icon || '💳'}
        subtitle={
          txCount > 0 ? <p className="text-[10px] text-stone-400">{txCount} tx</p> : undefined
        }
        canDelete={txCount === 0}
        onDelete={() =>
          requestDelete(
            t('payment_methods.delete_title'),
            t('payment_methods.delete_body'),
            pm.id,
            deletePm.mutate,
            t('payment_methods.deleted'),
          )
        }
        isEditing={editing}
        onEditStart={() => setEditing(true)}
        editContent={<PaymentMethodEditForm pm={pm} onClose={() => setEditing(false)} />}
      />
      {deleteConfirmModal}
    </>
  );
}

export function PaymentMethodsManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const createPaymentMethod = useCreatePaymentMethod();
  const [newPm, setNewPm] = useState({ name: '', icon: '' });

  if (pmsLoading) return <SettingsManagerSkeleton />;

  const handleAddPaymentMethod = (e: SubmitEvent) => {
    e.preventDefault();
    if (!newPm.name.trim()) {
      showToast(t('payment_methods.err_no_name'));
      return;
    }
    createPaymentMethod.mutate(
      { name: newPm.name.trim(), icon: newPm.icon },
      {
        onSuccess: () => {
          setNewPm({ name: '', icon: '' });
          showToast(t('payment_methods.success_add'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('payment_methods.title')}
      </p>
      <AddCard title={t('payment_methods.new_title')}>
        <form onSubmit={handleAddPaymentMethod} className="flex items-center gap-2">
          <div className="w-11 shrink-0">
            <Input
              type="text"
              value={newPm.icon}
              onChange={(e) => setNewPm((f) => ({ ...f, icon: e.target.value }))}
              className="px-1 text-center text-lg leading-none"
              placeholder="💶"
            />
          </div>
          <Input
            type="text"
            value={newPm.name}
            onChange={(e) => setNewPm((f) => ({ ...f, name: e.target.value }))}
            className="flex-1 min-w-0"
            placeholder={t('payment_methods.name_placeholder')}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createPaymentMethod.isPending}
            className="shrink-0"
          >
            {createPaymentMethod.isPending ? tc('loading') : tc('add')}
          </Button>
        </form>
      </AddCard>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paymentMethods.map((pm) => (
          <PaymentMethodCard key={pm.id} pm={pm} />
        ))}
      </div>
    </div>
  );
}
