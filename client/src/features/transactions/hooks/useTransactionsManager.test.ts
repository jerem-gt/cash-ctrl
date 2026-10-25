import { Transaction } from '@cashctrl/types';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadI18nForTests } from '@/tests/helpers/i18nTestUtils';

let useAccounts: typeof import('@/hooks/useAccounts').useAccounts;
let useCategories: typeof import('@/hooks/useCategories').useCategories;
let usePaymentMethods: typeof import('@/hooks/usePaymentMethods').usePaymentMethods;
let useTransactions: typeof import('@/hooks/useTransactions').useTransactions;
let useUpdateTransaction: typeof import('@/hooks/useTransactions').useUpdateTransaction;
let useUpdateTransfer: typeof import('@/hooks/useTransactions').useUpdateTransfer;
let useDeleteTransaction: typeof import('@/hooks/useTransactions').useDeleteTransaction;
let useDeleteTransfer: typeof import('@/hooks/useTransactions').useDeleteTransfer;
let useTransactionsManager: typeof import('./useTransactionsManager').useTransactionsManager;
// react-router doit être importé après resetModules pour partager l'instance du SUT.
let MemoryRouter: typeof import('react-router').MemoryRouter;
let useLocation: typeof import('react-router').useLocation;

beforeAll(async () => {
  // 1. Mock de tous les hooks dont dépend le manager
  vi.doMock('@/hooks/useTransactions', () => ({
    useTransactions: vi.fn(),
    useUpdateTransaction: vi.fn(),
    useUpdateTransfer: vi.fn(),
    useDeleteTransaction: vi.fn(),
    useDeleteTransfer: vi.fn(),
  }));
  vi.doMock('@/hooks/useCategories');
  vi.doMock('@/hooks/useAccounts');
  vi.doMock('@/hooks/usePaymentMethods');
  vi.doMock('@/components/ui', () => ({
    showToast: vi.fn(),
  }));
  vi.resetModules();

  ({ useAccounts } = await import('@/hooks/useAccounts'));
  ({ useCategories } = await import('@/hooks/useCategories'));
  ({ usePaymentMethods } = await import('@/hooks/usePaymentMethods'));
  ({
    useTransactions,
    useUpdateTransaction,
    useUpdateTransfer,
    useDeleteTransaction,
    useDeleteTransfer,
  } = await import('@/hooks/useTransactions'));
  ({ useTransactionsManager } = await import('./useTransactionsManager'));
  ({ MemoryRouter, useLocation } = await import('react-router'));
  await loadI18nForTests();
});

afterAll(() => {
  vi.doUnmock('@/hooks/useTransactions');
  vi.doUnmock('@/hooks/useCategories');
  vi.doUnmock('@/hooks/useAccounts');
  vi.doUnmock('@/hooks/usePaymentMethods');
  vi.doUnmock('@/components/ui');
  vi.resetModules();
});

function renderManager(entry = '/transactions', accountId?: number) {
  const location = { search: '' };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [entry] }, children);
  const utils = renderHook(
    () => {
      location.search = useLocation().search;
      return useTransactionsManager(accountId);
    },
    { wrapper },
  );
  return { ...utils, location };
}

describe('useTransactionsManager', () => {
  // Setup des mocks avec des valeurs par défaut avant chaque test
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTransactions).mockReturnValue({
      data: { data: [], total: 0, totalPages: 10 },
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

    vi.mocked(useUpdateTransfer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTransfer>);

    vi.mocked(useDeleteTransaction).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTransaction>);

    vi.mocked(useDeleteTransfer).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteTransfer>);
  });

  describe(`Persistance du limit en localStorage`, () => {
    beforeEach(() => {
      localStorage.removeItem(`cashctrl.txLimit`);
    });

    it(`utilise 25 par defaut sans valeur en localStorage`, () => {
      const { result } = renderManager();
      expect(result.current.state.limit).toBe(25);
    });

    it(`lit la valeur initiale depuis localStorage`, () => {
      localStorage.setItem(`cashctrl.txLimit`, `50`);
      const { result } = renderManager();
      expect(result.current.state.limit).toBe(50);
    });

    it(`retombe sur 25 si la valeur stockee est hors liste`, () => {
      localStorage.setItem(`cashctrl.txLimit`, `37`);
      const { result } = renderManager();
      expect(result.current.state.limit).toBe(25);
    });

    it(`persiste le nouveau limit dans localStorage lors du changement`, () => {
      const { result } = renderManager();
      act(() => {
        result.current.actions.handleLimitChange(100);
      });
      expect(result.current.state.limit).toBe(100);
      expect(localStorage.getItem(`cashctrl.txLimit`)).toBe(`100`);
    });

    it(`reinitialise la page a 1 lors du changement de limit`, () => {
      const { result } = renderManager();
      act(() => {
        result.current.actions.setPage(3);
      });
      act(() => {
        result.current.actions.handleLimitChange(50);
      });
      expect(result.current.state.page).toBe(1);
    });
  });

  describe('Initialisation et Filtres', () => {
    it('devrait initialiser les filtres avec l’ID de compte fourni', () => {
      const { result } = renderManager('/accounts/42', 42);
      expect(result.current.state.filters.account_id).toBe(42);
    });

    it('devrait réinitialiser la page à 1 lors du changement de filtre', () => {
      const { result } = renderManager();

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

  describe('URL comme source de vérité des filtres et de la page', () => {
    it("lit les filtres et la page depuis l'URL", () => {
      const { result } = renderManager('/transactions?q=chat&type=income&category_id=2&page=3');
      expect(result.current.state.filters).toEqual({
        description_contains: 'chat',
        type: 'income',
        category_id: 2,
      });
      expect(result.current.state.page).toBe(3);
    });

    it('lit validated=true et category_id=none depuis l’URL', () => {
      const { result } = renderManager('/transactions?category_id=none&validated=true');
      expect(result.current.state.filters).toEqual({ category_id: 'none', validated: true });
      expect(result.current.state.activeSubcategories).toEqual([]);
    });

    it("handleFilterChange réécrit l'URL et retire page", () => {
      const { result, location } = renderManager('/transactions?q=chat&page=3');

      act(() => {
        result.current.actions.handleFilterChange({ type: 'expense' });
      });

      expect(location.search).toBe('?q=chat&type=expense');
      expect(result.current.state.page).toBe(1);
    });

    it('handleFilterChange nettoie les paramètres inconnus et vides', () => {
      const { result, location } = renderManager('/transactions?foo=bar&q=chat');

      act(() => {
        result.current.actions.handleFilterChange({ description_contains: undefined });
      });

      expect(location.search).toBe('');
    });

    it("setPage écrit page dans l'URL", () => {
      const { result, location } = renderManager('/transactions?type=income');

      act(() => {
        result.current.actions.setPage(4);
      });

      expect(location.search).toBe('?type=income&page=4');
      expect(result.current.state.page).toBe(4);
    });

    it("handleLimitChange retire page de l'URL", () => {
      const { result, location } = renderManager('/transactions?type=income&page=4');

      act(() => {
        result.current.actions.handleLimitChange(50);
      });

      expect(location.search).toBe('?type=income');
    });

    it("n'écrit pas account_id sur la page d'un compte et ignore celui de l'URL", () => {
      const { result, location } = renderManager('/accounts/7?account_id=99&q=chat', 7);
      expect(result.current.state.filters.account_id).toBe(7);

      act(() => {
        result.current.actions.handleFilterChange({ type: 'expense' });
      });

      expect(location.search).toBe('?q=chat&type=expense');
      expect(result.current.state.filters.account_id).toBe(7);
    });

    it('ramène une page hors limites à la dernière page', () => {
      vi.mocked(useTransactions).mockReturnValue({
        data: { data: [], total: 30, totalPages: 3 },
        isLoading: false,
        isFetching: false,
      } as unknown as ReturnType<typeof useTransactions>);

      const { result, location } = renderManager('/transactions?type=income&page=9');

      expect(location.search).toBe('?type=income&page=3');
      expect(result.current.state.page).toBe(3);
    });

    it("n'écrit pas account_id en corrigeant une page hors limites sur la page d'un compte", () => {
      vi.mocked(useTransactions).mockReturnValue({
        data: { data: [], total: 20, totalPages: 2 },
        isLoading: false,
        isFetching: false,
      } as unknown as ReturnType<typeof useTransactions>);

      const { location } = renderManager('/accounts/7?page=9&category_id=3', 7);

      expect(location.search).toBe('?category_id=3&page=2');
    });

    it('conserve les deux patchs de deux handleFilterChange avant le re-rendu', () => {
      const { result, location } = renderManager('/transactions');

      act(() => {
        result.current.actions.handleFilterChange({ amount_min: 10 });
        result.current.actions.handleFilterChange({ amount_max: 50 });
      });

      expect(location.search).toContain('amount_min=10');
      expect(location.search).toContain('amount_max=50');
    });

    it('ne corrige pas la page tant que la requête est en cours', () => {
      vi.mocked(useTransactions).mockReturnValue({
        data: undefined,
        isLoading: true,
        isFetching: true,
      } as unknown as ReturnType<typeof useTransactions>);

      const { location } = renderManager('/transactions?page=9');

      expect(location.search).toBe('?page=9');
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

      const { result } = renderManager();

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
      const { result } = renderManager();

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
      const { result } = renderManager();
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
    it('appelle deleteTransaction pour une transaction normale', () => {
      const mockDelete = vi.fn();
      vi.mocked(useDeleteTransaction).mockReturnValue({
        mutate: mockDelete,
        isPending: false,
      } as unknown as ReturnType<typeof useDeleteTransaction>);

      const { result } = renderManager();
      const tx = { id: 50, transfer_peer_id: null } as Transaction;

      act(() => {
        result.current.actions.openDelete(tx);
      });
      act(() => {
        result.current.actions.handleDelete();
      });

      expect(mockDelete).toHaveBeenCalledWith(50, expect.any(Object));
    });

    it('appelle deleteTransfer pour un transfert', () => {
      const mockDeleteTransfer = vi.fn();
      vi.mocked(useDeleteTransfer).mockReturnValue({
        mutate: mockDeleteTransfer,
        isPending: false,
      } as unknown as ReturnType<typeof useDeleteTransfer>);

      const { result } = renderManager();
      const tx = { id: 50, transfer_peer_id: 51 } as Transaction;

      act(() => {
        result.current.actions.openDelete(tx);
      });
      act(() => {
        result.current.actions.handleDelete();
      });

      expect(mockDeleteTransfer).toHaveBeenCalledWith(50, expect.any(Object));
    });

    it('handleUpdate passe subcategory_id=null et splits pour une transaction ventilée', () => {
      const mockUpdate = vi.fn();
      vi.mocked(useUpdateTransaction).mockReturnValue({
        mutate: mockUpdate,
        isPending: false,
      } as unknown as ReturnType<typeof useUpdateTransaction>);

      const { result } = renderManager();
      const tx = { id: 10, transfer_peer_id: null } as Transaction;

      act(() => {
        result.current.actions.openEdit(tx);
      });
      act(() => {
        result.current.actions.handleUpdate({
          type: 'expense',
          amount: '500',
          description: 'Assurance',
          subcategory_id: '',
          account_id: '1',
          to_account_id: '',
          date: '2026-01-01',
          payment_method_id: '1',
          notes: '',
          validated: false,
          isVentilated: true,
          splits: [
            { subcategory_id: 1, amount: 300 },
            { subcategory_id: 2, amount: 200 },
          ],
          scheduled_id: null,
        });
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 10,
          subcategory_id: null,
          splits: [
            { subcategory_id: 1, amount: 300 },
            { subcategory_id: 2, amount: 200 },
          ],
        }),
        expect.any(Object),
      );
    });

    it('handleUpdate transmet le validated du formulaire pour un transfert (pas celui d’origine)', () => {
      const mockUpdateTransfer = vi.fn();
      vi.mocked(useUpdateTransfer).mockReturnValue({
        mutate: mockUpdateTransfer,
        isPending: false,
      } as unknown as ReturnType<typeof useUpdateTransfer>);

      const { result } = renderManager();
      const tx = { id: 20, transfer_peer_id: 21, validated: 0 } as Transaction;

      act(() => {
        result.current.actions.openEdit(tx);
      });
      act(() => {
        result.current.actions.handleUpdate({
          type: 'expense',
          amount: '150',
          description: 'Virement',
          subcategory_id: '',
          account_id: '1',
          to_account_id: '2',
          date: '2026-01-01',
          payment_method_id: '',
          notes: '',
          validated: true,
          isVentilated: false,
          splits: [],
          scheduled_id: null,
        });
      });

      expect(mockUpdateTransfer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 20, validated: true }),
        expect.any(Object),
      );
    });

    it('ne devrait rien faire si handleDelete est appelé sans modale delete ouverte', () => {
      const mockDelete = vi.fn();
      vi.mocked(useDeleteTransaction).mockReturnValue({
        mutate: mockDelete,
      } as unknown as ReturnType<typeof useDeleteTransaction>);

      const { result } = renderManager();
      act(() => {
        result.current.actions.handleDelete();
      });

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
