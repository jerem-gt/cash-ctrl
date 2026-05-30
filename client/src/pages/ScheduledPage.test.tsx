import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ScheduledPage from '@/pages/ScheduledPage.tsx';
import { SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

describe('ScheduledPage', () => {
  it('affiche le squelette pendant le chargement des planifications', () => {
    server.use(http.get('/api/scheduled', () => new Promise<never>(() => {})));
    renderWithProviders(<ScheduledPage />);
    expect(screen.queryByText('Loyer')).not.toBeInTheDocument();
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument();
  });

  it('affiche le titre', () => {
    renderWithProviders(<ScheduledPage />);
    expect(screen.getByText('Planifications')).toBeInTheDocument();
  });

  it("affiche le paramètre de délai d'anticipation", async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText("Délai d'anticipation");
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('affiche la planification chargée', async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    expect(screen.getByText('Loyer')).toBeInTheDocument();
  });

  it('affiche le label de récurrence mensuelle', async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    expect(screen.getByText(/chaque mois/i)).toBeInTheDocument();
  });

  it(`affiche "Aucune planification" quand la liste est vide`, async () => {
    server.use(http.get('/api/scheduled', () => HttpResponse.json([])));
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText('Aucune planification.')).toBeInTheDocument();
  });

  it('ouvre le modal de création au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    expect(await screen.findByText('Nouvelle planification')).toBeInTheDocument();
  });

  // ─── recurrenceLabel branches ──────────────────────────────────────────────

  it('affiche le label pour récurrence journalière (n=1)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], recurrence_unit: 'day', recurrence_interval: 1 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/chaque jour/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence journalière (n>1)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], recurrence_unit: 'day', recurrence_interval: 3 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/tous les 3 jours/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence hebdomadaire (n=1)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], recurrence_unit: 'week', recurrence_interval: 1 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/chaque semaine/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence hebdomadaire (n>1)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], recurrence_unit: 'week', recurrence_interval: 2 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/toutes les 2 semaines/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence annuelle (n=1, sans jour/mois)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          {
            ...SCHEDULED[0],
            recurrence_unit: 'year',
            recurrence_interval: 1,
            recurrence_day: null,
            recurrence_month: null,
          },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/chaque ann/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence annuelle avec jour et mois', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          {
            ...SCHEDULED[0],
            recurrence_unit: 'year',
            recurrence_interval: 1,
            recurrence_day: 15,
            recurrence_month: 6,
          },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/15 juin/i)).toBeInTheDocument();
  });

  it('affiche le label pour récurrence annuelle (n>1)', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          {
            ...SCHEDULED[0],
            recurrence_unit: 'year',
            recurrence_interval: 2,
            recurrence_day: null,
            recurrence_month: null,
          },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/tous les 2 ans/i)).toBeInTheDocument();
  });

  // ─── ScheduledRow badges ───────────────────────────────────────────────────

  it(`affiche le badge "Suspendu" pour une planification inactive`, async () => {
    server.use(
      http.get('/api/scheduled', () => HttpResponse.json([{ ...SCHEDULED[0], active: 0 }])),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText('Suspendu')).toBeInTheDocument();
  });

  it(`affiche le badge "Transfert" pour un virement planifié`, async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], payment_method: 'Transfert', to_account_id: 2 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/↔ Transfert/)).toBeInTheDocument();
  });

  // ─── Interactions ──────────────────────────────────────────────────────────

  it("sauvegarde le délai d'anticipation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText("Délai d'anticipation");
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '14');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it("ouvre le modal d'édition au clic sur Modifier", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    expect(await screen.findByText('Modifier la planification')).toBeInTheDocument();
  });

  it('ouvre la confirmation de suppression au clic sur ×', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByText('Supprimer la planification')).toBeInTheDocument();
  });

  it("confirme la suppression d'une planification", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimée'),
    );
  });

  it("soumet le formulaire d'édition d'une planification", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Modifier la planification');
    const enregistrerBtns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(enregistrerBtns.at(-1)!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  // ─── handleUpdate / handleDelete / handleSaveLeadDays onError ─────────────

  it('toast si la mise à jour échoue', async () => {
    server.use(
      http.put('/api/scheduled/:id', () =>
        HttpResponse.json({ error: 'Erreur mise à jour' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Modifier la planification');
    const btns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(btns.at(-1)!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur mise à jour'),
    );
  });

  it('toast si la suppression échoue', async () => {
    server.use(
      http.delete('/api/scheduled/:id', () =>
        HttpResponse.json({ error: 'Erreur suppression' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur suppression'),
    );
  });

  it("toast si la sauvegarde du délai d'anticipation échoue", async () => {
    server.use(
      http.put('/api/settings', () =>
        HttpResponse.json({ error: 'Erreur paramètre' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText("Délai d'anticipation");
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur paramètre'),
    );
  });

  it("toast si le délai d'anticipation est invalide (> 365)", async () => {
    renderWithProviders(<ScheduledPage />);
    await screen.findByText("Délai d'anticipation");
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('0 et 365'),
    );
  });

  // ─── ScheduledModal : helper set + onCancel ────────────────────────────────

  it('ScheduledModal : modifie des champs et annule (edit)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Modifier la planification');
    // notes → couvre set + (e) => set('notes', ...)
    await user.type(screen.getByPlaceholderText('Informations complémentaires…'), 'Note test');
    // weekend_handling radio → couvre (e) => set('weekend_handling', v)
    await user.click(screen.getByLabelText('Décaler au vendredi'));
    // active checkbox → couvre (e) => set('active', ...)
    await user.click(screen.getByRole('checkbox'));
    // Annuler → couvre onCancel edit () => setEditTarget(null)
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Modifier la planification')).not.toBeInTheDocument();
  });

  it('ferme le modal de création au clic sur Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Nouvelle planification')).not.toBeInTheDocument();
  });

  it('ferme la confirmation de suppression au clic sur Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByText('Supprimer la planification')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByText('Supprimer la planification')).not.toBeInTheDocument();
  });

  // ─── handleSubmit validation ───────────────────────────────────────────────

  it('ScheduledModal : toast si les champs obligatoires sont manquants', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    // Soumettre sans remplir amount / description / payment_method
    const btns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(btns.at(-1)!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('obligatoires'),
    );
  });

  it('ScheduledModal : toast si le montant est nul (via modal édition)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Modifier' }));
    await screen.findByText('Modifier la planification');
    const amountInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.submit(amountInput.closest('form')!);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('positif'));
  });

  // ─── ScheduledRow : branches end_date et toAccount ────────────────────────

  it('ScheduledRow : affiche la date de fin', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], end_date: '2026-12-31' }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/jusqu'au 2026-12-31/)).toBeInTheDocument();
  });

  it('ScheduledRow : affiche le compte destination pour un transfert connu', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], payment_method: 'Transfert', to_account_id: 2 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText(/→ Livret A/)).toBeInTheDocument();
  });

  // ─── Section "Suspendus" ───────────────────────────────────────────────────

  it("affiche le bouton 'Suspendus (N)' quand il y a des planifications actives ET suspendues", async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          { ...SCHEDULED[0], id: 1, active: 1, description: 'Loyer actif' },
          { ...SCHEDULED[0], id: 2, active: 0, description: 'Abonnement suspendu' },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText('Loyer actif')).toBeInTheDocument();
    expect(screen.getByText('Suspendus (1)')).toBeInTheDocument();
    expect(screen.queryByText('Abonnement suspendu')).not.toBeInTheDocument();
  });

  it("clique sur 'Suspendus' affiche puis masque les planifications suspendues", async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          { ...SCHEDULED[0], id: 1, active: 1, description: 'Loyer actif' },
          { ...SCHEDULED[0], id: 2, active: 0, description: 'Abonnement suspendu' },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer actif');

    // Ouvrir la section suspendus
    await user.click(screen.getByText('Suspendus (1)'));
    expect(screen.getByText('Abonnement suspendu')).toBeInTheDocument();

    // Refermer
    await user.click(screen.getByText('Suspendus (1)'));
    expect(screen.queryByText('Abonnement suspendu')).not.toBeInTheDocument();
  });

  it('supprime depuis une ligne suspendue', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          { ...SCHEDULED[0], id: 1, active: 1, description: 'Loyer actif' },
          { ...SCHEDULED[0], id: 2, active: 0, description: 'Abonnement suspendu' },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer actif');
    await user.click(screen.getByText('Suspendus (1)'));
    await screen.findByText('Abonnement suspendu');
    const supprimerBtns = screen.getAllByRole('button', { name: 'Supprimer' });
    await user.click(supprimerBtns.at(-1)!);
    expect(screen.getByText('Supprimer la planification')).toBeInTheDocument();
  });

  it("ouvre l'édition depuis une ligne suspendue", async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([
          { ...SCHEDULED[0], id: 1, active: 1, description: 'Loyer actif' },
          { ...SCHEDULED[0], id: 2, active: 0, description: 'Abonnement suspendu' },
        ]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer actif');
    await user.click(screen.getByText('Suspendus (1)'));
    await screen.findByText('Abonnement suspendu');
    const modifierBtns = screen.getAllByRole('button', { name: 'Modifier' });
    await user.click(modifierBtns.at(-1)!);
    expect(await screen.findByText('Modifier la planification')).toBeInTheDocument();
  });

  // ─── handleCreate error ────────────────────────────────────────────────────

  it('crée une planification avec succès et ferme le modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Abonnement Netflix');
    await user.type(screen.getByPlaceholderText('0,00'), '15');
    const accountTrigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(accountTrigger);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    const btns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(btns.at(-1)!);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('créée'));
    expect(screen.queryByText('Nouvelle planification')).not.toBeInTheDocument();
  });

  it("toast si la création d'une planification échoue", async () => {
    server.use(
      http.post('/api/scheduled', () =>
        HttpResponse.json({ error: 'Erreur création' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    // Remplir les champs obligatoires : description + montant + compte
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Test');
    await user.type(screen.getByPlaceholderText('0,00'), '100');
    // Sélectionner le compte source via AccountSelect
    const accountTrigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(accountTrigger);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    const btns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(btns.at(-1)!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur création'),
    );
  });

  // ─── Validation modes Transfert / Versement ───────────────────────────────

  it('ScheduledModal : passe en mode Transfert au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByText('Compte destination')).toBeInTheDocument();
  });

  it('ScheduledModal : passe en mode Versement AV/PER au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));
    expect(screen.getByText('Compte AV / PER')).toBeInTheDocument();
  });

  it('ScheduledModal : toast si pas de compte sélectionné en mode transaction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    // Remplir montant + description mais PAS le compte
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Test');
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('compte'));
  });

  it('ScheduledModal : toast si les comptes transfert sont manquants', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    // En mode Transfert, la description a un placeholder dynamique "→ …"
    await user.type(screen.getByPlaceholderText(/→/), 'Virement test');
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toMatch(/source|destination|compte/i),
    );
  });

  it('ScheduledModal : sélectionne un compte AV et un compte source en mode Versement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));

    // Sélectionner un compte AV/PER (couvre handleAvAccountChange)
    await user.click(document.getElementById('versement-av-account')!);
    await user.click(await screen.findByRole('option', { name: /Suravenir/i }));

    // Sélectionner un compte source (couvre onChange to_account_id)
    await user.click(document.getElementById('versement-source-account')!);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));

    // Modifier les frais (couvre onChange insurance_fees)
    const allAmounts = screen.getAllByPlaceholderText('0,00');
    await user.type(allAmounts[1], '5'); // frais = index 1
    expect(allAmounts[1]).toBeInTheDocument();
  });

  it('ScheduledModal : toast si les champs versement sont manquants', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));
    // En mode versement il y a 2 champs "0,00" (montant + frais) — prendre le premier
    const amountInputs = screen.getAllByPlaceholderText('0,00');
    await user.type(amountInputs[0], '50');
    await user.type(screen.getByPlaceholderText('Auto-généré à la sélection du support'), 'Test');
    fireEvent.submit(amountInputs[0].closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toMatch(/AV\/PER|support|source/i),
    );
  });

  // ─── Badge transaction_count & modale transactions ─────────────────────────

  it('affiche le badge "N tx" quand transaction_count > 0', async () => {
    renderWithProviders(<ScheduledPage />);
    // SCHEDULED[0].transaction_count === 3
    expect(await screen.findByRole('button', { name: '3 tx' })).toBeInTheDocument();
  });

  it("n'affiche pas le badge tx quand transaction_count === 0", async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], transaction_count: 0 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    expect(screen.queryByRole('button', { name: /tx$/ })).not.toBeInTheDocument();
  });

  it('ouvre la modale des transactions au clic sur le badge', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    expect(await screen.findByText('Transactions liées à cette planification')).toBeInTheDocument();
  });

  it('affiche les transactions de la planification dans la modale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    // Le handler MSW retourne TRANSACTIONS qui contient "Courses"
    expect(await screen.findByText('Courses')).toBeInTheDocument();
  });

  it('affiche "Aucune transaction liée" quand le filtre ne retourne rien', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    expect(await screen.findByText('Aucune transaction liée.')).toBeInTheDocument();
  });

  it('ferme la modale des transactions au clic sur Fermer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    await screen.findByText('Transactions liées à cette planification');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Transactions liées à cette planification'),
      ).not.toBeInTheDocument(),
    );
  });

  it('ferme la modale des transactions au clic sur Fermer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    await screen.findByText('Transactions liées à cette planification');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Transactions liées à cette planification'),
      ).not.toBeInTheDocument(),
    );
  });
});
