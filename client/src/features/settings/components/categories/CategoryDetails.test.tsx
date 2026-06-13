import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { CategoryDetails } from './CategoryDetails';

const selectedCat = CATEGORIES[0]; // Alimentation, icon: 🍴

describe('CategoryDetails', () => {
  it("affiche le prompt de sélection quand aucune catégorie n'est fournie", () => {
    renderWithProviders(<CategoryDetails />);
    expect(
      screen.getByText('Sélectionnez une catégorie pour gérer ses détails'),
    ).toBeInTheDocument();
  });

  it("affiche le nom, l'icône et le label de la catégorie sélectionnée", () => {
    renderWithProviders(<CategoryDetails selectedCategory={selectedCat} />);
    expect(screen.getByText(selectedCat.name)).toBeInTheDocument();
    expect(screen.getByText(selectedCat.icon)).toBeInTheDocument();
    expect(screen.getByText('Catégorie principale')).toBeInTheDocument();
  });

  it('bascule en mode édition au clic sur le bouton Modifier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={selectedCat} />);
    await user.click(screen.getByText('Modifier', { selector: 'button' }));
    expect(screen.getByDisplayValue(selectedCat.name)).toBeInTheDocument();
  });

  it("revient en visualisation au clic sur Annuler dans l'éditeur", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={selectedCat} />);
    await user.click(screen.getByText('Modifier', { selector: 'button' }));
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByDisplayValue(selectedCat.name)).not.toBeInTheDocument();
    expect(screen.getByText(selectedCat.name)).toBeInTheDocument();
  });

  it('enregistre la modification et affiche le toast de succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={selectedCat} />);
    await user.click(screen.getByText('Modifier', { selector: 'button' }));
    const input = screen.getByDisplayValue(selectedCat.name);
    await user.clear(input);
    await user.type(input, 'Courses');
    await user.click(screen.getAllByRole('button', { name: /^Modifier$/i })[0]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  it('ouvre la modale de confirmation au clic sur Supprimer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryDetails selectedCategory={selectedCat} />);
    await user.click(screen.getByText('Supprimer', { selector: 'button' }));
    expect(screen.getByText('Supprimer la catégorie')).toBeInTheDocument();
    expect(screen.getByText('Confirmer la suppression ?')).toBeInTheDocument();
  });
});
