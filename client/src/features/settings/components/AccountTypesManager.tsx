import { SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useAccountTypes,
  useCreateAccountType,
  useDeleteAccountType,
  useUpdateAccountType,
} from '@/hooks/useAccountTypes.ts';
import { AccountType } from '@/types.ts';

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
  const [isInvestment, setIsInvestment] = useState(!!at.is_investment);

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateAt.mutate(
      { id: at.id, name: name.trim(), is_investment: isInvestment },
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
            <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInvestment}
                onChange={(e) => setIsInvestment(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-sm text-stone-600">Compte d&apos;investissement</span>
            </label>
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
                  {!!at.is_investment && (
                    <span className="bg-indigo-50 text-indigo-500 border border-indigo-200 text-[10px] rounded px-1.5 py-0.5 font-medium">
                      Investissement
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

export function AccountTypesManager() {
  const { data: accountTypes = [], isLoading: atsLoading } = useAccountTypes();
  const createAccountType = useCreateAccountType();
  const [newAtName, setNewAtName] = useState('');
  const [newAtIsInvestment, setNewAtIsInvestment] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedAt = accountTypes.find((at) => at.id === selectedId);

  if (atsLoading) return <div>Chargement...</div>;

  const handleAddAccountType = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newAtName.trim()) {
      showToast('Donnez un nom au type.');
      return;
    }
    createAccountType.mutate(
      { name: newAtName.trim(), is_investment: newAtIsInvestment },
      {
        onSuccess: () => {
          setNewAtName('');
          setNewAtIsInvestment(false);
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
          <label className="flex items-center gap-2 mt-2 ml-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newAtIsInvestment}
              onChange={(e) => setNewAtIsInvestment(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-500"
            />
            <span className="text-[11px] text-stone-500">Compte d&apos;investissement</span>
          </label>
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
