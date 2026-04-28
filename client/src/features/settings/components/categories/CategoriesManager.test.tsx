import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';

import { CategoriesManager } from '@/features/settings';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

describe('CategoriesManager', () => {
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
