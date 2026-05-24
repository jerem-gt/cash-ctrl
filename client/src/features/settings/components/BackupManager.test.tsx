import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { BackupManager } from './BackupManager';

describe('BackupManager', () => {
  it('affiche la section de configuration', async () => {
    renderWithProviders(<BackupManager />);
    expect(await screen.findByText('Backup automatique')).toBeInTheDocument();
    expect(screen.getByText('Activer le backup automatique')).toBeInTheDocument();
    expect(screen.getByLabelText('Fréquence (en heures)')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de fichiers à conserver')).toBeInTheDocument();
  });

  it('affiche la liste des backups', async () => {
    renderWithProviders(<BackupManager />);
    expect(await screen.findByText('Fichiers de backup')).toBeInTheDocument();
    expect(await screen.findByText('cashctrl-backup-2026-05-14T10-00-00.json')).toBeInTheDocument();
  });

  it('affiche un message vide si aucun backup', async () => {
    server.use(http.get('/api/backup/list', () => HttpResponse.json([])));
    renderWithProviders(<BackupManager />);
    expect(await screen.findByText(/Aucun backup disponible/)).toBeInTheDocument();
  });

  it('affiche le bouton Lancer un backup maintenant', async () => {
    renderWithProviders(<BackupManager />);
    expect(
      await screen.findByRole('button', { name: /Lancer un backup maintenant/ }),
    ).toBeInTheDocument();
  });

  it('déclenche un backup au clic sur le bouton', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BackupManager />);
    const btn = await screen.findByRole('button', { name: /Lancer un backup maintenant/ });
    await user.click(btn);
    await waitFor(() => expect(screen.queryByText('En cours…')).not.toBeInTheDocument());
  });

  it('affiche Enregistrer quand un champ est modifié', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BackupManager />);
    const input = await screen.findByLabelText('Fréquence (en heures)');
    await user.clear(input);
    await user.type(input, '48');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('masque Enregistrer après Annuler', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BackupManager />);
    const input = await screen.findByLabelText('Fréquence (en heures)');
    await user.clear(input);
    await user.type(input, '48');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  });

  it('toggle active/désactive le backup', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BackupManager />);
    const toggle = await screen.findByRole('switch', { name: /Activer le backup automatique/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
