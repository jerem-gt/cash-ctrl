import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { EditStockOperationModal } from '@/features/portfolio/components/EditStockOperationModal';
import { STOCK_TX } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(<EditStockOperationModal tx={STOCK_TX} onClose={onClose} />);
}

describe('EditStockOperationModal', () => {
  it('affiche le titre et le ticker', () => {
    renderModal();
    expect(screen.getByText("Modifier l'opération")).toBeInTheDocument();
    expect(screen.getByText('DCAM.PA')).toBeInTheDocument();
    expect(screen.getByText(/Achat/)).toBeInTheDocument();
  });

  it("pré-remplit les champs avec les valeurs de l'opération", () => {
    renderModal();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-04-01')).toBeInTheDocument();
  });

  it('calcule le montant total dynamiquement', async () => {
    const user = userEvent.setup();
    renderModal();

    const qtyInput = screen.getByLabelText(/nombre d'actions/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, '20');
    // 20 * 12 + 1.5 = 241.5
    await waitFor(() => expect(screen.getByText(/241/)).toBeInTheDocument());
  });

  it('soumet le formulaire et ferme le modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(document.getElementById('toast')?.textContent).toContain('Opération modifiée');
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.put('/api/stocks/:accountId/operations/:operationId', () =>
        HttpResponse.json({ error: 'Le montant net doit être positif' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('montant'));
  });

  it('désactive le bouton Enregistrer si quantité vide', async () => {
    const user = userEvent.setup();
    renderModal();

    const qtyInput = screen.getByLabelText(/nombre d'actions/i);
    await user.clear(qtyInput);

    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
