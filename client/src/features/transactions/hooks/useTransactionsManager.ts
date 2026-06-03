import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/ui';
import { TxFormState } from '@/features/transactions/components/TxModal';
import { useAccounts } from '@/hooks/useAccounts.ts';
import { useCategories } from '@/hooks/useCategories.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import {
  useDeleteTransaction,
  useDeleteTransfer,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransfer,
} from '@/hooks/useTransactions.ts';
import { type Filters, Transaction } from '@/types.ts';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; tx: Transaction }
  | { type: 'duplicate'; tx: Transaction }
  | { type: 'delete'; tx: Transaction };

const initialModalsState: ModalState = { type: 'none' };

export function useTransactionsManager(initialAccountId?: number) {
  const { t } = useTranslation('transactions');

  // --- ÉTATS DE NAVIGATION / DONNÉES ---
  const [filters, setFilters] = useState<Filters>({ account_id: initialAccountId });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // --- ÉTATS DES MODALES (Interface) ---
  const [modal, setModal] = useState<ModalState>(initialModalsState);
  const openAdd = useCallback(() => {
    setModal({ type: 'add' });
  }, []);
  const openEdit = useCallback((tx: Transaction) => {
    setModal({ type: 'edit', tx });
  }, []);
  const openDuplicate = useCallback((tx: Transaction) => {
    setModal({ type: 'duplicate', tx });
  }, []);
  const openDelete = useCallback((tx: Transaction) => {
    setModal({ type: 'delete', tx });
  }, []);
  const closeAll = useCallback(() => {
    setModal({ type: 'none' });
  }, []);

  // --- APPELS API (Hooks de données) ---
  const { data: result, isLoading, isFetching } = useTransactions({ ...filters, page, limit });
  const updateTxMutation = useUpdateTransaction();
  const updateTransferMutation = useUpdateTransfer();
  const deleteTxMutation = useDeleteTransaction();
  const deleteTransferMutation = useDeleteTransfer();

  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const activeSubcategories = useMemo(
    () => categories.find((c) => c.id === filters.category_id)?.subcategories ?? [],
    [categories, filters.category_id],
  );

  // --- ACTIONS (Logique métier) ---
  const handleFilterChange = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1); // On reset toujours la page lors d'un filtre
  };
  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleDelete = () => {
    if (modal.type !== 'delete') return;

    const isTransfer = modal.tx.transfer_peer_id !== null;
    const mutation = isTransfer ? deleteTransferMutation : deleteTxMutation;

    mutation.mutate(modal.tx.id, {
      onSuccess: () => {
        closeAll();
        showToast(isTransfer ? t('manage.deleted_transfer') : t('manage.deleted_tx'));
      },
      onError: (e) => showToast(e.message),
    });
  };

  const handleUpdate = (data: TxFormState) => {
    if (modal.type !== 'edit') return;

    if (modal.tx.transfer_peer_id === null) {
      updateTxMutation.mutate(
        {
          id: modal.tx.id,
          type: data.type,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          subcategory_id: data.isVentilated ? null : Number.parseInt(data.subcategory_id),
          splits: data.isVentilated ? data.splits : undefined,
          account_id: Number.parseInt(data.account_id),
          date: data.date,
          payment_method_id: Number.parseInt(data.payment_method_id),
          notes: data.notes || null,
          validated: data.validated,
          scheduled_id: data.scheduled_id,
        },
        {
          onSuccess: () => {
            closeAll();
            showToast(t('manage.updated_tx'));
          },
          onError: (e) => showToast(e.message),
        },
      );
    } else {
      updateTransferMutation.mutate(
        {
          id: modal.tx.id,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          date: data.date,
          validated: data.validated,
          from_account_id: Number.parseInt(data.account_id) || undefined,
          to_account_id: Number.parseInt(data.to_account_id) || undefined,
        },
        {
          onSuccess: () => {
            closeAll();
            showToast(t('manage.updated_transfer'));
          },
          onError: (e) => showToast(e.message),
        },
      );
    }
  };

  // On expose tout ce dont le composant a besoin
  return {
    state: {
      filters,
      page,
      limit,
      total: result?.total ?? 0,
      totalPages: result?.totalPages ?? 1,
      transactions: result?.data ?? [],
      balance_before_page: result?.balance_before_page ?? 0,
      categories,
      activeSubcategories,
      accounts,
      paymentMethods,
      modal,
      isLoading,
      isFetching,
      isPending:
        updateTxMutation.isPending ||
        updateTransferMutation.isPending ||
        deleteTxMutation.isPending ||
        deleteTransferMutation.isPending,
    },
    actions: {
      openAdd,
      openDuplicate,
      openEdit,
      openDelete,
      setPage,
      handleLimitChange,
      handleFilterChange,
      closeAll,
      handleDelete,
      handleUpdate,
    },
  };
}
