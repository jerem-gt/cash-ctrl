import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceVersementModal } from '@/components/InsuranceVersementModal';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const SUPPORT = INSURANCE_POSITIONS[0]; // Fonds Euro Sécurité, value: 5000
const ACCOUNT_ID = 10;

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceVersementModal accountId={ACCOUNT_ID} support={SUPPORT} onClose={onClose} />,
  );
}

describe('InsuranceVersementModal', () => {
  it('affiche le titre avec le nom du support', () => {
    renderModal();
    expect(screen.getByText(`Versement — ${SUPPORT.name}`)).toBeInTheDocument();
  });

  it('affiche les champs montant, frais et date', () => {
    renderModal();
    expect(screen.getByLabelText(/montant versé/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frais/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur "Depuis le compte" avec les comptes standards', async () => {
    renderModal();
    await screen.findByText('Compte test');
    expect(screen.getByText('Livret A')).toBeInTheDocument();
    expect(screen.queryByText('AV Suravenir')).not.toBeInTheDocument();
  });

  it('soumet sans compte source et affiche un toast', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/montant versé/i), '1000');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Versement enregistré'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('soumet avec un compte source sélectionné', async () => {
    const user = userEvent.setup();
    renderModal();

    await screen.findByText('Compte test');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.type(screen.getByLabelText(/montant versé/i), '500');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Versement enregistré'),
    );
  });

  it('désactive le bouton Enregistrer si le montant est vide', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /enregistrer/i })).toBeDisabled();
  });

  it('ferme le modal au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche un toast si l'API retourne une erreur", async () => {
    server.use(
      http.post(`/api/insurance/:accountId/versement`, () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/montant versé/i), '1000');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toBeTruthy());
  });
});
