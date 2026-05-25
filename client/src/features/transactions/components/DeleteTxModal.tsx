import { useTranslation } from 'react-i18next';

import { ConfirmModal } from '@/components/ui';
import type { Transaction } from '@/types';

interface Props {
  tx: Transaction;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function DeleteTxModal({ tx, onConfirm, onCancel, isPending }: Readonly<Props>) {
  const { t } = useTranslation('transactions');
  const isTransfer = tx.transfer_peer_id !== null;
  return (
    <ConfirmModal
      title={isTransfer ? t('delete_modal.title_transfer') : t('delete_modal.title_tx')}
      body={isTransfer ? t('delete_modal.body_transfer') : t('delete_modal.body_tx')}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isPending={isPending}
    />
  );
}
