import { SyntheticEvent, useState } from 'react';

import { showToast } from '@/components/ui';
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

function PaymentMethodCard({ pm }: Readonly<{ pm: PaymentMethod }>) {
  const updatePm = useUpdatePaymentMethod();
  const deletePm = useDeletePaymentMethod();
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);
  const [form, setForm] = useState({ name: pm.name, icon: pm.icon });
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
            'Supprimer le moyen de paiement',
            'Confirmer la suppression ?',
            pm.id,
            deletePm.mutate,
            'Moyen de paiement supprimé',
          )
        }
        editContent={(close) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim()) return;
              updatePm.mutate(
                { id: pm.id, name: form.name.trim(), icon: form.icon },
                {
                  onSuccess: () => {
                    close();
                    showToast('Moyen de paiement mis à jour ✓');
                  },
                  onError: (err) => showToast(err.message),
                },
              );
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
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
            <div className="flex gap-2">
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
                  setForm({ name: pm.name, icon: pm.icon });
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

export function PaymentMethodsManager() {
  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const createPaymentMethod = useCreatePaymentMethod();
  const [newPm, setNewPm] = useState({ name: '', icon: '' });

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
    <div className="flex flex-col gap-6">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        Moyens de paiement
      </p>
      <div className="p-3 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paymentMethods.map((pm) => (
          <PaymentMethodCard key={pm.id} pm={pm} />
        ))}
      </div>
    </div>
  );
}
