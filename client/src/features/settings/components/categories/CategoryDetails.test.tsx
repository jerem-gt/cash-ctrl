import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { CategoryCard } from './CategoriesManager';

const cat = CATEGORIES[0];

describe('CategoryCard', () => {
  it('affiche les informations de la catégorie', () => {
    renderWithProviders(<CategoryCard cat={cat} />);
    expect(screen.getByText(cat.name)).toBeInTheDocument();
    expect(screen.getByText(cat.icon)).toBeInTheDocument();
  });

  it('bascule en mode édition au clic sur le bouton Modifier', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryCard cat={cat} />);
    await user.click(screen.getByRole('button', { name: /Modifier/i }));
    expect(screen.getByDisplayValue(cat.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuler/i })).toBeInTheDocument();
  });

  it("annule l'édition au clic sur Annuler", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryCard cat={cat} />);
    await user.click(screen.getByRole('button', { name: /Modifier/i }));
    await user.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(screen.queryByDisplayValue(cat.name)).not.toBeInTheDocument();
    expect(screen.getByText(cat.name)).toBeInTheDocument();
  });

  it('masque le bouton Supprimer si la catégorie a des sous-catégories', () => {
    renderWithProviders(<CategoryCard cat={cat} />);
    expect(screen.queryByRole('button', { name: /Supprimer/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton Supprimer et ouvre le modal si la catégorie est vide', async () => {
    const user = userEvent.setup();
    const emptycat = { ...cat, subcategories: [] };
    renderWithProviders(<CategoryCard cat={emptycat} />);
    await user.click(screen.getByRole('button', { name: /Supprimer/i }));
    expect(screen.getByText(/Supprimer la catégorie/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmer la suppression/i)).toBeInTheDocument();
  });

  it('masque les sous-catégories par défaut', () => {
    renderWithProviders(<CategoryCard cat={cat} />);
    const toggle = screen.getByRole('button', { name: cat.name });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Ajouter/i })).not.toBeInTheDocument();
  });

  it('affiche les sous-catégories au clic sur le bouton de toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryCard cat={cat} />);
    const toggle = screen.getByRole('button', { name: cat.name });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument();
  });

  it('masque de nouveau les sous-catégories au second clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryCard cat={cat} />);
    const toggle = screen.getByRole('button', { name: cat.name });
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Ajouter/i })).not.toBeInTheDocument();
  });

  it('soumet la mise à jour et affiche le toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoryCard cat={cat} />);
    await user.click(screen.getByRole('button', { name: /Modifier/i }));
    const input = screen.getByDisplayValue(cat.name);
    await user.clear(input);
    await user.type(input, 'Alimentation modifiée');
    await user.click(screen.getByRole('button', { name: /Modifier/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });
});
