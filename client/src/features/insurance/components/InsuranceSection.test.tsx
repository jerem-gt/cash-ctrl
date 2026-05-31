import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { InsuranceSection } from '@/features/insurance/components/InsuranceSection';
import { INSURANCE_OPERATIONS, INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';
import type { InsuranceOperation } from '@/types';

function renderSection(accountId = 10, isPer = false) {
  return renderWithProviders(<InsuranceSection accountId={accountId} isPer={isPer} />);
}

describe('InsuranceSection', () => {
  it('affiche les supports après chargement', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByText('Amundi MSCI World').length).toBeGreaterThan(0);
  });

  it('affiche le badge Euro pour un fonds euro', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByText('Euro').length).toBeGreaterThan(0);
  });

  it('affiche le badge UC pour une UC', async () => {
    renderSection();
    await screen.findAllByText('Amundi MSCI World');
    expect(screen.getAllByText('UC').length).toBeGreaterThan(0);
  });

  it('affiche la valeur pour un support', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByText(/5\s*000/).length).toBeGreaterThan(0);
  });

  it(`affiche "Aucun support" quand portefeuille vide`, async () => {
    server.use(http.get('/api/insurance/:accountId/positions', () => HttpResponse.json([])));
    renderSection();
    await waitFor(() =>
      expect(
        screen.getByText(/Aucun support — ajoutez un fonds euro ou une UC/i),
      ).toBeInTheDocument(),
    );
  });

  it("n'affiche pas le bouton Actualiser les VL", async () => {
    renderSection();
    await screen.findAllByText('Amundi MSCI World');
    expect(screen.queryByRole('button', { name: /actualiser les vl/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton Revaloriser uniquement pour les UC', async () => {
    renderSection();
    await screen.findAllByText('Amundi MSCI World');
    expect(screen.getAllByRole('button', { name: /revaloriser/i }).length).toBeGreaterThan(0);
  });

  it('ouvre le modal Verser au clic sur Verser', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const versBtn = screen.getAllByRole('button', { name: /verser/i })[0];
    await user.click(versBtn);
    expect(screen.getByText(/Versement — Fonds Euro Sécurité/i)).toBeInTheDocument();
  });

  it('ouvre le modal Racheter au clic sur Racheter', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const rachatBtn = screen.getAllByRole('button', { name: /racheter/i })[0];
    await user.click(rachatBtn);
    expect(screen.getByText(/Rachat — Fonds Euro Sécurité/i)).toBeInTheDocument();
  });

  it('ouvre le modal Arbitrer au clic sur Arbitrer', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const arbitreBtn = screen.getAllByRole('button', { name: /arbitrer/i })[0];
    await user.click(arbitreBtn);
    expect(screen.getByText(/Arbitrage depuis/i)).toBeInTheDocument();
  });

  it('affiche le bouton Intérêts uniquement pour les fonds euro', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByRole('button', { name: /intérêts/i }).length).toBeGreaterThan(0);
  });

  it('ouvre le modal Revaloriser pour une UC', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Amundi MSCI World');
    await user.click(screen.getAllByRole('button', { name: /revaloriser/i })[0]);
    expect(screen.getByText(/Revalorisation — Amundi MSCI World/i)).toBeInTheDocument();
  });

  it('ouvre le modal Ajouter un support', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getByRole('button', { name: /\+ support/i }));
    expect(screen.getByText('Ajouter un support')).toBeInTheDocument();
  });

  it('affiche la ligne Total quand plusieurs supports', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await screen.findAllByText('Amundi MSCI World');
    expect(screen.getByText('Total enveloppe')).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Simulateur fiscal pour une Assurance Vie (isPer=false)", async () => {
    renderSection(10, false);
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.queryByRole('button', { name: /simulateur fiscal/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton Simulateur fiscal pour un PER (isPer=true)', async () => {
    renderSection(10, true);
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByRole('button', { name: /simulateur fiscal/i })).toBeInTheDocument();
  });

  it('ouvre la modale simulateur au clic sur Simulateur fiscal', async () => {
    const user = userEvent.setup();
    renderSection(10, true);
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getByRole('button', { name: /simulateur fiscal/i }));
    expect(screen.getByText('Simulateur fiscal PER')).toBeInTheDocument();
  });

  it('supprime un support et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const deleteButtons = screen.getAllByTitle('Supprimer le support');
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Support supprimé'),
    );
  });

  it("n'affiche pas le bouton Intérêts pour les UC", async () => {
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([INSURANCE_POSITIONS[1]]),
      ),
    );
    renderSection();
    await screen.findAllByText('Amundi MSCI World');
    expect(screen.queryByRole('button', { name: /intérêts/i })).not.toBeInTheDocument();
  });

  it("affiche l'indicateur planifié pour les opérations issues d'une planification", async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByTitle('Transaction planifiée')).toBeInTheDocument();
  });

  it("n'affiche pas l'indicateur planifié pour les opérations saisies manuellement", async () => {
    server.use(
      http.get('/api/insurance/:accountId/operations', () =>
        HttpResponse.json([{ ...INSURANCE_OPERATIONS[0], from_scheduled: false }]),
      ),
    );
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.queryByTitle('Transaction planifiée')).not.toBeInTheDocument();
  });

  it("affiche un bouton Modifier pour chaque opération de l'historique", async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByTitle('Modifier').length).toBeGreaterThan(0);
  });

  it("ouvre la modale d'édition au clic sur le bouton Modifier d'une opération", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getAllByTitle('Modifier')[0]);
    expect(screen.getByText("Modifier l'opération")).toBeInTheDocument();
  });

  // ─── Historique « Afficher plus » ─────────────────────────────────────────

  function makeOperations(count: number): InsuranceOperation[] {
    return Array.from({ length: count }, (_, i) => ({
      ...INSURANCE_OPERATIONS[0],
      id: 1000 + i,
      transaction_id: 2000 + i,
      from_scheduled: false,
    }));
  }

  it("n'affiche pas le bouton Afficher plus quand 10 opérations ou moins", async () => {
    server.use(
      http.get('/api/insurance/:accountId/operations', () => HttpResponse.json(makeOperations(10))),
    );
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.queryByRole('button', { name: /afficher plus/i })).not.toBeInTheDocument();
  });

  it("limite l'historique à 10 opérations et affiche le bouton Afficher plus", async () => {
    server.use(
      http.get('/api/insurance/:accountId/operations', () => HttpResponse.json(makeOperations(13))),
    );
    renderSection();
    await screen.findByRole('button', { name: /afficher plus \(3\)/i });
    expect(screen.getAllByTitle('Modifier')).toHaveLength(10);
  });

  it('affiche le lot suivant au clic sur Afficher plus', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/insurance/:accountId/operations', () => HttpResponse.json(makeOperations(13))),
    );
    renderSection();
    await user.click(await screen.findByRole('button', { name: /afficher plus \(3\)/i }));
    expect(screen.getAllByTitle('Modifier')).toHaveLength(13);
    expect(screen.queryByRole('button', { name: /afficher plus/i })).not.toBeInTheDocument();
  });

  // ─── Supports soldés (section repliée) ────────────────────────────────────

  it("n'affiche pas le bouton Supports soldés quand tous les supports ont une valeur non nulle", async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.queryByText(/supports soldés/i)).not.toBeInTheDocument();
  });

  it('affiche le bouton Supports soldés quand un support est à 0€', async () => {
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([
          ...INSURANCE_POSITIONS,
          { id: 3, account_id: 10, name: 'UC Soldée', type: 'uc', ticker: null, value: 0 },
        ]),
      ),
    );
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByText(/supports soldés \(1\)/i)).toBeInTheDocument();
  });

  it('cache les supports à 0€ par défaut quand des supports actifs existent', async () => {
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([
          ...INSURANCE_POSITIONS,
          { id: 3, account_id: 10, name: 'UC Soldée', type: 'uc', ticker: null, value: 0 },
        ]),
      ),
    );
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.queryByText('UC Soldée')).not.toBeInTheDocument();
  });

  it('affiche les supports à 0€ après clic sur le bouton Supports soldés', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([
          ...INSURANCE_POSITIONS,
          { id: 3, account_id: 10, name: 'UC Soldée', type: 'uc', ticker: null, value: 0 },
        ]),
      ),
    );
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getByText(/supports soldés \(1\)/i));
    expect(screen.getAllByText('UC Soldée').length).toBeGreaterThan(0);
  });

  it('affiche tous les supports sans toggle quand tous sont à 0€', async () => {
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([
          { id: 1, account_id: 10, name: 'Euro Soldé', type: 'euro', ticker: null, value: 0 },
          { id: 2, account_id: 10, name: 'UC Soldée', type: 'uc', ticker: null, value: 0 },
        ]),
      ),
    );
    renderSection();
    await screen.findAllByText('Euro Soldé');
    expect(screen.getAllByText('UC Soldée').length).toBeGreaterThan(0);
    expect(screen.queryByText(/supports soldés/i)).not.toBeInTheDocument();
  });
});
