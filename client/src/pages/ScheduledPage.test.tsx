import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { ScheduledPage } from './ScheduledPage';

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
    await screen.findByText('Aucune planification.');
  });

  it('ouvre le modal de création au clic', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    await screen.findByText('Nouvelle planification');
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
    await screen.findByText('Suspendu');
  });

  it('affiche le badge "Transfert" pour un virement planifié', async () => {
    server.use(
      http.get('/api/scheduled', () =>
        HttpResponse.json([{ ...SCHEDULED[0], payment_method: 'Transfert', to_account_id: 2 }]),
      ),
    );
    renderWithProviders(<ScheduledPage />);
    await screen.findByText(/↔ Transfert/);
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
    await screen.findByText('Modifier la planification');
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
});
