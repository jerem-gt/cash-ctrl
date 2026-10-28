import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ME } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import AdminPage from './AdminPage';

async function setup() {
  server.use(
    http.get('/api/auth/me', () =>
      HttpResponse.json({ ...ME, id: 1, username: 'admin', isAdmin: true }),
    ),
  );
  const utils = renderWithProviders(<AdminPage />);
  await screen.findByText('alice');
  await screen.findByText('(vous)');
  return utils;
}

const toastText = () => document.getElementById('toast')?.textContent ?? '';

describe('AdminPage — affichage', () => {
  it('affiche le titre et la liste des utilisateurs', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Utilisateurs' })).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it("affiche l'e-mail, ou une mention quand il est absent", async () => {
    await setup();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Aucun e-mail')).toBeInTheDocument();
  });

  it('affiche les badges admin et 2FA aux bons utilisateurs', async () => {
    await setup();
    expect(
      screen.getAllByText('admin').filter((el) => el.classList.contains('uppercase')),
    ).toHaveLength(1);
    expect(screen.getAllByText('2FA')).toHaveLength(1);
  });

  it("n'offre ni suppression ni changement de rôle sur son propre compte", async () => {
    await setup();
    // Seul alice : suppression, promotion et désactivation 2FA ; modifier sur les deux
    expect(screen.getAllByTitle('Modifier')).toHaveLength(2);
    expect(screen.getAllByTitle('Supprimer')).toHaveLength(1);
    expect(screen.getAllByTitle('Promouvoir administrateur')).toHaveLength(1);
    expect(screen.queryByTitle('Retirer le rôle administrateur')).toBeNull();
    expect(screen.getAllByTitle('Désactiver la 2FA')).toHaveLength(1);
  });
});

describe('AdminPage — ajout utilisateur', () => {
  it('affiche le formulaire au clic sur Ajouter', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument();
  });

  it('crée un utilisateur avec e-mail et affiche un toast de succès', async () => {
    let body: unknown;
    server.use(
      http.post('/api/users', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 99 }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await user.type(screen.getByPlaceholderText("Nom d'utilisateur"), 'newuser');
    await user.type(screen.getByPlaceholderText('E-mail (facultatif)'), 'new@example.com');
    await user.type(screen.getByPlaceholderText(/Mot de passe \(min/), 'password123');
    await user.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(toastText()).toContain('créé'));
    expect(body).toEqual({
      username: 'newuser',
      password: 'password123',
      lang: 'fr',
      email: 'new@example.com',
    });
  });

  it("affiche l'erreur traduite si le nom est déjà pris", async () => {
    server.use(
      http.post('/api/users', () =>
        HttpResponse.json(
          { error: { code: 'user.username_taken', message: 'Nom déjà pris' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await user.type(screen.getByPlaceholderText("Nom d'utilisateur"), 'alice');
    await user.type(screen.getByPlaceholderText(/Mot de passe \(min/), 'password123');
    await user.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(toastText().length).toBeGreaterThan(0));
    expect(toastText()).not.toContain('créé');
  });

  it('ferme le formulaire au clic sur la croix', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    await user.click(screen.getByRole('button', { name: '' }));
    expect(screen.queryByText('Nouvel utilisateur')).toBeNull();
  });
});

describe('AdminPage — modification utilisateur', () => {
  it("n'envoie que les champs modifiés (nom, e-mail)", async () => {
    let body: unknown;
    server.use(
      http.patch('/api/users/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 2 });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getAllByTitle('Modifier')[1]);
    expect(screen.getByText(/Modifier alice/)).toBeInTheDocument();

    const usernameInput = screen.getByDisplayValue('alice');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'alicia');
    await user.type(screen.getByPlaceholderText(/E-mail \(laisser vide/), 'alicia@example.com');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(toastText()).toContain('modifié'));
    expect(body).toEqual({ username: 'alicia', email: 'alicia@example.com' });
  });

  it("envoie email null quand l'e-mail existant est vidé", async () => {
    let body: unknown;
    server.use(
      http.patch('/api/users/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 1 });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getAllByTitle('Modifier')[0]);
    await user.clear(screen.getByDisplayValue('admin@example.com'));
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(body).toEqual({ email: null }));
  });

  it("affiche l'erreur serveur sur conflit 409", async () => {
    server.use(
      http.patch('/api/users/:id', () =>
        HttpResponse.json(
          { error: { code: 'user.email_taken', message: 'E-mail déjà utilisé' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getAllByTitle('Modifier')[1]);
    await user.type(screen.getByPlaceholderText(/E-mail \(laisser vide/), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(toastText().length).toBeGreaterThan(0));
    expect(toastText()).not.toContain('modifié');
  });
});

describe('AdminPage — rôle administrateur', () => {
  it('promeut un utilisateur et affiche un toast', async () => {
    let body: unknown;
    server.use(
      http.patch('/api/users/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 2 });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByTitle('Promouvoir administrateur'));
    await waitFor(() => expect(toastText()).toContain('accordé'));
    expect(body).toEqual({ is_admin: true });
  });

  it("affiche l'erreur quand on retire le dernier admin (409)", async () => {
    server.use(
      http.get('/api/users', () =>
        HttpResponse.json([
          { ...ADMIN_ROW, id: 1, username: 'admin' },
          { ...ADMIN_ROW, id: 3, username: 'bob' },
        ]),
      ),
      http.patch('/api/users/:id', () =>
        HttpResponse.json(
          { error: { code: 'user.last_admin', message: 'Dernier administrateur' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAsAdmin();
    await user.click(await screen.findByTitle('Retirer le rôle administrateur'));
    await waitFor(() => expect(toastText().length).toBeGreaterThan(0));
    expect(toastText()).not.toContain('retiré');
  });
});

const ADMIN_ROW = {
  id: 1,
  username: 'admin',
  email: null,
  is_admin: 1,
  totp_enabled: 0,
  created_at: '2025-01-01T00:00:00',
  account_count: 0,
  tx_count: 0,
  last_tx_date: null,
};

function renderAsAdmin() {
  server.use(
    http.get('/api/auth/me', () =>
      HttpResponse.json({ ...ME, id: 1, username: 'admin', isAdmin: true }),
    ),
  );
  return renderWithProviders(<AdminPage />);
}

describe('AdminPage — 2FA', () => {
  it('désactive la 2FA après confirmation', async () => {
    let called = false;
    server.use(
      http.delete('/api/users/:id/2fa', () => {
        called = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByTitle('Désactiver la 2FA'));
    await user.click(await screen.findByRole('button', { name: /confirmer/i }));
    await waitFor(() => expect(toastText()).toContain('2FA désactivée'));
    expect(called).toBe(true);
  });

  it("n'appelle pas l'API si la confirmation est annulée", async () => {
    let called = false;
    server.use(
      http.delete('/api/users/:id/2fa', () => {
        called = true;
        return HttpResponse.json({ ok: true });
      }),
    );
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByTitle('Désactiver la 2FA'));
    await user.click(await screen.findByRole('button', { name: /annuler/i }));
    expect(called).toBe(false);
  });
});

describe('AdminPage — suppression utilisateur', () => {
  it('supprime un utilisateur après confirmation et affiche un toast', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByTitle('Supprimer'));
    await user.click(await screen.findByRole('button', { name: /confirmer/i }));
    await waitFor(() => expect(toastText()).toContain('supprimé'));
  });

  it('ne supprime pas si la confirmation est annulée', async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByTitle('Supprimer'));
    await user.click(await screen.findByRole('button', { name: /annuler/i }));
    expect(toastText()).not.toContain('supprimé');
  });
});
