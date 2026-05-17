import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { AddInsuranceSupportModal } from '@/components/AddInsuranceSupportModal';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const ACCOUNT_ID = 10;

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(<AddInsuranceSupportModal accountId={ACCOUNT_ID} onClose={onClose} />);
}

describe('AddInsuranceSupportModal', () => {
  it('affiche le champ nom et les boutons radio de type', () => {
    renderModal();
    expect(screen.getByLabelText(/nom du support/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /fonds euro/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /uc/i })).not.toBeChecked();
  });

  it("n'affiche pas le champ ticker par défaut (type euro)", () => {
    renderModal();
    expect(screen.queryByLabelText(/ticker/i)).not.toBeInTheDocument();
  });

  it('affiche le champ ticker quand le type UC est sélectionné', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /uc/i }));
    expect(screen.getByLabelText(/ticker/i)).toBeInTheDocument();
  });

  it('désactive le bouton Ajouter si le nom est vide', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled();
  });

  it('désactive le bouton Ajouter si le ticker est un ISIN non résolu', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /uc/i }));
    await user.type(screen.getByLabelText(/nom du support/i), 'Mon UC');
    await user.type(screen.getByLabelText(/ticker/i), 'LU1681043599');
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled();
  });

  it('soumet avec le type euro et affiche un toast de succès', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.type(screen.getByLabelText(/nom du support/i), 'Fonds Euro');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Support créé'),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('soumet avec le type UC et un ticker renseigné', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);

    await user.click(screen.getByRole('radio', { name: /uc/i }));
    await user.type(screen.getByLabelText(/nom du support/i), 'Amundi World');
    await user.type(screen.getByLabelText(/ticker/i), 'AMUNDI.PA');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Support créé'),
    );
    expect(onClose).toHaveBeenCalled();
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
      http.post(`/api/insurance/:accountId/supports`, () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/nom du support/i), 'Fonds Euro');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toBeTruthy());
  });
});
