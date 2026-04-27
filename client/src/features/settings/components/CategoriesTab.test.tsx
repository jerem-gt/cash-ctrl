import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { CategoriesTab } from '@/features/settings';
import { CATEGORIES } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

describe('CategoriesTab', () => {
  it('affiche la section', async () => {
    renderWithProviders(<CategoriesTab />);
    expect(await screen.findByText('Catégories')).toBeInTheDocument();
  });

  it('affiche les catégories chargées', async () => {
    renderWithProviders(<CategoriesTab />);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'une catégorie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute une catégorie avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText('Nom de la catégorie'), 'Loisirs');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajoutée'));
  });

  it('passe en mode édition pour une catégorie (tx_count=0)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    const modifyBtn = screen.getByRole('button', { name: /modifier/i });
    await user.click(modifyBtn);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it("soumet le formulaire d'édition d'une catégorie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const nameInput = screen.getByDisplayValue('Alimentation');
    await user.clear(nameInput);
    await user.type(nameInput, 'Nourriture');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  it("annule l'édition d'une catégorie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
  });

  it('CategoryRow : affiche le bouton Modifier seul et ouvre le formulaire quand tx_count > 0', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([{ ...CATEGORIES[0], tx_count: 3 }])),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('CategoryRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/categories/:id', () =>
        HttpResponse.json({ error: 'Erreur catégorie' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur catégorie'),
    );
  });

  it("toast si l'ajout d'une catégorie échoue", async () => {
    server.use(
      http.post('/api/categories', () =>
        HttpResponse.json({ error: 'Erreur ajout cat' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<CategoriesTab />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText('Nom de la catégorie'), 'Loisirs');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout cat'),
    );
  });
});
