import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ME } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { ProfileCard } from './ProfileCard';

const toastText = () => document.getElementById('toast')?.textContent ?? '';

async function setup(me: Partial<typeof ME> = {}) {
  server.use(http.get('/api/auth/me', () => HttpResponse.json({ ...ME, ...me })));
  const utils = renderWithProviders(<ProfileCard />);
  await waitFor(() =>
    expect(screen.getByLabelText("Nom d'utilisateur")).toHaveValue(me.username ?? 'test'),
  );
  return utils;
}

describe('ProfileCard', () => {
  it('désactive Enregistrer sans modification ni mot de passe actuel', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it("met à jour nom et e-mail avec le mot de passe actuel, toast et cache 'me'", async () => {
    let body: unknown;
    server.use(
      http.patch('/api/auth/profile', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ME, username: 'nouveau', email: 'n@example.com' });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = await setup();
    await user.clear(screen.getByLabelText("Nom d'utilisateur"));
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'nouveau');
    await user.type(screen.getByLabelText(/E-mail/), 'n@example.com');
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(toastText()).toContain('Profil mis à jour'));
    expect(body).toEqual({
      currentPassword: 'secret123',
      username: 'nouveau',
      email: 'n@example.com',
    });
    expect(queryClient.getQueryData(['me'])).toMatchObject({ username: 'nouveau' });
  });

  it("efface l'e-mail existant avec le bouton Effacer (email null)", async () => {
    let body: unknown;
    server.use(
      http.patch('/api/auth/profile', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ME, email: null });
      }),
    );
    const user = userEvent.setup();
    await setup({ email: 'a@example.com' });
    await user.click(await screen.findByRole('button', { name: 'Effacer' }));
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(body).toEqual({ currentPassword: 'secret123', email: null }));
  });

  it("affiche l'erreur si le mot de passe actuel est incorrect", async () => {
    server.use(
      http.patch('/api/auth/profile', () =>
        HttpResponse.json(
          { error: { code: 'auth.current_password_incorrect', message: 'Mot de passe incorrect' } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    await setup();
    await user.type(screen.getByLabelText(/E-mail/), 'n@example.com');
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(toastText().length).toBeGreaterThan(0));
    expect(toastText()).not.toContain('Profil mis à jour');
  });

  it("n'affiche pas le test e-mail à un non-admin", async () => {
    await setup();
    expect(screen.queryByRole('button', { name: /e-mail de test/i })).toBeNull();
  });

  it("envoie l'e-mail de test pour un admin", async () => {
    const user = userEvent.setup();
    await setup({ isAdmin: true });
    await user.click(await screen.findByRole('button', { name: /e-mail de test/i }));
    await waitFor(() => expect(toastText()).toContain('E-mail de test envoyé'));
  });

  it("affiche l'erreur traduite si le SMTP n'est pas configuré", async () => {
    server.use(
      http.post('/api/auth/test-email', () =>
        HttpResponse.json(
          { error: { code: 'auth.smtp_not_configured', message: 'SMTP non configuré' } },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    await setup({ isAdmin: true });
    await user.click(await screen.findByRole('button', { name: /e-mail de test/i }));
    await waitFor(() => expect(toastText().length).toBeGreaterThan(0));
    expect(toastText()).not.toContain('envoyé');
  });
});
