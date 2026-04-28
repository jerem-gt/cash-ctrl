import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SubCategoriesManager } from '@/features/settings/components/categories/SubcategoriesManager.tsx';
import { CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const parentCategory = CATEGORIES[0]; // "Alimentation" avec ses sous-catégories

describe('SubCategoriesManager', () => {
  it('affiche la liste des sous-catégories existantes', () => {
    renderWithProviders(<SubCategoriesManager parentCategory={parentCategory} />);

    parentCategory.subcategories.forEach((sub) => {
      expect(screen.getByText(sub.name)).toBeInTheDocument();
    });
  });

  it('affiche un message si la liste est vide', () => {
    const emptyCategory = { ...parentCategory, subcategories: [] };
    renderWithProviders(<SubCategoriesManager parentCategory={emptyCategory} />);

    expect(screen.getByText(/Aucune sous-catégorie dans cette catégorie/i)).toBeInTheDocument();
  });

  it('ajoute une nouvelle sous-catégorie avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubCategoriesManager parentCategory={parentCategory} />);

    // L'éditeur est présent avec le name='' par défaut
    const input = screen.getByPlaceholderText(/Nom de la sous-catégorie/i);
    await user.type(input, 'Nouvelle Sous-Cat');

    const addBtn = screen.getByRole('button', { name: /Ajouter/i });
    await user.click(addBtn);

    // Vérifier le toast de succès (comportement identique à TxModal.test.tsx)
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toContain('Sous-catégorie ajoutée ✓');
    });
  });

  it('ouvre le modal de confirmation lors de la suppression', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubCategoriesManager parentCategory={parentCategory} />);

    // On récupère le bouton de suppression de la première ligne
    const deleteButtons = screen.getAllByRole('button', { name: /×/i });
    await user.click(deleteButtons[0]);

    // Vérifie que le hook useDeleteConfirmation a ouvert le modal
    expect(screen.getByText(/Supprimer la sous-catégorie/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmer la suppression/i)).toBeInTheDocument();
  });

  it('réinitialise le champ de texte après un ajout réussi', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubCategoriesManager parentCategory={parentCategory} />);

    const input = screen.getByPlaceholderText(/Nom de la sous-catégorie/i);
    await user.type(input, 'Test Reset');
    await user.click(screen.getByRole('button', { name: /Ajouter/i }));

    await waitFor(() => {
      const newInput = screen.getByPlaceholderText(/Nom de la sous-catégorie/i);
      expect(newInput).toHaveValue('');
    });
  });
});
