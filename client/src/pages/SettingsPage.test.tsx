import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BANKS, CATEGORIES, PAYMENT_METHODS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  it('affiche le titre et les sections', async () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
    await screen.findByText('Banques');
    expect(screen.getByText('Types de compte')).toBeInTheDocument();
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
    expect(screen.getByText('Catégories')).toBeInTheDocument();
    expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
  });

  it('affiche les banques chargées', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('BNP')).toBeInTheDocument();
  });

  it('affiche les catégories chargées', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
  });

  it('affiche les moyens de paiement chargés', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('CB')).toBeInTheDocument();
  });

  it('affiche une erreur toast si les mots de passe ne correspondent pas', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'newpass1');
    await user.type(passwordInputs[2], 'different');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('ne correspondent pas'),
    );
  });

  it('affiche une erreur toast si le nouveau mot de passe est trop court', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'court');
    await user.type(passwordInputs[2], 'court');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('8 caractères'),
    );
  });

  it("toast si nom vide lors de l'ajout d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    // Premier bouton "Ajouter" = banques
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[0]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute une banque avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.type(screen.getByPlaceholderText('Ex : Fortuneo'), 'Fortuneo');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[0]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajoutée'));
  });

  it("toast si nom vide lors de l'ajout d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[1]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un type de compte avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[1]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("toast si nom vide lors de l'ajout d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[2]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute un moyen de paiement avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[2]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajouté'));
  });

  it("toast si nom vide lors de l'ajout d'une catégorie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[3]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('nom'));
  });

  it('ajoute une catégorie avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText('Ex : Vacances'), 'Loisirs');
    const addBtns = screen.getAllByRole('button', { name: /ajouter/i });
    await user.click(addBtns[3]);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('ajoutée'));
  });

  it('passe en mode édition au clic sur Modifier (banque)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    // Les boutons "Modifier" sont opacity-0 mais accessibles
    const modifyBtns = screen.getAllByRole('button', { name: /modifier/i });
    await user.click(modifyBtns[0]);
    // Le formulaire d'édition apparaît avec un bouton OK
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it("annule l'édition d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    const modifyBtns = screen.getAllByRole('button', { name: /modifier/i });
    await user.click(modifyBtns[0]);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('BNP')).toBeInTheDocument();
  });

  it('ouvre la confirmation de suppression', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    // BNP a acc_count=undefined → 0 → bouton × visible dans RowActions
    const deleteBtn = screen.getAllByRole('button', { name: '×' })[0];
    await user.click(deleteBtn);
    expect(screen.getByText('Supprimer la banque')).toBeInTheDocument();
  });

  it("confirme la suppression d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    const deleteBtn = screen.getAllByRole('button', { name: '×' })[0];
    await user.click(deleteBtn);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("annule la suppression d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    const deleteBtn = screen.getAllByRole('button', { name: '×' })[0];
    await user.click(deleteBtn);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    // La modale est fermée
    expect(screen.queryByText('Supprimer la banque')).not.toBeInTheDocument();
  });

  it('passe en mode édition pour une catégorie (tx_count=0)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    const modifyBtns = screen.getAllByRole('button', { name: /modifier/i });
    // Ordre : [0]=BNP, [1]=Courant, [2]=CB, [3]=Alimentation
    await user.click(modifyBtns[3]);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it("soumet le formulaire d'édition d'une banque", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
    const nameInput = screen.getByPlaceholderText('Nom');
    await user.clear(nameInput);
    await user.type(nameInput, 'BNP Paribas');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  it("soumet le formulaire d'édition d'un type de compte", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[1]);
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
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[1]);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Courant')).toBeInTheDocument();
  });

  it("soumet le formulaire d'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[2]);
    const nameInput = screen.getByDisplayValue('CB');
    await user.clear(nameInput);
    await user.type(nameInput, 'Carte bancaire');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("annule l'édition d'un moyen de paiement", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[2]);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('CB')).toBeInTheDocument();
  });

  it("soumet le formulaire d'édition d'une catégorie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[3]);
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
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[3]);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
  });

  it('met à jour le mot de passe avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpassword');
    await user.type(passwordInputs[1], 'newpassword123');
    await user.type(passwordInputs[2], 'newpassword123');
    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  // ─── Branches acc_count > 0 / tx_count > 0 ────────────────────────────────

  it('BankRow : affiche le bouton Modifier seul et ouvre le formulaire quand acc_count > 0', async () => {
    server.use(http.get('/api/banks', () => HttpResponse.json([{ ...BANKS[0], acc_count: 2 }])));
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('CategoryRow : affiche le bouton Modifier seul et ouvre le formulaire quand tx_count > 0', async () => {
    server.use(
      http.get('/api/categories', () => HttpResponse.json([{ ...CATEGORIES[0], tx_count: 3 }])),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[3]);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('PaymentMethodRow : affiche le bouton Modifier seul et ouvre le formulaire quand tx_count > 0', async () => {
    server.use(
      http.get('/api/payment-methods', () =>
        HttpResponse.json([{ ...PAYMENT_METHODS[0], tx_count: 2 }]),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[2]);
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  // ─── handleFile (BankRow logo) ─────────────────────────────────────────────

  describe('BankRow — gestion de fichier logo', () => {
    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('sélectionne un fichier et affiche son nom', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await screen.findByText('BNP');
      await user.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['logo'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fireEvent.change(fileInput);
      expect(screen.getByText('logo.png')).toBeInTheDocument();
    });

    it('soumet le formulaire avec un logo uploadé', async () => {
      server.use(http.post('/api/banks/:id/logo', () => HttpResponse.json(BANKS[0])));
      const user = userEvent.setup();
      renderWithProviders(<SettingsPage />);
      await screen.findByText('BNP');
      await user.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [new File(['logo'], 'logo.png', { type: 'image/png' })],
        configurable: true,
      });
      fireEvent.change(fileInput);
      await user.click(screen.getByRole('button', { name: 'OK' }));
      await waitFor(() =>
        expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
      );
    });
  });

  // ─── onError des mutations de sauvegarde ──────────────────────────────────

  it('BankRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/banks/:id', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur serveur'),
    );
  });

  it('CategoryRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/categories/:id', () =>
        HttpResponse.json({ error: 'Erreur catégorie' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[3]);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur catégorie'),
    );
  });

  it('AccountTypeRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/account-types/:id', () =>
        HttpResponse.json({ error: 'Erreur type' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[1]);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur type'),
    );
  });

  it('PaymentMethodRow : toast si la sauvegarde échoue', async () => {
    server.use(
      http.put('/api/payment-methods/:id', () =>
        HttpResponse.json({ error: 'Erreur PM' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.click(screen.getAllByRole('button', { name: /modifier/i })[2]);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur PM'),
    );
  });

  // ─── onError des mutations de suppression ─────────────────────────────────

  it("toast si la suppression d'une banque échoue", async () => {
    server.use(
      http.delete('/api/banks/:id', () =>
        HttpResponse.json({ error: 'Suppression impossible' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.click(screen.getAllByRole('button', { name: '×' })[0]);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Suppression impossible'),
    );
  });

  // ─── onError des mutations d'ajout ────────────────────────────────────────

  it("toast si l'ajout d'une banque échoue", async () => {
    server.use(
      http.post('/api/banks', () =>
        HttpResponse.json({ error: 'Erreur ajout banque' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('BNP');
    await user.type(screen.getByPlaceholderText('Ex : Fortuneo'), 'Fortuneo');
    await user.click(screen.getAllByRole('button', { name: /ajouter/i })[0]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout banque'),
    );
  });

  it("toast si l'ajout d'un type de compte échoue", async () => {
    server.use(
      http.post('/api/account-types', () =>
        HttpResponse.json({ error: 'Erreur ajout type' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Courant');
    await user.type(screen.getByPlaceholderText('Ex : PEA'), 'PEA');
    await user.click(screen.getAllByRole('button', { name: /ajouter/i })[1]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout type'),
    );
  });

  it("toast si l'ajout d'un moyen de paiement échoue", async () => {
    server.use(
      http.post('/api/payment-methods', () =>
        HttpResponse.json({ error: 'Erreur ajout PM' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('CB');
    await user.type(screen.getByPlaceholderText('Ex : Espèces'), 'Espèces');
    await user.click(screen.getAllByRole('button', { name: /ajouter/i })[2]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout PM'),
    );
  });

  it("toast si l'ajout d'une catégorie échoue", async () => {
    server.use(
      http.post('/api/categories', () =>
        HttpResponse.json({ error: 'Erreur ajout cat' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Alimentation');
    await user.type(screen.getByPlaceholderText('Ex : Vacances'), 'Loisirs');
    await user.click(screen.getAllByRole('button', { name: /ajouter/i })[3]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur ajout cat'),
    );
  });

  it('toast si le changement de mot de passe échoue', async () => {
    server.use(
      http.post('/api/auth/change-password', () =>
        HttpResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpassword');
    await user.type(passwordInputs[1], 'newpassword123');
    await user.type(passwordInputs[2], 'newpassword123');
    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Mot de passe incorrect'),
    );
  });
});
