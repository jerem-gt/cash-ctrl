import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { ResetPasswordPage } from './ResetPasswordPage';

function setup(url = '/reset-password?token=abc') {
  return renderWithProviders(<ResetPasswordPage />, { initialEntries: [url] });
}

async function fill(user: ReturnType<typeof userEvent.setup>, confirm = 'password123') {
  await user.type(screen.getByLabelText('Nouveau mot de passe'), 'password123');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm);
}

describe('ResetPasswordPage', () => {
  it("affiche l'erreur et le lien de nouvelle demande sans jeton", () => {
    setup('/reset-password');
    expect(screen.getByText('Ce lien est invalide ou a expiré.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Refaire une demande' })).toBeInTheDocument();
  });

  it('réinitialise le mot de passe, invalide la session et propose le retour au login', async () => {
    let body: unknown;
    server.use(
      http.post('/api/auth/password/reset', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = setup();
    queryClient.setQueryData(['me'], { username: 'test' });
    await fill(user);
    await user.click(screen.getByRole('button', { name: /réinitialiser/i }));

    expect(await screen.findByText(/Mot de passe réinitialisé/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la connexion' })).toBeInTheDocument();
    expect(body).toEqual({ token: 'abc', password: 'password123' });
    await waitFor(() => expect(queryClient.getQueryData(['me'])).toBeNull());
  });

  it('refuse des mots de passe différents', async () => {
    const user = userEvent.setup();
    setup();
    await fill(user, 'autre-chose');
    await user.click(screen.getByRole('button', { name: /réinitialiser/i }));
    expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
  });

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'court');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'court');
    await user.click(screen.getByRole('button', { name: /réinitialiser/i }));
    expect(await screen.findByText('Minimum 8 caractères.')).toBeInTheDocument();
  });

  it('affiche le message de jeton expiré et le lien pour refaire une demande', async () => {
    server.use(
      http.post('/api/auth/password/reset', () =>
        HttpResponse.json(
          { error: { code: 'auth.reset_token_invalid', message: 'Lien invalide' } },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: /réinitialiser/i }));
    expect(await screen.findByText('Ce lien est invalide ou a expiré.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Refaire une demande' })).toBeInTheDocument();
  });
});
