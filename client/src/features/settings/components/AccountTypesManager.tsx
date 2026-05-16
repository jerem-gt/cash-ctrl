import { SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast, Skeleton } from '@/components/ui.tsx';
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

function AccountTypeRow({
  at,
  selectedId,
  onSelect,
}: Readonly<{
  at: AccountType;
  selectedId: number | null;
  onSelect: (id: number) => void;
}>) {
  return (
    <button
      onClick={() => onSelect(at.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        selectedId === at.id
          ? 'bg-white shadow-sm ring-1 ring-black/5 text-black'
          : 'text-stone-500 hover:bg-black/5'
      }`}
    >
      <span className="flex-1 text-sm font-semibold tracking-tight text-left">{at.name}</span>
      {(at.acc_count ?? 0) > 0 && (
        <span className="text-[10px] font-bold opacity-30 tabular-nums">{at.acc_count}</span>
      )}
    </button>
  );
}

function AccountTypeDetails({ at }: Readonly<{ at: AccountType }>) {
  const updateAt = useUpdateAccountType();
  const deleteAt = useDeleteAccountType();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(at.name);
  const [envelopeType, setEnvelopeType] = useState(at.envelope_type ?? '');

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateAt.mutate(
      { id: at.id, name: name.trim(), envelope_type: envelopeType || null },
      {
        onSuccess: () => {
          setEditing(false);
          showToast('Type mis à jour ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const accCount = at.acc_count ?? 0;

  return (
    <div className="flex-1 min-w-0 bg-white rounded-4xl p-8 shadow-sm border border-black/5">
      <div className="max-w-2xl mx-auto">
        {editing ? (
          <form
            onSubmit={handleSave}
            className="bg-stone-50 p-6 rounded-2xl border border-black/5 animate-in fade-in zoom-in-95 flex flex-col gap-3"
          >
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
              Modifier le type de compte
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
              <label htmlFor="edit-at-envelope" className="text-[11px] text-stone-500 block mb-1">
                Enveloppe
              </label>
              <select
                id="edit-at-envelope"
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
            <div className="flex gap-2 mt-1">
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
                  setEditing(false);
                  setName(at.name);
                  setEnvelopeType(at.envelope_type ?? '');
                }}
                className="text-[11px] font-black text-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <header className="flex justify-between items-center pb-8 border-b border-black/3">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center text-3xl shadow-inner ring-1 ring-black/5">
                🗂️
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 leading-none">
                  {at.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Type de compte
                  </span>
                  {at.envelope_type && (
                    <span
                      className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${ENVELOPE_BADGE_CLASSES[at.envelope_type] ?? 'bg-stone-50 text-stone-500 border border-stone-200'}`}
                    >
                      {ENVELOPE_LABELS[at.envelope_type] ?? at.envelope_type}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-[11px] font-bold text-stone-500 hover:text-black bg-stone-50 hover:bg-stone-100 rounded-xl transition-all"
              >
                Modifier
              </button>
              {accCount === 0 && (
                <button
                  onClick={() =>
                    requestDelete(
                      'Supprimer le type de compte',
                      'Les comptes existants garderont leur type actuel. Confirmer ?',
                      at.id,
                      deleteAt.mutate,
                      'Type supprimé',
                    )
                  }
                  className="px-4 py-2 text-[11px] font-bold text-red-400 hover:bg-red-50 rounded-xl transition-all"
                >
                  Supprimer
                </button>
              )}
            </div>
          </header>
        )}
      </div>
      <DeleteConfirmModal />
    </div>
  );
}

function SettingsManagerSkeleton() {
  return (
    <div className="flex items-start gap-8 mx-auto px-4">
      <div className="w-[320px] shrink-0 space-y-4">
        <Skeleton className="h-3 w-24" />
        <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8" />
        </div>
        <div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0"
            >
              <Skeleton className="w-5 h-5 shrink-0" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}

export function AccountTypesManager() {
  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const [newAtName, setNewAtName] = useState('');
  const [newAtEnvelopeType, setNewAtEnvelopeType] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedAt = accountTypes.find((at) => at.id === selectedId);

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
    <div className="flex items-start gap-8 mx-auto px-4">
      {/* COLONNE GAUCHE */}
      <div className="w-[320px] shrink-0">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 ml-1">
          Types de compte
        </p>
        <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200 mb-2">
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
        <ListContent
          isLoading={atsLoading}
          items={accountTypes}
          empty=""
          render={(at) => (
            <AccountTypeRow key={at.id} at={at} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        />
      </div>

      {/* COLONNE DROITE */}
      {selectedAt ? (
        <AccountTypeDetails key={selectedAt.id} at={selectedAt} />
      ) : (
        <div className="flex-1 h-64 flex flex-col items-center justify-center border-2 border-dashed border-black/5 rounded-4xl text-stone-300 italic animate-in fade-in duration-500">
          Sélectionnez un type de compte pour gérer ses détails
        </div>
      )}
    </div>
  );
}
