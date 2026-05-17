import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceRachatModal } from '@/components/InsuranceRachatModal';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const SUPPORT = INSURANCE_POSITIONS[0]; // Fonds Euro Sécurité, value: 5000
const ACCOUNT_ID = 10;

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceRachatModal accountId={ACCOUNT_ID} support={SUPPORT} onClose={onClose} />,
  );
}

describe('InsuranceRachatModal', () => {
  it('affiche le titre avec le nom du support', () => {
    renderModal();
    expect(screen.getByText(`Rachat — ${SUPPORT.name}`)).toBeInTheDocument();
  });

  it('affiche le montant max égal à la valeur du support', () => {
    renderModal();
    expect(screen.getByText(/5\s*000/)).toBeInTheDocument();
  });

  it('affiche les champs montant, frais et date', () => {
    renderModal();
    expect(screen.getByLabelText(/montant racheté/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frais/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it('affiche le champ prélèvements sociaux avec une valeur par défaut à 0', () => {
    renderModal();
    const input = screen.getByLabelText(/prélèvements sociaux/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('0');
  });

  it(`affiche le sélecteur "Vers le compte" avec les comptes standards`, async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByLabelText(/vers le compte/i));
    await screen.findByRole('listbox');
    expect(screen.getByRole('option', { name: /Compte test/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Livret A/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /AV Suravenir/i })).not.toBeInTheDocument();
  });

  it('soumet sans compte destination et affiche un toast', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/montant racheté/i), '500');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Rachat enregistré'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('soumet avec un compte destination sélectionné', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByLabelText(/vers le compte/i));
    await screen.findByRole('listbox');
    await user.click(screen.getByRole('option', { name: /Compte test/i }));
    await user.type(screen.getByLabelText(/montant racheté/i), '500');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Rachat enregistré'),
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
      http.post('/api/insurance/:accountId/rachat', () =>
        HttpResponse.json({ error: 'Solde insuffisant' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/montant racheté/i), '99999');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Solde insuffisant'),
    );
  });
});
