import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/tests/msw/server';

import App from './App';

describe('App', () => {
  it("affiche l'écran de chargement au premier rendu", () => {
    render(<App />);
    // isLoading=true avant la résolution de la requête /api/auth/me (async MSW)
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('affiche la page de connexion si non authentifié', async () => {
    server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })));
    render(<App />);
    expect(await screen.findByRole('button', { name: /se connecter/i })).toBeInTheDocument();
  });

  it('affiche la sidebar après authentification (user normal)', async () => {
    render(<App />);
    await screen.findByTitle(/Déconnexion/i);
    expect(screen.getByText('Suivi Personnel')).toBeInTheDocument();
  });

  it("affiche l'écran d'installation si aucun compte n'existe", async () => {
    server.use(
      http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })),
      http.get('/api/auth/setup', () => HttpResponse.json({ required: true })),
    );
    render(<App />);
    expect(await screen.findByRole('button', { name: /créer le compte/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /se connecter/i })).toBeNull();
  });

  it("un admin voit l'appli normale (sidebar) avec le lien Utilisateurs", async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({ username: 'admin', email: null, isAdmin: true, totpEnabled: false }),
      ),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Suivi Personnel');
    await user.click(screen.getByTitle('Menu'));
    expect(screen.getByRole('link', { name: /utilisateurs/i })).toBeInTheDocument();
  });

  it('un non-admin ne voit pas le lien Utilisateurs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Suivi Personnel');
    await user.click(screen.getByTitle('Menu'));
    expect(screen.queryByRole('link', { name: /utilisateurs/i })).toBeNull();
  });

  describe('routes', () => {
    afterEach(() => {
      globalThis.history.pushState({}, '', '/');
    });

    it('redirige un non-admin de /admin vers /', async () => {
      globalThis.history.pushState({}, '', '/admin');
      render(<App />);
      await screen.findByText('Suivi Personnel');
      await waitFor(() => expect(globalThis.location.pathname).toBe('/'));
    });

    it('affiche la page Utilisateurs sur /admin pour un admin', async () => {
      server.use(
        http.get('/api/auth/me', () =>
          HttpResponse.json({ username: 'admin', email: null, isAdmin: true, totpEnabled: false }),
        ),
      );
      globalThis.history.pushState({}, '', '/admin');
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'Utilisateurs' })).toBeInTheDocument();
      expect(await screen.findByText('alice')).toBeInTheDocument();
    });

    it('affiche /reset-password hors session', async () => {
      server.use(http.get('/api/auth/me', () => new HttpResponse(null, { status: 401 })));
      globalThis.history.pushState({}, '', '/reset-password?token=abc');
      render(<App />);
      expect(await screen.findByRole('button', { name: /réinitialiser/i })).toBeInTheDocument();
    });

    it('affiche /reset-password aussi en session', async () => {
      globalThis.history.pushState({}, '', '/reset-password?token=abc');
      render(<App />);
      expect(await screen.findByRole('button', { name: /réinitialiser/i })).toBeInTheDocument();
    });
  });

  it('définit le titre du document après authentification', async () => {
    render(<App />);
    await screen.findByTitle(/Déconnexion/i);
    await waitFor(() => expect(document.title).toBe('CashCtrl (dev)'));
  });

  it('Ctrl+K ouvre puis referme la palette de commande (plateforme non-Mac)', async () => {
    render(<App />);
    await screen.findByTitle(/Déconnexion/i);
    expect(screen.queryByPlaceholderText(/rechercher un compte/i)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText(/rechercher un compte/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/rechercher un compte/i)).not.toBeInTheDocument(),
    );
  });

  it('Ctrl+Shift+K ne déclenche pas la palette (réservé aux devtools du navigateur)', async () => {
    render(<App />);
    await screen.findByTitle(/Déconnexion/i);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, shiftKey: true });
    expect(screen.queryByPlaceholderText(/rechercher un compte/i)).not.toBeInTheDocument();
  });
});
