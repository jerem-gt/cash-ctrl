import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';

import { CATEGORIES } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { CategoriesManager, CategoryCard } from './CategoriesManager';

describe('CategoriesManager', () => {
  it('affiche le squelette pendant le chargement des catégories', () => {
    server.use(http.get('/api/categories', () => new Promise<never>(() => {})));
    renderWithProviders(<CategoriesManager />);
    expect(screen.queryByText('Alimentation')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche la section', async () => {
    renderWithProviders(<CategoriesManager />);
    expect(await screen.findByText('Catégories')).toBeInTheDocument();
  });

  it('affiche les catégories chargées', async () => {
    renderWithProviders(<CategoriesManager />);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
  });
});

describe('CategoriesManager — Filtre', () => {
  it('filtre les catégories par nom', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'ali');
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.queryByText('Logement')).not.toBeInTheDocument();
  });

  it('filtre les catégories par nom de sous-catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'supermarché');
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.queryByText('Logement')).not.toBeInTheDocument();
  });

  it('déplie la catégorie quand la recherche matche une sous-catégorie', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'supermarché');
    expect(screen.getByRole('button', { name: 'Alimentation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('affiche un message quand aucune catégorie ne correspond', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'xyz');
    expect(screen.queryByText('Alimentation')).not.toBeInTheDocument();
    expect(screen.queryByText('Logement')).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune catégorie/i)).toBeInTheDocument();
  });
});

describe('CategoriesManager — Ajout', () => {
  it('bouton désactivé si nom vide', async () => {
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    const newForm = screen.getByTestId('new-category-form');
    expect(within(newForm).getByRole('button', { name: /ajouter/i })).toBeDisabled();
  });

  it('ajoute une catégorie avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    const newForm = screen.getByTestId('new-category-form');
    await user.type(screen.getByLabelText('Nom de la nouvelle catégorie'), 'Loisirs');
    await user.click(within(newForm).getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajoutée'));
  });

  it("toast si l'ajout d'une catégorie échoue", async () => {
    server.use(
      http.post('/api/categories', () =>
        HttpResponse.json({ error: 'Erreur ajout cat' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    const newForm = screen.getByTestId('new-category-form');
    await user.type(screen.getByLabelText('Nom de la nouvelle catégorie'), 'Loisirs');
    await user.click(within(newForm).getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout cat'),
    );
  });
});

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
