import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

import { TwoFactorCard } from './TwoFactorCard';

describe('TwoFactorCard — 2FA désactivée', () => {
  it('affiche le statut désactivé et le bouton Activer', async () => {
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Double authentification (2FA)')).toBeInTheDocument();
    expect(await screen.findByText('Désactivée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activer/i })).toBeInTheDocument();
  });

  it('affiche le QR code et le secret après clic sur Activer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: /activer/i }));
    expect(await screen.findByText('Configuration de la 2FA')).toBeInTheDocument();
    expect(screen.getByText('BASE32SECRET')).toBeInTheDocument();
  });

  it('active la 2FA et affiche un toast de succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: /activer/i }));
    await screen.findByText('Configuration de la 2FA');
    const input = screen.getByPlaceholderText('000000');
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('activée'));
  });

  it('affiche un toast si le code est invalide', async () => {
    server.use(
      http.post('/api/auth/2fa/enable', () =>
        HttpResponse.json(
          { error: { code: 'auth.totp_invalid', message: 'Code invalide ou expiré' } },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: /activer/i }));
    await screen.findByText('Configuration de la 2FA');
    await user.type(screen.getByPlaceholderText('000000'), '999999');
    await user.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('invalide'),
    );
  });
});

describe('TwoFactorCard — 2FA activée', () => {
  it('affiche le statut activé et le bouton Désactiver', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: true }),
      ),
    );
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Activée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /désactiver/i })).toBeInTheDocument();
  });

  it('désactive la 2FA après confirmation du mot de passe', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ username: 'test', isAdmin: false, totpEnabled: true }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: /désactiver/i }));
    expect(screen.getByText('Désactiver la 2FA')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'monmotdepasse');
    await user.click(screen.getAllByRole('button', { name: /désactiver/i })[0]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('désactivée'),
    );
  });
});
