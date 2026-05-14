import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceArbitrageModal } from '@/components/InsuranceArbitrageModal';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const FROM_SUPPORT = INSURANCE_POSITIONS[0]; // Fonds Euro Sécurité, value: 5000
const TO_SUPPORT = INSURANCE_POSITIONS[1]; // Amundi MSCI World
const ACCOUNT_ID = 10;

function renderModal(allSupports = INSURANCE_POSITIONS, onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceArbitrageModal
      accountId={ACCOUNT_ID}
      fromSupport={FROM_SUPPORT}
      allSupports={allSupports}
      onClose={onClose}
    />,
  );
}

describe('InsuranceArbitrageModal', () => {
  it('affiche le titre avec le nom du support source', () => {
    renderModal();
    expect(screen.getByText(`Arbitrage depuis ${FROM_SUPPORT.name}`)).toBeInTheDocument();
  });

  it('affiche le montant max égal à la valeur du support source', () => {
    renderModal();
    expect(screen.getByText(/5\s*000/)).toBeInTheDocument();
  });

  it('affiche le support destination dans le sélecteur', () => {
    renderModal();
    expect(screen.getByText(`${TO_SUPPORT.name} (UC)`)).toBeInTheDocument();
  });

  it('exclut le support source du sélecteur de destination', () => {
    renderModal();
    const options = screen.getAllByRole('option');
    const sourceOption = options.find((o) => o.textContent?.includes(FROM_SUPPORT.name));
    expect(sourceOption).toBeUndefined();
  });

  it("soumet l'arbitrage et affiche un toast", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(INSURANCE_POSITIONS, onClose);

    await user.type(screen.getByLabelText(/montant arbitré/i), '1000');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Arbitrage enregistré'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('désactive le bouton Enregistrer si le montant est vide', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(INSURANCE_POSITIONS, onClose);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('affiche un message si aucun autre support disponible', () => {
    renderModal([FROM_SUPPORT]);
    expect(
      screen.getByText(/Aucun autre support disponible pour l'arbitrage/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fermer/i })).toBeInTheDocument();
  });

  it("affiche un toast si l'API retourne une erreur", async () => {
    server.use(
      http.post('/api/insurance/:accountId/arbitrage', () =>
        HttpResponse.json({ error: 'Solde insuffisant' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/montant arbitré/i), '99999');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Solde insuffisant'),
    );
  });
});
