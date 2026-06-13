import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceInteretsModal } from '@/features/insurance/components/InsuranceInteretsModal';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const SUPPORT = INSURANCE_POSITIONS[0]; // Fonds Euro Sécurité, value: 5000
const ACCOUNT_ID = 10;

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceInteretsModal accountId={ACCOUNT_ID} support={SUPPORT} onClose={onClose} />,
  );
}

describe('InsuranceInteretsModal', () => {
  it('affiche le titre avec le nom du support', () => {
    renderModal();
    expect(screen.getByText(`Intérêts — ${SUPPORT.name}`)).toBeInTheDocument();
  });

  it('affiche le solde actuel du support', () => {
    renderModal();
    expect(screen.getByText(/Solde actuel/i)).toBeInTheDocument();
  });

  it('affiche les champs montant et date', () => {
    renderModal();
    expect(screen.getByLabelText(/montant des intérêts/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it('désactive le bouton Enregistrer si le montant est vide', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('soumet le formulaire et affiche le toast de succès', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/montant des intérêts/i), '250');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Intérêts enregistrés'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('appelle onClose au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche un toast d'erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/insurance/:accountId/interets', () =>
        HttpResponse.json(
          { error: { code: 'common.internal', message: 'Erreur serveur' } },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/montant des intérêts/i), '100');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toBeTruthy());
  });
});
