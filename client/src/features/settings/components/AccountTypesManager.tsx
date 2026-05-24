import { SyntheticEvent, useState } from 'react';

import { showToast } from '@/components/ui';
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

const ENVELOPE_LABELS: Record<string, string> = {
  investment: 'Investissement',
  loan: 'Prêt',
  life_insurance: 'Assurance Vie',
  per: 'PER',
};

const ENVELOPE_BADGE_CLASSES: Record<string, string> = {
  investment: 'bg-indigo-50 text-indigo-500 border border-indigo-200',
  loan: 'bg-amber-50 text-amber-700 border border-amber-200',
  life_insurance: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  per: 'bg-blue-50 text-blue-700 border border-blue-200',
};

const ENVELOPE_OPTIONS = [
  { value: '', label: 'Aucune' },
  { value: 'investment', label: 'Investissement' },
  { value: 'loan', label: 'Prêt' },
  { value: 'life_insurance', label: 'Assurance Vie' },
  { value: 'per', label: 'PER' },
];

function AccountTypeCard({ at }: Readonly<{ at: AccountType }>) {
  const updateAt = useUpdateAccountType();
  const deleteAt = useDeleteAccountType();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);
  const [name, setName] = useState(at.name);
  const [envelopeType, setEnvelopeType] = useState(at.envelope_type ?? '');
  const accCount = at.acc_count ?? 0;

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
              {ENVELOPE_LABELS[at.envelope_type] ?? at.envelope_type}
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
            'Supprimer le type de compte',
            'Les comptes existants garderont leur type actuel. Confirmer ?',
            at.id,
            deleteAt.mutate,
            'Type supprimé',
          )
        }
        editContent={(close) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              updateAt.mutate(
                { id: at.id, name: name.trim(), envelope_type: envelopeType || null },
                {
                  onSuccess: () => {
                    close();
                    showToast('Type mis à jour ✓');
                  },
                  onError: (err) => showToast(err.message),
                },
              );
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
              Modifier le type
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
              placeholder="Nom"
              autoFocus
            />
            <div>
              <label
                htmlFor={`edit-at-envelope-${at.id}`}
                className="text-[11px] text-stone-500 block mb-1"
              >
                Enveloppe
              </label>
              <select
                id={`edit-at-envelope-${at.id}`}
                value={envelopeType}
                onChange={(e) => setEnvelopeType(e.target.value)}
                className="text-sm border border-black/10 rounded-lg px-2 py-1.5 bg-white w-full focus:outline-none"
              >
                {ENVELOPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateAt.isPending}
                className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
              >
                {updateAt.isPending ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(at.name);
                  setEnvelopeType(at.envelope_type ?? '');
                  close();
                }}
                className="text-[11px] font-black text-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      />
      <DeleteConfirmModal />
    </>
  );
}

export function AccountTypesManager() {
  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const [newAtName, setNewAtName] = useState('');
  const [newAtEnvelopeType, setNewAtEnvelopeType] = useState('');

  if (atsLoading) return <SettingsManagerSkeleton />;

  const handleAddAccountType = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newAtName.trim()) {
      showToast('Donnez un nom au type.');
      return;
    }
    createAccountType.mutate(
      { name: newAtName.trim(), envelope_type: newAtEnvelopeType || null },
      {
        onSuccess: () => {
          setNewAtName('');
          setNewAtEnvelopeType('');
          showToast('Type ajouté ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        Types de compte
      </p>
      <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
        <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">Nouveau type</p>
        <form onSubmit={handleAddAccountType} className="flex items-center gap-2">
          <input
            type="text"
            value={newAtName}
            onChange={(e) => setNewAtName(e.target.value)}
            className="flex-1 min-w-0 text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
            placeholder="Ex : PEA"
          />
          <button
            type="submit"
            disabled={createAccountType.isPending}
            className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30 shrink-0"
          >
            {createAccountType.isPending ? '…' : 'Ajouter'}
          </button>
        </form>
        <div className="mt-2 ml-1">
          <label htmlFor="new-at-envelope" className="text-[11px] text-stone-500 block mb-1">
            Enveloppe
          </label>
          <select
            id="new-at-envelope"
            value={newAtEnvelopeType}
            onChange={(e) => setNewAtEnvelopeType(e.target.value)}
            className="text-xs border border-black/10 rounded-lg px-2 py-1 bg-white focus:outline-none"
          >
            {ENVELOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accountTypes.map((at) => (
          <AccountTypeCard key={at.id} at={at} />
        ))}
      </div>
    </div>
  );
}
