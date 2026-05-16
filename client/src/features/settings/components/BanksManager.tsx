import { ChangeEvent, SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useBanks,
  useCreateBank,
  useDeleteBank,
  useUpdateBank,
  useUploadBankLogo,
} from '@/hooks/useBanks.ts';
import { Bank } from '@/types.ts';

function BankRow({
  bank,
  selectedId,
  onSelect,
}: Readonly<{
  bank: Bank;
  selectedId: number | null;
  onSelect: (id: number) => void;
}>) {
  return (
    <button
      onClick={() => onSelect(bank.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        selectedId === bank.id
          ? 'bg-white shadow-sm ring-1 ring-black/5 text-black'
          : 'text-stone-500 hover:bg-black/5'
      }`}
    >
      {bank.logo ? (
        <img
          src={bank.logo}
          alt=""
          className="w-5 h-5 object-contain rounded shrink-0"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      ) : (
        <div className="w-5 h-5 rounded bg-stone-200 shrink-0" />
      )}
      <span className="flex-1 text-sm font-semibold tracking-tight text-left">{bank.name}</span>
      {(bank.acc_count ?? 0) > 0 && (
        <span className="text-[10px] font-bold opacity-30 tabular-nums">{bank.acc_count}</span>
      )}
    </button>
  );
}

function BankDetails({ bank }: Readonly<{ bank: Bank }>) {
  const updateBank = useUpdateBank();
  const uploadLogo = useUploadBankLogo();
  const deleteBank = useDeleteBank();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bank.name);
  const [domain, setDomain] = useState(bank.domain ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  };

  const handleSave = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (file) await uploadLogo.mutateAsync({ id: bank.id, file });
      await updateBank.mutateAsync({
        id: bank.id,
        name: name.trim(),
        domain: domain.trim() || null,
      });
      setEditing(false);
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      showToast('Banque mise à jour ✓');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setName(bank.name);
    setDomain(bank.domain ?? '');
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const logoSrc = preview ?? bank.logo ?? null;
  const accCount = bank.acc_count ?? 0;

  return (
    <div className="flex-1 min-w-0 bg-white rounded-4xl p-8 shadow-sm border border-black/5">
      <div className="max-w-2xl mx-auto">
        {editing ? (
          <form
            onSubmit={handleSave}
            className="bg-stone-50 p-6 rounded-2xl border border-black/5 animate-in fade-in zoom-in-95 flex flex-col gap-3"
          >
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
              Modifier la banque
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium w-full"
              placeholder="Nom"
              autoFocus
            />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium w-full"
              placeholder="Domaine (ex : boursobank.com)"
            />
            <div className="flex items-center gap-2">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt=""
                  className="w-6 h-6 object-contain rounded shrink-0"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <label className="cursor-pointer">
                <span className="text-xs text-stone-400">
                  {file ? file.name : 'Choisir un logo…'}
                </span>
                <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              </label>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="submit"
                disabled={updateBank.isPending || uploadLogo.isPending}
                className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
              >
                {updateBank.isPending || uploadLogo.isPending ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-[11px] font-black text-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <header className="flex justify-between items-center pb-8 border-b border-black/3">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-stone-50 flex items-center justify-center shadow-inner ring-1 ring-black/5 overflow-hidden">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt=""
                    className="w-10 h-10 object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <span className="text-2xl">🏦</span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 leading-none">
                  {bank.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    {bank.domain ?? 'Aucun domaine'}
                  </span>
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
                      'Supprimer la banque',
                      'Les comptes existants garderont leur banque actuelle. Confirmer ?',
                      bank.id,
                      deleteBank.mutate,
                      'Banque supprimée',
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

export function BanksManager() {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const createBank = useCreateBank();
  const [newBank, setNewBank] = useState({ name: '', domain: '' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedBank = banks.find((b) => b.id === selectedId);

  if (banksLoading) return <SettingsManagerSkeleton />;

  const handleAddBank = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newBank.name.trim()) {
      showToast('Donnez un nom à la banque.');
      return;
    }
    createBank.mutate(
      { name: newBank.name.trim(), domain: newBank.domain.trim() || null },
      {
        onSuccess: () => {
          setNewBank({ name: '', domain: '' });
          showToast('Banque ajoutée ✓');
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
          Banques
        </p>
        <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200 mb-2">
          <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">
            Nouvelle banque
          </p>
          <form onSubmit={handleAddBank} className="flex flex-col gap-2">
            <input
              type="text"
              value={newBank.name}
              onChange={(e) => setNewBank((f) => ({ ...f, name: e.target.value }))}
              className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
              placeholder="Nom (ex : Fortuneo)"
            />
            <input
              type="text"
              value={newBank.domain}
              onChange={(e) => setNewBank((f) => ({ ...f, domain: e.target.value }))}
              className="text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
              placeholder="Domaine (ex : fortuneo.fr)"
            />
            <div className="flex justify-end mt-1">
              <button
                type="submit"
                disabled={createBank.isPending}
                className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
              >
                {createBank.isPending ? '…' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
        <ListContent
          isLoading={banksLoading}
          items={banks}
          empty=""
          render={(bank) => (
            <BankRow key={bank.id} bank={bank} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        />
      </div>

      {/* COLONNE DROITE */}
      {selectedBank ? (
        <BankDetails key={selectedBank.id} bank={selectedBank} />
      ) : (
        <div className="flex-1 h-64 flex flex-col items-center justify-center border-2 border-dashed border-black/5 rounded-4xl text-stone-300 italic animate-in fade-in duration-500">
          Sélectionnez une banque pour gérer ses détails
        </div>
      )}
    </div>
  );
}
