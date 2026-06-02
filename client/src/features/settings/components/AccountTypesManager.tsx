import { type SubmitEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Select, showToast } from '@/components/ui';
import { AddCard } from '@/features/settings/components/AddCard.tsx';
import { SettingsCard } from '@/features/settings/components/SettingsCard.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useAccountTypes,
  useCreateAccountType,
  useDeleteAccountType,
  useUpdateAccountType,
} from '@/hooks/useAccountTypes.ts';
import { AccountType } from '@/types.ts';

const ENVELOPE_BADGE_CLASSES: Record<string, string> = {
  investment: 'bg-indigo-50 text-indigo-500 border border-indigo-200',
  loan: 'bg-amber-50 text-amber-700 border border-amber-200',
  life_insurance: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  per: 'bg-blue-50 text-blue-700 border border-blue-200',
};

function AccountTypeEditForm({ at, onClose }: Readonly<{ at: AccountType; onClose: () => void }>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const updateAt = useUpdateAccountType();
  const [name, setName] = useState(at.name);
  const [envelopeType, setEnvelopeType] = useState(at.envelope_type ?? '');

  const envelopeOptions = [
    { value: '', label: t('account_types.none_envelope') },
    { value: 'savings', label: t('account_types.savings') },
    { value: 'investment', label: t('account_types.investment') },
    { value: 'loan', label: t('account_types.loan') },
    { value: 'life_insurance', label: t('account_types.life_insurance') },
    { value: 'per', label: t('account_types.per') },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        updateAt.mutate(
          { id: at.id, name: name.trim(), envelope_type: envelopeType || null },
          {
            onSuccess: () => {
              onClose();
              showToast(t('account_types.success_edit'));
            },
            onError: (err) => showToast(err.message),
          },
        );
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('account_types.edit_title')}
      </p>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('account_types.name_placeholder')}
        autoFocus
      />
      <div>
        <label
          htmlFor={`edit-at-envelope-${at.id}`}
          className="text-[11px] text-stone-500 block mb-1"
        >
          {t('account_types.envelope_label')}
        </label>
        <Select
          id={`edit-at-envelope-${at.id}`}
          value={envelopeType}
          onChange={(e) => setEnvelopeType(e.target.value)}
        >
          {envelopeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={updateAt.isPending}>
          {updateAt.isPending ? tc('loading') : tc('save')}
        </Button>
        <Button type="button" variant="default" size="sm" onClick={onClose}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}

function AccountTypeCard({ at }: Readonly<{ at: AccountType }>) {
  const { t } = useTranslation('settings');
  const [editing, setEditing] = useState(false);
  const deleteAt = useDeleteAccountType();
  const { requestDelete, deleteConfirmModal } = useDeleteConfirmation(showToast);
  const accCount = at.acc_count ?? 0;

  const envelopeLabels: Record<string, string> = {
    investment: t('account_types.investment'),
    loan: t('account_types.loan'),
    life_insurance: t('account_types.life_insurance'),
    per: t('account_types.per'),
  };

  return (
    <>
      <SettingsCard
        title={at.name}
        icon="🗂️"
        subtitle={
          at.envelope_type ? (
            <span
              className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${ENVELOPE_BADGE_CLASSES[at.envelope_type] ?? 'bg-stone-50 text-stone-500 border border-stone-200'}`}
            >
              {envelopeLabels[at.envelope_type] ?? at.envelope_type}
            </span>
          ) : (
            <span className="text-[10px] text-stone-300">—</span>
          )
        }
        badge={
          accCount > 0 ? (
            <span className="text-[10px] font-bold text-stone-300 tabular-nums shrink-0">
              {accCount}
            </span>
          ) : undefined
        }
        canDelete={accCount === 0}
        onDelete={() =>
          requestDelete(
            t('account_types.delete_title'),
            t('account_types.delete_body'),
            at.id,
            deleteAt.mutate,
            t('account_types.deleted'),
          )
        }
        isEditing={editing}
        onEditStart={() => setEditing(true)}
        editContent={<AccountTypeEditForm at={at} onClose={() => setEditing(false)} />}
      />
      {deleteConfirmModal}
    </>
  );
}

export function AccountTypesManager() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const [newAtName, setNewAtName] = useState('');
  const [newAtEnvelopeType, setNewAtEnvelopeType] = useState('');

  if (atsLoading) return <SettingsManagerSkeleton />;

  const envelopeOptions = [
    { value: '', label: t('account_types.none_envelope') },
    { value: 'savings', label: t('account_types.savings') },
    { value: 'investment', label: t('account_types.investment') },
    { value: 'loan', label: t('account_types.loan') },
    { value: 'life_insurance', label: t('account_types.life_insurance') },
    { value: 'per', label: t('account_types.per') },
  ];

  const handleAddAccountType = (e: SubmitEvent) => {
    e.preventDefault();
    if (!newAtName.trim()) {
      showToast(t('account_types.err_no_name'));
      return;
    }
    createAccountType.mutate(
      { name: newAtName.trim(), envelope_type: newAtEnvelopeType || null },
      {
        onSuccess: () => {
          setNewAtName('');
          setNewAtEnvelopeType('');
          showToast(t('account_types.success_add'));
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {t('account_types.title')}
      </p>
      <AddCard title={t('account_types.new_title')}>
        <form onSubmit={handleAddAccountType} className="flex items-center gap-2">
          <Input
            type="text"
            value={newAtName}
            onChange={(e) => setNewAtName(e.target.value)}
            className="flex-1 min-w-0"
            placeholder={t('account_types.name_placeholder')}
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={createAccountType.isPending}
            className="shrink-0"
          >
            {createAccountType.isPending ? tc('loading') : tc('add')}
          </Button>
        </form>
        <div className="mt-2">
          <label htmlFor="new-at-envelope" className="text-[11px] text-stone-500 block mb-1">
            {t('account_types.envelope_label')}
          </label>
          <div className="max-w-56">
            <Select
              id="new-at-envelope"
              value={newAtEnvelopeType}
              onChange={(e) => setNewAtEnvelopeType(e.target.value)}
            >
              {envelopeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </AddCard>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {accountTypes.map((at) => (
          <AccountTypeCard key={at.id} at={at} />
        ))}
      </div>
    </div>
  );
}
