import { SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { showToast } from '@/components/ui.tsx';
import { SettingsManagerSkeleton } from '@/features/settings/components/SettingsManager.tsx';
import { useDeleteConfirmation } from '@/features/settings/hooks/useDeleteConfirmation.tsx';
import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from '@/hooks/usePaymentMethods.ts';
import { PaymentMethod } from '@/types.ts';

function PaymentMethodRow({
  pm,
  selectedId,
  onSelect,
}: Readonly<{
  pm: PaymentMethod;
  selectedId: number | null;
  onSelect: (id: number) => void;
}>) {
  return (
    <button
      onClick={() => onSelect(pm.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        selectedId === pm.id
          ? 'bg-white shadow-sm ring-1 ring-black/5 text-black'
          : 'text-stone-500 hover:bg-black/5'
      }`}
    >
      <span className="text-base leading-none">{pm.icon}</span>
      <span className="flex-1 text-sm font-semibold tracking-tight text-left">{pm.name}</span>
      {(pm.tx_count ?? 0) > 0 && (
        <span className="text-[10px] font-bold opacity-30 tabular-nums">{pm.tx_count} tx</span>
      )}
    </button>
  );
}

function PaymentMethodDetails({ pm }: Readonly<{ pm: PaymentMethod }>) {
  const updatePm = useUpdatePaymentMethod();
  const deletePm = useDeletePaymentMethod();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: pm.name, icon: pm.icon });

  const handleSave = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updatePm.mutate(
      { id: pm.id, name: form.name.trim(), icon: form.icon },
      {
        onSuccess: () => {
          setEditing(false);
          showToast('Moyen de paiement mis à jour ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  const txCount = pm.tx_count ?? 0;

  return (
    <div className="flex-1 min-w-0 bg-white rounded-4xl p-8 shadow-sm border border-black/5">
      <div className="max-w-2xl mx-auto">
        {editing ? (
          <form
            onSubmit={handleSave}
            className="bg-stone-50 p-6 rounded-2xl border border-black/5 animate-in fade-in zoom-in-95 flex flex-col gap-3"
          >
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
              Modifier le moyen de paiement
            </p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className="w-10 text-center text-base bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors font-medium"
                placeholder="💶"
              />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="flex-1 text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
                placeholder="Nom"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="submit"
                disabled={updatePm.isPending}
                className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30"
              >
                {updatePm.isPending ? '…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({ name: pm.name, icon: pm.icon });
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
                {pm.icon || '💳'}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 leading-none">
                  {pm.name}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    Moyen de paiement
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
              {txCount === 0 && (
                <button
                  onClick={() =>
                    requestDelete(
                      'Supprimer le moyen de paiement',
                      'Confirmer la suppression ?',
                      pm.id,
                      deletePm.mutate,
                      'Moyen de paiement supprimé',
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

export function PaymentMethodsManager() {
  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const createPaymentMethod = useCreatePaymentMethod();
  const [newPm, setNewPm] = useState({ name: '', icon: '' });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedPm = paymentMethods.find((pm) => pm.id === selectedId);

  if (pmsLoading) return <SettingsManagerSkeleton />;

  const handleAddPaymentMethod = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newPm.name.trim()) {
      showToast('Donnez un nom au moyen de paiement.');
      return;
    }
    createPaymentMethod.mutate(
      { name: newPm.name.trim(), icon: newPm.icon },
      {
        onSuccess: () => {
          setNewPm({ name: '', icon: '' });
          showToast('Moyen de paiement ajouté ✓');
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8 md:px-4">
      {/* COLONNE GAUCHE */}
      <div className="w-full md:w-[320px] md:shrink-0">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 ml-1">
          Moyens de paiement
        </p>
        <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200 mb-2">
          <p className="text-[10px] font-bold text-stone-400 uppercase mb-3 ml-1">
            Nouveau moyen de paiement
          </p>
          <form onSubmit={handleAddPaymentMethod} className="flex items-center gap-2">
            <input
              type="text"
              value={newPm.icon}
              onChange={(e) => setNewPm((f) => ({ ...f, icon: e.target.value }))}
              className="w-10 text-center text-base bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors font-medium"
              placeholder="💶"
            />
            <input
              type="text"
              value={newPm.name}
              onChange={(e) => setNewPm((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 min-w-0 text-sm bg-transparent border-b border-black/10 focus:border-black outline-none py-1.5 transition-colors placeholder:text-stone-300 font-medium"
              placeholder="Ex : Espèces"
            />
            <button
              type="submit"
              disabled={createPaymentMethod.isPending}
              className="text-[11px] font-black text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all disabled:opacity-30 shrink-0"
            >
              {createPaymentMethod.isPending ? '…' : 'Ajouter'}
            </button>
          </form>
        </div>
        <ListContent
          isLoading={pmsLoading}
          items={paymentMethods}
          empty=""
          render={(pm) => (
            <PaymentMethodRow
              key={pm.id}
              pm={pm}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        />
      </div>

      {/* COLONNE DROITE */}
      {selectedPm ? (
        <PaymentMethodDetails key={selectedPm.id} pm={selectedPm} />
      ) : (
        <div className="flex-1 h-64 flex flex-col items-center justify-center border-2 border-dashed border-black/5 rounded-4xl text-stone-300 italic animate-in fade-in duration-500">
          Sélectionnez un moyen de paiement pour gérer ses détails
        </div>
      )}
    </div>
  );
}
