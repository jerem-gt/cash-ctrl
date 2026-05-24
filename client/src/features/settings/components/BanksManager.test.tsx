import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { BANKS } from '@/tests/fixtures.ts';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { BanksManager } from './BanksManager';

describe('BanksManager', () => {
  it('affiche le squelette pendant le chargement des banques', () => {
    server.use(http.get('/api/banks', () => new Promise<never>(() => {})));
    renderWithProviders(<BanksManager />);
    expect(screen.queryByText('BNP')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
  });

  it('affiche la section', async () => {
    renderWithProviders(<BanksManager />);
    expect(await screen.findByText('Banques')).toBeInTheDocument();
  });

  it('affiche les banques chargées', async () => {
    renderWithProviders(<BanksManager />);
    expect(await screen.findByText('BNP')).toBeInTheDocument();
  });

  it("toast si nom vide lors de l'ajout d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute une banque avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.type(screen.getByPlaceholderText('Nom (ex : Fortuneo)'), 'Fortuneo');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajoutée'));
  });

  it('sélectionne une banque et passe en mode édition', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("annule l'édition d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  it('ouvre la confirmation de suppression', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /supprimer/i }));
    expect(screen.getByText('Supprimer la banque')).toBeInTheDocument();
  });

  it("confirme la suppression d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /supprimer/i }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("annule la suppression d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /supprimer/i }));
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByText('Supprimer la banque')).not.toBeInTheDocument();
  });

  it("soumet le formulaire d'édition d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const nameInput = screen.getByPlaceholderText('Nom');
    await user.clear(nameInput);
    await user.type(nameInput, 'BNP Paribas');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  it('pas de bouton Supprimer dans le panneau quand acc_count > 0', async () => {
    server.use(http.get('/api/banks', () => HttpResponse.json([{ ...BANKS[0], acc_count: 2 }])));
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: /BNP/ }));
    expect(screen.queryByRole('button', { name: /supprimer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifier/i })).toBeInTheDocument();
  });

  // ─── BankDetails — gestion de fichier logo ─────────────────────────────────

  describe('BankDetails — gestion de fichier logo', () => {
    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('sélectionne un fichier et affiche son nom', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BanksManager />);
      await screen.findByText('BNP');
      await user.click(screen.getByRole('button', { name: 'BNP' }));
      await user.click(screen.getByRole('button', { name: /modifier/i }));
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['logo'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fireEvent.change(fileInput);
      expect(screen.getByText('logo.png')).toBeInTheDocument();
    });

    it('soumet le formulaire avec un logo uploadé', async () => {
      server.use(http.post('/api/banks/:id/logo', () => HttpResponse.json(BANKS[0])));
      const user = userEvent.setup();
      renderWithProviders(<BanksManager />);
      await screen.findByText('BNP');
      await user.click(screen.getByRole('button', { name: 'BNP' }));
      await user.click(screen.getByRole('button', { name: /modifier/i }));
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [new File(['logo'], 'logo.png', { type: 'image/png' })],
        configurable: true,
      });
      fireEvent.change(fileInput);
      await user.click(screen.getByRole('button', { name: /enregistrer/i }));
      await waitFor(() =>
        expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
      );
    });
  });

  it('toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/banks/:id', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur serveur'),
    );
  });

  it("toast si la suppression d'une banque échoue", async () => {
    server.use(
      http.delete('/api/banks/:id', () =>
        HttpResponse.json({ error: 'Suppression impossible' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.click(screen.getByRole('button', { name: 'BNP' }));
    await user.click(screen.getByRole('button', { name: /supprimer/i }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Suppression impossible'),
    );
  });

  it("toast si l'ajout d'une banque échoue", async () => {
    server.use(
      http.post('/api/banks', () =>
        HttpResponse.json({ error: 'Erreur ajout banque' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await user.type(screen.getByPlaceholderText('Nom (ex : Fortuneo)'), 'Fortuneo');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout banque'),
    );
  });

  // ─── Drag-and-drop ─────────────────────────────────────────────────────────

  it('affiche une poignée de déplacement pour chaque banque', async () => {
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    expect(document.querySelectorAll('[aria-roledescription="sortable"]')).toHaveLength(1);
  });

  it('affiche deux poignées de déplacement pour deux banques', async () => {
    server.use(
      http.get('/api/banks', () =>
        HttpResponse.json([
          { ...BANKS[0], id: 1, sort_order: 0 },
          { id: 2, name: 'Société Générale', logo: null, domain: null, sort_order: 1 },
        ]),
      ),
    );
    renderWithProviders(<BanksManager />);
    await screen.findByText('BNP');
    await screen.findByText('Société Générale');
    expect(document.querySelectorAll('[aria-roledescription="sortable"]')).toHaveLength(2);
  });
});
