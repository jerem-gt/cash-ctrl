import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';

import { TransactionsFilters } from './TransactionsFilters';

const defaultProps = {
  filters: {},
  onFilterChange: vi.fn(),
  categories: [],
  subcategories: [],
  accounts: ACCOUNTS,
  logoMap: {},
};

describe('TransactionsFilters', () => {
  it('appelle onFilterChange avec undefined quand la description est effacée', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    render(
      <TransactionsFilters
        {...defaultProps}
        filters={{ description_contains: 'test' }}
        onFilterChange={onFilterChange}
      />,
    );

    const input = screen.getByPlaceholderText(/rechercher/i);
    fireEvent.change(input, { target: { value: '' } });
    act(() => {
      vi.runAllTimers();
    });

    expect(onFilterChange).toHaveBeenCalledWith({ description_contains: undefined });
    vi.useRealTimers();
  });

  it('appelle onFilterChange avec la valeur quand la description est saisie', async () => {
    vi.useFakeTimers();
    const onFilterChange = vi.fn();
    render(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    const input = screen.getByPlaceholderText(/rechercher/i);
    fireEvent.change(input, { target: { value: 'courses' } });
    act(() => {
      vi.runAllTimers();
    });

    expect(onFilterChange).toHaveBeenCalledWith({ description_contains: 'courses' });
    vi.useRealTimers();
  });

  it("appelle onFilterChange avec undefined pour la catégorie quand on choisit 'Toutes'", () => {
    const onFilterChange = vi.fn();
    render(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    const select = screen.getByLabelText(/choisir une catégorie/i);
    fireEvent.change(select, { target: { value: '' } });

    expect(onFilterChange).toHaveBeenCalledWith({
      category_id: undefined,
      subcategory_id: undefined,
    });
  });

  it("appelle onFilterChange avec undefined pour la sous-catégorie quand on choisit 'Toutes'", () => {
    const onFilterChange = vi.fn();
    render(<TransactionsFilters {...defaultProps} onFilterChange={onFilterChange} />);

    const select = screen.getByLabelText(/choisir une sous-catégorie/i);
    fireEvent.change(select, { target: { value: '' } });

    expect(onFilterChange).toHaveBeenCalledWith({ subcategory_id: undefined });
  });

  it('affiche le sélecteur de compte quand showAccountSelect est true', () => {
    render(<TransactionsFilters {...defaultProps} showAccountSelect />);
    expect(screen.getByRole('button', { name: /Tous les comptes/i })).toBeInTheDocument();
  });
});
