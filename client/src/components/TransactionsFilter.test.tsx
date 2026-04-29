import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS, CATEGORIES } from '@/tests/fixtures';

import { TransactionsFilters } from './TransactionsFilters';

describe('TransactionFilters', () => {
  const mockOnFilterChange = vi.fn();
  const defaultProps = {
    filters: {},
    onFilterChange: mockOnFilterChange,
    categories: CATEGORIES,
    subcategories: CATEGORIES[0].subcategories,
    accounts: ACCOUNTS,
    logoMap: {},
    showAccountSelect: true,
  };

  it('appelle onFilterChange lors du changement de catégorie', () => {
    render(<TransactionsFilters {...defaultProps} />);

    const select = screen.getByLabelText(/choisir une catégorie/i);
    fireEvent.change(select, { target: { value: String(CATEGORIES[0].id) } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      category_id: CATEGORIES[0].id,
    });
  });

  it('désactive le select des sous-catégories si aucune catégorie n’est sélectionnée', () => {
    render(<TransactionsFilters {...defaultProps} filters={{ category_id: undefined }} />);

    const subSelect = screen.getByLabelText(/choisir une sous-catégorie/i);
    expect(subSelect).toBeDisabled();
  });

  it('active le select des sous-catégories si une catégorie est sélectionnée', () => {
    render(<TransactionsFilters {...defaultProps} filters={{ category_id: 1 }} />);

    const subSelect = screen.getByLabelText(/choisir une sous-catégorie/i);
    expect(subSelect).not.toBeDisabled();
  });

  it('appelle onFilterChange lors du changement de type (revenus/dépenses)', () => {
    render(<TransactionsFilters {...defaultProps} />);

    const select = screen.getByLabelText(/choisir un type/i);
    fireEvent.change(select, { target: { value: 'income' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ type: 'income' });
  });

  it('affiche le sélecteur de compte uniquement si showAccountSelect est true', () => {
    const { rerender } = render(<TransactionsFilters {...defaultProps} showAccountSelect={true} />);
    // On cherche le bouton du AccountSelect par son id défini dans le composant
    expect(document.getElementById('filtered-account-select')).toBeInTheDocument();

    rerender(<TransactionsFilters {...defaultProps} showAccountSelect={false} />);
    expect(document.getElementById('filtered-account-select')).not.toBeInTheDocument();
  });

  it('réinitialise une valeur à undefined si l’option vide est sélectionnée', () => {
    render(<TransactionsFilters {...defaultProps} filters={{ type: 'expense' }} />);

    const select = screen.getByLabelText(/choisir un type/i);
    fireEvent.change(select, { target: { value: '' } });

    expect(mockOnFilterChange).toHaveBeenCalledWith({ type: undefined });
  });
});
