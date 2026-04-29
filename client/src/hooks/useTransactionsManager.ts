import { useCallback, useMemo, useState } from 'react';

import { TxFormState } from '@/components/TxModal.tsx';
import { showToast } from '@/components/ui.tsx';
import { useAccounts } from '@/hooks/useAccounts.ts';
import { useCategories } from '@/hooks/useCategories.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
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
  const updateTx = useUpdateTransaction();
  const deleteTxMutation = useDeleteTransaction();

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

    deleteTxMutation.mutate(modal.tx.id, {
      onSuccess: () => {
        closeAll();
        showToast(modal.tx.transfer_peer_id ? 'Transfert supprimé' : 'Transaction supprimée');
      },
      onError: (e) => showToast(e.message),
    });
  };

  const handleUpdate = (data: TxFormState) => {
    if (modal.type !== 'edit') return;

    // On construit le payload en utilisant txToEdit
    const payload = modal.tx.transfer_peer_id
      ? {
          id: modal.tx.id,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          date: data.date,
          type: modal.tx.type,
          account_id: modal.tx.account_id,
          subcategory_id: modal.tx.subcategory_id ?? 0,
          payment_method_id: modal.tx.payment_method_id ?? 0,
          notes: modal.tx.notes,
          validated: !!modal.tx.validated,
          from_account_id: Number.parseInt(data.account_id) || undefined,
          to_account_id: Number.parseInt(data.to_account_id) || undefined,
        }
      : {
          id: modal.tx.id,
          type: data.type,
          amount: Number.parseFloat(data.amount),
          description: data.description,
          subcategory_id: Number.parseInt(data.subcategory_id),
          account_id: Number.parseInt(data.account_id),
          date: data.date,
          payment_method_id: Number.parseInt(data.payment_method_id),
          notes: data.notes || null,
          validated: data.validated,
        };

    updateTx.mutate(payload, {
      onSuccess: () => {
        // On ferme tout en cas de succès
        closeAll();
        showToast('Transaction modifiée ✓');
      },
      onError: (e) => showToast(e.message),
    });
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
      categories,
      activeSubcategories,
      accounts,
      paymentMethods,
      modal,
      isLoading,
      isFetching,
      isPending: updateTx.isPending || deleteTxMutation.isPending,
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
