import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import ScheduledPage from '@/pages/ScheduledPage.tsx';
import { CATEGORIES, PAYMENT_METHODS, SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

describe('ScheduledPage', () => {
  it('affiche le titre, la planification chargée et le paramètre de délai', async () => {
    renderWithProviders(<ScheduledPage />);
    expect(screen.getByText('Planifications')).toBeInTheDocument();
    expect(await screen.findByText("Délai d'anticipation")).toBeInTheDocument();
    expect(await screen.findByText('Loyer')).toBeInTheDocument();
  });

  it(`affiche "Aucune planification" quand la liste est vide`, async () => {
    server.use(http.get('/api/scheduled', () => HttpResponse.json([])));
    renderWithProviders(<ScheduledPage />);
    expect(await screen.findByText('Aucune planification.')).toBeInTheDocument();
  });

  // ─── Délai d'anticipation ────────────────────────────────────────────────

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

  // ─── Création (intégration page → modal → API) ──────────────────────────

  it('ouvre le modal de création et le ferme via Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: /nouvelle/i }));
    expect(await screen.findByText('Nouvelle planification')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Nouvelle planification')).not.toBeInTheDocument();
  });

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
    await user.selectOptions(document.getElementById('category-select')!, String(CATEGORIES[0].id));
    await user.selectOptions(
      document.getElementById('subcategory-select')!,
      String(CATEGORIES[0].subcategories[0].id),
    );
    await user.selectOptions(
      document.getElementById('payment-method-select')!,
      String(PAYMENT_METHODS[0].id),
    );
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
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Test');
    await user.type(screen.getByPlaceholderText('0,00'), '100');
    const accountTrigger = screen.getByRole('button', { name: /choisir/i });
    await user.click(accountTrigger);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    await user.selectOptions(document.getElementById('category-select')!, String(CATEGORIES[0].id));
    await user.selectOptions(
      document.getElementById('subcategory-select')!,
      String(CATEGORIES[0].subcategories[0].id),
    );
    await user.selectOptions(
      document.getElementById('payment-method-select')!,
      String(PAYMENT_METHODS[0].id),
    );
    const btns = screen.getAllByRole('button', { name: 'Enregistrer' });
    await user.click(btns.at(-1)!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur création'),
    );
  });

  // ─── Édition (intégration page → modal → API) ───────────────────────────

  it("soumet le formulaire d'édition et affiche un toast", async () => {
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

  // ─── Suppression (intégration page → confirmation → API) ────────────────

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

  it('ferme la confirmation de suppression au clic sur Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await screen.findByText('Loyer');
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(screen.getByText('Supprimer la planification')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByText('Supprimer la planification')).not.toBeInTheDocument();
  });

  // ─── Section "Suspendus" (logique propre à la page) ─────────────────────

  it(`affiche le bouton "Suspendus (N)" quand des planifications actives ET suspendues coexistent`, async () => {
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

  it(`clique sur "Suspendus" affiche puis masque les planifications suspendues`, async () => {
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
    expect(screen.getByText('Abonnement suspendu')).toBeInTheDocument();

    await user.click(screen.getByText('Suspendus (1)'));
    expect(screen.queryByText('Abonnement suspendu')).not.toBeInTheDocument();
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

  // ─── Modale transactions liées (intégration page → ScheduledTxModal) ────

  it('ouvre la modale des transactions liées au clic sur le badge tx', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduledPage />);
    await user.click(await screen.findByRole('button', { name: '3 tx' }));
    expect(await screen.findByText('Transactions liées à cette planification')).toBeInTheDocument();
  });
});
