import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

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

  it("affiche l'interface admin si l'utilisateur est admin", async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ username: 'admin', isAdmin: true })),
    );
    render(<App />);
    expect(await screen.findByText(/Administration/)).toBeInTheDocument();
    expect(screen.queryByText('Suivi Personnel')).toBeNull();
  });

  it('définit le titre du document après authentification', async () => {
    render(<App />);
    await screen.findByTitle(/Déconnexion/i);
    expect(document.title).toBe('CashCtrl (dev)');
  });
});
