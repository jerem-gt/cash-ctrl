import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { SetupPage } from './SetupPage';

async function fill(user: ReturnType<typeof userEvent.setup>, confirm = 'password123') {
  await user.type(screen.getByLabelText("Jeton d'installation"), 'TOKEN');
  await user.type(screen.getByLabelText("Nom d'utilisateur"), 'owner');
  await user.type(screen.getByLabelText('Mot de passe'), 'password123');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm);
}

describe('SetupPage', () => {
  it("affiche l'aide sur le jeton des logs serveur", () => {
    renderWithProviders(<SetupPage />);
    expect(screen.getByText(/docker logs/)).toBeInTheDocument();
  });

  it('désactive le bouton tant que les champs requis sont vides', () => {
    renderWithProviders(<SetupPage />);
    expect(screen.getByRole('button', { name: /créer le compte/i })).toBeDisabled();
  });

  it('envoie le jeton, le nom, le mot de passe et la langue courante', async () => {
    let body: unknown;
    server.use(
      http.post('/api/auth/setup', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          username: 'owner',
          email: null,
          isAdmin: true,
          totpEnabled: false,
        });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<SetupPage />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /créer le compte/i }));

    await waitFor(() => expect(queryClient.getQueryData(['me'])).toMatchObject({ isAdmin: true }));
    expect(body).toEqual({
      token: 'TOKEN',
      username: 'owner',
      password: 'password123',
      lang: 'fr',
    });
  });

  it('refuse des mots de passe différents sans appeler le serveur', async () => {
    let called = false;
    server.use(
      http.post('/api/auth/setup', () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await fill(user, 'autre-chose');
    await user.click(screen.getByRole('button', { name: /créer le compte/i }));
    expect(await screen.findByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await user.type(screen.getByLabelText("Jeton d'installation"), 'T');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'owner');
    await user.type(screen.getByLabelText('Mot de passe'), 'court');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'court');
    await user.click(screen.getByRole('button', { name: /créer le compte/i }));
    expect(await screen.findByText('Minimum 8 caractères.')).toBeInTheDocument();
  });

  it("affiche l'erreur serveur si le jeton est invalide", async () => {
    server.use(
      http.post('/api/auth/setup', () =>
        HttpResponse.json(
          { error: { code: 'auth.setup_token_invalid', message: 'Jeton invalide' } },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SetupPage />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /créer le compte/i }));
    expect(await screen.findByText(/jeton/i, { selector: 'div' })).toBeInTheDocument();
  });
});
