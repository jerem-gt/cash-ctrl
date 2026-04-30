import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ScheduledPage from '@/pages/ScheduledPage.tsx';
import { SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

describe('ScheduledPage', () => {
  it('affiche le titre', () => {
    renderWithProviders(<ScheduledPage />);
    expect(screen.getByText('Transactions planifiées')).toBeInTheDocument();
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

  it('affiche "Aucune planification" quand la liste est vide', async () => {
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

  it('affiche le badge "Suspendu" pour une planification inactive', async () => {
    server.use(
      http.get('/api/scheduled', () => HttpResponse.json([{ ...SCHEDULED[0], active: 0 }])),
    );
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText('Suspendu')).toBeInTheDocument();
  });

  it('affiche le badge "Transfert" pour un virement planifié', async () => {
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
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(screen.getByText('Supprimer la planification')).toBeInTheDocument();
  });

  it("confirme la suppression d'une planification", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: '×' }));
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
    await user.click(enregistrerBtns[enregistrerBtns.length - 1]);
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
    await user.click(btns[btns.length - 1]);
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
    await user.click(screen.getByRole('button', { name: '×' }));
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
    await user.click(screen.getByRole('button', { name: '×' }));
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
    await user.click(btns[btns.length - 1]);
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
});
