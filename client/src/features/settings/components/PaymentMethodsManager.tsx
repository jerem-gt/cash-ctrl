import { SyntheticEvent, useState } from 'react';

import { ListContent } from '@/components/ListContent.tsx';
import { Button, Card, CardTitle, FormGroup, Input, showToast } from '@/components/ui.tsx';
import { RowActions } from '@/features/settings/components/RowActions.tsx';
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
  onSaved,
  onDelete,
}: Readonly<{
  pm: PaymentMethod;
  onSaved: () => void;
  onDelete: (id: number) => void;
}>) {
  const updatePm = useUpdatePaymentMethod();
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
          onSaved();
        },
        onError: (err) => showToast(err.message),
      },
    );
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="flex items-center gap-2 py-2 border-b border-black/[0.06] last:border-0"
      >
        <Input
          type="text"
          value={form.icon}
          onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          className="w-14 text-center text-lg"
          placeholder="🔸"
        />
        <Input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1 text-sm"
          autoFocus
        />
        <Button type="submit" variant="primary" size="sm" disabled={updatePm.isPending}>
          {updatePm.isPending ? '…' : 'OK'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(false);
            setForm({ name: pm.name, icon: pm.icon });
          }}
        >
          Annuler
        </Button>
      </form>
    );
  }

  const txCount = pm.tx_count ?? 0;
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-black/[0.06] last:border-0 group">
      <span className="w-5 text-center text-base leading-none">{pm.icon}</span>
      <span className="flex-1 text-sm">{pm.name}</span>
      {txCount > 0 && (
        <span className="text-[10px] text-stone-400 tabular-nums shrink-0">{txCount} tx</span>
      )}
      {txCount === 0 ? (
        <RowActions onEdit={() => setEditing(true)} onDelete={() => onDelete(pm.id)} />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          Modifier
        </button>
      )}
    </div>
  );
}

export function PaymentMethodsManager() {
  const { data: paymentMethods = [], isLoading: pmsLoading } = usePaymentMethods();
  const createPaymentMethod = useCreatePaymentMethod();
  const deletePaymentMethod = useDeletePaymentMethod();
  const [newPm, setNewPm] = useState({ name: '', icon: '' });
  const { requestDelete, DeleteConfirmModal } = useDeleteConfirmation(showToast);

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
    <Card>
      <CardTitle>Moyens de paiement</CardTitle>
      <div className="mb-4">
        <ListContent
          isLoading={pmsLoading}
          items={paymentMethods}
          empty="Aucune moyen de paiement"
          render={(pm) => (
            <PaymentMethodRow
              key={pm.id}
              pm={pm}
              onSaved={() => showToast('Moyen de paiement mis à jour ✓')}
              onDelete={(id) =>
                requestDelete(
                  'Supprimer le moyen de paiement',
                  'Confirmer la suppression ?',
                  id,
                  deletePaymentMethod.mutate,
                  'Moyen de paiement supprimé',
                )
              }
            />
          )}
        />
      </div>
      <form onSubmit={handleAddPaymentMethod} className="flex gap-2 items-end flex-wrap">
        <FormGroup label="Icône">
          <Input
            type="text"
            value={newPm.icon}
            onChange={(e) => setNewPm((f) => ({ ...f, icon: e.target.value }))}
            placeholder="💶"
            className="w-16 text-center text-lg"
          />
        </FormGroup>
        <FormGroup label="Nom">
          <Input
            type="text"
            value={newPm.name}
            onChange={(e) => setNewPm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Espèces"
            className="min-w-44"
          />
        </FormGroup>
        <Button type="submit" variant="primary" disabled={createPaymentMethod.isPending}>
          {createPaymentMethod.isPending ? '…' : 'Ajouter'}
        </Button>
      </form>
      <DeleteConfirmModal />
    </Card>
  );
}
