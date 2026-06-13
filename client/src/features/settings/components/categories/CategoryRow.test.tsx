import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { CategoryRow } from './CategoryRow';

const cat = { id: 1, name: 'Alimentation', icon: '🍴', subcategories: [], tx_count: 12 };

describe('CategoryRow', () => {
  it("affiche l'icône et le nom de la catégorie", () => {
    renderWithProviders(<CategoryRow cat={cat} selectedId={null} handleSelectCat={vi.fn()} />);
    expect(screen.getByText('🍴')).toBeInTheDocument();
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
  });

  it('affiche le nombre de transactions quand tx_count > 0', () => {
    renderWithProviders(<CategoryRow cat={cat} selectedId={null} handleSelectCat={vi.fn()} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('masque le compteur quand tx_count est 0', () => {
    renderWithProviders(
      <CategoryRow cat={{ ...cat, tx_count: 0 }} selectedId={null} handleSelectCat={vi.fn()} />,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('masque le compteur quand tx_count est undefined', () => {
    renderWithProviders(
      <CategoryRow
        cat={{ ...cat, tx_count: undefined }}
        selectedId={null}
        handleSelectCat={vi.fn()}
      />,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it("appelle handleSelectCat avec l'id au clic", async () => {
    const user = userEvent.setup();
    const handleSelectCat = vi.fn();
    renderWithProviders(
      <CategoryRow cat={cat} selectedId={null} handleSelectCat={handleSelectCat} />,
    );
    await user.click(screen.getByRole('button'));
    expect(handleSelectCat).toHaveBeenCalledWith(cat.id);
  });

  it('applique le style sélectionné quand selectedId correspond', () => {
    renderWithProviders(<CategoryRow cat={cat} selectedId={cat.id} handleSelectCat={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('bg-surface');
  });

  it('applique le style non-sélectionné quand selectedId ne correspond pas', () => {
    renderWithProviders(<CategoryRow cat={cat} selectedId={99} handleSelectCat={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveClass('text-content-muted');
  });
});
