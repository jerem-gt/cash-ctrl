import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ME, TRUSTED_DEVICES } from '@/tests/fixtures';
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
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ...ME, totpEnabled: true })));
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Activée')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /désactiver/i })).toBeInTheDocument();
  });

  it('désactive la 2FA après confirmation du mot de passe', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ...ME, totpEnabled: true })));
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

describe('TwoFactorCard — appareils mémorisés', () => {
  function withTotp() {
    server.use(http.get('/api/auth/me', () => HttpResponse.json({ ...ME, totpEnabled: true })));
  }

  it('liste les appareils avec le badge « Cet appareil »', async () => {
    withTotp();
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Firefox · Linux')).toBeInTheDocument();
    expect(screen.getByText('Safari · iOS')).toBeInTheDocument();
    expect(screen.getAllByText('Cet appareil')).toHaveLength(1);
    expect(screen.getAllByText(/Dernière utilisation : .+ à \d{2}:\d{2}/)).toHaveLength(2);
  });

  it('affiche « Appareil inconnu » pour un libellé vide et « aujourd’hui » pour un usage récent', async () => {
    withTotp();
    server.use(
      http.get('/api/auth/devices', () =>
        HttpResponse.json({
          items: [{ ...TRUSTED_DEVICES[0], label: '', lastUsedAt: Date.now() }],
        }),
      ),
    );
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Appareil inconnu')).toBeInTheDocument();
    expect(screen.getByText(/aujourd'hui à \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('affiche un état vide sans appareil', async () => {
    withTotp();
    server.use(http.get('/api/auth/devices', () => HttpResponse.json({ items: [] })));
    renderWithProviders(<TwoFactorCard />);
    expect(await screen.findByText('Aucun appareil mémorisé.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /oublier tous/i })).not.toBeInTheDocument();
  });

  it("n'affiche pas la liste quand la 2FA est désactivée", async () => {
    renderWithProviders(<TwoFactorCard />);
    await screen.findByText('Désactivée');
    expect(screen.queryByText('Appareils mémorisés')).not.toBeInTheDocument();
  });

  it('oublie un appareil et affiche un toast', async () => {
    withTotp();
    let deletedId: string | undefined;
    server.use(
      http.delete('/api/auth/devices/:id', ({ params }) => {
        deletedId = params.id as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await screen.findByText('Safari · iOS');
    await user.click(screen.getAllByRole('button', { name: 'Oublier' })[1]);
    await waitFor(() => expect(deletedId).toBe('2'));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Appareil oublié'),
    );
  });

  it('oublie tous les appareils après confirmation', async () => {
    withTotp();
    let deleted = false;
    server.use(
      http.delete('/api/auth/devices', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: 'Oublier tous les appareils' }));
    expect(deleted).toBe(false);
    expect(screen.getByText('Oublier tous les appareils ?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Tous les appareils'),
    );
  });

  it("n'appelle pas l'API quand la confirmation est annulée", async () => {
    withTotp();
    let deleted = false;
    server.use(
      http.delete('/api/auth/devices', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TwoFactorCard />);
    await user.click(await screen.findByRole('button', { name: 'Oublier tous les appareils' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(deleted).toBe(false);
  });
});
