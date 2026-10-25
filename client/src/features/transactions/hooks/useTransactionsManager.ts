import { type Filters, Transaction } from '@cashctrl/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { showToast } from '@/components/ui';
import { parseTxSearch, toTxSearch } from '@/features/transactions/lib/filtersUrl';
import type { TxFormState } from '@/features/transactions/lib/txForm';
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
import { DEFAULT_LIMIT, LIMIT_OPTIONS } from '@/lib/pagination';
import { safeStorage } from '@/lib/safeStorage';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; tx: Transaction }
  | { type: 'duplicate'; tx: Transaction }
  | { type: 'delete'; tx: Transaction };

const initialModalsState: ModalState = { type: 'none' };

export function useTransactionsManager(routeAccountId?: number) {
  const { t } = useTranslation('transactions');

  // --- ÉTATS DE NAVIGATION / DONNÉES (l'URL est la source de vérité) ---
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, page } = useMemo(() => {
    const parsed = parseTxSearch(searchParams);
    // Sur la page d'un compte, account_id vient de la route et jamais de l'URL.
    return {
      filters:
        routeAccountId === undefined
          ? parsed.filters
          : { ...parsed.filters, account_id: routeAccountId },
      page: parsed.page,
    };
  }, [searchParams, routeAccountId]);
  // Dernière écriture pas encore rendue : base des écritures successives avant re-rendu.
  const pendingRef = useRef<{ filters: Filters; page: number } | null>(null);
  useEffect(() => {
    pendingRef.current = null;
  }, [searchParams]);
  const writeUrl = useCallback(
    (next: Filters, nextPage: number) => {
      pendingRef.current = { filters: next, page: nextPage };
      const toWrite = routeAccountId === undefined ? next : { ...next, account_id: undefined };
      setSearchParams(toTxSearch(toWrite, nextPage), { replace: true });
    },
    [routeAccountId, setSearchParams],
  );
  const setPage = (p: number) => writeUrl(pendingRef.current?.filters ?? filters, p);
  const [limit, setLimit] = useState(() => {
    const stored = Number(safeStorage.getItem('cashctrl.txLimit'));
    return LIMIT_OPTIONS.includes(stored) ? stored : DEFAULT_LIMIT;
  });

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
    writeUrl({ ...(pendingRef.current?.filters ?? filters), ...patch }, 1); // On reset toujours la page lors d'un filtre
  };
  const handleLimitChange = (newLimit: number) => {
    safeStorage.setItem('cashctrl.txLimit', String(newLimit));
    setLimit(newLimit);
    setPage(1);
  };

  // Page hors limites (ex. URL périmée) : on revient à la dernière page une fois la réponse reçue.
  const responseTotalPages = result?.totalPages;
  useEffect(() => {
    if (isLoading || isFetching || responseTotalPages === undefined) return;
    const last = Math.max(1, responseTotalPages);
    if (page > last) writeUrl(filters, last);
  }, [isLoading, isFetching, responseTotalPages, page, filters, writeUrl]);

  const handleDelete = () => {
    if (modal.type !== 'delete') return;

    const isTransfer = modal.tx.transfer_peer_id !== null;
    const mutation = isTransfer ? deleteTransferMutation : deleteTxMutation;

    mutation.mutate(modal.tx.id, {
      onSuccess: () => {
        closeAll();
        showToast(isTransfer ? t('manage.deleted_transfer') : t('manage.deleted_tx'));
      },
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
