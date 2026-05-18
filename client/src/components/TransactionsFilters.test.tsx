import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, CATEGORIES, PAYMENT_METHODS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { TransactionsFilters } from './TransactionsFilters';

const mockOnFilterChange = vi.fn();

const defaultProps = {
  filters: {},
  onFilterChange: mockOnFilterChange,
  categories: CATEGORIES,
  subcategories: CATEGORIES[0].subcategories,
  accounts: ACCOUNTS,
  paymentMethods: PAYMENT_METHODS,
  logoMap: {},
};

function openAdvanced() {
  fireEvent.click(screen.getByRole('button', { name: /filtres avancés/i }));
}

describe('TransactionsFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Description ---

  it('appelle onFilterChange avec la valeur quand la description est saisie', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: 'courses' } });
    act(() => vi.runAllTimers());

    expect(onFilterChange).toHaveBeenCalledWith({ description_contains: 'courses' });
    vi.useRealTimers();
  });

  it('appelle onFilterChange avec undefined quand la description est effacée', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    renderWithProviders(
      <TransactionsFilters
        {...defaultProps}
        filters={{ description_contains: 'test' }}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), { target: { value: '' } });
    act(() => vi.runAllTimers());

    expect(onFilterChange).toHaveBeenCalledWith({ description_contains: undefined });
    vi.useRealTimers();
  });

  // --- Type ---

  it('appelle onFilterChange lors du changement de type (revenus/dépenses)', () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/choisir un type/i), { target: { value: 'income' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'income' });
  });

  it("réinitialise une valeur à undefined si l'option vide est sélectionnée", () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} filters={{ type: 'expense' }} />);

    fireEvent.change(screen.getByLabelText(/choisir un type/i), { target: { value: '' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ type: undefined });
  });

  // --- Bouton effacer ---

  it('le bouton × efface la recherche et appelle onFilterChange', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionsFilters
        {...defaultProps}
        filters={{ description_contains: 'test' }}
        onFilterChange={onFilterChange}
      />,
    );

    const clearBtn = screen.getByRole('button', { name: /effacer/i });
    await user.click(clearBtn);

    expect(onFilterChange).toHaveBeenCalledWith({ description_contains: undefined });
  });

  // --- Filtres avancés : section dépliable ---

  it('la section avancée est masquée par défaut puis visible après le clic', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);

    expect(screen.queryByLabelText(/choisir une catégorie/i)).not.toBeInTheDocument();

    openAdvanced();

    expect(screen.getByLabelText(/choisir une catégorie/i)).toBeInTheDocument();
  });

  it('affiche un badge avec le nombre de filtres avancés actifs', async () => {
    renderWithProviders(
      <TransactionsFilters
        {...defaultProps}
        filters={{ category_id: 1, date_from: '2024-01-01' }}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // --- Catégories ---

  it('appelle onFilterChange lors du changement de catégorie', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/choisir une catégorie/i), {
      target: { value: String(CATEGORIES[0].id) },
    });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ category_id: CATEGORIES[0].id });
  });

  it("appelle onFilterChange avec undefined pour la catégorie quand on choisit 'Toutes'", async () => {
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/choisir une catégorie/i), { target: { value: '' } });

    expect(onFilterChange).toHaveBeenCalledWith({
      category_id: undefined,
      subcategory_id: undefined,
    });
  });

  // --- Sous-catégories ---

  it("désactive le select des sous-catégories si aucune catégorie n'est sélectionnée", async () => {
    renderWithProviders(
      <TransactionsFilters {...defaultProps} filters={{ category_id: undefined }} />,
    );
    openAdvanced();

    expect(screen.getByLabelText(/choisir une sous-catégorie/i)).toBeDisabled();
  });

  it('active le select des sous-catégories si une catégorie est sélectionnée', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} filters={{ category_id: 1 }} />);
    openAdvanced();

    expect(screen.getByLabelText(/choisir une sous-catégorie/i)).not.toBeDisabled();
  });

  it("appelle onFilterChange avec undefined pour la sous-catégorie quand on choisit 'Toutes'", async () => {
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/choisir une sous-catégorie/i), {
      target: { value: '' },
    });

    expect(onFilterChange).toHaveBeenCalledWith({ subcategory_id: undefined });
  });

  // --- Sélecteur de compte ---

  it('affiche le sélecteur de compte uniquement si showAccountSelect est true', async () => {
    const { rerender } = renderWithProviders(
      <TransactionsFilters {...defaultProps} showAccountSelect={true} />,
    );
    openAdvanced();
    expect(document.getElementById('filtered-account-select')).toBeInTheDocument();

    rerender(<TransactionsFilters {...defaultProps} showAccountSelect={false} />);
    expect(document.getElementById('filtered-account-select')).not.toBeInTheDocument();
  });

  it('appelle onFilterChange lors du changement de compte via AccountSelect', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TransactionsFilters
        {...defaultProps}
        showAccountSelect={true}
        onFilterChange={onFilterChange}
      />,
    );
    openAdvanced();

    const trigger = document.getElementById('filtered-account-select')!;
    await user.click(trigger);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));

    expect(onFilterChange).toHaveBeenCalledWith({ account_id: 1 });
  });

  // --- Dates ---

  it('appelle onFilterChange avec date_from lors du changement de date de début', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/date de début/i), {
      target: { value: '2024-01-01' },
    });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ date_from: '2024-01-01' });
  });

  it('appelle onFilterChange avec date_to lors du changement de date de fin', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/date de fin/i), {
      target: { value: '2024-12-31' },
    });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ date_to: '2024-12-31' });
  });

  it('appelle onFilterChange avec undefined quand la date est effacée', async () => {
    renderWithProviders(
      <TransactionsFilters {...defaultProps} filters={{ date_from: '2024-01-01' }} />,
    );
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/date de début/i), { target: { value: '' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ date_from: undefined });
  });

  // --- Montants ---

  it('appelle onFilterChange avec amount_min après saisie du montant minimum', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/montant minimum/i), { target: { value: '50' } });
    act(() => vi.runAllTimers());

    expect(onFilterChange).toHaveBeenCalledWith({ amount_min: 50 });
    vi.useRealTimers();
  });

  it('appelle onFilterChange avec amount_max après saisie du montant maximum', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/montant maximum/i), { target: { value: '500' } });
    act(() => vi.runAllTimers());

    expect(onFilterChange).toHaveBeenCalledWith({ amount_max: 500 });
    vi.useRealTimers();
  });

  // --- Moyen de paiement ---

  it('appelle onFilterChange lors du changement de moyen de paiement', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);
    openAdvanced();

    fireEvent.change(screen.getByLabelText(/moyen de paiement/i), {
      target: { value: String(PAYMENT_METHODS[0].id) },
    });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      payment_method_id: PAYMENT_METHODS[0].id,
    });
  });

  // --- Validées ---

  it('appelle onFilterChange avec validated: false quand la checkbox est cochée', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);
    openAdvanced();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(mockOnFilterChange).toHaveBeenCalledWith({ validated: false });
  });

  it('appelle onFilterChange avec undefined quand la checkbox est décochée', async () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} filters={{ validated: false }} />);
    openAdvanced();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(mockOnFilterChange).toHaveBeenCalledWith({ validated: undefined });
  });
});
