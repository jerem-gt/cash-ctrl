import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { AccountTypesManager } from './AccountTypesManager';

describe('AccountTypesManager', () => {
  it('affiche le squelette pendant le chargement des types de compte', () => {
    server.use(http.get('/api/account-types', () => new Promise<never>(() => {})));
    renderWithProviders(<AccountTypesManager />);
    expect(screen.queryByText('Courant')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche la section', async () => {
    renderWithProviders(<AccountTypesManager />);
    expect(await screen.findByText('Types de compte')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un type de compte avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("soumet le formulaire d'édition d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    const courantCard = screen.getByRole('article', { name: 'Courant' });
    await user.click(within(courantCard).getByRole('button', { name: /modifier/i }));
    const nameInput = within(courantCard).getByDisplayValue('Courant');
    await user.clear(nameInput);
    await user.type(nameInput, 'Courant modifié');
    await user.click(within(courantCard).getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("annule l'édition d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    const courantCard = screen.getByRole('article', { name: 'Courant' });
    await user.click(within(courantCard).getByRole('button', { name: /modifier/i }));
    await user.click(within(courantCard).getByRole('button', { name: /annuler/i }));
    expect(
      within(courantCard).queryByRole('button', { name: /enregistrer/i }),
    ).not.toBeInTheDocument();
    expect(within(courantCard).getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/account-types/:id', () =>
        HttpResponse.json({ error: 'Erreur type' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    const courantCard = screen.getByRole('article', { name: 'Courant' });
    await user.click(within(courantCard).getByRole('button', { name: /modifier/i }));
    await user.click(within(courantCard).getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur type'),
    );
  });

  it("toast si l'ajout d'un type de compte échoue", async () => {
    server.use(
      http.post('/api/account-types', () =>
        HttpResponse.json({ error: 'Erreur ajout type' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesManager />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout type'),
    );
  });
});
