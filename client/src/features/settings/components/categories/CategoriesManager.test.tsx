import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { CategoriesManager } from './CategoriesManager';

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

describe('CategoriesManager — Ajout', () => {
  it('bouton désactivé si nom vide', async () => {
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled();
  });

  it('ajoute une catégorie avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesManager />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByLabelText('Nom de la nouvelle catégorie'), 'Loisirs');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
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
    await user.type(screen.getByLabelText('Nom de la nouvelle catégorie'), 'Loisirs');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout cat'),
    );
  });
});
