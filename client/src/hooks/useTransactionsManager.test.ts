import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '@/hooks/useTransactions';
import { Transaction } from '@/types.ts';

import { useTransactionsManager } from './useTransactionsManager';

// 1. Mock de tous les hooks dont dépend le manager
vi.mock('@/hooks/useTransactions');
vi.mock('@/hooks/useCategories');
vi.mock('@/hooks/useAccounts');
vi.mock('@/hooks/usePaymentMethods');
vi.mock('@/components/ui.tsx', () => ({
  showToast: vi.fn(),
}));

describe('useTransactionsManager', () => {
  // Setup des mocks avec des valeurs par défaut avant chaque test
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTransactions).mockReturnValue({
      data: { data: [], total: 0, totalPages: 1 },
      isLoading: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useTransactions>);

    vi.mocked(useCategories).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useCategories
    >);
    vi.mocked(useAccounts).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useAccounts
    >);
    vi.mocked(usePaymentMethods).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof usePaymentMethods
    >);

    vi.mocked(useUpdateTransaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTransaction>);

    vi.mocked(useDeleteTransaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTransaction>);
  });

  describe('Initialisation et Filtres', () => {
    it('devrait initialiser les filtres avec l’ID de compte fourni', () => {
      const { result } = renderHook(() => useTransactionsManager(42));
      expect(result.current.state.filters.account_id).toBe(42);
    });

    it('devrait réinitialiser la page à 1 lors du changement de filtre', () => {
      const { result } = renderHook(() => useTransactionsManager());

      act(() => {
        result.current.actions.setPage(5);
      });
      expect(result.current.state.page).toBe(5);

      act(() => {
        result.current.actions.handleFilterChange({ type: 'income' });
      });
      expect(result.current.state.filters.type).toBe('income');
      expect(result.current.state.page).toBe(1); // Reset
    });
  });

  describe('Gestion des Sous-catégories (Logic avec useMemo)', () => {
    it('devrait filtrer les sous-catégories selon la catégorie sélectionnée', () => {
      const mockCategories = [
        { id: 1, name: 'Transport', subcategories: [{ id: 10, name: 'Train' }] },
      ];
      vi.mocked(useCategories).mockReturnValue({ data: mockCategories } as ReturnType<
        typeof useCategories
      >);

      const { result } = renderHook(() => useTransactionsManager());

      act(() => {
        result.current.actions.handleFilterChange({ category_id: 1 });
      });

      expect(result.current.state.activeSubcategories).toHaveLength(1);
      expect(result.current.state.activeSubcategories[0].name).toBe('Train');
    });
  });

  describe('Gestion des Modales (Discriminated Union)', () => {
    const mockTx = { id: 99, description: 'Test Tx' } as Transaction;

    it('devrait passer de l’état none à edit avec la transaction associée', () => {
      const { result } = renderHook(() => useTransactionsManager());

      expect(result.current.state.modal.type).toBe('none');

      act(() => {
        result.current.actions.openEdit(mockTx);
      });

      expect(result.current.state.modal.type).toBe('edit');
      if (result.current.state.modal.type === 'edit') {
        expect(result.current.state.modal.tx.id).toBe(99);
      }
    });

    it('devrait tout fermer avec closeAll', () => {
      const { result } = renderHook(() => useTransactionsManager());
      act(() => {
        result.current.actions.openAdd();
      });
      act(() => {
        result.current.actions.closeAll();
      });
      expect(result.current.state.modal.type).toBe('none');
    });
  });

  describe('Actions métier (Mutations)', () => {
    it('devrait appeler la mutation de suppression avec l’ID de la modale delete', () => {
      const mockDelete = vi.fn();
      vi.mocked(useDeleteTransaction).mockReturnValue({
        mutate: mockDelete,
      } as unknown as ReturnType<typeof useDeleteTransaction>);

      const { result } = renderHook(() => useTransactionsManager());
      const tx = { id: 50, transfer_peer_id: null } as Transaction;

      // 1. Ouvrir la modale
      act(() => {
        result.current.actions.openDelete(tx);
      });
      // 2. Confirmer la suppression
      act(() => {
        result.current.actions.handleDelete();
      });

      expect(mockDelete).toHaveBeenCalledWith(50, expect.any(Object));
    });

    it('ne devrait rien faire si handleDelete est appelé sans modale delete ouverte', () => {
      const mockDelete = vi.fn();
      vi.mocked(useDeleteTransaction).mockReturnValue({
        mutate: mockDelete,
      } as unknown as ReturnType<typeof useDeleteTransaction>);

      const { result } = renderHook(() => useTransactionsManager());
      act(() => {
        result.current.actions.handleDelete();
      });

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
