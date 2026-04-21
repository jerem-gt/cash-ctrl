import type { Transaction } from '@/types';
import { ConfirmModal } from '@/components/ui';

interface Props {
  tx: Transaction;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteTxModal({ tx, onConfirm, onCancel }: Readonly<Props>) {
  const isTransfer = tx.transfer_peer_id !== null;
  return (
    <ConfirmModal
      title={isTransfer ? 'Supprimer le transfert' : 'Supprimer la transaction'}
      body={isTransfer
        ? 'Les deux côtés du transfert seront supprimés. Cette action est irréversible.'
        : 'Cette action est irréversible. Confirmer la suppression ?'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
