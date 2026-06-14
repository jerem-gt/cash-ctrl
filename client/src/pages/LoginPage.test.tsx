import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('affiche le formulaire de connexion', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByPlaceholderText('admin')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  it('désactive le bouton si les champs sont vides', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDisabled();
  });

  it('active le bouton quand les deux champs sont remplis', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText('admin'), 'testuser');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password');
    expect(screen.getByRole('button', { name: /se connecter/i })).not.toBeDisabled();
  });

  it("affiche une erreur en cas d'identifiants incorrects", async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ error: 'Identifiants invalides' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText('admin'), 'bad');
    await user.type(screen.getByPlaceholderText('••••••••'), 'bad');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));
    expect(await screen.findByText('Identifiants invalides')).toBeInTheDocument();
  });
});

describe('LoginPage — flux TOTP', () => {
  async function loginAndGetToTotpScreen() {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({ totp_required: true, pending_token: 'TOKEN123' }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.type(screen.getByPlaceholderText('admin'), 'testuser');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password');
    await user.click(screen.getByRole('button', { name: /se connecter/i }));
    await screen.findByPlaceholderText('000000');
    return user;
  }

  it('affiche le formulaire TOTP après un login avec totp_required', async () => {
    await loginAndGetToTotpScreen();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vérifier/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('admin')).not.toBeInTheDocument();
  });

  it('revient aux identifiants après clic sur ← Retour', async () => {
    const user = await loginAndGetToTotpScreen();
    await user.click(screen.getByText('← Retour'));
    expect(await screen.findByPlaceholderText('admin')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('000000')).not.toBeInTheDocument();
  });

  it('soumet le code TOTP et appelle /api/auth/2fa/verify', async () => {
    let verifyCalled = false;
    server.use(
      http.post('/api/auth/2fa/verify', () => {
        verifyCalled = true;
        return HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: true });
      }),
    );
    const user = await loginAndGetToTotpScreen();
    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: /vérifier/i }));
    await waitFor(() => expect(verifyCalled).toBe(true));
  });

  it('affiche une erreur si le code TOTP est invalide', async () => {
    server.use(
      http.post('/api/auth/2fa/verify', () =>
        HttpResponse.json({ error: 'Code invalide' }, { status: 401 }),
      ),
    );
    const user = await loginAndGetToTotpScreen();
    await user.type(screen.getByPlaceholderText('000000'), '000000');
    await user.click(screen.getByRole('button', { name: /vérifier/i }));
    expect(await screen.findByText('Code invalide')).toBeInTheDocument();
  });
});
