import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { TransactionsFilters } from './TransactionsFilters';

const mockOnFilterChange = vi.fn();

const defaultProps = {
  filters: {},
  onFilterChange: mockOnFilterChange,
  categories: CATEGORIES,
  subcategories: CATEGORIES[0].subcategories,
  accounts: ACCOUNTS,
  logoMap: {},
};

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

  // --- Catégories ---

  it('appelle onFilterChange lors du changement de catégorie', () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/choisir une catégorie/i), {
      target: { value: String(CATEGORIES[0].id) },
    });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ category_id: CATEGORIES[0].id });
  });

  it("appelle onFilterChange avec undefined pour la catégorie quand on choisit 'Toutes'", () => {
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText(/choisir une catégorie/i), { target: { value: '' } });

    expect(onFilterChange).toHaveBeenCalledWith({
      category_id: undefined,
      subcategory_id: undefined,
    });
  });

  // --- Sous-catégories ---

  it("désactive le select des sous-catégories si aucune catégorie n'est sélectionnée", () => {
    renderWithProviders(
      <TransactionsFilters {...defaultProps} filters={{ category_id: undefined }} />,
    );

    expect(screen.getByLabelText(/choisir une sous-catégorie/i)).toBeDisabled();
  });

  it('active le select des sous-catégories si une catégorie est sélectionnée', () => {
    renderWithProviders(<TransactionsFilters {...defaultProps} filters={{ category_id: 1 }} />);

    expect(screen.getByLabelText(/choisir une sous-catégorie/i)).not.toBeDisabled();
  });

  it("appelle onFilterChange avec undefined pour la sous-catégorie quand on choisit 'Toutes'", () => {
    const onFilterChange = vi.fn();
    renderWithProviders(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    fireEvent.change(screen.getByLabelText(/choisir une sous-catégorie/i), {
      target: { value: '' },
    });

    expect(onFilterChange).toHaveBeenCalledWith({ subcategory_id: undefined });
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

  // --- Sélecteur de compte ---

  it('affiche le sélecteur de compte uniquement si showAccountSelect est true', () => {
    const { rerender } = renderWithProviders(
      <TransactionsFilters {...defaultProps} showAccountSelect={true} />,
    );
    expect(document.getElementById('filtered-account-select')).toBeInTheDocument();

    rerender(<TransactionsFilters {...defaultProps} showAccountSelect={false} />);
    expect(document.getElementById('filtered-account-select')).not.toBeInTheDocument();
  });
});
