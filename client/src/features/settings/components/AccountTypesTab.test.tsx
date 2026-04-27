import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { AccountTypesTab } from '@/features/settings';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

describe('AccountTypesTab', () => {
  it('affiche la section', async () => {
    renderWithProviders(<AccountTypesTab />);
    expect(await screen.findByText('Types de compte')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un type de compte avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    const addBtn = screen.getByRole('button', { name: /ajouter/i });
    await user.click(addBtn);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("soumet le formulaire d'édition d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const nameInput = screen.getByDisplayValue('Courant');
    await user.clear(nameInput);
    await user.type(nameInput, 'Courant modifié');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("annule l'édition d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Courant')).toBeInTheDocument();
  });

  it('AccountTypeRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/account-types/:id', () =>
        HttpResponse.json({ error: 'Erreur type' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
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
    renderWithProviders(<AccountTypesTab />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout type'),
    );
  });
});
