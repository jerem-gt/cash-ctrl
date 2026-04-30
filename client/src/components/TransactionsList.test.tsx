import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTransactionsManager } from '@/hooks/useTransactionsManager.ts';
import { ACCOUNTS, TRANSACTIONS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { Transaction } from '@/types.ts';

import { TransactionsList } from './TransactionsList';

// 1. Mock du hook manager
vi.mock('@/hooks/useTransactionsManager.ts');

const mockLogoMap = { BNP: '/logos/bnp.png' };

// Helper pour simuler le retour du hook
type ManagerReturn = ReturnType<typeof useTransactionsManager>;
interface ManagerOverrides {
  state?: Partial<ManagerReturn['state']>;
  actions?: Partial<ManagerReturn['actions']>;
}
const mockManager = (overrides: ManagerOverrides = {}) => {
  vi.mocked(useTransactionsManager).mockReturnValue({
    state: {
      filters: {},
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 1,
      transactions: [],
      categories: [],
      activeSubcategories: [],
      accounts: [],
      paymentMethods: [],
      modal: { type: 'none' },
      isLoading: false,
      isFetching: false,
      isPending: false,
      ...overrides.state,
    },
    actions: {
      openAdd: vi.fn(),
      openEdit: vi.fn(),
      openDuplicate: vi.fn(),
      openDelete: vi.fn(),
      setPage: vi.fn(),
      handleLimitChange: vi.fn(),
      handleFilterChange: vi.fn(),
      closeAll: vi.fn(),
      handleDelete: vi.fn(),
      handleUpdate: vi.fn(),
      ...overrides.actions,
    },
  } as ManagerReturn);
};

describe('TransactionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les skeletons pendant le chargement', () => {
    mockManager({ state: { isLoading: true } });
    render(<TransactionsList logoMap={mockLogoMap} />);

    // On vérifie qu'il y a des éléments de skeleton (on en génère 6 dans le code)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('affiche un message vide quand il n’y a pas de transactions', () => {
    mockManager({ state: { transactions: [], total: 0 } });
    render(<TransactionsList logoMap={mockLogoMap} emptyMessage="Rien ici !" />);

    expect(screen.getByText('Rien ici !')).toBeInTheDocument();
  });

  it('appelle openAdd au clic sur le bouton de création', () => {
    const openAdd = vi.fn();
    mockManager({ actions: { openAdd } });

    render(<TransactionsList logoMap={mockLogoMap} />);
    fireEvent.click(screen.getByText('+ Nouvelle transaction'));

    expect(openAdd).toHaveBeenCalled();
  });

  it('affiche la modale d’ajout quand le state du manager est "add"', () => {
    mockManager({
      state: {
        modal: { type: 'add' },
        accounts: [
          {
            id: 2,
            name: 'Test',
            bank_id: 1,
            bank: 'BNP',
            account_type_id: 1,
            type: 'Courant',
            initial_balance: 100,
            balance: 1000,
            opening_date: '',
          },
        ],
        categories: [],
      },
    });

    renderWithProviders(<TransactionsList logoMap={mockLogoMap} />);

    // Le titre "Nouvelle transaction" est rendu par TxModal (vu dans TxModal.test.tsx)
    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it('affiche la modale de suppression quand le state est "delete"', () => {
    const tx = { id: 123, description: 'Courses', amount: -50 } as Transaction;
    mockManager({
      state: { modal: { type: 'delete', tx } },
    });

    render(<TransactionsList logoMap={mockLogoMap} />);

    // On vérifie que DeleteTxModal est là (généralement via un texte spécifique)
    expect(screen.getByText(/supprimer/i)).toBeInTheDocument();
  });

  it('rend la pagination si nécessaire', () => {
    const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
      ...TRANSACTIONS.data[0],
      id: i + 1, // IDs uniques indispensables
      description: `Tx ${i + 1}`,
    }));
    mockManager({
      state: {
        total: 50,
        totalPages: 2,
        page: 1,
        transactions: manyTransactions,
      },
    });

    renderWithProviders(<TransactionsList logoMap={mockLogoMap} />);

    // On cherche les contrôles de pagination
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('cache le sélecteur de compte si un compte spécifique est fourni en props', () => {
    mockManager();
    // showAccountSelect={!account} dans ton code
    render(<TransactionsList account={ACCOUNTS[0]} logoMap={mockLogoMap} />);

    const accountSelect = screen.queryByLabelText(/compte/i);
    expect(accountSelect).not.toBeInTheDocument();
  });
});
