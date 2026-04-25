import { screen } from '@testing-library/react';
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
    await screen.findByText('Identifiants invalides');
  });
});
