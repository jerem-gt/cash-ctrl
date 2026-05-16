import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceEditOperationModal } from '@/components/InsuranceEditOperationModal';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';
import type { InsuranceOperation } from '@/types';

const VERSEMENT_OP: InsuranceOperation = {
  id: 1,
  account_id: 10,
  support_id: 1,
  support_name: 'Fonds Euro Sécurité',
  support_type: 'euro',
  transaction_id: 100,
  fees_transaction_id: null,
  social_fees_transaction_id: null,
  type: 'versement',
  amount: 5000,
  fees: 0,
  social_fees: 0,
  date: '2024-01-15',
  arbitrage_peer_id: null,
  created_at: '2024-01-15T10:00:00',
  from_scheduled: false,
};

const RACHAT_OP: InsuranceOperation = {
  ...VERSEMENT_OP,
  id: 4,
  type: 'rachat',
  social_fees: 15,
};

const ARBITRAGE_OP: InsuranceOperation = {
  ...VERSEMENT_OP,
  id: 2,
  type: 'arbitrage_out',
  arbitrage_peer_id: 3,
};

const REVALORISATION_OP: InsuranceOperation = {
  ...VERSEMENT_OP,
  id: 3,
  type: 'revalorisation',
  fees: 0,
};

function renderModal(op = VERSEMENT_OP, onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceEditOperationModal accountId={10} op={op} onClose={onClose} />,
  );
}

describe('InsuranceEditOperationModal', () => {
  it('affiche le titre et le nom du support', () => {
    renderModal();
    expect(screen.getByText("Modifier l'opération")).toBeInTheDocument();
    expect(screen.getByText(/Versement — Fonds Euro Sécurité/i)).toBeInTheDocument();
  });

  it("pré-remplit le montant et la date avec les valeurs de l'opération", () => {
    renderModal();
    expect(screen.getByLabelText(/montant/i)).toHaveValue(5000);
    expect(screen.getByLabelText(/date/i)).toHaveValue('2024-01-15');
  });

  it('affiche le champ frais pour un versement', () => {
    renderModal();
    expect(screen.getByLabelText(/frais/i)).toBeInTheDocument();
  });

  it('affiche le champ frais pour un rachat', () => {
    renderModal({ ...VERSEMENT_OP, type: 'rachat', social_fees: 0 });
    expect(screen.getByLabelText(/frais/i)).toBeInTheDocument();
  });

  it('affiche le champ prélèvements sociaux pour un rachat et le pré-remplit', () => {
    renderModal(RACHAT_OP);
    const input = screen.getByLabelText(/prélèvements sociaux/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(15);
  });

  it("n'affiche pas le champ prélèvements sociaux pour un versement", () => {
    renderModal(VERSEMENT_OP);
    expect(screen.queryByLabelText(/prélèvements sociaux/i)).not.toBeInTheDocument();
  });

  it("n'affiche pas le champ frais pour les intérêts", () => {
    renderModal({ ...VERSEMENT_OP, type: 'interets' });
    expect(screen.queryByLabelText(/frais/i)).not.toBeInTheDocument();
  });

  it("n'affiche pas le champ frais pour une revalorisation", () => {
    renderModal(REVALORISATION_OP);
    expect(screen.queryByLabelText(/frais/i)).not.toBeInTheDocument();
  });

  it('affiche un message bloquant pour un arbitrage', () => {
    renderModal(ARBITRAGE_OP);
    expect(screen.getByText(/Les arbitrages ne peuvent pas être modifiés/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enregistrer/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fermer/i })).toBeInTheDocument();
  });

  it('ferme la modale arbitrage au clic sur Fermer', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(ARBITRAGE_OP, onClose);
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('désactive le bouton Enregistrer si le montant est vide', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.clear(screen.getByLabelText(/montant/i));
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('soumet le formulaire et affiche un toast', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(VERSEMENT_OP, onClose);

    await user.clear(screen.getByLabelText(/montant/i));
    await user.type(screen.getByLabelText(/montant/i), '2000');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Opération modifiée'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('ferme la modale au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(VERSEMENT_OP, onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche un toast en cas d'erreur API", async () => {
    server.use(
      http.put('/api/insurance/:accountId/operations/:operationId', () =>
        HttpResponse.json({ error: 'Le montant doit être positif' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.clear(screen.getByLabelText(/montant/i));
    await user.type(screen.getByLabelText(/montant/i), '999');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain(
        'Le montant doit être positif',
      ),
    );
  });

  it('accepte un montant négatif pour une revalorisation', () => {
    renderModal(REVALORISATION_OP);
    const input = screen.getByLabelText(/montant/i);
    expect(input).not.toHaveAttribute('min');
  });

  it('impose un montant positif pour un versement (min=0.01)', () => {
    renderModal(VERSEMENT_OP);
    const input = screen.getByLabelText(/montant/i);
    expect(input).toHaveAttribute('min', '0.01');
  });
});
