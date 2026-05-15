import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { InsuranceRevalorisationModal } from '@/components/InsuranceRevalorisationModal';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const SUPPORT = INSURANCE_POSITIONS[1]; // Amundi MSCI World (UC), value: 1073.55
const ACCOUNT_ID = 10;

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <InsuranceRevalorisationModal accountId={ACCOUNT_ID} support={SUPPORT} onClose={onClose} />,
  );
}

describe('InsuranceRevalorisationModal', () => {
  it('affiche le titre avec le nom du support', () => {
    renderModal();
    expect(screen.getByText(`Revalorisation — ${SUPPORT.name}`)).toBeInTheDocument();
  });

  it('affiche la valeur actuelle du support', () => {
    renderModal();
    expect(screen.getByText(/1\s*073/)).toBeInTheDocument();
  });

  it('affiche les champs plus/moins-value et date', () => {
    renderModal();
    expect(screen.getByLabelText(/plus\/moins-value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it(`affiche l'indice "Positif = gain, négatif = perte"`, () => {
    renderModal();
    expect(screen.getByText(/positif = gain, négatif = perte/i)).toBeInTheDocument();
  });

  it('soumet une revalorisation positive et affiche un toast', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/plus\/moins-value/i), '150');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Revalorisation enregistrée'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('soumet une revalorisation négative (perte)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/plus\/moins-value/i), '-80');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Revalorisation enregistrée'),
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
    renderModal(onClose);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche un toast si l'API retourne une erreur", async () => {
    server.use(
      http.post('/api/insurance/:accountId/revalorisation', () =>
        HttpResponse.json({ error: 'Support introuvable' }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/plus\/moins-value/i), '100');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Support introuvable'),
    );
  });
});
