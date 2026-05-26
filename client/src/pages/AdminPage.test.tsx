import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { AdminPage } from './AdminPage';

function setup() {
  return renderWithProviders(<AdminPage username="admin" />);
}

describe('AdminPage — affichage', () => {
  it("affiche le titre et le nom de l'admin connecté", () => {
    setup();
    expect(screen.getByText(/Administration/)).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('liste les utilisateurs après chargement', async () => {
    setup();
    expect(await screen.findByText('alice')).toBeInTheDocument();
  });

  it("affiche le badge 'admin' sur le compte admin et pas sur les autres", async () => {
    setup();
    await screen.findByText('alice');
    const badges = screen.getAllByText('admin');
    // L'un est le username dans le header, l'autre est le badge
    const adminBadge = badges.find(
      (el) => el.classList.contains('uppercase') && el.textContent === 'admin',
    );
    expect(adminBadge).toBeInTheDocument();
  });

  it("n'affiche pas de boutons modifier/supprimer sur le compte admin", async () => {
    setup();
    await screen.findByText('alice');
    // Seul alice (non-admin) doit avoir ces boutons : exactement 1 de chaque
    expect(screen.getAllByTitle('Modifier')).toHaveLength(1);
    expect(screen.getAllByTitle('Supprimer')).toHaveLength(1);
  });
});

describe('AdminPage — ajout utilisateur', () => {
  it('affiche le formulaire au clic sur Ajouter', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument();
  });

  it('crée un utilisateur et affiche un toast de succès', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    const inputs = document.querySelectorAll('input');
    await user.type(inputs[0], 'newuser');
    await user.type(inputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('créé'));
  });

  it("affiche un toast d'erreur si le username est déjà pris", async () => {
    server.use(
      http.post('/api/users', () =>
        HttpResponse.json({ error: 'Username already taken' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));

    const inputs = document.querySelectorAll('input');
    await user.type(inputs[0], 'alice');
    await user.type(inputs[1], 'password123');
    await user.click(screen.getByRole('button', { name: /créer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Username already taken'),
    );
  });

  it('ferme le formulaire au clic sur la croix', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByRole('button', { name: /ajouter/i }));
    expect(screen.getByText('Nouvel utilisateur')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '' }));
    expect(screen.queryByText('Nouvel utilisateur')).toBeNull();
  });
});

describe('AdminPage — modification utilisateur', () => {
  it('affiche le formulaire de modification au clic sur Modifier', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByTitle('Modifier'));
    expect(screen.getByText(/Modifier alice/)).toBeInTheDocument();
  });

  it('modifie le username et affiche un toast de succès', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByTitle('Modifier'));

    const usernameInput = screen.getByDisplayValue('alice');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'alicia');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('modifié'));
  });

  it("affiche un toast d'erreur si le username est déjà pris", async () => {
    server.use(
      http.patch('/api/users/:id', () =>
        HttpResponse.json({ error: 'Username already taken' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByTitle('Modifier'));

    const usernameInput = screen.getByDisplayValue('alice');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'admin');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Username already taken'),
    );
  });
});

describe('AdminPage — suppression utilisateur', () => {
  it('supprime un utilisateur après confirmation et affiche un toast', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByTitle('Supprimer'));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('supprimé'),
    );
    vi.restoreAllMocks();
  });

  it('ne supprime pas si la confirmation est annulée', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    await user.click(screen.getByTitle('Supprimer'));
    expect(document.getElementById('toast')?.textContent ?? '').not.toContain('supprimé');
    vi.restoreAllMocks();
  });
});

describe('AdminPage — déconnexion', () => {
  it('appelle logout au clic sur le bouton de déconnexion', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('alice');
    const logoutBtn = screen.getByTitle('Se déconnecter');
    await user.click(logoutBtn);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Déconnexion'),
    );
  });
});
