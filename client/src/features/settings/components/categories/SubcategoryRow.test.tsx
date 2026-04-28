import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { SubcategoryRow } from './SubcategoryRow';

// Mock des props obligatoires
const mockSub = {
  id: 1,
  name: 'Restaurant',
  tx_count: 5,
  category_id: 10,
};

const defaultProps = {
  sub: mockSub,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('SubcategoryRow', () => {
  it('affiche le nom et le nombre de transactions en mode lecture', () => {
    renderWithProviders(<SubcategoryRow {...defaultProps} />);

    expect(screen.getByText('Restaurant')).toBeInTheDocument();
    expect(screen.getByText('5 tx')).toBeInTheDocument();
  });

  it('bascule en mode édition au clic sur le bouton modifier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubcategoryRow {...defaultProps} />);

    const editBtn = screen.getByTitle('Modifier');
    await user.click(editBtn);

    // Vérifie que l'éditeur est affiché (recherche l'input avec la valeur actuelle)
    expect(screen.getByDisplayValue('Restaurant')).toBeInTheDocument();
  });

  it('appelle onDelete au clic sur le bouton supprimer', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    // On utilise une sous-catégorie avec 0 transaction pour que le bouton soit actif
    const subWithNoTx = { ...mockSub, tx_count: 0 };

    renderWithProviders(<SubcategoryRow {...defaultProps} sub={subWithNoTx} onDelete={onDelete} />);

    const deleteBtn = screen.getByTitle('Supprimer');
    await user.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledWith(subWithNoTx.id);
  });

  it('désactive et masque le bouton supprimer si tx_count > 0', () => {
    renderWithProviders(<SubcategoryRow {...defaultProps} />);

    const deleteBtn = screen.getByTitle('Supprimer');
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn).toHaveClass('opacity-0');
  });

  it('sort du mode édition et appelle onEdit après une sauvegarde réussie', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<SubcategoryRow {...defaultProps} onEdit={onEdit} />);

    // Entrer en édition
    await user.click(screen.getByTitle('Modifier'));

    // Modifier le texte
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Fast Food');

    // Sauvegarder
    const saveBtn = screen.getByRole('button', { name: /OK/i });
    await user.click(saveBtn);

    // On attend que le composant repasse en mode lecture
    // Inutile de vérifier la nouvelle valeur, elle est mise à jour par le rechargment du parent donc pas ici
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('annule l’édition et revient au mode lecture au clic sur Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubcategoryRow {...defaultProps} />);

    await user.click(screen.getByTitle('Modifier'));
    await user.click(screen.getByRole('button', { name: /Annuler/i }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
  });
});
