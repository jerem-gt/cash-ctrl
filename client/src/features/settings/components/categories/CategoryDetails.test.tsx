import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { CategoryDetails } from './CategoryDetails';

const cat1 = CATEGORIES[0];
const cat2 = CATEGORIES[1];

describe('CategoryDetails', () => {
  it('affiche un message d’invitation si aucune catégorie n’est sélectionnée', () => {
    renderWithProviders(<CategoryDetails />);
    expect(
      screen.getByText(/Sélectionnez une catégorie pour gérer ses détails/i),
    ).toBeInTheDocument();
  });

  it('affiche les informations de la catégorie sélectionnée', () => {
    renderWithProviders(<CategoryDetails selectedCategory={cat1} />);
    expect(screen.getByText(cat1.name)).toBeInTheDocument();
    expect(screen.getByText(cat1.icon)).toBeInTheDocument();
  });

  it('bascule en mode édition au clic sur le bouton Modifier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={cat1} />);

    await user.click(screen.getByRole('button', { name: /Modifier/i }));

    // On vérifie la présence du formulaire (CategoryEditor)
    expect(screen.getByDisplayValue(cat1.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
  });

  it('réinitialise le mode édition quand la catégorie sélectionnée change', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <CategoryDetails key={cat1.id} selectedCategory={cat1} />,
    );

    // 1. Passer en mode édition sur la Catégorie A
    await user.click(screen.getByRole('button', { name: /Modifier/i }));
    expect(screen.getByDisplayValue(cat1.name)).toBeInTheDocument();

    // 2. Simuler le changement de sélection par le parent (passe à la Catégorie B)
    rerender(<CategoryDetails key={cat2.id} selectedCategory={cat2} />);

    // 3. Vérifier que nous ne sommes plus en mode édition
    // (Le nom de la catégorie B doit être affiché en texte simple, pas dans un input)
    expect(screen.queryByRole('button', { name: /Annuler/i })).not.toBeInTheDocument();
    expect(screen.getByText(cat2.name)).toBeInTheDocument();
  });

  it('appelle la suppression et affiche le modal de confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={cat1} />);

    await user.click(screen.getByRole('button', { name: /Supprimer/i }));

    // Vérifie que le hook de confirmation affiche ses textes
    expect(screen.getByText(/Supprimer la catégorie/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmer la suppression/i)).toBeInTheDocument();
  });
});
